# pickthepunk-claim

The code behind making a CryptoPunk's page yours on [pickthepunk.com](https://pickthepunk.com): what the claim page asks your wallet for, the message you sign, how a proof is checked, and a tool to check any page's proof yourself.

No build step: the files you read here are the files that run.

## What your wallet will be asked

Two things, and nothing else: to connect, then to sign in with one plain-text message that names the page, the punk and your wallet. Never a transaction, an approval, an offer, an order or a permit, so it can't move your punk or put it up for sale, wrapped or not, even with open approvals on OpenSea or Blur.

[WALLET.md](WALLET.md) shows the message line by line, says why it can't take your punk, and lists what should make you stop and reject. The claim page shows the same under "Before you connect: see exactly what your wallet will show". If a page and WALLET.md ever differ, trust WALLET.md and your wallet, not the page.

Rather connect nothing? Way 2 asks only for a transfer of a few cents, an exact amount that is the claim's code, from your own wallet to goldcote.eth. [HOW-WE-CHECK.md](HOW-WE-CHECK.md) says how both ways are checked.

## Who holds a punk

CryptoPunks keep their holders in their own contract, from before NFTs had a standard (`punkIndexToAddress`). A punk can also sit in a wrapper that makes it a standard NFT, Wrapped Cryptopunks or CryptoPunks 721: then the CryptoPunks contract names the wrapper, and the wrapper names the holder. The checks read both, so a punk counts as yours whether it is wrapped or not ([src/chain.js](src/chain.js)).

## Check any page's proof yourself

```
npx github:Goldcote/pickthepunk-claim 1234
```

Give a punk's number or a page's address (`1234.pickthepunk.com`). The tool reads the page's proof (`/proof.json`), checks that the signed message is the claim message for that punk word for word and that the signature comes from the wallet it names (or that the transfer went from that wallet to goldcote.eth with the code's amount), then reads who holds the punk today. It asks a public Ethereum node; `--rpc` and an address of your own picks another. It only reads: no wallet, no key, nothing sent. It needs Node.js 20.19 or later.

## What is in here

- `browser/claim.js`: the script on every claim page. pickthepunk.com serves it as `/site/claim.js`, byte for byte this file at the version the page names. The tests check it asks a wallet for `eth_requestAccounts`, `personal_sign` and `wallet_revokePermissions`, and nothing else.
- `browser/wallet-entry.js`: what a phone wallet connects through, Reown's AppKit 1.8.24 for WalletConnect, bundled with esbuild as the page's `/site/wallet.js`. The claim page loads it only when someone picks a phone wallet.
- `src/claim.js`: the message, the codes of way 2, the checks a proof has to pass, and the rules people are shown (what the page asks a wallet for, and the stop signs).
- `src/chain.js`: Ethereum, read and never written: who holds a punk (the CryptoPunks contract and its two wrappers), delegate.xyz's registries, contract wallets (EIP-1271), the transfers to goldcote.eth.
- `src/eth.js`: Keccak-256, the hash a wallet signs a plain message under (EIP-191), signature recovery, checksummed addresses (EIP-55), call encoding. The curve maths is [@noble/curves](https://github.com/paulmillr/noble-curves) and the hash [@noble/hashes](https://github.com/paulmillr/noble-hashes), both audited.
- `src/check.js` and `bin/check.js`: the check tool.
- `src/howwecheck.js`: [HOW-WE-CHECK.md](HOW-WE-CHECK.md), also at pickthepunk.com's `/how-we-check`.
- `test/`: `npm install`, then `npm test`.

## What you can check, and what you trust us for

- **You can check** the script your browser runs on a claim page: compare `/site/claim.js` with `browser/claim.js` at the version the page names. You can check every request in your wallet's own window, against [WALLET.md](WALLET.md). And you can check every claimed page's proof, with the tool above or on Etherscan.
- **You trust us** to run these same checks on our server before a page becomes someone's. You never have to: every proof is public, and the tool checks it again.

## Versions

- `v1.0.0`: the first release.

pickthepunk.com runs a tagged release of this repository, and every claim page names it at its foot. Any change comes as a new release here first.

## Who

Goldcote Ltd, the company named in pickthepunk's Terms. goldcote.eth is its address on Ethereum. A question, or a problem found: hello@pickthesite.com.

pickthepunk is independent: not affiliated with or endorsed by CryptoPunks or its owners.
