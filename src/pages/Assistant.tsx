import { useNavigate } from "react-router-dom";
import { useIsMobile } from "@/hooks/use-mobile";
import { Pill } from "@/components/ui/primitives";
import { Icon } from "@/components/ui/Icon";
import { SkeletonRows } from "@/components/ui/skeleton";
import { useAssistantSignals } from "@/hooks/useAssistantSignals";
import type { Severite } from "@/lib/assistant/signals";

const SEVERITE_STYLE: Record<Severite, { bg: string; color: string; label: string; icon: string }> = {
  critique:  { bg: "var(--danger-soft)",  color: "var(--danger)",  label: "Critique",  icon: "alert" },
  attention: { bg: "var(--warning-soft, #fef3c7)", color: "var(--warning, #d97706)", label: "Attention", icon: "clock" },
  info:      { bg: "var(--bg-3)",         color: "var(--text-3)",  label: "Info",       icon: "bell" },
};

// Ce module ne fait qu'observer (lecture seule) et proposer des liens profonds —
// toute action (préparer une relance, clôturer une échéance...) se valide dans le module concerné.
const Assistant = () => {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const { signals, isLoading } = useAssistantSignals();

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
      <div style={{
        padding: isMobile ? "12px 16px" : "16px 24px", borderBottom: "1px solid var(--border)",
        display: "flex", alignItems: "center", gap: 12,
      }}>
        <span style={{
          width: 28, height: 28, borderRadius: "50%", flexShrink: 0, overflow: "hidden",
          background: "var(--ai-soft)",
          display: "inline-flex", alignItems: "center", justifyContent: "center",
        }}>
          <img src="/Avatar Luca.png" alt="Luca" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h1 style={{ fontSize: 20, fontWeight: 600, color: "var(--text-1)", margin: 0, letterSpacing: "-0.02em" }}>
            Ce qui requiert votre attention
          </h1>
          <div style={{ fontSize: 11.5, color: "var(--text-3)" }}>Repéré par Luca</div>
        </div>
        {signals.length > 0 && <Pill size="sm" tone="neutral">{signals.length}</Pill>}
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: "16px 24px 24px" }}>
        {isLoading ? (
          <SkeletonRows count={4} rowHeight={54} />
        ) : signals.length === 0 ? (
          <div style={{ padding: "64px 0", textAlign: "center", color: "var(--text-3)", fontSize: 13 }}>
            <Icon name="check" size={36} style={{ marginBottom: 10, display: "block", margin: "0 auto 10px" }} />
            Rien ne requiert votre attention.
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {signals.map(s => {
              const style = SEVERITE_STYLE[s.severite];
              return (
                <button
                  key={s.id}
                  onClick={() => navigate(s.actionRoute)}
                  style={{
                    background: "var(--bg-2)", border: "1px solid var(--border)", borderRadius: "var(--r-3)",
                    padding: "12px 16px", display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap",
                    cursor: "pointer", textAlign: "left", width: "100%",
                  }}
                >
                  <span style={{
                    fontSize: 11, fontWeight: 600, padding: "3px 10px", borderRadius: 999,
                    background: style.bg, color: style.color, flexShrink: 0,
                    display: "inline-flex", alignItems: "center", gap: 4,
                  }}>
                    <Icon name={style.icon} size={11} /> {style.label}
                  </span>
                  <div style={{ flex: 1, minWidth: 200 }}>
                    <div style={{ fontSize: 13, fontWeight: 500, color: "var(--text-1)" }}>{s.titre}</div>
                    <div style={{ fontSize: 11.5, color: "var(--text-3)" }}>{s.description}</div>
                  </div>
                  <span style={{ fontSize: 12, color: "var(--ai-bright)", display: "inline-flex", alignItems: "center", gap: 4, flexShrink: 0 }}>
                    {s.actionLabel} <Icon name="arrowRight" size={13} />
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default Assistant;
