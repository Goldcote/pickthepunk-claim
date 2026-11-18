// The check tool against a stand-in page and a stand-in Ethereum: a proof that holds, one whose message was changed,
// one signed by another key, a page nobody claimed, a transfer, and a punk sold since.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { secp256k1 } from '@noble/curves/secp256k1.js';
import { bytesToHex, checkProof, checksum, codeWei, GOLDCOTE, keccak, personalHash, proofUrl, PUNKS, selector, signMessage } from '../src/index.js';

const wallet = (seed) => {
  const key = new Uint8Array(32).fill(seed);
  return { key, address: bytesToHex(keccak(secp256k1.getPublicKey(key, false).slice(1)).slice(12)) };
};
const sign = (key, message) => {
  const rec = secp256k1.sign(personalHash(message), key, { prehash: false, format: 'recovered' });
  const out = new Uint8Array(65); out.set(rec.slice(1), 0); out[64] = 27 + rec[0];
  return bytesToHex(out);
};
const ALICE = wallet(7), BOB = wallet(9);
const word = (hex) => hex.replace(/^0x/, '').padStart(64, '0');
const issued = Date.UTC(2026, 10, 17, 14, 2, 11);
const message = signMessage({ authority: '42.pickthepunk.com', uri: 'https://42.pickthepunk.com/claim', wallet: ALICE.address, id: 42, nonce: 'k3x9q2m8a7c1d4e5', issued, expires: issued + 600_000 });
const signProof = (o = {}) => ({ punk: 42, page: 'https://42.pickthepunk.com/', holder: checksum(ALICE.address), wallet: checksum(ALICE.address), via: 'owner', way: 'sign', provedAt: new Date(issued + 30_000).toISOString(), expiresAt: new Date(issued + 600_000).toISOString(), message, signature: sign(ALICE.key, message), ...o });

/** Ethereum where `holder` holds #42 today and a transfer of 0.0000421 ETH from Alice reached goldcote.eth. */
const chain = (holder = ALICE.address) => async (method, params) => {
  if (method === 'eth_call' && params[0].to === PUNKS && params[0].data.startsWith(selector('punkIndexToAddress(uint256)'))) return `0x${word(holder)}`;
  if (method === 'eth_call') return `0x${word('0')}`;
  if (method === 'eth_getCode') return '0x';
  if (method === 'eth_getTransactionByHash') return { hash: params[0], from: ALICE.address, to: GOLDCOTE, value: `0x${codeWei(421).toString(16)}`, blockNumber: '0x64' };
  if (method === 'eth_getTransactionReceipt') return { status: '0x1' };
  if (method === 'eth_getBlockByNumber') return { timestamp: `0x${Math.floor((issued + 60_000) / 1000).toString(16)}` };
  throw new Error(method);
};
const withPage = async (body, run) => {
  const real = globalThis.fetch;
  globalThis.fetch = async (url) => (body ? Response.json(body) : new Response('Not found', { status: 404 }));
  try { return await run(); } finally { globalThis.fetch = real; }
};

test('where a proof is: a number, a page’s address, or an address with its scheme', () => {
  assert.equal(proofUrl('42'), 'https://42.pickthepunk.com/proof.json');
  assert.equal(proofUrl('alien.pickthepunk.com'), 'https://alien.pickthepunk.com/proof.json');
  assert.equal(proofUrl('http://0.pickthepunk.localhost:8795/claim'), 'http://0.pickthepunk.localhost:8795/proof.json');
  assert.equal(proofUrl('not a page!'), null);
});

test('a proof that holds', async () => {
  const r = await withPage(signProof(), () => checkProof('42', { rpc: chain() }));
  assert.equal(r.ok, true, r.lines.join('\n'));
  assert.match(r.lines.join('\n'), /word for word[\s\S]*comes from[\s\S]*still holds #42/);
});

test('a changed message, or a signature from another key, does not hold', async () => {
  const changed = await withPage(signProof({ message: message.replace('no approval', 'an approval') }), () => checkProof('42', { rpc: chain() }));
  assert.equal(changed.ok, false);
  const other = await withPage(signProof({ signature: sign(BOB.key, message) }), () => checkProof('42', { rpc: chain() }));
  assert.equal(other.ok, false);
  assert.match(other.lines.join('\n'), /does not come from/);
  const late = await withPage(signProof({ provedAt: new Date(issued + 700_000).toISOString() }), () => checkProof('42', { rpc: chain() }));
  assert.equal(late.ok, false);
});

test('a page nobody claimed has no proof', async () => {
  const r = await withPage(null, () => checkProof('42', { rpc: chain() }));
  assert.equal(r.ok, false);
  assert.match(r.lines[0], /Nobody has made this page theirs yet/);
});

test('way 2: the code’s amount from the wallet, in the hour', async () => {
  const pay = { punk: 42, page: 'https://42.pickthepunk.com/', holder: checksum(ALICE.address), wallet: checksum(ALICE.address), via: 'owner', way: 'pay', provedAt: new Date(issued + 90_000).toISOString(), expiresAt: new Date(issued + 3_600_000).toISOString(), transaction: `0x${'ab'.repeat(32)}`, amountWei: String(codeWei(421)), to: checksum(GOLDCOTE) };
  const r = await withPage(pay, () => checkProof('42', { rpc: chain() }));
  assert.equal(r.ok, true, r.lines.join('\n'));
  const wrong = await withPage({ ...pay, amountWei: String(codeWei(422)) }, () => checkProof('42', { rpc: chain() }));
  assert.equal(wrong.ok, false);
});

test('a punk sold since: the proof held, and the page goes back at the next daily check', async () => {
  const r = await withPage(signProof(), () => checkProof('42', { rpc: chain(BOB.address) }));
  assert.equal(r.ok, true);
  assert.match(r.lines.join('\n'), /! Today #42 is held by .+ another wallet/);
});
