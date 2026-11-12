import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { CalendarDays, ChevronRight, Clock, DollarSign, ListMusic, MapPin, Music, Plus, Upload, Users } from 'lucide-react';
import { api, errorMessage } from '../lib/api';
import type { Gig, Setlist, Song } from '../lib/types';
import { useAuth } from '../contexts/AuthContext';
import { useNotifications } from '../contexts/NotificationsContext';
import { formatDate, formatMoney, formatTime } from '../lib/format';
import { ErrorBanner, PageLoader, StatusBadge } from '../components/ui';

interface DashData { songs: Song[]; setlists: Setlist[]; gigs: Gig[]; upcoming: Gig[] }

export default function Dashboard() {
  const { profile } = useAuth();
  const { summary } = useNotifications();
  const [data, setData] = useState<DashData | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    setError(null);
    Promise.all([api.get<Song[]>('/songs'), api.get<Setlist[]>('/setlists'), api.get<Gig[]>('/gigs'), api.get<Gig[]>('/gigs?upcoming=1&limit=5')])
      .then(([songs, setlists, gigs, upcoming]) => setData({ songs, setlists, gigs, upcoming }))
      .catch((e) => setError(errorMessage(e)));
  };
  useEffect(() => {
    document.title = 'Dashboard · GigMasterPro';
    load();
  }, []);

  if (error) return <ErrorBanner message={error} onRetry={load} />;
  if (!data) return <PageLoader />;

  const year = new Date().getFullYear();
  const earnings = data.gigs.filter((g) => g.status === 'completed' && new Date(g.date_time).getFullYear() === year).reduce((s, g) => s + (Number(g.payment) || 0), 0);
  const stats = [
    { label: 'Songs', value: data.songs.length, icon: Music, to: '/songs' },
    { label: 'Setlists', value: data.setlists.length, icon: ListMusic, to: '/setlists' },
    { label: 'Upcoming gigs', value: data.upcoming.length, icon: CalendarDays, to: '/gigs' },
    { label: `${year} earnings`, value: formatMoney(earnings), icon: DollarSign, to: '/gigs?status=completed' },
  ];
  const recentSongs = [...data.songs].sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 5);
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white sm:text-3xl">{greeting}, {profile?.display_name?.split(' ')[0]}</h1>
          <p className="mt-1 text-sm text-gray-400">Here's what's happening with your music.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link to="/songs/new" className="btn-secondary"><Plus className="h-4 w-4" /> Song</Link>
          <Link to="/setlists/new" className="btn-secondary"><Plus className="h-4 w-4" /> Setlist</Link>
          <Link to="/gigs/new" className="btn-primary"><Plus className="h-4 w-4" /> Schedule gig</Link>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {stats.map(({ label, value, icon: Icon, to }) => (
          <Link key={label} to={to} className="card group p-5 transition hover:border-purple-500/40">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-400">{label}</span>
              <Icon className="h-5 w-5 text-purple-400" />
            </div>
            <p className="mt-3 text-2xl font-bold text-white sm:text-3xl">{value}</p>
          </Link>
        ))}
      </div>

      {(summary.pending_connections > 0 || summary.unread_messages > 0 || summary.pending_band_invitations > 0) && (
        <div className="card flex flex-wrap items-center gap-4 border-purple-500/30 bg-purple-500/5 p-4 text-sm">
          <Users className="h-5 w-5 text-purple-300" />
          {summary.pending_connections > 0 && <Link to="/community?tab=requests" className="link">{summary.pending_connections} connection request{summary.pending_connections > 1 ? 's' : ''}</Link>}
          {summary.unread_messages > 0 && <Link to="/community?tab=messages" className="link">{summary.unread_messages} unread message{summary.unread_messages > 1 ? 's' : ''}</Link>}
          {summary.pending_band_invitations > 0 && <Link to="/bands" className="link">{summary.pending_band_invitations} band invitation{summary.pending_band_invitations > 1 ? 's' : ''}</Link>}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <section className="card lg:col-span-2" aria-labelledby="upcoming-heading">
          <div className="flex items-center justify-between border-b border-gray-800 px-5 py-4">
            <h2 id="upcoming-heading" className="font-semibold text-white">Upcoming gigs</h2>
            <Link to="/gigs" className="text-sm text-purple-300 hover:text-purple-200">View all</Link>
          </div>
          {data.upcoming.length === 0 ? (
            <div className="px-5 py-10 text-center text-sm text-gray-400">
              No upcoming gigs. <Link to="/gigs/new" className="link">Schedule one</Link>
            </div>
          ) : (
            <ul className="divide-y divide-gray-800">
              {data.upcoming.map((g) => {
                const d = new Date(g.date_time);
                return (
                  <li key={g.id}>
                    <Link to={`/gigs/${g.id}`} className="flex items-center gap-4 px-5 py-4 transition hover:bg-gray-800/50">
                      <div className="flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-xl bg-purple-500/15 text-purple-200">
                        <span className="text-[11px] uppercase">{d.toLocaleDateString(undefined, { month: 'short' })}</span>
                        <span className="text-xl font-bold leading-none">{d.getDate()}</span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium text-white">{g.name}</p>
                        <p className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-400">
                          <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" />{formatDate(g.date_time, { year: undefined })} · {formatTime(g.date_time)}</span>
                          {g.venue && <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{g.venue}</span>}
                        </p>
                      </div>
                      <StatusBadge status={g.status} />
                      <ChevronRight className="hidden h-4 w-4 text-gray-600 sm:block" />
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section className="card" aria-labelledby="recent-heading">
          <div className="flex items-center justify-between border-b border-gray-800 px-5 py-4">
            <h2 id="recent-heading" className="font-semibold text-white">Recently added songs</h2>
            <Link to="/songs" className="text-sm text-purple-300 hover:text-purple-200">All songs</Link>
          </div>
          {recentSongs.length === 0 ? (
            <div className="space-y-3 px-5 py-8 text-center text-sm text-gray-400">
              <p>Your repertoire is empty.</p>
              <div className="flex justify-center gap-2">
                <Link to="/songs/new" className="btn-secondary btn-sm"><Plus className="h-3.5 w-3.5" /> Add song</Link>
                <Link to="/songs/import" className="btn-secondary btn-sm"><Upload className="h-3.5 w-3.5" /> Import</Link>
              </div>
            </div>
          ) : (
            <ul className="divide-y divide-gray-800">
              {recentSongs.map((s) => (
                <li key={s.id}>
                  <Link to={`/songs/edit/${s.id}`} className="flex items-center gap-3 px-5 py-3 transition hover:bg-gray-800/50">
                    <Music className="h-4 w-4 text-gray-500" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm text-gray-100">{s.title}</span>
                      <span className="block truncate text-xs text-gray-500">{s.artist || (s.is_original ? 'Original' : '—')}</span>
                    </span>
                    {s.key && <span className="rounded bg-gray-800 px-1.5 text-xs text-gray-300">{s.key}</span>}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
