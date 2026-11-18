// WalletConnect for a pickthepunk.com claim page: Reown's AppKit (@reown/appkit and @reown/appkit-adapter-ethers
// 1.8.24), bundled with esbuild into the page's /site/wallet.js. browser/claim.js loads it only when a visitor picks a
// phone wallet. It connects one wallet, hands claim.js its provider for one signature, and disconnects: no email or
// social sign-in, no swaps, no analytics. WalletConnect carries the requests between the page and the phone; only the
// wallet can sign.
import { createAppKit } from '@reown/appkit';
import { EthersAdapter } from '@reown/appkit-adapter-ethers';
import { mainnet } from '@reown/appkit/networks';

let kit = null;
window.punkWallet = {
  /** Opens AppKit's window; resolves once a wallet is connected, with its EIP-1193 provider. */
  async connect(projectId, metadata) {
    if (!kit) {
      kit = createAppKit({
        adapters: [new EthersAdapter()], networks: [mainnet], defaultNetwork: mainnet, projectId, metadata,
        features: { analytics: false, email: false, socials: false, swaps: false, onramp: false, send: false, history: false, receive: false },
        themeMode: 'light', themeVariables: { '--w3m-accent': '#1b1938', '--w3m-border-radius-master': '2px' },
      });
    }
    const connected = () => kit.getIsConnectedState() && kit.getAddress();
    if (!connected()) {
      await kit.open({ view: 'Connect' });
      await new Promise((resolve, reject) => {
        const offAccount = kit.subscribeAccount((a) => { if (a && a.isConnected && a.address) { offAccount(); offState(); resolve(); } });
        const offState = kit.subscribeState((s) => { if (!s.open && !connected()) { offAccount(); offState(); reject(new Error('closed')); } });
      });
    }
    await kit.close();
    return { provider: kit.getWalletProvider(), address: kit.getAddress(), disconnect: () => kit.disconnect() };
  },
};
