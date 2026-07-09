// src/pages/LoginPage.jsx — TeamPulse branding
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { authApi } from "../services/api";
import useStore from "../store/useStore";
import {
  auth, googleProvider, signInWithPopup,
  createUserWithEmailAndPassword, signInWithEmailAndPassword,
} from "../services/firebase";
import {
  getAuth, sendPasswordResetEmail, sendEmailVerification,
} from "firebase/auth";
import {
  Mail, Lock, User, ArrowRight, Eye, EyeOff, KeyRound,
  Zap, Search, MessageSquare, BarChart2,
} from "lucide-react";

// Professional feature icons using Lucide
const FEATURES = [
  {
    icon: Zap,
    text: "Extracts tasks, deadlines & assignees from meetings automatically",
  },
  {
    icon: Search,
    text: "Semantic search across all your team's documents and discussions",
  },
  {
    icon: MessageSquare,
    text: "Real-time collaboration with AI-powered conversation summaries",
  },
  {
    icon: BarChart2,
    text: "Track team productivity, task trends and performance analytics",
  },
];

export default function LoginPage() {
  const navigate = useNavigate();
  const { setUser, setToken, setTeams, setActiveTeam } = useStore();

  const [mode,             setMode]             = useState("login");
  const [loading,          setLoading]          = useState(false);
  const [showPw,           setShowPw]           = useState(false);
  const [form,             setForm]             = useState({ email: "", password: "", name: "" });
  const [verificationSent, setVerificationSent] = useState(false);

  const setField = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }));

  const finishLogin = async (idToken, email, displayName) => {
    const r = await authApi.firebaseLogin(idToken, email, displayName);
    setToken(r.data.accessToken);
    localStorage.setItem("atb_refresh_token", r.data.refreshToken);
    setUser(r.data.user);
    const teamsR = await authApi.getMyTeams();
    setTeams(teamsR.data.teams);
    if (teamsR.data.teams.length === 0) navigate("/onboarding");
    else { setActiveTeam(teamsR.data.teams[0]); navigate("/"); }
  };

  const handleGoogle = async () => {
    if (!auth) { toast.error("Firebase not configured. Use email login."); return; }
    setLoading(true);
    try {
      const result  = await signInWithPopup(auth, googleProvider);
      const idToken = await result.user.getIdToken();
      await finishLogin(idToken, result.user.email, result.user.displayName);
      toast.success("Welcome to TeamPulse! 🎉");
    } catch (e) {
      if (e.code !== "auth/popup-closed-by-user")
        toast.error(e.message || "Google sign-in failed");
    } finally { setLoading(false); }
  };

  const handleEmail = async (e) => {
    e.preventDefault();
    if (!form.email.trim())       { toast.error("Email is required"); return; }
    if (form.password.length < 6) { toast.error("Password must be at least 6 characters"); return; }
    setLoading(true);
    try {
      if (auth) {
        if (mode === "signup") {
          const result = await createUserWithEmailAndPassword(auth, form.email, form.password);
          await sendEmailVerification(result.user);
          setVerificationSent(true);
          setMode("login");
          toast.success("Verification email sent! Check your inbox before signing in.", { duration: 6000 });
          setLoading(false);
          return;
        } else {
          const result = await signInWithEmailAndPassword(auth, form.email, form.password);
          if (!result.user.emailVerified) {
            toast(
              (t) => (
                <div className="flex flex-col gap-2">
                  <p className="text-sm font-semibold">Email not verified yet.</p>
                  <p className="text-xs text-gray-500">Check your inbox or resend the link.</p>
                  <button
                    onClick={async () => {
                      await sendEmailVerification(result.user);
                      toast.dismiss(t.id);
                      toast.success("Verification email resent!");
                    }}
                    className="text-xs text-brand-600 font-semibold hover:underline text-left"
                  >
                    Resend verification email →
                  </button>
                </div>
              ),
              { duration: 8000 }
            );
            await auth.signOut();
            setLoading(false);
            return;
          }
          const idToken = await result.user.getIdToken();
          await finishLogin(idToken, result.user.email, result.user.displayName || form.name);
          toast.success("Welcome back! 👋");
        }
      } else {
        const mockToken = `mock_${Date.now()}`;
        await finishLogin(mockToken, form.email, form.name || form.email.split("@")[0]);
        toast.success(mode === "signup" ? "Account created!" : "Signed in!");
      }
    } catch (e) {
      const msgs = {
        "auth/user-not-found":       "No account found. Sign up first.",
        "auth/wrong-password":       "Incorrect password.",
        "auth/invalid-credential":   "Invalid email or password.",
        "auth/email-already-in-use": "Email already registered. Sign in.",
        "auth/invalid-email":        "Invalid email address.",
        "auth/too-many-requests":    "Too many attempts. Try again later.",
      };
      toast.error(msgs[e.code] || e.message || "Authentication failed");
    } finally { setLoading(false); }
  };

  const handlePasswordReset = async (e) => {
    e.preventDefault();
    const email = form.email.trim();
    if (!email) { toast.error("Enter your email address first"); return; }
    if (!auth)  { toast.error("Firebase not configured"); return; }
    setLoading(true);
    try {
      const { fetchSignInMethodsForEmail } = await import("firebase/auth");
      const methods = await fetchSignInMethodsForEmail(auth, email);
      if (!methods || methods.length === 0) {
        toast.error("No account found with this email. Sign up to get started.", { duration: 5000 });
        setLoading(false);
        return;
      }
      await sendPasswordResetEmail(auth, email);
      toast.success(`Password reset link sent to ${email}`, { duration: 6000 });
      setMode("login");
    } catch (e) {
      const msgs = {
        "auth/user-not-found":    "No account found with this email.",
        "auth/invalid-email":     "Invalid email address.",
        "auth/too-many-requests": "Too many requests. Try again later.",
      };
      toast.error(msgs[e.code] || "Failed to send reset email");
    } finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen flex bg-[var(--bg)]">

      {/* ── Left hero panel ───────────────────────────────────── */}
      <div className="hidden lg:flex flex-col justify-between w-[45%] bg-gradient-to-br from-brand-800 via-brand-600 to-brand-500 p-12 text-white relative overflow-hidden">
        {/* Background decoration */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-20 -right-20 w-80 h-80 rounded-full bg-white/5 blur-3xl"/>
          <div className="absolute -bottom-20 -left-10 w-64 h-64 rounded-full bg-white/5 blur-2xl"/>
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 rounded-full bg-white/3 blur-3xl"/>
        </div>

        {/* Logo */}
        <div className="relative flex items-center gap-3">
          <div className="w-10 h-10 bg-white/15 backdrop-blur rounded-xl flex items-center justify-center border border-white/20">
            <Zap size={20} className="text-white"/>
          </div>
          <span className="text-2xl font-bold tracking-tight">TeamPulse</span>
        </div>

        {/* Hero text */}
        <div className="relative">
          <p className="text-brand-200 text-sm font-medium uppercase tracking-widest mb-4">
            Where teams move as one
          </p>
          <h1 className="text-4xl font-bold leading-tight mb-3">
            Every decision.<br/>Every deadline.<br/>Every person.
          </h1>
          <p className="text-brand-100 text-base leading-relaxed mb-10 max-w-sm">
            Turn scattered meetings, chats, and documents into clear action —
            so your team always knows what's next.
          </p>

          {/* Feature list with Lucide icons */}
          <div className="space-y-4">
            {FEATURES.map(({ icon: Icon, text }) => (
              <div key={text} className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-white/10 border border-white/15 flex items-center justify-center shrink-0 mt-0.5">
                  <Icon size={15} className="text-brand-200"/>
                </div>
                <p className="text-brand-100 text-sm leading-relaxed">{text}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Bottom quote */}
        <div className="relative">
          <div className="border-l-2 border-white/30 pl-4">
            <p className="text-brand-100 text-sm italic leading-relaxed">
              "The best teams don't just communicate — they stay in sync."
            </p>
            <p className="text-brand-300 text-xs mt-2 font-medium">— TeamPulse</p>
          </div>
        </div>
      </div>

      {/* ── Right auth panel ──────────────────────────────────── */}
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-md">

          {/* Mobile logo */}
          <div className="flex items-center gap-3 mb-8 lg:hidden">
            <div className="w-9 h-9 bg-brand-600 rounded-xl flex items-center justify-center">
              <Zap size={18} className="text-white"/>
            </div>
            <span className="text-xl font-bold text-[var(--text)]">TeamPulse</span>
          </div>

          {/* ── Password reset mode ──────────────────────────── */}
          {mode === "reset" ? (
            <>
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-xl bg-brand-100 dark:bg-brand-900/30 flex items-center justify-center">
                  <KeyRound size={20} className="text-brand-600"/>
                </div>
                <div>
                  <h2 className="text-xl font-bold text-[var(--text)]">Reset password</h2>
                  <p className="text-sm text-[var(--text-2)]">We'll send a reset link to your email</p>
                </div>
              </div>
              <form onSubmit={handlePasswordReset} className="space-y-4">
                <div className="relative">
                  <Mail size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--text-2)]"/>
                  <input className="input pl-10" type="email" placeholder="Your email address"
                    value={form.email} onChange={setField("email")} required autoFocus/>
                </div>
                <button type="submit" disabled={loading} className="btn-primary w-full justify-center py-3 text-sm">
                  {loading ? "Sending…" : <><span>Send reset email</span><ArrowRight size={16}/></>}
                </button>
              </form>
              <button onClick={() => setMode("login")} className="mt-4 text-sm text-brand-600 hover:underline block text-center">
                ← Back to sign in
              </button>
            </>
          ) : (
            <>
              {/* Verification notice */}
              {verificationSent && (
                <div className="mb-5 p-4 rounded-xl bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800">
                  <p className="text-sm font-semibold text-green-700 dark:text-green-400">📧 Check your inbox!</p>
                  <p className="text-xs text-green-600 dark:text-green-500 mt-1">
                    Verify your email before signing in.
                  </p>
                </div>
              )}

              <h2 className="text-2xl font-bold text-[var(--text)] mb-1">
                {mode === "login" ? "Welcome back" : "Join TeamPulse"}
              </h2>
              <p className="text-[var(--text-2)] text-sm mb-7">
                {mode === "login"
                  ? "Sign in to your workspace"
                  : "Create your account and get your team in sync"}
              </p>

              {/* Google */}
              <button
                onClick={handleGoogle}
                disabled={loading}
                className="w-full flex items-center justify-center gap-3 px-4 py-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] hover:bg-[var(--surface-2)] transition-colors text-sm font-medium text-[var(--text)] mb-5 disabled:opacity-50"
              >
                <svg width="18" height="18" viewBox="0 0 18 18">
                  <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 01-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z"/>
                  <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 009 18z"/>
                  <path fill="#FBBC05" d="M3.964 10.71A5.41 5.41 0 013.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 000 9c0 1.452.348 2.827.957 4.042l3.007-2.332z"/>
                  <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 00.957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z"/>
                </svg>
                Continue with Google
              </button>

              <div className="flex items-center gap-3 mb-5">
                <div className="flex-1 h-px bg-[var(--border)]"/>
                <span className="text-xs text-[var(--text-2)]">or with email</span>
                <div className="flex-1 h-px bg-[var(--border)]"/>
              </div>

              <form onSubmit={handleEmail} className="space-y-4">
                {mode === "signup" && (
                  <div className="relative">
                    <User size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--text-2)]"/>
                    <input className="input pl-10" placeholder="Full name"
                      value={form.name} onChange={setField("name")} autoComplete="name"/>
                  </div>
                )}
                <div className="relative">
                  <Mail size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--text-2)]"/>
                  <input className="input pl-10" type="email" placeholder="Email address"
                    value={form.email} onChange={setField("email")} autoComplete="email" required/>
                </div>
                <div>
                  <div className="relative">
                    <Lock size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--text-2)]"/>
                    <input
                      className="input pl-10 pr-10"
                      type={showPw ? "text" : "password"}
                      placeholder="Password (min. 6 characters)"
                      value={form.password}
                      onChange={setField("password")}
                      autoComplete={mode === "signup" ? "new-password" : "current-password"}
                      required
                    />
                    <button type="button" onClick={() => setShowPw(v => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-2)] hover:text-[var(--text)]">
                      {showPw ? <EyeOff size={15}/> : <Eye size={15}/>}
                    </button>
                  </div>
                  {mode === "login" && (
                    <button type="button" onClick={() => setMode("reset")}
                      className="mt-1.5 text-xs text-brand-600 hover:underline float-right">
                      Forgot password?
                    </button>
                  )}
                </div>

                <div className="clear-both"/>

                <button type="submit" disabled={loading} className="btn-primary w-full justify-center py-3 text-sm">
                  {loading ? (
                    <span className="flex items-center gap-2">
                      <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
                      </svg>
                      {mode === "signup" ? "Creating account…" : "Signing in…"}
                    </span>
                  ) : (
                    <span className="flex items-center gap-2">
                      {mode === "signup" ? "Create account" : "Sign in"}
                      <ArrowRight size={16}/>
                    </span>
                  )}
                </button>
              </form>

              <p className="text-center text-sm text-[var(--text-2)] mt-5">
                {mode === "login" ? "Don't have an account? " : "Already have an account? "}
                <button
                  onClick={() => { setMode(m => m === "login" ? "signup" : "login"); setVerificationSent(false); }}
                  className="text-brand-600 font-semibold hover:underline"
                >
                  {mode === "login" ? "Sign up free" : "Sign in"}
                </button>
              </p>

              {!auth && (
                <p className="text-center text-xs text-[var(--text-2)] mt-3 opacity-60">
                  Dev mode active — email verification disabled
                </p>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
