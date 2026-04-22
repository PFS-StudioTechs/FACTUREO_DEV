import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import AppLayout from "@/components/AppLayout";
import Auth from "@/pages/Auth";
import Index from "@/pages/Index";
import Companies from "@/pages/Companies";
import Clients from "@/pages/Clients";
import Invoices from "@/pages/Invoices";
import InvoiceSettings from "@/pages/InvoiceSettings";
import UserManagement from "@/pages/UserManagement";
import Previsionnel from "@/pages/Previsionnel";
import NotFound from "@/pages/NotFound";
import ResetPassword from "@/pages/ResetPassword";
import CompanyDetail from "@/pages/CompanyDetail";
import ExpenseScans from "@/pages/ExpenseScans";

const queryClient = new QueryClient();

const ProtectedRoutes = () => {
  const { user, role, loading } = useAuth();

  if (loading || (user && !role)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!user) return <Navigate to="/auth" replace />;

  // User has no role assigned → access denied
  if (!role) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="text-center space-y-4">
          <h1 className="text-2xl font-bold">Accès non autorisé</h1>
          <p className="text-muted-foreground">Votre compte n'a pas encore été activé par un administrateur.</p>
          <p className="text-sm text-muted-foreground">Contactez votre administrateur pour obtenir l'accès.</p>
        </div>
      </div>
    );
  }

  return <AppLayout />;
};

const AuthRoute = () => {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (user) return <Navigate to="/" replace />;
  return <Auth />;
};

/** Wrapper to restrict admin-only routes */
const AdminRoute = ({ children }: { children: React.ReactNode }) => {
  const { isAdmin } = useAuth();
  if (!isAdmin) return <Navigate to="/" replace />;
  return <>{children}</>;
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/auth" element={<AuthRoute />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route element={<ProtectedRoutes />}>
              {/* For admin: dashboard. For user: invoices */}
              <Route path="/" element={<RoleBasedIndex />} />
              <Route path="/entreprises" element={<Companies />} />
              <Route path="/entreprises/:id" element={<CompanyDetail />} />
              <Route path="/clients" element={<Clients />} />
              <Route path="/factures" element={<Invoices />} />
              <Route path="/previsionnel" element={<Previsionnel />} />
              <Route path="/notes-de-frais" element={<ExpenseScans />} />
              <Route path="/parametrage" element={<AdminRoute><InvoiceSettings /></AdminRoute>} />
              <Route path="/utilisateurs" element={<AdminRoute><UserManagement /></AdminRoute>} />
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

/** Shows dashboard for all authenticated users */
const RoleBasedIndex = () => {
  return <Index />;
};

export default App;
