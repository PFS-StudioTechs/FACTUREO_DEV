import { useLocation, Link } from "react-router-dom";
import { useEffect } from "react";
import { Icon } from "@/components/ui/Icon";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error("404 : route inexistante ->", location.pathname);
  }, [location.pathname]);

  return (
    <div style={{
      minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
      background: "var(--bg-0)", padding: 24, gap: 16, textAlign: "center",
    }}>
      <span style={{
        width: 56, height: 56, borderRadius: "50%", background: "var(--bg-2)",
        display: "inline-flex", alignItems: "center", justifyContent: "center",
      }}>
        <Icon name="alert" size={26} color="var(--text-3)" />
      </span>
      <div>
        <h1 style={{ fontSize: 44, fontWeight: 700, color: "var(--text-1)", margin: 0, letterSpacing: "-0.03em" }}>404</h1>
        <p style={{ fontSize: 15, color: "var(--text-3)", margin: "6px 0 0" }}>Cette page n'existe pas ou plus.</p>
      </div>
      <Link
        to="/"
        style={{
          marginTop: 8, padding: "10px 20px", borderRadius: "var(--r-3)",
          background: "var(--accent)", color: "var(--accent-on)",
          fontSize: 14, fontWeight: 500, boxShadow: "var(--shadow-accent)",
        }}
      >
        Retour à l'accueil
      </Link>
    </div>
  );
};

export default NotFound;
