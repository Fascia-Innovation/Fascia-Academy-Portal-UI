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
import MonthlyHistory from "./pages/MonthlyHistory";
import UpcomingCourses from "./pages/UpcomingCourses";
import UserManagement from "./pages/UserManagement";
import MyCourses from "./pages/MyCourses";
import MyCommissions from "./pages/MyCommissions";
import NotFound from "./pages/NotFound";
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

  if (location === "/login") {
    if (user) {
      if (user.role === "admin") return <Redirect to="/" />;
      if (user.role === "course_leader") return <Redirect to="/my-courses" />;
      return <Redirect to="/my-commissions" />;
    }
    return <Login />;
  }

  if (!user) return <Redirect to="/login" />;

  if (location === "/" && user.role === "course_leader") return <Redirect to="/my-courses" />;
  if (location === "/" && user.role === "affiliate") return <Redirect to="/my-commissions" />;

  return (
    <DashboardShell>
      <Switch>
        {user.role === "admin" && <Route path="/" component={AdminOverview} />}
        {user.role === "admin" && <Route path="/course-leaders" component={CourseLeaderRanking} />}
        {user.role === "admin" && <Route path="/affiliates" component={AffiliateRanking} />}
        {user.role === "admin" && <Route path="/history" component={MonthlyHistory} />}
        {user.role === "admin" && <Route path="/upcoming" component={UpcomingCourses} />}
        {user.role === "admin" && <Route path="/users" component={UserManagement} />}
        {(user.role === "admin" || user.role === "course_leader") && <Route path="/my-courses" component={MyCourses} />}
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
