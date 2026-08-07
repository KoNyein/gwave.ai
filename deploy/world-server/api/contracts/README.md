# GwaveSkins NFT Contract — Testnet Deploy လမ်းညွှန်

## ၁။ Testnet ရွေး — **Polygon Amoy** (အကြံပြု — gas အခမဲ့နီးပါး)
- Faucet: https://faucet.polygon.technology (Amoy POL တောင်း)
- RPC: https://rpc-amoy.polygon.technology
- Explorer: https://amoy.polygonscan.com

## ၂။ Deploy
```bash
cd api
npm install   # ethers + solc + @openzeppelin/contracts ပါပြီးသား
RPC_URL=https://rpc-amoy.polygon.technology \
PRIVATE_KEY=0x<game-wallet-private-key> \
BASE_URI=https://gwave.cc/nft/skins/ \
node deploy-contract.js
# → Deployed: 0x.... ကို မှတ်ထား
```

## ၃။ Stats API ကို ချိတ်
systemd env ထဲ ထည့် —
```ini
Environment=CHAIN_MODE=testnet
Environment=RPC_URL=https://rpc-amoy.polygon.technology
Environment=PRIVATE_KEY=0x<game-wallet-private-key>
Environment=NFT_CONTRACT=0x<deployed-address>
```

## ၄။ Metadata (baseURI)
`https://gwave.cc/nft/skins/skin_gold.json` ပုံစံ —
```json
{ "name": "ရွှေရောင် Skin", "description": "GWAVE STRIKE skin",
  "image": "https://gwave.cc/nft/skins/skin_gold.png",
  "attributes": [{ "trait_type": "rarity", "value": "gold" }] }
```
ကစားသမားက ဂိမ်းထဲ [I] → ပိုင်ဆိုင်ပြီး skin → "⛓️ NFT ထုတ်ရန်" → MetaMask address ဆီ mint ။
Mainnet မပြောင်းခင် Amoy မှာ လုံလောက်စွာ စမ်းပါ။
