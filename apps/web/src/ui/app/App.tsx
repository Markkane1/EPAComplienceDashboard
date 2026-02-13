import { Toaster } from "@/ui/components/ui/toaster";
import { Toaster as Sonner } from "@/ui/components/ui/sonner";
import { TooltipProvider } from "@/ui/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/ui/hooks/useAuth";
import { ProtectedRoute } from "@/ui/components/auth/ProtectedRoute";
import Index from "@/ui/features/pages/Index";
import Track from "@/ui/features/pages/Track";
import Login from "@/ui/features/pages/Login";
import MyApplications from "@/ui/features/pages/MyApplications";
import ApplicantLogin from "@/ui/features/pages/ApplicantLogin";
import VerifyEmail from "@/ui/features/pages/VerifyEmail";
import MagicLogin from "@/ui/features/pages/MagicLogin";
import Dashboard from "@/ui/features/pages/dashboard/Dashboard";
import Applications from "@/ui/features/pages/dashboard/Applications";
import Hearings from "@/ui/features/pages/dashboard/Hearings";
import Users from "@/ui/features/pages/dashboard/Users";
import Categories from "@/ui/features/pages/dashboard/Categories";
import Reports from "@/ui/features/pages/dashboard/Reports";
import ApplicationDetails from "@/ui/features/pages/dashboard/ApplicationDetails";
import Violations from "@/ui/features/pages/dashboard/Violations";
import AuditLogs from "@/ui/features/pages/dashboard/AuditLogs";
import Profile from "@/ui/features/pages/Profile";
import NotFound from "@/ui/features/pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/track" element={<Track />} />
            <Route path="/login" element={<Login />} />
            <Route path="/applicant-login" element={<ApplicantLogin />} />
            <Route path="/signup" element={<Navigate to="/applicant-login" replace />} />
            <Route path="/verify-email" element={<VerifyEmail />} />
            <Route path="/magic-login" element={<MagicLogin />} />
            <Route
              path="/my-applications"
              element={
                <ProtectedRoute>
                  <MyApplications />
                </ProtectedRoute>
              }
            />
            <Route
              path="/dashboard"
              element={
                <ProtectedRoute>
                  <Dashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/profile"
              element={
                <ProtectedRoute>
                  <Profile />
                </ProtectedRoute>
              }
            />
            <Route
              path="/dashboard/applications"
              element={
                <ProtectedRoute>
                  <Applications />
                </ProtectedRoute>
              }
            />
            <Route
              path="/dashboard/applications/:id"
              element={
                <ProtectedRoute>
                  <ApplicationDetails />
                </ProtectedRoute>
              }
            />
            <Route
              path="/dashboard/hearings"
              element={
                <ProtectedRoute>
                  <Hearings />
                </ProtectedRoute>
              }
            />
            <Route
              path="/dashboard/users"
              element={
                <ProtectedRoute>
                  <Users />
                </ProtectedRoute>
              }
            />
            <Route
              path="/dashboard/reports"
              element={
                <ProtectedRoute>
                  <Reports />
                </ProtectedRoute>
              }
            />
            <Route
              path="/dashboard/categories"
              element={
                <ProtectedRoute>
                  <Categories />
                </ProtectedRoute>
              }
            />
            <Route
              path="/dashboard/violations"
              element={
                <ProtectedRoute>
                  <Violations />
                </ProtectedRoute>
              }
            />
            <Route
              path="/dashboard/audit-logs"
              element={
                <ProtectedRoute>
                  <AuditLogs />
                </ProtectedRoute>
              }
            />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;



