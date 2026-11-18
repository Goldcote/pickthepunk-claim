// Types for TypeScript readers of src/index.js (the code itself is plain JavaScript: no build step).

// ---- eth.js
export function hexToBytes(hex: string): Uint8Array;
export function bytesToHex(b: Uint8Array): string;
export function keccak(data: Uint8Array | string): Uint8Array;
export function isAddress(s: unknown): s is string;
export function checksum(address: string): string;
export function personalHash(message: string): Uint8Array;
export function recoverSigner(hash: Uint8Array, signature: string): string | null;
export function selector(signature: string): string;
export function encAddress(a: string): string;
export function encUint(n: bigint | number): string;
export function encBytes32(hex: string): string;
export function callData(sig: string, args: { s?: string; bytes?: string }[]): string;
export function decodeAddress(hex: string): string | null;
export function decodeBool(hex: string): boolean;
export function ethOf(wei: bigint): string;

// ---- chain.js
export const PUNKS: string;
export const WRAPPED_PUNKS: string;
export const PUNKS_721: string;
export const WRAPPERS: string[];
export const GOLDCOTE: string;
export const DELEGATE_V2: string;
export const DELEGATE_V1: string;
export const PUBLIC_NODES: string[];
export class ChainError extends Error {}
export type Rpc = (method: string, params: unknown[]) => Promise<any>;
export function nodeRpc(nodes?: string[], o?: { timeout?: number }): Rpc;
export type Via = 'owner' | 'delegate-v2' | 'delegate-v1';
export function ownerOf(rpc: Rpc, id: number): Promise<string>;
export function holderOf(rpc: Rpc, id: number): Promise<{ holder: string; contract: string }>;
export function delegateOf(rpc: Rpc, wallet: string, holder: string, id: number, contract?: string): Promise<'delegate-v2' | 'delegate-v1' | null>;
export function holds(rpc: Rpc, wallet: string, id: number): Promise<{ holder: string; via: Via | null; contract: string }>;
export function contractAccepts(rpc: Rpc, wallet: string, hash: Uint8Array, signature: string): Promise<boolean>;
export function latestBlock(rpc: Rpc): Promise<number>;
export function blockTime(rpc: Rpc, block: number): Promise<number>;
export interface Transfer { hash: string; from: string; to: string; value: bigint; block: number; ok?: boolean }
export function transfersTo(rpc: Rpc, to: string, first: number, last: number): Promise<Transfer[]>;
export function transferByHash(rpc: Rpc, hash: string): Promise<Transfer | null>;

// ---- claim.js
export const SIGN_MS: number;
export const PAY_MS: number;
export function statement(authority: string, id: number): string;
export function signMessage(o: { authority: string; uri: string; wallet: string; id: number; nonce: string; issued: number; expires: number }): string;
export interface SignIn { authority: string; address: string; statement: string; uri?: string; version?: string; chainId?: string; nonce?: string; issuedAt?: string; expirationTime?: string; lines: number }
export function readMessage(message: string): SignIn | null;
export function messageProblems(message: string, o: { id: number; wallet: string; hosts?: RegExp }): string[];
export function signedBy(rpc: Rpc, wallet: string, message: string, signature: string): Promise<boolean>;
export const CODES: number[];
export function codeWei(k: number): bigint;
export function codeEth(wei: bigint | string): string;
export function carriesCode(t: Transfer, c: { amountWei: string | null; fromBlock: number | null }): boolean;
export const WALLET_REQUESTS: { method: string; words: string }[];
export function stopSigns(host?: string): string[];

// ---- howwecheck.js, index.js
export const REPO: string;
export function howWeCheckMd(o?: { example?: string; authority?: string; origin?: string }): string;
export const VERSION: string;

// ---- check.js (bin/check.js)
export function proofUrl(target: string): string | null;
export function checkProof(target: string, o?: { rpc?: Rpc; hosts?: RegExp }): Promise<{ ok: boolean; lines: string[] }>;
