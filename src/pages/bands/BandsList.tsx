import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { CalendarDays, Check, Music, Plus, Users, X } from 'lucide-react';
import { api, errorMessage } from '../../lib/api';
import type { Band, BandInvitation } from '../../lib/types';
import { relativeTime } from '../../lib/format';
import { useToast } from '../../contexts/ToastContext';
import { useNotifications } from '../../contexts/NotificationsContext';
import { EmptyState, ErrorBanner, Field, Modal, PageHeader, PageLoader, Spinner } from '../../components/ui';

const ROLE_STYLE: Record<string, string> = {
  owner: 'bg-purple-500/15 text-purple-200 ring-purple-500/30',
  admin: 'bg-sky-500/15 text-sky-200 ring-sky-500/30',
  member: 'bg-gray-800 text-gray-300 ring-gray-700',
};
export { ROLE_STYLE };

export default function BandsList() {
  const toast = useToast();
  const navigate = useNavigate();
  const { refresh } = useNotifications();
  const [data, setData] = useState<{ bands: Band[]; invitations: BandInvitation[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);

  const load = () => api.get<{ bands: Band[]; invitations: BandInvitation[] }>('/bands').then(setData).catch((e) => setError(errorMessage(e)));
  useEffect(() => { document.title = 'Bands · GigMasterPro'; load(); }, []);

  const create = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    try {
      const b = await api.post<Band>('/bands', { name, description });
      toast.success(`Created ${b.name}.`);
      navigate(`/bands/${b.id}`);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const respond = async (inv: BandInvitation, status: 'accepted' | 'declined') => {
    try {
      await api.put(`/band-invitations/${inv.id}`, { status });
      toast.success(status === 'accepted' ? `You joined ${inv.band?.name}.` : 'Invitation declined.');
      refresh();
      if (status === 'accepted') navigate(`/bands/${inv.band_id}`);
      else load();
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };

  if (error) return <ErrorBanner message={error} />;
  if (!data) return <PageLoader />;

  return (
    <div>
      <PageHeader title="Bands" icon={<Users className="h-5 w-5" />} subtitle="Share songs, setlists and gigs with your bandmates." actions={<button className="btn-primary" onClick={() => setCreating(true)}><Plus className="h-4 w-4" /> New band</button>} />
      {data.invitations.length > 0 && (
        <section className="card mb-6 border-purple-500/30">
          <h2 className="border-b border-gray-800 px-5 py-3 font-semibold text-white">Invitations</h2>
          <ul className="divide-y divide-gray-800">
            {data.invitations.map((inv) => (
              <li key={inv.id} className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center">
                <div className="flex-1">
                  <p className="font-medium text-white">{inv.band?.name}</p>
                  <p className="text-xs text-gray-400">Invited by {inv.inviter?.display_name} · {relativeTime(inv.created_at)}</p>
                </div>
                <div className="flex gap-2">
                  <button className="btn-primary btn-sm" onClick={() => respond(inv, 'accepted')}><Check className="h-3.5 w-3.5" /> Join</button>
                  <button className="btn-secondary btn-sm" onClick={() => respond(inv, 'declined')}><X className="h-3.5 w-3.5" /> Decline</button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}
      {data.bands.length === 0 ? (
        <EmptyState icon={<Users className="h-7 w-7" />} title="You're not in a band yet" body="Create a band and invite members to share your repertoire, setlists and gig calendar." action={<button className="btn-primary" onClick={() => setCreating(true)}><Plus className="h-4 w-4" /> Create a band</button>} />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {data.bands.map((b) => (
            <Link key={b.id} to={`/bands/${b.id}`} className="card flex flex-col p-5 transition hover:border-purple-500/40">
              <div className="flex items-start justify-between gap-2">
                <h2 className="font-semibold text-white">{b.name}</h2>
                <span className={`chip capitalize ${ROLE_STYLE[b.my_role]}`}>{b.my_role}</span>
              </div>
              {b.description && <p className="mt-1 line-clamp-2 text-sm text-gray-400">{b.description}</p>}
              <div className="mt-auto flex gap-4 pt-4 text-xs text-gray-400">
                <span className="flex items-center gap-1"><Users className="h-3.5 w-3.5" />{b.member_count ?? 1}</span>
                <span className="flex items-center gap-1"><Music className="h-3.5 w-3.5" />{b.song_count ?? 0} songs</span>
                <span className="flex items-center gap-1"><CalendarDays className="h-3.5 w-3.5" />{b.upcoming_gig_count ?? 0} upcoming</span>
              </div>
            </Link>
          ))}
        </div>
      )}
      <Modal open={creating} onClose={() => setCreating(false)} title="Create a band">
        <form onSubmit={create} className="space-y-4">
          <Field label="Band name *" htmlFor="b-name"><input id="b-name" className="input" value={name} onChange={(e) => setName(e.target.value)} maxLength={191} autoFocus /></Field>
          <Field label="Description" htmlFor="b-desc"><textarea id="b-desc" className="input min-h-[80px]" value={description} onChange={(e) => setDescription(e.target.value)} /></Field>
          <div className="flex justify-end gap-2">
            <button type="button" className="btn-secondary" onClick={() => setCreating(false)}>Cancel</button>
            <button className="btn-primary" disabled={saving || !name.trim()}>{saving && <Spinner className="h-4 w-4 text-white" />} Create band</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
