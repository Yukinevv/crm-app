const express = require('express');
const jsonServer = require('json-server');
const {ImapFlow} = require('imapflow');

function createInboxRouter({dbPath, imapConfig}) {
  const r = express.Router();
  const routerDb = jsonServer.router(dbPath);

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

  const isEmu = !!process.env.FUNCTIONS_EMULATOR;

  // ===== Helpers (MailHog) =====
  async function mhList(limit = 50) {
    const url = 'http://localhost:8025/api/v2/messages';
    const resp = await fetch(url);
    if (!resp.ok) {
      const text = await resp.text().catch(() => '');
      throw new Error(`MailHog list error: ${resp.status} ${resp.statusText} ${text}`);
    }
    const data = await resp.json(); // { total, count, start, items: [...] }
    const items = (data.items || []).slice(0, limit);
    return items.map(it => {
      const id = String(it.ID);
      const from = (it.Content?.Headers?.From && it.Content.Headers.From[0]) || '';
      const to = (it.Content?.Headers?.To && it.Content.Headers.To[0]) || '';
      const subject = (it.Content?.Headers?.Subject && it.Content.Headers.Subject[0]) || '';
      const dateStr = (it.Content?.Headers?.Date && it.Content.Headers.Date[0]) || it.Created;
      const date = new Date(dateStr).toISOString();

      // snippet (plain)
      const plain = it.Content?.Body || '';
      const preview = plain.length > 240 ? plain.slice(0, 240) + '…' : plain;

      return {
        id: `mh:${id}`,
        provider: 'mailhog',
        from,
        to,
        subject,
        date,
        isRead: false, // bedzie nadpisywane ze storage
        preview
      };
    });
  }

  async function mhMessage(id) {
    // id przychodzi w formie "mh:<mailhogId>"
    const rawId = String(id).replace(/^mh:/, '');

    const url = `http://localhost:8025/api/v1/messages/${encodeURIComponent(rawId)}`;
    const resp = await fetch(url);
    if (!resp.ok) {
      const text = await resp.text().catch(() => '');
      throw new Error(`MailHog get message error: ${resp.status} ${resp.statusText} ${text}`);
    }
    const it = await resp.json();

    const from = (it.Content?.Headers?.From && it.Content.Headers.From[0]) || '';
    const to = (it.Content?.Headers?.To && it.Content.Headers.To[0]) || '';
    const subject = (it.Content?.Headers?.Subject && it.Content.Headers.Subject[0]) || '';
    const dateStr = (it.Content?.Headers?.Date && it.Content.Headers.Date[0]) || it.Created;
    const date = new Date(dateStr).toISOString();

    // Ekstrakcja treści:
    // Preferuj text/html, potem text/plain, a na końcu Content.Body
    let bodyHtml = null;
    let bodyText = null;

    if (it.MIME && Array.isArray(it.MIME.Parts)) {
      const htmlPart = it.MIME.Parts.find(p =>
        /text\/html/i.test(p?.MIME?.PartType) && typeof p?.MIME?.Body === 'string'
      );
      const textPart = it.MIME.Parts.find(p =>
        /text\/plain/i.test(p?.MIME?.PartType) && typeof p?.MIME?.Body === 'string'
      );
      if (htmlPart) bodyHtml = htmlPart.MIME.Body;
      if (!bodyHtml && textPart) bodyText = textPart.MIME.Body;
    }

    if (!bodyHtml && !bodyText) {
      const fallback = it.Content?.Body || '';
      if (/<\/?[a-z][\s\S]*>/i.test(fallback)) bodyHtml = fallback;
      else bodyText = fallback;
    }

    return {
      id: `mh:${it.ID}`,
      provider: 'mailhog',
      from, to, subject, date,
      bodyHtml,
      bodyText
    };
  }

  // ===== Helpers (IMAP) =====
  async function withImap(fn) {
    const client = new ImapFlow({
      host: imapConfig.host,
      port: Number(imapConfig.port) || 993,
      secure: String(imapConfig.secure ?? 'true') === 'true',
      auth: {user: imapConfig.user, pass: imapConfig.pass}
    });
    try {
      await client.connect();
      await client.mailboxOpen('INBOX');
      return await fn(client);
    } finally {
      try {
        await client.logout();
      } catch {
      }
    }
  }

  async function imapList(limit = 50) {
    return withImap(async (client) => {
      const lock = await client.getMailboxLock('INBOX');
      try {
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
          internalDate: true
        })) {
          const env = msg.envelope || {};
          const from = (env.from && env.from.length)
            ? `${env.from[0].name || env.from[0].address || ''} <${env.from[0].address || ''}>`
            : '';
          const to = (env.to && env.to.length) ? (env.to[0].address || '') : '';
          const subject = env.subject || '';
          const date = (msg.internalDate ? new Date(msg.internalDate) : new Date()).toISOString();
          const isRead = (msg.flags || []).includes('\\Seen');

          msgs.push({
            id: `imap:${msg.uid}`,
            provider: 'imap',
            from, to, subject, date, isRead,
            preview: ''
          });
        }
        // Sortowanie malejąco po dacie
        msgs.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        return msgs;
      } finally {
        lock.release();
      }
    });
  }

  async function imapMessage(id) {
    const uid = Number(String(id).replace(/^imap:/, ''));
    return withImap(async (client) => {
      const {content} = await client.download(uid, null, {uid: true});
      let chunks = [];
      for await (const chunk of content) {
        chunks.push(chunk);
      }
      const raw = Buffer.concat(chunks).toString('utf8');
      const isHtml = /<html[\s\S]*<\/html>/i.test(raw);
      return {
        id: `imap:${uid}`,
        provider: 'imap',
        from: '', to: '', subject: '', date: new Date().toISOString(),
        bodyHtml: isHtml ? raw : null,
        bodyText: isHtml ? null : raw
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

  // ===== Read-state storage (dla MailHog, bo nie ma flag) =====
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

  // ====== ROUTES ======

  // GET /inbox/messages?limit=50&q=&from=&to=&subject=&dateFrom=YYYY-MM-DD&dateTo=YYYY-MM-DD&unread=1
  r.get('/inbox/messages', async (req, res) => {
    try {
      const limit = Math.min(parseInt(String(req.query.limit || '50'), 10) || 50, 200);

      // Pobierz surową listę (MailHog/IMAP)
      let list = [];
      if (isEmu) list = await mhList(limit);
      else list = await imapList(limit);

      // Zastosuj read-map (tylko MailHog)
      if (isEmu) {
        const rm = getReadMap();
        list = list.map(m => ({...m, isRead: !!rm[m.id]}));
      }

      // ===== Filtrowanie =====
      const q = String(req.query.q || '').trim().toLowerCase();
      const fromF = String(req.query.from || '').trim().toLowerCase();
      const toF = String(req.query.to || '').trim().toLowerCase();
      const subjF = String(req.query.subject || '').trim().toLowerCase();
      const unreadParam = String(req.query.unread || '').trim().toLowerCase();
      const unreadOnly = unreadParam === '1' || unreadParam === 'true' || unreadParam === 'yes';

      const dfRaw = String(req.query.dateFrom || '').trim();
      const dtRaw = String(req.query.dateTo || '').trim();
      const dateFrom = dfRaw ? new Date(dfRaw) : null; // akceptujemy YYYY-MM-DD
      const dateTo = dtRaw ? new Date(dtRaw) : null;
      if (dateTo) dateTo.setHours(23, 59, 59, 999);

      const norm = (s) => String(s || '').toLowerCase();

      let filtered = list;

      if (q) {
        filtered = filtered.filter(m => {
          const bucket = `${m.from} ${m.to} ${m.subject} ${m.preview || ''}`.toLowerCase();
          return bucket.includes(q);
        });
      }
      if (fromF) {
        filtered = filtered.filter(m => norm(m.from).includes(fromF));
      }
      if (toF) {
        filtered = filtered.filter(m => norm(m.to).includes(toF));
      }
      if (subjF) {
        filtered = filtered.filter(m => norm(m.subject).includes(subjF));
      }
      if (dateFrom) {
        filtered = filtered.filter(m => new Date(m.date) >= dateFrom);
      }
      if (dateTo) {
        filtered = filtered.filter(m => new Date(m.date) <= dateTo);
      }
      if (unreadOnly) {
        filtered = filtered.filter(m => !m.isRead);
      }

      // sort desc by date
      filtered.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

      res.json({items: filtered});
    } catch (e) {
      console.error('❌ /inbox/messages error', e);
      res.status(500).json({error: 'internal'});
    }
  });

  // GET /inbox/message/:id
  r.get('/inbox/message/:id', async (req, res) => {
    try {
      const id = String(req.params.id); // Express już zdekodował %xx
      const data = isEmu ? await mhMessage(id) : await imapMessage(id);
      res.json(data);
    } catch (e) {
      console.error('/inbox/message error', e);
      res.status(500).json({error: 'internal'});
    }
  });

  // POST /inbox/markRead { id }
  r.post('/inbox/markRead', async (req, res) => {
    try {
      const id = String(req.body?.id || '');
      if (!id) return res.status(400).json({error: 'id required'});

      if (isEmu) {
        setRead(id, true);
        return res.json({ok: true});
      }
      await imapMarkSeen(id);
      res.json({ok: true});
    } catch (e) {
      console.error('❌ /inbox/markRead error', e);
      res.status(500).json({error: 'internal'});
    }
  });

  return r;
}

module.exports = {createInboxRouter};
