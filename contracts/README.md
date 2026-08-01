# Gwave metaverse contracts

**Base** (Ethereum L2) — gas ~$0.01၊ RPC တည်ငြိမ်၊ Coinbase ecosystem။

| Contract | စံ | ဘာလုပ်လဲ |
| --- | --- | --- |
| `GwaveLand.sol` | ERC-721 | မြေကွက် ၁၀၂၄ (32×32)၊ `tokenId = gx*32 + gz` |
| `GwaveItems.sol` | ERC-1155 | ဦးထုပ်/အဝတ် (id 1–999)၊ emote unlock (id 1000+) |

## ⚠️ မလုပ်ရမယ့်အရာများ

- **Private key / seed phrase ကို gwave က ဘယ်တော့မှ မကိုင်ရ။** Wallet
  ချိတ်ပြီး signature တောင်းရုံသာ (`/api/metaverse/siwe/*`)။
- **Deploy key ကို repo ထဲ ဘယ်တော့မှ မထည့်ရ။** `PRIVATE_KEY` ကို shell
  environment ကနေသာ ပေးပါ၊ `.env` file ထဲမှာလည်း မထားပါနဲ့။
- **ရောင်းဝယ်မှု (token sale / trading) မထည့်ရသေးဘူး** — ထိုင်းနဲ့မြန်မာမှာ
  ဥပဒေအရ ရှုပ်ထွေးနိုင်လို့ ဒီအဆင့်မှာ **ပိုင်ဆိုင်မှုအထောက်အထား** ပဲ
  ရေးထားတယ်။ ငွေကြေးဆိုင်ရာ feature မတိုင်ခင် ဥပဒေအကြံဉာဏ် ယူပါ။
- **Metaverse က wallet မပါဘဲ အပြည့်အဝ အလုပ်လုပ်ရမယ်** — contract တွေက
  ဖြည့်စွက်အလွှာသာ။

## Deploy (Foundry)

```bash
# ၁။ Foundry
curl -L https://foundry.paradigm.xyz | bash && foundryup
forge init --no-git . && forge install OpenZeppelin/openzeppelin-contracts

# ၂။ Base Sepolia (testnet) မှာ **အရင်စမ်း**
export PRIVATE_KEY=...          # ★ shell ထဲသာ — file ထဲ မထားရ
forge create contracts/GwaveLand.sol:GwaveLand \
  --rpc-url https://sepolia.base.org --private-key $PRIVATE_KEY
forge create contracts/GwaveItems.sol:GwaveItems \
  --rpc-url https://sepolia.base.org --private-key $PRIVATE_KEY

# ၃။ စမ်းပြီးမှ mainnet
#    --rpc-url https://mainnet.base.org
```

Deploy ပြီးရင် server ရဲ့ env မှာ ထည့်ပါ (Secrets Manager):

```
WEB3_RPC_URL=https://base-mainnet.g.alchemy.com/v2/<key>
WEB3_CHAIN=base                 # testnet ဆိုရင် baseSepolia
WEB3_LAND_ADDRESS=0x…
WEB3_ITEMS_ADDRESS=0x…
```

★ **Public RPC မသုံးပါနဲ့** — rate limit ရှိပြီး player များလာရင် ဂိတ်တွေ
ကျပန်း ကျမယ်။ Alchemy/QuickNode လို provider သုံးပါ။

## ဘယ်မှာ စစ်လဲ

ပိုင်ဆိုင်မှု စစ်ဆေးမှုအားလုံးက **server ဘက်မှာသာ** —
`server/metaverse/web3.js`။ Client က "ငါပိုင်တယ်" ပြောတာကို ဘယ်တော့မှ
မယုံဘူး၊ browser ထဲက JavaScript ကို ဘယ်သူမဆို ပြင်လို့ရလို့။

RPC ကျနေရင် ဂိတ်ပါတဲ့ room ကို **ငြင်းတယ်** (ဖွင့်ပေးလိုက်တာ မဟုတ်ဘူး) —
စစ်လို့မရရင် ဝင်ခွင့်မပေးတာက မှန်တဲ့ ဆုံးဖြတ်ချက်။
