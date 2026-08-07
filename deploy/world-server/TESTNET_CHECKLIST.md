# ⛓️ Amoy Testnet လက်တွေ့စမ်းသပ်ရေး Checklist (မိနစ် ၃၀)

> Sandbox/CI ထဲကမဟုတ်ဘဲ **ကိုယ့်စက် (သို့) EC2** ပေါ်မှာ run ရပါမယ် — blockchain RPC ကို
> အင်တာနက်နဲ့ တိုက်ရိုက်ချိတ်ဖို့ လိုလို့ပါ။ Script/contract အားလုံး အဆင်သင့်ပြီးသားပါ။

## ၁။ Game Wallet ဖန်တီး (၅ မိနစ်)
- [ ] MetaMask မှာ **အသစ်သီးသန့်** account ဖန်တီး (ကိုယ့်ပင်မ wallet မသုံးပါနှင့်)
- [ ] Private key export → လုံခြုံစွာသိမ်း (ဒါက game server ရဲ့ mint signer)
- [ ] MetaMask Networks → Add → **Polygon Amoy**
      (RPC: `https://rpc-amoy.polygon.technology`, ChainID: 80002, Symbol: POL)

## ၂။ Faucet မှ Gas တောင်း (၂ မိနစ်)
- [ ] https://faucet.polygon.technology → Amoy → wallet address ထည့် → POL ရ (အခမဲ့)

## ၃။ Contract Deploy (၅ မိနစ်)
```bash
cd gwave-metaverse-base/api && npm install
RPC_URL=https://rpc-amoy.polygon.technology \
PRIVATE_KEY=0x<key> \
BASE_URI=https://gwave.cc/nft/skins/ \
node deploy-contract.js
```
- [ ] `🚀 Deployed: 0x....` address ကို မှတ်ထား
- [ ] amoy.polygonscan.com မှာ address ရိုက်ရှာ → contract ပေါ်နေကြောင်း စစ်

## ၄။ On-chain စမ်းသပ် (၅ မိနစ်)
```bash
RPC_URL=... PRIVATE_KEY=... NFT_CONTRACT=0x<deployed> node test-testnet.js
```
- [ ] `✅ Mint အောင်မြင် — Token #1` + explorer link ပေါ်
- [ ] MetaMask → NFTs → Import → contract address + tokenId → 🖼️ မြင်ရ

## ၅။ Stats API ကို testnet ချိတ် (၅ မိနစ်)
```bash
CHAIN_MODE=testnet RPC_URL=... PRIVATE_KEY=... NFT_CONTRACT=0x... \
GAME_KEY=... POS_KEY=... npm start
```
- [ ] `⛓️ NFT testnet mode` log ပေါ်
- [ ] `curl localhost:8790/health` → `"chain":"testnet"`

## ၆။ ဂိမ်းထဲက အစအဆုံး စမ်း (၁၀ မိနစ်)
- [ ] ဂိမ်းဝင် → Strike မှာ GP ရှာ → [I] → skin ဝယ်
- [ ] 🦊 Wallet ချိတ် (ကစားသမား MetaMask — game wallet မဟုတ်)
- [ ] Skin ဘေးက **⛓️ NFT** နှိပ် → toast မှာ tx link → explorer မှာ စစ်
- [ ] MetaMask NFTs ထဲ skin ရောက် ✅
- [ ] Season ဆုရပြီးသားဆို [I] → **🏆 Trophy ထုတ်** ပါ စမ်း

## ⚠️ လုံခြုံရေး
- PRIVATE_KEY ကို git ထဲ **ဘယ်တော့မှ** မထည့်ပါနှင့် — systemd env / .env (gitignore) သီးသန့်
- Mainnet မပြောင်းခင် Amoy မှာ အနည်းဆုံး ၁-၂ ပတ် စမ်းပါ
