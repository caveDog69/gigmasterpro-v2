import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Eye, EyeOff, RotateCcw } from 'lucide-react';
import { clearCacheAndReset, useAuth } from '../../contexts/AuthContext';
import { api, errorMessage } from '../../lib/api';
import PasswordRules, { passwordValid } from '../../components/PasswordRules';
import { Spinner } from '../../components/ui';

export type AuthMode = 'login' | 'signup' | 'forgot';

export default function AuthPanel({ initialMode = 'signup', onModeChange }: { initialMode?: AuthMode; onModeChange?: (m: AuthMode) => void }) {
  const { signIn, signUp, signOutReason, clearSignOutReason } = useAuth();
  const navigate = useNavigate();
  const [mode, setModeState] = useState<AuthMode>(initialMode);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const setMode = (m: AuthMode) => {
    setModeState(m);
    setError(null);
    setNotice(null);
    onModeChange?.(m);
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setNotice(null);
    clearSignOutReason();
    if (mode === 'signup' && !passwordValid(password)) {
      setError('Your password does not meet the requirements yet.');
      return;
    }
    setBusy(true);
    try {
      if (mode === 'login') {
        await signIn(email.trim(), password);
        navigate('/dashboard');
      } else if (mode === 'signup') {
        await signUp(email.trim(), password, displayName.trim());
        navigate('/dashboard');
      } else {
        const res = await api.post<{ message: string }>('/auth/forgot-password', { email: email.trim() });
        setNotice(res.message);
      }
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const titles = { login: 'Welcome back', signup: 'Create your free account', forgot: 'Reset your password' };
  const subtitles = {
    login: 'Sign in to your repertoire, setlists and gigs.',
    signup: 'Start organizing your music career in minutes.',
    forgot: "Enter your email and we'll send you a reset link.",
  };

  return (
    <div className="w-full rounded-2xl border border-gray-800 bg-gray-900/80 p-6 shadow-2xl shadow-purple-950/40 backdrop-blur sm:p-8">
      <h2 className="text-2xl font-bold text-white">{titles[mode]}</h2>
      <p className="mt-1 text-sm text-gray-400">{subtitles[mode]}</p>
      {mode !== 'forgot' && (
        <div className="mt-5 grid grid-cols-2 rounded-lg bg-gray-800/70 p-1 text-sm" role="tablist">
          {(['signup', 'login'] as const).map((m) => (
            <button key={m} type="button" role="tab" aria-selected={mode === m} onClick={() => setMode(m)} className={`rounded-md py-1.5 font-medium transition ${mode === m ? 'bg-purple-600 text-white shadow' : 'text-gray-400 hover:text-white'}`}>
              {m === 'signup' ? 'Sign up' : 'Sign in'}
            </button>
          ))}
        </div>
      )}
      {signOutReason && <p className="mt-4 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-200">{signOutReason}</p>}
      <form className="mt-5 space-y-4" onSubmit={submit} noValidate>
        {mode === 'signup' && (
          <div>
            <label className="label" htmlFor="auth-name">Display name</label>
            <input id="auth-name" className="input" value={displayName} onChange={(e) => setDisplayName(e.target.value)} required autoComplete="name" placeholder="e.g. Jamie Rivers" maxLength={100} />
          </div>
        )}
        <div>
          <label className="label" htmlFor="auth-email">Email</label>
          <input id="auth-email" type="email" className="input" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" placeholder="you@example.com" />
        </div>
        {mode !== 'forgot' && (
          <div>
            <div className="flex items-center justify-between">
              <label className="label" htmlFor="auth-password">Password</label>
              {mode === 'login' && (
                <button type="button" className="mb-1.5 text-xs text-purple-300 hover:text-purple-200" onClick={() => setMode('forgot')}>Forgot password?</button>
              )}
            </div>
            <div className="relative">
              <input id="auth-password" type={showPw ? 'text' : 'password'} className="input pr-10" value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} />
              <button type="button" className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-gray-500 hover:text-gray-300" onClick={() => setShowPw((s) => !s)} aria-label={showPw ? 'Hide password' : 'Show password'}>
                {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {mode === 'signup' && <PasswordRules password={password} />}
          </div>
        )}
        {error && <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200" role="alert">{error}</p>}
        {notice && <p className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-200">{notice}</p>}
        <button type="submit" className="btn-primary w-full py-2.5" disabled={busy}>
          {busy && <Spinner className="h-4 w-4 text-white" />}
          {mode === 'login' ? 'Sign in' : mode === 'signup' ? 'Create account' : 'Send reset link'}
        </button>
      </form>
      {mode === 'forgot' ? (
        <p className="mt-4 text-center text-sm text-gray-400">
          Remembered it? <button className="link" onClick={() => setMode('login')}>Back to sign in</button>
        </p>
      ) : mode === 'login' ? (
        <div className="mt-5 border-t border-gray-800 pt-4 text-center">
          <button type="button" onClick={clearCacheAndReset} className="inline-flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-300" title="Clears saved sessions and cached data in this browser">
            <RotateCcw className="h-3.5 w-3.5" /> Having trouble signing in? Clear Cache &amp; Reset
          </button>
        </div>
      ) : (
        <p className="mt-4 text-center text-xs text-gray-500">
          <Link to="/login" className="link">Already have an account?</Link>
        </p>
      )}
    </div>
  );
}
