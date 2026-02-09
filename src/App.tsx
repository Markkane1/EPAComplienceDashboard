import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import Index from "./pages/Index";
import Track from "./pages/Track";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import MyApplications from "./pages/MyApplications";
import ApplicantLogin from "./pages/ApplicantLogin";
import VerifyEmail from "./pages/VerifyEmail";
import MagicLogin from "./pages/MagicLogin";
import Dashboard from "./pages/dashboard/Dashboard";
import Applications from "./pages/dashboard/Applications";
import Hearings from "./pages/dashboard/Hearings";
import Users from "./pages/dashboard/Users";
import Categories from "./pages/dashboard/Categories";
import Reports from "./pages/dashboard/Reports";
import ApplicationDetails from "./pages/dashboard/ApplicationDetails";
import Violations from "./pages/dashboard/Violations";
import AuditLogs from "./pages/dashboard/AuditLogs";
import Profile from "./pages/Profile";
import NotFound from "./pages/NotFound";

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
            <Route path="/signup" element={<Signup />} />
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
