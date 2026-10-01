import { useState } from 'react';
import { keccak256, type Hex } from 'viem';
import { sampleDocs } from '../abi/earnx';

const REPO_RAW = 'https://raw.githubusercontent.com/big14way/earnx/main/';
const REPO_BLOB = 'https://github.com/big14way/earnx/blob/main/';
export const IPFS_GATEWAY = `https://${(import.meta.env.VITE_IPFS_GATEWAY as string | undefined) ?? 'ipfs.io'}/ipfs/`;

/** Fetches the invoice's document bundle and checks it against the hash stored on-chain. */
export function DocumentCheck({ docsHash, docsCID }: { docsHash: Hex; docsCID: string }) {
  const [result, setResult] = useState<'idle' | 'checking' | 'match' | 'mismatch' | 'unavailable'>('idle');
  const samplePath = sampleDocs[docsHash];
  const viewUrl = docsCID ? `${IPFS_GATEWAY}${docsCID}` : samplePath ? REPO_BLOB + samplePath : undefined;
  const fetchUrl = docsCID ? `${IPFS_GATEWAY}${docsCID}` : samplePath ? REPO_RAW + samplePath : undefined;

  async function check() {
    if (!fetchUrl) return setResult('unavailable');
    setResult('checking');
    try {
      const res = await fetch(fetchUrl);
      if (!res.ok) throw new Error(String(res.status));
      const bytes = new Uint8Array(await res.arrayBuffer());
      setResult(keccak256(bytes) === docsHash ? 'match' : 'mismatch');
    } catch {
      setResult('unavailable');
    }
  }

  return (
    <div>
      <div className="break-all font-mono text-xs text-muted">{docsHash}</div>
      <div className="mt-3 flex flex-wrap items-center gap-3 text-sm">
        {viewUrl && (
          <a href={viewUrl} target="_blank" rel="noreferrer" className="font-semibold text-leaf underline">
            {docsCID ? 'Open on IPFS' : 'Open sample document'}
          </a>
        )}
        {fetchUrl && (
          <button onClick={check} className="rounded-full border border-line px-3 py-1 font-semibold hover:border-ink">
            Check the documents
          </button>
        )}
        {result === 'checking' && <span className="text-muted">Hashing in your browser…</span>}
        {result === 'match' && <span className="font-semibold text-leaf">✓ Matches the hash on-chain</span>}
        {result === 'mismatch' && <span className="font-semibold text-clay">✗ Does not match the hash on-chain</span>}
        {result === 'unavailable' && <span className="text-muted">Document not reachable right now</span>}
      </div>
    </div>
  );
}
