// Pins files and JSON to IPFS via Pinata. Enabled when PINATA_JWT is set.

const PIN_FILE_URL = "https://api.pinata.cloud/pinning/pinFileToIPFS";
const PIN_JSON_URL = "https://api.pinata.cloud/pinning/pinJSONToIPFS";

export function ipfsEnabled() {
  return Boolean(process.env.PINATA_JWT);
}

function jwt() {
  const t = process.env.PINATA_JWT;
  if (!t) throw new Error("PINATA_JWT is not set.");
  return t;
}

// Public gateway used only for display links (on-chain we store ipfs://CID).
export function gatewayUrl(cid) {
  const base = (
    process.env.PINATA_GATEWAY || "https://gateway.pinata.cloud"
  ).replace(/\/$/, "");
  return `${base}/ipfs/${cid}`;
}

export async function pinFile(content, filename, contentType) {
  const form = new FormData();
  form.append("file", new Blob([content], { type: contentType }), filename);
  form.append("pinataMetadata", JSON.stringify({ name: filename }));

  const res = await fetch(PIN_FILE_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${jwt()}` },
    body: form,
  });
  if (!res.ok) {
    throw new Error(`Pinata file pin failed (${res.status}): ${await res.text()}`);
  }
  const data = await res.json();
  return data.IpfsHash;
}

export async function pinJSON(obj, name) {
  const res = await fetch(PIN_JSON_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${jwt()}`,
    },
    body: JSON.stringify({
      pinataContent: obj,
      pinataMetadata: { name },
    }),
  });
  if (!res.ok) {
    throw new Error(`Pinata JSON pin failed (${res.status}): ${await res.text()}`);
  }
  const data = await res.json();
  return data.IpfsHash;
}
