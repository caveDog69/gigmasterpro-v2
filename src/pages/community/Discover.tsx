import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Check, Clock, Globe, MapPin, MessageSquare, Search, UserPlus } from 'lucide-react';
import { api, errorMessage } from '../../lib/api';
import type { CommunityProfile } from '../../lib/types';
import { COMMITMENT_LEVELS, EXPERIENCE_LEVELS, GENRES, INSTRUMENTS } from '../../lib/constants';
import { useToast } from '../../contexts/ToastContext';
import { useNotifications } from '../../contexts/NotificationsContext';
import { Avatar, EmptyState, ErrorBanner, Modal, PageLoader, Spinner } from '../../components/ui';

const label = (list: readonly { value: string; label: string }[], v: string | null) => list.find((x) => x.value === v)?.label ?? v;

export default function Discover() {
  const toast = useToast();
  const navigate = useNavigate();
  const { refresh } = useNotifications();
  const [search, setSearch] = useState('');
  const [instrument, setInstrument] = useState('');
  const [genre, setGenre] = useState('');
  const [commitment, setCommitment] = useState('');
  const [data, setData] = useState<{ profiles: CommunityProfile[]; location_known: boolean } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [requestTo, setRequestTo] = useState<CommunityProfile | null>(null);
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [viewing, setViewing] = useState<CommunityProfile | null>(null);

  useEffect(() => {
    const t = setTimeout(() => {
      const qs = new URLSearchParams();
      if (search.trim()) qs.set('search', search.trim());
      if (instrument) qs.set('instrument', instrument);
      if (genre) qs.set('genre', genre);
      if (commitment) qs.set('commitment', commitment);
      setError(null);
      api.get<{ profiles: CommunityProfile[]; location_known: boolean }>(`/community/profiles?${qs}`).then(setData).catch((e) => setError(errorMessage(e)));
    }, 300);
    return () => clearTimeout(t);
  }, [search, instrument, genre, commitment]);

  const sendRequest = async () => {
    if (!requestTo) return;
    setSending(true);
    try {
      const c = await api.post<{ id: number; status: string }>('/connections', { recipient_id: requestTo.id, message });
      setData((d) => d && { ...d, profiles: d.profiles.map((p) => (p.id === requestTo.id ? { ...p, connection_id: c.id, connection_status: c.status === 'accepted' ? 'connected' : 'pending_sent' } : p)) });
      toast.success(c.status === 'accepted' ? `You're now connected with ${requestTo.display_name}.` : `Request sent to ${requestTo.display_name}.`);
      setRequestTo(null);
      setMessage('');
      refresh();
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setSending(false);
    }
  };

  const action = (p: CommunityProfile) => {
    switch (p.connection_status) {
      case 'connected':
        return <button className="btn-primary btn-sm" onClick={() => navigate(`/community?tab=messages&with=${p.id}`)}><MessageSquare className="h-3.5 w-3.5" /> Message{p.unread_count ? ` (${p.unread_count})` : ''}</button>;
      case 'pending_sent':
        return <span className="chip bg-gray-800 text-gray-300 ring-gray-700"><Clock className="h-3 w-3" /> Requested</span>;
      case 'pending_received':
        return <Link to="/community?tab=requests" className="btn-secondary btn-sm"><Check className="h-3.5 w-3.5" /> Respond</Link>;
      default:
        return <button className="btn-secondary btn-sm" onClick={() => setRequestTo(p)}><UserPlus className="h-3.5 w-3.5" /> Connect</button>;
    }
  };

  return (
    <div>
      <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="relative sm:col-span-2 lg:col-span-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
          <input className="input pl-9" placeholder="Name, city, bio…" value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Search musicians" />
        </div>
        <select className="input" value={instrument} onChange={(e) => setInstrument(e.target.value)} aria-label="Instrument"><option value="">Any instrument</option>{INSTRUMENTS.map((i) => <option key={i}>{i}</option>)}</select>
        <select className="input" value={genre} onChange={(e) => setGenre(e.target.value)} aria-label="Genre"><option value="">Any genre</option>{GENRES.map((g) => <option key={g}>{g}</option>)}</select>
        <select className="input" value={commitment} onChange={(e) => setCommitment(e.target.value)} aria-label="Commitment"><option value="">Any commitment</option>{COMMITMENT_LEVELS.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}</select>
      </div>
      {data && !data.location_known && (
        <p className="mb-4 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-2 text-sm text-amber-200">
          <Link to="/profile" className="underline">Add your ZIP code</Link> to sort musicians by distance.
        </p>
      )}
      {error ? <ErrorBanner message={error} /> : !data ? <PageLoader /> : data.profiles.length === 0 ? (
        <EmptyState icon={<Search className="h-7 w-7" />} title="No musicians found" body="Try clearing some filters. Only members with a public profile appear here." />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {data.profiles.map((p) => (
            <article key={p.id} className="card flex flex-col p-5">
              <button className="flex items-start gap-3 text-left" onClick={() => setViewing(p)}>
                <Avatar name={p.display_name} url={p.avatar_url} size="lg" />
                <div className="min-w-0 flex-1">
                  <h3 className="truncate font-semibold text-white">{p.display_name}</h3>
                  <p className="truncate text-xs text-gray-500">@{p.username}</p>
                  {(p.city || p.state || p.distance_miles !== null) && (
                    <p className="mt-1 flex items-center gap-1 text-xs text-gray-400"><MapPin className="h-3 w-3" />{[p.city, p.state].filter(Boolean).join(', ')}{p.distance_miles !== null && <span className="text-purple-300"> · {p.distance_miles < 1 ? '<1' : Math.round(p.distance_miles)} mi</span>}</p>
                  )}
                </div>
              </button>
              {p.bio && <p className="mt-3 line-clamp-2 text-sm text-gray-400">{p.bio}</p>}
              <div className="mt-3 flex flex-wrap gap-1.5">
                {(p.instruments.length ? p.instruments : p.instrument ? [p.instrument] : []).slice(0, 4).map((i) => <span key={i} className="chip bg-purple-500/10 text-purple-200 ring-purple-500/30">{i}</span>)}
                {p.genre && <span className="chip bg-gray-800 text-gray-300 ring-gray-700">{p.genre}</span>}
                {p.commitment_level && <span className="chip bg-gray-800 text-gray-300 ring-gray-700">{label(COMMITMENT_LEVELS, p.commitment_level)}</span>}
              </div>
              <div className="mt-auto flex justify-end pt-4">{action(p)}</div>
            </article>
          ))}
        </div>
      )}

      <Modal open={!!requestTo} onClose={() => setRequestTo(null)} title={`Connect with ${requestTo?.display_name ?? ''}`}>
        <label htmlFor="req-msg" className="label">Add a note (optional)</label>
        <textarea id="req-msg" className="input min-h-[100px]" maxLength={1000} value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Hi! I'm looking for a bassist for weekend gigs…" />
        <div className="mt-4 flex justify-end gap-2">
          <button className="btn-secondary" onClick={() => setRequestTo(null)}>Cancel</button>
          <button className="btn-primary" onClick={sendRequest} disabled={sending}>{sending && <Spinner className="h-4 w-4 text-white" />} Send request</button>
        </div>
      </Modal>

      <Modal open={!!viewing} onClose={() => setViewing(null)} title={viewing?.display_name ?? ''}>
        {viewing && (
          <div className="space-y-4 text-sm">
            <div className="flex items-center gap-4">
              <Avatar name={viewing.display_name} url={viewing.avatar_url} size="xl" />
              <div>
                <p className="text-gray-400">@{viewing.username}</p>
                <p className="text-gray-300">{[viewing.city, viewing.state].filter(Boolean).join(', ')}</p>
                {viewing.website && <a href={viewing.website} target="_blank" rel="noopener noreferrer nofollow" className="link inline-flex items-center gap-1"><Globe className="h-3.5 w-3.5" />Website</a>}
              </div>
            </div>
            {viewing.bio && <p className="whitespace-pre-wrap text-gray-300">{viewing.bio}</p>}
            <dl className="grid grid-cols-2 gap-3">
              <div><dt className="label">Instruments</dt><dd className="text-gray-200">{(viewing.instruments.length ? viewing.instruments : [viewing.instrument]).filter(Boolean).join(', ') || '—'}</dd></div>
              <div><dt className="label">Genre</dt><dd className="text-gray-200">{viewing.genre || '—'}</dd></div>
              <div><dt className="label">Experience</dt><dd className="text-gray-200">{label(EXPERIENCE_LEVELS, viewing.experience_level) || '—'}</dd></div>
              <div><dt className="label">Commitment</dt><dd className="text-gray-200">{label(COMMITMENT_LEVELS, viewing.commitment_level) || '—'}</dd></div>
              {viewing.equipment && <div className="col-span-2"><dt className="label">Equipment</dt><dd className="whitespace-pre-wrap text-gray-200">{viewing.equipment}</dd></div>}
              {viewing.phone && <div><dt className="label">Phone</dt><dd className="text-gray-200">{viewing.phone}</dd></div>}
            </dl>
            <div className="flex justify-end">{action(viewing)}</div>
          </div>
        )}
      </Modal>
    </div>
  );
}
