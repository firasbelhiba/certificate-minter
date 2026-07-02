// ═══════════════════════════════════════════════════════════════════════════
//  lib/certificate.js — Génère l'IMAGE du diplôme en SVG (dessin vectoriel)
//  Le SVG est un texte qui décrit des formes : rectangles (bordures), textes
//  (nom, cours...), cercles (sceau), et images (logos des partenaires intégrés
//  en base64). Avantage : net à toute taille, léger, personnalisable.
//  Utilisé par la route image et par l'aperçu en direct.
// ═══════════════════════════════════════════════════════════════════════════
import { LOGOS } from "@/lib/logos"; // les logos partenaires (base64)

// esc() : échappe les caractères spéciaux pour qu'ils ne cassent pas le SVG.
function esc(s) {
  return String(s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// clamp() : coupe un texte trop long pour qu'il tienne sur une seule ligne.
function clamp(s, max) {
  s = String(s || "");
  return s.length > max ? s.slice(0, max - 1) + "…" : s;
}

// Dessine une "carte" blanche contenant un logo centré (bande partenaires).
function logoCard(logo, x, y) {
  const cw = 150; // largeur de la carte
  const ch = 60; // hauteur de la carte
  return `<rect x="${x}" y="${y}" width="${cw}" height="${ch}" rx="8" fill="#ffffff" stroke="#d8cfb8" stroke-width="1"/>
    <image xlink:href="${logo.data}" x="${x + 12}" y="${y + 8}" width="${cw - 24}" height="${ch - 16}" preserveAspectRatio="xMidYMid meet"/>`;
}

// renderCertificateSVG() : construit le diplôme avec les infos de l'étudiant.
export function renderCertificateSVG({
  student,
  course,
  issuer,
  date,
  tokenId,
  serial,
}) {
  // On nettoie et on limite la longueur de chaque champ affiché.
  const name = esc(clamp(student || "Student Name", 34));
  const courseName = esc(clamp(course || "Course Name", 46));
  const issuerName = esc(clamp(issuer || "Academy", 30));
  const dateStr = esc(clamp(date || "", 24));
  // Le pied de page : Token + Serial + "Hedera Testnet".
  const footer = esc(
    [
      tokenId ? `Token ${tokenId}` : null,
      serial ? `Serial #${serial}` : null,
      "Hedera Testnet",
    ]
      .filter(Boolean)
      .join("   ·   ")
  );

  // Les 5 cartes de logos (positions X calculées pour être centrées).
  const cardXs = [101, 263, 425, 587, 749]; // x de chaque carte
  const partnerOrder = [
    LOGOS.devinci,
    LOGOS.altavo,
    LOGOS.darblockchain,
    LOGOS.hedera,
    LOGOS.lightency,
  ];
  const logoStrip = partnerOrder
    .map((logo, i) => logoCard(logo, cardXs[i], 650))
    .join("\n    ");

  return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 1000 800" font-family="Georgia, 'Times New Roman', serif">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#fdfbf5"/>
      <stop offset="1" stop-color="#f4eede"/>
    </linearGradient>
    <linearGradient id="ribbon" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#c9a24b"/>
      <stop offset="1" stop-color="#a5822f"/>
    </linearGradient>
  </defs>

  <rect width="1000" height="800" fill="url(#bg)"/>

  <!-- Bordures décoratives -->
  <rect x="26" y="26" width="948" height="748" fill="none" stroke="#c9a24b" stroke-width="3"/>
  <rect x="38" y="38" width="924" height="724" fill="none" stroke="#1a2340" stroke-width="1.2"/>

  <!-- Ornements de coins -->
  <g stroke="#c9a24b" stroke-width="2.5" fill="none">
    <path d="M60 90 L60 60 L90 60"/>
    <path d="M940 90 L940 60 L910 60"/>
    <path d="M60 710 L60 740 L90 740"/>
    <path d="M940 710 L940 740 L910 740"/>
  </g>

  <text x="500" y="128" text-anchor="middle" font-size="17" letter-spacing="7" fill="#a5822f">C E R T I F I C A T E</text>
  <text x="500" y="174" text-anchor="middle" font-size="40" letter-spacing="3" fill="#1a2340" font-weight="bold">OF COMPLETION</text>
  <line x1="430" y1="198" x2="570" y2="198" stroke="#c9a24b" stroke-width="2"/>

  <text x="500" y="252" text-anchor="middle" font-size="18" fill="#5c5646" font-style="italic">This certificate is proudly presented to</text>

  <text x="500" y="322" text-anchor="middle" font-size="54" fill="#1a2340" font-weight="bold">${name}</text>
  <line x1="270" y1="344" x2="730" y2="344" stroke="#c9a24b" stroke-width="1.5"/>

  <text x="500" y="398" text-anchor="middle" font-size="18" fill="#5c5646" font-style="italic">for successfully completing the course</text>
  <text x="500" y="438" text-anchor="middle" font-size="28" fill="#1a2340" font-weight="bold">${courseName}</text>

  <!-- Ligne signature / date -->
  <g fill="#1a2340">
    <line x1="150" y1="536" x2="380" y2="536" stroke="#8a856f" stroke-width="1"/>
    <text x="265" y="560" text-anchor="middle" font-size="15" fill="#5c5646">${issuerName}</text>
    <text x="265" y="580" text-anchor="middle" font-size="12" fill="#8a856f" letter-spacing="2">ISSUER</text>
    <line x1="620" y1="536" x2="850" y2="536" stroke="#8a856f" stroke-width="1"/>
    <text x="735" y="560" text-anchor="middle" font-size="15" fill="#5c5646">${dateStr}</text>
    <text x="735" y="580" text-anchor="middle" font-size="12" fill="#8a856f" letter-spacing="2">DATE</text>
  </g>

  <!-- Sceau -->
  <g transform="translate(500 530)">
    <circle r="48" fill="url(#ribbon)"/>
    <circle r="48" fill="none" stroke="#1a2340" stroke-width="1.5"/>
    <circle r="39" fill="none" stroke="#fdfbf5" stroke-width="1" opacity="0.7"/>
    <text y="-5" text-anchor="middle" font-size="11" fill="#fdfbf5" font-weight="bold" letter-spacing="1">HEDERA</text>
    <text y="11" text-anchor="middle" font-size="9" fill="#fdfbf5" letter-spacing="1">VERIFIED</text>
    <text y="25" text-anchor="middle" font-size="8" fill="#fdfbf5">NFT</text>
    <path d="M-12 40 L-17 60 L-6 54 L0 66 L6 54 L17 60 L12 40 Z" fill="url(#ribbon)" stroke="#1a2340" stroke-width="1"/>
  </g>

  <!-- Bande des partenaires -->
  <text x="500" y="632" text-anchor="middle" font-size="13" fill="#a5822f" font-style="italic" letter-spacing="1">In partnership with</text>
  <g>
    ${logoStrip}
  </g>

  <text x="500" y="744" text-anchor="middle" font-size="11" fill="#8a856f" letter-spacing="1">${footer}</text>
</svg>`;
}
