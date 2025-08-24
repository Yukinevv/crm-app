'use strict';

const express = require('express');
const jsonServer = require('json-server');

/**
 * Tworzy kontekst pracy na bazie json-server (lowdb) + pomocnicze utilsy.
 */
function createContext(dbPath) {
  const routerDb = jsonServer.router(dbPath);

  function ensureCollection(name) {
    if (!routerDb.db.has(name).value()) {
      routerDb.db.set(name, []).write();
    }
  }

  function genId(prefix) {
    return `${prefix}_${Date.now().toString(36)}_${Math.random()
      .toString(36)
      .slice(2, 10)}`;
  }

  function normalizeEmail(e) {
    return String(e || '').trim().toLowerCase();
  }

  return {routerDb, ensureCollection, genId, normalizeEmail};
}

/**
 * Fabryka handlera: POST /conversations/logEmail
 */
function createLogEmailHandler({dbPath}) {
  const ctx = createContext(dbPath);

  return function logEmailHandler(req, res) {
    try {
      const {routerDb, ensureCollection, genId, normalizeEmail} = ctx;
      ensureCollection('leadsEmail');
      ensureCollection('conversations');

      const {
        userId,
        direction,
        subject,
        body,
        date,
        emailId,
        counterpartEmail,
        contactId,
      } = req.body || {};

      if (!userId || !direction || !subject || !emailId || !counterpartEmail) {
        return res.status(400).json({error: 'Missing required fields'});
      }

      const ce = normalizeEmail(counterpartEmail);

      // Idempotencja: jeżeli (userId,emailId) już istnieje to zwróć istniejącą konwersację
      const existing =
        routerDb.db.get('conversations').filter({userId, emailId}).value() || [];
      if (existing.length) {
        return res.json({ok: true, conversation: existing[0]});
      }

      let finalContactId = contactId;
      let leadId;

      // Auto-lead po emailu gdy brak contactId
      if (!finalContactId) {
        const leads = routerDb.db.get('leadsEmail').filter({userId}).value() || [];
        const foundLead = leads.find((l) => normalizeEmail(l.email) === ce);
        if (foundLead) {
          leadId = foundLead.id;
        } else {
          const newLead = {
            id: genId('lead'),
            userId,
            email: ce,
            name: ce.split('@')[0],
            status: 'Nowy',
            source: 'E-mail',
            createdAt: new Date().toISOString(),
          };
          routerDb.db.get('leadsEmail').push(newLead).write();
          leadId = newLead.id;
        }
      }

      const conv = {
        id: genId('conv'),
        userId,
        type: 'email',
        direction, // 'out' | 'in'
        subject,
        preview: String(body || '').slice(0, 300),
        date: date || new Date().toISOString(),
        emailId,
        contactId: finalContactId,
        leadId,
        counterpartEmail: ce,
      };

      routerDb.db.get('conversations').push(conv).write();
      return res.json({ok: true, conversation: conv});
    } catch (e) {
      console.error('❌ logEmail error', e);
      return res.status(500).json({error: 'internal'});
    }
  };
}

/**
 * Fabryka handlera: GET /conversations
 */
function createListConversationsHandler({dbPath}) {
  const ctx = createContext(dbPath);

  return function listConversationsHandler(req, res) {
    try {
      const {routerDb, ensureCollection, normalizeEmail} = ctx;

      ensureCollection('conversations');
      const userId = String(req.query.userId || '');
      if (!userId) return res.status(400).json({error: 'userId required'});

      let list =
        routerDb.db.get('conversations').filter({userId}).value() || [];

      const contactId = req.query.contactId ? String(req.query.contactId) : null;
      const leadId = req.query.leadId ? String(req.query.leadId) : null;
      const ce = req.query.counterpartEmail
        ? normalizeEmail(req.query.counterpartEmail)
        : null;
      const q = req.query.q ? String(req.query.q).toLowerCase() : null;

      if (contactId) list = list.filter((x) => x.contactId === contactId);
      if (leadId) list = list.filter((x) => x.leadId === leadId);
      if (ce) list = list.filter((x) => normalizeEmail(x.counterpartEmail) === ce);
      if (q) {
        list = list.filter(
          (x) =>
            (x.subject || '').toLowerCase().includes(q) ||
            (x.preview || '').toLowerCase().includes(q) ||
            (x.counterpartEmail || '').toLowerCase().includes(q)
        );
      }

      // sort malejąco po dacie, później limit
      list.sort(
        (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
      );

      const limit = Math.min(
        parseInt(String(req.query.limit || '100'), 10) || 100,
        2000
      );
      list = list.slice(0, limit);

      res.json({items: list});
    } catch (e) {
      console.error('❌ list conversations error', e);
      res.status(500).json({error: 'internal'});
    }
  };
}

function conversationsHandlers({dbPath}) {
  return {
    logEmail: createLogEmailHandler({dbPath}),
    list: createListConversationsHandler({dbPath}),
  };
}

module.exports = {
  createLogEmailHandler,
  createListConversationsHandler,
  conversationsHandlers
};
