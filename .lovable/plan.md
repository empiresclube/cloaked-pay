## Você está certo — usei o SDK errado

A doc oficial (https://docs.cloak.ag/development/devnet) deixa claro que existe um pacote dedicado para devnet, com program ID, relay e API completamente diferentes do `@cloak.dev/sdk` que estamos usando hoje.

| | Hoje (errado) | Correto p/ devnet |
|---|---|---|
| Pacote npm | `@cloak.dev/sdk` | `@cloak.dev/sdk-devnet` (0.1.5-devnet.0) |
| Program ID | `zh1eLd6r…` (não existe em devnet) | `Zc1kHfp4rajSMeASFDwFFgkHRjv7dFQuLheJoQus27h` |
| Relay | mainnet | `https://api.devnet.cloak.ag` |
| API | classe `CloakSDK` (alto nível: `deposit`, `privateTransfer`, `withdraw`) | funções de baixo nível: `transact`, `createUtxo`, `createZeroUtxo`, `generateUtxoKeypair`, `getNkFromUtxoPrivateKey`, `swapWithChange` |
| USDC | só mainnet | `DEVNET_MOCK_USDC_MINT` (mock USDC, 6 dec) com faucet HTTP |

Daí o erro "Deposit failed": estávamos chamando um programa que não existe em devnet.

## O que vai mudar

### Substituir o SDK

- Adicionar `@cloak.dev/sdk-devnet` (`bun add @cloak.dev/sdk-devnet`).
- Remover `@cloak.dev/sdk` do `package.json` (não precisa mais — a troca para mainnet futura é uma simples mudança de import).

### Reescrever `src/lib/cloak/sdk-service.ts`

A API de devnet não tem `CloakSDK.privateTransfer`. O fluxo correto (da doc, seção "SOL shielded transfer") é:

```text
payer (wallet conectada)        merchant (link de pagamento)
─────────────────────────       ────────────────────────────
1. generateUtxoKeypair          recipientUtxo (gerado quando o merchant criou o link
   getNkFromUtxoPrivateKey       e codificado dentro do payment-link id)

2. createUtxo(amount, payerUtxo, NATIVE_SOL_MINT)              ← deposit output
   transact({ inputUtxos:[createZeroUtxo()], outputUtxos:[depositOutput],
              externalAmount: amount, depositor: payer })       ← deposit on-chain
   ⏳ aguardar ~20s para a commitment settlar

3. recipientOut = createUtxo(amount, recipientUtxo, NATIVE_SOL_MINT)
   transact({ inputUtxos:[shielded], outputUtxos:[recipientOut],
              externalAmount: 0n }, { useUniqueNullifiers:true,
              cachedMerkleTree: deposit.merkleTree })           ← shielded transfer via relay

4. (opcional, lado merchant) withdraw da nota recebida para a wallet pública
   via outro `transact` com externalAmount negativo + recipient ATA.
```

Isso muda o desenho: **o link de pagamento precisa carregar o `utxoPubkey` do recipient** (não a stealth address Solana). O merchant gera `recipientUtxo = generateUtxoKeypair()` quando cria o link, guarda a `privateKey` no localStorage dele, e publica só a `publicKey` no link. O payer paga para essa pubkey shielded.

### Arquivo por arquivo

- **`src/lib/cloak/sdk-service.ts`** — reescrito do zero. Funções públicas:
  - `createPaymentLinkUtxo()` — chamado em `/create`. Gera `generateUtxoKeypair()`, devolve `{ utxoPubkey, utxoPrivateKey, nk }` e persiste a privateKey + nk localmente atrelados ao id do link.
  - `payToLink({ payerWallet, recipientUtxoPubkey, amount, onProgress })` — faz o deposit + shielded transfer para o utxo do merchant. Devolve as 2 signatures reais (deposit e transfer).
  - `loadReceivedNotes(utxoPrivateKey, nk)` — usa a relay devnet (`/notes` ou varredura de eventos via SDK helper, conforme o que o pacote expor) para listar notas recebidas pelo utxo do merchant.
  - `withdrawNote(note, toWallet)` — opcional, no dashboard, para o merchant sacar para a wallet pública dele.
- **`src/lib/cloak/service.ts`** — cola adapter mantendo a interface `CloakService` que o resto da app já consome, mas chamando as novas funções acima.
- **`src/lib/cloak/provider.tsx`** — passa `wallet` + `connection` para o service como já faz hoje.
- **`src/lib/cloak/types.ts`** — adicionar campos `utxoPubkey` (base58) e `utxoNk` no tipo `PaymentLink` / `StealthAddress`.
- **`src/lib/storage.ts`** — guardar `utxoPrivateKey`/`nk` por id de link (sensível: só fica na máquina do merchant).
- **`src/routes/create.tsx`**:
  - Habilitar **SOL** e **mock USDC** (ambos suportados em devnet); deixar USDT desabilitado com tooltip "mainnet only".
  - Min 0.01 SOL ou 0.1 mock USDC.
  - Botão "Get test USDC" que faz `POST https://devnet.cloak.ag/api/faucet` para a wallet conectada (rate limit 30s, 1000/req, 5000/24h por wallet — tudo da doc).
  - Faucet de SOL: link para `https://faucet.solana.com`.
- **`src/routes/pay.$id.tsx`**:
  - Usa `payToLink()`. Mostra progresso real em 4 etapas: "Preparing UTXO" → "Depositing" → "Waiting for confirmation (~20s)" → "Shielded transfer".
  - Em sucesso, mostra **2 signatures** (deposit + transfer) com link para `solscan.io/tx/<sig>?cluster=devnet`.
  - Mensagens de erro humanizadas para casos típicos: saldo insuficiente, relay 429, deposit não confirmado, prova falhou.
- **`src/routes/dashboard.tsx`**:
  - Lista pagamentos lendo `loadReceivedNotes()` por link.
  - Botão "Withdraw to wallet" por nota confirmada → `withdrawNote()` → signature real.
  - Badge "Devnet" + aviso "valores são SOL/mock-USDC de teste".
- **`src/components/Header.tsx`** — badge Devnet.
- **`README.md`** — atualizar com:
  - Pacote correto, program ID, relay devnet.
  - Faucets (Solana + Cloak mock USDC).
  - Fluxo de teste end-to-end com 2 wallets.

### Arquivos removidos / desativados

- `src/lib/cloak/mock-service.ts` — fica só como fallback SSR (sem wallet conectada), retornando estruturas vazias. Mensagem no topo: "não usar em runtime".

## Diagrama do fluxo final em devnet

```text
MERCHANT (/create)                          PAYER (/pay/$id)
─────────────────                           ────────────────
generateUtxoKeypair()                       conecta Phantom (devnet)
  ↓                                            ↓
salva privKey+nk local                      lê utxoPubkey do link
publica utxoPubkey no link  ── url ──▶      
                                            createUtxo(amount, payerTmpUtxo, SOL)
                                            transact(deposit) → sig1 (Solana devnet)
                                            ⏳ ~20s
                                            createUtxo(amount, MERCHANT_UTXO_PUB, SOL)
                                            transact(transfer via relay
                                              api.devnet.cloak.ag) → sig2
                                                ↓
explorer.solana.com/tx/sig1?cluster=devnet  ✓ pago
explorer.solana.com/tx/sig2?cluster=devnet
                                            
MERCHANT (/dashboard)
─────────────────────
loadReceivedNotes(privKey, nk)  → lista das notas
[opcional] withdrawNote(note, merchantWallet) → SOL público de volta
```

## Riscos & mitigações

- **API low-level**: `transact`/`createUtxo` exigem mais cuidado que o `CloakSDK.privateTransfer` antigo. Mitigação: copiar literalmente os exemplos da doc (já testados pela Cloak) e abstrair na nova `sdk-service.ts`.
- **`@cloak.dev/sdk-devnet` no npm**: o `package.json` do tarball diz "NOT PUBLISHED" mas ele *está* publicado e instalável (versão `0.1.5-devnet.0`). Confirmei via `registry.npmjs.org`. Caso quebre no futuro, alternativa é instalar via tarball URL direto.
- **Espera de 20s entre deposit e transfer**: bloqueia a UX. Vamos mostrar progress real (a etapa de prova ZK também leva 5–30s, então o tempo total fica natural).
- **Mock USDC ATA**: o payer precisa ter o ATA criado. A faucet Cloak cria sob demanda; para deposits, o `transact` passa o `depositorKeypair` que paga rent.
- **Reset periódico de devnet pela Solana Foundation**: notas podem desaparecer. Aviso explícito no dashboard.

## Critério de aceite

- Conectar Phantom/Solflare em devnet → criar link de 0.01 SOL → pagar de outra wallet → ver `sig1` e `sig2` no `solscan.io ...?cluster=devnet`.
- Dashboard do merchant lista a nota recebida via relay devnet real.
- "Withdraw to wallet" gera nova tx pública com SOL desbloqueado.
- Mesma coisa para mock USDC (após pegar do faucet `devnet.cloak.ag/privacy/faucet`).
- Zero chamadas ao program mainnet `zh1eLd6r…` no runtime.
