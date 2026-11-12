import { useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Logo from '../../components/Logo';
import AuthPanel, { type AuthMode } from './AuthPanel';

export default function AuthPage({ mode }: { mode: AuthMode }) {
  const navigate = useNavigate();
  useEffect(() => {
    document.title = { login: 'Sign in', signup: 'Sign up', forgot: 'Reset password' }[mode] + ' · GigMasterPro';
  }, [mode]);
  const paths: Record<AuthMode, string> = { login: '/login', signup: '/signup', forgot: '/forgot-password' };
  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-gray-900 px-4 py-10">
      <div className="pointer-events-none absolute -top-40 left-1/2 h-96 w-[48rem] -translate-x-1/2 rounded-full bg-purple-700/20 blur-3xl" />
      <Link to="/" className="relative mb-8"><Logo /></Link>
      <div className="relative w-full max-w-md">
        <AuthPanel key={mode} initialMode={mode} onModeChange={(m) => navigate(paths[m], { replace: true })} />
      </div>
    </div>
  );
}
