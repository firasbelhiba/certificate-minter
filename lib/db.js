// Data layer with two interchangeable backends:
//   - Vercel KV (Upstash Redis) when KV_REST_API_URL/TOKEN are set (production)
//   - A local data/db.json file otherwise (local dev)
// Uses hash semantics so concurrent registrations never clobber each other.

import fs from "fs";
import path from "path";

const FILE = path.join(process.cwd(), "data", "db.json");

// Find the Upstash Redis REST URL/token regardless of the prefix Vercel's
// integration used (UPSTASH_REDIS_*, KV_*, STORAGE_*, etc.).
function redisUrl() {
  const direct =
    process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
  if (direct) return direct;
  for (const [k, v] of Object.entries(process.env)) {
    if (!v) continue;
    // REST endpoints are https URLs (skip redis:// connection strings).
    if (/REST_API_URL$/.test(k) || /REDIS_REST_URL$/.test(k)) {
      if (/^https?:\/\//.test(v)) return v;
    }
  }
  return undefined;
}
function redisToken() {
  const direct =
    process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
  if (direct) return direct;
  for (const [k, v] of Object.entries(process.env)) {
    if (!v) continue;
    if (/READ_ONLY/i.test(k)) continue; // read-only token can't write
    if (/REST_API_TOKEN$/.test(k) || /REDIS_REST_TOKEN$/.test(k)) return v;
  }
  return undefined;
}
function kvEnabled() {
  return Boolean(redisUrl() && redisToken());
}

let _kv = null;
async function kv() {
  if (!_kv) {
    const { Redis } = await import("@upstash/redis");
    _kv = new Redis({ url: redisUrl(), token: redisToken() });
  }
  return _kv;
}

// ---- local file helpers ----
function readFile() {
  try {
    return JSON.parse(fs.readFileSync(FILE, "utf8"));
  } catch {
    return { students: {}, certs: {} };
  }
}
function writeFile(data) {
  fs.mkdirSync(path.dirname(FILE), { recursive: true });
  fs.writeFileSync(FILE, JSON.stringify(data, null, 2));
}

export function storageMode() {
  return kvEnabled() ? "vercel-kv" : "local-json";
}

// ---- students (keyed by accountId) ----

export async function upsertStudent(student) {
  const key = student.accountId;
  if (kvEnabled()) {
    const k = await kv();
    const existing = (await k.hget("students", key)) || {};
    await k.hset("students", { [key]: { ...existing, ...student } });
    return { ...existing, ...student };
  }
  const db = readFile();
  db.students[key] = { ...(db.students[key] || {}), ...student };
  writeFile(db);
  return db.students[key];
}

export async function getStudent(accountId) {
  if (kvEnabled()) {
    const k = await kv();
    return (await k.hget("students", accountId)) || null;
  }
  return readFile().students[accountId] || null;
}

export async function listStudents() {
  if (kvEnabled()) {
    const k = await kv();
    const all = (await k.hgetall("students")) || {};
    return Object.values(all);
  }
  return Object.values(readFile().students);
}

export async function patchStudent(accountId, patch) {
  return upsertStudent({ accountId, ...patch });
}

// ---- certificate metadata (keyed by certId) ----

export async function saveCert(certId, metadata) {
  if (kvEnabled()) {
    const k = await kv();
    await k.hset("certs", { [certId]: metadata });
    return;
  }
  const db = readFile();
  db.certs[certId] = metadata;
  writeFile(db);
}

export async function getCert(certId) {
  if (kvEnabled()) {
    const k = await kv();
    return (await k.hget("certs", certId)) || null;
  }
  return readFile().certs[certId] || null;
}

// Wipes all students and certificate metadata (on-chain NFTs are unaffected).
export async function clearAll() {
  if (kvEnabled()) {
    const k = await kv();
    await k.del("students");
    await k.del("certs");
    return;
  }
  writeFile({ students: {}, certs: {} });
}
