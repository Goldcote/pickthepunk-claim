// Making a punk's page yours on pickthepunk.com. The holder proves it in one of two ways, both from the wallet that
// holds the punk (itself, or through a wrapper: ./chain.js) or from a wallet it delegated to on delegate.xyz:
//
//   way 1, sign:  their wallet signs a Sign-In with Ethereum message (EIP-4361) that names the page's address, the
//                 punk, the wallet and a code used once, good for ten minutes. It is plain text, signed with
//                 personal_sign (EIP-191): never a transaction, an approval, an order or a permit.
//   way 2, pay:   they connect nothing and send an exact tiny amount, the claim's code (0.0000101 to 0.0000999 ETH), to
//                 goldcote.eth within the hour, from the wallet that holds the punk or its delegate.
//
// This file holds the message, the codes, the checks a proof has to pass, and the rules people are shown: what the
// claim page asks a wallet for, and what should make them stop. The server keeps its own records; the checks are these.

import { contractAccepts, GOLDCOTE } from './chain.js';
import { checksum, ethOf, isAddress, personalHash, recoverSigner } from './eth.js';

export const SIGN_MS = 10 * 60_000, PAY_MS = 60 * 60_000;

// ---- way 1: the message -------------------------------------------------------------------------------------------------
/** The sentence the wallet shows as what you agree to. Our promise is part of what you sign.
 *  @param {string} authority the page's address, e.g. 1234.pickthepunk.com @param {number} id */
export const statement = (authority, id) => `Claim ${authority} for CryptoPunk #${id}. A signature only: no transaction, no gas, no approval.`;

/** The message their wallet shows and signs: Sign-In with Ethereum (EIP-4361), so wallets name the site asking and
 *  warn when the page asking is not at the address it names.
 *  @param {{ authority: string; uri: string; wallet: string; id: number; nonce: string; issued: number; expires: number }} o */
export function signMessage(o) {
  return [
    `${o.authority} wants you to sign in with your Ethereum account:`, checksum(o.wallet), '',
    statement(o.authority, o.id), '',
    `URI: ${o.uri}`, 'Version: 1', 'Chain ID: 1', `Nonce: ${o.nonce}`, `Issued At: ${new Date(o.issued).toISOString()}`, `Expiration Time: ${new Date(o.expires).toISOString()}`,
  ].join('\n');
}

/** A sign-in message's parts (EIP-4361, the lines signMessage writes), or null when it is not one.
 *  @param {string} message */
export function readMessage(message) {
  const lines = String(message).split('\n');
  const first = /^(\S+) wants you to sign in with your Ethereum account:$/.exec(lines[0] ?? '');
  if (!first || !isAddress(lines[1]) || lines[2] !== '' || lines[4] !== '') return null;
  /** @type {Record<string, string>} */
  const f = {};
  for (const l of lines.slice(5)) {
    const i = l.indexOf(': ');
    if (i < 1) return null;
    f[l.slice(0, i)] = l.slice(i + 2);
  }
  return { authority: first[1], address: lines[1], statement: lines[3], uri: f.URI, version: f.Version, chainId: f['Chain ID'], nonce: f.Nonce, issuedAt: f['Issued At'], expirationTime: f['Expiration Time'], lines: lines.length };
}

/** Is this exactly the message a claim of punk `id` from `wallet` signs? What isn't, in words (none: it is).
 *  `hosts`: the addresses a page may have (pickthepunk.com's by default).
 *  @param {string} message @param {{ id: number; wallet: string; hosts?: RegExp }} o @returns {string[]} */
export function messageProblems(message, o) {
  const m = readMessage(message);
  if (!m) return ['It is not a sign-in message.'];
  const out = [], hosts = o.hosts ?? /^[a-z0-9-]+\.pickthepunk\.com$/;
  if (!hosts.test(m.authority)) out.push(`It names ${m.authority}, which is not a pickthepunk.com page.`);
  if (m.address !== checksum(o.wallet)) out.push(`It names the wallet ${m.address}, not ${checksum(o.wallet)}.`);
  if (m.statement !== statement(m.authority, o.id)) out.push('Its sentence is not the claim of this punk, word for word.');
  if (!m.uri || !m.uri.endsWith(`//${m.authority}/claim`)) out.push('Its URI is not the claim page at the address it names.');
  if (m.version !== '1') out.push('Its version is not 1.');
  if (m.chainId !== '1') out.push('Its chain is not Ethereum (Chain ID 1).');
  if (!/^[a-z0-9]{8,}$/i.test(m.nonce ?? '')) out.push('Its nonce is not a code of letters and digits.');
  const issued = Date.parse(m.issuedAt ?? ''), expires = Date.parse(m.expirationTime ?? '');
  if (!issued || !expires || expires - issued !== SIGN_MS) out.push('It is not good for exactly ten minutes.');
  if (m.lines !== 11) out.push('It has other lines than the claim message.');
  return out;
}

/** Did `wallet` sign `message`: its key made the signature, or (a contract wallet such as a Safe) it accepts it?
 *  @param {import('./chain.js').Rpc} rpc @param {string} wallet @param {string} message @param {string} signature */
export async function signedBy(rpc, wallet, message, signature) {
  const hash = personalHash(message);
  if (recoverSigner(hash, signature) === wallet.toLowerCase()) return true;
  return contractAccepts(rpc, wallet, hash, signature);
}

// ---- way 2: the codes ---------------------------------------------------------------------------------------------------
/** A code is an amount of k ten-millionths of an ETH (k × 10^11 wei), 101 to 999 and never ending in 0, so it reads the
 *  same however a wallet writes it: 0.0000421. */
export const CODES = Array.from({ length: 899 }, (_, i) => i + 101).filter((k) => k % 10 !== 0);
/** @param {number} k */
export const codeWei = (k) => BigInt(k) * 100_000_000_000n;
/** The amount as people type it, seven decimals: 0.0000421 ETH. @param {bigint | string} wei */
export const codeEth = (wei) => { const w = BigInt(wei); return w % 100_000_000_000n === 0n && w < 10n ** 14n ? `0.0000${String(Number(w / 100_000_000_000n)).padStart(3, '0')}` : ethOf(w); };

/** Does this transfer carry a claim's code: sent to goldcote.eth, exactly the code's amount, in a block mined after the
 *  claim began, and gone through? (Whether it came in the hour, and from the holder, are the next checks.)
 *  @param {import('./chain.js').Transfer} t @param {{ amountWei: string | null; fromBlock: number | null }} c */
export const carriesCode = (t, c) => t.to === GOLDCOTE && String(t.value) === String(c.amountWei) && t.block > (c.fromBlock ?? 0) && t.ok !== false;

// ---- what people are shown ----------------------------------------------------------------------------------------------------
/** Everything the claim page's script (browser/claim.js) asks a wallet for, in order. Nothing else, ever. */
export const WALLET_REQUESTS = [
  { method: 'eth_requestAccounts', words: 'Connect: the wallet asks whether this site may see your address.' },
  { method: 'personal_sign', words: 'Sign in: the claim message above, plain text, signed for free.' },
  { method: 'wallet_revokePermissions', words: 'Disconnect, once it is signed (many wallets do this without a window).' },
];

/** What should make anyone stop and reject, whatever a page says. `host`: the claim page's address.
 *  @param {string} [host] */
export const stopSigns = (host = 'the page’s own address') => [
  'A network fee, gas, or “Confirm transaction”',
  '“Approve”, “setApprovalForAll”, “Increase allowance”, “Permit” or “Permit2”',
  'Typed data, or fields like Offer, Consideration, Order or Listing',
  'Seaport, OpenSea, Blur, LooksRare or any other marketplace',
  'A hash with no words, or “Blind signing” on a hardware wallet',
  `Another site’s name than ${host}, or any warning from your wallet`,
];
