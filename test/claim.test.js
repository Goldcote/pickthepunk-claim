// The claim of a punk's page: its message word for word, the checks a proof passes, the codes of way 2, and the promise that the page's
// script asks a wallet for three things and nothing else.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { secp256k1 } from '@noble/curves/secp256k1.js';
import { bytesToHex, carriesCode, checksum, CODES, codeEth, codeWei, GOLDCOTE, keccak, messageProblems, personalHash, readMessage, signedBy, signMessage, statement, stopSigns, WALLET_REQUESTS } from '../src/index.js';

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
const issued = Date.UTC(2026, 10, 17, 14, 2, 11);
const MESSAGE = signMessage({ authority: '0.pickthepunk.com', uri: 'https://0.pickthepunk.com/claim', wallet: ALICE.address, id: 0, nonce: 'k3x9q2m8a7c1d4e5', issued, expires: issued + 600_000 });

test('the message is the sign-in the claim page shows, line for line', () => {
  assert.equal(MESSAGE, [
    '0.pickthepunk.com wants you to sign in with your Ethereum account:',
    checksum(ALICE.address),
    '',
    'Claim 0.pickthepunk.com for CryptoPunk #0. A signature only: no transaction, no gas, no approval.',
    '',
    'URI: https://0.pickthepunk.com/claim',
    'Version: 1',
    'Chain ID: 1',
    'Nonce: k3x9q2m8a7c1d4e5',
    'Issued At: 2026-11-17T14:02:11.000Z',
    'Expiration Time: 2026-11-17T14:12:11.000Z',
  ].join('\n'));
  const m = readMessage(MESSAGE);
  assert.equal(m.address.toLowerCase(), ALICE.address);
  assert.equal(m.statement, statement('0.pickthepunk.com', 0));
  assert.equal(m.chainId, '1');
});

test('a message is checked word for word: anything else is named', () => {
  assert.deepEqual(messageProblems(MESSAGE, { id: 0, wallet: ALICE.address }), []);
  assert.equal(messageProblems(MESSAGE, { id: 1, wallet: ALICE.address }).length, 1); // another punk
  assert.match(messageProblems(MESSAGE, { id: 0, wallet: BOB.address }).join(' '), /names the wallet/);
  assert.match(messageProblems(MESSAGE.replace('Chain ID: 1', 'Chain ID: 8453'), { id: 0, wallet: ALICE.address }).join(' '), /Ethereum/);
  assert.match(messageProblems(MESSAGE.replace('no approval.', 'and approve.'), { id: 0, wallet: ALICE.address }).join(' '), /word for word/);
  assert.match(messageProblems(MESSAGE.replaceAll('0.pickthepunk.com', 'pickthepunk.co'), { id: 0, wallet: ALICE.address }).join(' '), /not a pickthepunk\.com page/);
  assert.match(messageProblems(`${MESSAGE}\nRequest ID: 1`, { id: 0, wallet: ALICE.address }).join(' '), /other lines/);
  assert.deepEqual(messageProblems('Sign this', { id: 0, wallet: ALICE.address }), ['It is not a sign-in message.']);
  // a test computer's addresses, when asked for
  const local = signMessage({ authority: '0.pickthepunk.localhost:8795', uri: 'http://0.pickthepunk.localhost:8795/claim', wallet: ALICE.address, id: 0, nonce: 'abcdefgh12345678', issued, expires: issued + 600_000 });
  assert.deepEqual(messageProblems(local, { id: 0, wallet: ALICE.address, hosts: /^[a-z0-9-]+\.pickthepunk\.localhost:\d+$/ }), []);
});

test('a signature counts only from the wallet the message names, or a contract wallet that accepts it', async () => {
  const none = async (method) => (method === 'eth_getCode' ? '0x' : '0x');
  assert.equal(await signedBy(none, ALICE.address, MESSAGE, sign(ALICE.key, MESSAGE)), true);
  assert.equal(await signedBy(none, ALICE.address, MESSAGE, sign(BOB.key, MESSAGE)), false);
  assert.equal(await signedBy(none, ALICE.address, `${MESSAGE} `, sign(ALICE.key, MESSAGE)), false);
  // a Safe: it has code, and its isValidSignature answers the magic value
  const safe = '0x5afe000000000000000000000000000000005afe';
  const asked = [];
  const safeRpc = async (method, params) => {
    asked.push(method);
    if (method === 'eth_getCode') return '0x6080';
    if (method === 'eth_call' && params[0].to === safe && params[0].data.startsWith('0x1626ba7e')) return `0x1626ba7e${'0'.repeat(56)}`;
    throw new Error('no');
  };
  assert.equal(await signedBy(safeRpc, safe, MESSAGE, `0x${'11'.repeat(65)}`), true);
  assert.deepEqual(asked, ['eth_getCode', 'eth_call']);
});

test('way 2’s codes: 810 amounts, each read the same however a wallet writes it', () => {
  assert.equal(CODES.length, 810);
  assert.ok(CODES.every((k) => k >= 101 && k <= 999 && k % 10 !== 0));
  assert.equal(codeEth(codeWei(421)), '0.0000421');
  assert.equal(codeEth(String(codeWei(101))), '0.0000101');
  const t = { hash: '0x1', from: '0xabc', to: GOLDCOTE, value: codeWei(421), block: 101, ok: true };
  const c = { amountWei: String(codeWei(421)), fromBlock: 100 };
  assert.equal(carriesCode(t, c), true);
  assert.equal(carriesCode({ ...t, ok: undefined }, c), true); // (read from a block: it went through)
  assert.equal(carriesCode({ ...t, ok: false }, c), false);
  assert.equal(carriesCode({ ...t, block: 100 }, c), false); // mined before the claim began
  assert.equal(carriesCode({ ...t, value: codeWei(422) }, c), false);
  assert.equal(carriesCode({ ...t, to: '0x0000000000000000000000000000000000000001' }, c), false);
});

test('the page’s script asks a wallet for these three things, and nothing else', () => {
  const script = readFileSync(new URL('../browser/claim.js', import.meta.url), 'utf8');
  // every request to a wallet goes through provider.request({ method: '…' }), each with its method written out
  const asked = [...script.matchAll(/\.request\(\{\s*method:\s*'([A-Za-z_]+)'/g)].map((m) => m[1]);
  assert.equal(asked.length, script.split('.request(').length - 1);
  assert.deepEqual([...new Set(asked)].sort(), WALLET_REQUESTS.map((r) => r.method).sort());
  for (const never of ['eth_sendTransaction', 'eth_signTypedData', 'eth_sign\'', 'wallet_sendCalls', 'setApprovalForAll', 'approve(']) assert.ok(!script.includes(never), never);
});

test('the stop signs name the page’s own address', () => {
  const s = stopSigns('0.pickthepunk.com');
  assert.equal(s.length, 6);
  assert.match(s[5], /0\.pickthepunk\.com/);
  assert.match(s.join(' '), /setApprovalForAll/);
});
