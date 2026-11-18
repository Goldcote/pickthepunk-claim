// The words people read stay the words the code uses: HOW-WE-CHECK.md is the text the site shows, WALLET.md lists every
// stop sign and request the code knows, the version is one version, and no dashes stand in for words.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { howWeCheckMd, statement, stopSigns, VERSION, WALLET_REQUESTS } from '../src/index.js';

const read = (f) => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');

test('HOW-WE-CHECK.md is the text pickthepunk.com shows at /how-we-check', () => {
  assert.equal(read('HOW-WE-CHECK.md'), howWeCheckMd());
});

test('WALLET.md lists every stop sign and request, and the message’s own sentence', () => {
  const md = read('WALLET.md');
  for (const s of stopSigns()) assert.ok(md.includes(`- ${s}\n`), s);
  for (const r of WALLET_REQUESTS) assert.ok(md.includes(`\`${r.method}\``), r.method);
  assert.ok(md.includes(statement('1234.pickthepunk.com', 1234)));
});

test('one version: the package’s, the code’s and the README’s', () => {
  assert.equal(JSON.parse(read('package.json')).version, VERSION);
  assert.ok(read('README.md').includes(`\`v${VERSION}\``));
});

test('no dashes stand in for words', () => {
  for (const f of ['README.md', 'WALLET.md', 'HOW-WE-CHECK.md']) assert.doesNotMatch(read(f), /[—–]/, f);
});
