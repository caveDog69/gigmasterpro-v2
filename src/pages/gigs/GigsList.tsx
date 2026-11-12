import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { CalendarDays, CalendarPlus, Clock, DollarSign, MapPin, Plus, Search } from 'lucide-react';
import { api, downloadFile, errorMessage } from '../../lib/api';
import type { Gig, GigStatus } from '../../lib/types';
import { GIG_STATUSES } from '../../lib/constants';
import { formatDate, formatMoney, formatTime, cx } from '../../lib/format';
import { useToast } from '../../contexts/ToastContext';
import { EmptyState, ErrorBanner, PageHeader, PageLoader, StatusBadge } from '../../components/ui';

export default function GigsList() {
  const toast = useToast();
  const [params, setParams] = useSearchParams();
  const status = (params.get('status') || '') as GigStatus | '';
  const [when, setWhen] = useState<'upcoming' | 'past' | 'all'>(status === 'completed' ? 'all' : 'upcoming');
  const [gigs, setGigs] = useState<Gig[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const load = () => {
    setError(null);
    api.get<Gig[]>('/gigs').then(setGigs).catch((e) => setError(errorMessage(e)));
  };
  useEffect(() => {
    document.title = 'Gigs · GigMasterPro';
    load();
  }, []);

  const filtered = useMemo(() => {
    const now = Date.now() - 12 * 3600 * 1000;
    const q = search.trim().toLowerCase();
    const list = (gigs ?? []).filter((g) => {
      const t = new Date(g.date_time).getTime();
      if (when === 'upcoming' && t < now) return false;
      if (when === 'past' && t >= now) return false;
      if (status && g.status !== status) return false;
      return !q || [g.name, g.venue, g.location].some((v) => v?.toLowerCase().includes(q));
    });
    return list.sort((a, b) => (when === 'upcoming' ? a.date_time.localeCompare(b.date_time) : b.date_time.localeCompare(a.date_time)));
  }, [gigs, when, status, search]);

  if (error) return <ErrorBanner message={error} onRetry={load} />;
  if (!gigs) return <PageLoader />;

  return (
    <div>
      <PageHeader
        title="Gigs"
        icon={<CalendarDays className="h-5 w-5" />}
        subtitle={`${gigs.length} gig${gigs.length === 1 ? '' : 's'}`}
        actions={
          <>
            <button className="btn-ghost" onClick={() => downloadFile('/gigs/calendar.ics', 'gigs.ics').catch((e) => toast.error(errorMessage(e)))} disabled={!gigs.length}><CalendarPlus className="h-4 w-4" /> iCal</button>
            <Link to="/gigs/new" className="btn-primary"><Plus className="h-4 w-4" /> Schedule gig</Link>
          </>
        }
      />
      {gigs.length === 0 ? (
        <EmptyState icon={<CalendarDays className="h-7 w-7" />} title="No gigs scheduled" body="Add your next show with venue, load-in, pay and setlists." action={<Link to="/gigs/new" className="btn-primary"><Plus className="h-4 w-4" /> Schedule a gig</Link>} />
      ) : (
        <>
          <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center">
            <div className="flex rounded-lg bg-gray-800/70 p-1 text-sm">
              {(['upcoming', 'past', 'all'] as const).map((w) => (
                <button key={w} onClick={() => setWhen(w)} className={cx('rounded-md px-3 py-1.5 font-medium capitalize', when === w ? 'bg-purple-600 text-white' : 'text-gray-400 hover:text-white')}>{w}</button>
              ))}
            </div>
            <div className="flex flex-wrap gap-2">
              {(['', ...GIG_STATUSES] as const).map((s) => (
                <button key={s || 'any'} onClick={() => setParams(s ? { status: s } : {})} className={cx('rounded-full px-3 py-1 text-xs capitalize transition', status === s ? 'bg-purple-600 text-white' : 'bg-gray-800 text-gray-300 hover:bg-gray-700')}>{s || 'Any status'}</button>
              ))}
            </div>
            <div className="relative lg:ml-auto lg:w-64">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
              <input className="input pl-9" placeholder="Search gigs…" value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Search gigs" />
            </div>
          </div>
          <ul className="space-y-3">
            {filtered.map((g) => {
              const d = new Date(g.date_time);
              return (
                <li key={g.id}>
                  <Link to={`/gigs/${g.id}`} className="card flex items-center gap-4 p-4 transition hover:border-purple-500/40">
                    <div className="flex h-16 w-16 shrink-0 flex-col items-center justify-center rounded-xl bg-purple-500/15 text-purple-200">
                      <span className="text-[11px] uppercase">{d.toLocaleDateString(undefined, { month: 'short' })}</span>
                      <span className="text-2xl font-bold leading-none">{d.getDate()}</span>
                      <span className="text-[10px] text-purple-300/70">{d.getFullYear()}</span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold text-white">{g.name}</p>
                      <p className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-400">
                        <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" />{formatDate(g.date_time)} · {formatTime(g.date_time)}</span>
                        {(g.venue || g.location) && <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{[g.venue, g.location].filter(Boolean).join(', ')}</span>}
                        {g.payment !== null && <span className="flex items-center gap-1"><DollarSign className="h-3.5 w-3.5" />{formatMoney(g.payment)}</span>}
                      </p>
                    </div>
                    <StatusBadge status={g.status} />
                  </Link>
                </li>
              );
            })}
          </ul>
          {filtered.length === 0 && <p className="py-10 text-center text-sm text-gray-500">No gigs match these filters.</p>}
        </>
      )}
    </div>
  );
}
