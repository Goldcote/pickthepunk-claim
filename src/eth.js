// The little Ethereum a claim needs, worked out here and nowhere else: Keccak-256, the hash a wallet signs a plain
// message under (EIP-191 "personal_sign"), the wallet an ordinary signature comes from (secp256k1 recovery, as
// Ethereum's own ecrecover does it), addresses written with their checksum (EIP-55), and the few call encodings the
// checks send (Solidity's ABI). The curve maths is @noble/curves and the hash @noble/hashes: small, audited, no others.

import { secp256k1 } from '@noble/curves/secp256k1.js';
import { keccak_256 } from '@noble/hashes/sha3.js';

const enc = new TextEncoder();

/** @param {string} hex @returns {Uint8Array} */
export const hexToBytes = (hex) => {
  const h = hex.startsWith('0x') ? hex.slice(2) : hex;
  if (h.length % 2 || /[^0-9a-f]/i.test(h)) throw new Error('not hex');
  const out = new Uint8Array(h.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(h.slice(i * 2, i * 2 + 2), 16);
  return out;
};
/** @param {Uint8Array} b @returns {string} */
export const bytesToHex = (b) => `0x${[...b].map((x) => x.toString(16).padStart(2, '0')).join('')}`;
/** @param {Uint8Array | string} data @returns {Uint8Array} */
export const keccak = (data) => keccak_256(typeof data === 'string' ? enc.encode(data) : data);

/** A 0x address of 40 hex digits (any case). @param {unknown} s @returns {s is string} */
export const isAddress = (s) => typeof s === 'string' && /^0x[0-9a-fA-F]{40}$/.test(s);
/** The address with its checksum, as wallets and Etherscan write it (EIP-55). @param {string} address */
export function checksum(address) {
  const a = address.toLowerCase().replace(/^0x/, ''), h = bytesToHex(keccak(a)).slice(2);
  return `0x${[...a].map((c, i) => (parseInt(h[i], 16) >= 8 ? c.toUpperCase() : c)).join('')}`;
}

/** The hash a wallet signs for a plain message: keccak256("\x19Ethereum Signed Message:\n" + its length in bytes + it).
 *  An order, a permit or a transaction is hashed another way, so a signature of this hash can never stand for one.
 *  @param {string} message */
export function personalHash(message) {
  const m = enc.encode(message);
  const pre = enc.encode(`\x19Ethereum Signed Message:\n${m.length}`);
  const all = new Uint8Array(pre.length + m.length);
  all.set(pre); all.set(m, pre.length);
  return keccak(all);
}

/** The wallet whose key made this 65-byte signature (r, s, v) of this hash, lowercase; null when it is no such
 *  signature. (A contract wallet's signature is checked by asking the contract: ./chain.js.)
 *  @param {Uint8Array} hash @param {string} signature @returns {string | null} */
export function recoverSigner(hash, signature) {
  let sig;
  try { sig = hexToBytes(signature); } catch { return null; }
  if (sig.length !== 65) return null;
  const v = sig[64], rec = v >= 27 ? v - 27 : v;
  if (rec !== 0 && rec !== 1) return null;
  try {
    const point = secp256k1.Signature.fromBytes(sig.slice(0, 64), 'compact').addRecoveryBit(rec).recoverPublicKey(hash);
    const pub = point.toBytes(false); // 0x04 ‖ x ‖ y
    return bytesToHex(keccak(pub.slice(1)).slice(12));
  } catch {
    return null;
  }
}

// ---- calls ---------------------------------------------------------------------------------------------------------------
/** A function's four-byte selector: the start of keccak256 of its signature, e.g. ownerOf(uint256) → 0x6352211e.
 *  @param {string} signature */
export const selector = (signature) => bytesToHex(keccak(signature)).slice(0, 10);
/** @param {string} hex */
const word = (hex) => hex.replace(/^0x/, '').toLowerCase().padStart(64, '0');
/** @param {string} a */
export const encAddress = (a) => word(a);
/** @param {bigint | number} n */
export const encUint = (n) => word(BigInt(n).toString(16));
/** bytes32, left as it is (right-padded): a hash. @param {string} hex */
export const encBytes32 = (hex) => hex.replace(/^0x/, '').toLowerCase().padEnd(64, '0');
/** A call with static arguments, and dynamic `bytes` ones after them (offsets worked out here).
 *  @param {string} sig @param {{ s?: string; bytes?: string }[]} args */
export function callData(sig, args) {
  const head = [], tail = [];
  let offset = args.length * 32;
  for (const a of args) {
    if (a.bytes === undefined) { head.push(a.s); continue; }
    const b = a.bytes.replace(/^0x/, '').toLowerCase(), len = b.length / 2, padded = b.padEnd(Math.ceil(len / 32) * 64, '0');
    head.push(encUint(offset));
    tail.push(encUint(len) + padded);
    offset += 32 + Math.ceil(len / 32) * 32;
  }
  return `${selector(sig)}${head.join('')}${tail.join('')}`;
}
/** The last 20 bytes of a 32-byte answer, as an address (lowercase). @param {string} hex */
export const decodeAddress = (hex) => (/^0x[0-9a-f]{64}$/i.test(hex) ? `0x${hex.slice(26).toLowerCase()}` : null);
/** A 32-byte answer as true or false. @param {string} hex */
export const decodeBool = (hex) => /^0x0{63}1$/i.test(hex);

// ---- amounts ---------------------------------------------------------------------------------------------------------------
const WEI = 10n ** 18n;
/** Wei as ETH, written in full (no rounding): 42100000000000n → "0.0000421". @param {bigint} wei */
export function ethOf(wei) {
  const whole = wei / WEI, frac = (wei % WEI).toString().padStart(18, '0').replace(/0+$/, '');
  return frac ? `${whole}.${frac}` : String(whole);
}
