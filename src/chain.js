// Ethereum, read and never written: who holds a punk, whether a wallet is its holder's delegate on delegate.xyz,
// whether a contract wallet (a Safe) accepts a signature, and the plain transfers that reach goldcote.eth. Every function
// here takes `rpc`, the one way it reaches Ethereum: (method, params) => the node's answer. nodeRpc() makes one from a
// list of nodes; pickthesite's server puts its own provider first, the check tool (bin/check.js) asks public nodes.

import { bytesToHex, callData, decodeAddress, decodeBool, encAddress, encBytes32, encUint } from './eth.js';

/** The CryptoPunks contract (2017). It keeps who holds each punk itself (punkIndexToAddress), from before NFTs had a
 *  standard. */
export const PUNKS = '0xb47e3cd837ddf8e4c57f05d70ab865de6e193bbb';
/** The two wrappers a punk can sit in as a standard NFT (ERC-721): Wrapped Cryptopunks (2020) and CryptoPunks 721
 *  (Yuga Labs, 2023). While a punk is wrapped, the CryptoPunks contract names the wrapper as its holder, and the
 *  wrapper's ownerOf names the owner. */
export const WRAPPED_PUNKS = '0xb7f7f6c52f2e2fdb1963eab30438024864c313f6';
export const PUNKS_721 = '0x000000000000003607fce1ac9e043a86675c5c2f';
export const WRAPPERS = [WRAPPED_PUNKS, PUNKS_721];
/** goldcote.eth: Goldcote Ltd's own name on Ethereum, the company in pickthepunk's Terms. Way 2's transfers go here. */
export const GOLDCOTE = '0x0cd586c0117b7cea016cf2b505b104c49a2a68fa';
/** delegate.xyz's registries: v2, and v1 for the delegations made before it (both at these addresses on every chain). */
export const DELEGATE_V2 = '0x00000000000000447e69651d841bd8d104bed493';
export const DELEGATE_V1 = '0x00000000000076a84fef008cdabe6409d2fe638b';
/** Two public Ethereum nodes anyone can ask, no account needed. */
export const PUBLIC_NODES = ['https://ethereum-rpc.publicnode.com', 'https://eth.llamarpc.com'];

/** Ethereum couldn't be read (every node failed or timed out). */
export class ChainError extends Error {}

/** @typedef {(method: string, params: unknown[]) => Promise<any>} Rpc */

/** An Rpc that asks each node in turn: each call gives up after `timeout` ms and the next node is asked.
 *  @param {string[]} [nodes] @param {{ timeout?: number }} [o] @returns {Rpc} */
export function nodeRpc(nodes = PUBLIC_NODES, o = {}) {
  const timeout = o.timeout ?? 8000;
  return async (method, params) => {
    let last = '';
    for (const node of nodes) {
      try {
        const r = await globalThis.fetch(node, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }), signal: AbortSignal.timeout(timeout) });
        if (!r.ok) { last = `http ${r.status}`; continue; }
        const d = await r.json();
        if (d.error) { last = String(d.error.message ?? 'error'); continue; }
        if (d.result === undefined) { last = 'no result'; continue; }
        return d.result;
      } catch (e) {
        last = e?.name === 'TimeoutError' ? 'timeout' : 'network';
      }
    }
    throw new ChainError(`${method}: ${last}`);
  };
}
/** @param {Rpc} rpc @param {string} to @param {string} data @returns {Promise<string>} */
const call = (rpc, to, data) => rpc('eth_call', [{ to, data }, 'latest']);

/** Who holds a punk now (lowercase), and the contract it sits in: CryptoPunks itself, or the wrapper it was wrapped in.
 *  @param {Rpc} rpc @param {number} id @returns {Promise<{ holder: string; contract: string }>} */
export async function holderOf(rpc, id) {
  const at = decodeAddress(await call(rpc, PUNKS, callData('punkIndexToAddress(uint256)', [{ s: encUint(id) }])));
  if (!at) throw new ChainError('punkIndexToAddress: no address');
  if (!WRAPPERS.includes(at)) return { holder: at, contract: PUNKS };
  const owner = decodeAddress(await call(rpc, at, callData('ownerOf(uint256)', [{ s: encUint(id) }])));
  if (!owner) throw new ChainError('ownerOf: no address');
  return { holder: owner, contract: at };
}
/** The wallet that holds a punk now (lowercase). @param {Rpc} rpc @param {number} id */
export const ownerOf = async (rpc, id) => (await holderOf(rpc, id)).holder;

/** Is `wallet` allowed to act for `holder` on this punk through delegate.xyz (its whole vault, the punk's contract, or
 *  this token; full delegations only)? Asked for the contract the punk sits in and, for a wrapped punk, for CryptoPunks
 *  too: either way the holder said so. Which registry says so, or null.
 *  @param {Rpc} rpc @param {string} wallet @param {string} holder @param {number} id @param {string} [contract]
 *  @returns {Promise<'delegate-v2' | 'delegate-v1' | null>} */
export async function delegateOf(rpc, wallet, holder, id, contract = PUNKS) {
  const contracts = contract === PUNKS ? [PUNKS] : [contract, PUNKS];
  for (const c of contracts) {
    const v2 = callData('checkDelegateForERC721(address,address,address,uint256,bytes32)', [{ s: encAddress(wallet) }, { s: encAddress(holder) }, { s: encAddress(c) }, { s: encUint(id) }, { s: encBytes32('0x') }]);
    if (decodeBool(await call(rpc, DELEGATE_V2, v2))) return 'delegate-v2';
  }
  for (const c of contracts) {
    const v1 = callData('checkDelegateForToken(address,address,address,uint256)', [{ s: encAddress(wallet) }, { s: encAddress(holder) }, { s: encAddress(c) }, { s: encUint(id) }]);
    if (decodeBool(await call(rpc, DELEGATE_V1, v1))) return 'delegate-v1';
  }
  return null;
}

/** @typedef {'owner' | 'delegate-v2' | 'delegate-v1'} Via */
/** Does this wallet hold the punk, or act for its holder? The holder, how, and the contract the punk sits in.
 *  @param {Rpc} rpc @param {string} wallet @param {number} id
 *  @returns {Promise<{ holder: string; via: Via | null; contract: string }>} */
export async function holds(rpc, wallet, id) {
  const { holder, contract } = await holderOf(rpc, id), w = wallet.toLowerCase();
  if (holder === w) return { holder, via: 'owner', contract };
  return { holder, via: await delegateOf(rpc, w, holder, id, contract), contract };
}

/** A contract wallet's own word on a signature (EIP-1271: isValidSignature answers 0x1626ba7e when it accepts it).
 *  @param {Rpc} rpc @param {string} wallet @param {Uint8Array} hash @param {string} signature */
export async function contractAccepts(rpc, wallet, hash, signature) {
  const code = await rpc('eth_getCode', [wallet, 'latest']);
  if (!code || code === '0x') return false;
  try {
    const r = await call(rpc, wallet, callData('isValidSignature(bytes32,bytes)', [{ s: encBytes32(bytesToHex(hash)) }, { bytes: signature }]));
    return /^0x1626ba7e/i.test(r);
  } catch {
    return false; // (a contract without the function answers with an error)
  }
}

/** @param {Rpc} rpc */
export const latestBlock = async (rpc) => parseInt(await rpc('eth_blockNumber', []), 16);
/** When a block was mined, in milliseconds; 0 when Ethereum doesn't have it. @param {Rpc} rpc @param {number} block */
export async function blockTime(rpc, block) {
  const b = await rpc('eth_getBlockByNumber', [`0x${block.toString(16)}`, false]);
  return b ? parseInt(b.timestamp, 16) * 1000 : 0;
}

/** @typedef {{ hash: string; from: string; to: string; value: bigint; block: number; ok?: boolean }} Transfer */
/** @param {{ hash: string; from: string; to: string | null; value: string; blockNumber: string }} t @returns {Transfer} */
const asTransfer = (t) => ({ hash: t.hash.toLowerCase(), from: t.from.toLowerCase(), to: (t.to ?? '').toLowerCase(), value: BigInt(t.value), block: parseInt(t.blockNumber, 16) });

/** The plain transfers to `to` in blocks from `first` to `last` (a transfer's own transaction: a wallet sending ETH
 *  itself, as way 2 asks). @param {Rpc} rpc @param {string} to @param {number} first @param {number} last */
export async function transfersTo(rpc, to, first, last) {
  /** @type {Transfer[]} */
  const out = [];
  const t = to.toLowerCase();
  for (let n = first; n <= last; n++) {
    const b = await rpc('eth_getBlockByNumber', [`0x${n.toString(16)}`, true]);
    for (const tx of b?.transactions ?? []) if ((tx.to ?? '').toLowerCase() === t) out.push(asTransfer(tx));
  }
  return out;
}

/** One transaction by its hash, with whether it went through; null when Ethereum doesn't have it (yet).
 *  @param {Rpc} rpc @param {string} hash @returns {Promise<Transfer | null>} */
export async function transferByHash(rpc, hash) {
  const tx = await rpc('eth_getTransactionByHash', [hash]);
  if (!tx || !tx.blockNumber) return null;
  const receipt = await rpc('eth_getTransactionReceipt', [hash]);
  return { ...asTransfer(tx), ok: receipt?.status === '0x1' };
}
