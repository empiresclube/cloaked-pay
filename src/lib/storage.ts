/**
 * LocalStorage-backed payment links store.
 * Replace with a real backend (Lovable Cloud) when persistence is needed.
 */

import type { PaymentLink, PaymentStatus } from "./types";

const KEY = "cloak_payment_links_v1";
const MERCHANT_UTXO_KEY = (linkId: string) => `cloak.merchant.utxo.${linkId}`;

/** UTXO private key (bigint hex) the merchant holds for a given link. */
export interface MerchantUtxoSecret {
  linkId: string;
  privateKeyHex: string;
  publicKeyHex: string;
  createdAt: number;
}

export const merchantUtxoStore = {
  save(secret: MerchantUtxoSecret) {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(
      MERCHANT_UTXO_KEY(secret.linkId),
      JSON.stringify(secret),
    );
  },
  get(linkId: string): MerchantUtxoSecret | null {
    if (typeof window === "undefined") return null;
    const raw = window.localStorage.getItem(MERCHANT_UTXO_KEY(linkId));
    if (!raw) return null;
    try {
      return JSON.parse(raw) as MerchantUtxoSecret;
    } catch {
      return null;
    }
  },
  remove(linkId: string) {
    if (typeof window === "undefined") return;
    window.localStorage.removeItem(MERCHANT_UTXO_KEY(linkId));
  },
};

function read(): PaymentLink[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as PaymentLink[]) : [];
  } catch {
    return [];
  }
}

function write(links: PaymentLink[]) {
  window.localStorage.setItem(KEY, JSON.stringify(links));
  window.dispatchEvent(new CustomEvent("cloak:links-updated"));
}

export const linksStore = {
  all(): PaymentLink[] {
    return read().sort((a, b) => b.createdAt - a.createdAt);
  },
  forOwner(owner: string): PaymentLink[] {
    return read()
      .filter((l) => l.owner === owner)
      .sort((a, b) => b.createdAt - a.createdAt);
  },
  get(id: string): PaymentLink | undefined {
    return read().find((l) => l.id === id);
  },
  create(link: PaymentLink) {
    const links = read();
    links.push(link);
    write(links);
  },
  updateStatus(id: string, status: PaymentStatus, txSignature?: string) {
    const links = read();
    const idx = links.findIndex((l) => l.id === id);
    if (idx === -1) return;
    links[idx] = {
      ...links[idx],
      status,
      paidAt: status === "paid" ? Date.now() : links[idx].paidAt,
      txSignature: txSignature ?? links[idx].txSignature,
    };
    write(links);
  },
  markWithdrawn(id: string, withdrawSignature: string) {
    const links = read();
    const idx = links.findIndex((l) => l.id === id);
    if (idx === -1) return;
    links[idx] = {
      ...links[idx],
      withdrawSignature,
      withdrawnAt: Date.now(),
    };
    write(links);
  },
  remove(id: string) {
    merchantUtxoStore.remove(id);
    write(read().filter((l) => l.id !== id));
  },
};
