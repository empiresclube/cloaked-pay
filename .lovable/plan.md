# Tornar o CloakPay 100% funcional na devnet

## Diagnóstico

Hoje a integração com Solana é **parcial**:

- ✅ Real: conexão de carteira (Phantom/Solflare), endpoint devnet, derivação de chaves Cloak, stealth address, viewing keys.
- ❌ Simulado: `submitOnChain()` em `src/lib/cloak/mock-service.ts` apenas gera uma assinatura aleatória (`crypto.getRandomValues`) e mexe em `localStorage`. Nenhuma transação é enviada à Solana.

A SDK `@cloak.dev/sdk@0.1.5` expõe a classe `CloakSDK` com métodos `deposit`, `privateTransfer`, `withdraw`, `generateNote`, `loadNotes` que aceitam um `WalletAdapter` (modo browser) — exatamente o que já temos via `@solana/wallet-adapter-react`. Vamos plugar essa SDK por baixo da interface `CloakService` que o app já usa, sem mudar nenhum componente de UI.

## Decisões importantes (e por quê)

1. **Apenas SOL na devnet.** O pool privado nativo da Cloak é em SOL. USDC só funciona via swap (mainnet) ou pool dedicada (mainnet). Em devnet, faz sentido travar o token suportado em SOL — é o único caminho que realmente fecha ponta a ponta sem dependências externas.
2. **Modelo "uma nota por link de pagamento".** Diferente do desenho atual ("saldo blindado pessoal"), o fluxo natural da Cloak é: payer **gera uma nota** com o valor exato do link, **deposita** essa nota e na sequência **transfere** para o destinatário (`privateTransfer` ou `withdraw`). Isso bate 1:1 com payment links: cada link = uma nota. Removo a abstração de "saldo blindado acumulado", que era artefato do mock.
3. **Persistência de notas.** Usar `LocalStorageAdapter` da própria SDK (já mencionado no código), para que o merchant veja o histórico real de pagamentos recebidos via `sdk.loadNotes()`.
4. **Circuitos ZK.** A prova Groth16 é gerada no browser via snarkjs; a SDK baixa os circuitos do CDN padrão (`DEFAULT_CIRCUITS_URL`). Não precisa servir nada localmente.
5. **Devnet por padrão.** `VITE_SOLANA_NETWORK=devnet` continua o default; não exigimos custom RPC.

## O que muda na UI (mínimo)

- Token selector em `/create` passa a oferecer **só SOL** (USDT/USDC ficam ocultos com tooltip "mainnet only").
- Página de pagamento `/pay/$id`: o botão "Pay" dispara o fluxo real e mostra a assinatura **real** com link para `explorer.solana.com/tx/...?cluster=devnet`.
- Dashboard: lista de pagamentos vem de `sdk.loadNotes()` filtrando por status `confirmed`, em vez de `localStorage` cru.
- Aviso visível no header / dashboard: "Devnet · Pagamentos reais" para deixar claro que tudo é on-chain agora.

## Mudanças técnicas (arquivo por arquivo)

### Nova: `src/lib/cloak/sdk-service.ts`
Implementa `CloakService` chamando a SDK real:
- Construtor: instancia `new CloakSDK({ wallet, network, storage: new LocalStorageAdapter() })` lazy, recebendo o wallet adapter via setter (chamado pelo provider quando a wallet conecta).
- `deposit({ payer, amount })` → `sdk.deposit(connection, amountLamports, { onProgress })`. Mapeia os `DepositStatus` da SDK para nossos `OperationPhase`.
- `privateSend({ to, amount, autoDeposit })` → fluxo "uma nota":
  1. `note = await sdk.generateNote(amountLamports)`
  2. `await sdk.privateTransfer(connection, note, [{ recipient: toPubkey, amount }], { onProgress, onProofProgress })`
  3. Retorna a `signature` real e `confirmedAt` real (do `slot`).
- `withdraw({ owner, amount, to })` → carrega a nota do owner via `sdk.loadNotes()`, escolhe a primeira withdrawable e chama `sdk.withdraw(connection, note, recipient, { withdrawAll: true })`.
- `getShieldedBalance(owner)` → soma `loadNotes()` filtradas por `network === "devnet"` e `!spent`.
- `listNotes(owner)` → retorna `sdk.loadNotes()` mapeadas para nosso tipo `ShieldedNote`.

### `src/lib/cloak/service.ts`
Singleton agora retorna a nova `sdk-service` em vez do mock; expõe `setWalletAdapter(adapter)` e `setConnection(connection)` para o provider injetar.

### `src/lib/cloak/provider.tsx`
Dentro do `CloakProvider`, usa `useWallet()` (adapter direto) e `useConnection()` do `@solana/wallet-adapter-react` para chamar `getCloakService().setWalletAdapter(adapter)` e `setConnection(connection)` num `useEffect` toda vez que a wallet muda.

### `src/lib/wallet.tsx`
Expõe também o adapter cru (não só `publicKey`) para o Cloak provider conseguir passar `signTransaction`/`sendTransaction` para a SDK.

### `src/routes/pay.$id.tsx`
- Substitui o `privateSend` mockado pelo real.
- Mapeia o `amount` do link → `lamports` via `parseAmount` da SDK.
- No estado `success`, monta link com `getExplorerUrl(signature, "devnet")`.
- Trata erros reais (`CloakError.category`): saldo insuficiente, RPC, prova, relay — mensagens amigáveis em vez de "Unknown error".

### `src/routes/create.tsx`
- Token select: SOL marcado e habilitado; USDC/USDT ficam disabled com badge "mainnet".
- Valor mínimo: `MIN_DEPOSIT_LAMPORTS` da SDK = 0.01 SOL. Validação no form com mensagem clara.
- Mostra a fee estimada (`calculateFee`) abaixo do input.

### `src/routes/dashboard.tsx`
- Lista pagamentos via `sdk.loadNotes()` em vez do `localStorage` interno do mock.
- Mostra signature real com link para o explorer devnet.
- Adiciona pill "Devnet" no header.

### `src/lib/cloak/mock-service.ts`
Mantido só como fallback de SSR (quando não há wallet) — devolve saldos zerados, lista vazia. Comentado no topo: "fallback SSR / pré-conexão; não usar em runtime conectado".

### `src/components/Header.tsx`
Adiciona badge "Devnet" pequena ao lado do botão de wallet quando `VITE_SOLANA_NETWORK=devnet`.

### `README.md`
Atualiza a tabela "real vs simulado" — todas as linhas viram ✅. Adiciona seção "Como testar":
1. Phantom em devnet → faucet `https://faucet.solana.com` → ≥0.05 SOL.
2. Conectar → `/create` → 0.01 SOL → copiar link.
3. Abrir o link em outra janela (ou outra wallet) → "Pay" → confirmar no popup → ver tx no explorer devnet.

## Diagrama do fluxo real (payment link)

```text
Merchant (/create)                    Payer (/pay/$id)
─────────────────                     ────────────────
generate stealth address              connect wallet (devnet)
   ↓                                     ↓
save link in storage   ──share URL──▶ click "Pay 0.05 SOL"
                                         ↓
                                      sdk.generateNote(amount)
                                         ↓
                                      sdk.privateTransfer(
                                        connection, note,
                                        [{ recipient: stealth, amount }]
                                      )
                                         │
                                         ├─ deposit tx → on-chain
                                         ├─ Groth16 proof (browser)
                                         ├─ relay submits withdraw
                                         ▼
                                      real signature
                                         ↓
                                      explorer.solana.com (devnet)
```

## Riscos e mitigações

- **Tamanho do bundle / proving no browser.** A SDK + snarkjs são pesados. Mitigação: o `loadSdk()` lazy já existe; o `CloakSDK` só é instanciado depois que a wallet conecta. SSR continua importando só os tipos.
- **Buffer no client.** Já temos `buffer-polyfill.ts`. Garantimos que ele é importado antes de qualquer `CloakSDK`.
- **Tempo da prova ZK.** Pode levar 5–30s no primeiro uso (download de circuitos). UI mostra progresso real via `onProofProgress` (porcentagem) em vez do `setTimeout` fake.
- **Devnet faucet rate limit.** Sem mitigação no código — README destaca o uso do faucet oficial e link alternativo (`solfaucet.com`).
- **Notas perdidas se o usuário limpar localStorage.** Adiciono no `/pay/$id` (callback `onNoteGenerated` da SDK) um aviso visível "salvando nota local" antes do submit, e mostro a nota como JSON copiável caso queira backup manual — mesma postura do exemplo oficial.

## Critério de aceite

- Conectar Phantom em devnet, criar link de 0.05 SOL, pagar de outra wallet, ver assinatura real no Solscan/Explorer devnet.
- `sdk.loadNotes()` retorna a nota persistida; dashboard mostra o pagamento.
- Nenhuma chamada para `fakeSignature()` no runtime (só no fallback SSR).
- README atualizado refletindo "100% devnet, ponta a ponta".
