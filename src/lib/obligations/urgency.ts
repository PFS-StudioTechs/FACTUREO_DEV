export type UrgencyLevel = "vert" | "orange" | "rouge" | "gris";

/** Pure : niveau d'urgence d'une échéance selon sa date et son statut. */
export function getUrgencyLevel(dateEcheance: string, statut: string, today: Date): UrgencyLevel {
  if (statut === "fait") return "gris";

  const [y, m, d] = dateEcheance.split("-").map(Number);
  const due = new Date(y, m - 1, d);
  const ref = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const diffDays = Math.round((due.getTime() - ref.getTime()) / 86400000);

  if (diffDays < 0) return "gris"; // passé
  if (diffDays < 7) return "rouge";
  if (diffDays <= 30) return "orange";
  return "vert";
}
