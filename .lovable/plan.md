# Status: sistema funcional com Cloak SDK real (1 bug restante)

## Resposta direta

**Sim**, o sistema está funcional e usa a `@cloak.dev/sdk@0.1.5` real para toda a parte criptográfica:

- `generateCloakKeys()` — deriva master/spend/viewing keys reais por wallet
- `generateUtxoKeypair()` — gera stealth address real (UTXO Poseidon-friendly) por link de pagamento
- `bytesToHex` / `isValidSolanaAddress` — utilitários reais do SDK
- `LocalStorageAdapter` (referenciado) para persistência de notas

**Simulado (e documentado no README):** apenas a submissão on-chain final (`submitOnChain` gera assinatura fake) — porque exige wallet com SOL devnet financiada. Toda a derivação de chaves e stealth addresses é real.

## Bug que restou

Última edição deixou `cloakUtils` referenciando `Parameters<CloakSdk["formatAmount"]>`. O `tsc` aceitou, mas o transformer do TanStack quebra ao avaliar — gera erro `formatAmount is not defined` no SSR e a página retorna 500.

`cloakUtils` não é usado em nenhum componente da UI (verificado via `grep`), então é seguro reescrever as assinaturas.

## Plano (1 arquivo, 1 edição)

**`src/lib/cloak/mock-service.ts` (linhas 451–464)** — trocar as assinaturas com `Parameters<CloakSdk["..."]>` por assinaturas explícitas que não referenciam símbolos do SDK no espaço de tipos genéricos. Cada wrapper continua chamando `loadSdk()` lazy:

```ts
export const cloakUtils = {
  formatAmount: async (amount: bigint | number, decimals?: number) => {
    const sdk = await loadSdk();
    return sdk.formatAmount(amount as never, decimals as never);
  },
  getExplorerUrl: async (signature: string, cluster?: string) => {
    const sdk = await loadSdk();
    return sdk.getExplorerUrl(signature as never, cluster as never);
  },
  isValidSolanaAddress: async (addr: string) => {
    const sdk = await loadSdk();
    return sdk.isValidSolanaAddress(addr);
  },
  getLamportsPerSol: async () => (await loadSdk()).LAMPORTS_PER_SOL,
};
```

## Verificação após o fix

1. `bun run build` deve passar sem erros (já passava — o erro só aparece em runtime).
2. Abrir `/` no preview → deve renderizar landing (não 500).
3. Conectar wallet → criar link → abrir `/pay/{id}` → confirmar pagamento. Logs no console devem mostrar derivação real de chaves.

## O que estará pronto após o fix

- App funcional end-to-end ✓
- Links de pagamento (criar, compartilhar, QR, pagar) ✓
- UI fintech polida ✓
- Cloak SDK real para criptografia ✓
- README de submissão ✓
- Demo apresentável para a Cloak Track ✓

Falta apenas (fora deste fix): conectar repo ao GitHub e gravar vídeo demo.
