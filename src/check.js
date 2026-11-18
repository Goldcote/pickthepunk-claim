// Check a claimed page's proof yourself, from public Ethereum data, without trusting pickthepunk: bin/check.js runs this.
// It reads the page's proof (/proof.json), checks the signed message word for word and its signature (or the transfer
// to goldcote.eth), then reads who holds the punk today (itself, or through a wrapper).

import { blockTime, contractAccepts, delegateOf, GOLDCOTE, holderOf, nodeRpc, transferByHash } from './chain.js';
import { messageProblems, readMessage } from './claim.js';
import { checksum, isAddress, personalHash, recoverSigner } from './eth.js';

/** Where a page's proof is: a punk's number, a page's address, or an address with its scheme.
 *  @param {string} target */
export function proofUrl(target) {
  const t = String(target ?? '').trim();
  if (/^\d{1,4}$/.test(t)) return `https://${Number(t)}.pickthepunk.com/proof.json`;
  if (/^https?:\/\//i.test(t)) return new URL('/proof.json', t).href;
  if (/^[a-z0-9.-]+(:\d+)?$/i.test(t)) return `https://${t.toLowerCase()}/proof.json`;
  return null;
}

const short = (/** @type {string} */ a) => `${a.slice(0, 6)}…${a.slice(-4)}`;
const day = (/** @type {number} */ ms) => new Date(ms).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });

/** @typedef {{ ok: boolean; lines: string[] }} Report */
/** @param {string} target @param {{ rpc?: import('./chain.js').Rpc; hosts?: RegExp }} [o] @returns {Promise<Report>} */
export async function checkProof(target, o = {}) {
  const rpc = o.rpc ?? nodeRpc();
  /** @type {string[]} */
  const lines = [];
  let ok = true;
  const yes = (/** @type {string} */ t) => lines.push(`✓ ${t}`);
  const no = (/** @type {string} */ t) => { ok = false; lines.push(`✗ ${t}`); };

  const url = proofUrl(target);
  if (!url) return { ok: false, lines: ['Give a punk’s number, such as 1234, or a page’s address, such as 1234.pickthepunk.com.'] };
  let r;
  try { r = await globalThis.fetch(url, { headers: { accept: 'application/json' }, redirect: 'follow' }); }
  catch { return { ok: false, lines: [`${url} could not be reached.`] }; }
  if (r.status === 404) return { ok: false, lines: [`Nobody has made this page theirs yet: ${url} has no proof to check.`] };
  if (!r.ok) return { ok: false, lines: [`${url} answered ${r.status}.`] };
  /** @type {any} */
  let p;
  try { p = await r.json(); } catch { return { ok: false, lines: [`${url} is not a proof.`] }; }
  const id = Number(p?.punk);
  if (!Number.isInteger(id) || id < 0 || id > 9999 || !isAddress(p.wallet) || !isAddress(p.holder) || (p.way !== 'sign' && p.way !== 'pay')) return { ok: false, lines: [`${url} is not a proof.`] };
  const wallet = p.wallet.toLowerCase();
  lines.push(`CryptoPunk #${id} · ${p.page ?? url.replace(/proof\.json$/, '')}`);

  if (p.way === 'sign') {
    const problems = messageProblems(String(p.message ?? ''), { id, wallet, hosts: o.hosts });
    if (problems.length) for (const t of problems) no(`The signed message: ${t}`);
    else yes(`The signed message is the claim message for #${id}, word for word.`);
    const hash = personalHash(String(p.message ?? ''));
    if (recoverSigner(hash, String(p.signature ?? '')) === wallet) yes(`The signature comes from ${checksum(wallet)}, the wallet the message names.`);
    else if (await contractAccepts(rpc, wallet, hash, String(p.signature ?? ''))) yes(`The contract wallet ${checksum(wallet)} accepts the signature (EIP-1271).`);
    else no(`The signature does not come from ${checksum(wallet)}.`);
    const m = readMessage(String(p.message ?? '')), until = Date.parse(m?.expirationTime ?? ''), at = Date.parse(p.provedAt ?? '');
    if (until && at && at <= until) yes(`It was proved on ${day(at)}, within the message’s ten minutes.`);
    else no('It was not proved within the message’s ten minutes.');
  } else {
    const tx = /^0x[0-9a-f]{64}$/i.test(p.transaction ?? '') ? await transferByHash(rpc, p.transaction.toLowerCase()) : null;
    if (!tx) no('The transfer is not on Ethereum.');
    else {
      if (tx.ok && tx.to === GOLDCOTE && tx.from === wallet && String(tx.value) === String(p.amountWei)) yes(`The transfer ${short(tx.hash)} sent the code’s amount from ${checksum(wallet)} to goldcote.eth.`);
      else no(`The transfer ${short(tx.hash)} is not the code’s amount from ${checksum(wallet)} to goldcote.eth.`);
      const at = await blockTime(rpc, tx.block), until = Date.parse(p.expiresAt ?? '');
      if (at && until && at <= until) yes(`It was mined on ${day(at)}, within the code’s hour.`);
      else no('It was not mined within the code’s hour.');
    }
  }

  // and today
  const { holder: now, contract } = await holderOf(rpc, id);
  if (now === wallet) yes(`Today ${checksum(wallet)} still holds #${id}.`);
  else {
    // (as the daily check: the page stays when today's holder delegated to the wallet that proved it, or to the holder
    // it proved for, such as a punk moved into its owner's own vault)
    const holder = p.holder.toLowerCase();
    if (await delegateOf(rpc, wallet, now, id, contract)) yes(`Today ${checksum(now)} holds #${id}, and ${checksum(wallet)} acts for it on delegate.xyz.`);
    else if (holder !== wallet && holder !== now && (await delegateOf(rpc, holder, now, id, contract))) yes(`Today ${checksum(now)} holds #${id}, and ${checksum(holder)}, the holder it was proved for, acts for it on delegate.xyz.`);
    else lines.push(`! Today #${id} is held by ${checksum(now)}, another wallet: the page goes back to waiting for its new holder at the next daily check.`);
  }
  lines.push(ok ? 'The proof holds.' : 'The proof does not hold.');
  return { ok, lines };
}
