'use strict';

const {ImapFlow} = require('imapflow');
const {simpleParser} = require('mailparser');
const iconv = require('iconv-lite');
const {
  createContext,
  toBool,
  toNum,
  decryptSecret,
  readImapConfigForUid,
} = require('./utils');

/* ----------------------------- helpers ------------------------------ */
function addrToString(list) {
  if (!list || !list.length) return '';
  const a = list[0];
  const name = a.name ? `${a.name}` : '';
  const email = a.address ? `${a.address}` : '';
  return name ? `${name} <${email}>` : email;
}

/* ------------------------ ctx + IMAP wrappers ----------------------- */

function createContextForInbox(dbPath) {
  // tylko mapy
  return createContext(dbPath);
}

function createInboxCore({dbPath}) {
  const ctx = createContextForInbox(dbPath);

  function resolveImapConfig(uid) {
    if (!uid) return {host: '', user: '', pass: '', mailbox: 'INBOX', port: 993, secure: true};
    const stored = readImapConfigForUid(ctx, uid);

    const host = String(stored.host || '').trim();
    const user = String(stored.user || '').trim();
    const pass = decryptSecret(stored.passEnc || '');
    const mailbox = String(stored.mailbox || 'INBOX').trim();
    const port = toNum(stored.port != null ? stored.port : 993, 993);
    const secure = toBool(stored.secure != null ? stored.secure : true);

    return {host, user, pass, mailbox, port, secure};
  }

  async function withImap(cfg, fn) {
    const client = new ImapFlow({
      host: cfg.host,
      port: cfg.port,
      secure: cfg.secure,
      auth: {user: cfg.user, pass: cfg.pass},
    });
    try {
      await client.connect();
      return await fn(client, cfg);
    } finally {
      try {
        await client.logout();
      } catch {
      }
    }
  }

  async function imapList(uid, limit = 50) {
    const cfg = resolveImapConfig(uid);
    if (!cfg.host || !cfg.user || !cfg.pass) {
      return [];
    }

    return withImap(cfg, async (client) => {
      await client.mailboxOpen(cfg.mailbox || 'INBOX');

      const total = client.mailbox?.exists || 0;
      if (!total) return [];

      const take = Math.max(1, Math.min(limit, total));
      const startSeq = total - take + 1;
      const seqRange = `${startSeq}:${total}`;

      const msgs = [];
      for await (let msg of client.fetch(seqRange, {
        envelope: true,
        flags: true,
        uid: true,
        internalDate: true,
      })) {
        const env = msg.envelope || {};
        const from = addrToString(env.from);
        const to = addrToString(env.to);
        const subject = (env.subject || '').toString();
        const date = (msg.internalDate ? new Date(msg.internalDate) : new Date()).toISOString();

        let isRead = false;
        const f = msg.flags;
        if (f instanceof Set) isRead = f.has('\\Seen') || f.has('Seen');
        else if (Array.isArray(f)) isRead = f.includes('\\Seen') || f.includes('Seen');

        msgs.push({
          id: `imap:${msg.uid}`,
          provider: 'imap',
          from,
          to,
          subject,
          date,
          isRead,
          preview: '',
        });
      }

      msgs.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      return msgs;
    });
  }

  async function imapMessage(uid, id) {
    const cfg = resolveImapConfig(uid);
    if (!cfg.host || !cfg.user || !cfg.pass) {
      const err = new Error('IMAP not configured');
      err.statusCode = 400;
      throw err;
    }

    const uidNum = Number(String(id).replace(/^imap:/, ''));
    return withImap(cfg, async (client) => {
      await client.mailboxOpen(cfg.mailbox || 'INBOX');
      const {content} = await client.download(uidNum, null, {uid: true});
      const chunks = [];
      for await (const chunk of content) chunks.push(chunk);
      const raw = Buffer.concat(chunks);

      const mail = await simpleParser(raw);
      const from = mail.from?.text || '';
      const to = mail.to?.text || '';
      const subject = mail.subject || '';
      const date = (mail.date ? new Date(mail.date) : new Date()).toISOString();

      const bodyHtml = mail.html ? (typeof mail.html === 'string' ? mail.html : '') : null;
      const bodyText = mail.text || null;

      return {
        id: `imap:${uidNum}`,
        provider: 'imap',
        from,
        to,
        subject,
        date,
        bodyHtml,
        bodyText,
      };
    });
  }

  async function imapMarkSeen(uid, id) {
    const cfg = resolveImapConfig(uid);
    if (!cfg.host || !cfg.user || !cfg.pass) {
      const err = new Error('IMAP not configured');
      err.statusCode = 400;
      throw err;
    }

    const uidNum = Number(String(id).replace(/^imap:/, ''));
    return withImap(cfg, async (client) => {
      await client.mailboxOpen(cfg.mailbox || 'INBOX');
      await client.messageFlagsAdd({uid: uidNum}, ['\\Seen'], {uid: true});
      return {ok: true};
    });
  }

  return {imapList, imapMessage, imapMarkSeen};
}

/* ----------------------------- handlers --------------------------- */

function createInboxListHandler({dbPath /*, imapConfig */}) {
  const core = createInboxCore({dbPath});

  return async function inboxListHandler(req, res) {
    try {
      const uid = req.user?.uid;
      if (!uid) return res.status(401).json({error: 'unauthenticated'});

      const limit = Math.min(parseInt(String(req.query.limit || '50'), 10) || 50, 200);
      let list = await core.imapList(uid, limit);

      // Filtrowanie
      const q = String(req.query.q || '').trim().toLowerCase();
      const fromF = String(req.query.from || '').trim().toLowerCase();
      const toF = String(req.query.to || '').trim().toLowerCase();
      const subjF = String(req.query.subject || '').trim().toLowerCase();
      const unreadParam = String(req.query.unread || '').trim().toLowerCase();
      const unreadOnly = unreadParam === '1' || unreadParam === 'true' || unreadParam === 'yes';

      const dfRaw = String(req.query.dateFrom || '').trim();
      const dtRaw = String(req.query.dateTo || '').trim();
      const dateFrom = dfRaw ? new Date(dfRaw) : null;
      const dateTo = dtRaw ? new Date(dtRaw) : null;
      if (dateTo) dateTo.setHours(23, 59, 59, 999);

      const norm = (s) => String(s || '').toLowerCase();

      let filtered = list;

      if (q) {
        filtered = filtered.filter((m) => {
          const bucket = `${m.from} ${m.to} ${m.subject} ${m.preview || ''}`.toLowerCase();
          return bucket.includes(q);
        });
      }
      if (fromF) filtered = filtered.filter((m) => norm(m.from).includes(fromF));
      if (toF) filtered = filtered.filter((m) => norm(m.to).includes(toF));
      if (subjF) filtered = filtered.filter((m) => norm(m.subject).includes(subjF));
      if (dateFrom) filtered = filtered.filter((m) => new Date(m.date) >= dateFrom);
      if (dateTo) filtered = filtered.filter((m) => new Date(m.date) <= dateTo);
      if (unreadOnly) filtered = filtered.filter((m) => !m.isRead);

      filtered.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

      res.json({items: filtered});
    } catch (e) {
      console.error('❌ /inbox/messages error', e);
      res.status(500).json({error: 'internal'});
    }
  };
}

function createInboxGetMessageHandler({dbPath /*, imapConfig */}) {
  const core = createInboxCore({dbPath});

  return async function inboxGetMessageHandler(req, res) {
    try {
      const uid = req.user?.uid;
      if (!uid) return res.status(401).json({error: 'unauthenticated'});
      const id = String(req.params.id);

      const data = await core.imapMessage(uid, id);
      res.json(data);
    } catch (e) {
      const sc = e && e.statusCode ? e.statusCode : 500;
      console.error('❌ /inbox/message error', e);
      res.status(sc).json({error: sc === 400 ? 'IMAP not configured' : 'internal'});
    }
  };
}

function createInboxMarkReadHandler({dbPath /*, imapConfig */}) {
  const core = createInboxCore({dbPath});

  return async function inboxMarkReadHandler(req, res) {
    try {
      const uid = req.user?.uid;
      if (!uid) return res.status(401).json({error: 'unauthenticated'});

      const id = String(req.body?.id || '');
      if (!id) return res.status(400).json({error: 'id required'});

      await core.imapMarkSeen(uid, id);
      res.json({ok: true});
    } catch (e) {
      const sc = e && e.statusCode ? e.statusCode : 500;
      console.error('❌ /inbox/markRead error', e);
      res.status(sc).json({error: sc === 400 ? 'IMAP not configured' : 'internal'});
    }
  };
}

function inboxHandlers({dbPath, imapConfig}) {
  return {
    list: createInboxListHandler({dbPath, imapConfig}),
    getMessage: createInboxGetMessageHandler({dbPath, imapConfig}),
    markRead: createInboxMarkReadHandler({dbPath, imapConfig}),
  };
}

module.exports = {
  createInboxListHandler,
  createInboxGetMessageHandler,
  createInboxMarkReadHandler,
  inboxHandlers,
};
