// ═══════════════════════════════════════════════════════════════════════════
//  lib/auth.js — Protection de la section formateur (/admin) par mot de passe
//  Le mot de passe est envoyé par la page admin dans l'en-tête HTTP
//  "x-admin-password", puis comparé à celui du serveur (ADMIN_PASSWORD).
// ═══════════════════════════════════════════════════════════════════════════

// Indique si un mot de passe admin est bien configuré côté serveur.
export function adminConfigured() {
  return Boolean(process.env.ADMIN_PASSWORD);
}

// Vérifie que la requête contient le bon mot de passe formateur.
export function checkAdmin(req) {
  const expected = process.env.ADMIN_PASSWORD; // le mot de passe attendu
  if (!expected) return false; // pas configuré → on refuse
  const provided = req.headers.get("x-admin-password") || ""; // celui envoyé

  // Comparaison "à temps constant" : on compare caractère par caractère sans
  // s'arrêter au premier écart, pour ne pas révéler d'info via le temps de réponse.
  if (provided.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) {
    // XOR : diff reste 0 seulement si tous les caractères sont identiques.
    diff |= provided.charCodeAt(i) ^ expected.charCodeAt(i);
  }
  return diff === 0; // vrai si les deux mots de passe sont identiques
}
