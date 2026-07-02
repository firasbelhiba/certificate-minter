// Data layer with two interchangeable backends:
//   - Vercel KV (Upstash Redis) when KV_REST_API_URL/TOKEN are set (production)
//   - A local data/db.json file otherwise (local dev)
// Uses hash semantics so concurrent registrations never clobber each other.

import fs from "fs";
import path from "path";

const FILE = path.join(process.cwd(), "data", "db.json");

// Accept either the Upstash-native env names or Vercel KV aliases.
function redisUrl() {
  return process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
}
function redisToken() {
  return process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
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
