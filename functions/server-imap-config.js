'use strict';

const jsonServer = require('json-server');
const {ImapFlow} = require('imapflow');
const crypto = require('crypto');

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

/* -------------------- Szyfrowanie hasła (AES-256-GCM) -------------------- */

const ENC_VERSION = 'v1';
const SCRYPT_SALT = 'imap_cfg_salt_v1';

function getCryptoKey() {
  // Preferuj IMAP_ENC_KEY
  const rawKeyB64 = process.env.IMAP_ENC_KEY;
  if (rawKeyB64) {
    const key = Buffer.from(rawKeyB64, 'base64');
    if (key.length !== 32) {
      console.warn('⚠️ IMAP_ENC_KEY nie ma 32 bajtów po dekodowaniu base64 – używam scrypt z IMAP_ENC_PASSWORD');
    } else {
      return key;
    }
  }
  const pass = process.env.IMAP_ENC_PASSWORD || 'dev-only-not-secure';
  return crypto.scryptSync(pass, SCRYPT_SALT, 32);
}

function encryptSecret(plain) {
  if (!plain) return '';
  const key = getCryptoKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const enc = Buffer.concat([cipher.update(String(plain), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${ENC_VERSION}.${iv.toString('base64')}.${tag.toString('base64')}.${enc.toString('base64')}`;
}

function decryptSecret(token) {
  if (!token) return '';
  try {
    const [ver, ivB64, tagB64, dataB64] = String(token).split('.');
    if (ver !== ENC_VERSION) return '';
    const key = getCryptoKey();
    const iv = Buffer.from(ivB64, 'base64');
    const tag = Buffer.from(tagB64, 'base64');
    const data = Buffer.from(dataB64, 'base64');
    const dec = crypto.createDecipheriv('aes-256-gcm', key, iv);
    dec.setAuthTag(tag);
    const out = Buffer.concat([dec.update(data), dec.final()]);
    return out.toString('utf8');
  } catch {
    return '';
  }
}

/** Z pozycji ENV budujemy początkowy stan IMAP (mutowalny obiekt) */
function createImapStateFromEnv(env) {
  return {
    host: env.IMAP_HOST || '',
    port: String(env.IMAP_PORT || '993'),
    secure: String(env.IMAP_SECURE || 'true'),
    user: env.IMAP_USER || '',
    pass: env.IMAP_PASS || '',
    passEnc: env.IMAP_PASS_ENC || '' // jeśli ktoś poda wprost zaszyfrowane
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

/** Wyciąga jawne hasło wg priorytetu: body.pass > decrypt(stored.passEnc/state.passEnc) > legacy (stored.pass/state.pass) */
function resolvePlainPassword({body, stored, state}) {
  if (body && body.pass) return String(body.pass);
  const enc = (stored && stored.passEnc) || (state && state.passEnc);
  if (enc) {
    const dec = decryptSecret(enc);
    if (dec) return dec;
  }
  const legacy = (stored && stored.pass) || (state && state.pass);
  return legacy ? String(legacy) : '';
}

/** Test połączenia IMAP + listowanie folderów + próbka tematów */
async function testConnection(effectiveCfg) {
  const {ImapFlow} = require('imapflow'); // lazy import (dla testów)
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
        const start = Math.max(1, total - 4);
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

  function writeStored(obj) {
    ctx.ensureMap(KEY);
    ctx.routerDb.db.set(KEY, obj).write();
  }

  /** Składa efektywną konfigurację do testu: body > stored > state (z odszyfrowaniem hasła) */
  function buildEffectiveForTest(body) {
    const stored = readStored();
    const pass = resolvePlainPassword({body, stored, state});
    return normalizeCfg({
      host: (body.host ?? stored.host ?? state.host ?? '').trim(),
      port: toNum(body.port ?? stored.port ?? state.port ?? 993, 993),
      secure: toBool(body.secure ?? stored.secure ?? state.secure ?? true),
      user: (body.user ?? stored.user ?? state.user ?? '').trim(),
      pass,
      mailbox: (body.mailbox ?? stored.mailbox ?? 'INBOX').trim()
    });
  }

  return {
    // GET /imap/config | /api/imap/config
    get(req, res) {
      try {
        const stored = readStored();
        const view = {
          host: (state.host || stored.host || '').trim(),
          port: toNum(state.port ?? stored.port ?? 993, 993),
          secure: toBool(state.secure ?? stored.secure ?? true),
          user: (state.user || stored.user || '').trim(),
          mailbox: String(stored.mailbox || 'INBOX'),
          hasPassword: !!(stored.passEnc || stored.pass || state.passEnc || state.pass),
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

        // host/user wymagane
        const host = String(b.host ?? stored.host ?? '').trim();
        const user = String(b.user ?? stored.user ?? '').trim();
        if (!host || !user) {
          return res.status(400).json({error: 'host and user are required'});
        }

        // Ustalamy jakie hasło zachować
        let passEnc = '';
        if (b.pass && String(b.pass).trim()) {
          passEnc = encryptSecret(String(b.pass).trim());
        } else if (stored.passEnc) {
          passEnc = String(stored.passEnc);
        } else if (stored.pass) {
          // migracja z legacy plaintext
          passEnc = encryptSecret(String(stored.pass));
        } else if (state.passEnc) {
          passEnc = String(state.passEnc);
        } else if (state.pass) {
          passEnc = encryptSecret(String(state.pass));
        } else {
          return res.status(400).json({error: 'pass is required (no previous password stored)'});
        }

        const next = {
          host,
          port: String(b.port != null ? b.port : (stored.port != null ? stored.port : '993')).trim(),
          secure: String(
            b.secure == null
              ? (state.secure ?? stored.secure ?? 'true')
              : (typeof b.secure === 'boolean' ? b.secure : String(b.secure))
          ),
          user,
          passEnc,
          mailbox: String(b.mailbox || stored.mailbox || 'INBOX').trim(),
          updatedAt: new Date().toISOString()
        };

        // Zapis do lowdb
        writeStored(next);

        // Aktualizacja stanu
        state.host = next.host;
        state.port = next.port;
        state.secure = next.secure;
        state.user = next.user;
        state.pass = '';
        state.passEnc = next.passEnc;

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
  imapConfigHandlers,
  decryptSecret,
  encryptSecret
};
