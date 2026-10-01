import {
  createKernelAccount,
  createKernelAccountClient,
  createZeroDevPaymasterClient,
} from '@zerodev/sdk';
import { getEntryPoint, KERNEL_V3_1 } from '@zerodev/sdk/constants';
import {
  PasskeyValidatorContractVersion,
  toPasskeyValidator,
  toWebAuthnKey,
  WebAuthnMode,
} from '@zerodev/passkey-validator';
import { createPublicClient, http, type Address, type Hex } from 'viem';
import { chainById, rpcUrl, type SupportedChainId } from './chains';

/**
 * Passkey smart accounts (ZeroDev Kernel v3.1, ERC-4337 EntryPoint v0.7). An exporter signs in with
 * Face ID / fingerprint, gets the same account address on every chain, and ZeroDev's paymaster
 * sponsors the gas, so nobody needs a browser wallet or ETH to submit an invoice.
 */
const projectId = import.meta.env.VITE_ZERODEV_PROJECT_ID as string | undefined;
const entryPoint = getEntryPoint('0.7');
const passkeyServerUrl = `https://passkeys.zerodev.app/api/v3/${projectId}`;

type WebAuthnKey = Awaited<ReturnType<typeof toWebAuthnKey>>;
type KernelClient = Awaited<ReturnType<typeof buildClient>>;

export async function passkeyLogin(mode: 'register' | 'login', name: string): Promise<WebAuthnKey> {
  return toWebAuthnKey({
    passkeyName: name,
    passkeyServerUrl,
    mode: mode === 'register' ? WebAuthnMode.Register : WebAuthnMode.Login,
    passkeyServerHeaders: {},
    rpID: window.location.hostname,
  });
}

async function buildClient(chainId: SupportedChainId, webAuthnKey: WebAuthnKey) {
  const chain = chainById(chainId)!;
  const publicClient = createPublicClient({ chain, transport: http(rpcUrl[chainId]) });
  const validator = await toPasskeyValidator(publicClient, {
    webAuthnKey,
    entryPoint,
    kernelVersion: KERNEL_V3_1,
    validatorContractVersion: PasskeyValidatorContractVersion.V0_0_3_PATCHED,
  });
  const account = await createKernelAccount(publicClient, {
    plugins: { sudo: validator },
    entryPoint,
    kernelVersion: KERNEL_V3_1,
  });
  const zerodevRpc = `https://rpc.zerodev.app/api/v3/${projectId}/chain/${chainId}`;
  const paymaster = createZeroDevPaymasterClient({ chain, transport: http(zerodevRpc) });
  return createKernelAccountClient({
    account,
    chain,
    client: publicClient,
    bundlerTransport: http(zerodevRpc),
    paymaster: {
      getPaymasterData: (userOperation) => paymaster.sponsorUserOperation({ userOperation }),
    },
  });
}

export class PasskeySession {
  private clients = new Map<SupportedChainId, Promise<KernelClient>>();

  private constructor(
    private readonly webAuthnKey: WebAuthnKey,
    readonly address: Address,
    readonly name: string,
  ) {}

  static async start(mode: 'register' | 'login', name: string, chainId: SupportedChainId) {
    const key = await passkeyLogin(mode, name);
    const client = await buildClient(chainId, key);
    const session = new PasskeySession(key, client.account.address, name);
    session.clients.set(chainId, Promise.resolve(client));
    return session;
  }

  private client(chainId: SupportedChainId) {
    let c = this.clients.get(chainId);
    if (!c) {
      c = buildClient(chainId, this.webAuthnKey);
      this.clients.set(chainId, c);
    }
    return c;
  }

  /** Sends one sponsored user operation containing all calls (e.g. approve + invest) and returns the tx hash. */
  async send(chainId: SupportedChainId, calls: { to: Address; data: Hex }[]): Promise<Hex> {
    const client = await this.client(chainId);
    const userOpHash = await client.sendUserOperation({
      callData: await client.account.encodeCalls(calls.map((c) => ({ ...c, value: 0n }))),
    });
    const receipt = await client.waitForUserOperationReceipt({ hash: userOpHash });
    if (!receipt.success) throw new Error('The transaction was included but reverted.');
    return receipt.receipt.transactionHash;
  }
}
