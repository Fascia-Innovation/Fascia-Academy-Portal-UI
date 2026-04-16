import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Route, Switch, useLocation, Redirect } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import { DashAuthProvider, useDashAuth } from "./contexts/DashAuthContext";
import DashboardShell from "./components/DashboardShell";
import Login from "./pages/Login";
import AdminOverview from "./pages/AdminOverview";
import CourseLeaderRanking from "./pages/CourseLeaderRanking";
import AffiliateRanking from "./pages/AffiliateRanking";
import CoursesAdmin from "./pages/CoursesAdmin";
import Students from "./pages/Students";
import SettingsPage from "./pages/SettingsPage";
import MyCourses from "./pages/MyCourses";
import MyOverview from "./pages/MyOverview";
import MyCommissions from "./pages/MyCommissions";
import NotFound from "./pages/NotFound";
import PublicCourses from "./pages/PublicCourses";
import Settlements from "./pages/Settlements";
import ResetPassword from "./pages/ResetPassword";
import ExamQueue from "./pages/ExamQueue";
import Certificates from "./pages/Certificates";
import { Loader2 } from "lucide-react";

function AppRoutes() {
  const { user, loading } = useDashAuth();
  const [location] = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Public routes — no auth required
  if (location === "/courses" || location.startsWith("/courses?")) {
    return <PublicCourses />;
  }

  if (location === "/reset-password" || location.startsWith("/reset-password?")) {
    return <ResetPassword />;
  }

  if (location === "/login") {
    if (user) {
      if (user.role === "admin") return <Redirect to="/" />;
      if (user.role === "course_leader") return <Redirect to="/my-overview" />;
      return <Redirect to="/my-commissions" />;
    }
    return <Login />;
  }

  if (!user) return <Redirect to="/login" />;

  if (location === "/" && user.role === "course_leader") return <Redirect to="/my-overview" />;
  if (location === "/" && user.role === "affiliate") return <Redirect to="/my-commissions" />;

  return (
    <DashboardShell>
      <Switch>
        {/* Admin routes */}
        {user.role === "admin" && <Route path="/" component={AdminOverview} />}
        {user.role === "admin" && <Route path="/courses-admin" component={CoursesAdmin} />}
        {user.role === "admin" && <Route path="/students" component={Students} />}
        {user.role === "admin" && <Route path="/course-leaders" component={CourseLeaderRanking} />}
        {user.role === "admin" && <Route path="/affiliates" component={AffiliateRanking} />}
        {user.role === "admin" && <Route path="/settlements" component={Settlements} />}
        {user.role === "admin" && <Route path="/settings" component={SettingsPage} />}
        {(user.role === "admin" || user.canExamineExams) && <Route path="/exam-queue" component={ExamQueue} />}
        {(user.role === "admin" || user.canExamineExams) && <Route path="/certificates" component={Certificates} />}

        {/* Course Leader routes */}
        {user.role === "course_leader" && <Route path="/my-overview" component={MyOverview} />}
        {(user.role === "admin" || user.role === "course_leader") && <Route path="/my-courses" component={MyCourses} />}
        {(user.role === "course_leader" || user.role === "affiliate") && <Route path="/my-settlements" component={Settlements} />}

        {/* Affiliate routes */}
        {(user.role === "admin" || user.role === "affiliate") && <Route path="/my-commissions" component={MyCommissions} />}

        <Route component={NotFound} />
      </Switch>
    </DashboardShell>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <TooltipProvider>
          <Toaster />
          <DashAuthProvider>
            <AppRoutes />
          </DashAuthProvider>
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
