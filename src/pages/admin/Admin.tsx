import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Ban, CheckCircle2, Megaphone, Search, Shield, ShieldOff, Sparkles } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { api, errorMessage } from '../../lib/api';
import { cx, formatDate } from '../../lib/format';
import type { AdminUser, AdminUserList, AdSettings } from '../../lib/types';
import { Avatar, ConfirmDialog, ErrorBanner, Field, PageHeader, PageLoader, Spinner, Toggle } from '../../components/ui';

type Status = 'all' | 'active' | 'disabled' | 'admin';
const PAGE_SIZE = 50;

export default function Admin() {
  useEffect(() => { document.title = 'Admin · GigMasterPro'; }, []);
  return (
    <div>
      <PageHeader title="Admin" icon={<Shield className="h-5 w-5" />} subtitle="Site-wide ads and user accounts." />
      <div className="space-y-6">
        <AdsPanel />
        <UsersPanel />
      </div>
    </div>
  );
}

function AdsPanel() {
  const { refresh } = useAuth();
  const toast = useToast();
  const [settings, setSettings] = useState<AdSettings | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    setError(null);
    api.get<AdSettings>('/admin/settings').then(setSettings).catch((e) => setError(errorMessage(e)));
  }, []);
  useEffect(load, [load]);

  const save = async (patch: Partial<AdSettings>) => {
    setSaving(true);
    try {
      const saved = await api.put<AdSettings>('/admin/settings', patch);
      // A plain toggle keeps any unsaved edits in the ID form.
      setSettings((s) => (s && patch.client === undefined ? { ...s, enabled: saved.enabled } : saved));
      await refresh();
      toast.success('Ad settings saved.');
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (settings) save({ client: settings.client.trim(), slots: settings.slots });
  };

  if (error) return <ErrorBanner message={error} onRetry={load} />;
  if (!settings) return <PageLoader label="Loading ad settings…" />;
  const setSlot = (k: keyof AdSettings['slots'], v: string) => setSettings({ ...settings, slots: { ...settings.slots, [k]: v } });

  return (
    <section className="card p-5" aria-labelledby="ads-heading">
      <h2 id="ads-heading" className="mb-4 flex items-center gap-2 text-lg font-semibold text-white"><Megaphone className="h-5 w-5 text-purple-400" /> Ads</h2>
      <Toggle
        checked={settings.enabled}
        onChange={(v) => save({ enabled: v })}
        label="Show ads"
        description="Turns Google AdSense ads on or off for everyone. Ad-free users never see ads."
      />
      <form onSubmit={submit} className="mt-6 grid gap-4 border-t border-gray-800 pt-5 sm:grid-cols-2">
        <Field label="AdSense publisher ID" htmlFor="ad-client" hint="Looks like ca-pub-1234567890123456." className="sm:col-span-2">
          <input id="ad-client" className="input" placeholder="ca-pub-…" value={settings.client} onChange={(e) => setSettings({ ...settings, client: e.target.value })} />
        </Field>
        <Field label="Banner slot ID" htmlFor="slot-banner" hint="Top of every page. 320×50 / 728×90 / 970×90.">
          <input id="slot-banner" className="input" inputMode="numeric" value={settings.slots.banner} onChange={(e) => setSlot('banner', e.target.value)} />
        </Field>
        <Field label="Sidebar slot ID" htmlFor="slot-sidebar" hint="Right rail on wide screens. 160×600 / 300×600.">
          <input id="slot-sidebar" className="input" inputMode="numeric" value={settings.slots.sidebar} onChange={(e) => setSlot('sidebar', e.target.value)} />
        </Field>
        <Field label="Footer slot ID" htmlFor="slot-footer" hint="Below page content. 300×250 / 728×90.">
          <input id="slot-footer" className="input" inputMode="numeric" value={settings.slots.footer} onChange={(e) => setSlot('footer', e.target.value)} />
        </Field>
        <div className="flex items-end justify-end sm:col-span-2">
          <button className="btn-primary" type="submit" disabled={saving}>{saving && <Spinner className="h-4 w-4 text-white" />} Save ad IDs</button>
        </div>
      </form>
    </section>
  );
}

function UsersPanel() {
  const { user: me, refresh } = useAuth();
  const toast = useToast();
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<Status>('all');
  const [offset, setOffset] = useState(0);
  const [data, setData] = useState<AdminUserList | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [confirm, setConfirm] = useState<AdminUser | null>(null);

  const load = useCallback(() => {
    setError(null);
    const params = new URLSearchParams({ limit: String(PAGE_SIZE), offset: String(offset) });
    if (query) params.set('search', query);
    if (status !== 'all') params.set('status', status);
    api.get<AdminUserList>(`/admin/users?${params}`).then(setData).catch((e) => setError(errorMessage(e)));
  }, [query, status, offset]);
  useEffect(load, [load]);

  const update = async (u: AdminUser, patch: Partial<Pick<AdminUser, 'disabled' | 'role' | 'ad_free'>>, msg: string) => {
    setBusyId(u.id);
    try {
      await api.put<AdminUser>(`/admin/users/${u.id}`, patch);
      load();
      if (u.id === me?.id) await refresh();
      toast.success(msg);
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusyId(null);
      setConfirm(null);
    }
  };

  const filters: { id: Status; label: string; count?: number }[] = [
    { id: 'all', label: 'All', count: data?.counts.all },
    { id: 'active', label: 'Active' },
    { id: 'disabled', label: 'Disabled', count: data?.counts.disabled },
    { id: 'admin', label: 'Admins', count: data?.counts.admins },
  ];
  const name = (u: AdminUser) => u.display_name || u.username || u.email;

  return (
    <section className="card p-5" aria-labelledby="users-heading">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 id="users-heading" className="text-lg font-semibold text-white">Users</h2>
        <form onSubmit={(e) => { e.preventDefault(); setOffset(0); setQuery(search.trim()); }} className="relative w-full sm:w-72">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
          <input className="input pl-9" placeholder="Search email, username or name" value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Search users" />
        </form>
      </div>
      <div className="mb-4 flex flex-wrap gap-1" role="tablist">
        {filters.map((f) => (
          <button
            key={f.id}
            role="tab"
            aria-selected={status === f.id}
            onClick={() => { setOffset(0); setStatus(f.id); }}
            className={cx('rounded-lg px-3 py-1.5 text-sm transition', status === f.id ? 'bg-purple-500/15 text-purple-200' : 'text-gray-400 hover:bg-gray-800 hover:text-white')}
          >
            {f.label}{f.count !== undefined && <span className="ml-1 text-xs text-gray-500">{f.count}</span>}
          </button>
        ))}
      </div>
      {error && <ErrorBanner message={error} onRetry={load} />}
      {!data && !error && <PageLoader label="Loading users…" />}
      {data && (
        <>
          <ul className="divide-y divide-gray-800">
            {data.users.map((u) => {
              const self = u.id === me?.id;
              const busy = busyId === u.id;
              return (
                <li key={u.id} className="flex flex-col gap-3 py-3 md:flex-row md:items-center">
                  <div className="flex min-w-0 flex-1 items-center gap-3">
                    <Avatar name={name(u)} url={u.avatar_url} size="sm" />
                    <div className="min-w-0">
                      <p className="flex flex-wrap items-center gap-2 text-sm font-medium text-white">
                        <span className="truncate">{name(u)}</span>
                        {u.role === 'admin' && <span className="chip bg-purple-500/10 text-purple-300 ring-purple-500/30">Admin</span>}
                        {u.disabled && <span className="chip bg-red-500/10 text-red-300 ring-red-500/30">Disabled</span>}
                        {u.ad_free && <span className="chip bg-emerald-500/10 text-emerald-300 ring-emerald-500/30">Ad-free</span>}
                        {self && <span className="text-xs text-gray-500">(you)</span>}
                      </p>
                      <p className="truncate text-xs text-gray-500">{u.email} · joined {formatDate(u.created_at)}</p>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {busy && <Spinner className="h-4 w-4" />}
                    <button className="btn-ghost btn-sm" disabled={busy} onClick={() => update(u, { ad_free: !u.ad_free }, u.ad_free ? 'Ads turned back on for this user.' : 'User is now ad-free.')}>
                      <Sparkles className="h-3.5 w-3.5" /> {u.ad_free ? 'Remove ad-free' : 'Make ad-free'}
                    </button>
                    {!self && (
                      <button className="btn-ghost btn-sm" disabled={busy} onClick={() => update(u, { role: u.role === 'admin' ? 'user' : 'admin' }, u.role === 'admin' ? 'Admin role removed.' : 'User is now an admin.')}>
                        {u.role === 'admin' ? <><ShieldOff className="h-3.5 w-3.5" /> Remove admin</> : <><Shield className="h-3.5 w-3.5" /> Make admin</>}
                      </button>
                    )}
                    {!self && (u.disabled ? (
                      <button className="btn-secondary btn-sm" disabled={busy} onClick={() => update(u, { disabled: false }, 'User enabled.')}>
                        <CheckCircle2 className="h-3.5 w-3.5" /> Enable
                      </button>
                    ) : (
                      <button className="btn-danger btn-sm" disabled={busy} onClick={() => setConfirm(u)}>
                        <Ban className="h-3.5 w-3.5" /> Disable
                      </button>
                    ))}
                  </div>
                </li>
              );
            })}
            {data.users.length === 0 && <li className="py-6 text-center text-sm text-gray-500">No users match.</li>}
          </ul>
          {data.total > PAGE_SIZE && (
            <div className="mt-4 flex items-center justify-between text-sm text-gray-400">
              <span>{offset + 1}–{Math.min(offset + PAGE_SIZE, data.total)} of {data.total}</span>
              <div className="flex gap-2">
                <button className="btn-secondary btn-sm" disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}>Previous</button>
                <button className="btn-secondary btn-sm" disabled={offset + PAGE_SIZE >= data.total} onClick={() => setOffset(offset + PAGE_SIZE)}>Next</button>
              </div>
            </div>
          )}
        </>
      )}
      <ConfirmDialog
        open={!!confirm}
        title="Disable user?"
        body={confirm && <>{name(confirm)} ({confirm.email}) will be signed out everywhere and won't be able to sign in until you enable the account again. Their data is kept.</>}
        confirmLabel="Disable"
        busy={busyId === confirm?.id}
        onConfirm={() => confirm && update(confirm, { disabled: true }, 'User disabled.')}
        onCancel={() => setConfirm(null)}
      />
    </section>
  );
}
