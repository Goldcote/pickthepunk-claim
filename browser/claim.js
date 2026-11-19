// The script on a pickthepunk.com claim page, served there as /site/claim.js: this file, byte for byte. Way 1
// connects a wallet and asks it for one signature; way 2 shows the code page and keeps it current (and also works
// without this script). It asks a wallet for three things and nothing else (src/claim.js, WALLET_REQUESTS):
// eth_requestAccounts, personal_sign with the claim message, and wallet_revokePermissions once it is signed. Nothing
// here holds or sends a key: the wallet signs, the server checks.
(() => {
  const form = document.getElementById('clForm');
  const box = document.getElementById('clCodeBox');
  const say = (el, t, kind) => {
    if (!el) return;
    el.className = `cl-status${kind ? ` ${kind}` : ''}`;
    el.querySelector('span').textContent = t;
  };
  const post = async (path, body) => {
    const r = await fetch(path, { method: 'POST', headers: { 'content-type': 'application/json', accept: 'application/json' }, credentials: 'same-origin', body: JSON.stringify(body) });
    return r.json().catch(() => ({ error: 'chain' }));
  };
  const short = (a) => `${a.slice(0, 6)}…${a.slice(-4)}`;
  // what happens is brought into view: smoothly, or at once for someone whose device asks for less motion
  const still = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
  const reveal = (el) => el.scrollIntoView({ behavior: still() ? 'auto' : 'smooth', block: 'center' });
  // a proof ends in confetti: pieces in the page's own colours fall once (the page's stylesheet draws .cl-confetti); none
  // for less motion
  const confetti = () => {
    if (still()) return;
    const sky = document.createElement('div');
    sky.className = 'cl-confetti';
    sky.setAttribute('aria-hidden', 'true');
    for (let i = 0; i < 90; i++) {
      const p = document.createElement('i');
      p.className = `c${i % 4}`;
      p.style.setProperty('--x', `${(Math.random() * 100).toFixed(2)}vw`);
      p.style.setProperty('--d', `${(Math.random() * 0.7).toFixed(2)}s`);
      p.style.setProperty('--t', `${(2 + Math.random() * 1.4).toFixed(2)}s`);
      p.style.setProperty('--r', `${Math.round(Math.random() * 900 - 450)}deg`);
      p.style.setProperty('--w', `${Math.round(Math.random() * 160 - 80)}px`);
      sky.append(p);
    }
    document.body.append(sky);
    setTimeout(() => sky.remove(), 4500);
  };

  // "See what your wallet will show": a link to the look-before-you-connect panel opens it
  const see = document.getElementById('see');
  if (see) {
    const open = () => { see.open = true; };
    if (location.hash === '#see') open();
    for (const a of document.querySelectorAll('a[href="#see"]')) a.addEventListener('click', open);
  }

  if (form) {
    const id = form.dataset.punk;
    const email = document.getElementById('clEmail');
    const btn = document.getElementById('clConnect');
    const list = document.getElementById('clWallets');
    const msg = document.getElementById('clMsg');
    const status = document.getElementById('clStatus');
    const WORDS = {
      email: 'Type the email your panel link should go to.',
      wallet: 'Connect your wallet first.',
      busy: 'Too many tries from here for now. Try again in an hour.',
      chain: 'Ethereum can’t be read right now. Try again in a minute.',
      expired: 'The message’s ten minutes are over. Connect again for a new one.',
      signature: 'That signature isn’t from this wallet. Try again.',
      not_found: 'This claim isn’t there any more. Start again.',
    };
    const words = (e, holder) => (e === 'not_holder'
      ? `This wallet doesn’t hold #${id}, and isn’t linked to its holder on delegate.xyz.${holder ? ` #${id} is held by ${short(holder)}.` : ''} Connect that wallet, or a wallet it delegated to.`
      : WORDS[e] || WORDS.chain);

    // wallets in this browser tell us they are there (EIP-6963); an older one only sets window.ethereum
    const wallets = new Map();
    window.addEventListener('eip6963:announceProvider', (e) => { const d = e.detail; if (d && d.info && d.info.uuid && d.provider) wallets.set(d.info.uuid, d); });
    window.dispatchEvent(new Event('eip6963:requestProvider'));
    btn.disabled = false;

    let busy = false;
    const showMessage = (text) => {
      msg.textContent = '';
      for (const line of text.split('\n').filter(Boolean)) { const s = document.createElement('span'); s.textContent = line; msg.append(s); }
    };
    const signWith = async (provider, leave) => {
      if (busy) return;
      busy = true;
      list.hidden = true;
      try {
        say(status, 'Connecting to your wallet…');
        const accounts = await provider.request({ method: 'eth_requestAccounts' });
        const wallet = accounts && accounts[0];
        if (!wallet) throw Object.assign(new Error('no account'), { code: 4001 });
        say(status, 'Getting your message…');
        const r = await post('/claim/start', { email: email.value.trim(), way: 'sign', wallet });
        if (r.error) { say(status, words(r.error), 'bad'); return; }
        showMessage(r.message);
        say(status, 'Sign the message in your wallet. It costs nothing.');
        const hex = `0x${Array.from(new TextEncoder().encode(r.message), (b) => b.toString(16).padStart(2, '0')).join('')}`;
        const signature = await provider.request({ method: 'personal_sign', params: [hex, wallet] });
        say(status, 'Checking it on Ethereum…');
        const v = await post(`/claim/${r.id}/sign`, { signature });
        if (v.ok) {
          // the end, where it can be seen: its panel and its page a click away (the panel's address comes from the
          // server: a sign-in of its own for a new email, else the panel's front page), in view and in focus, and confetti
          say(status, `Proved. #${id}’s page is yours.`, 'done');
          btn.disabled = true;
          const row = document.createElement('div');
          row.className = 'cl-done';
          if (v.panel) { const a = document.createElement('a'); a.href = v.panel; a.className = 'cl-btn'; a.textContent = 'Open your panel'; row.append(a); }
          const see = document.createElement('a');
          see.href = '/'; see.className = v.panel ? 'cl-btn2' : 'cl-btn'; see.textContent = `See #${id}’s page`;
          row.append(see);
          const note = document.createElement('p');
          note.className = 'cl-small';
          note.textContent = `Your panel link is also on its way to ${email.value.trim()}.`;
          status.after(row, note);
          confetti();
          reveal(status);
          row.querySelector('a').focus({ preventScroll: true });
        } else say(status, words(v.error, v.holder), 'bad');
      } catch (e) {
        say(status, e && e.code === 4001 ? 'You said no in your wallet: nothing was signed.' : 'Your wallet didn’t answer. Try again, or use way 2.', 'bad');
      } finally {
        busy = false;
        // we drop the connection once it's signed (the plan's promise): the wallet forgets this page
        try { await provider.request({ method: 'wallet_revokePermissions', params: [{ eth_accounts: {} }] }); } catch { /* not every wallet knows it */ }
        if (leave) try { await leave(); } catch { /* gone already */ }
      }
    };

    btn.addEventListener('click', () => {
      if (!email.checkValidity()) { email.reportValidity(); email.focus(); return; }
      list.textContent = '';
      const found = [...wallets.values()];
      if (!found.length && window.ethereum) found.push({ info: { name: 'Browser wallet', icon: '' }, provider: window.ethereum });
      for (const w of found) {
        const b = document.createElement('button');
        b.type = 'button'; b.className = 'cl-wallet';
        if (w.info.icon && /^data:image\//.test(w.info.icon)) { const i = new Image(); i.src = w.info.icon; i.alt = ''; i.width = 28; i.height = 28; b.append(i); }
        b.append(document.createTextNode(w.info.name || 'Browser wallet'));
        b.addEventListener('click', () => signWith(w.provider));
        list.append(b);
      }
      // a phone wallet through WalletConnect (public/site/wallet.js, loaded only now, when the page has its project id)
      if (form.dataset.reown) {
        const b = document.createElement('button');
        b.type = 'button'; b.className = 'cl-wallet wc';
        b.textContent = 'A phone wallet (WalletConnect QR code)';
        b.addEventListener('click', async () => {
          try {
            say(status, 'Opening WalletConnect…');
            if (!window.punkWallet) await new Promise((ok, no) => { const sc = document.createElement('script'); sc.src = `/site/wallet.js?v=${form.dataset.v || ''}`; sc.onload = ok; sc.onerror = no; document.head.append(sc); });
            const w = await window.punkWallet.connect(form.dataset.reown, { name: 'pickthepunk', description: 'A page for every CryptoPunk', url: location.origin, icons: [`${location.origin}/favicon.ico`] });
            await signWith(w.provider, w.disconnect);
          } catch { say(status, 'The connection didn’t open. Try again, or use way 2.', 'bad'); }
        });
        list.append(b);
      }
      if (!list.children.length) {
        const p = document.createElement('p');
        p.textContent = 'No wallet in this browser. Open this page in your wallet app’s browser, or use way 2 below: it needs nothing connected.';
        list.append(p);
      }
      list.hidden = false;
      // the list shows under the message, so it is brought into view and its first wallet into focus: the click visibly
      // does something
      reveal(list);
      const first = list.querySelector('button');
      if (first) first.focus({ preventScroll: true });
    });
  }

  if (box) {
    // copy, and the hour in the visitor's own time
    for (const b of document.querySelectorAll('[data-copy]')) {
      b.addEventListener('click', async () => {
        try { await navigator.clipboard.writeText(b.dataset.copy); b.textContent = 'Copied'; }
        catch { const r = document.createRange(); r.selectNodeContents(b.previousElementSibling); const s = getSelection(); s.removeAllRanges(); s.addRange(r); }
        setTimeout(() => { b.textContent = 'Copy'; }, 1600);
      });
    }
    for (const t of document.querySelectorAll('time[data-local]')) t.textContent = new Date(t.dateTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    if (box.dataset.status === 'open') {
      // every 8 seconds: has it arrived, or did a transfer come from another wallet? The page then shows it.
      const from = box.dataset.from || '';
      setInterval(async () => {
        if (document.visibilityState !== 'visible') return;
        const r = await fetch(`/claim/${box.dataset.claim}?json`, { headers: { accept: 'application/json' }, credentials: 'same-origin' }).then((x) => x.json()).catch(() => null);
        if (r && (r.status !== 'open' || (r.from || '') !== from)) {
          if (r.status === 'proved') try { sessionStorage.setItem('cl-proved', box.dataset.claim); } catch { /* the page still shows it */ }
          location.reload();
        }
      }, 8000);
    }
    // proved while this page watched: its end, in view and in focus, with confetti (once)
    let seen = null;
    try { seen = sessionStorage.getItem('cl-proved'); sessionStorage.removeItem('cl-proved'); } catch { /* no storage */ }
    if (box.dataset.status === 'proved' && seen === box.dataset.claim) {
      const end = document.querySelector('.cl-done') || box;
      confetti();
      reveal(end);
      const a = end.querySelector('a');
      if (a) a.focus({ preventScroll: true });
    }
  }
})();
