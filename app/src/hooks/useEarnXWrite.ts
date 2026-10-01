import { useState } from 'react';
import { useAccount, useConfig, useSwitchChain } from 'wagmi';
import { readContract, sendTransaction, waitForTransactionReceipt } from 'wagmi/actions';
import { useQueryClient } from '@tanstack/react-query';
import { BaseError, encodeFunctionData, erc20Abi, type Address, type Hex } from 'viem';
import { protocolAbi } from '../abi/earnx';
import { contractsFor, type SupportedChainId } from '../lib/chains';
import { useAccountSession } from './useAccountSession';

export type TxState = { status: 'idle' | 'pending' | 'success' | 'error'; hash?: Hex; error?: string; step?: string };

type Call = { to: Address; data: Hex };

/**
 * One way to send EarnX transactions, whichever account the user has: a passkey smart account
 * (calls are batched into one sponsored user operation) or a browser wallet (switches network
 * if needed, then sends each call and waits for it).
 */
export function useEarnXWrite() {
  const config = useConfig();
  const wallet = useAccount();
  const { switchChainAsync } = useSwitchChain();
  const { passkey } = useAccountSession();
  const queryClient = useQueryClient();
  const [state, setState] = useState<TxState>({ status: 'idle' });

  async function run(chainId: SupportedChainId, calls: Call[], label: string) {
    setState({ status: 'pending', step: label });
    try {
      let hash: Hex;
      if (passkey) {
        hash = await passkey.send(chainId, calls);
      } else {
        if (!wallet.address) throw new Error('Connect a wallet or sign in with a passkey first.');
        if (wallet.chainId !== chainId) await switchChainAsync({ chainId });
        hash = '0x';
        for (const [i, call] of calls.entries()) {
          if (calls.length > 1) setState({ status: 'pending', step: `${label} (${i + 1}/${calls.length})` });
          hash = await sendTransaction(config, { ...call, chainId });
          const receipt = await waitForTransactionReceipt(config, { hash, chainId });
          if (receipt.status !== 'success') throw new Error('The transaction reverted.');
        }
      }
      setState({ status: 'success', hash });
      await queryClient.invalidateQueries();
      return hash;
    } catch (e) {
      setState({ status: 'error', error: readableError(e) });
      throw e;
    }
  }

  /** Adds an ERC-20 approval in front of `call` when the current allowance is too low. */
  async function withApproval(chainId: SupportedChainId, token: Address, owner: Address, amount: bigint, call: Call) {
    const { protocol } = contractsFor(chainId);
    const allowance = await readContract(config, {
      address: token,
      abi: erc20Abi,
      functionName: 'allowance',
      args: [owner, protocol],
      chainId,
    });
    const calls: Call[] = [];
    if (allowance < amount) {
      calls.push({ to: token, data: encodeFunctionData({ abi: erc20Abi, functionName: 'approve', args: [protocol, amount] }) });
    }
    calls.push(call);
    return calls;
  }

  return { state, reset: () => setState({ status: 'idle' }), run, withApproval };
}

export function protocolCall<F extends Parameters<typeof encodeFunctionData<typeof protocolAbi>>[0]['functionName']>(
  chainId: SupportedChainId,
  functionName: F,
  args: readonly unknown[],
): Call {
  return {
    to: contractsFor(chainId).protocol,
    data: encodeFunctionData({ abi: protocolAbi, functionName, args } as never),
  };
}

const KNOWN_ERRORS: Record<string, string> = {
  SupplierCannotInvest: 'You submitted this invoice, so you cannot fund it yourself.',
  FundingClosed: 'The funding window for this invoice has closed.',
  BelowMinimum: 'The amount is below the minimum investment of 1 token.',
  NothingToClaim: 'There is nothing to claim yet.',
  InvalidDueDate: 'The due date must be between 7 and 365 days from today.',
  UnsupportedToken: 'That stablecoin is not supported on this network.',
  MissingField: 'Please fill in the buyer, the commodity and upload the documents.',
  WrongStatus: 'This invoice is not in the right state for that action.',
  NotAuthorized: 'Only the exporter or a verifier can do that right now.',
  ERC20InsufficientBalance: 'Your balance is too low. Get test tokens from the faucet first.',
};

export function readableError(e: unknown): string {
  const message = e instanceof BaseError ? e.shortMessage + ' ' + (e.details ?? '') : String((e as Error)?.message ?? e);
  for (const [name, text] of Object.entries(KNOWN_ERRORS)) if (message.includes(name)) return text;
  if (/User rejected|denied|NotAllowedError/i.test(message)) return 'You cancelled the request.';
  if (/sponsor|paymaster|policy/i.test(message)) return 'Gas sponsorship was refused. Try again with a wallet.';
  if (/insufficient funds/i.test(message)) return 'Your wallet needs a little testnet ETH for gas.';
  return e instanceof BaseError ? e.shortMessage : 'Something went wrong. Please try again.';
}
