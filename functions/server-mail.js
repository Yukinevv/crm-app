'use strict';

/**
 * Fabryka handlera: POST /mail/send
 * body: { from: string, to: string, subject: string, body: string, messageId?: string }
 *  - body może być plain text albo HTML (wykrywane heurystyką).
 */
function createMailSendHandler({transportPromise, appName}) {
  return async function mailSendHandler(req, res) {
    try {
      const {from, to, subject, body, messageId} = req.body || {};
      if (!from || !to || !subject || !body) {
        return res
          .status(400)
          .json({error: 'Missing required fields: from, to, subject, body'});
      }

      const transport = await transportPromise;

      const isHtml = /<\/?[a-z][\s\S]*>/i.test(String(body));
      const msg = {
        from,
        to,
        subject,
        headers: {}
      };

      // Dodatkowe nagłówki pomocnicze (opcjonalne)
      if (appName) {
        msg.headers['X-CRM-App'] = String(appName);
      }
      if (messageId) {
        msg.headers['X-CRM-Message-Id'] = messageId;
      }

      if (isHtml) {
        msg.html = String(body);
        msg.text = stripHtml(String(body));
      } else {
        msg.text = String(body);
      }

      const info = await transport.sendMail(msg);
      const payload = {
        ok: true,
        serverMessageId: info.messageId || null,
        envelope: info.envelope || null,
        previewURL: info.previewURL || null
      };
      return res.json(payload);
    } catch (e) {
      console.error('❌ /mail/send error', e);
      return res.status(500).json({error: 'mail_send_failed'});
    }
  };
}

function mailHandlers({transportPromise, appName}) {
  return {
    send: createMailSendHandler({transportPromise, appName})
  };
}

function stripHtml(html) {
  return String(html)
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<\/?[^>]+(>|$)/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .trim();
}

module.exports = {
  createMailSendHandler,
  mailHandlers
};
