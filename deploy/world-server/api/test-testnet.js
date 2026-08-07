// ============================================================
// test-testnet.js — Amoy testnet အစစ်ပေါ်မှာ လက်တွေ့စမ်းသပ်ရန်
// (Contract deploy ပြီးမှ run — contracts/README.md အဆင့် ၂ အပြီး)
//
// RPC_URL=https://rpc-amoy.polygon.technology \
// PRIVATE_KEY=0x<game-wallet-key> \
// NFT_CONTRACT=0x<deployed-address> \
// node test-testnet.js
//
// စစ်ဆေးမည့်အရာများ — mint tx အောင်/မအောင်, tokenId, ownerOf, tokenURI
// ============================================================
const { ethers } = require('ethers');

const ABI = [
  'function mintSkin(address to, string itemId) returns (uint256)',
  'function ownerOf(uint256 tokenId) view returns (address)',
  'function tokenURI(uint256 tokenId) view returns (string)',
  'function nextTokenId() view returns (uint256)',
  'event SkinMinted(address indexed to, uint256 indexed tokenId, string itemId)',
];

async function main() {
  for (const k of ['RPC_URL', 'PRIVATE_KEY', 'NFT_CONTRACT'])
    if (!process.env[k]) { console.error(`❌ ${k} env လိုအပ်သည်`); process.exit(1); }

  const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
  const signer = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
  const contract = new ethers.Contract(process.env.NFT_CONTRACT, ABI, signer);

  const net = await provider.getNetwork();
  const bal = await provider.getBalance(signer.address);
  console.log(`🌐 Chain: ${net.name} (${net.chainId}) | Signer: ${signer.address}`);
  console.log(`💰 Balance: ${ethers.formatEther(bal)} POL`);
  if (bal === 0n) { console.error('❌ Gas မရှိ — faucet.polygon.technology မှ Amoy POL တောင်းပါ'); process.exit(1); }

  console.log('⛓️ Test mint — skin_jade → ကိုယ့် wallet…');
  const tx = await contract.mintSkin(signer.address, 'skin_jade_test');
  console.log('   tx:', tx.hash);
  const receipt = await tx.wait();
  let tokenId = null;
  for (const log of receipt.logs) {
    try {
      const parsed = contract.interface.parseLog(log);
      if (parsed?.name === 'SkinMinted') tokenId = parsed.args.tokenId;
    } catch {}
  }
  console.log(`✅ Mint အောင်မြင် — Token #${tokenId} | block ${receipt.blockNumber}`);
  console.log('   owner:', await contract.ownerOf(tokenId));
  console.log('   tokenURI:', await contract.tokenURI(tokenId));
  console.log(`🔎 Explorer: https://amoy.polygonscan.com/tx/${tx.hash}`);
  console.log('\\n🎉 Testnet အဆင်သင့် — Stats API ကို CHAIN_MODE=testnet နဲ့ ပြန် run ပါ');
}
main().catch(e => { console.error('❌', e.shortMessage || e.message); process.exit(1); });
