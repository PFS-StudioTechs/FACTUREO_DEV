import { describe, it, expect } from "vitest";
import { buildLucaContext, getActionChips } from "@/lib/luca/lucaContext";
import type { Signal } from "@/lib/assistant/signals";

function sig(overrides: Partial<Signal>): Signal {
  return {
    id: "s1", severite: "attention", categorie: "paiement",
    titre: "t", description: "d", actionLabel: "Voir", actionRoute: "/factures",
    ...overrides,
  };
}

describe("buildLucaContext", () => {
  it("aucun signal -> tout au vert", () => {
    const ctx = buildLucaContext([], "Karl");
    expect(ctx).toEqual({ userName: "Karl", toutAuVert: true, signauxCles: [], nbTotal: 0 });
  });

  it("combine plusieurs signaux de même catégorie en un seul groupe compté", () => {
    const signals = [
      sig({ id: "a", categorie: "paiement", severite: "critique" }),
      sig({ id: "b", categorie: "paiement", severite: "critique" }),
    ];
    const ctx = buildLucaContext(signals, "Karl");
    expect(ctx.toutAuVert).toBe(false);
    expect(ctx.nbTotal).toBe(2);
    expect(ctx.signauxCles).toHaveLength(1);
    expect(ctx.signauxCles[0]).toMatchObject({ categorie: "paiement", severite: "critique", count: 2 });
  });

  it("combine plusieurs catégories différentes (ex: impayés + TVA)", () => {
    const signals = [
      sig({ id: "a", categorie: "paiement", severite: "critique" }),
      sig({ id: "b", categorie: "echeance", severite: "critique", actionRoute: "/echeancier" }),
    ];
    const ctx = buildLucaContext(signals, "Karl");
    expect(ctx.signauxCles.map(s => s.categorie).sort()).toEqual(["echeance", "paiement"]);
  });

  it("plafonne à 3 signaux clés même avec plus de catégories", () => {
    const signals = [
      sig({ id: "a", categorie: "echeance", severite: "critique" }),
      sig({ id: "b", categorie: "paiement", severite: "critique" }),
      sig({ id: "c", categorie: "relance", severite: "attention" }),
      sig({ id: "d", categorie: "notes_de_frais", severite: "attention" }),
      sig({ id: "e", categorie: "autre_categorie", severite: "info" }),
    ];
    const ctx = buildLucaContext(signals, "Karl");
    expect(ctx.signauxCles).toHaveLength(3);
    expect(ctx.nbTotal).toBe(5);
  });

  it("trie les groupes par sévérité (critique avant attention avant info)", () => {
    const signals = [
      sig({ id: "a", categorie: "notes_de_frais", severite: "info" }),
      sig({ id: "b", categorie: "paiement", severite: "critique" }),
      sig({ id: "c", categorie: "relance", severite: "attention" }),
    ];
    const ctx = buildLucaContext(signals, "Karl");
    expect(ctx.signauxCles.map(s => s.categorie)).toEqual(["paiement", "relance", "notes_de_frais"]);
  });
});

describe("getActionChips", () => {
  it("dérive une puce par signal clé, lien profond uniquement", () => {
    const ctx = buildLucaContext([sig({ actionLabel: "Préparer une relance", actionRoute: "/relances" })], "Karl");
    const chips = getActionChips(ctx);
    expect(chips).toEqual([{ label: "Préparer une relance", route: "/relances" }]);
  });

  it("état vide -> aucune puce", () => {
    const ctx = buildLucaContext([], "Karl");
    expect(getActionChips(ctx)).toEqual([]);
  });
});
