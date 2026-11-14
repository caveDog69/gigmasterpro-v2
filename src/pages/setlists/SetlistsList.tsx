import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Clock, Globe, ListMusic, Plus, Search } from 'lucide-react';
import { api, errorMessage } from '../../lib/api';
import type { Setlist } from '../../lib/types';
import { formatTotal, relativeTime } from '../../lib/format';
import { EmptyState, ErrorBanner, PageHeader, PageLoader } from '../../components/ui';

export default function SetlistsList() {
  const [setlists, setSetlists] = useState<Setlist[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const load = () => {
    setError(null);
    api.get<Setlist[]>('/setlists').then(setSetlists).catch((e) => setError(errorMessage(e)));
  };
  useEffect(() => {
    document.title = 'Setlists · GigMasterPro';
    load();
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (setlists ?? []).filter((s) => !q || s.name.toLowerCase().includes(q) || s.description?.toLowerCase().includes(q));
  }, [setlists, search]);

  if (error) return <ErrorBanner message={error} onRetry={load} />;
  if (!setlists) return <PageLoader />;

  return (
    <div>
      <PageHeader
        title="Setlists"
        icon={<ListMusic className="h-5 w-5" />}
        subtitle={`${setlists.length} setlist${setlists.length === 1 ? '' : 's'}`}
        actions={<Link to="/setlists/new" className="btn-primary"><Plus className="h-4 w-4" /> New setlist</Link>}
      />
      {setlists.length === 0 ? (
        <EmptyState icon={<ListMusic className="h-7 w-7" />} title="No setlists yet" body="Group songs from your repertoire into ordered sets, then attach them to gigs." action={<Link to="/setlists/new" className="btn-primary"><Plus className="h-4 w-4" /> Create a setlist</Link>} />
      ) : (
        <>
          <div className="relative mb-4 max-w-md">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
            <input className="input pl-9" placeholder="Search setlists…" value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Search setlists" />
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((s) => (
              <Link key={s.id} to={`/setlists/${s.id}`} className="card group flex flex-col p-5 transition hover:border-purple-500/40">
                <div className="flex items-start justify-between gap-2">
                  <h2 className="font-semibold text-white group-hover:text-purple-200">{s.name}</h2>
                  {s.is_public && <Globe className="h-4 w-4 shrink-0 text-gray-500" aria-label="Public" />}
                </div>
                {s.description && <p className="mt-1 line-clamp-2 text-sm text-gray-400">{s.description}</p>}
                <div className="mt-auto flex items-center gap-4 pt-4 text-xs text-gray-400">
                  <span className="flex items-center gap-1"><ListMusic className="h-3.5 w-3.5" />{s.song_count ?? 0} songs</span>
                  <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" />{formatTotal(s.duration)}</span>
                  <span className="ml-auto">Updated {relativeTime(s.updated_at)}</span>
                </div>
              </Link>
            ))}
          </div>
          {filtered.length === 0 && <p className="py-10 text-center text-sm text-gray-500">No setlists match “{search}”.</p>}
        </>
      )}
    </div>
  );
}
