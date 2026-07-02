// ═══════════════════════════════════════════════════════════════════════════
//  lib/db.js — La BASE DE DONNÉES (liste des étudiants + certificats)
//  Deux backends interchangeables selon l'environnement :
//   - En production (Vercel) : Upstash Redis (car le disque de Vercel est en
//     lecture seule, on ne peut pas y écrire de fichier).
//   - En local : un simple fichier data/db.json.
//  On utilise des "hash" Redis pour que deux inscriptions simultanées ne
//  s'écrasent pas l'une l'autre.
// ═══════════════════════════════════════════════════════════════════════════
import fs from "fs"; // système de fichiers (mode local)
import path from "path"; // pour construire les chemins de fichiers

// Chemin du fichier local de la base (utilisé seulement en développement).
const FILE = path.join(process.cwd(), "data", "db.json");

// Trouve l'URL REST d'Upstash Redis, peu importe le préfixe utilisé par
// l'intégration Vercel (UPSTASH_REDIS_*, KV_*, STORAGE_*, etc.).
function redisUrl() {
  const direct =
    process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
  if (direct) return direct; // cas standard
  // Sinon, on parcourt toutes les variables d'env à la recherche d'une URL REST.
  for (const [k, v] of Object.entries(process.env)) {
    if (!v) continue;
    // Les points de terminaison REST sont des URLs https (on ignore redis://).
    if (/REST_API_URL$/.test(k) || /REDIS_REST_URL$/.test(k)) {
      if (/^https?:\/\//.test(v)) return v;
    }
  }
  return undefined;
}
// Même logique pour le jeton d'accès (token) Redis.
function redisToken() {
  const direct =
    process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
  if (direct) return direct;
  for (const [k, v] of Object.entries(process.env)) {
    if (!v) continue;
    if (/READ_ONLY/i.test(k)) continue; // un token en lecture seule ne peut pas écrire
    if (/REST_API_TOKEN$/.test(k) || /REDIS_REST_TOKEN$/.test(k)) return v;
  }
  return undefined;
}
// Redis est "activé" si on a à la fois une URL et un token.
function kvEnabled() {
  return Boolean(redisUrl() && redisToken());
}

// On garde une seule instance du client Redis (mise en cache).
let _kv = null;
async function kv() {
  if (!_kv) {
    // On importe la librairie Upstash à la demande (lazy import).
    const { Redis } = await import("@upstash/redis");
    _kv = new Redis({ url: redisUrl(), token: redisToken() });
  }
  return _kv;
}

// ---- Fonctions du mode fichier local ----
// Lit le fichier db.json (renvoie une base vide si le fichier n'existe pas).
function readFile() {
  try {
    return JSON.parse(fs.readFileSync(FILE, "utf8"));
  } catch {
    return { students: {}, certs: {} };
  }
}
// Écrit la base dans db.json (crée le dossier si besoin).
function writeFile(data) {
  fs.mkdirSync(path.dirname(FILE), { recursive: true });
  fs.writeFileSync(FILE, JSON.stringify(data, null, 2));
}

// Indique quel backend est actif (affiché dans le tableau de bord).
export function storageMode() {
  return kvEnabled() ? "vercel-kv" : "local-json";
}

// ---- Étudiants (indexés par identifiant de compte) ----

// Crée OU met à jour un étudiant (upsert = update + insert).
export async function upsertStudent(student) {
  const key = student.accountId; // la clé = l'identifiant du compte
  if (kvEnabled()) {
    const k = await kv();
    const existing = (await k.hget("students", key)) || {}; // valeur existante
    // On fusionne l'ancien et le nouveau puis on enregistre.
    await k.hset("students", { [key]: { ...existing, ...student } });
    return { ...existing, ...student };
  }
  // Version fichier local.
  const db = readFile();
  db.students[key] = { ...(db.students[key] || {}), ...student };
  writeFile(db);
  return db.students[key];
}

// Récupère un étudiant par son identifiant de compte.
export async function getStudent(accountId) {
  if (kvEnabled()) {
    const k = await kv();
    return (await k.hget("students", accountId)) || null;
  }
  return readFile().students[accountId] || null;
}

// Liste tous les étudiants.
export async function listStudents() {
  if (kvEnabled()) {
    const k = await kv();
    const all = (await k.hgetall("students")) || {};
    return Object.values(all); // on renvoie un tableau
  }
  return Object.values(readFile().students);
}

// Modifie partiellement un étudiant (ex: changer son statut).
export async function patchStudent(accountId, patch) {
  return upsertStudent({ accountId, ...patch });
}

// ---- Métadonnées des certificats (indexées par certId) ----

// Enregistre les métadonnées d'un certificat.
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

// Récupère les métadonnées d'un certificat (utilisé par les routes metadata/certificate).
export async function getCert(certId) {
  if (kvEnabled()) {
    const k = await kv();
    return (await k.hget("certs", certId)) || null;
  }
  return readFile().certs[certId] || null;
}

// Efface TOUS les étudiants et certificats (le bouton "Clear all students").
// ⚠️ Les NFT déjà envoyés sur la blockchain ne sont PAS affectés (immuables).
export async function clearAll() {
  if (kvEnabled()) {
    const k = await kv();
    await k.del("students");
    await k.del("certs");
    return;
  }
  writeFile({ students: {}, certs: {} });
}
