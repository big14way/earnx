/**
 * Browser shims for libraries written for Node. The ZeroDev passkey SDK parses the new passkey's
 * public key with Node's Buffer, which browsers don't have.
 */
import { Buffer } from 'buffer';

const g = globalThis as unknown as { Buffer?: typeof Buffer };
if (!g.Buffer) g.Buffer = Buffer;
