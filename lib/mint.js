import crypto from "crypto";
import { TokenMintTransaction } from "@hashgraph/sdk";
import { renderCertificateSVG } from "@/lib/certificate";
import { ipfsEnabled, pinFile, pinJSON, gatewayUrl } from "@/lib/ipfs";
import { saveCert } from "@/lib/db";

// Mints one certificate NFT and returns its identifiers.
// Stores the metadata either on IPFS (if PINATA_JWT set) or in the app DB
// (served publicly by /api/metadata/[id] once deployed).
export async function mintCertificate({
  client,
  supplyKey,
  tokenId,
  baseUrl,
  student, // { name }
  course,
  issuer,
  date,
}) {
  const certId = crypto.randomBytes(8).toString("hex");
  const studentName = student.name;

  const buildMetadata = (image, type) => ({
    name: `${course} — ${studentName}`,
    creator: issuer,
    description: `Certificate of completion awarded to ${studentName} for successfully completing "${course}", issued by ${issuer} on ${date}.`,
    image,
    type,
    format: "HIP412@2.0.0",
    properties: {
      student: studentName,
      course,
      issuer,
      issueDate: date,
      tokenId,
    },
    attributes: [
      { trait_type: "Student", value: studentName },
      { trait_type: "Course", value: course },
      { trait_type: "Issuer", value: issuer },
      { trait_type: "Issue Date", value: date },
    ],
  });

  let metadataBytes;
  let metadata;
  let certificateUrl;
  let metadataUrl;

  if (ipfsEnabled()) {
    const svg = renderCertificateSVG({
      student: studentName,
      course,
      issuer,
      date,
      tokenId,
    });
    const imageCid = await pinFile(svg, `${certId}.svg`, "image/svg+xml");
    metadata = buildMetadata(`ipfs://${imageCid}`, "image/svg+xml");
    const metaCid = await pinJSON(metadata, `certificate-${certId}.json`);
    metadataBytes = Buffer.from(`ipfs://${metaCid}`);
    certificateUrl = gatewayUrl(imageCid);
    metadataUrl = gatewayUrl(metaCid);
  } else {
    metadata = buildMetadata(
      `${baseUrl}/api/certificate/${certId}`,
      "image/svg+xml"
    );
    await saveCert(certId, metadata);
    metadataBytes = Buffer.from(`${baseUrl}/api/metadata/${certId}`);
    certificateUrl = `${baseUrl}/api/certificate/${certId}`;
    metadataUrl = `${baseUrl}/api/metadata/${certId}`;
  }

  if (metadataBytes.length > 100) {
    throw new Error(
      `On-chain metadata pointer is ${metadataBytes.length} bytes (limit 100). Use a shorter base URL or enable IPFS.`
    );
  }

  const tx = await new TokenMintTransaction()
    .setTokenId(tokenId)
    .setMetadata([metadataBytes])
    .freezeWith(client);
  const signed = await tx.sign(supplyKey);
  const response = await signed.execute(client);
  const receipt = await response.getReceipt(client);
  const serial = receipt.serials[0].toString();

  // Record serial so the diploma footer can show it (DB-served mode).
  metadata.properties.serial = serial;
  if (!ipfsEnabled()) await saveCert(certId, metadata);

  return {
    certId,
    serial,
    metadataUrl,
    certificateUrl,
    transactionId: response.transactionId.toString(),
  };
}
