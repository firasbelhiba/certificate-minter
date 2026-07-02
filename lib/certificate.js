// Shared certificate renderer — produces a self-contained SVG diploma.
// Used by the on-chain image endpoint and the live preview endpoint.

function esc(s) {
  return String(s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// Trim overly long text so it stays on one line.
function clamp(s, max) {
  s = String(s || "");
  return s.length > max ? s.slice(0, max - 1) + "…" : s;
}

export function renderCertificateSVG({
  student,
  course,
  issuer,
  date,
  tokenId,
  serial,
}) {
  const name = esc(clamp(student || "Student Name", 34));
  const courseName = esc(clamp(course || "Course Name", 46));
  const issuerName = esc(clamp(issuer || "Academy", 30));
  const dateStr = esc(clamp(date || "", 24));
  const footer = esc(
    [
      tokenId ? `Token ${tokenId}` : null,
      serial ? `Serial #${serial}` : null,
      "Hedera Testnet",
    ]
      .filter(Boolean)
      .join("   ·   ")
  );

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 700" font-family="Georgia, 'Times New Roman', serif">
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

  <rect width="1000" height="700" fill="url(#bg)"/>

  <!-- Decorative borders -->
  <rect x="26" y="26" width="948" height="648" fill="none" stroke="#c9a24b" stroke-width="3"/>
  <rect x="38" y="38" width="924" height="624" fill="none" stroke="#1a2340" stroke-width="1.2"/>

  <!-- Corner flourishes -->
  <g stroke="#c9a24b" stroke-width="2.5" fill="none">
    <path d="M60 90 L60 60 L90 60"/>
    <path d="M940 90 L940 60 L910 60"/>
    <path d="M60 610 L60 640 L90 640"/>
    <path d="M940 610 L940 640 L910 640"/>
  </g>

  <text x="500" y="130" text-anchor="middle" font-size="17" letter-spacing="7" fill="#a5822f">C E R T I F I C A T E</text>
  <text x="500" y="176" text-anchor="middle" font-size="40" letter-spacing="3" fill="#1a2340" font-weight="bold">OF COMPLETION</text>

  <line x1="430" y1="200" x2="570" y2="200" stroke="#c9a24b" stroke-width="2"/>

  <text x="500" y="258" text-anchor="middle" font-size="18" fill="#5c5646" font-style="italic">This certificate is proudly presented to</text>

  <text x="500" y="330" text-anchor="middle" font-size="56" fill="#1a2340" font-weight="bold">${name}</text>
  <line x1="250" y1="352" x2="750" y2="352" stroke="#c9a24b" stroke-width="1.5"/>

  <text x="500" y="408" text-anchor="middle" font-size="18" fill="#5c5646" font-style="italic">for successfully completing the course</text>
  <text x="500" y="450" text-anchor="middle" font-size="30" fill="#1a2340" font-weight="bold">${courseName}</text>

  <!-- Signature / date row -->
  <g fill="#1a2340" font-size="17">
    <line x1="150" y1="560" x2="380" y2="560" stroke="#8a856f" stroke-width="1"/>
    <text x="265" y="585" text-anchor="middle" font-size="15" fill="#5c5646">${issuerName}</text>
    <text x="265" y="606" text-anchor="middle" font-size="12" fill="#8a856f" letter-spacing="2">ISSUER</text>

    <line x1="620" y1="560" x2="850" y2="560" stroke="#8a856f" stroke-width="1"/>
    <text x="735" y="585" text-anchor="middle" font-size="15" fill="#5c5646">${dateStr}</text>
    <text x="735" y="606" text-anchor="middle" font-size="12" fill="#8a856f" letter-spacing="2">DATE</text>
  </g>

  <!-- Seal -->
  <g transform="translate(500 555)">
    <circle r="52" fill="url(#ribbon)"/>
    <circle r="52" fill="none" stroke="#1a2340" stroke-width="1.5"/>
    <circle r="42" fill="none" stroke="#fdfbf5" stroke-width="1" opacity="0.7"/>
    <text y="-6" text-anchor="middle" font-size="12" fill="#fdfbf5" font-weight="bold" letter-spacing="1">HEDERA</text>
    <text y="12" text-anchor="middle" font-size="10" fill="#fdfbf5" letter-spacing="1">VERIFIED</text>
    <text y="28" text-anchor="middle" font-size="9" fill="#fdfbf5">NFT</text>
    <path d="M-14 44 L-22 74 L-8 66 L0 82 L8 66 L22 74 L14 44 Z" fill="url(#ribbon)" stroke="#1a2340" stroke-width="1"/>
  </g>

  <text x="500" y="666" text-anchor="middle" font-size="12" fill="#8a856f" letter-spacing="1">${footer}</text>
</svg>`;
}
