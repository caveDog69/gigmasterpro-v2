import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Ban, Check, MessageSquare, UserMinus, UserPlus, X } from 'lucide-react';
import { api, errorMessage } from '../../lib/api';
import type { Connection, ConnectionStatus } from '../../lib/types';
import { relativeTime } from '../../lib/format';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { useNotifications } from '../../contexts/NotificationsContext';
import { Avatar, ConfirmDialog, EmptyState, ErrorBanner, PageLoader } from '../../components/ui';

export default function Connections() {
  const { user } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const { refresh } = useNotifications();
  const [list, setList] = useState<Connection[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [removing, setRemoving] = useState<Connection | null>(null);

  const load = () => api.get<Connection[]>('/connections').then(setList).catch((e) => setError(errorMessage(e)));
  useEffect(() => { load(); }, []);

  const respond = async (c: Connection, status: ConnectionStatus) => {
    try {
      const updated = await api.put<Connection>(`/connections/${c.id}`, { status });
      setList((l) => l?.map((x) => (x.id === c.id ? updated : x)) ?? null);
      toast.success(status === 'accepted' ? 'Connection accepted.' : status === 'blocked' ? 'User blocked.' : 'Request declined.');
      refresh();
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };
  const remove = async () => {
    if (!removing) return;
    try {
      await api.del(`/connections/${removing.id}`);
      setList((l) => l?.filter((x) => x.id !== removing.id) ?? null);
      setRemoving(null);
      refresh();
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };

  if (error) return <ErrorBanner message={error} />;
  if (!list) return <PageLoader />;
  const other = (c: Connection) => (c.requester_id === user?.id ? c.recipient : c.requester);
  const incoming = list.filter((c) => c.status === 'pending' && c.recipient_id === user?.id);
  const outgoing = list.filter((c) => c.status === 'pending' && c.requester_id === user?.id);
  const accepted = list.filter((c) => c.status === 'accepted');
  const blocked = list.filter((c) => c.status === 'blocked' && c.recipient_id === user?.id);

  const Row = ({ c, children }: { c: Connection; children: React.ReactNode }) => {
    const p = other(c);
    return (
      <li className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <Avatar name={p.display_name} url={p.avatar_url} />
          <div className="min-w-0">
            <p className="truncate font-medium text-white">{p.display_name} <span className="text-xs font-normal text-gray-500">@{p.username}</span></p>
            <p className="truncate text-xs text-gray-400">{[p.instrument, [p.city, p.state].filter(Boolean).join(', ')].filter(Boolean).join(' · ')}{' · '}{relativeTime(c.updated_at)}</p>
            {c.message && c.status === 'pending' && <p className="mt-1 text-sm italic text-gray-300">“{c.message}”</p>}
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">{children}</div>
      </li>
    );
  };

  if (!list.length) return <EmptyState icon={<UserPlus className="h-7 w-7" />} title="No connections yet" body="Find musicians on the Discover tab and send a connection request." />;

  return (
    <div className="space-y-6">
      {incoming.length > 0 && (
        <section className="card"><h2 className="border-b border-gray-800 px-5 py-3 font-semibold text-white">Requests for you ({incoming.length})</h2>
          <ul className="divide-y divide-gray-800">{incoming.map((c) => (
            <Row key={c.id} c={c}>
              <button className="btn-primary btn-sm" onClick={() => respond(c, 'accepted')}><Check className="h-3.5 w-3.5" /> Accept</button>
              <button className="btn-secondary btn-sm" onClick={() => respond(c, 'declined')}><X className="h-3.5 w-3.5" /> Decline</button>
              <button className="btn-ghost btn-sm text-red-400" onClick={() => respond(c, 'blocked')}><Ban className="h-3.5 w-3.5" /> Block</button>
            </Row>
          ))}</ul>
        </section>
      )}
      <section className="card"><h2 className="border-b border-gray-800 px-5 py-3 font-semibold text-white">Connections ({accepted.length})</h2>
        {accepted.length === 0 ? <p className="px-5 py-6 text-sm text-gray-500">No accepted connections yet.</p> : (
          <ul className="divide-y divide-gray-800">{accepted.map((c) => (
            <Row key={c.id} c={c}>
              <button className="btn-primary btn-sm" onClick={() => navigate(`/community?tab=messages&with=${other(c).id}`)}><MessageSquare className="h-3.5 w-3.5" /> Message</button>
              <button className="btn-ghost btn-sm" onClick={() => setRemoving(c)}><UserMinus className="h-3.5 w-3.5" /> Remove</button>
            </Row>
          ))}</ul>
        )}
      </section>
      {outgoing.length > 0 && (
        <section className="card"><h2 className="border-b border-gray-800 px-5 py-3 font-semibold text-white">Sent requests ({outgoing.length})</h2>
          <ul className="divide-y divide-gray-800">{outgoing.map((c) => (
            <Row key={c.id} c={c}><button className="btn-ghost btn-sm" onClick={() => setRemoving(c)}>Cancel request</button></Row>
          ))}</ul>
        </section>
      )}
      {blocked.length > 0 && (
        <section className="card"><h2 className="border-b border-gray-800 px-5 py-3 font-semibold text-white">Blocked</h2>
          <ul className="divide-y divide-gray-800">{blocked.map((c) => (
            <Row key={c.id} c={c}><button className="btn-ghost btn-sm" onClick={() => setRemoving(c)}>Unblock</button></Row>
          ))}</ul>
        </section>
      )}
      <ConfirmDialog open={!!removing} title="Remove?" body={`This removes the connection with ${removing ? other(removing).display_name : ''}.`} confirmLabel="Remove" onCancel={() => setRemoving(null)} onConfirm={remove} />
    </div>
  );
}
