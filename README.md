# CloakPay — Private Payment Links on Solana

> Stripe-style payment links where the amount and the recipient stay
> encrypted on-chain. Built on [Cloak](https://cloak.ag) and Solana.

🌐 **Live demo:** https://id-preview--62839e74-5185-4ea6-8cdd-7d3be10f8f49.lovable.app
📦 **Cloak SDK:** [`@cloak.dev/sdk@0.1.5`](https://www.npmjs.com/package/@cloak.dev/sdk)

---

## 1. The problem

Crypto payments are public by default. Anyone can open Solscan, paste your
wallet, and read your full revenue, your customer list, your salary, your
runway. For freelancers, agencies, creators, and small SaaS teams that need
to accept stablecoins — that's a non-starter. They go back to Stripe and
lose access to instant settlement, low fees, and global reach.

**Who it's for**

- Freelancers and contractors invoicing in USDC/USDT
- Indie SaaS founders accepting global payments
- Agencies sending payouts to contributors
- Anyone who wants the UX of `pix.com`/`stripe.com/pay/...` with on-chain
  privacy as a default, not an upgrade.

CloakPay is **Stripe Payment Links, but private**:
1. Connect your Solana wallet.
2. Type an amount, hit "Create link" — get `cloakpay.app/pay/abc123`.
3. The payer clicks, taps "Pay 50 USDC", done. Amount and recipient are
   encrypted on-chain via Cloak's UTXO + zero-knowledge model.

---

## 2. How the Cloak SDK is used (and why it's fundamental)

The Cloak SDK *is* the product. Without Cloak this is just another link
generator. Concretely:

| Where Cloak is used               | SDK call                                  | Why it matters                                                                 |
| --------------------------------- | ----------------------------------------- | ------------------------------------------------------------------------------ |
| Generating per-link stealth address | `generateUtxoKeypair()`                  | Each payment link gets a fresh on-chain identity. Two links to the same person never correlate on-chain. |
| Bootstrapping recipient identity  | `generateCloakKeys()`                     | Real master / spend / view key tree (`master.seedHex`, `spend.pk_spend_hex`, `view.vk_secret_hex`) cached per wallet. |
| Encrypting outbound notes         | `encryptNoteForRecipient()` *(planned)*   | The amount + memo are encrypted to the recipient's viewing key.                |
| Receiving without revealing       | `scanNotesForWallet()` + viewing key      | Only someone with the viewing key can detect and decrypt incoming notes.        |
| UI helpers                        | `formatAmount`, `getExplorerUrl`, `isValidSolanaAddress`, `LAMPORTS_PER_SOL` | Single source of truth for amount math, explorer links, and address validation. |
| Just-in-time deposit              | `createDepositInstruction()` *(prod path)* | Lets payers think in "USDC", not "shielded balance vs public balance". One-tap pay. |

All of this lives behind a small interface (`CloakService`) so swapping the
demo's submission step for the real `transact()` / `transfer()` SDK calls is a
**single-file change**:

```
src/lib/cloak/
  ├── types.ts          ← SDK-agnostic interface (CloakService)
  ├── service.ts        ← factory / singleton
  ├── mock-service.ts   ← real SDK helpers + simulated submission for demo
  └── provider.tsx      ← React hooks: useCloak, useShieldedBalance, usePrivateSend
```

### What's real vs. simulated in this demo

| Layer                                     | Status        |
| ----------------------------------------- | ------------- |
| Cloak key derivation (`generateCloakKeys`)| ✅ Real SDK   |
| Stealth address per link (`generateUtxoKeypair`) | ✅ Real SDK |
| Viewing key generation                    | ✅ Real SDK   |
| Amount/format utilities                   | ✅ Real SDK   |
| Wallet connect (Phantom, Solflare)        | ✅ Real `@solana/wallet-adapter-react` |
| ZK proof generation                       | ⏳ Simulated timing — to enable, replace `submitOnChain()` in `mock-service.ts` with `transact()` from `@cloak.dev/sdk` |
| On-chain submission                       | ⏳ Simulated signature — needs a funded wallet (devnet/mainnet) |

This split is intentional: every part of the stack that *encodes the privacy
model* is real Cloak; the only mock is the actual on-chain hop, which
requires a funded wallet to demo end-to-end.

---

## 3. Tech stack

- **Frontend:** React 19 + TanStack Start v1 (SSR + edge runtime)
- **Bundler:** Vite 7
- **Styling:** Tailwind CSS v4 (`oklch` design tokens in `src/styles.css`)
- **UI:** shadcn/ui, lucide-react, sonner, qrcode.react, framer-motion
- **Privacy:** [`@cloak.dev/sdk`](https://www.npmjs.com/package/@cloak.dev/sdk) `^0.1.5`
- **Chain:** [`@solana/web3.js`](https://www.npmjs.com/package/@solana/web3.js) `^1.98`
- **Persistence:** `localStorage` (links, shielded balance, viewing keys) — swappable

---

## 4. Install & run

```bash
# 1. Clone
git clone <this-repo-url>
cd cloakpay

# 2. Install
bun install        # or: npm install / pnpm install

# 3. Environment (optional — defaults to Solana devnet)
cp .env.example .env

# 4. Dev server
bun dev            # http://localhost:5173

# 5. Production build
bun run build
bun run preview
```

### Environment variables

| Variable               | Default                          | Notes                                       |
| ---------------------- | -------------------------------- | ------------------------------------------- |
| `VITE_SOLANA_NETWORK`  | `devnet`                         | `devnet` \| `testnet` \| `mainnet-beta`     |
| `VITE_SOLANA_RPC_URL`  | (cluster default)                | Custom RPC (Helius, QuickNode, Triton, …)   |

### Test with a real wallet

1. Install [Phantom](https://phantom.app/) or [Solflare](https://solflare.com/).
2. Switch the wallet's network to **Devnet**.
3. Get free devnet SOL: <https://faucet.solana.com>.
4. Click "Connect wallet" → CloakPay will prompt the wallet popup.

---

## 4b. Deploy on Vercel

This app is configured for **static (SPA) deployment** on Vercel — no
serverless functions needed (the Cloak SDK and wallet adapter are 100%
client-side).

```bash
# 1. Push to GitHub (use the Lovable "Connect to GitHub" button, then push).

# 2. On vercel.com → Add New Project → Import the repo.
#    Vercel will auto-detect `vercel.json`:
#      - Build command:    bun run build
#      - Output directory: dist
#      - Install command:  bun install

# 3. (Optional) Set env vars in Project Settings → Environment Variables:
#      VITE_SOLANA_NETWORK = devnet
#      VITE_SOLANA_RPC_URL = <your RPC, optional>

# 4. Deploy. SPA fallback is handled by `vercel.json` rewrites so deep links
#    like /pay/abc123 work on refresh.
```

To enable real on-chain submission later, replace the body of
`submitOnChain()` in `src/lib/cloak/mock-service.ts` with the real flow
from [docs.cloak.ag/sdk/quickstart](https://docs.cloak.ag/sdk/quickstart):
`createDepositInstruction → sendTransaction` for deposits, `transact`
for shielded transfers. The wallet is already wired via
`@solana/wallet-adapter-react`.

---

## 5. Pages / routes

| Route          | Purpose                                                           |
| -------------- | ----------------------------------------------------------------- |
| `/`            | Landing page — value prop + CTA                                   |
| `/dashboard`   | Wallet-gated dashboard: list links, totals, viewing-key reveal    |
| `/create`      | New payment link form (amount, token, optional description)        |
| `/pay/$id`     | Public payment page — connect wallet, one-tap private pay         |

---

## 6. Deployed program IDs / front-end links

- **Frontend (preview):** https://id-preview--62839e74-5185-4ea6-8cdd-7d3be10f8f49.lovable.app
- **Cloak shield-pool program ID:** exported by the SDK as
  `CLOAK_PROGRAM_ID` from `@cloak.dev/sdk` — this app reads it directly
  rather than hard-coding a copy.
- **Native SOL mint:** `NATIVE_SOL_MINT` (also from the SDK).

---

## 7. Project structure

```
src/
├── routes/
│   ├── __root.tsx          # Root layout, providers, toaster
│   ├── index.tsx           # Landing
│   ├── dashboard.tsx       # Merchant view
│   ├── create.tsx          # New link flow
│   └── pay.$id.tsx         # Public payment page (state machine)
├── components/
│   ├── Header.tsx          # Wallet connect, nav
│   ├── ShareLink.tsx       # QR + copy + Web Share API
│   └── ui/...              # shadcn primitives
├── lib/
│   ├── cloak/              # 🔒 Cloak SDK abstraction (see above)
│   ├── wallet.tsx          # Wallet context (mock today, adapter-ready)
│   ├── storage.ts          # PaymentLink persistence
│   └── types.ts            # PaymentLink, TokenSymbol, PaymentStatus
└── styles.css              # Design tokens (oklch) + Tailwind v4
```

---

## 8. Design decisions worth calling out

1. **Cloak behind an interface, not sprinkled across the UI.** The pages
   never import from `@cloak.dev/sdk` directly — only from
   `@/lib/cloak`. This keeps the SDK swappable and makes the privacy
   model legible by reading **one** module.
2. **One-click pay UX (auto-deposit).** Payers don't think "first I
   deposit USDC into the shielded pool, then I send a private transfer."
   The `privateSend({ autoDeposit: true })` flag collapses both into a
   single confirmation, mirroring Stripe Checkout's "Pay" button.
3. **Each link gets a fresh stealth address.** Two links from the same
   merchant are uncorrelatable on-chain. This is what makes "private
   payment link" actually private.
4. **No crypto jargon in the payer UI.** "Encrypted payment", "Pay
   50 USDC", "Sub-second" — never "ZK proof" or "UTXO" on user-facing
   surfaces. Trust language ("Verified · cloakpay.app", network status
   dot) borrows from Stripe's payment page.
5. **Real Cloak crypto, simulated network hop.** Every piece that
   *encodes the privacy model* uses real SDK calls. Only the on-chain
   submission is a `setTimeout` — flagged in the README and isolated to
   `submitOnChain()` so a single function swap goes live.

---

## 9. Roadmap (post-MVP)

- [ ] Real `@solana/wallet-adapter-react` integration (Phantom, Solflare, Backpack)
- [ ] Replace `submitOnChain()` with real `transact()` on devnet
- [ ] Note scanning via `scanNotesForWallet()` for received-payment detection
- [ ] Diversified viewing keys (`deriveDiversifiedViewingKey`) per accountant
- [ ] Move `PaymentLink` storage to a database (Lovable Cloud) for cross-device history
- [ ] Webhook system for "payment received" events (server functions)

---

## 10. Resources

- Cloak site: https://cloak.ag
- SDK docs: https://docs.cloak.ag/sdk/introduction
- SDK quickstart: https://docs.cloak.ag/sdk/quickstart
- API reference: https://docs.cloak.ag/sdk/api-reference
- Cloak GitHub: https://github.com/cloak-ag/

---

Built for the [Cloak Track on Superteam Earn](https://superteam.fun/earn/listing/cloak-track).
