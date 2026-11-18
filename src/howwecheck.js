// How a proof is checked, in plain words and Markdown: what pickthepunk.com shows at /how-we-check (and .md), and
// HOW-WE-CHECK.md in this repository. Anyone can read it before trusting a page, or build their own checker from it.

import { DELEGATE_V1, DELEGATE_V2, GOLDCOTE, PUNKS, PUNKS_721, WRAPPED_PUNKS } from './chain.js';
import { checksum } from './eth.js';

export const REPO = 'https://github.com/Goldcote/pickthepunk-claim';

/** @param {{ example?: string; authority?: string; origin?: string }} [o] an example page: its address, the address
 *  the message names (with a port on a test computer), and its origin. pickthepunk.com's #1234 when left out. */
export function howWeCheckMd(o = {}) {
  const ex = o.example ?? '1234.pickthepunk.com', authority = o.authority ?? ex, origin = o.origin ?? `https://${ex}`;
  return `# How pickthepunk checks a proof

Every CryptoPunk has a page at its number, such as ${ex}. Its holder makes the page theirs by proving they control the wallet that holds the punk. There are two ways to prove it, and neither can move the punk. Everything below is public and can be checked by anyone.

## Who holds a punk

- The CryptoPunks contract on Ethereum: \`${checksum(PUNKS)}\`. It keeps who holds each punk itself, from before NFTs had a standard: \`punkIndexToAddress(punkIndex)\` names the wallet that holds a punk (punks 0 to 9999).
- A punk can sit in a wrapper that makes it a standard NFT (ERC-721). Then the CryptoPunks contract names the wrapper, and the wrapper's \`ownerOf(punkIndex)\` names the holder:
  - Wrapped Cryptopunks \`${checksum(WRAPPED_PUNKS)}\`
  - CryptoPunks 721 \`${checksum(PUNKS_721)}\`
- A holder can let another wallet act for them on delegate.xyz, so a punk kept in a vault never has to touch a website. We accept a wallet that the registry names for the holder, for the whole vault, for the CryptoPunks contract or the wrapper the punk sits in, or for that punk, full delegations only:
  - registry v2 \`${checksum(DELEGATE_V2)}\`: \`checkDelegateForERC721(wallet, holder, contract, punkIndex, 0x0)\`
  - registry v1 \`${checksum(DELEGATE_V1)}\`: \`checkDelegateForToken(wallet, holder, contract, punkIndex)\`

## Way 1: a signed message

The wallet signs a Sign-In with Ethereum message (EIP-4361), with \`personal_sign\` (EIP-191). It names the page's address, the punk, the wallet, a code used once, and when it stops counting (ten minutes after it was asked for):

\`\`\`
${authority} wants you to sign in with your Ethereum account:
0x…

Claim ${authority} for CryptoPunk #1234. A signature only: no transaction, no gas, no approval.

URI: ${origin}/claim
Version: 1
Chain ID: 1
Nonce: …
Issued At: …
Expiration Time: …
\`\`\`

We check that the signature comes from that wallet (the address its key recovers to; a contract wallet such as a Safe answers \`isValidSignature\`, EIP-1271, with \`0x1626ba7e\`), that it arrived before the expiration time, and that the wallet holds the punk or is its delegate. The message is plain text: before signing, the wallet puts \`Ethereum Signed Message\` in front of it, and orders, permits and transactions are signed in other formats, so this signature can never be used as one of them. It costs nothing and needs no gas. We ask for this one signature and nothing else; a page with our name that asks for more is a fake.

## Way 2: a test payment to goldcote.eth

For a holder who would rather connect nothing, the way exchanges check a wallet (a "Satoshi test"):

1. We show an exact amount between 0.0000101 and 0.0000999 ETH, seven decimals, never ending in 0. The amount is the claim's code: no other open claim has it, and it counts for one hour.
2. They send exactly that amount, as a plain transfer, to goldcote.eth: \`${checksum(GOLDCOTE)}\`, the address of Goldcote Ltd, the company named in our Terms. It is one address for every claim.
3. We read the blocks mined after the claim began. A transfer to that address of the code's amount, in a block mined before the hour is up, from the wallet that holds the punk or its delegate, is the proof. Its transaction hash is kept with the page.

Only whoever controls a wallet can send from it, and the amount was shown to that claim alone. The server only reads Ethereum: it holds no key. A wrong amount or a tip stays in the company wallet, and a mistake can be sent back.

## After a proof

- The page is theirs, and its panel link goes to the email they gave. Each claimed page links to its proof (\`/proof\`): the wallet, the holder, when, and the signed message with its signature, or the transfer.
- A later proof by the same holder replaces an earlier claim, so a holder can always take their page back.
- Once a day we read who holds each claimed punk. When it has changed hands, the page goes back to waiting for its new holder, without the old holder's words and photos. Wrapping or unwrapping by the same holder keeps the page, and so does a move into the holder's own vault, delegated to the wallet that proved it.

## Check a proof yourself

Each claimed page also gives its proof as data, at \`/proof.json\`. Our check tool reads it and checks it again from public Ethereum data, without trusting us:

\`\`\`
npx github:Goldcote/pickthepunk-claim 1234
\`\`\`

It checks that the signed message is the claim message for that punk, word for word, and that the signature comes from the wallet it names (or that the transfer went from that wallet to goldcote.eth with the code's amount). Then it reads who holds the punk today. It asks a public Ethereum node; \`--rpc\` and an address of your own picks another.

## The code

What the claim page asks your wallet for, the message, these checks and the check tool are open: ${REPO}. pickthesite runs a released version of it, named at the foot of every claim page, and the script your browser runs on a claim page (\`/site/claim.js\`) is that version's \`browser/claim.js\`, byte for byte.
`;
}
