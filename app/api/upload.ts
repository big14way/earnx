import { keccak256, toBytes } from 'viem';

/**
 * Pins an exporter's documents to IPFS through Pinata and returns the CID and keccak256 of a
 * manifest listing every file and its own hash. The manifest hash is what goes on-chain as the
 * invoice's docsHash, so any change to any file is detectable. The Pinata key never reaches the browser.
 */
const MAX_FILES = 5;
const MAX_TOTAL_BYTES = 4 * 1024 * 1024; // stay under the serverless request limit
const ALLOWED = ['application/pdf', 'image/png', 'image/jpeg', 'image/webp'];

export async function POST(request: Request) {
  const jwt = process.env.PINATA_JWT;
  if (!jwt) return Response.json({ error: 'Uploads are not configured.' }, { status: 503 });

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return Response.json({ error: 'Send the documents as multipart form data.' }, { status: 400 });
  }
  const files = form.getAll('files').filter((f): f is File => f instanceof File);
  if (files.length === 0) return Response.json({ error: 'Attach at least one document.' }, { status: 400 });
  if (files.length > MAX_FILES) return Response.json({ error: `Attach at most ${MAX_FILES} documents.` }, { status: 400 });
  if (files.reduce((n, f) => n + f.size, 0) > MAX_TOTAL_BYTES) {
    return Response.json({ error: 'Documents must be 4 MB or less in total.' }, { status: 400 });
  }
  const bad = files.find((f) => !ALLOWED.includes(f.type));
  if (bad) return Response.json({ error: `${bad.name}: only PDF, PNG, JPG or WEBP files are accepted.` }, { status: 400 });

  // Optional trade details. They are part of the manifest, so they are covered by the on-chain hash.
  const quantity = Number(form.get('quantity'));
  const unitPriceUsd = Number(form.get('unitPrice'));
  const unit = form.get('unit') === 'kg' ? 'kg' : 't';
  const incoterms = String(form.get('incoterms') ?? '').slice(0, 40) || undefined;
  const trade = quantity > 0 && unitPriceUsd > 0 ? { quantity, unit, unitPriceUsd, incoterms } : undefined;

  try {
    const entries = [];
    for (const file of files) {
      const bytes = new Uint8Array(await file.arrayBuffer());
      const cid = await pin(jwt, new Blob([bytes], { type: file.type }), file.name);
      entries.push({ name: file.name, type: file.type, size: file.size, cid, keccak256: keccak256(bytes) });
    }
    const manifest = JSON.stringify({ app: 'EarnX', version: 1, createdAt: new Date().toISOString(), trade, files: entries }, null, 2);
    const cid = await pin(jwt, new Blob([manifest], { type: 'application/json' }), 'earnx-documents.json');
    return Response.json({ cid, docsHash: keccak256(toBytes(manifest)), files: entries, trade });
  } catch (e) {
    return Response.json({ error: `IPFS upload failed: ${(e as Error).message}` }, { status: 502 });
  }
}

async function pin(jwt: string, blob: Blob, name: string): Promise<string> {
  const body = new FormData();
  body.append('file', blob, name);
  // A "/" in the name makes Pinata wrap the file in a directory, which changes what the CID serves.
  body.append('pinataMetadata', JSON.stringify({ name: `earnx-${name.replace(/[\\/]/g, '-')}` }));
  body.append('pinataOptions', JSON.stringify({ cidVersion: 1 }));
  const res = await fetch('https://api.pinata.cloud/pinning/pinFileToIPFS', {
    method: 'POST',
    headers: { Authorization: `Bearer ${jwt}` },
    body,
  });
  if (!res.ok) throw new Error(`Pinata responded ${res.status}`);
  return ((await res.json()) as { IpfsHash: string }).IpfsHash;
}
