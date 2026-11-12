import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowDown, ArrowLeft, ArrowUp, CalendarDays, Plus, Save, X } from 'lucide-react';
import { api, errorMessage } from '../../lib/api';
import type { Gig, GigStatus, Setlist } from '../../lib/types';
import { GIG_STATUSES } from '../../lib/constants';
import { formatTotal, fromLocalInput, toLocalInput } from '../../lib/format';
import { useToast } from '../../contexts/ToastContext';
import { ErrorBanner, Field, PageHeader, PageLoader, Spinner } from '../../components/ui';

export default function GigForm() {
  const { id } = useParams();
  const editing = !!id;
  const navigate = useNavigate();
  const toast = useToast();
  const [setlists, setSetlists] = useState<Setlist[] | null>(null);
  const [f, setF] = useState({ name: '', venue: '', location: '', date_time: '', load_in_time: '', duration: '120', notes: '', payment: '', status: 'scheduled' as GigStatus });
  const [chosen, setChosen] = useState<number[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    document.title = `${editing ? 'Edit' : 'Schedule'} gig · GigMasterPro`;
    Promise.all([api.get<Setlist[]>('/setlists'), editing ? api.get<Gig>(`/gigs/${id}`) : Promise.resolve(null)])
      .then(([sls, g]) => {
        setSetlists(sls);
        if (g) {
          setF({ name: g.name, venue: g.venue ?? '', location: g.location ?? '', date_time: toLocalInput(g.date_time), load_in_time: toLocalInput(g.load_in_time), duration: String(g.duration || ''), notes: g.notes ?? '', payment: g.payment !== null ? String(g.payment) : '', status: g.status });
          setChosen((g.setlists ?? []).map((l) => l.setlist_id));
        }
      })
      .catch((e) => setError(errorMessage(e)));
  }, [id, editing]);

  const set = (k: keyof typeof f, v: string) => setF((s) => ({ ...s, [k]: v }));
  const move = (i: number, d: number) => setChosen((c) => { const j = i + d; if (j < 0 || j >= c.length) return c; const x = [...c]; [x[i], x[j]] = [x[j]!, x[i]!]; return x; });

  const submit = async (ev: FormEvent) => {
    ev.preventDefault();
    const e: Record<string, string> = {};
    if (!f.name.trim()) e.name = 'Gig name is required.';
    if (!f.date_time) e.date_time = 'Date and time are required.';
    if (f.payment && Number.isNaN(Number(f.payment))) e.payment = 'Enter a number.';
    setErrors(e);
    if (Object.keys(e).length) return;
    setSaving(true);
    const payload = { ...f, date_time: fromLocalInput(f.date_time), load_in_time: fromLocalInput(f.load_in_time), duration: Number(f.duration) || 0, payment: f.payment === '' ? null : Number(f.payment), setlists: chosen };
    try {
      const g = editing ? await api.put<Gig>(`/gigs/${id}`, payload) : await api.post<Gig>('/gigs', payload);
      toast.success(editing ? 'Gig updated.' : 'Gig scheduled.');
      navigate(`/gigs/${g.id}`);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  if (error) return <ErrorBanner message={error} />;
  if (!setlists) return <PageLoader />;
  const byId = new Map(setlists.map((s) => [s.id, s]));

  return (
    <form onSubmit={submit} noValidate className="mx-auto max-w-4xl">
      <Link to={editing ? `/gigs/${id}` : '/gigs'} className="mb-4 inline-flex items-center gap-1 text-sm text-gray-400 hover:text-white"><ArrowLeft className="h-4 w-4" /> Back</Link>
      <PageHeader title={editing ? 'Edit gig' : 'Schedule a gig'} icon={<CalendarDays className="h-5 w-5" />} />
      <div className="space-y-6">
        <section className="card grid gap-4 p-5 sm:grid-cols-2">
          <Field label="Gig name *" htmlFor="g-name" error={errors.name} className="sm:col-span-2">
            <input id="g-name" className="input" value={f.name} onChange={(e) => set('name', e.target.value)} placeholder="e.g. Friday night at The Blue Room" />
          </Field>
          <Field label="Venue" htmlFor="g-venue"><input id="g-venue" className="input" value={f.venue} onChange={(e) => set('venue', e.target.value)} /></Field>
          <Field label="Location / address" htmlFor="g-loc"><input id="g-loc" className="input" value={f.location} onChange={(e) => set('location', e.target.value)} /></Field>
          <Field label="Date & start time *" htmlFor="g-dt" error={errors.date_time}><input id="g-dt" type="datetime-local" className="input" value={f.date_time} onChange={(e) => set('date_time', e.target.value)} /></Field>
          <Field label="Load-in time" htmlFor="g-li"><input id="g-li" type="datetime-local" className="input" value={f.load_in_time} onChange={(e) => set('load_in_time', e.target.value)} /></Field>
          <Field label="Duration (minutes)" htmlFor="g-dur"><input id="g-dur" type="number" min={0} className="input" value={f.duration} onChange={(e) => set('duration', e.target.value)} /></Field>
          <Field label="Payment (USD)" htmlFor="g-pay" error={errors.payment}><input id="g-pay" type="number" min={0} step="0.01" className="input" value={f.payment} onChange={(e) => set('payment', e.target.value)} /></Field>
          <Field label="Status" htmlFor="g-status">
            <select id="g-status" className="input capitalize" value={f.status} onChange={(e) => set('status', e.target.value)}>
              {GIG_STATUSES.map((s) => <option key={s} value={s}>{s[0]!.toUpperCase() + s.slice(1)}</option>)}
            </select>
          </Field>
          <Field label="Notes" htmlFor="g-notes" className="sm:col-span-2"><textarea id="g-notes" className="input min-h-[90px]" value={f.notes} onChange={(e) => set('notes', e.target.value)} placeholder="Contact, parking, dress code, PA details…" /></Field>
        </section>
        <section className="card p-5">
          <h2 className="font-semibold text-white">Setlists</h2>
          <p className="mb-4 text-sm text-gray-400">Pick the sets you'll play, in order. Play Mode walks through them song by song.</p>
          {chosen.length > 0 && (
            <ol className="mb-4 space-y-2">
              {chosen.map((sid, i) => {
                const s = byId.get(sid);
                return (
                  <li key={sid} className="flex items-center gap-3 rounded-lg bg-gray-800/60 px-3 py-2">
                    <span className="w-6 text-sm text-gray-500">{i + 1}</span>
                    <span className="flex-1 text-sm text-gray-100">{s?.name ?? 'Setlist'}<span className="ml-2 text-xs text-gray-500">{s?.song_count ?? 0} songs · {formatTotal(s?.duration ?? 0)}</span></span>
                    <button type="button" className="btn-icon h-7 w-7" onClick={() => move(i, -1)} aria-label="Move up"><ArrowUp className="h-3.5 w-3.5" /></button>
                    <button type="button" className="btn-icon h-7 w-7" onClick={() => move(i, 1)} aria-label="Move down"><ArrowDown className="h-3.5 w-3.5" /></button>
                    <button type="button" className="btn-icon h-7 w-7 hover:text-red-400" onClick={() => setChosen((c) => c.filter((x) => x !== sid))} aria-label="Remove"><X className="h-4 w-4" /></button>
                  </li>
                );
              })}
            </ol>
          )}
          <div className="flex flex-wrap gap-2">
            {setlists.filter((s) => !chosen.includes(s.id)).map((s) => (
              <button key={s.id} type="button" className="btn-secondary btn-sm" onClick={() => setChosen((c) => [...c, s.id])}><Plus className="h-3.5 w-3.5" /> {s.name}</button>
            ))}
            {setlists.length === 0 && <p className="text-sm text-gray-500">No setlists yet. <Link to="/setlists/new" className="link">Create one</Link></p>}
          </div>
        </section>
        <div className="flex justify-end gap-2">
          <Link to={editing ? `/gigs/${id}` : '/gigs'} className="btn-secondary">Cancel</Link>
          <button className="btn-primary" disabled={saving}>{saving ? <Spinner className="h-4 w-4 text-white" /> : <Save className="h-4 w-4" />} {editing ? 'Save changes' : 'Schedule gig'}</button>
        </div>
      </div>
    </form>
  );
}
