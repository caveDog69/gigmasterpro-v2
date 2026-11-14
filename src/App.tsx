import { lazy, Suspense, type ReactNode } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext';
import AppLayout from './components/Layout/AppLayout';
import { PageLoader } from './components/ui';
import Landing from './pages/Landing';
import AuthPage from './pages/auth/AuthPage';

const ResetPassword = lazy(() => import('./pages/auth/ResetPassword'));
const VerifyEmail = lazy(() => import('./pages/auth/VerifyEmail'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const SongsList = lazy(() => import('./pages/songs/SongsList'));
const SongForm = lazy(() => import('./pages/songs/SongForm'));
const SongImport = lazy(() => import('./pages/songs/SongImport'));
const SetlistsList = lazy(() => import('./pages/setlists/SetlistsList'));
const SetlistForm = lazy(() => import('./pages/setlists/SetlistForm'));
const SetlistDetail = lazy(() => import('./pages/setlists/SetlistDetail'));
const GigsList = lazy(() => import('./pages/gigs/GigsList'));
const GigForm = lazy(() => import('./pages/gigs/GigForm'));
const GigDetail = lazy(() => import('./pages/gigs/GigDetail'));
const PlayMode = lazy(() => import('./pages/gigs/PlayMode'));
const Community = lazy(() => import('./pages/community/Community'));
const Profile = lazy(() => import('./pages/profile/Profile'));
const BandsList = lazy(() => import('./pages/bands/BandsList'));
const BandDetail = lazy(() => import('./pages/bands/BandDetail'));
const NotFound = lazy(() => import('./pages/NotFound'));

function RequireAuth({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <div className="min-h-screen bg-gray-900"><PageLoader label="Restoring your session…" /></div>;
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  return <>{children}</>;
}

function PublicOnly({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from;
  if (!loading && user) return <Navigate to={from || '/dashboard'} replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-gray-900"><PageLoader /></div>}>
      <Routes>
        <Route path="/" element={<PublicOnly><Landing /></PublicOnly>} />
        <Route path="/login" element={<PublicOnly><AuthPage mode="login" /></PublicOnly>} />
        <Route path="/signup" element={<PublicOnly><AuthPage mode="signup" /></PublicOnly>} />
        <Route path="/forgot-password" element={<PublicOnly><AuthPage mode="forgot" /></PublicOnly>} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/verify-email" element={<VerifyEmail />} />
        <Route path="/gigs/:id/play" element={<RequireAuth><PlayMode /></RequireAuth>} />
        <Route element={<RequireAuth><AppLayout /></RequireAuth>}>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/songs" element={<SongsList />} />
          <Route path="/songs/new" element={<SongForm />} />
          <Route path="/songs/edit/:id" element={<SongForm />} />
          <Route path="/songs/import" element={<SongImport />} />
          <Route path="/setlists" element={<SetlistsList />} />
          <Route path="/setlists/new" element={<SetlistForm />} />
          <Route path="/setlists/edit/:id" element={<SetlistForm />} />
          <Route path="/setlists/:id" element={<SetlistDetail />} />
          <Route path="/gigs" element={<GigsList />} />
          <Route path="/gigs/new" element={<GigForm />} />
          <Route path="/gigs/edit/:id" element={<GigForm />} />
          <Route path="/gigs/:id" element={<GigDetail />} />
          <Route path="/community" element={<Community />} />
          <Route path="/bands" element={<BandsList />} />
          <Route path="/bands/:id" element={<BandDetail />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
    </Suspense>
  );
}
