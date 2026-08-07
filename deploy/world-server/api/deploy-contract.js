// deploy-contract.js — GwaveSkins.sol ကို compile + testnet deploy
// Test:   node deploy-contract.js --compile-only
// Deploy: RPC_URL=... PRIVATE_KEY=... BASE_URI=... node deploy-contract.js
const fs = require('fs');
const path = require('path');
const solc = require('solc');

function findImports(p) {
  const full = path.join(__dirname, 'node_modules', p);
  if (fs.existsSync(full)) return { contents: fs.readFileSync(full, 'utf8') };
  return { error: 'not found: ' + p };
}

function compile() {
  const source = fs.readFileSync(path.join(__dirname, 'contracts/GwaveSkins.sol'), 'utf8');
  const input = {
    language: 'Solidity',
    sources: { 'GwaveSkins.sol': { content: source } },
    settings: { outputSelection: { '*': { '*': ['abi', 'evm.bytecode.object'] } }, optimizer: { enabled: true, runs: 200 } },
  };
  const out = JSON.parse(solc.compile(JSON.stringify(input), { import: findImports }));
  const errors = (out.errors || []).filter(e => e.severity === 'error');
  if (errors.length) { console.error(errors.map(e => e.formattedMessage).join('\n')); process.exit(1); }
  const c = out.contracts['GwaveSkins.sol']['GwaveSkins'];
  console.log('✅ Compile အောင်မြင် — bytecode', (c.evm.bytecode.object.length / 2), 'bytes');
  return c;
}

async function main() {
  const c = compile();
  if (process.argv.includes('--compile-only')) return;
  const { ethers } = require('ethers');
  const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
  const signer = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
  const factory = new ethers.ContractFactory(c.abi, c.evm.bytecode.object, signer);
  const contract = await factory.deploy(process.env.BASE_URI || 'https://gwave.cc/nft/skins/');
  await contract.waitForDeployment();
  console.log('🚀 Deployed:', await contract.getAddress());
}
main().catch(e => { console.error(e); process.exit(1); });
