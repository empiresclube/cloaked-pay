## Problema

A build da Vercel falhou com:
```
Error: api/index.mjs: unsupported "runtime" value in 'config'
```

A Vercel não aceita mais `runtime: "nodejs20.x"` no formato que usamos. Mais importante: a abordagem atual (criar manualmente `api/index.mjs` para fazer ponte entre o handler `fetch` do TanStack e a runtime Node da Vercel) é frágil e desnecessária — a documentação oficial da Vercel recomenda usar o adapter **Nitro**, que gera a função serverless automaticamente no formato correto.

## Solução

Trocar o bridge manual pelo adapter oficial Nitro, conforme a doc da Vercel para TanStack Start.

### Mudanças

1. **Adicionar dependência `nitro`** (`bun add nitro`).

2. **Atualizar `vite.config.ts`**: quando `DEPLOY_TARGET=vercel`, ativar o plugin Nitro com preset Vercel. Continua desativando o plugin Cloudflare nesse caso. Para a preview do Lovable e para Cloudflare, nada muda.

3. **Apagar `api/index.mjs`** — não é mais necessário, o Nitro gera a função sozinho em `.vercel/output/functions/`.

4. **Simplificar `vercel.json`**: remover `outputDirectory`, `functions` e `rewrites` manuais. O Nitro emite o formato Build Output API v3 da Vercel, que a plataforma detecta automaticamente. O arquivo passa a conter só o `buildCommand` e `installCommand`.

5. **Atualizar `README.md`** com as instruções corretas (sem menção ao bridge manual).

### Como fica o `vercel.json`

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "buildCommand": "DEPLOY_TARGET=vercel bun run build",
  "installCommand": "bun install"
}
```

### Como fica o `vite.config.ts`

```ts
import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import { nitro } from "nitro/vite";

const isVercel = process.env.DEPLOY_TARGET === "vercel" || !!process.env.VERCEL;

export default defineConfig({
  cloudflare: isVercel ? false : undefined,
  plugins: isVercel ? [nitro({ config: { preset: "vercel" } })] : [],
});
```

## O que NÃO muda

- Preview do Lovable continua igual (Cloudflare Workers).
- Integração de wallets reais (`@solana/wallet-adapter`) e o resto do app não são afetados.
- Variáveis de ambiente Vercel (`VITE_SOLANA_NETWORK`, `VITE_SOLANA_RPC_URL`) continuam iguais.

## Próximos passos depois do deploy

1. Push do código para o GitHub.
2. Re-deploy automático na Vercel (ela detecta o novo `vercel.json`).
3. Testar com Phantom/Solflare em devnet.
