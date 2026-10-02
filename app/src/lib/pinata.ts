/**
 * Server-side Pinata helpers. Records are pinned as JSON with searchable key-values, so signed buyer
 * statements and verification requests can be looked up by invoice or address without a database.
 */
const API = 'https://api.pinata.cloud';

export type Pin = { cid: string; date: string; keyvalues: Record<string, string> };

export async function pinJson(jwt: string, name: string, content: unknown, keyvalues: Record<string, string>): Promise<string> {
  const res = await fetch(`${API}/pinning/pinJSONToIPFS`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${jwt}`, 'content-type': 'application/json' },
    body: JSON.stringify({ pinataContent: content, pinataMetadata: { name, keyvalues }, pinataOptions: { cidVersion: 1 } }),
  });
  if (!res.ok) throw new Error(`Pinata responded ${res.status}`);
  return ((await res.json()) as { IpfsHash: string }).IpfsHash;
}

/** Pins whose key-values equal every entry of `match`, newest first. */
export async function findPins(jwt: string, match: Record<string, string>, limit = 100): Promise<Pin[]> {
  const filter = Object.fromEntries(Object.entries(match).map(([k, v]) => [k, { value: v, op: 'eq' }]));
  const url = `${API}/data/pinList?status=pinned&pageLimit=${limit}&metadata[keyvalues]=${encodeURIComponent(JSON.stringify(filter))}`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${jwt}` }, signal: AbortSignal.timeout(8_000) });
  if (!res.ok) throw new Error(`Pinata responded ${res.status}`);
  const { rows } = (await res.json()) as { rows: { ipfs_pin_hash: string; date_pinned: string; metadata: { keyvalues?: Record<string, string> } }[] };
  return rows
    .map((r) => ({ cid: r.ipfs_pin_hash, date: r.date_pinned, keyvalues: r.metadata.keyvalues ?? {} }))
    .sort((a, b) => b.date.localeCompare(a.date));
}
