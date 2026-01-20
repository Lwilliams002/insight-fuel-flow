import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import Auth from "./pages/Auth";
import RepDashboard from "./pages/RepDashboard";
import AdminDashboard from "./pages/AdminDashboard";
import RepsManagement from "./pages/admin/RepsManagement";
import MerchantsManagement from "./pages/admin/MerchantsManagement";
import StatementUpload from "./pages/admin/StatementUpload";
import AccountsUpload from "./pages/admin/AccountsUpload";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/" element={<Navigate to="/auth" replace />} />
            <Route path="/auth" element={<Auth />} />
            <Route
              path="/dashboard"
              element={
                <ProtectedRoute allowedRoles={['rep']}>
                  <RepDashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin"
              element={
                <ProtectedRoute allowedRoles={['admin']}>
                  <AdminDashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/reps"
              element={
                <ProtectedRoute allowedRoles={['admin']}>
                  <RepsManagement />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/merchants"
              element={
                <ProtectedRoute allowedRoles={['admin']}>
                  <MerchantsManagement />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/upload"
              element={
                <ProtectedRoute allowedRoles={['admin']}>
                  <StatementUpload />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/accounts-upload"
              element={
                <ProtectedRoute allowedRoles={['admin']}>
                  <AccountsUpload />
                </ProtectedRoute>
              }
            />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
