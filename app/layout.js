// ═══════════════════════════════════════════════════════════════════════════
//  app/layout.js — La "mise en page" racine de toute l'application Next.js
//  Elle enveloppe TOUTES les pages (la page étudiant et la page admin).
// ═══════════════════════════════════════════════════════════════════════════
import "./globals.css"; // les styles CSS globaux de l'application

// metadata : le titre et la description affichés dans l'onglet du navigateur.
export const metadata = {
  title: "Hedera Course Certificates",
  description: "Mint end-of-course certificates as NFTs on Hedera",
};

// RootLayout : le composant racine. `children` = le contenu de la page affichée.
export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
