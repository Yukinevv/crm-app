'use strict';

const {onRequest, onCall, HttpsError} = require('firebase-functions/v2/https');
const {defineSecret} = require('firebase-functions/params');
const {setGlobalOptions} = require('firebase-functions/v2');

const admin = require('firebase-admin');
const express = require('express');
const jsonServer = require('json-server');
const nodemailer = require('nodemailer');

const {join} = require('node:path');
const {conversationsHandlers} = require('./server-api');
const {inboxHandlers} = require('./server-inbox');
const {mailHandlers} = require('./server-mail');

const {
  createImapStateFromEnv,
  imapConfigHandlers
} = require('./server-imap-config');

if (process.env.FORCE_PROD_DB === '1') {
  delete process.env.FIRESTORE_EMULATOR_HOST;
}

setGlobalOptions({region: 'us-central1'});

admin.initializeApp();

// === Secrets ===
const SENDGRID_KEY = defineSecret('SENDGRID_KEY');
// Klucz/hasło do szyfrowania IMAP
const IMAP_ENC_KEY = defineSecret('IMAP_ENC_KEY');
const IMAP_ENC_PASSWORD = defineSecret('IMAP_ENC_PASSWORD');

// Transport email zależny od środowiska
async function createMailTransport() {
  if (process.env.FUNCTIONS_EMULATOR) {
    console.log('⚙️ Używam lokalnego MailHog na porcie 1025');
    return nodemailer.createTransport({
      host: 'localhost',
      port: 1025,
      ignoreTLS: true
    });
  }

  const sgKey = process.env.SENDGRID_KEY;
  if (sgKey) {
    console.log('⚙️ Używam SendGrid SMTP (sekret SENDGRID_KEY obecny)');
    return nodemailer.createTransport({
      host: 'smtp.sendgrid.net',
      port: 587,
      auth: {
        user: 'apikey',
        pass: sgKey
      }
    });
  }

  console.log('⚙️ Brak SENDGRID_KEY – tworzę konto Ethereal (test)');
  const testAccount = await nodemailer.createTestAccount();
  console.log('ℹ️ Ethereal user/pass:', testAccount.user, testAccount.pass);
  return nodemailer.createTransport({
    host: 'smtp.ethereal.email',
    port: 587,
    auth: {
      user: testAccount.user,
      pass: testAccount.pass
    }
  });
}

const mailTransportPromise = createMailTransport();
const APP_NAME = 'CRM-APP';

// ========== CALLABLES ==========

exports.getUserByEmail = onCall(async (request) => {
  const data = request.data || {};
  const email = typeof data.email === 'string' ? data.email : data?.data?.email;

  if (!email) {
    throw new HttpsError('invalid-argument', 'Brak adresu email');
  }

  try {
    const user = await admin.auth().getUserByEmail(email);
    return {uid: user.uid, email: user.email};
  } catch {
    throw new HttpsError('not-found', 'Użytkownik nie znaleziony');
  }
});

exports.sendBookingConfirmation = onCall({secrets: [SENDGRID_KEY]}, async (request) => {
  const payload = request.data || {};
  const {email, start, end} = payload;

  if (!email || !start || !end) {
    throw new HttpsError('invalid-argument', 'Brakuje danych do wysłania potwierdzenia');
  }

  const transport = await mailTransportPromise;

  const startFormat = new Date(start).toLocaleString('pl-PL', {dateStyle: 'full', timeStyle: 'short'});
  const endFormat = new Date(end).toLocaleTimeString('pl-PL', {timeStyle: 'short'});

  const msg = {
    from: `${APP_NAME} <no-reply@crm-app.example.com>`,
    to: email,
    subject: 'Potwierdzenie rezerwacji spotkania',
    text:
      `Dziękujemy za rezerwację terminu:
• ${startFormat} – ${endFormat}

Możesz zobaczyć swoje rezerwacje w kalendarzu po zalogowaniu lub utworzeniu konta.

Pozdrawiamy,
Zespół ${APP_NAME}`
  };

  try {
    const info = await transport.sendMail(msg);
    console.log('✅ Mail wysłany:', info.messageId);
    if (info.previewURL) console.log('🔗 Podgląd (Ethereal):', info.previewURL);
    return {success: true};
  } catch (err) {
    console.error('❌ Błąd wysyłki maila:', err);
    throw new HttpsError('internal', 'Nie udało się wysłać maila');
  }
});

exports.sendInvitationEmail = onCall({secrets: [SENDGRID_KEY]}, async (request) => {
  const payload = request.data || {};
  const {email, title, start, end, inviterEmail} = payload;

  if (!email || !title || !start || !end || !inviterEmail) {
    throw new HttpsError('invalid-argument', 'Brakuje danych do wysłania zaproszenia');
  }

  const transport = await mailTransportPromise;

  const startFormat = new Date(start).toLocaleString('pl-PL', {dateStyle: 'full', timeStyle: 'short'});
  const endFormat = new Date(end).toLocaleTimeString('pl-PL', {timeStyle: 'short'});

  const msg = {
    from: `${APP_NAME} <no-reply@crm-app.example.com>`,
    to: email,
    subject: 'Zaproszenie na spotkanie',
    text:
      `Zostałeś zaproszony na spotkanie przez ${inviterEmail}:
• Tytuł: ${title}
• Termin: ${startFormat} – ${endFormat}

Spotkanie pojawi się w Twoim kalendarzu po zalogowaniu.

Pozdrawiamy,
Zespół ${APP_NAME}`
  };

  try {
    const info = await transport.sendMail(msg);
    console.log('✅ Zaproszenie wysłane:', info.messageId);
    if (info.previewURL) console.log('🔗 Podgląd (Ethereal):', info.previewURL);
    return {success: true};
  } catch (err) {
    console.error('❌ Błąd wysyłki zaproszenia:', err);
    throw new HttpsError('internal', 'Nie udało się wysłać zaproszenia');
  }
});

// --- Tracking kliknięć: GET /api/t?m=<messageId>&u=<encodedTarget>&r=<recipientEmail>

const trackingHandler = async (req, res) => {
  try {
    const m = String(req.query.m || '');
    const u = String(req.query.u || '');
    const r = req.query.r ? String(req.query.r) : null;

    console.log('↪️ /t hit', {path: req.path, m, hasU: !!u, r});

    if (!m || !u) {
      return res.status(400).send('Missing query params: m, u');
    }
    if (!/^https?:\/\//i.test(u)) {
      return res.status(400).send('Invalid target url');
    }

    const ua = req.get('user-agent') || '';
    const ipHeader = req.headers['x-forwarded-for'] || req.headers['x-real-ip'] || '';
    const ip = Array.isArray(ipHeader) ? ipHeader[0] : String(ipHeader).split(',')[0].trim();

    await admin.firestore().collection('clicks').add({
      messageId: m,
      recipient: r,
      url: u,
      userAgent: ua,
      ip,
      ts: admin.firestore.FieldValue.serverTimestamp()
    });

    console.log('📝 zapisano kliknięcie → redirect 302');
    return res.redirect(302, u);
  } catch (err) {
    console.error('❌ Click tracking error:', err);
    return res.status(500).send('Click tracking failed');
  }
};

// ====== STATYSTYKI ======

function tsToIso(ts) {
  if (!ts) return null;
  if (ts.toDate) return ts.toDate().toISOString();
  try {
    return new Date(ts).toISOString();
  } catch {
    return null;
  }
}

const clicksListHandler = async (req, res) => {
  try {
    const messageId = String(req.query.messageId || '');
    if (!messageId) return res.status(400).json({error: 'messageId is required'});

    const limit = Math.min(parseInt(String(req.query.limit || '200'), 10) || 200, 2000);
    const from = req.query.from ? new Date(String(req.query.from)) : null;
    const to = req.query.to ? new Date(String(req.query.to)) : null;

    let q = admin.firestore().collection('clicks')
      .where('messageId', '==', messageId)
      .orderBy('ts', 'desc');
    if (from) q = q.where('ts', '>=', from);
    if (to) q = q.where('ts', '<=', to);

    const snap = await q.limit(limit).get();
    const items = snap.docs.map(d => {
      const v = d.data();
      return {
        id: d.id,
        messageId: v.messageId,
        recipient: v.recipient || null,
        url: v.url,
        userAgent: v.userAgent || null,
        ip: v.ip || null,
        ts: tsToIso(v.ts)
      };
    });

    res.json({items});
  } catch (e) {
    console.error('❌ /stats clicks error', e);
    res.status(500).json({error: 'internal'});
  }
};

const clicksSummaryHandler = async (req, res) => {
  try {
    const sinceDays = parseInt(String(req.query.sinceDays || '365'), 10) || 365;
    const limit = Math.min(parseInt(String(req.query.limit || '5000'), 10) || 5000, 20000);
    const since = new Date();
    since.setDate(since.getDate() - sinceDays);

    const snap = await admin.firestore().collection('clicks')
      .where('ts', '>=', since)
      .orderBy('ts', 'desc')
      .limit(limit)
      .get();

    const map = new Map();
    snap.forEach(d => {
      const v = d.data();
      const mid = v.messageId;
      if (!mid) return;
      const iso = tsToIso(v.ts);
      const cur = map.get(mid) || {messageId: mid, count: 0, lastTs: null};
      cur.count++;
      if (!cur.lastTs || (iso && iso > cur.lastTs)) cur.lastTs = iso;
      map.set(mid, cur);
    });

    const items = Array.from(map.values()).sort((a, b) => b.count - a.count);
    res.json({items});
  } catch (e) {
    console.error('❌ /stats summary error', e);
    res.status(500).json({error: 'internal'});
  }
};

const clicksCsvHandler = async (req, res) => {
  try {
    const messageId = String(req.query.messageId || '');
    if (!messageId) return res.status(400).send('messageId is required');

    const snap = await admin.firestore().collection('clicks')
      .where('messageId', '==', messageId)
      .orderBy('ts', 'desc')
      .limit(5000)
      .get();

    const rows = [['id', 'messageId', 'recipient', 'url', 'userAgent', 'ip', 'ts']];
    snap.forEach(d => {
      const v = d.data();
      rows.push([
        d.id, v.messageId || '', v.recipient || '', v.url || '',
        String(v.userAgent || '').replace(/"/g, '""'),
        v.ip || '', tsToIso(v.ts) || ''
      ]);
    });

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="clicks_${messageId}.csv"`);
    res.send(rows.map(r => r.map(x => `"${String(x).replace(/"/g, '""')}"`).join(',')).join('\n'));
  } catch (e) {
    console.error('❌ /stats clicks.csv error', e);
    res.status(500).send('internal');
  }
};

const summaryCsvHandler = async (req, res) => {
  try {
    const sinceDays = parseInt(String(req.query.sinceDays || '365'), 10) || 365;
    const since = new Date();
    since.setDate(since.getDate() - sinceDays);

    const snap = await admin.firestore().collection('clicks')
      .where('ts', '>=', since)
      .orderBy('ts', 'desc')
      .limit(20000)
      .get();

    const map = new Map();
    snap.forEach(d => {
      const v = d.data();
      const mid = v.messageId;
      if (!mid) return;
      const iso = tsToIso(v.ts);
      const cur = map.get(mid) || {messageId: mid, count: 0, lastTs: null};
      cur.count++;
      if (!cur.lastTs || (iso && iso > cur.lastTs)) cur.lastTs = iso;
      map.set(mid, cur);
    });

    const rows = [['messageId', 'count', 'lastTs']];
    Array.from(map.values()).sort((a, b) => b.count - a.count)
      .forEach(r => rows.push([r.messageId, r.count, r.lastTs || '']));

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="clicks_summary.csv"`);
    res.send(rows.map(r => r.join(',')).join('\n'));
  } catch (e) {
    console.error('❌ /stats summary.csv error', e);
    res.status(500).send('internal');
  }
};

// ========== HTTP API (Express) ==========

const app = express();
const middlewares = jsonServer.defaults();
const router = jsonServer.router('db.json');

app.use(middlewares);
app.use(jsonServer.bodyParser);

// REST przez json-server
app.get('/t', trackingHandler);
app.get('/stats/clicks', clicksListHandler);
app.get('/stats/clicks/summary', clicksSummaryHandler);
app.get('/stats/clicks/csv', clicksCsvHandler);
app.get('/stats/clicks/summary.csv', summaryCsvHandler);

app.get('/api/t', trackingHandler);
app.get('/api/stats/clicks', clicksListHandler);
app.get('/api/stats/clicks/summary', clicksSummaryHandler);
app.get('/api/stats/clicks/csv', clicksCsvHandler);
app.get('/api/stats/clicks/summary.csv', summaryCsvHandler);

// === Ścieżka do bazy e-mail/konwersacji i stan IMAP ===
const conversationsDbPath = join(__dirname, 'db-email.json');

// Inicjalizacja stanu IMAP + handlery konfiguracji IMAP
const imapState = createImapStateFromEnv(process.env);
const ic = imapConfigHandlers({dbPath: conversationsDbPath, state: imapState});
app.get('/imap/config', ic.get);
app.get('/api/imap/config', ic.get);
app.post('/imap/config', ic.set);
app.post('/api/imap/config', ic.set);
app.post('/imap/test', ic.test);
app.post('/api/imap/test', ic.test);

// Konwersacje (server-api)
const conv = conversationsHandlers({dbPath: conversationsDbPath});
app.post('/conversations/logEmail', conv.logEmail);
app.post('/api/conversations/logEmail', conv.logEmail);
app.get('/conversations', conv.list);
app.get('/api/conversations', conv.list);

// Inbox (server-inbox) – korzysta z imapState (mutowalny obiekt)
const ih = inboxHandlers({dbPath: conversationsDbPath, imapConfig: imapState});
app.get('/inbox/messages', ih.list);
app.get('/api/inbox/messages', ih.list);
app.get('/inbox/message/:id', ih.getMessage);
app.get('/api/inbox/message/:id', ih.getMessage);
app.post('/inbox/markRead', ih.markRead);
app.post('/api/inbox/markRead', ih.markRead);

// Wysyłka maili (server-mail)
const mh = mailHandlers({transportPromise: mailTransportPromise, appName: APP_NAME});
app.post('/mail/send', mh.send);
app.post('/api/mail/send', mh.send);

app.use('/api', router);

exports.api = onRequest({secrets: [SENDGRID_KEY, IMAP_ENC_KEY, IMAP_ENC_PASSWORD]}, app);
