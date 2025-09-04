'use strict';

const jsonServer = require('json-server');
const {ImapFlow} = require('imapflow');
const {simpleParser} = require('mailparser');
const iconv = require('iconv-lite');

/* ----------------------------- utils ------------------------------ */

function toBool(v) {
  if (typeof v === 'boolean') return v;
  const s = String(v ?? '').trim().toLowerCase();
  return s === 'true' || s === '1' || s === 'yes';
}

function toNum(v, def) {
  const n = Number(v);
  return Number.isFinite(n) ? n : def;
}

/* ------------------------ ctx + helpers --------------------------- */

function createContext(dbPath, imapConfigRef) {
  const routerDb = jsonServer.router(dbPath);
  const isEmu = !!process.env.FUNCTIONS_EMULATOR;

  function ensureCollection(name) {
    if (!routerDb.db.has(name).value()) {
      routerDb.db.set(name, []).write();
    }
  }

  function ensureMap(name) {
    if (!routerDb.db.has(name).value()) {
      routerDb.db.set(name, {}).write();
    }
  }

  function firstHeader(headers, name) {
    if (!headers) return null;
    const key = Object.keys(headers).find((k) => k.toLowerCase() === name.toLowerCase());
    if (!key) return null;
    const v = headers[key];
    return Array.isArray(v) ? v[0] : v;
  }

  function parseContentType(ct) {
    const res = {mime: null, charset: 'utf-8'};
    if (!ct) return res;
    const [mime, ...rest] = String(ct).split(';').map((s) => s.trim());
    res.mime = mime?.toLowerCase() || null;
    const cs = rest.find((p) => /^charset=/i.test(p));
    if (cs) {
      const val = cs.split('=')[1]?.trim()?.replace(/^"|"$/g, '');
      if (val) res.charset = val.toLowerCase();
    }
    return res;
  }

  function detectCTE(rawCte, body) {
    const cte = (rawCte || '').toString().trim().toLowerCase();
    if (cte) return cte;
    if (/=[0-9a-f]{2}/i.test(body) || /=\r?\n/.test(body)) return 'quoted-printable';
    return '7bit';
  }

  function decodeQPToBuffer(str) {
    const s = String(str).replace(/\r\n/g, '\n');
    const out = [];
    for (let i = 0; i < s.length; i++) {
      const ch = s[i];
      if (ch === '=') {
        if (s[i + 1] === '\n') {
          i += 1;
          continue;
        }
        if (s[i + 1] === '\r' && s[i + 2] === '\n') {
          i += 2;
          continue;
        }
        const hex = s.substr(i + 1, 2);
        if (/^[0-9A-Fa-f]{2}$/.test(hex)) {
          out.push(parseInt(hex, 16));
          i += 2;
          continue;
        }
        out.push('='.charCodeAt(0));
      } else {
        out.push(ch.charCodeAt(0));
      }
    }
    return Buffer.from(Uint8Array.from(out));
  }

  function decodeBest(body, rawCte, rawCt) {
    const cte = detectCTE(rawCte, body);
    const {charset} = parseContentType(rawCt);
    let buf;
    if (cte === 'base64') {
      const clean = String(body).replace(/\s+/g, '');
      try {
        buf = Buffer.from(clean, 'base64');
      } catch {
        buf = Buffer.from('');
      }
    } else if (cte === 'quoted-printable') {
      buf = decodeQPToBuffer(body);
    } else {
      buf = Buffer.from(String(body), 'binary');
    }
    try {
      return iconv.decode(buf, charset || 'utf-8');
    } catch {
      return buf.toString('utf-8');
    }
  }

  function chooseBestBody(parts) {
    const html = parts.find((p) => p.mime?.startsWith('text/html') && p.body);
    if (html) return {bodyHtml: html.body, bodyText: null};
    const text = parts.find((p) => p.mime?.startsWith('text/plain') && p.body);
    if (text) return {bodyHtml: null, bodyText: text.body};
    if (parts[0]?.body) return {bodyHtml: null, bodyText: parts[0].body};
    return {bodyHtml: null, bodyText: null};
  }

  function addrToString(list) {
    if (!list || !list.length) return '';
    const a = list[0];
    const name = a.name ? `${a.name}` : '';
    const email = a.address ? `${a.address}` : '';
    return name ? `${name} <${email}>` : email;
  }

  /* ---------- MailHog (opcjonalnie przy emulatorze) ---------- */

  async function mhList(limit = 50) {
    const url = 'http://localhost:8025/api/v2/messages';
    const resp = await fetch(url);
    if (!resp.ok) {
      const text = await resp.text().catch(() => '');
      throw new Error(`MailHog list error: ${resp.status} ${resp.statusText} ${text}`);
    }
    const data = await resp.json();
    const items = (data.items || []).slice(0, limit);

    const list = items.map((it) => {
      const id = String(it.ID);
      const from = firstHeader(it.Content?.Headers, 'From') || '';
      const to = firstHeader(it.Content?.Headers, 'To') || '';
      const subject = firstHeader(it.Content?.Headers, 'Subject') || '';
      const dateStr = firstHeader(it.Content?.Headers, 'Date') || it.Created;
      const date = new Date(dateStr).toISOString();

      let preview = '';
      const cte = firstHeader(it.Content?.Headers, 'Content-Transfer-Encoding') || '';
      const ct = firstHeader(it.Content?.Headers, 'Content-Type') || 'text/plain; charset=utf-8';

      if (it.MIME && Array.isArray(it.MIME.Parts) && it.MIME.Parts.length) {
        const p = it.MIME.Parts.find(
          (p) =>
            /text\/plain/i.test(p?.MIME?.PartType || '') ||
            /text\/plain/i.test(firstHeader(p?.MIME?.Headers, 'Content-Type') || '')
        ) || it.MIME.Parts[0];

        const pCT = firstHeader(p?.MIME?.Headers, 'Content-Type') || p?.MIME?.PartType || 'text/plain; charset=utf-8';
        const pCTE = firstHeader(p?.MIME?.Headers, 'Content-Transfer-Encoding') || '';
        const raw = p?.MIME?.Body || '';
        preview = decodeBest(raw, pCTE, pCT);
      } else {
        const previewSrc = it.Content?.Body || '';
        preview = decodeBest(previewSrc, cte, ct);
      }

      if (preview.length > 240) preview = preview.slice(0, 240) + '…';

      return {id: `mh:${id}`, provider: 'mailhog', from, to, subject, date, isRead: false, preview};
    });

    return list;
  }

  async function mhMessage(id) {
    const rawId = String(id).replace(/^mh:/, '');
    const url = `http://localhost:8025/api/v1/messages/${encodeURIComponent(rawId)}`;
    const resp = await fetch(url);
    if (!resp.ok) {
      const text = await resp.text().catch(() => '');
      throw new Error(`MailHog get message error: ${resp.status} ${resp.statusText} ${text}`);
    }
    const it = await resp.json();

    const from = firstHeader(it.Content?.Headers, 'From') || '';
    const to = firstHeader(it.Content?.Headers, 'To') || '';
    const subject = firstHeader(it.Content?.Headers, 'Subject') || '';
    const dateStr = firstHeader(it.Content?.Headers, 'Date') || it.Created;
    const date = new Date(dateStr).toISOString();

    const decodedParts = [];
    if (it.MIME && Array.isArray(it.MIME.Parts)) {
      for (const p of it.MIME.Parts) {
        const pCT = firstHeader(p?.MIME?.Headers, 'Content-Type') || p?.MIME?.PartType || '';
        const pCTE = firstHeader(p?.MIME?.Headers, 'Content-Transfer-Encoding') || '';
        const raw = p?.MIME?.Body || '';
        const decoded = decodeBest(raw, pCTE, pCT);
        const {mime} = parseContentType(pCT || 'text/plain; charset=utf-8');
        decodedParts.push({mime: mime || 'text/plain', body: decoded});
      }
    }
    if (!decodedParts.length && it.Content?.Body) {
      const cte = firstHeader(it.Content?.Headers, 'Content-Transfer-Encoding') || '';
      const ct = firstHeader(it.Content?.Headers, 'Content-Type') || 'text/plain; charset=utf-8';
      const decoded = decodeBest(it.Content.Body, cte, ct);
      const {mime} = parseContentType(ct);
      decodedParts.push({mime: mime || 'text/plain', body: decoded});
    }

    const {bodyHtml, bodyText} = chooseBestBody(decodedParts);
    return {id: `mh:${it.ID}`, provider: 'mailhog', from, to, subject, date, bodyHtml, bodyText};
  }

  /* --------------- IMAP konfiguracja ---------------- */

  function resolveImapConfig() {
    ensureMap('imapConfig');
    const stored = routerDb.db.get('imapConfig').value() || {};
    const state = imapConfigRef || {};

    // Priorytet: najpierw wartości ZAPISANE (stored), dopiero potem stan (state).
    const host = String((stored.host || state.host || '')).trim();
    const user = String((stored.user || state.user || '')).trim();
    const pass = String((stored.pass || state.pass || '')).trim();
    const mailbox = String((stored.mailbox || 'INBOX')).trim();

    const port = toNum(
      (stored.port != null ? stored.port : (state.port != null ? state.port : 993)),
      993
    );
    const secure = toBool(
      (stored.secure != null ? stored.secure : (state.secure != null ? state.secure : true))
    );

    return {host, user, pass, mailbox, port, secure};
  }

  async function withImap(effectiveCfg, fn) {
    const client = new ImapFlow({
      host: effectiveCfg.host,
      port: effectiveCfg.port,
      secure: effectiveCfg.secure,
      auth: {user: effectiveCfg.user, pass: effectiveCfg.pass},
      // logger: true, // do debugowania
    });
    try {
      await client.connect();
      return await fn(client, effectiveCfg);
    } finally {
      try {
        await client.logout();
      } catch { /* ignore */
      }
    }
  }

  async function imapList(limit = 50) {
    const cfg = resolveImapConfig();
    if (!cfg.host || !cfg.user || !cfg.pass) {
      // Brak pełnej konfiguracji - nie łączymy się
      return [];
    }

    return withImap(cfg, async (client) => {
      await client.mailboxOpen(cfg.mailbox || 'INBOX');

      // użyjemy bieżącego stanu skrzynki po otwarciu
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

  async function imapMessage(id) {
    const cfg = resolveImapConfig();
    if (!cfg.host || !cfg.user || !cfg.pass) {
      const err = new Error('IMAP not configured');
      err.statusCode = 400;
      throw err;
    }

    const uid = Number(String(id).replace(/^imap:/, ''));
    return withImap(cfg, async (client) => {
      await client.mailboxOpen(cfg.mailbox || 'INBOX');
      const {content} = await client.download(uid, null, {uid: true});
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
        id: `imap:${uid}`,
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

  async function imapMarkSeen(id) {
    const cfg = resolveImapConfig();
    if (!cfg.host || !cfg.user || !cfg.pass) {
      const err = new Error('IMAP not configured');
      err.statusCode = 400;
      throw err;
    }

    const uid = Number(String(id).replace(/^imap:/, ''));
    return withImap(cfg, async (client) => {
      await client.mailboxOpen(cfg.mailbox || 'INBOX');
      // bezpieczniejsza wersja z jawnie wskazanym UID
      await client.messageFlagsAdd({uid}, ['\\Seen'], {uid: true});
      return {ok: true};
    });
  }

  /* ------------------------- read-state (MH) ---------------------- */

  function getReadMap() {
    ensureMap('inboxRead');
    return routerDb.db.get('inboxRead').value() || {};
  }

  function setRead(id, v = true) {
    ensureMap('inboxRead');
    const map = routerDb.db.get('inboxRead').value() || {};
    map[id] = !!v;
    routerDb.db.set('inboxRead', map).write();
  }

  return {
    routerDb,
    isEmu,
    mhList,
    mhMessage,
    imapList,
    imapMessage,
    imapMarkSeen,
    getReadMap,
    setRead,
  };
}

/* ----------------------------- handlers --------------------------- */

function createInboxListHandler({dbPath, imapConfig}) {
  const ctx = createContext(dbPath, imapConfig);

  return async function inboxListHandler(req, res) {
    try {
      const limit = Math.min(parseInt(String(req.query.limit || '50'), 10) || 50, 200);

      let list = [];
      // list = ctx.isEmu ? await ctx.mhList(limit) : await ctx.imapList(limit);
      list = await ctx.imapList(limit);

      // (opcjonalnie) zewnętrzny stan "przeczytane" dla MailHog
      if (ctx.isEmu) {
        const rm = ctx.getReadMap();
        list = list.map((m) => ({...m, isRead: !!rm[m.id]}));
      }

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

function createInboxGetMessageHandler({dbPath, imapConfig}) {
  const ctx = createContext(dbPath, imapConfig);

  return async function inboxGetMessageHandler(req, res) {
    try {
      const id = String(req.params.id);
      const data = await ctx.imapMessage(id);
      res.json(data);
    } catch (e) {
      const sc = e && e.statusCode ? e.statusCode : 500;
      console.error('❌ /inbox/message error', e);
      res.status(sc).json({error: sc === 400 ? 'IMAP not configured' : 'internal'});
    }
  };
}

function createInboxMarkReadHandler({dbPath, imapConfig}) {
  const ctx = createContext(dbPath, imapConfig);

  return async function inboxMarkReadHandler(req, res) {
    try {
      const id = String(req.body?.id || '');
      if (!id) return res.status(400).json({error: 'id required'});

      await ctx.imapMarkSeen(id);
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
