import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { FileText, Home, Building2, Users, Receipt, Settings, LogOut, Menu, ShieldCheck, CalendarDays, ScanLine } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

const AppLayout = () => {
  const { pseudo, role, isAdmin, signOut } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const navItems = [
    { to: "/", icon: Home, label: "Accueil" },
    { to: "/entreprises", icon: Building2, label: "Entreprises" },
    { to: "/clients", icon: Users, label: "Clients" },
    { to: "/factures", icon: Receipt, label: "Mes factures" },
    { to: "/previsionnel", icon: CalendarDays, label: "Prévisionnel" },
    { to: "/notes-de-frais", icon: ScanLine, label: "Notes de frais" },
    ...(isAdmin ? [{ to: "/parametrage", icon: Settings, label: "Paramétrage" }] : []),
    ...(isAdmin ? [{ to: "/utilisateurs", icon: ShieldCheck, label: "Utilisateurs" }] : []),
  ];

  return (
    <div className="min-h-screen flex bg-background">
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-foreground/20 backdrop-blur-sm z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside
        className={cn(
          "fixed lg:static inset-y-0 left-0 z-50 w-64 bg-sidebar text-sidebar-foreground flex flex-col transition-transform duration-300 lg:translate-x-0",
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="p-6 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-sidebar-primary flex items-center justify-center">
            <FileText className="w-6 h-6 text-sidebar-primary-foreground" />
          </div>
          <span className="text-xl font-bold tracking-tight" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
            Facturéo
          </span>
        </div>

        <nav className="flex-1 px-3 space-y-1">
          {navItems.map((item) => (
            <NavLink
              key={item.to + item.label}
              to={item.to}
              end={item.to === "/"}
              onClick={() => setSidebarOpen(false)}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors",
                  isActive
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground"
                )
              }
            >
              <item.icon className="w-5 h-5" />
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="p-4 border-t border-sidebar-border">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-sm font-medium truncate">{pseudo || "Utilisateur"}</span>
              <Badge variant="outline" className="text-[10px] border-sidebar-border text-sidebar-foreground/60 shrink-0">
                {role || "—"}
              </Badge>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={signOut}
              className="text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent/50 shrink-0"
            >
              <LogOut className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </aside>

      <main className="flex-1 flex flex-col min-h-screen">
        <header className="h-16 border-b bg-card flex items-center px-4 lg:px-8 gap-4">
          <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setSidebarOpen(true)}>
            <Menu className="w-5 h-5" />
          </Button>
          <div className="flex-1" />
        </header>
        <div className="flex-1 p-4 lg:p-8 overflow-auto">
          <Outlet />
        </div>
      </main>
    </div>
  );
};

export default AppLayout;
