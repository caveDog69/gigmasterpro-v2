import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { CheckCircle2, XCircle } from 'lucide-react';
import { api, errorMessage } from '../../lib/api';
import { useAuth } from '../../contexts/AuthContext';
import Logo from '../../components/Logo';
import { Spinner } from '../../components/ui';

export default function VerifyEmail() {
  const [params] = useSearchParams();
  const { user, refresh } = useAuth();
  const [state, setState] = useState<'working' | 'done' | 'error'>('working');
  const [error, setError] = useState('');
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    api
      .post('/auth/verify-email', { token: params.get('token') || '' })
      .then(() => {
        setState('done');
        if (user) refresh().catch(() => undefined);
      })
      .catch((e) => {
        setError(errorMessage(e));
        setState('error');
      });
  }, [params, user, refresh]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-900 px-4">
      <Link to="/" className="mb-8"><Logo /></Link>
      <div className="card w-full max-w-md p-8 text-center">
        {state === 'working' && <><Spinner className="mx-auto h-8 w-8" /><p className="mt-4 text-gray-300">Verifying your email…</p></>}
        {state === 'done' && (
          <>
            <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-400" />
            <h1 className="mt-4 text-xl font-semibold text-white">Email verified</h1>
            <p className="mt-2 text-sm text-gray-400">Thanks! Your account is fully set up.</p>
            <Link to={user ? '/dashboard' : '/login'} className="btn-primary mt-6">{user ? 'Go to dashboard' : 'Sign in'}</Link>
          </>
        )}
        {state === 'error' && (
          <>
            <XCircle className="mx-auto h-12 w-12 text-red-400" />
            <h1 className="mt-4 text-xl font-semibold text-white">Verification failed</h1>
            <p className="mt-2 text-sm text-gray-400">{error}</p>
            <Link to={user ? '/dashboard' : '/login'} className="btn-secondary mt-6">Continue</Link>
          </>
        )}
      </div>
    </div>
  );
}
