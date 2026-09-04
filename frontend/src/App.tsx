import type { ReactNode } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { Toaster } from "sonner";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import { ViewerPage } from "@/routes/ViewerPage";
import { LoginPage } from "@/routes/LoginPage";
import { AdminMapListPage } from "@/routes/admin/AdminMapListPage";
import { AdminCalibratePage } from "@/routes/admin/AdminCalibratePage";

function RequireAnyUser({ children }: { children: ReactNode }) {
  const { username, requireLogin, loading } = useAuth();
  if (loading) {
    return <div className="flex h-screen items-center justify-center text-muted-foreground">Lade…</div>;
  }
  if (requireLogin && !username) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function RequireAdmin({ children }: { children: ReactNode }) {
  const { username, role, loading } = useAuth();
  if (loading) {
    return <div className="flex h-screen items-center justify-center text-muted-foreground">Lade…</div>;
  }
  if (!username) return <Navigate to="/login" replace />;
  if (role !== "admin") return <Navigate to="/" replace />;
  return <>{children}</>;
}

function AppRoutes() {
  return (
    <Routes>
      <Route
        path="/"
        element={
          <RequireAnyUser>
            <ViewerPage />
          </RequireAnyUser>
        }
      />
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/admin"
        element={
          <RequireAdmin>
            <AdminMapListPage />
          </RequireAdmin>
        }
      />
      <Route
        path="/admin/maps/:mapId"
        element={
          <RequireAdmin>
            <AdminCalibratePage />
          </RequireAdmin>
        }
      />
    </Routes>
  );
}

export function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Toaster theme="dark" position="top-right" richColors />
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}
