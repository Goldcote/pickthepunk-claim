// The Ethereum helpers against answers worked out elsewhere: ethers' hashMessage and signMessage, EIP-55's own examples,
// and the selectors every block explorer shows.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { secp256k1 } from '@noble/curves/secp256k1.js';
import { bytesToHex, callData, checksum, decodeAddress, decodeBool, encUint, ethOf, keccak, personalHash, recoverSigner, selector } from '../src/index.js';

test('the hash a wallet signs for a plain message is ethers’ hashMessage', () => {
  assert.equal(bytesToHex(personalHash('Hello World')), '0xa1de988600a42c4b4ab089b619297c17d53cffae5d5120d82d8a92d0bb3b78f2');
});

test('a signature made by ethers names the key’s wallet, and nothing else does', () => {
  const sig = '0xe0ed34fbbe927a58267ce2e8067a611c69869e20e731bc99187a8bc97058664c16de07f7660f06ce0985d1d8e063726783033fda59b307897f26a21392d62b3a1c';
  assert.equal(recoverSigner(personalHash('Hello World'), sig), '0x14791697260e4c9a71f18484c9f997b308e59325');
  assert.notEqual(recoverSigner(personalHash('Hello World!'), sig), '0x14791697260e4c9a71f18484c9f997b308e59325');
  assert.equal(recoverSigner(personalHash('Hello World'), '0x1234'), null);
  assert.equal(recoverSigner(personalHash('Hello World'), 'nope'), null);
  assert.equal(recoverSigner(personalHash('Hello World'), `${sig.slice(0, -2)}1d`), null); // (v must be 27 or 28)
});

test('signing and recovering agree for any key (the curve maths, both ways)', () => {
  for (const seed of [1, 7, 200]) {
    const key = new Uint8Array(32).fill(seed);
    const address = bytesToHex(keccak(secp256k1.getPublicKey(key, false).slice(1)).slice(12));
    const rec = secp256k1.sign(personalHash(`claim ${seed}`), key, { prehash: false, format: 'recovered' });
    const sig = new Uint8Array(65); sig.set(rec.slice(1), 0); sig[64] = 27 + rec[0];
    assert.equal(recoverSigner(personalHash(`claim ${seed}`), bytesToHex(sig)), address);
  }
});

test('addresses are written with their checksum (EIP-55’s examples)', () => {
  for (const a of ['0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed', '0xfB6916095ca1df60bB79Ce92cE3Ea74c37c5d359', '0xdbF03B407c01E7cD3CBea99509d93f8DDDC8C6FB', '0xD1220A0cf47c7B9Be7A2E6BA89F429762e7b9aDb']) {
    assert.equal(checksum(a.toLowerCase()), a);
  }
});

test('calls are encoded as Solidity does it', () => {
  assert.equal(selector('ownerOf(uint256)'), '0x6352211e');
  assert.equal(selector('isValidSignature(bytes32,bytes)'), '0x1626ba7e');
  assert.equal(callData('ownerOf(uint256)', [{ s: encUint(1234) }]), `0x6352211e${'0'.repeat(61)}4d2`);
  // a dynamic bytes argument: its offset (64), then its length and its bytes, padded to 32
  const d = callData('isValidSignature(bytes32,bytes)', [{ s: 'ab'.repeat(32) }, { bytes: '0x0102' }]);
  assert.equal(d, `0x1626ba7e${'ab'.repeat(32)}${encUint(64)}${encUint(2)}0102${'0'.repeat(60)}`);
  assert.equal(decodeAddress(`0x${'0'.repeat(24)}${'ab'.repeat(20)}`), `0x${'ab'.repeat(20)}`);
  assert.equal(decodeAddress('0x12'), null);
  assert.equal(decodeBool(`0x${'0'.repeat(63)}1`), true);
  assert.equal(decodeBool(`0x${'0'.repeat(64)}`), false);
});

test('amounts are written in full, never rounded', () => {
  assert.equal(ethOf(42100000000000n), '0.0000421');
  assert.equal(ethOf(10n ** 18n), '1');
  assert.equal(ethOf(1n), '0.000000000000000001');
});
