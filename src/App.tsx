import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AwsAuthProvider } from "@/contexts/AwsAuthContext";
import { NotificationProvider } from "@/contexts/NotificationContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { ThemeProvider } from "next-themes";
import Auth from "./pages/Auth";
import Learning from "./pages/Learning";
import RepDashboard from "./pages/RepDashboard";
import RepDeals from "./pages/rep/RepDeals";
import DealDetails from "./pages/rep/DealDetails";
import RepMap from "./pages/rep/RepMap";
import PinDetails from "./pages/rep/PinDetails";
import CalendarDateDetails from "./pages/rep/CalendarDateDetails";
import RepJotForm from "./pages/rep/RepJotForm";
import AdminDashboard from "./pages/AdminDashboard";
import RepsManagement from "./pages/admin/RepsManagement";
import AdminDeals from "./pages/admin/AdminDeals";
import AdminMap from "./pages/admin/AdminMap";
import AdminCommissions from "./pages/admin/AdminCommissions";
import AdminJotForm from "./pages/admin/AdminJotForm";
import AdminSettings from "./pages/admin/AdminSettings";
import NotFound from "./pages/NotFound";
import RepCalendar from "./pages/rep/RepCalendar";
import AddAppointment from "./pages/rep/AddAppointment";
import AddEvent from "./pages/rep/AddEvent";

const queryClient = new QueryClient();

// Get basename for GitHub Pages (production) vs local development
const basename = import.meta.env.BASE_URL;

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter basename={basename}>
          <AwsAuthProvider>
            <NotificationProvider>
              <Routes>
              <Route path="/" element={<Navigate to="/auth" replace />} />
              <Route path="/auth" element={<Auth />} />

              {/* Learning Route - accessible to reps regardless of training status */}
              <Route
                path="/learning"
                element={
                  <ProtectedRoute allowedRoles={['rep']} skipTrainingCheck>
                    <Learning />

                </ProtectedRoute>
                }
              />

              {/* Rep Routes - require training completion */}
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
                path="/deals/:dealId"
                element={
                  <ProtectedRoute allowedRoles={['rep']}>
                    <DealDetails />
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
                path="/map/pin/:pinId"
                element={
                  <ProtectedRoute allowedRoles={['rep']}>
                    <PinDetails />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/map/date/:date"
                element={
                  <ProtectedRoute allowedRoles={['rep']}>
                    <CalendarDateDetails />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/calendar"
                element={
                  <ProtectedRoute allowedRoles={['rep']}>
                    <RepCalendar />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/add-appointment"
                element={
                  <ProtectedRoute allowedRoles={['rep']}>
                    <AddAppointment />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/add-event"
                element={
                  <ProtectedRoute allowedRoles={['rep']}>
                    <AddEvent />
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
                path="/admin/map"
                element={
                  <ProtectedRoute allowedRoles={['admin']}>
                    <AdminMap />
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
            </NotificationProvider>
          </AwsAuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
