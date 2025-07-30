const functions = require('firebase-functions');
const admin = require('firebase-admin');
const express = require('express');
const jsonServer = require('json-server');

admin.initializeApp();

// Callable Function - wyszukiwanie użytkownika Firebase po emailu
exports.getUserByEmail = functions.https.onCall(async (data, context) => {
  // Logujemy payload
  console.log('>>> getUserByEmail invoked, data =', data);

  // Wyciągamy email z data.email
  const email =
    typeof data.email === 'string'
      ? data.email
      : data.data?.email;
  if (!email) {
    throw new functions.https.HttpsError('invalid-argument', 'Brak adresu email');
  }

  try {
    const userRecord = await admin.auth().getUserByEmail(email);
    return {uid: userRecord.uid, email: userRecord.email};
  } catch (err) {
    throw new functions.https.HttpsError('not-found', 'Użytkownik nie znaleziony');
  }
});

// REST-owe API przez json-server
const app = express();
const router = jsonServer.router('db.json');
const middlewares = jsonServer.defaults();

app.use(middlewares);
app.use(jsonServer.bodyParser);
app.use('/api', router);

exports.api = functions.https.onRequest(app);
