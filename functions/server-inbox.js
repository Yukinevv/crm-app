'use strict';

const jsonServer = require('json-server');
const {ImapFlow} = require('imapflow');
const {simpleParser} = require('mailparser');
const iconv = require('iconv-lite');

function createContext(dbPath, imapConfig) {
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

  // ---------- Helpers: nagłówki / content-type / dekodowanie ----------

  function firstHeader(headers, name) {
    if (!headers) return null;
    const key = Object.keys(headers).find(
      (k) => k.toLowerCase() === name.toLowerCase()
    );
    if (!key) return null;
    const v = headers[key];
    return Array.isArray(v) ? v[0] : v;
  }

  function parseContentType(ct) {
    // "text/plain; charset=UTF-8"
    const res = {mime: null, charset: 'utf-8'};
    if (!ct) return res;
    const [mime, ...rest] = String(ct)
      .split(';')
      .map((s) => s.trim());
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
    // Heurystyka: jeśli wygląda jak QP z miękkim łamaniem/sekcjami =XX
    if (/=[0-9a-f]{2}/i.test(body) || /=\r?\n/.test(body))
      return 'quoted-printable';
    return '7bit';
  }

  function decodeQPToBuffer(str) {
    // RFC2045: usuń miękkie łamania (=\r\n / =\n) i zamień =XX -> bajt
    const s = String(str).replace(/\r\n/g, '\n');
    const out = [];
    for (let i = 0; i < s.length; i++) {
      const ch = s[i];
      if (ch === '=') {
        // miękkie złamanie
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
        // nieprawidłowa sekwencja - traktujemy '=' literalnie
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
      // niektóre serwery dzielą Base64 na linie
      const clean = String(body).replace(/\s+/g, '');
      try {
        buf = Buffer.from(clean, 'base64');
      } catch {
        buf = Buffer.from('');
      }
    } else if (cte === 'quoted-printable') {
      buf = decodeQPToBuffer(body);
    } else {
      // 7bit/8bit/binary - traktujemy jako już-ok bajty
      buf = Buffer.from(String(body), 'binary');
    }
    try {
      // iconv poradzi sobie z iso-8859-2, windows-1250 itp.
      return iconv.decode(buf, charset || 'utf-8');
    } catch {
      return buf.toString('utf-8');
    }
  }

  function chooseBestBody(parts) {
    // preferuj text/html, fallback text/plain
    const html = parts.find((p) => p.mime?.startsWith('text/html') && p.body);
    if (html) return {bodyHtml: html.body, bodyText: null};
    const text = parts.find((p) => p.mime?.startsWith('text/plain') && p.body);
    if (text) return {bodyHtml: null, bodyText: text.body};
    // fallback cokolwiek
    if (parts[0]?.body) return {bodyHtml: null, bodyText: parts[0].body};
    return {bodyHtml: null, bodyText: null};
  }

  // ---------- MailHog: LISTA ----------

  async function mhList(limit = 50) {
    const url = 'http://localhost:8025/api/v2/messages';
    const resp = await fetch(url);
    if (!resp.ok) {
      const text = await resp.text().catch(() => '');
      throw new Error(
        `MailHog list error: ${resp.status} ${resp.statusText} ${text}`
      );
    }
    const data = await resp.json(); // { total, count, start, items: [...] }
    const items = (data.items || []).slice(0, limit);

    const list = items.map((it) => {
      const id = String(it.ID);
      const from = firstHeader(it.Content?.Headers, 'From') || '';
      const to = firstHeader(it.Content?.Headers, 'To') || '';
      const subject = firstHeader(it.Content?.Headers, 'Subject') || '';
      const dateStr = firstHeader(it.Content?.Headers, 'Date') || it.Created;
      const date = new Date(dateStr).toISOString();

      // Podgląd - najlepiej z części text/plain lub z Content.Body, po dekodowaniu
      let preview = '';
      const cte =
        firstHeader(it.Content?.Headers, 'Content-Transfer-Encoding') || '';
      const ct =
        firstHeader(it.Content?.Headers, 'Content-Type') ||
        'text/plain; charset=utf-8';

      // Gdy MIME istnieje, spróbuj wziąć text/plain z Parts
      if (it.MIME && Array.isArray(it.MIME.Parts) && it.MIME.Parts.length) {
        const p =
          it.MIME.Parts.find(
            (p) =>
              /text\/plain/i.test(p?.MIME?.PartType || '') ||
              /text\/plain/i.test(
                firstHeader(p?.MIME?.Headers, 'Content-Type') || ''
              )
          ) || it.MIME.Parts[0];

        const pCT =
          firstHeader(p?.MIME?.Headers, 'Content-Type') ||
          p?.MIME?.PartType ||
          'text/plain; charset=utf-8';
        const pCTE =
          firstHeader(p?.MIME?.Headers, 'Content-Transfer-Encoding') || '';
        const raw = p?.MIME?.Body || '';
        preview = decodeBest(raw, pCTE, pCT);
      } else {
        const previewSrc = it.Content?.Body || '';
        preview = decodeBest(previewSrc, cte, ct);
      }

      if (preview.length > 240) preview = preview.slice(0, 240) + '…';

      return {
        id: `mh:${id}`,
        provider: 'mailhog',
        from,
        to,
        subject,
        date,
        isRead: false, // zostanie nadpisane ze storage
        preview,
      };
    });

    return list;
  }

  // ---------- MailHog: JEDNA WIADOMOŚĆ ----------

  async function mhMessage(id) {
    const rawId = String(id).replace(/^mh:/, '');
    // API v1 - szczegóły
    const url = `http://localhost:8025/api/v1/messages/${encodeURIComponent(
      rawId
    )}`;
    const resp = await fetch(url);
    if (!resp.ok) {
      const text = await resp.text().catch(() => '');
      throw new Error(
        `MailHog get message error: ${resp.status} ${resp.statusText} ${text}`
      );
    }
    const it = await resp.json();

    const from = firstHeader(it.Content?.Headers, 'From') || '';
    const to = firstHeader(it.Content?.Headers, 'To') || '';
    const subject = firstHeader(it.Content?.Headers, 'Subject') || '';
    const dateStr = firstHeader(it.Content?.Headers, 'Date') || it.Created;
    const date = new Date(dateStr).toISOString();

    // Zbierz możliwe części (text/plain, text/html) i zdekoduj
    const decodedParts = [];

    if (it.MIME && Array.isArray(it.MIME.Parts)) {
      for (const p of it.MIME.Parts) {
        const pCT =
          firstHeader(p?.MIME?.Headers, 'Content-Type') ||
          p?.MIME?.PartType ||
          '';
        const pCTE =
          firstHeader(p?.MIME?.Headers, 'Content-Transfer-Encoding') || '';
        const raw = p?.MIME?.Body || '';
        const decoded = decodeBest(raw, pCTE, pCT);
        const {mime} = parseContentType(pCT || 'text/plain; charset=utf-8');
        decodedParts.push({mime: mime || 'text/plain', body: decoded});
      }
    }

    // Fallback: Content.Body
    if (!decodedParts.length && it.Content?.Body) {
      const cte =
        firstHeader(it.Content?.Headers, 'Content-Transfer-Encoding') || '';
      const ct =
        firstHeader(it.Content?.Headers, 'Content-Type') ||
        'text/plain; charset=utf-8';
      const decoded = decodeBest(it.Content.Body, cte, ct);
      const {mime} = parseContentType(ct);
      decodedParts.push({mime: mime || 'text/plain', body: decoded});
    }

    const {bodyHtml, bodyText} = chooseBestBody(decodedParts);

    return {
      id: `mh:${it.ID}`,
      provider: 'mailhog',
      from,
      to,
      subject,
      date,
      bodyHtml,
      bodyText,
    };
  }

  // ---------- IMAP (mailparser) ----------

  async function withImap(fn) {
    const client = new ImapFlow({
      host: imapConfig.host,
      port: Number(imapConfig.port) || 993,
      secure: String(imapConfig.secure ?? 'true') === 'true',
      auth: {user: imapConfig.user, pass: imapConfig.pass},
    });
    try {
      await client.connect();
      await client.mailboxOpen('INBOX');
      return await fn(client);
    } finally {
      try {
        await client.logout();
      } catch {
        // ignore
      }
    }
  }

  async function imapList(limit = 50) {
    return withImap(async (client) => {
      const status = await client.status('INBOX', {messages: true});
      const total = status.messages || 0;
      const startSeq = total > limit ? total - limit + 1 : 1;
      const seqRange = `${startSeq}:${total}`;

      const msgs = [];
      for await (let msg of client.fetch(seqRange, {
        envelope: true,
        flags: true,
        source: false,
        bodyStructure: false,
        uid: true,
        internalDate: true,
      })) {
        const env = msg.envelope || {};
        const from =
          env.from && env.from.length
            ? `${env.from[0].name || env.from[0].address || ''} <${
              env.from[0].address || ''
            }>`
            : '';
        const to = env.to && env.to.length ? env.to[0].address || '' : '';
        const subject = env.subject || '';
        const date = (msg.internalDate ? new Date(msg.internalDate) : new Date()).toISOString();
        const isRead = (msg.flags || []).includes('\\Seen');

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
      msgs.sort(
        (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
      );
      return msgs;
    });
  }

  async function imapMessage(id) {
    const uid = Number(String(id).replace(/^imap:/, ''));
    return withImap(async (client) => {
      const {content} = await client.download(uid, null, {uid: true});
      const chunks = [];
      for await (const chunk of content) chunks.push(chunk);
      const raw = Buffer.concat(chunks);

      // mailparser załatwia poprawne dekodowanie treści + charsetów
      const mail = await simpleParser(raw);

      const from = mail.from?.text || '';
      const to = mail.to?.text || '';
      const subject = mail.subject || '';
      const date = (mail.date ? new Date(mail.date) : new Date()).toISOString();

      // Preferuj HTML, potem TEXT
      const bodyHtml =
        mail.html ? (typeof mail.html === 'string' ? mail.html : '') : null;
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
    const uid = Number(String(id).replace(/^imap:/, ''));
    return withImap(async (client) => {
      await client.messageFlagsAdd({uid}, ['\\Seen'], {uid: true});
      return {ok: true};
    });
  }

  // ---------- Read-state storage dla MailHog ----------

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

/**
 * Handler: GET /inbox/messages
 */
function createInboxListHandler({dbPath, imapConfig}) {
  const ctx = createContext(dbPath, imapConfig);

  return async function inboxListHandler(req, res) {
    try {
      const limit = Math.min(
        parseInt(String(req.query.limit || '50'), 10) || 50,
        200
      );

      let list = [];
      if (ctx.isEmu) list = await ctx.mhList(limit);
      else list = await ctx.imapList(limit);

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
      const unreadOnly =
        unreadParam === '1' || unreadParam === 'true' || unreadParam === 'yes';

      const dfRaw = String(req.query.dateFrom || '').trim();
      const dtRaw = String(req.query.dateTo || '').trim();
      const dateFrom = dfRaw ? new Date(dfRaw) : null;
      const dateTo = dtRaw ? new Date(dtRaw) : null;
      if (dateTo) dateTo.setHours(23, 59, 59, 999);

      const norm = (s) => String(s || '').toLowerCase();

      let filtered = list;

      if (q) {
        filtered = filtered.filter((m) => {
          const bucket = `${m.from} ${m.to} ${m.subject} ${
            m.preview || ''
          }`.toLowerCase();
          return bucket.includes(q);
        });
      }
      if (fromF) filtered = filtered.filter((m) => norm(m.from).includes(fromF));
      if (toF) filtered = filtered.filter((m) => norm(m.to).includes(toF));
      if (subjF) filtered = filtered.filter((m) =>
        norm(m.subject).includes(subjF)
      );
      if (dateFrom) filtered = filtered.filter((m) => new Date(m.date) >= dateFrom);
      if (dateTo) filtered = filtered.filter((m) => new Date(m.date) <= dateTo);
      if (unreadOnly) filtered = filtered.filter((m) => !m.isRead);

      filtered.sort(
        (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
      );

      res.json({items: filtered});
    } catch (e) {
      console.error('❌ /inbox/messages error', e);
      res.status(500).json({error: 'internal'});
    }
  };
}

/**
 * Handler: GET /inbox/message/:id
 */
function createInboxGetMessageHandler({dbPath, imapConfig}) {
  const ctx = createContext(dbPath, imapConfig);

  return async function inboxGetMessageHandler(req, res) {
    try {
      const id = String(req.params.id);
      const data = ctx.isEmu ? await ctx.mhMessage(id) : await ctx.imapMessage(id);
      res.json(data);
    } catch (e) {
      console.error('❌ /inbox/message error', e);
      res.status(500).json({error: 'internal'});
    }
  };
}

/**
 * Handler: POST /inbox/markRead  { id }
 */
function createInboxMarkReadHandler({dbPath, imapConfig}) {
  const ctx = createContext(dbPath, imapConfig);

  return async function inboxMarkReadHandler(req, res) {
    try {
      const id = String(req.body?.id || '');
      if (!id) return res.status(400).json({error: 'id required'});

      if (ctx.isEmu) {
        ctx.setRead(id, true);
        return res.json({ok: true});
      }
      await ctx.imapMarkSeen(id);
      res.json({ok: true});
    } catch (e) {
      console.error('❌ /inbox/markRead error', e);
      res.status(500).json({error: 'internal'});
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
