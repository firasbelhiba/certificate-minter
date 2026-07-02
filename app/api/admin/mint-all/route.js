// ═══════════════════════════════════════════════════════════════════════════
//  app/api/admin/mint-all/route.js — Émettre les certificats de TOUTE la classe
//  Traité par LOTS de 5 en parallèle pour ne pas dépasser le temps limite de
//  Vercel. Le tableau de bord rappelle cette route jusqu'à ce qu'il ne reste
//  plus personne à traiter (remaining = 0) → ce qui alimente la barre de progression.
// ═══════════════════════════════════════════════════════════════════════════
import { NextResponse } from "next/server";
import { checkAdmin } from "@/lib/auth"; // vérifie le mot de passe formateur
import { listStudents, patchStudent } from "@/lib/db";
import { getClient, getOperatorKey, getBaseUrl } from "@/lib/hedera";
import { mintCertificate } from "@/lib/mint"; // la fonction d'émission d'un NFT

export const runtime = "nodejs"; // s'exécute côté serveur
export const maxDuration = 300; // durée max autorisée (en secondes)

// POST /api/admin/mint-all : émet un certificat pour chaque étudiant "registered".
export async function POST(req) {
  // Sécurité : seul le formateur (bon mot de passe) peut émettre.
  if (!checkAdmin(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // La collection dans laquelle on émet.
  const tokenId = process.env.HEDERA_TOKEN_ID;
  if (!tokenId) {
    return NextResponse.json(
      { error: "HEDERA_TOKEN_ID is not set on the server." },
      { status: 400 }
    );
  }

  // On lit les infos du cours envoyées par le formulaire admin.
  const body = await req.json().catch(() => ({}));
  const course = (body.course || "Course Completion").trim();
  const issuer = (body.issuer || "Academy").trim();
  const date = (body.date || new Date().toISOString().slice(0, 10)).trim();

  // L'adresse publique de l'app (pour les liens de métadonnées).
  const baseUrl = getBaseUrl(req);

  // Le client Hedera + la clé qui a le droit d'émettre.
  const client = getClient();
  const supplyKey = getOperatorKey();

  // On récupère tous les étudiants, et on garde ceux pas encore traités.
  const all = await listStudents();
  const pending = all.filter((s) => s.status === "registered");

  // On traite un LOT borné en parallèle (5 à la fois). L'interface rappellera
  // cette route en boucle jusqu'à ce que remaining = 0.
  const BATCH = 5;
  const batch = pending.slice(0, BATCH); // les 5 premiers en attente

  // Promise.all = on lance les 5 émissions en même temps et on attend tout.
  const results = await Promise.all(
    batch.map(async (student) => {
      try {
        // On émet le certificat de cet étudiant (crée le NFT dans la trésorerie).
        const r = await mintCertificate({
          client,
          supplyKey,
          tokenId,
          baseUrl,
          student,
          course,
          issuer,
          date,
        });
        // On met à jour son statut : "minted" (émis) + on garde son numéro de série.
        await patchStudent(student.accountId, {
          status: "minted",
          certId: r.certId,
          serial: r.serial,
          course,
        });
        // Ligne de résultat en cas de succès (affichée dans la barre de progression).
        return { accountId: student.accountId, name: student.name, serial: r.serial, ok: true };
      } catch (err) {
        // En cas d'échec pour cet étudiant, on note l'erreur mais on continue.
        console.error("mint-all error for", student.accountId, err);
        return { accountId: student.accountId, name: student.name, ok: false, error: err.message };
      }
    })
  );

  // On compte les succès et on renvoie le nombre restant (remaining).
  const minted = results.filter((r) => r.ok).length;
  return NextResponse.json({
    minted, // combien émis dans ce lot
    failed: results.filter((r) => !r.ok).length, // combien en échec
    remaining: Math.max(0, pending.length - batch.length), // combien il reste après ce lot
    results, // le détail par étudiant (pour la barre de progression)
  });
}
