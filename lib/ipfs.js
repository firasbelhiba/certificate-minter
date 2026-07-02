// ═══════════════════════════════════════════════════════════════════════════
//  lib/ipfs.js — Stockage décentralisé sur IPFS via Pinata
//  IPFS = un réseau de stockage où chaque fichier est identifié par un "CID"
//  (Content ID), un identifiant calculé à partir du contenu lui-même.
//  Activé uniquement si la variable PINATA_JWT est définie.
// ═══════════════════════════════════════════════════════════════════════════

// Les deux points de terminaison de l'API Pinata qu'on utilise.
const PIN_FILE_URL = "https://api.pinata.cloud/pinning/pinFileToIPFS"; // épingler un fichier
const PIN_JSON_URL = "https://api.pinata.cloud/pinning/pinJSONToIPFS"; // épingler du JSON

// Indique si IPFS est activé (présence de la clé Pinata).
export function ipfsEnabled() {
  return Boolean(process.env.PINATA_JWT);
}

// Récupère la clé d'authentification Pinata (le "JWT"), sinon lève une erreur.
function jwt() {
  const t = process.env.PINATA_JWT;
  if (!t) throw new Error("PINATA_JWT is not set.");
  return t;
}

// Construit un lien HTTPS lisible dans un navigateur à partir d'un CID.
// (Sur la blockchain on stocke ipfs://CID ; ce lien sert juste à l'affichage.)
export function gatewayUrl(cid) {
  const base = (
    process.env.PINATA_GATEWAY || "https://gateway.pinata.cloud"
  ).replace(/\/$/, "");
  return `${base}/ipfs/${cid}`;
}

// Épingle un FICHIER (ici l'image SVG) sur IPFS et renvoie son CID.
export async function pinFile(content, filename, contentType) {
  // On construit un formulaire multipart (comme un envoi de fichier).
  const form = new FormData();
  form.append("file", new Blob([content], { type: contentType }), filename);
  form.append("pinataMetadata", JSON.stringify({ name: filename }));

  // On envoie à Pinata avec notre clé d'authentification.
  const res = await fetch(PIN_FILE_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${jwt()}` },
    body: form,
  });
  // Si Pinata renvoie une erreur, on la remonte.
  if (!res.ok) {
    throw new Error(`Pinata file pin failed (${res.status}): ${await res.text()}`);
  }
  const data = await res.json();
  return data.IpfsHash; // le CID du fichier épinglé
}

// Épingle un objet JSON (les métadonnées) sur IPFS et renvoie son CID.
export async function pinJSON(obj, name) {
  const res = await fetch(PIN_JSON_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${jwt()}`,
    },
    // pinataContent = le contenu à épingler ; pinataMetadata = son nom lisible.
    body: JSON.stringify({
      pinataContent: obj,
      pinataMetadata: { name },
    }),
  });
  if (!res.ok) {
    throw new Error(`Pinata JSON pin failed (${res.status}): ${await res.text()}`);
  }
  const data = await res.json();
  return data.IpfsHash; // le CID du JSON épinglé
}
