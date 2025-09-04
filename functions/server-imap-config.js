'use strict';

const jsonServer = require('json-server');
const {ImapFlow} = require('imapflow');

/**
 * Prosty kontekst lowdb do przechowywania konfiguracji IMAP (db-email.json).
 */
function createContext(dbPath) {
  const routerDb = jsonServer.router(dbPath);

  function ensureMap(name) {
    if (!routerDb.db.has(name).value()) {
      routerDb.db.set(name, {}).write();
    }
  }

  return {routerDb, ensureMap};
}

/** Normalizacja wartości logicznych/numerycznych */
function toBool(v) {
  if (typeof v === 'boolean') return v;
  const s = String(v ?? '').trim().toLowerCase();
  return s === 'true' || s === '1' || s === 'yes';
}

function toNum(v, def) {
  const n = Number(v);
  return Number.isFinite(n) ? n : def;
}

/** Z pozycji ENV budujemy początkowy stan IMAP (mutowalny obiekt) */
function createImapStateFromEnv(env) {
  return {
    host: env.IMAP_HOST || '',
    port: String(env.IMAP_PORT || '993'),
    secure: String(env.IMAP_SECURE || 'true'), // 'true'/'false' jako string
    user: env.IMAP_USER || '',
    pass: env.IMAP_PASS || ''
  };
}

/** Łączy wejściowy cfg z fallbackami i normalizuje typy pod ImapFlow/UI */
function normalizeCfg(input, fallbacks = {}) {
  const merged = {...(fallbacks || {}), ...(input || {})};
  return {
    host: String(merged.host || '').trim(),
    port: toNum(merged.port, 993),
    secure: toBool(merged.secure),
    user: String(merged.user || '').trim(),
    pass: String(merged.pass || '').trim(),
    mailbox: String(merged.mailbox || 'INBOX').trim()
  };
}

/** Test połączenia IMAP + listowanie folderów + próbka tematów */
async function testConnection(effectiveCfg) {
  const client = new ImapFlow({
    host: effectiveCfg.host,
    port: effectiveCfg.port,
    secure: effectiveCfg.secure,
    auth: {user: effectiveCfg.user, pass: effectiveCfg.pass},
    logger: true
  });

  try {
    await client.connect();

    // Lista folderów (ImapFlow v1 - .list())
    const listResp = await client.list();
    const mailboxes = Array.isArray(listResp)
      ? listResp.map(m => m.path).filter(Boolean)
      : [];

    // Próbka tematów z końca wybranego folderu
    const sample = [];
    const lock = await client.getMailboxLock(effectiveCfg.mailbox || 'INBOX');
    try {
      const total = client.mailbox?.exists || 0;
      if (total > 0) {
        const start = Math.max(1, total - 4); // do 5 ostatnich
        const range = `${start}:*`;
        for await (const msg of client.fetch(range, {uid: true, envelope: true})) {
          sample.push({
            id: String(msg.uid),
            subject: (msg.envelope?.subject || '').toString() || '(bez tematu)'
          });
        }
      }
    } finally {
      lock.release();
    }

    await client.logout();
    return {ok: true, mailboxes, sample};
  } catch (err) {
    try {
      client.close();
    } catch (_) {
    }
    throw err;
  }
}

/**
 * Zestaw handlerów do pobierania/zapisywania/testowania konfiguracji IMAP.
 * Zapis trwały w db-email.json (mapa imapConfig).
 * Mutuje przekazany `state` (referencja), aby inne moduły widziały bieżące wartości.
 */
function imapConfigHandlers({dbPath, state}) {
  const ctx = createContext(dbPath);
  const KEY = 'imapConfig';

  function readStored() {
    ctx.ensureMap(KEY);
    return ctx.routerDb.db.get(KEY).value() || {};
  }

  function writeStored(cfg) {
    ctx.ensureMap(KEY);
    ctx.routerDb.db.set(KEY, cfg).write();
  }

  /** Składa efektywną konfigurację do testu: body > stored > state */
  function buildEffectiveForTest(body) {
    const stored = readStored();
    const pass = (body && body.pass) || stored.pass || state.pass || '';
    return normalizeCfg({...stored, ...state, ...body, pass});
  }

  return {
    // GET /imap/config | /api/imap/config
    get(req, res) {
      try {
        const stored = readStored();
        // Widok zgodny z UI: port:number, secure:boolean, hasPassword, updatedAt
        const view = {
          host: (state.host || stored.host || '').trim(),
          port: toNum(state.port ?? stored.port ?? 993, 993),
          secure: toBool(state.secure ?? stored.secure ?? true),
          user: (state.user || stored.user || '').trim(),
          mailbox: String(stored.mailbox || 'INBOX'),
          hasPassword: !!(stored.pass || state.pass),
          updatedAt: stored.updatedAt || null
        };
        res.json(view);
      } catch (e) {
        console.error('❌ [imapConfig.get] error', e);
        res.status(500).json({error: 'internal'});
      }
    },

    // POST /imap/config | /api/imap/config
    set(req, res) {
      try {
        const b = req.body || {};
        const stored = readStored();

        // Hasło może być pominięte - wtedy zostaje poprzednie (stored/state)
        const resolvedPass = String(b.pass || stored.pass || state.pass || '').trim();

        const next = {
          host: String(b.host || stored.host || '').trim(),
          port: String(b.port != null ? b.port : (stored.port != null ? stored.port : '993')).trim(),
          secure: String(
            b.secure == null
              ? (state.secure ?? stored.secure ?? 'true')
              : (typeof b.secure === 'boolean' ? b.secure : String(b.secure))
          ),
          user: String(b.user || stored.user || '').trim(),
          pass: resolvedPass,
          mailbox: String(b.mailbox || stored.mailbox || 'INBOX').trim(),
          updatedAt: new Date().toISOString()
        };

        // Wymagane pola
        if (!next.host || !next.user) {
          return res.status(400).json({error: 'host and user are required'});
        }
        // Jeśli to pierwszy zapis i nadal brak hasła - zablokuj
        if (!next.pass) {
          return res.status(400).json({error: 'pass is required (no previous password stored)'});
        }

        // Zapis do lowdb
        writeStored(next);

        // Aktualizacja stanu "na żywo" (zachowujemy konwencję stringów dla port/secure)
        state.host = next.host;
        state.port = next.port;
        state.secure = next.secure;
        state.user = next.user;
        state.pass = next.pass;

        res.json({ok: true});
      } catch (e) {
        console.error('❌ [imapConfig.set] error', e);
        res.status(500).json({error: 'internal'});
      }
    },

    // POST /imap/test | /api/imap/test
    async test(req, res) {
      try {
        const effective = buildEffectiveForTest(req.body || {});
        if (!effective.host || !effective.user || !effective.pass) {
          return res.status(400).json({error: 'host, user, pass required for test'});
        }
        const result = await testConnection(effective);
        res.json(result);
      } catch (e) {
        console.error('❌ [imapConfig.test] error', e);
        res.status(500).json({error: 'internal'});
      }
    }
  };
}

module.exports = {
  createImapStateFromEnv,
  imapConfigHandlers
};
