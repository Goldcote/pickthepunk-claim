// Ethereum reads against a stand-in node: who holds a punk (the CryptoPunks contract itself, or the wrapper it sits in),
// delegate.xyz's two registries in order and for the right contract, plain transfers to goldcote.eth, and a node that
// fails handing over to the next one.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ChainError, delegateOf, DELEGATE_V1, DELEGATE_V2, GOLDCOTE, holderOf, holds, nodeRpc, ownerOf, PUNKS, PUNKS_721, selector, transferByHash, transfersTo, WRAPPED_PUNKS } from '../src/index.js';

const word = (hex) => hex.replace(/^0x/, '').padStart(64, '0');
const A = '0x' + 'a1'.repeat(20), B = '0x' + 'b2'.repeat(20), C = '0x' + 'c3'.repeat(20);

/** A node where A holds punk 5 itself, punk 6 sits in Wrapped Cryptopunks for B, punk 7 in CryptoPunks 721 for B;
 *  C acts for A on registry v1 (punk 5), and for B on registry v2 for CryptoPunks 721 only (punk 7). */
const fake = (asked = []) => async (method, params) => {
  if (method === 'eth_call') {
    const { to, data } = params[0];
    asked.push(`call ${to}`);
    const args = (data.slice(10).match(/.{64}/g) ?? []).map((a) => `0x${a.slice(24)}`);
    const id = parseInt(data.slice(10, 74) || '0', 16);
    if (to === PUNKS && data.startsWith(selector('punkIndexToAddress(uint256)'))) return `0x${word(id === 6 ? WRAPPED_PUNKS : id === 7 ? PUNKS_721 : A)}`;
    if ((to === WRAPPED_PUNKS || to === PUNKS_721) && data.startsWith(selector('ownerOf(uint256)'))) return `0x${word(B)}`;
    if (to === DELEGATE_V2) {
      const [w, from, contract] = args, token = parseInt(data.slice(10 + 64 * 3, 10 + 64 * 4), 16);
      return `0x${word(w === C && from === B && contract === PUNKS_721 && token === 7 ? '1' : '0')}`;
    }
    if (to === DELEGATE_V1) return `0x${word(args[0] === C && args[1] === A ? '1' : '0')}`;
  }
  if (method === 'eth_getBlockByNumber') return { timestamp: '0x10', transactions: [{ hash: '0xAA', from: B, to: GOLDCOTE.toUpperCase().replace('0X', '0x'), value: '0x10', blockNumber: '0xa' }, { hash: '0xbb', from: B, to: C, value: '0x1', blockNumber: '0xa' }] };
  if (method === 'eth_getTransactionByHash') return params[0] === '0xaa' ? { hash: '0xaa', from: B, to: GOLDCOTE, value: '0x10', blockNumber: '0xa' } : null;
  if (method === 'eth_getTransactionReceipt') return { status: '0x1' };
  throw new Error(`no ${method}`);
};

test('who holds a punk: the CryptoPunks contract says, or the wrapper it sits in', async () => {
  assert.deepEqual(await holderOf(fake(), 5), { holder: A, contract: PUNKS });
  const asked = [];
  assert.deepEqual(await holderOf(fake(asked), 6), { holder: B, contract: WRAPPED_PUNKS });
  assert.deepEqual(asked, [`call ${PUNKS}`, `call ${WRAPPED_PUNKS}`]);
  assert.deepEqual(await holderOf(fake(), 7), { holder: B, contract: PUNKS_721 });
  assert.equal(await ownerOf(fake(), 7), B);
});

test('who acts for its holder: v2 first, for the contract the punk sits in and for CryptoPunks, then v1', async () => {
  const asked = [];
  assert.equal(await delegateOf(fake(asked), C, A, 5), 'delegate-v1');
  assert.deepEqual(asked, [`call ${DELEGATE_V2}`, `call ${DELEGATE_V1}`]);
  const wrapped = [];
  assert.equal(await delegateOf(fake(wrapped), C, B, 7, PUNKS_721), 'delegate-v2');
  assert.deepEqual(wrapped, [`call ${DELEGATE_V2}`]);
  assert.equal(await delegateOf(fake(), C, B, 6, WRAPPED_PUNKS), null);
  assert.deepEqual(await holds(fake(), A.toUpperCase().replace('0X', '0x'), 5), { holder: A, via: 'owner', contract: PUNKS });
  assert.deepEqual(await holds(fake(), B, 6), { holder: B, via: 'owner', contract: WRAPPED_PUNKS });
  assert.deepEqual(await holds(fake(), C, 7), { holder: B, via: 'delegate-v2', contract: PUNKS_721 });
  assert.deepEqual(await holds(fake(), C, 5), { holder: A, via: 'delegate-v1', contract: PUNKS });
  assert.deepEqual(await holds(fake(), A, 6), { holder: B, via: null, contract: WRAPPED_PUNKS });
});

test('the plain transfers to goldcote.eth, and one by its hash', async () => {
  const seen = await transfersTo(fake(), GOLDCOTE, 10, 10);
  assert.deepEqual(seen, [{ hash: '0xaa', from: B, to: GOLDCOTE, value: 16n, block: 10 }]);
  assert.deepEqual(await transferByHash(fake(), '0xaa'), { hash: '0xaa', from: B, to: GOLDCOTE, value: 16n, block: 10, ok: true });
  assert.equal(await transferByHash(fake(), '0xcc'), null);
});

test('a node that fails hands over to the next; none left is a ChainError', async () => {
  const real = globalThis.fetch;
  const hits = [];
  globalThis.fetch = async (url) => {
    hits.push(url);
    if (url === 'https://one.test') return new Response('down', { status: 502 });
    return Response.json({ jsonrpc: '2.0', id: 1, result: '0x2a' });
  };
  try {
    assert.equal(await nodeRpc(['https://one.test', 'https://two.test'])('eth_blockNumber', []), '0x2a');
    assert.deepEqual(hits, ['https://one.test', 'https://two.test']);
    globalThis.fetch = async () => { throw new Error('offline'); };
    await assert.rejects(nodeRpc(['https://one.test'])('eth_blockNumber', []), ChainError);
  } finally {
    globalThis.fetch = real;
  }
});
