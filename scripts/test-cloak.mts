import {
  generateUtxoKeypair,
  generateCloakKeys,
  formatAmount,
  LAMPORTS_PER_SOL,
  getExplorerUrl,
  isValidSolanaAddress,
  VERSION,
  derivePublicKey,
} from "@cloak.dev/sdk";

console.log("SDK VERSION:", VERSION);
console.log("LAMPORTS_PER_SOL:", LAMPORTS_PER_SOL);
console.log("formatAmount(1500000):", formatAmount(1_500_000));
console.log("isValid '11..1':", isValidSolanaAddress("11111111111111111111111111111111"));

const utxo = await generateUtxoKeypair();
console.log("UTXO keypair:", utxo);
const cloakKeys = await generateCloakKeys();
console.log("Cloak keys:", cloakKeys);

console.log("explorer:", getExplorerUrl("5xYsig"));
console.log("derivePublicKey works:", typeof derivePublicKey);
