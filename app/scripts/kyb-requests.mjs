#!/usr/bin/env node
// Lists business verification requests, decrypted with KYB_ENCRYPTION_KEY, for the reviewer.
// Check each business against its national registry (in Nigeria, the CAC public search), then record
// the result on-chain with the cast command printed for each request: it grants VERIFIED_EXPORTER_ROLE,
// which raises that exporter's automated limit. Needs PINATA_JWT, PINATA_GATEWAY and KYB_ENCRYPTION_KEY,
// e.g. `set -a; source ../.env; set +a; node scripts/kyb-requests.mjs`.
import { createDecipheriv } from 'node:crypto';
import { keccak256, toBytes } from 'viem';
import deployments421614 from '../../contracts/deployments/421614.json' with { type: 'json' };
import deployments46630 from '../../contracts/deployments/46630.json' with { type: 'json' };

const { PINATA_JWT, PINATA_GATEWAY, KYB_ENCRYPTION_KEY } = process.env;
if (!PINATA_JWT || !KYB_ENCRYPTION_KEY) throw new Error('Set PINATA_JWT and KYB_ENCRYPTION_KEY.');
const ROLE = keccak256(toBytes('VERIFIED_EXPORTER_ROLE'));
const gateway = PINATA_GATEWAY ? `https://${PINATA_GATEWAY}/ipfs/` : 'https://gateway.pinata.cloud/ipfs/';

const filter = encodeURIComponent(JSON.stringify({ earnx: { value: 'kyb-request', op: 'eq' } }));
const res = await fetch(`https://api.pinata.cloud/data/pinList?status=pinned&pageLimit=100&metadata[keyvalues]=${filter}`, {
  headers: { Authorization: `Bearer ${PINATA_JWT}` },
});
const { rows } = await res.json();
if (rows.length === 0) console.log('No requests yet.');

for (const row of rows) {
  const record = await (await fetch(gateway + row.ipfs_pin_hash)).json();
  const decipher = createDecipheriv('aes-256-gcm', Buffer.from(KYB_ENCRYPTION_KEY, 'hex'), Buffer.from(record.iv, 'base64'));
  decipher.setAuthTag(Buffer.from(record.tag, 'base64'));
  const details = JSON.parse(Buffer.concat([decipher.update(Buffer.from(record.data, 'base64')), decipher.final()]).toString('utf8'));
  console.log(`\n${details.businessName} (${details.country}) · registration ${details.registrationNumber}`);
  console.log(`  contact ${details.contact} · requested ${details.requestedAt}`);
  console.log(`  exporter ${details.address}`);
  for (const [name, d, rpc] of [
    ['Robinhood Chain testnet', deployments46630, '$ROBINHOOD_TESTNET_RPC_URL'],
    ['Arbitrum Sepolia', deployments421614, '$ARBITRUM_SEPOLIA_RPC_URL'],
  ]) {
    console.log(`  verify on ${name}: cast send ${d.protocol} "grantRole(bytes32,address)" ${ROLE} ${details.address} --private-key $DEPLOYER_PRIVATE_KEY --rpc-url ${rpc}`);
  }
}
