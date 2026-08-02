# Web3 key management (Phase W7)

Gwave holds three distinct on-chain keys. They exist separately **because
losing each one costs something different** — collapsing them into one key
means a single leak ends the project's control over its contracts.

Do not go to mainnet before every box in [Checklist](#checklist) is ticked.

| Key | What it does | Where it lives | Blast radius if leaked |
|---|---|---|---|
| **Contract owner** | Changes contract settings, adds/removes minters | Safe multisig (2-of-3) | Total — attacker owns both contracts forever |
| **Minter (hot)** | Mints land + items from the queue worker | AWS Secrets Manager → env | Bad mints until rotated; **revocable in ~1 min** |
| **Deployer** | Deployed the contracts, one time | Hardware wallet (or destroyed after use) | Nothing after ownership transfer |

## Why the hot key is allowed to be hot

The mint worker has to sign continuously and unattended, so its key must be
reachable by running code. That is unavoidable. What *is* avoidable is the
damage: the minter is a `minters` mapping entry on the contract, not the
owner, so the Safe can revoke it without touching ownership. Keep the hot
wallet funded with roughly **$20 of gas and nothing else** — it never needs
to hold NFTs or tokens.

## Contract owner → Safe multisig

1. Create a 2-of-3 Safe at <https://app.safe.global> on Base. Signers: two
   Gwave founders plus one offline backup key held somewhere else physically.
2. Rehearse the whole flow on Base Sepolia first, including a `setMinter`
   call executed through the Safe UI.
3. Transfer ownership:

   ```bash
   cast send "$LAND_CONTRACT" "transferOwnership(address)" "$SAFE_ADDRESS" \
     --private-key "$DEPLOYER_KEY" --rpc-url "$BASE_RPC"
   cast send "$ITEMS_CONTRACT" "transferOwnership(address)" "$SAFE_ADDRESS" \
     --private-key "$DEPLOYER_KEY" --rpc-url "$BASE_RPC"
   ```

4. Verify on Basescan that `owner()` is the Safe on both contracts.

> **`transferOwnership` is one-way.** If `$SAFE_ADDRESS` is wrong by one
> character the contracts are permanently unowned. Read the address back
> from the Safe UI, character by character, three times, and confirm the
> Safe can already execute a no-op transaction before transferring.

## Minter rotation (the incident procedure)

If the hot key might be exposed — a leaked log, a compromised host, an
unexplained mint — rotate immediately. This needs the Safe, not the
deployer key, and takes about a minute:

1. Generate a new key offline and store it in Secrets Manager (below).
2. From the Safe, execute on **both** contracts:
   - `setMinter(<old address>, false)`
   - `setMinter(<new address>, true)`
3. Update `WEB3_MINTER_KEY` in `/etc/gwave-web.env` (or the metaverse
   container's env) and restart the worker.
4. Any queue rows still in `sent` from the old key resolve normally — the
   confirmation worker only reads receipts, it does not sign.

Revoking first and provisioning second is deliberate: a stalled mint queue
is recoverable, an attacker with an active minter is not.

## Secrets Manager

The minter key must never be in git, in a Dockerfile, in CI logs, or in a
`NEXT_PUBLIC_*` variable.

```bash
aws secretsmanager create-secret \
  --name gwave/web3/minter-key \
  --secret-string "0x<private key>" \
  --region ap-southeast-1
```

On the EC2 host, the redeploy script reads it into `/etc/gwave-web.env` as
`WEB3_MINTER_KEY`. Rotating the secret therefore only needs
`sudo gwave-redeploy` — no image rebuild, because it is a runtime variable.

`git grep` for a leaked key before every release:

```bash
git grep -nE '0x[a-fA-F0-9]{64}' -- . ':!*.lock' ':!pnpm-lock.yaml'
```

## Balance alarm

The worker stops minting silently when the hot wallet runs out of gas — the
jobs just keep failing and retrying. Alarm before that happens:

```bash
aws cloudwatch put-metric-alarm \
  --alarm-name gwave-minter-low-balance \
  --namespace Gwave/Web3 --metric-name MinterBalanceUsd \
  --statistic Minimum --period 3600 --evaluation-periods 1 \
  --threshold 5 --comparison-operator LessThanThreshold \
  --alarm-actions "$SNS_TOPIC_ARN" --region ap-southeast-1
```

Publish the metric from the host (cron, hourly):

```bash
node server/metaverse/scripts/report-minter-balance.mjs
```

## Environment variables

| Name | Where | Notes |
|---|---|---|
| `WEB3_RPC_URL` | runtime | Primary RPC (Alchemy/QuickNode) |
| `WEB3_RPC_URL_2`, `WEB3_RPC_URL_3` | runtime | Optional extra providers; a public Base endpoint is always appended last |
| `WEB3_CHAIN` | runtime | `base` (default) or `baseSepolia` |
| `WEB3_LAND_ADDRESS`, `WEB3_ITEMS_ADDRESS` | runtime | Contract addresses, stored lowercase |
| `WEB3_LAND_DEPLOY_BLOCK`, `WEB3_ITEMS_DEPLOY_BLOCK` | runtime | Indexer start block — without these it scans from block 0 and burns the RPC quota |
| `WEB3_WORKER` | runtime | `1` enables the mint/confirm/index worker; unset everywhere else |
| `WEB3_MINTER_KEY` | runtime, **secret** | Hot key; omit to run confirmation + indexing only |
| `WEB3_MAX_FEE_WEI` | runtime | Gas ceiling, default 0.5 gwei |
| `NEXT_PUBLIC_WEB3_CHAIN_ID` | build | `8453` (Base) or `84532` (Sepolia); the SIWE message is signed against it |

Only `NEXT_PUBLIC_*` names are baked into the image. Everything above is
read at runtime, so changing any of them needs `sudo gwave-redeploy` and no
rebuild.

## Checklist

- [ ] `owner()` on both contracts is the Safe address
- [ ] Safe is 2-of-3 with one signer offline
- [ ] Minter rotation rehearsed end-to-end on Base Sepolia
- [ ] `WEB3_MINTER_KEY` lives only in Secrets Manager and `/etc/gwave-web.env`
- [ ] `git grep` for 64-hex private keys is clean
- [ ] Hot wallet balance alarm exists and has fired once in a test
- [ ] Deployer key is on a hardware wallet, or was destroyed after use
- [ ] `WEB3_WORKER=1` is set on exactly one host
