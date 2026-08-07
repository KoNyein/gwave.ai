// ============================================================
// Wallet.js — Web3 မိတ်ဆက် အဆင့် ၁: Wallet ချိတ်ဆက်ခြင်း
// MetaMask (window.ethereum) ဖြင့် ကစားသမား၏ address ကို ရယူသည်
// နောက်အဆင့်: ethers.js ထည့်၍ token balance / NFT ဖတ်ခြင်း
// ============================================================
export class Wallet {
  constructor() { this.address = null; }

  hasProvider() { return typeof window.ethereum !== 'undefined'; }

  async connect() {
    if (!this.hasProvider()) {
      return { error: 'MetaMask (သို့) Web3 wallet မတွေ့ပါ။ metamask.io မှ ထည့်သွင်းပါ။' };
    }
    try {
      const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
      this.address = accounts[0];

      // Account ပြောင်းလျှင် အလိုအလျောက် သိအောင်
      window.ethereum.on?.('accountsChanged', (acc) => {
        this.address = acc[0] ?? null;
        this.onChange?.(this.address);
      });
      return { address: this.address };
    } catch (e) {
      return { error: 'ချိတ်ဆက်မှု ပယ်ဖျက်ခံရသည် (သို့) အမှားရှိသည်။' };
    }
  }

  // 0x1234...abcd ပုံစံ အတိုချုံ့
  short() {
    if (!this.address) return '';
    return this.address.slice(0, 6) + '…' + this.address.slice(-4);
  }
}
