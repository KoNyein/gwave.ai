#!/usr/bin/env node
/// Phase W7 — minter hot wallet ရဲ့ လက်ကျန်ကို CloudWatch ဆီ ပို့တယ်။
///
/// ★ ဘာလို့ လိုလဲ — gas ကုန်သွားရင် worker က **တိတ်တိတ်ပဲ** ရပ်တယ်။
///   Job တွေက `pending` မှာ ကပ်နေပြီး user က "ပစ္စည်း မရဘူး" လို့ပဲ
///   မြင်မယ်၊ log ဖတ်မှသာ အကြောင်းရင်း သိရမယ်။ ကုန်မှ မဟုတ်ဘဲ
///   ကုန်ခါနီးမှာ သိရမယ်။
///
/// Cron (တစ်နာရီတစ်ခါ):
///   0 * * * * cd /opt/gwave/metaverse && node scripts/report-minter-balance.mjs
///
/// ★ Private key ကို ဒီ script က **လုံးဝ မဖတ်ဘူး** — address ပဲ လိုတယ်။
///   Cron အတွက် key ထည့်ပေးစရာ မလိုအောင် သီးသန့် env သုံးထားတယ်။
/// ★ CloudWatch ကို AWS CLI နဲ့ ပို့တယ် — SDK ထည့်ရင် container image က
///   ၂၀MB လောက် ကြီးလာမယ်၊ ဒီ script က တစ်နာရီ တစ်ခါပဲ run တာ။

import { spawn } from "node:child_process";

import { createPublicClient, formatEther, http } from "viem";
import * as chains from "viem/chains";

const address = process.env.WEB3_MINTER_ADDRESS;
if (!address) {
  console.error("WEB3_MINTER_ADDRESS မထည့်ထားဘူး");
  process.exit(2);
}

const chain = chains[process.env.WEB3_CHAIN || "base"];
const rpc = process.env.WEB3_RPC_URL || "https://mainnet.base.org";
const client = createPublicClient({ chain, transport: http(rpc, { timeout: 10_000 }) });

const wei = await client.getBalance({ address });
const eth = Number(formatEther(wei));

// ★ ETH ဈေးကို hardcode မလုပ်ဘူး — env ကနေ ယူတယ်၊ မထည့်ရင် ETH
//   အနေနဲ့ပဲ တင်တယ်။ မှားတဲ့ ဒေါ်လာတန်ဖိုးက alarm ကို အလကား
//   မြည်စေတာ ဒါမှမဟုတ် တိတ်နေစေတာ နှစ်ခုလုံး ဖြစ်နိုင်တယ်။
const usdPerEth = Number(process.env.ETH_USD || 0);
const usd = usdPerEth > 0 ? eth * usdPerEth : null;

console.log(
  `[minter] ${address} — ${eth} ETH${usd === null ? "" : ` (~$${usd.toFixed(2)})`}`,
);

if (process.env.CW_DISABLED === "1") process.exit(0);

const data = [`MetricName=MinterBalanceEth,Value=${eth},Unit=None`];
if (usd !== null) data.push(`MetricName=MinterBalanceUsd,Value=${usd},Unit=None`);

const args = [
  "cloudwatch",
  "put-metric-data",
  "--namespace",
  "Gwave/Web3",
  "--region",
  process.env.AWS_REGION || "ap-southeast-1",
  "--metric-data",
  ...data,
];

const child = spawn("aws", args, { stdio: "inherit" });
child.on("error", (err) => {
  // ★ AWS CLI မရှိလည်း script က ကျရှုံးမပြရ — လက်ကျန်ကို အထက်မှာ
  //   ပြပြီးသား၊ cron log ထဲမှာ ကြည့်လို့ရတယ်။
  console.error("[minter] CloudWatch ကို မပို့နိုင်ဘူး:", err.message);
});
child.on("exit", (code) => process.exit(code ?? 0));
