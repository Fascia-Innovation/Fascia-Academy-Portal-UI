import { useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { useDashAuth } from "@/contexts/DashAuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2, Lock, Mail, CheckCircle, ArrowLeft } from "lucide-react";

export default function Login() {
  const [, navigate] = useLocation();
  const { refetch } = useDashAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [forgotMode, setForgotMode] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotSent, setForgotSent] = useState(false);

  const forgotMut = trpc.dashboard.requestPasswordReset.useMutation({
    onSuccess: () => setForgotSent(true),
    onError: (err) => toast.error(err.message),
  });

  const loginMutation = trpc.dashboard.login.useMutation({
    onSuccess: (user) => {
      refetch();
      if (user.role === "admin") navigate("/");
      else if (user.role === "course_leader") navigate("/my-courses");
      else navigate("/my-commissions");
    },
    onError: (err) => {
      toast.error(err.message || "Login failed. Please check your credentials.");
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      toast.error("Please enter your email and password.");
      return;
    }
    loginMutation.mutate({ email, password });
  };

  const handleForgot = (e: React.FormEvent) => {
    e.preventDefault();
    if (!forgotEmail) {
      toast.error("Please enter your email address.");
      return;
    }
    forgotMut.mutate({ email: forgotEmail });
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[oklch(0.17_0.04_255)] to-[oklch(0.22_0.06_255)]">
      <div className="w-full max-w-md">
        {/* Logo / Brand */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-[oklch(0.72_0.12_75)] mb-5 shadow-lg">
            <span className="text-2xl font-bold text-[oklch(0.17_0.04_255)]" style={{ fontFamily: "'Playfair Display', serif" }}>FA</span>
          </div>
          <h1 className="text-3xl font-bold text-white" style={{ fontFamily: "'Playfair Display', serif" }}>
            Fascia Academy
          </h1>
          <p className="text-[oklch(0.65_0.03_250)] mt-2 text-sm">Settlement Portal</p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl shadow-2xl p-8">
          {forgotMode ? (
            forgotSent ? (
              /* Sent confirmation */
              <div className="text-center">
                <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
                <h2 className="text-xl font-semibold mb-2">Request Sent</h2>
                <p className="text-sm text-muted-foreground mb-6">
                  A password reset link has been sent to the administrator at{" "}
                  <strong>info@fasciaacademy.com</strong>. They will forward the link to you shortly.
                  The link expires in 1 hour.
                </p>
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => { setForgotMode(false); setForgotSent(false); }}
                >
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back to Sign In
                </Button>
              </div>
            ) : (
              /* Forgot password form */
              <>
                <button
                  type="button"
                  className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-4"
                  onClick={() => setForgotMode(false)}
                >
                  <ArrowLeft className="h-3.5 w-3.5" /> Back to sign in
                </button>
                <h2 className="text-xl font-semibold text-foreground mb-1">Reset Password</h2>
                <p className="text-sm text-muted-foreground mb-6">
                  Enter your email address and a reset link will be sent to the administrator, who will forward it to you.
                </p>
                <form onSubmit={handleForgot} className="space-y-5">
                  <div className="space-y-1.5">
                    <Label htmlFor="forgot-email" className="text-sm font-medium">Email address</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="forgot-email"
                        type="email"
                        placeholder="you@example.com"
                        value={forgotEmail}
                        onChange={(e) => setForgotEmail(e.target.value)}
                        className="pl-9"
                        autoComplete="email"
                      />
                    </div>
                  </div>
                  <Button
                    type="submit"
                    className="w-full bg-[oklch(0.22_0.04_255)] hover:bg-[oklch(0.28_0.05_255)] text-white font-medium h-11"
                    disabled={forgotMut.isPending}
                  >
                    {forgotMut.isPending ? (
                      <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Sending…</>
                    ) : (
                      "Send Reset Request"
                    )}
                  </Button>
                </form>
              </>
            )
          ) : (
            /* Normal login form */
            <>
              <h2 className="text-xl font-semibold text-foreground mb-1">Sign in</h2>
              <p className="text-sm text-muted-foreground mb-6">Enter your credentials to access the dashboard.</p>

              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="space-y-1.5">
                  <Label htmlFor="email" className="text-sm font-medium">Email address</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="email"
                      type="email"
                      placeholder="you@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="pl-9"
                      autoComplete="email"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="password" className="text-sm font-medium">Password</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="password"
                      type="password"
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="pl-9"
                      autoComplete="current-password"
                    />
                  </div>
                </div>

                <Button
                  type="submit"
                  className="w-full bg-[oklch(0.22_0.04_255)] hover:bg-[oklch(0.28_0.05_255)] text-white font-medium h-11"
                  disabled={loginMutation.isPending}
                >
                  {loginMutation.isPending ? (
                    <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Signing in…</>
                  ) : (
                    "Sign in"
                  )}
                </Button>
              </form>

              <p className="text-xs text-muted-foreground text-center mt-6">
                Forgot your password?{" "}
                <button
                  type="button"
                  className="underline hover:no-underline text-foreground"
                  onClick={() => { setForgotMode(true); setForgotEmail(email); }}
                >
                  Reset it
                </button>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
