import { useReadContract } from 'wagmi';
import { invoiceNftAbi } from '../abi/earnx';
import { contractsFor, explorerUrl, type SupportedChainId } from '../lib/chains';

/** Renders the invoice NFT exactly as the chain returns it (on-chain JSON + SVG). */
export function NftPreview({ chainId, id }: { chainId: SupportedChainId; id: bigint }) {
  const { invoiceNFT } = contractsFor(chainId);
  const { data } = useReadContract({
    address: invoiceNFT,
    abi: invoiceNftAbi,
    functionName: 'tokenURI',
    args: [id],
    chainId,
    query: { retry: false },
  });
  if (!data) return null;
  let image = '';
  try {
    image = JSON.parse(atob(data.split(',')[1])).image;
  } catch {
    return null;
  }
  return (
    <a href={`${explorerUrl(chainId, 'token', invoiceNFT)}/instance/${id}`} target="_blank" rel="noreferrer" className="block">
      <img src={image} alt={`EarnX invoice NFT #${id}`} className="w-full rounded-2xl" />
    </a>
  );
}
