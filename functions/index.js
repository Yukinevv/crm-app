const functions = require('firebase-functions');
const express = require('express');
const jsonServer = require('json-server');

const app = express();
const router = jsonServer.router('db.json');
const middlewares = jsonServer.defaults();

app.use(middlewares);
app.use(jsonServer.bodyParser);
// wszystkie endpointy pod /api
app.use('/api', router);

exports.api = functions.https.onRequest(app);
