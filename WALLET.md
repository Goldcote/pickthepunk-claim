# What your wallet will show

This is what a pickthepunk.com claim page asks your wallet for, word for word, and what should make you stop. The claim page shows the same under “Before you connect: see exactly what your wallet will show”. If a page and this file ever differ, trust this file and your wallet, not the page.

## Two requests, and nothing else

1. **Connect.** Your wallet names the site that asks, such as 1234.pickthepunk.com, and says it may see your address. MetaMask, for one, adds that a connected site may suggest transactions: it says that of every site, and the claim page never suggests one.
2. **Sign in.** A sign-in request with the message below. It is free.

Once it is signed, the page asks your wallet to drop the connection. Many wallets do that without a window.

A browser wallet connects straight to the page. A phone wallet connects by QR code through WalletConnect, which carries the request but can’t sign anything.

For developers, these are the only three calls the page’s script (browser/claim.js) makes to a wallet: `eth_requestAccounts`, `personal_sign` and `wallet_revokePermissions`. The tests check that it makes no other.

## The sign-in, line by line

```
1234.pickthepunk.com wants you to sign in with your Ethereum account:
0x… (your wallet, with its checksum)

Claim 1234.pickthepunk.com for CryptoPunk #1234. A signature only: no transaction, no gas, no approval.

URI: https://1234.pickthepunk.com/claim
Version: 1
Chain ID: 1
Nonce: … (a code used once)
Issued At: … (now)
Expiration Time: … (ten minutes from now)
```

1. **The page’s own address.** MetaMask, and other wallets that read sign-ins, check it matches the site you’re on and warn you if it doesn’t.
2. **Your wallet:** the one that holds the punk, itself or through Wrapped Cryptopunks or CryptoPunks 721, or a wallet you linked to it on delegate.xyz.
3. **What you agree to, in words.** The promise “no transaction, no gas, no approval” is part of what you sign, and it goes public with your proof.
4. **Chain ID 1:** Ethereum’s main network, where CryptoPunks live.
5. **The nonce:** a code used once, good for ten minutes. Once you connect, the claim page shows the same code, so you can match the two.

Some wallets, and hardware wallets on their own screen, show it as plain text. A Ledger set to always show hashes adds a “Message hash” after the words: that’s normal.

## Why this sign-in can’t take your punk

- **What the page asks for:** a sign-in, words you can read. Before signing, your wallet puts “Ethereum Signed Message” in front of them (EIP-191). Orders, permits and transactions are signed in other formats, so this can never pass as one of them.
- **What can take a punk:** a transaction (a transfer, an approval for a wrapped punk, or an offer on the CryptoPunks market, which sells the punk to whoever pays), each with a network fee; or, for a wrapped punk, an order or a permit (typed data, EIP-712, with fields such as Offer, Consideration or Seaport, signed for a marketplace).

Your punk moves only by a transaction from its wallet, or, when it is wrapped, through a contract that wallet approved, such as a marketplace, which needs an order signed in its own format. A sign-in is neither, so it adds no way to move your punk, even with open approvals on OpenSea or Blur.

## Even if a claim page were ever tampered with

You don’t have to trust the page alone. Your wallet shows each request for what it is: no page can make an order, an offer or an approval look like a sign-in. A tampered page could change its own preview too, so the same rules live here, where every change stays on public record. If your wallet ever shows anything but the sign-in above, stop: it isn’t us.

## Stop and reject if your wallet shows any of these

- A network fee, gas, or “Confirm transaction”
- “Approve”, “setApprovalForAll”, “Increase allowance”, “Permit” or “Permit2”
- Typed data, or fields like Offer, Consideration, Order or Listing
- Seaport, OpenSea, Blur, LooksRare or any other marketplace
- A hash with no words, or “Blind signing” on a hardware wallet
- Another site’s name than the page’s own address, or any warning from your wallet

Rejecting costs nothing, and nothing has happened. Way 2 needs no connection at all: you send the claim’s exact amount to goldcote.eth from your own wallet (HOW-WE-CHECK.md says how it is checked).

## After you sign

We check the signature at once and look up on Ethereum that your wallet holds the punk, or is its delegate. The page becomes yours, your panel link goes to your email, and the page drops the connection. The signed words and the signature go on the page’s public proof (`/proof`, and `/proof.json`), for anyone to check on Etherscan or with this repository’s check tool.
