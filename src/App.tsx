import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import AppShell from "@/components/layout/AppShell";
import Auth from "@/pages/Auth";
import AuthCallback from "@/pages/AuthCallback";
import CompleteProfile from "@/pages/CompleteProfile";
import UploadKbis from "@/pages/UploadKbis";
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
import Echeancier from "@/pages/Echeancier";

const queryClient = new QueryClient();

/** Spinner shared between guards */
const Spinner = () => (
  <div className="min-h-screen flex items-center justify-center bg-background">
    <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
  </div>
);

/** Main app routes — requires email verified + profile completed + KBIS if deadline passed */
const ProtectedRoutes = () => {
  const { user, role, loading, profileCompleted, kbisUrl, kbisDeadline } = useAuth();

  if (loading || (user && role === undefined)) return <Spinner />;
  if (!user) return <Navigate to="/auth" replace />;

  // Email not yet confirmed
  if (!user.email_confirmed_at) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="text-center space-y-4 max-w-sm">
          <h1 className="text-2xl font-bold">Vérifiez votre email</h1>
          <p className="text-muted-foreground">
            Cliquez sur le lien de confirmation envoyé à <strong>{user.email}</strong> pour activer votre compte.
          </p>
        </div>
      </div>
    );
  }

  // Profile not completed
  if (!profileCompleted) return <Navigate to="/complete-profile" replace />;

  // KBIS gate: deadline passed and no KBIS uploaded
  if (kbisDeadline && new Date(kbisDeadline) < new Date() && !kbisUrl) {
    return <Navigate to="/upload-kbis" replace />;
  }

  return <AppShell />;
};

/** Public auth pages — redirect to app if already logged in */
const AuthRoute = () => {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (user) return <Navigate to="/" replace />;
  return <Auth />;
};

/** Routes that need a session but are outside the main app guard (profile completion, kbis upload) */
const AuthRequiredRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading } = useAuth();
  if (loading) return <Spinner />;
  if (!user) return <Navigate to="/auth" replace />;
  return <>{children}</>;
};

/** Admin-only route wrapper */
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
            {/* Public */}
            <Route path="/auth" element={<AuthRoute />} />
            <Route path="/auth/callback" element={<AuthCallback />} />
            <Route path="/reset-password" element={<ResetPassword />} />

            {/* Auth-required but outside main guard */}
            <Route path="/complete-profile" element={<AuthRequiredRoute><CompleteProfile /></AuthRequiredRoute>} />
            <Route path="/upload-kbis" element={<AuthRequiredRoute><UploadKbis /></AuthRequiredRoute>} />

            {/* Protected app */}
            <Route element={<ProtectedRoutes />}>
              <Route path="/" element={<Index />} />
              <Route path="/entreprises" element={<Companies />} />
              <Route path="/entreprises/:id" element={<CompanyDetail />} />
              <Route path="/clients" element={<Clients />} />
              <Route path="/factures" element={<Invoices />} />
              <Route path="/previsionnel" element={<Previsionnel />} />
              <Route path="/notes-de-frais" element={<ExpenseScans />} />
              <Route path="/echeancier" element={<Echeancier />} />
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

export default App;
