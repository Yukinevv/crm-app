'use strict';

const {
  createContext,
  toBool,
  toNum,
  encryptSecret,
  decryptSecret,
  createImapStateFromEnv,
  readImapConfigForUid,
  writeImapConfigForUid,
  testImapConnection,
} = require('./utils');

/** Normalizacja do testu */
function normalizeCfg(input) {
  return {
    host: String(input.host || '').trim(),
    port: toNum(input.port, 993),
    secure: toBool(input.secure),
    user: String(input.user || '').trim(),
    pass: String(input.pass || '').trim(),
    mailbox: String(input.mailbox || 'INBOX').trim()
  };
}

/**
 * Handlery IMAP per-użytkownik (imapConfigsByUid[uid])
 */
function imapConfigHandlers({dbPath, state}) {
  const ctx = createContext(dbPath);

  function requireUid(req, res) {
    const uid = req.user?.uid;
    if (!uid) {
      res.status(401).json({error: 'unauthenticated'});
      return null;
    }
    return uid;
  }

  /** Składa efektywną konfigurację do testu: body (plain pass) > stored(passEnc) */
  function buildEffectiveForTest(uid, body) {
    const stored = readImapConfigForUid(ctx, uid);
    const pass = body.pass
      ? String(body.pass)
      : decryptSecret(stored.passEnc || '');
    return normalizeCfg({
      host: (body.host ?? stored.host ?? state.host ?? '').trim(),
      port: toNum(body.port ?? stored.port ?? state.port ?? 993, 993),
      secure: toBool(body.secure ?? stored.secure ?? state.secure ?? true),
      user: (body.user ?? stored.user ?? state.user ?? '').trim(),
      pass,
      mailbox: String(body.mailbox ?? stored.mailbox ?? 'INBOX')
    });
  }

  return {
    // GET /imap/config | /api/imap/config
    get(req, res) {
      const uid = requireUid(req, res);
      if (!uid) return;
      try {
        const stored = readImapConfigForUid(ctx, uid);
        const view = {
          host: (stored.host || state.host || '').trim(),
          port: toNum(stored.port ?? state.port ?? 993, 993),
          secure: toBool(stored.secure ?? state.secure ?? true),
          user: (stored.user || state.user || '').trim(),
          mailbox: String(stored.mailbox || 'INBOX'),
          hasPassword: !!stored.passEnc,
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
      const uid = requireUid(req, res);
      if (!uid) return;
      try {
        const b = req.body || {};
        const prev = readImapConfigForUid(ctx, uid);

        const host = String(b.host ?? prev.host ?? '').trim();
        const user = String(b.user ?? prev.user ?? '').trim();
        if (!host || !user) {
          return res.status(400).json({error: 'host and user are required'});
        }

        let passEnc = '';
        if (b.pass && String(b.pass).trim()) {
          passEnc = encryptSecret(String(b.pass).trim());
        } else if (prev.passEnc) {
          passEnc = String(prev.passEnc);
        } else {
          return res.status(400).json({error: 'pass is required (no previous password stored)'});
        }

        const next = {
          host,
          port: String(b.port != null ? b.port : (prev.port != null ? prev.port : '993')).trim(),
          secure: String(
            b.secure == null
              ? (prev.secure ?? state.secure ?? 'true')
              : (typeof b.secure === 'boolean' ? b.secure : String(b.secure))
          ),
          user,
          passEnc,
          mailbox: String(b.mailbox || prev.mailbox || 'INBOX').trim(),
          updatedAt: new Date().toISOString()
        };

        writeImapConfigForUid(ctx, uid, next);

        // globalny fallback (bez hasła)
        state.host = next.host;
        state.port = next.port;
        state.secure = next.secure;
        state.user = next.user;

        res.json({ok: true});
      } catch (e) {
        console.error('❌ [imapConfig.set] error', e);
        res.status(500).json({error: 'internal'});
      }
    },

    // POST /imap/test | /api/imap/test
    async test(req, res) {
      const uid = requireUid(req, res);
      if (!uid) return;
      try {
        const effective = buildEffectiveForTest(uid, req.body || {});
        if (!effective.host || !effective.user || !effective.pass) {
          return res.status(400).json({error: 'host, user, pass required for test'});
        }
        const result = await testImapConnection(effective);
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
