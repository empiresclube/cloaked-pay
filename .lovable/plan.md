## Por que o pagamento ainda falha em devnet

O erro `custom program error: 0x1063` (= código 4195) que aparece no toast significa, segundo a própria SDK do Cloak:

> **4195: "Missing required accounts"**

Ou seja, o programa Cloak da devnet (`Zc1k…27h`) está sendo invocado, mas com **menos contas do que ele exige**. Isso acontece porque na rodada anterior nós só trocamos o pacote npm (`@cloak.dev/sdk` → `@cloak.dev/sdk-devnet`) e continuamos chamando a **API antiga** (`new CloakSDK(...).deposit() / .privateTransfer()`). Essa API antiga monta uma instrução de depósito com 4 contas (payer, pool, system, merkleTree).

A documentação oficial da devnet (https://docs.cloak.ag/development/devnet) deixa claro que em devnet você **tem que usar a API nova baseada em UTXO** (`transact`, `createUtxo`, `generateUtxoKeypair`, `fullWithdraw`). Essa API monta a instrução com todas as contas que o programa devnet espera (treasury, commitments, nullifier shards, etc.) — sem isso ele rejeita com 0x1063.

Então a correção real é trocar o motor de pagamento por dentro, mantendo a UX igual.

## O que vou mudar

Ainda vamos exibir uma página `/pay/:id` com um botão "Pay". O usuário ainda conecta Phantom/Solflare em devnet. O que muda é o que acontece quando ele clica:

```text
Antes (quebrado):
  CloakSDK.privateTransfer(note, [{ recipient: merchant }])
       └── instrução de depósito com 4 contas → programa devnet rejeita (0x1063)

Depois (correto):
  1. transact({ outputUtxos:[merchantUtxo], externalAmount: amount })   ← depósito SOL → UTXO do lojista
  2. (opcional, no dashboard do lojista) fullWithdraw([utxo], wallet)   ← saca SOL do pool para a carteira pública
```

### Fluxo do payer (página /pay/:id)
1. Conectar carteira (devnet) — já existe.
2. Buscar o link → ler `recipient` (carteira do lojista) e `merchantUtxoPubkey` (chave pública UTXO do lojista, salva no link no momento da criação).
3. Chamar `transact(...)` com:
   - `inputUtxos: [createZeroUtxo()]`
   - `outputUtxos: [createUtxo(amount, merchantUtxoKeypair, NATIVE_SOL_MINT)]` (UTXO destinada ao lojista)
   - `externalAmount: amount` (depósito vindo da carteira do payer)
   - `signTransaction` + `walletPublicKey` do adapter Phantom/Solflare
4. Mostrar progresso ("preparando", "gerando prova", "enviando", "confirmado") usando os callbacks `onProgress` e `onProofProgress`.

### Fluxo do lojista (página /create + /dashboard)
- Em `/create`, ao gerar o link, criamos também um **UTXO keypair** local (`generateUtxoKeypair()`):
  - chave **pública** vai dentro do link compartilhado
  - chave **privada** + `nk` ficam salvas no `localStorage` do lojista (ex.: `cloak.merchant.utxo.<id>`)
  - link continua sendo URL única e copiável; só fica um pouquinho mais longo.
- Em `/dashboard`, para cada link com chave privada salva, escaneamos commitments on-chain (`scanNotesForWallet`) ou simplesmente exibimos o saldo a partir das UTXOs que conseguimos derivar. Cada link mostra:
  - status "Awaiting payment" / "Paid"
  - botão **Withdraw to wallet** que chama `fullWithdraw([utxo], merchantWalletPubkey, opts)` e entrega o SOL na carteira pública conectada.

### Tratamento de erros
- Mapeamento de códigos da SDK (já temos `extractMessage` / `humanizeError`) será mantido e ampliado:
  - `0x1063` → "SDK desatualizado para o programa devnet — atualize a versão do `@cloak.dev/sdk-devnet`."
  - `0x1001 / RootNotFound` → "Tente novamente — a árvore Merkle foi atualizada."
  - falta de SOL → mensagem com link para `https://faucet.solana.com`.

### Restrições conhecidas (sem inventar nada)
- **SOL apenas** nesta primeira versão. A doc mostra mock-USDC funcionando em devnet, mas exige ATA pré-fundada via faucet do Cloak; deixo isso fora do escopo desta correção.
- Esperar ~20s entre depósito e qualquer transferência shielded-to-shielded é necessário (commitment precisa entrar na árvore). No nosso fluxo "depositar direto na UTXO do lojista" isso não é problema, porque o pagamento já termina no depósito.
- O lojista precisa **manter a chave privada do UTXO no navegador** que criou o link. Isso fica documentado no card do link (texto explicativo + botão "Export keys" salvando em arquivo `.json`, para o lojista poder restaurar em outra máquina).

## Arquivos que vou tocar

- `src/lib/cloak/sdk-service.ts` — reescrever `privateSend`, `withdraw` e helpers de balanço para usar `transact` / `fullWithdraw` em vez de `CloakSDK`.
- `src/lib/cloak/types.ts` — adicionar `merchantUtxoPubkey` em `PaymentLink`/`StealthAddress` e `nk` onde necessário.
- `src/lib/storage.ts` — persistir UTXO keypair do lojista por link (`cloak.merchant.utxo.<linkId>`), com helpers export/import.
- `src/routes/create.tsx` — gerar UTXO keypair ao criar o link, salvar privado localmente, embutir o público no link compartilhado.
- `src/routes/pay.$id.tsx` — ler `merchantUtxoPubkey` do link, chamar o novo `privateSend` (que usa `transact`), atualizar mensagens de erro.
- `src/routes/dashboard.tsx` — listar links pagos (a partir das UTXOs locais), botão **Withdraw to wallet** que chama `fullWithdraw`, e botão **Export keys** por link.
- `src/lib/cloak/provider.tsx` — passar `signTransaction` / `signMessage` do adapter para o serviço (já passamos `signTransaction`; só falta `signMessage`).
- `README.md` — atualizar a seção devnet com o novo fluxo (UTXO + withdraw).

Nenhuma mudança em rotas (`routeTree.gen.ts`), nenhum novo pacote npm, nenhuma migração de banco — o estado continua só em `localStorage`.

## Como você vai validar

1. Em `/create`, gerar um link de 0,02 SOL. Confirmar que aparece um aviso "Save your link — it carries the merchant key" e um botão de exportar chaves.
2. Abrir o link em outra aba/carteira em devnet, com pelo menos ~0,03 SOL na carteira do payer (faucet). Clicar em **Pay**. O toast deve mostrar progresso → **"Payment confirmed on Solana"** com signature clicável para o explorer (devnet).
3. Voltar ao `/dashboard` na aba do lojista. O link aparece como **Paid 0.02 SOL**. Clicar em **Withdraw to wallet** → abre o Phantom para assinar → SOL aparece na carteira pública do lojista.
4. Se algo falhar, o card de erro mostra mensagem em português amigável + os logs reais expandíveis (já temos isso).
