import { describe, it, expect } from "vitest";
import { generateReminderDraft, REMINDER_LEVELS } from "@/lib/payments/reminderTemplates";

const vars = { clientNom: "Client SARL", numeroFacture: "F-2026-042", montantTtc: 1200, dateEcheance: "15/07/2026" };

describe("generateReminderDraft", () => {
  it("expose bien les 3 niveaux", () => {
    expect(REMINDER_LEVELS.map(l => l.value)).toEqual(["courtois", "ferme", "mise_en_demeure"]);
  });

  it("niveau courtois : ton rappel, substitue toutes les variables", () => {
    const draft = generateReminderDraft("courtois", vars);
    expect(draft.subject).toContain("F-2026-042");
    expect(draft.body).toContain("Client SARL");
    expect(draft.body).toContain("1200.00");
    expect(draft.body).toContain("15/07/2026");
    expect(draft.body.toLowerCase()).not.toContain("mise en demeure");
  });

  it("niveau ferme : ton plus insistant", () => {
    const draft = generateReminderDraft("ferme", vars);
    expect(draft.subject.toLowerCase()).toContain("retard");
    expect(draft.body).toContain("F-2026-042");
  });

  it("niveau mise_en_demeure : mention légale explicite", () => {
    const draft = generateReminderDraft("mise_en_demeure", vars);
    expect(draft.subject.toLowerCase()).toContain("mise en demeure");
    expect(draft.body.toLowerCase()).toContain("en demeure");
    expect(draft.body).toContain("8 jours");
  });

  it("les 3 niveaux produisent des textes différents (pas de gabarit générique réutilisé tel quel)", () => {
    const bodies = (["courtois", "ferme", "mise_en_demeure"] as const).map(l => generateReminderDraft(l, vars).body);
    expect(new Set(bodies).size).toBe(3);
  });
});
