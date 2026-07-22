import { describe, it, expect } from "vitest";
import { getUrgencyLevel } from "@/lib/obligations/urgency";

describe("getUrgencyLevel", () => {
  const today = new Date(2026, 6, 22); // 22 juillet 2026

  it("gris si le statut est 'fait', quelle que soit la date", () => {
    expect(getUrgencyLevel("2026-12-31", "fait", today)).toBe("gris");
  });
  it("gris si la date est passée", () => {
    expect(getUrgencyLevel("2026-07-01", "a_faire", today)).toBe("gris");
  });
  it("rouge si moins de 7 jours", () => {
    expect(getUrgencyLevel("2026-07-25", "a_faire", today)).toBe("rouge");
  });
  it("orange entre 7 et 30 jours", () => {
    expect(getUrgencyLevel("2026-08-10", "a_faire", today)).toBe("orange");
  });
  it("vert au-delà de 30 jours", () => {
    expect(getUrgencyLevel("2026-12-01", "a_faire", today)).toBe("vert");
  });
});
