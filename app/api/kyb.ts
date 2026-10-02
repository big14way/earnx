import { createCipheriv, randomBytes } from 'node:crypto';
import { isAddress } from 'viem';
import { findPins, pinJson } from '../src/lib/pinata.js';

/**
 * Business verification requests. An exporter sends their registered business details; the request is
 * encrypted (AES-256-GCM, key held only by EarnX) before it is pinned, so no personal data is ever
 * public. A reviewer checks the business against the national registry and, if it checks out, grants
 * VERIFIED_EXPORTER_ROLE to the exporter's address on-chain, which raises their automated limit.
 *
 * GET  ?address=   whether a request is on file
 * POST { address, businessName, country, registrationNumber, contact }
 */
export async function GET(request: Request) {
  const jwt = process.env.PINATA_JWT;
  if (!jwt) return Response.json({ error: 'Verification requests are not configured.' }, { status: 503 });
  const address = new URL(request.url).searchParams.get('address') ?? '';
  if (!isAddress(address)) return Response.json({ error: 'Send ?address=0x…' }, { status: 400 });
  const [pin] = await findPins(jwt, { earnx: 'kyb-request', address: address.toLowerCase() }, 1);
  return Response.json({ requested: Boolean(pin), requestedAt: pin?.keyvalues.requestedAt ?? null });
}

export async function POST(request: Request) {
  const jwt = process.env.PINATA_JWT;
  const keyHex = process.env.KYB_ENCRYPTION_KEY;
  if (!jwt || !keyHex || keyHex.length !== 64) return Response.json({ error: 'Verification requests are not configured.' }, { status: 503 });
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const field = (k: string, max: number) => String(body[k] ?? '').trim().slice(0, max);
  const address = field('address', 42);
  const details = {
    businessName: field('businessName', 120),
    country: field('country', 60),
    registrationNumber: field('registrationNumber', 60),
    contact: field('contact', 120),
  };
  if (!isAddress(address) || details.businessName.length < 2 || details.country.length < 2 || details.registrationNumber.length < 3 || details.contact.length < 5) {
    return Response.json({ error: 'Fill in the business name, country, registration number and a contact.' }, { status: 400 });
  }
  const [existing] = await findPins(jwt, { earnx: 'kyb-request', address: address.toLowerCase() }, 1);
  if (existing) return Response.json({ requested: true, requestedAt: existing.keyvalues.requestedAt });

  const requestedAt = new Date().toISOString();
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', Buffer.from(keyHex, 'hex'), iv);
  const data = Buffer.concat([cipher.update(JSON.stringify({ address, ...details, requestedAt }), 'utf8'), cipher.final()]);
  await pinJson(
    jwt,
    `earnx-kyb-request-${address.toLowerCase()}`,
    { app: 'EarnX', kind: 'kyb-request', version: 1, alg: 'aes-256-gcm', iv: iv.toString('base64'), tag: cipher.getAuthTag().toString('base64'), data: data.toString('base64') },
    { earnx: 'kyb-request', address: address.toLowerCase(), requestedAt },
  );
  return Response.json({ requested: true, requestedAt });
}
