const functions = require('firebase-functions');
const admin = require('firebase-admin');
const express = require('express');
const jsonServer = require('json-server');
const nodemailer = require('nodemailer');
const {FieldValue} = require('firebase-admin/firestore');

if (process.env.FORCE_PROD_DB === '1') {
  delete process.env.FIRESTORE_EMULATOR_HOST;
}

admin.initializeApp();

// Ustawiamy transport w zależności od środowiska / configów
async function createMailTransport() {
  // Emulator: MailHog na localhost:1025
  if (process.env.FUNCTIONS_EMULATOR) {
    console.log('⚙️ Używam lokalnego MailHog na porcie 1025');
    return nodemailer.createTransport({
      host: 'localhost',
      port: 1025,
      ignoreTLS: true
    });
  }

  // Hosting: SendGrid
  const sgKey = functions.config().sendgrid?.key;
  if (sgKey) {
    console.log('⚙️ Używam SendGrid SMTP');
    return nodemailer.createTransport({
      host: 'smtp.sendgrid.net',
      port: 587,
      auth: {
        user: 'apikey',
        pass: sgKey
      }
    });
  }

  // Fallback: Ethereal konto testowe
  console.log('⚙️ Nie wykryto configów mailowych – tworzę konto Ethereal (test)');
  const testAccount = await nodemailer.createTestAccount();
  console.log('ℹ️ Konto Ethereal:', testAccount.user, testAccount.pass);
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

// Callable: getUserByEmail
exports.getUserByEmail = functions.https.onCall(async (data, context) => {
  console.log('>>> getUserByEmail data=', data);
  const email = typeof data.email === 'string'
    ? data.email
    : data.data?.email;
  if (!email) {
    throw new functions.https.HttpsError('invalid-argument', 'Brak adresu email');
  }
  try {
    const user = await admin.auth().getUserByEmail(email);
    return {uid: user.uid, email: user.email};
  } catch {
    throw new functions.https.HttpsError('not-found', 'Użytkownik nie znaleziony');
  }
});

// Callable: sendBookingConfirmation z dynamicznym transportem
exports.sendBookingConfirmation = functions.https.onCall(async (data, context) => {
  // unwrap payload - emulator pakuje w data.data
  const payload = (data && data.data) ? data.data : data;
  console.log('>>> sendBookingConfirmation payload=', payload);

  const {email, start, end} = payload || {};
  if (!email || !start || !end) {
    console.error('❌ Brakuje pól:', {email, start, end});
    throw new functions.https.HttpsError(
      'invalid-argument',
      'Brakuje danych do wysłania potwierdzenia'
    );
  }

  const transport = await mailTransportPromise;

  // Formatowanie po polsku
  const startFormat = new Date(start).toLocaleString('pl-PL', {dateStyle: 'full', timeStyle: 'short'});
  const endFormat = new Date(end).toLocaleTimeString('pl-PL', {timeStyle: 'short'});

  const msg = {
    from: `${APP_NAME} <adrianrodzicsh@gmail.com>`,
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
    if (info.previewURL) {
      console.log('🔗 Podgląd (Ethereal):', info.previewURL);
    }
    return {success: true};
  } catch (err) {
    console.error('❌ Błąd wysyłki maila:', err);
    throw new functions.https.HttpsError('internal', 'Nie udało się wysłać maila');
  }
});

// Callable: sendInvitationEmail dla zaproszeń
exports.sendInvitationEmail = functions.https.onCall(async (data, context) => {
  const payload = (data && data.data) ? data.data : data;
  console.log('>>> sendInvitationEmail payload=', payload);

  const {email, title, start, end, inviterEmail} = payload || {};
  if (!email || !title || !start || !end || !inviterEmail) {
    console.error('❌ Brakuje pól w zaproszeniu:', {email, title, start, end, inviterEmail});
    throw new functions.https.HttpsError(
      'invalid-argument',
      'Brakuje danych do wysłania zaproszenia'
    );
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
    if (info.previewURL) {
      console.log('🔗 Podgląd (Ethereal):', info.previewURL);
    }
    return {success: true};
  } catch (err) {
    console.error('❌ Błąd wysyłki zaproszenia:', err);
    throw new functions.https.HttpsError('internal', 'Nie udało się wysłać zaproszenia');
  }
});

// REST API przez json-server
const app = express();
const router = jsonServer.router('db.json');
const middlewares = jsonServer.defaults();

app.use(middlewares);
app.use(jsonServer.bodyParser);

// Tracking kliknięć: GET /api/t?m=<messageId>&u=<encodedTarget>&r=<recipientEmail>
const trackingHandler = async (req, res) => {
  try {
    const m = String(req.query.m || '');
    const u = String(req.query.u || '');
    const r = req.query.r ? String(req.query.r) : null;

    console.log('↪️ /t hit', {path: req.path, m, hasU: !!u, r});

    if (!m || !u) {
      console.warn('⚠️ Missing params');
      return res.status(400).send('Missing query params: m, u');
    }
    if (!/^https?:\/\//i.test(u)) {
      console.warn('⚠️ Invalid target url');
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
      ts: FieldValue.serverTimestamp()
    });

    console.log('📝 zapisano kliknięcie → redirect 302');
    return res.redirect(302, u);
  } catch (err) {
    console.error('❌ Click tracking error:', err);
    return res.status(500).send('Click tracking failed');
  }
};

// https://example.com/oferta
// Rejestrujemy ścieżki
app.get('/api/t', trackingHandler);
app.get('/t', trackingHandler);

app.use('/api', router);

exports.api = functions.https.onRequest(app);
