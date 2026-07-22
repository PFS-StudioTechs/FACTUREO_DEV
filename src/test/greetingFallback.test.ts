import { describe, it, expect } from "vitest";
import { buildFallbackGreeting } from "@/lib/luca/greetingFallback";
import type { LucaGreetingContext } from "@/lib/luca/lucaContext";

describe("buildFallbackGreeting", () => {
  it("tout au vert -> message détendu, jamais alarmiste", () => {
    const ctx: LucaGreetingContext = { userName: "Karl", toutAuVert: true, signauxCles: [], nbTotal: 0 };
    const msg = buildFallbackGreeting(ctx);
    expect(msg).toContain("Karl");
    expect(msg).toContain("vert");
  });

  it("un seul signal clé -> le mentionne et propose l'action prioritaire", () => {
    const ctx: LucaGreetingContext = {
      userName: "Karl", toutAuVert: false, nbTotal: 1,
      signauxCles: [{ categorie: "paiement", severite: "critique", count: 1, actionLabel: "Voir la facture", actionRoute: "/factures" }],
    };
    const msg = buildFallbackGreeting(ctx);
    expect(msg).toContain("facture en attente");
    expect(msg).toContain("Voir la facture");
  });

  it("combine impayés + TVA en une phrase naturelle", () => {
    const ctx: LucaGreetingContext = {
      userName: "Karl", toutAuVert: false, nbTotal: 2,
      signauxCles: [
        { categorie: "paiement", severite: "critique", count: 2, actionLabel: "Voir les factures", actionRoute: "/factures" },
        { categorie: "echeance", severite: "critique", count: 1, actionLabel: "Voir la TVA", actionRoute: "/echeancier" },
      ],
    };
    const msg = buildFallbackGreeting(ctx);
    expect(msg).toContain("2 factures en attente");
    expect(msg).toContain("échéance");
    expect(msg).toContain(" et ");
    // Propose l'action la plus prioritaire (premier signal clé)
    expect(msg).toContain("Voir les factures");
  });

  it("mentionne qu'il y a d'autres signaux au-delà des 3 affichés", () => {
    const ctx: LucaGreetingContext = {
      userName: "Karl", toutAuVert: false, nbTotal: 10,
      signauxCles: [{ categorie: "notes_de_frais", severite: "attention", count: 2, actionLabel: "Voir les notes", actionRoute: "/notes-de-frais" }],
    };
    const msg = buildFallbackGreeting(ctx);
    expect(msg).toContain("broutilles");
  });

  it("n'invente jamais de chiffre absent du contexte", () => {
    const ctx: LucaGreetingContext = {
      userName: "Karl", toutAuVert: false, nbTotal: 1,
      signauxCles: [{ categorie: "relance", severite: "attention", count: 1, actionLabel: "Préparer une relance", actionRoute: "/relances" }],
    };
    const msg = buildFallbackGreeting(ctx);
    expect(msg).not.toMatch(/\d+/); // aucun chiffre inventé quand count === 1 partout
  });
});
