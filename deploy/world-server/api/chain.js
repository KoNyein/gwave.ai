// ============================================================
// chain.js — Web3 Phase 1: Skin NFT Mint (ethers.js)
// CHAIN_MODE=off      — NFT feature ပိတ်ထား (default)
// CHAIN_MODE=mock     — chain အတုဖြင့် စမ်းသပ် (dev/test)
// CHAIN_MODE=testnet  — Polygon Amoy / Sepolia အစစ် (RPC_URL, PRIVATE_KEY,
//                       NFT_CONTRACT env လိုအပ် — contracts/ ကိုကြည့်)
//
// Custodial mint — game ရဲ့ signer wallet က ကစားသမား address ဆီ mint ပေး
// (ကစားသမားက gas မဆောင်ရ — Phase 1 အတွက် အလွယ်ဆုံးပုံစံ)
// ============================================================
const MODE = process.env.CHAIN_MODE || 'off';

let mockTokenId = 0;

const ABI = [
  'function mintSkin(address to, string itemId) returns (uint256)',
  'event SkinMinted(address indexed to, uint256 indexed tokenId, string itemId)',
];

let contract = null;
async function init() {
  if (MODE !== 'testnet') return;
  const { ethers } = require('ethers');
  const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
  const signer = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
  contract = new (require('ethers').Contract)(process.env.NFT_CONTRACT, ABI, signer);
  console.log('⛓️ NFT testnet mode —', process.env.NFT_CONTRACT);
}

// → { ok, tx_hash, token_id, explorer } | { ok:false, error }
async function mintSkin(toAddress, itemId) {
  if (MODE === 'off') return { ok: false, error: 'NFT feature ပိတ်ထားသည် (CHAIN_MODE=off)' };
  if (!/^0x[a-fA-F0-9]{40}$/.test(toAddress)) return { ok: false, error: 'wallet address မမှန်ပါ' };

  if (MODE === 'mock') {
    mockTokenId++;
    return {
      ok: true, token_id: mockTokenId,
      tx_hash: '0xmock' + Math.random().toString(16).slice(2, 14).padEnd(12, '0'),
      explorer: null, mode: 'mock',
    };
  }

  // testnet
  try {
    const tx = await contract.mintSkin(toAddress, itemId);
    const receipt = await tx.wait();
    let tokenId = null;
    for (const log of receipt.logs) {
      try {
        const parsed = contract.interface.parseLog(log);
        if (parsed?.name === 'SkinMinted') tokenId = Number(parsed.args.tokenId);
      } catch {}
    }
    const explorerBase = process.env.EXPLORER_URL || 'https://amoy.polygonscan.com';
    return { ok: true, tx_hash: tx.hash, token_id: tokenId, explorer: `${explorerBase}/tx/${tx.hash}`, mode: 'testnet' };
  } catch (e) {
    return { ok: false, error: 'mint မအောင်မြင်: ' + (e.shortMessage || e.message) };
  }
}

module.exports = { init, mintSkin, MODE };
