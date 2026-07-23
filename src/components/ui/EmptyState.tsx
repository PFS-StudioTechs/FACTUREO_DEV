import { Icon } from "@/components/ui/Icon";

interface EmptyStateProps {
  icon: string;
  title: string;
  description?: string;
  action?: { label: string; onClick: () => void };
}

export const EmptyState = ({ icon, title, description, action }: EmptyStateProps) => (
  <div style={{ padding: "56px 16px", textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
    <span style={{
      width: 48, height: 48, borderRadius: "50%", background: "var(--bg-2)",
      display: "inline-flex", alignItems: "center", justifyContent: "center", marginBottom: 4,
    }}>
      <Icon name={icon} size={22} color="var(--text-3)" />
    </span>
    <div style={{ fontSize: 14, fontWeight: 500, color: "var(--text-2)" }}>{title}</div>
    {description && <div style={{ fontSize: 12.5, color: "var(--text-3)", maxWidth: 320 }}>{description}</div>}
    {action && (
      <button
        onClick={action.onClick}
        className="card-interactive"
        style={{
          marginTop: 10, padding: "8px 16px", borderRadius: "var(--r-3)",
          background: "var(--bg-2)", border: "1px solid var(--border)",
          color: "var(--text-1)", fontSize: 13, fontWeight: 500, cursor: "pointer",
        }}
      >
        {action.label}
      </button>
    )}
  </div>
);
