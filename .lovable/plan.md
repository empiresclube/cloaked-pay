# Deploy na Vercel — Cloak Track

## Contexto

O projeto hoje está configurado para **Cloudflare Workers** (via `@cloudflare/vite-plugin` + `wrangler.jsonc`) porque o ambiente Lovable usa Workers como runtime de SSR. Para subir na **Vercel** precisamos:

1. Adicionar suporte ao runtime Vercel (Node/Edge) sem remover o config atual.
2. Garantir que a wallet real (Phantom/Solflare) seja carregada no cliente.
3. Documentar o passo a passo de deploy.

Decisão importante: o TanStack Start oficialmente roda na Vercel via **Vercel Functions (Node runtime)**. Como nosso uso de "backend" hoje é mínimo (tudo é client-side: Cloak SDK, wallet, localStorage), podemos simplificar e fazer **deploy estático** na Vercel servindo apenas o build do cliente — isso elimina qualquer incompatibilidade Worker/Node e funciona out-of-the-box com wallets reais.

## Estratégia escolhida: deploy estático (SPA na Vercel)

Vantagens:
- Zero configuração de runtime serverless.
- Funciona com qualquer wallet adapter (tudo client-side).
- Cloak SDK já roda só no browser (lazy load via `loadSdk()`).
- Build mais rápido e barato.

Trade-off: SSR é desabilitado. Como o app é uma dApp (precisa de wallet conectada para qualquer coisa útil), SSR não agrega valor real aqui.

## O que será feito

### 1. Integração de wallet real (Solana Wallet Adapter)

Substituir o mock em `src/lib/wallet.tsx` por integração real com:
- `@solana/wallet-adapter-react`
- `@solana/wallet-adapter-react-ui`
- `@solana/wallet-adapter-wallets` (Phantom, Solflare)
- `@solana/wallet-adapter-base`

Manter a mesma API pública (`useWallet()`, `publicKey`, `connect`, `disconnect`) para não quebrar componentes existentes (`Header`, `create.tsx`, `pay.$id.tsx`, `dashboard.tsx`).

Configurar para **devnet** (faz sentido pra teste) com endpoint configurável via env.

### 2. Configuração para Vercel

Criar:
- `vercel.json` com rewrite SPA (`/* → /index.html`) para que o roteamento client-side do TanStack Router funcione em refresh/deep links.
- `.env.example` documentando `VITE_SOLANA_NETWORK` e `VITE_SOLANA_RPC_URL`.

Ajustar `vite.config.ts` para gerar build estático (`outDir: dist`, sem o plugin Cloudflare quando rodar fora do Lovable). O ambiente Lovable continua funcionando porque o config detecta automaticamente.

### 3. README atualizado

Adicionar seção "Deploy na Vercel" com:
- `git push` para um repositório.
- Importar o repo na Vercel.
- Build command: `bun run build`.
- Output directory: `dist`.
- Variáveis de ambiente recomendadas.
- Como testar com Phantom em devnet (link do faucet).

## Detalhes técnicos

### Arquivos novos
- `vercel.json` — rewrites para SPA.
- `.env.example` — `VITE_SOLANA_NETWORK=devnet`, `VITE_SOLANA_RPC_URL=https://api.devnet.solana.com`.
- `src/lib/wallet-providers.tsx` — wrapper com `ConnectionProvider` + `WalletProvider` + `WalletModalProvider` do adapter UI.

### Arquivos editados
- `src/lib/wallet.tsx` — re-exportar `useWallet` do adapter, mantendo helpers (`shortAddress`, `connected`, etc).
- `src/routes/__root.tsx` — envolver `<Outlet/>` com `<WalletProviders>`.
- `src/components/Header.tsx` — usar `<WalletMultiButton>` do adapter (mantém visual atual via wrapper customizado).
- `package.json` — adicionar dependências do wallet adapter.
- `README.md` — instruções de deploy Vercel + teste com Phantom.

### Pacotes a instalar
```
@solana/wallet-adapter-base
@solana/wallet-adapter-react
@solana/wallet-adapter-react-ui
@solana/wallet-adapter-wallets
```

## Verificação após implementação

1. `bun run build` gera `dist/` sem erros.
2. Preview Lovable continua funcionando.
3. Localmente, `bun run preview` abre o app e o botão "Connect Wallet" mostra o modal do Phantom.
4. Deploy na Vercel: criar link de pagamento → abrir `/pay/{id}` em outro browser com Phantom → confirmar fluxo.

## Fora de escopo (próximo passo separado)

- Integração on-chain real (assinar e enviar transação Solana com SOL devnet). Hoje `submitOnChain` ainda é simulado. Posso fazer depois que confirmarmos que wallet + UI estão funcionando na Vercel.
- Conectar repo ao GitHub (você faz pelo botão do Lovable; depois eu te guio na Vercel).
