// ═══════════════════════════════════════════════════════════════════════════
//  lib/mint.js — LE CŒUR : comment on crée (mint) un certificat en NFT
// ═══════════════════════════════════════════════════════════════════════════
import crypto from "crypto"; // pour générer un identifiant unique aléatoire
import { TokenMintTransaction } from "@hashgraph/sdk"; // la transaction d'émission
import { renderCertificateSVG } from "@/lib/certificate"; // le dessin du diplôme
import { ipfsEnabled, pinFile, pinJSON, gatewayUrl } from "@/lib/ipfs"; // IPFS
import { saveCert } from "@/lib/db"; // stockage des métadonnées

/**
 * mintCertificate() : émet UN certificat NFT et renvoie ses identifiants.
 * Les métadonnées sont stockées soit sur IPFS (si PINATA_JWT est défini),
 * soit dans la base de l'app (servies via /api/metadata/[id] en ligne).
 */
export async function mintCertificate({
  client, // le client Hedera (qui signe et envoie)
  supplyKey, // la clé qui a le droit d'émettre des NFT
  tokenId, // l'identifiant de la collection (ex: 0.0.9394237)
  baseUrl, // l'adresse publique de l'app
  student, // l'étudiant { name }
  course, // le nom du cours
  issuer, // l'émetteur (l'académie)
  date, // la date
}) {
  // Un identifiant unique (16 caractères hexadécimaux) pour ce certificat.
  // Il joue le même rôle qu'un CID IPFS : il est indépendant du numéro de série.
  const certId = crypto.randomBytes(8).toString("hex");
  const studentName = student.name;

  // Petite fonction qui construit l'objet de métadonnées au format HIP-412.
  // (image = le lien vers l'image, type = le type MIME de l'image)
  const buildMetadata = (image, type) => ({
    name: `${course} — ${studentName}`, // le nom affiché du NFT
    creator: issuer,
    description: `This certificate is proudly presented to ${studentName} in recognition of their engagement and active participation in the exclusive ${course} offered to the students of the Master of Management in Information Systems at EMLV, Pôle Léonard de Vinci, Paris, France from February to May 2026. This program was generously sponsored by Dar Blockchain, Lightency and Altavo Partners.`,
    image, // lien vers l'image (ipfs:// ou https://)
    type, // ex: image/svg+xml
    format: "HIP412@2.0.0", // le standard de métadonnées NFT d'Hedera
    properties: {
      // propriétés libres du certificat
      student: studentName,
      course,
      issuer,
      issueDate: date,
      tokenId,
    },
    attributes: [
      // attributs "clé/valeur" affichés par les portefeuilles
      { trait_type: "Student", value: studentName },
      { trait_type: "Course", value: course },
      { trait_type: "Issuer", value: issuer },
      { trait_type: "Issue Date", value: date },
    ],
  });

  // Variables qu'on remplit selon le mode (IPFS ou app).
  let metadataBytes; // ce qu'on écrit RÉELLEMENT sur la blockchain (le pointeur)
  let metadata; // l'objet métadonnées complet
  let certificateUrl; // lien d'affichage de l'image
  let metadataUrl; // lien d'affichage du JSON

  // ─── MODE 1 : IPFS activé (on épingle image + JSON sur Pinata) ───
  if (ipfsEnabled()) {
    // 1) On génère l'image SVG du diplôme personnalisée.
    const svg = renderCertificateSVG({
      student: studentName,
      course,
      issuer,
      date,
      tokenId,
    });
    // 2) On épingle l'image sur IPFS → on récupère son CID.
    const imageCid = await pinFile(svg, `${certId}.svg`, "image/svg+xml");
    // 3) On construit les métadonnées en pointant l'image via ipfs://
    metadata = buildMetadata(`ipfs://${imageCid}`, "image/svg+xml");
    // 4) On épingle le JSON des métadonnées → on récupère son CID.
    const metaCid = await pinJSON(metadata, `certificate-${certId}.json`);
    // 5) Ce qu'on écrit sur la blockchain = le lien ipfs:// vers ce JSON.
    metadataBytes = Buffer.from(`ipfs://${metaCid}`);
    // Liens d'affichage (via une passerelle IPFS lisible dans un navigateur).
    certificateUrl = gatewayUrl(imageCid);
    metadataUrl = gatewayUrl(metaCid);
  } else {
    // ─── MODE 2 : sans IPFS (l'app sert elle-même l'image et le JSON) ───
    metadata = buildMetadata(
      `${baseUrl}/api/certificate/${certId}`, // image servie par l'app
      "image/svg+xml"
    );
    // On enregistre les métadonnées dans notre base de données.
    await saveCert(certId, metadata);
    // Sur la blockchain on écrit le lien https vers notre route metadata.
    metadataBytes = Buffer.from(`${baseUrl}/api/metadata/${certId}`);
    certificateUrl = `${baseUrl}/api/certificate/${certId}`;
    metadataUrl = `${baseUrl}/api/metadata/${certId}`;
  }

  // Sécurité : Hedera limite le champ métadonnées d'un NFT à 100 octets.
  if (metadataBytes.length > 100) {
    throw new Error(
      `On-chain metadata pointer is ${metadataBytes.length} bytes (limit 100). Use a shorter base URL or enable IPFS.`
    );
  }

  // ─── L'ÉMISSION (mint) proprement dite ───
  const tx = await new TokenMintTransaction() // on prépare la transaction d'émission
    .setTokenId(tokenId) // dans quelle collection
    .setMetadata([metadataBytes]) // avec quel pointeur de métadonnées
    .freezeWith(client); // on "gèle" la transaction pour la signer
  const signed = await tx.sign(supplyKey); // on signe avec la clé de supply
  const response = await signed.execute(client); // on l'envoie au réseau
  const receipt = await response.getReceipt(client); // on attend le reçu
  const serial = receipt.serials[0].toString(); // le numéro de série créé !

  // On enregistre le numéro de série pour que le pied de page du diplôme
  // puisse l'afficher (utile en mode "servi par l'app").
  metadata.properties.serial = serial;
  if (!ipfsEnabled()) await saveCert(certId, metadata);

  // On renvoie tout ce dont l'appelant a besoin.
  return {
    certId,
    serial,
    metadataUrl,
    certificateUrl,
    transactionId: response.transactionId.toString(),
  };
}
