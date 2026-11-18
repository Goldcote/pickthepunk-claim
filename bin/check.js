#!/usr/bin/env node
// Check a pickthepunk.com page's proof yourself, from public Ethereum data, without trusting us:
//
//   npx github:Goldcote/pickthepunk-claim 1234
//   npx github:Goldcote/pickthepunk-claim 1234.pickthepunk.com --rpc https://your-own-node.example
//
// It reads the page's proof (/proof.json), checks the signed message word for word and its signature (or the transfer
// to goldcote.eth), then reads who holds the punk today. It only reads: no wallet, no key, nothing sent.

import { checkProof } from '../src/check.js';
import { nodeRpc, PUBLIC_NODES } from '../src/chain.js';

const args = process.argv.slice(2);
const at = args.indexOf('--rpc');
const nodes = at >= 0 && args[at + 1] ? [args[at + 1]] : PUBLIC_NODES;
const target = args.find((a, i) => !a.startsWith('--') && (at < 0 || i !== at + 1));
if (!target || args.includes('--help')) {
  console.log('Check a pickthepunk.com page’s proof yourself:\n  npx github:Goldcote/pickthepunk-claim <punk number or page address> [--rpc <your Ethereum node>]');
  process.exit(args.includes('--help') ? 0 : 2);
}
try {
  const r = await checkProof(target, { rpc: nodeRpc(nodes) });
  console.log(r.lines.join('\n'));
  if (r.lines[0]?.startsWith('CryptoPunk #')) console.log(`(Ethereum read through ${nodes.join(' or ')})`);
  process.exit(r.ok ? 0 : 1);
} catch (e) {
  console.log(`Ethereum could not be read (${e?.message ?? e}). Try again, or give your own node with --rpc.`);
  process.exit(3);
}
