import { useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Calendar, Guitar, Home, ListMusic, LogOut, Menu, Music, Plus, Upload, User, Users, X, MailWarning } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useNotifications } from '../../contexts/NotificationsContext';
import { useToast } from '../../contexts/ToastContext';
import { api, errorMessage } from '../../lib/api';
import { cx } from '../../lib/format';
import Logo from '../Logo';
import { Avatar } from '../ui';
import NotificationBell from './NotificationBell';

export default function AppLayout() {
  const { profile, user, signOut } = useAuth();
  const { summary } = useNotifications();
  const toast = useToast();
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => setMobileOpen(false), [location.pathname]);

  const communityBadge = summary.unread_messages + summary.pending_connections;
  const nav = [
    { to: '/dashboard', label: 'Dashboard', icon: Home },
    { to: '/songs', label: 'Songs', icon: Music },
    { to: '/setlists', label: 'Setlists', icon: ListMusic },
    { to: '/gigs', label: 'Gigs', icon: Calendar },
    { to: '/bands', label: 'Bands', icon: Guitar, badge: summary.pending_band_invitations },
    { to: '/community', label: 'Community', icon: Users, badge: communityBadge },
  ];
  const quick = [
    { to: '/songs/new', label: 'Add Song', icon: Plus },
    { to: '/songs/import', label: 'Import Songs', icon: Upload },
    { to: '/setlists/new', label: 'Create Setlist', icon: Plus },
    { to: '/gigs/new', label: 'Schedule Gig', icon: Plus },
  ];

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  const resend = async () => {
    try {
      await api.post('/auth/resend-verification');
      toast.success('Verification email sent. Check your inbox.');
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };

  const sidebar = (
    <div className="flex h-full flex-col">
      <div className="flex h-16 items-center px-5">
        <Link to="/dashboard" aria-label="GigMasterPro dashboard"><Logo /></Link>
      </div>
      <nav className="flex-1 space-y-6 overflow-y-auto px-3 py-4" aria-label="Main">
        <div className="space-y-1">
          {nav.map(({ to, label, icon: Icon, badge }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                cx('flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition', isActive ? 'bg-purple-500/15 text-purple-200' : 'text-gray-400 hover:bg-gray-800 hover:text-white')
              }
            >
              <Icon className="h-5 w-5" />
              <span className="flex-1">{label}</span>
              {!!badge && <span className="rounded-full bg-purple-500 px-2 py-0.5 text-[11px] font-semibold text-white">{badge}</span>}
            </NavLink>
          ))}
        </div>
        <div>
          <h2 className="mb-2 px-3 text-xs font-semibold uppercase tracking-wider text-gray-500">Quick actions</h2>
          <div className="space-y-1">
            {quick.map(({ to, label, icon: Icon }) => (
              <Link key={to} to={to} className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-gray-400 transition hover:bg-gray-800 hover:text-white">
                <Icon className="h-4 w-4" /> {label}
              </Link>
            ))}
          </div>
        </div>
      </nav>
      <div className="border-t border-gray-800 p-3">
        <Link to="/profile" className="flex items-center gap-3 rounded-lg p-2 transition hover:bg-gray-800">
          <Avatar name={profile?.display_name} url={profile?.avatar_url} size="sm" />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-medium text-white">{profile?.display_name}</span>
            <span className="block truncate text-xs text-gray-500">@{profile?.username}</span>
          </span>
          <User className="h-4 w-4 text-gray-500" />
        </Link>
        <button onClick={handleSignOut} className="mt-1 flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-gray-400 transition hover:bg-gray-800 hover:text-white">
          <LogOut className="h-4 w-4" /> Sign out
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-900">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 border-r border-gray-800 bg-gray-950/60 lg:block">{sidebar}</aside>
      {mobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-black/60" onClick={() => setMobileOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-72 animate-slide-in border-r border-gray-800 bg-gray-950">
            <button className="btn-icon absolute right-3 top-3" onClick={() => setMobileOpen(false)} aria-label="Close menu">
              <X className="h-5 w-5" />
            </button>
            {sidebar}
          </aside>
        </div>
      )}
      <div className="lg:pl-64">
        <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-gray-800 bg-gray-900/85 px-4 backdrop-blur sm:px-6">
          <button className="btn-icon lg:hidden" onClick={() => setMobileOpen(true)} aria-label="Open menu">
            <Menu className="h-5 w-5" />
          </button>
          <Link to="/dashboard" className="lg:hidden"><Logo compact /></Link>
          <p className="hidden text-sm text-gray-400 sm:block">
            Welcome back, <span className="font-medium text-white">{profile?.display_name}</span>
          </p>
          <div className="ml-auto flex items-center gap-1">
            <NotificationBell />
            <Link to="/profile" className="ml-1" aria-label="Your profile">
              <Avatar name={profile?.display_name} url={profile?.avatar_url} size="sm" />
            </Link>
          </div>
        </header>
        {user && !user.email_verified && (
          <div className="flex flex-wrap items-center gap-2 border-b border-amber-500/20 bg-amber-500/10 px-4 py-2 text-sm text-amber-200 sm:px-6">
            <MailWarning className="h-4 w-4" />
            <span>Please verify your email address ({user.email}).</span>
            <button className="font-medium underline hover:text-amber-100" onClick={resend}>Resend link</button>
          </div>
        )}
        <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
