'use strict';

const jsonServer = require('json-server');
const crypto = require('crypto');
const {ImapFlow} = require('imapflow');

/* -------------------- lowdb context -------------------- */
function createContext(dbPath) {
  const routerDb = jsonServer.router(dbPath);

  function ensureMap(name) {
    if (!routerDb.db.has(name).value()) {
      routerDb.db.set(name, {}).write();
    }
  }

  return {routerDb, ensureMap};
}

/* -------------------- typy / normalizacja -------------------- */
function toBool(v) {
  if (typeof v === 'boolean') return v;
  const s = String(v ?? '').trim().toLowerCase();
  return s === 'true' || s === '1' || s === 'yes';
}

function toNum(v, def) {
  const n = Number(v);
  return Number.isFinite(n) ? n : def;
}

/* -------------------- szyfrowanie hasła (AES-256-GCM) -------------------- */
const ENC_VERSION = 'v1';
const SCRYPT_SALT = 'imap_cfg_salt_v1';

function getCryptoKey() {
  const rawKeyB64 = process.env.IMAP_ENC_KEY;
  if (rawKeyB64) {
    const key = Buffer.from(rawKeyB64, 'base64');
    if (key.length === 32) return key;
    console.warn('⚠️ IMAP_ENC_KEY nie ma 32 bajtów po base64 – fallback do scrypt z IMAP_ENC_PASSWORD');
  }
  const pass = process.env.IMAP_ENC_PASSWORD || 'dev-only-not-secure';
  return crypto.scryptSync(pass, SCRYPT_SALT, 32);
}

function encryptSecret(plain) {
  if (!plain) return '';
  const key = getCryptoKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const enc = Buffer.concat([cipher.update(String(plain), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${ENC_VERSION}.${iv.toString('base64')}.${tag.toString('base64')}.${enc.toString('base64')}`;
}

function decryptSecret(token) {
  if (!token) return '';
  try {
    const [ver, ivB64, tagB64, dataB64] = String(token).split('.');
    if (ver !== ENC_VERSION) return '';
    const key = getCryptoKey();
    const iv = Buffer.from(ivB64, 'base64');
    const tag = Buffer.from(tagB64, 'base64');
    const data = Buffer.from(dataB64, 'base64');
    const dec = crypto.createDecipheriv('aes-256-gcm', key, iv);
    dec.setAuthTag(tag);
    const out = Buffer.concat([dec.update(data), dec.final()]);
    return out.toString('utf8');
  } catch {
    return '';
  }
}

/* -------------------- ENV → stan IMAP (bez hasła) -------------------- */
function createImapStateFromEnv(env) {
  return {
    host: env.IMAP_HOST || '',
    port: String(env.IMAP_PORT || '993'),
    secure: String(env.IMAP_SECURE || 'true'),
    user: env.IMAP_USER || '',
  };
}

/* -------------------- per-UID read/write w lowdb -------------------- */
const IMAP_MAP_KEY = 'imapConfigsByUid';

function readImapConfigForUid(ctx, uid) {
  ctx.ensureMap(IMAP_MAP_KEY);
  const map = ctx.routerDb.db.get(IMAP_MAP_KEY).value() || {};
  return map[uid] || {};
}

function writeImapConfigForUid(ctx, uid, obj) {
  ctx.ensureMap(IMAP_MAP_KEY);
  const map = ctx.routerDb.db.get(IMAP_MAP_KEY).value() || {};
  map[uid] = obj;
  ctx.routerDb.db.set(IMAP_MAP_KEY, map).write();
}

/* -------------------- test połączenia IMAP -------------------- */
async function testImapConnection(effectiveCfg) {
  const client = new ImapFlow({
    host: effectiveCfg.host,
    port: effectiveCfg.port,
    secure: effectiveCfg.secure,
    auth: {user: effectiveCfg.user, pass: effectiveCfg.pass},
    logger: true
  });

  try {
    await client.connect();

    const listResp = await client.list();
    const mailboxes = Array.isArray(listResp)
      ? listResp.map(m => m.path).filter(Boolean)
      : [];

    const sample = [];
    const lock = await client.getMailboxLock(effectiveCfg.mailbox || 'INBOX');
    try {
      const total = client.mailbox?.exists || 0;
      if (total > 0) {
        const start = Math.max(1, total - 4);
        const range = `${start}:*`;
        for await (const msg of client.fetch(range, {uid: true, envelope: true})) {
          sample.push({
            id: String(msg.uid),
            subject: (msg.envelope?.subject || '').toString() || '(bez tematu)'
          });
        }
      }
    } finally {
      lock.release();
    }

    await client.logout();
    return {ok: true, mailboxes, sample};
  } catch (err) {
    try {
      client.close();
    } catch (_) {
    }
    throw err;
  }
}

module.exports = {
  // lowdb
  createContext,
  readImapConfigForUid,
  writeImapConfigForUid,

  // helpers
  toBool,
  toNum,

  // crypto
  encryptSecret,
  decryptSecret,

  // env
  createImapStateFromEnv,

  // tests
  testImapConnection,
};
