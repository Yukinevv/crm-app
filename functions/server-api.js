const express = require('express');
const jsonServer = require('json-server');

/**
 * Tworzy router Express z endpointami:
 *  - POST  /conversations/logEmail
 *  - GET   /conversations
 * Dane zapisywane są do lowdb (json-server) wskazanego przez dbPath (np. db-email.json).
 */
function createConversationsRouter({dbPath}) {
  const r = express.Router();
  const routerConv = jsonServer.router(dbPath);

  // ===== helpers =====
  function ensureCollection(name) {
    if (!routerConv.db.has(name).value()) {
      routerConv.db.set(name, []).write();
    }
  }

  function genId(prefix) {
    return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
  }

  function normalizeEmail(e) {
    return String(e || '').trim().toLowerCase();
  }

  // ===== POST /conversations/logEmail =====
  r.post('/conversations/logEmail', (req, res) => {
    try {
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
        contactId // opcjonalne - jeśli front poda, nie szukamy kontaktu po stronie backendu
      } = req.body || {};

      if (!userId || !direction || !subject || !emailId || !counterpartEmail) {
        return res.status(400).json({error: 'Missing required fields'});
      }

      const ce = normalizeEmail(counterpartEmail);

      // Nie dotykamy bazy kontaktów (jest w innym pliku). Jeśli front nie poda contactId -> tworzymy/odnajdujemy leada.
      let finalContactId = contactId || undefined;
      let leadId;

      if (!finalContactId) {
        const leads = routerConv.db.get('leadsEmail').filter({userId}).value() || [];
        const foundLead = leads.find(l => normalizeEmail(l.email) === ce);
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
            createdAt: new Date().toISOString()
          };
          routerConv.db.get('leadsEmail').push(newLead).write();
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
        counterpartEmail: ce
      };

      routerConv.db.get('conversations').push(conv).write();
      return res.json({ok: true, conversation: conv});
    } catch (e) {
      console.error('❌ logEmail error', e);
      return res.status(500).json({error: 'internal'});
    }
  });

  // ===== GET /conversations =====
  r.get('/conversations', (req, res) => {
    try {
      ensureCollection('conversations');

      const userId = String(req.query.userId || '');
      if (!userId) return res.status(400).json({error: 'userId required'});

      let list = routerConv.db.get('conversations').filter({userId}).value() || [];

      const contactId = req.query.contactId ? String(req.query.contactId) : null;
      const leadId = req.query.leadId ? String(req.query.leadId) : null;
      const ce = req.query.counterpartEmail ? normalizeEmail(req.query.counterpartEmail) : null;
      const q = req.query.q ? String(req.query.q).toLowerCase() : null;

      if (contactId) list = list.filter(x => x.contactId === contactId);
      if (leadId) list = list.filter(x => x.leadId === leadId);
      if (ce) list = list.filter(x => normalizeEmail(x.counterpartEmail) === ce);
      if (q) {
        list = list.filter(x =>
          (x.subject || '').toLowerCase().includes(q) ||
          (x.preview || '').toLowerCase().includes(q) ||
          (x.counterpartEmail || '').toLowerCase().includes(q)
        );
      }

      list.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

      const limit = Math.min(parseInt(String(req.query.limit || '100'), 10) || 100, 2000);
      list = list.slice(0, limit);

      res.json({items: list});
    } catch (e) {
      console.error('❌ list conversations error', e);
      res.status(500).json({error: 'internal'});
    }
  });

  return r;
}

module.exports = {createConversationsRouter};
