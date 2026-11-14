import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { api, errorMessage } from '../../lib/api';
import { useAuth } from '../../contexts/AuthContext';
import type { Session } from '../../lib/types';
import Logo from '../../components/Logo';
import PasswordRules, { passwordValid } from '../../components/PasswordRules';
import { Spinner } from '../../components/ui';

export default function ResetPassword() {
  const [params] = useSearchParams();
  const token = params.get('token') || '';
  const { applySession } = useAuth();
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!passwordValid(password)) return setError('Your password does not meet the requirements yet.');
    if (password !== confirm) return setError('Passwords do not match.');
    setBusy(true);
    setError(null);
    try {
      const s = await api.post<Session>('/auth/reset-password', { token, password });
      applySession(s);
      navigate('/dashboard', { replace: true });
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-900 px-4">
      <Link to="/" className="mb-8"><Logo /></Link>
      <form onSubmit={submit} className="card w-full max-w-md space-y-4 p-6 sm:p-8">
        <h1 className="text-2xl font-bold text-white">Choose a new password</h1>
        {!token && <p className="text-sm text-red-300">This reset link is missing its token. Request a new one from the sign-in page.</p>}
        <div>
          <label className="label" htmlFor="new-pw">New password</label>
          <input id="new-pw" type="password" className="input" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" />
          <PasswordRules password={password} />
        </div>
        <div>
          <label className="label" htmlFor="confirm-pw">Confirm password</label>
          <input id="confirm-pw" type="password" className="input" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" />
        </div>
        {error && <p className="text-sm text-red-300" role="alert">{error}</p>}
        <button className="btn-primary w-full" disabled={busy || !token}>{busy && <Spinner className="h-4 w-4 text-white" />} Update password</button>
        <p className="text-center text-sm"><Link to="/forgot-password" className="link">Request a new link</Link></p>
      </form>
    </div>
  );
}
