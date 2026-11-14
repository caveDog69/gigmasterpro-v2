import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowDown, ArrowLeft, ArrowUp, GripVertical, ListMusic, Plus, Save, Search, X } from 'lucide-react';
import { api, errorMessage } from '../../lib/api';
import type { Setlist, Song } from '../../lib/types';
import { formatDuration, formatTotal, cx } from '../../lib/format';
import { useToast } from '../../contexts/ToastContext';
import { ErrorBanner, Field, PageHeader, PageLoader, Spinner, Toggle } from '../../components/ui';

interface Entry { key: string; song: Song; notes: string }

export default function SetlistForm() {
  const { id } = useParams();
  const editing = !!id;
  const navigate = useNavigate();
  const toast = useToast();
  const [songs, setSongs] = useState<Song[] | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isPublic, setIsPublic] = useState(false);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [search, setSearch] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [nameError, setNameError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [dragIndex, setDragIndex] = useState<number | null>(null);

  useEffect(() => {
    document.title = `${editing ? 'Edit' : 'New'} setlist · GigMasterPro`;
    const reqs: [Promise<Song[]>, Promise<Setlist | null>] = [api.get<Song[]>('/songs'), editing ? api.get<Setlist>(`/setlists/${id}`) : Promise.resolve(null)];
    Promise.all(reqs)
      .then(([all, sl]) => {
        setSongs(all);
        if (sl) {
          setName(sl.name);
          setDescription(sl.description ?? '');
          setIsPublic(sl.is_public);
          setEntries((sl.songs ?? []).map((e) => ({ key: `e${e.id}`, song: e.song, notes: e.notes ?? '' })));
        }
      })
      .catch((e) => setError(errorMessage(e)));
  }, [id, editing]);

  const inSet = useMemo(() => new Set(entries.map((e) => e.song.id)), [entries]);
  const available = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (songs ?? []).filter((s) => !inSet.has(s.id) && (!q || s.title.toLowerCase().includes(q) || s.artist.toLowerCase().includes(q)));
  }, [songs, inSet, search]);
  const total = entries.reduce((s, e) => s + (e.song.duration || 0), 0);

  const add = (song: Song) => setEntries((es) => [...es, { key: `n${song.id}-${Date.now()}`, song, notes: '' }]);
  const removeAt = (i: number) => setEntries((es) => es.filter((_, j) => j !== i));
  const move = (from: number, to: number) =>
    setEntries((es) => {
      if (to < 0 || to >= es.length) return es;
      const copy = [...es];
      const [item] = copy.splice(from, 1);
      copy.splice(to, 0, item!);
      return copy;
    });

  const submit = async (ev: FormEvent) => {
    ev.preventDefault();
    if (!name.trim()) return setNameError('Give your setlist a name.');
    setNameError(null);
    setSaving(true);
    const payload = { name, description, is_public: isPublic, songs: entries.map((e) => ({ song_id: e.song.id, notes: e.notes })) };
    try {
      const saved = editing ? await api.put<Setlist>(`/setlists/${id}`, payload) : await api.post<Setlist>('/setlists', payload);
      toast.success(editing ? 'Setlist saved.' : 'Setlist created.');
      navigate(`/setlists/${saved.id}`);
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  if (error) return <ErrorBanner message={error} />;
  if (!songs) return <PageLoader />;

  return (
    <form onSubmit={submit} noValidate>
      <Link to={editing ? `/setlists/${id}` : '/setlists'} className="mb-4 inline-flex items-center gap-1 text-sm text-gray-400 hover:text-white"><ArrowLeft className="h-4 w-4" /> Back</Link>
      <PageHeader
        title={editing ? 'Edit setlist' : 'New setlist'}
        icon={<ListMusic className="h-5 w-5" />}
        actions={<button className="btn-primary" disabled={saving}>{saving ? <Spinner className="h-4 w-4 text-white" /> : <Save className="h-4 w-4" />} Save setlist</button>}
      />
      <div className="card mb-6 grid gap-4 p-5 md:grid-cols-2">
        <Field label="Name *" htmlFor="sl-name" error={nameError}>
          <input id="sl-name" className="input" value={name} onChange={(e) => setName(e.target.value)} maxLength={191} placeholder="e.g. Wedding — Dance Set" />
        </Field>
        <Field label="Description" htmlFor="sl-desc">
          <input id="sl-desc" className="input" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Optional" />
        </Field>
        <div className="md:col-span-2"><Toggle checked={isPublic} onChange={setIsPublic} label="Public setlist" description="Visible to band members you share it with." /></div>
      </div>
      <div className="grid gap-6 lg:grid-cols-5">
        <section className="card flex flex-col lg:col-span-2" aria-label="Your songs">
          <div className="border-b border-gray-800 p-4">
            <h2 className="mb-3 font-semibold text-white">Your songs</h2>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
              <input className="input pl-9" placeholder="Filter songs…" value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Filter songs" />
            </div>
          </div>
          <ul className="scrollbar-thin max-h-[60vh] flex-1 divide-y divide-gray-800 overflow-y-auto">
            {available.map((s) => (
              <li key={s.id}>
                <button type="button" onClick={() => add(s)} className="flex w-full items-center gap-3 px-4 py-2.5 text-left transition hover:bg-gray-800/60">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm text-gray-100">{s.title}</span>
                    <span className="block truncate text-xs text-gray-500">{s.artist}</span>
                  </span>
                  <span className="text-xs text-gray-500">{s.key}</span>
                  <Plus className="h-4 w-4 text-purple-400" />
                </button>
              </li>
            ))}
            {available.length === 0 && (
              <li className="px-4 py-8 text-center text-sm text-gray-500">
                {songs.length === 0 ? <>No songs yet. <Link to="/songs/new" className="link">Add one</Link></> : 'No more songs to add.'}
              </li>
            )}
          </ul>
        </section>
        <section className="card lg:col-span-3" aria-label="Setlist order">
          <div className="flex items-center justify-between border-b border-gray-800 p-4">
            <h2 className="font-semibold text-white">Running order</h2>
            <span className="text-sm text-gray-400">{entries.length} songs · {formatTotal(total)}</span>
          </div>
          {entries.length === 0 ? (
            <p className="px-4 py-16 text-center text-sm text-gray-500">Click songs on the left to add them here, then drag to reorder.</p>
          ) : (
            <ol className="divide-y divide-gray-800">
              {entries.map((e, i) => (
                <li
                  key={e.key}
                  draggable
                  onDragStart={() => setDragIndex(i)}
                  onDragOver={(ev) => { ev.preventDefault(); if (dragIndex !== null && dragIndex !== i) { move(dragIndex, i); setDragIndex(i); } }}
                  onDragEnd={() => setDragIndex(null)}
                  className={cx('flex items-start gap-2 px-3 py-3', dragIndex === i && 'bg-purple-500/10')}
                >
                  <GripVertical className="mt-2 h-4 w-4 shrink-0 cursor-grab text-gray-600" aria-hidden="true" />
                  <span className="mt-1.5 w-6 text-right text-sm text-gray-500">{i + 1}</span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-sm font-medium text-gray-100">{e.song.title}</span>
                      <span className="truncate text-xs text-gray-500">{e.song.artist}</span>
                      <span className="ml-auto shrink-0 text-xs text-gray-400">{[e.song.key, e.song.duration ? formatDuration(e.song.duration) : ''].filter(Boolean).join(' · ')}</span>
                    </div>
                    <input
                      className="input mt-1.5 py-1 text-xs"
                      placeholder="Notes for this set (e.g. capo 2, extended outro)"
                      value={e.notes}
                      onChange={(ev) => setEntries((es) => es.map((x, j) => (j === i ? { ...x, notes: ev.target.value } : x)))}
                      aria-label={`Notes for ${e.song.title}`}
                    />
                  </div>
                  <div className="flex shrink-0 flex-col">
                    <button type="button" className="btn-icon h-7 w-7" onClick={() => move(i, i - 1)} disabled={i === 0} aria-label="Move up"><ArrowUp className="h-3.5 w-3.5" /></button>
                    <button type="button" className="btn-icon h-7 w-7" onClick={() => move(i, i + 1)} disabled={i === entries.length - 1} aria-label="Move down"><ArrowDown className="h-3.5 w-3.5" /></button>
                  </div>
                  <button type="button" className="btn-icon h-7 w-7 hover:text-red-400" onClick={() => removeAt(i)} aria-label={`Remove ${e.song.title}`}><X className="h-4 w-4" /></button>
                </li>
              ))}
            </ol>
          )}
        </section>
      </div>
    </form>
  );
}
