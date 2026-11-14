import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, CalendarDays, ListMusic, LogOut, Music, Pencil, Plus, Search, Trash2, UserPlus, Users, X } from 'lucide-react';
import { api, errorMessage } from '../../lib/api';
import type { BandDetail as BandDetailT, BandMember, BandRole, BandShare, Gig, ProfileBrief, Setlist, Song } from '../../lib/types';
import { formatDate, formatDuration, formatTime, formatTotal, relativeTime, cx } from '../../lib/format';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { Avatar, ConfirmDialog, ErrorBanner, Field, Modal, PageLoader, StatusBadge, Toggle } from '../../components/ui';
import { ROLE_STYLE } from './BandsList';

type ShareType = 'songs' | 'setlists' | 'gigs';
interface Pickable { id: number; label: string; sub: string }

export default function BandDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [band, setBand] = useState<BandDetailT | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<ShareType | 'members'>('songs');
  const [inviteOpen, setInviteOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [found, setFound] = useState<ProfileBrief[]>([]);
  const [shareOpen, setShareOpen] = useState(false);
  const [pickables, setPickables] = useState<Pickable[] | null>(null);
  const [picked, setPicked] = useState<number[]>([]);
  const [editOpen, setEditOpen] = useState(false);
  const [edit, setEdit] = useState({ name: '', description: '' });
  const [confirm, setConfirm] = useState<null | { title: string; body: string; label: string; run: () => Promise<unknown> }>(null);

  const load = () => api.get<BandDetailT>(`/bands/${id}`).then((b) => { setBand(b); document.title = `${b.name} · GigMasterPro`; }).catch((e) => setError(errorMessage(e)));
  useEffect(() => { load(); }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (query.trim().length < 2) { setFound([]); return; }
    const t = setTimeout(() => api.get<ProfileBrief[]>(`/users/search?q=${encodeURIComponent(query.trim())}`).then(setFound).catch(() => setFound([])), 300);
    return () => clearTimeout(t);
  }, [query]);

  const isAdmin = band?.my_role === 'owner' || band?.my_role === 'admin';
  const canShare = isAdmin || !!band?.my_can_edit;
  const memberIds = useMemo(() => new Set([...(band?.members ?? []).map((m) => m.user_id), ...(band?.invitations ?? []).map((i) => i.invitee_id)]), [band]);

  const run = async (fn: () => Promise<unknown>, ok?: string) => {
    try {
      await fn();
      if (ok) toast.success(ok);
      await load();
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };

  const openShare = async () => {
    if (tab === 'members' || !band) return;
    setPicked([]);
    setPickables(null);
    setShareOpen(true);
    const already = new Set(band[tab].map((s) => s.id));
    try {
      let items: Pickable[] = [];
      if (tab === 'songs') items = (await api.get<Song[]>('/songs')).map((s) => ({ id: s.id, label: s.title, sub: s.artist }));
      if (tab === 'setlists') items = (await api.get<Setlist[]>('/setlists')).map((s) => ({ id: s.id, label: s.name, sub: `${s.song_count ?? 0} songs` }));
      if (tab === 'gigs') items = (await api.get<Gig[]>('/gigs')).map((g) => ({ id: g.id, label: g.name, sub: formatDate(g.date_time) }));
      setPickables(items.filter((i) => !already.has(i.id)));
    } catch (e) {
      toast.error(errorMessage(e));
      setShareOpen(false);
    }
  };

  const share = () => run(() => api.post(`/bands/${id}/${tab}`, { ids: picked }), 'Shared with the band.').then(() => setShareOpen(false));
  const invite = (p: ProfileBrief) => run(() => api.post(`/bands/${id}/invitations`, { user_id: p.id }), `Invited ${p.display_name}.`).then(() => setQuery(''));
  const updateMember = (m: BandMember, patch: { role?: BandRole; can_edit?: boolean }) => run(() => api.put(`/bands/${id}/members/${m.user_id}`, { role: m.role, can_edit: m.can_edit, ...patch }));
  const saveEdit = (e: FormEvent) => { e.preventDefault(); run(() => api.put(`/bands/${id}`, edit), 'Band updated.').then(() => setEditOpen(false)); };

  if (error) return <ErrorBanner message={error} />;
  if (!band || !user) return <PageLoader />;

  const tabs = [
    { id: 'songs' as const, label: 'Songs', icon: Music, count: band.songs.length },
    { id: 'setlists' as const, label: 'Setlists', icon: ListMusic, count: band.setlists.length },
    { id: 'gigs' as const, label: 'Gigs', icon: CalendarDays, count: band.gigs.length },
    { id: 'members' as const, label: 'Members', icon: Users, count: band.members.length },
  ];

  const shareRow = (s: BandShare, type: ShareType) => {
    const removable = s.added_by === user.id || isAdmin;
    let main: React.ReactNode;
    if (type === 'songs') main = <><p className="text-sm text-gray-100">{String(s.title)}</p><p className="text-xs text-gray-500">{[s.artist, s.key, s.tempo ? `${s.tempo} BPM` : '', s.duration ? formatDuration(Number(s.duration)) : ''].filter(Boolean).join(' · ')}</p></>;
    else if (type === 'setlists') main = <Link to={`/setlists/${s.id}`} className="block"><p className="text-sm text-gray-100 hover:text-purple-200">{String(s.name)}</p><p className="text-xs text-gray-500">{String(s.song_count ?? 0)} songs · {formatTotal(Number(s.duration) || 0)}</p></Link>;
    else main = <Link to={`/gigs/${s.id}`} className="flex items-center gap-3"><div><p className="text-sm text-gray-100 hover:text-purple-200">{String(s.name)}</p><p className="text-xs text-gray-500">{formatDate(String(s.date_time))} · {formatTime(String(s.date_time))}{s.venue ? ` · ${s.venue}` : ''}</p></div><StatusBadge status={s.status as Gig['status']} /></Link>;
    return (
      <li key={s.share_id} className="flex items-center gap-3 px-5 py-3">
        <div className="min-w-0 flex-1">{main}</div>
        <span className="hidden text-xs text-gray-500 sm:block">by {s.added_by_name} · {relativeTime(s.shared_at)}</span>
        {removable && <button className="btn-icon hover:text-red-400" aria-label="Remove from band" onClick={() => setConfirm({ title: 'Remove from band?', body: 'Members will no longer see this item. The original is not deleted.', label: 'Remove', run: () => api.del(`/bands/${id}/${type}/${s.id}`) })}><X className="h-4 w-4" /></button>}
      </li>
    );
  };

  return (
    <div>
      <Link to="/bands" className="mb-4 inline-flex items-center gap-1 text-sm text-gray-400 hover:text-white"><ArrowLeft className="h-4 w-4" /> Bands</Link>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-3"><h1 className="text-2xl font-bold text-white sm:text-3xl">{band.name}</h1><span className={`chip capitalize ${ROLE_STYLE[band.my_role]}`}>{band.my_role}</span></div>
          {band.description && <p className="mt-1 text-sm text-gray-400">{band.description}</p>}
        </div>
        <div className="flex flex-wrap gap-2">
          {isAdmin && <button className="btn-secondary" onClick={() => setInviteOpen(true)}><UserPlus className="h-4 w-4" /> Invite</button>}
          {isAdmin && <button className="btn-ghost" onClick={() => { setEdit({ name: band.name, description: band.description ?? '' }); setEditOpen(true); }}><Pencil className="h-4 w-4" /> Edit</button>}
          {band.my_role !== 'owner' && <button className="btn-ghost" onClick={() => setConfirm({ title: 'Leave band?', body: `You'll lose access to ${band.name}'s shared items.`, label: 'Leave', run: () => api.del(`/bands/${id}/members/${user.id}`).then(() => navigate('/bands')) })}><LogOut className="h-4 w-4" /> Leave</button>}
          {band.my_role === 'owner' && <button className="btn-icon hover:text-red-400" aria-label="Delete band" onClick={() => setConfirm({ title: 'Delete band?', body: 'This removes the band and all sharing. Members keep their own songs, setlists and gigs.', label: 'Delete', run: () => api.del(`/bands/${id}`).then(() => navigate('/bands')) })}><Trash2 className="h-4 w-4" /></button>}
        </div>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-1 border-b border-gray-800">
        {tabs.map(({ id: t, label, icon: Icon, count }) => (
          <button key={t} onClick={() => setTab(t)} className={cx('-mb-px flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-medium', tab === t ? 'border-purple-500 text-white' : 'border-transparent text-gray-400 hover:text-gray-200')}><Icon className="h-4 w-4" />{label}<span className="text-xs text-gray-500">{count}</span></button>
        ))}
        {tab !== 'members' && canShare && <button className="btn-primary btn-sm mb-1 ml-auto" onClick={openShare}><Plus className="h-3.5 w-3.5" /> Share {tab}</button>}
      </div>

      {tab === 'members' ? (
        <div className="space-y-4">
          <ul className="card divide-y divide-gray-800">
            {band.members.map((m) => (
              <li key={m.id} className="flex flex-col gap-3 px-5 py-3 sm:flex-row sm:items-center">
                <div className="flex flex-1 items-center gap-3">
                  <Avatar name={m.profile.display_name} url={m.profile.avatar_url} />
                  <div><p className="text-sm font-medium text-white">{m.profile.display_name}{m.user_id === user.id && <span className="text-gray-500"> (you)</span>}</p><p className="text-xs text-gray-500">@{m.profile.username}{m.profile.instrument ? ` · ${m.profile.instrument}` : ''}</p></div>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  {band.my_role === 'owner' && m.user_id !== user.id ? (
                    <select className="input w-auto py-1 text-xs" value={m.role} onChange={(e) => {
                      const role = e.target.value as BandRole;
                      if (role === 'owner') setConfirm({ title: 'Transfer ownership?', body: `${m.profile.display_name} will become the owner and you'll become an admin.`, label: 'Transfer', run: () => api.put(`/bands/${id}/members/${m.user_id}`, { role }) });
                      else updateMember(m, { role });
                    }} aria-label="Role">
                      <option value="member">Member</option><option value="admin">Admin</option><option value="owner">Owner</option>
                    </select>
                  ) : <span className={`chip capitalize ${ROLE_STYLE[m.role]}`}>{m.role}</span>}
                  {m.role === 'member' && (isAdmin ? <div className="w-36"><Toggle checked={m.can_edit} onChange={(v) => updateMember(m, { can_edit: v })} label="Can share" /></div> : m.can_edit && <span className="text-xs text-gray-500">Can share</span>)}
                  {isAdmin && m.user_id !== user.id && m.role !== 'owner' && (band.my_role === 'owner' || m.role === 'member') && (
                    <button className="btn-icon hover:text-red-400" aria-label={`Remove ${m.profile.display_name}`} onClick={() => setConfirm({ title: 'Remove member?', body: `${m.profile.display_name} will lose access to the band.`, label: 'Remove', run: () => api.del(`/bands/${id}/members/${m.user_id}`) })}><X className="h-4 w-4" /></button>
                  )}
                </div>
              </li>
            ))}
          </ul>
          {band.invitations.length > 0 && (
            <div className="card">
              <h2 className="border-b border-gray-800 px-5 py-3 text-sm font-semibold text-white">Pending invitations</h2>
              <ul className="divide-y divide-gray-800">
                {band.invitations.map((inv) => (
                  <li key={inv.id} className="flex items-center gap-3 px-5 py-3 text-sm">
                    <span className="flex-1 text-gray-200">{inv.invitee?.display_name} <span className="text-xs text-gray-500">@{inv.invitee?.username} · {relativeTime(inv.created_at)}</span></span>
                    {isAdmin && <button className="btn-ghost btn-sm" onClick={() => run(() => api.del(`/bands/${id}/invitations/${inv.id}`), 'Invitation cancelled.')}>Cancel</button>}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      ) : band[tab].length === 0 ? (
        <div className="card px-5 py-12 text-center text-sm text-gray-400">Nothing shared yet.{canShare && <> <button className="link" onClick={openShare}>Share your {tab}</button> with the band.</>}</div>
      ) : (
        <ul className="card divide-y divide-gray-800">{band[tab].map((s) => shareRow(s, tab))}</ul>
      )}

      <Modal open={inviteOpen} onClose={() => setInviteOpen(false)} title="Invite a member">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
          <input className="input pl-9" placeholder="Search by name or username" value={query} onChange={(e) => setQuery(e.target.value)} autoFocus aria-label="Search users" />
        </div>
        <ul className="mt-3 max-h-72 divide-y divide-gray-800 overflow-y-auto">
          {found.map((p) => (
            <li key={p.id} className="flex items-center gap-3 py-2">
              <Avatar name={p.display_name} url={p.avatar_url} size="sm" />
              <span className="flex-1 text-sm text-gray-200">{p.display_name} <span className="text-xs text-gray-500">@{p.username}</span></span>
              {memberIds.has(p.id) ? <span className="text-xs text-gray-500">Already added</span> : <button className="btn-primary btn-sm" onClick={() => invite(p)}>Invite</button>}
            </li>
          ))}
          {query.trim().length >= 2 && !found.length && <li className="py-6 text-center text-sm text-gray-500">No users found.</li>}
        </ul>
      </Modal>

      <Modal open={shareOpen} onClose={() => setShareOpen(false)} title={`Share ${tab} with ${band.name}`}>
        {!pickables ? <PageLoader /> : pickables.length === 0 ? <p className="py-6 text-center text-sm text-gray-500">Everything is already shared, or you have no {tab} yet.</p> : (
          <>
            <ul className="max-h-80 divide-y divide-gray-800 overflow-y-auto">
              {pickables.map((p) => (
                <li key={p.id}>
                  <label className="flex cursor-pointer items-center gap-3 py-2">
                    <input type="checkbox" className="h-4 w-4 accent-purple-600" checked={picked.includes(p.id)} onChange={(e) => setPicked((x) => (e.target.checked ? [...x, p.id] : x.filter((y) => y !== p.id)))} />
                    <span className="flex-1 text-sm text-gray-200">{p.label} <span className="text-xs text-gray-500">{p.sub}</span></span>
                  </label>
                </li>
              ))}
            </ul>
            <div className="mt-4 flex justify-end gap-2">
              <button className="btn-secondary" onClick={() => setShareOpen(false)}>Cancel</button>
              <button className="btn-primary" onClick={share} disabled={!picked.length}>Share {picked.length || ''}</button>
            </div>
          </>
        )}
      </Modal>

      <Modal open={editOpen} onClose={() => setEditOpen(false)} title="Edit band">
        <form onSubmit={saveEdit} className="space-y-4">
          <Field label="Name" htmlFor="eb-name"><input id="eb-name" className="input" value={edit.name} onChange={(e) => setEdit((x) => ({ ...x, name: e.target.value }))} /></Field>
          <Field label="Description" htmlFor="eb-desc"><textarea id="eb-desc" className="input min-h-[80px]" value={edit.description} onChange={(e) => setEdit((x) => ({ ...x, description: e.target.value }))} /></Field>
          <div className="flex justify-end gap-2"><button type="button" className="btn-secondary" onClick={() => setEditOpen(false)}>Cancel</button><button className="btn-primary" disabled={!edit.name.trim()}>Save</button></div>
        </form>
      </Modal>

      <ConfirmDialog open={!!confirm} title={confirm?.title ?? ''} body={confirm?.body ?? ''} confirmLabel={confirm?.label} onCancel={() => setConfirm(null)} onConfirm={() => { const c = confirm; setConfirm(null); if (c) run(c.run); }} />
    </div>
  );
}
