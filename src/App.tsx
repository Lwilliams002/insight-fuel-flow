import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import Auth from "./pages/Auth";
import RepDashboard from "./pages/RepDashboard";
import RepDeals from "./pages/rep/RepDeals";
import RepMap from "./pages/rep/RepMap";
import RepJotForm from "./pages/rep/RepJotForm";
import AdminDashboard from "./pages/AdminDashboard";
import RepsManagement from "./pages/admin/RepsManagement";
import AdminDeals from "./pages/admin/AdminDeals";
import AdminCommissions from "./pages/admin/AdminCommissions";
import AdminJotForm from "./pages/admin/AdminJotForm";
import AdminSettings from "./pages/admin/AdminSettings";
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
            
            {/* Rep Routes */}
            <Route
              path="/dashboard"
              element={
                <ProtectedRoute allowedRoles={['rep']}>
                  <RepDashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/deals"
              element={
                <ProtectedRoute allowedRoles={['rep']}>
                  <RepDeals />
                </ProtectedRoute>
              }
            />
            <Route
              path="/map"
              element={
                <ProtectedRoute allowedRoles={['rep']}>
                  <RepMap />
                </ProtectedRoute>
              }
            />
            <Route
              path="/submit"
              element={
                <ProtectedRoute allowedRoles={['rep']}>
                  <RepJotForm />
                </ProtectedRoute>
              }
            />
            
            {/* Admin Routes */}
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
              path="/admin/deals"
              element={
                <ProtectedRoute allowedRoles={['admin']}>
                  <AdminDeals />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/commissions"
              element={
                <ProtectedRoute allowedRoles={['admin']}>
                  <AdminCommissions />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/jotform"
              element={
                <ProtectedRoute allowedRoles={['admin']}>
                  <AdminJotForm />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/settings"
              element={
                <ProtectedRoute allowedRoles={['admin']}>
                  <AdminSettings />
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
