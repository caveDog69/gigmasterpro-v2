import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Music, Save, Trash2 } from 'lucide-react';
import { api, errorMessage } from '../../lib/api';
import type { SearchResult, Song } from '../../lib/types';
import { GENRES, KEY_OPTIONS, TUNINGS } from '../../lib/constants';
import { formatDuration, parseDuration } from '../../lib/format';
import { transposeKey, transposeText } from '../../lib/transpose';
import { useToast } from '../../contexts/ToastContext';
import SongSearch from '../../components/SongSearch';
import { ConfirmDialog, ErrorBanner, Field, PageHeader, PageLoader, Spinner, Toggle } from '../../components/ui';

interface FormState {
  title: string; artist: string; album: string; release_date: string; key: string; tempo: string; duration: string;
  genre: string; guitar_tuning: string; lyrics: string; chords: string; notes: string; is_original: boolean; lrclib_id: number | null;
}

const EMPTY: FormState = {
  title: '', artist: '', album: '', release_date: '', key: '', tempo: '120', duration: '', genre: '',
  guitar_tuning: 'Standard (E A D G B E)', lyrics: '', chords: '', notes: '', is_original: false, lrclib_id: null,
};

export default function SongForm() {
  const { id } = useParams();
  const editing = !!id;
  const navigate = useNavigate();
  const toast = useToast();
  const [form, setForm] = useState<FormState>(EMPTY);
  const [loading, setLoading] = useState(editing);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [tab, setTab] = useState<'lyrics' | 'chords'>('lyrics');

  useEffect(() => {
    document.title = `${editing ? 'Edit' : 'Add'} song · GigMasterPro`;
    if (!editing) return;
    api
      .get<Song>(`/songs/${id}`)
      .then((s) =>
        setForm({
          title: s.title, artist: s.artist, album: s.album, release_date: s.release_date ?? '', key: s.key, tempo: String(s.tempo),
          duration: s.duration ? formatDuration(s.duration) : '', genre: s.genre, guitar_tuning: s.guitar_tuning, lyrics: s.lyrics ?? '',
          chords: s.chords ?? '', notes: s.notes ?? '', is_original: s.is_original, lrclib_id: null,
        }),
      )
      .catch((e) => setLoadError(errorMessage(e)))
      .finally(() => setLoading(false));
  }, [id, editing]);

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setForm((f) => ({ ...f, [k]: v }));

  const applyResult = (r: SearchResult) => {
    setForm((f) => ({
      ...f,
      title: r.title || f.title,
      artist: r.artist || f.artist,
      album: r.album || f.album,
      release_date: r.release_date || f.release_date,
      duration: r.duration ? formatDuration(r.duration) : f.duration,
      genre: r.genre || f.genre,
      key: r.key || f.key,
      tempo: r.tempo ? String(r.tempo) : f.tempo,
      lyrics: r.lyrics || f.lyrics,
      is_original: false,
      lrclib_id: r.lrclib_id,
    }));
    setErrors({});
    toast.success(`Filled in details for “${r.title}”.`);
  };

  const transpose = (steps: number) => {
    const newKey = transposeKey(form.key, steps);
    setForm((f) => ({ ...f, key: newKey, chords: transposeText(f.chords, steps, newKey), lyrics: transposeText(f.lyrics, steps, newKey) }));
  };

  const validate = (): Record<string, string> => {
    const e: Record<string, string> = {};
    if (!form.title.trim()) e.title = 'Title is required.';
    const tempo = Number(form.tempo);
    if (form.tempo && (!Number.isInteger(tempo) || tempo < 40 || tempo > 300)) e.tempo = 'Tempo must be a whole number between 40 and 300.';
    if (parseDuration(form.duration) === null) e.duration = 'Use m:ss (e.g. 3:45) or seconds.';
    return e;
  };

  const submit = async (ev: FormEvent) => {
    ev.preventDefault();
    const e = validate();
    setErrors(e);
    if (Object.keys(e).length) return;
    setSaving(true);
    const payload = { ...form, tempo: form.tempo ? Number(form.tempo) : 120, duration: parseDuration(form.duration) ?? 0, release_date: form.release_date || null };
    try {
      if (editing) await api.put(`/songs/${id}`, payload);
      else await api.post('/songs', payload);
      toast.success(editing ? 'Song updated.' : 'Song added to your repertoire.');
      navigate('/songs');
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    try {
      await api.del(`/songs/${id}`);
      toast.success('Song deleted.');
      navigate('/songs');
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };

  if (loadError) return <ErrorBanner message={loadError} />;
  if (loading) return <PageLoader />;

  return (
    <form onSubmit={submit} noValidate className="mx-auto max-w-4xl">
      <Link to="/songs" className="mb-4 inline-flex items-center gap-1 text-sm text-gray-400 hover:text-white"><ArrowLeft className="h-4 w-4" /> Songs</Link>
      <PageHeader title={editing ? 'Edit song' : 'Add a song'} icon={<Music className="h-5 w-5" />} />
      <div className="space-y-6">
        {!editing && (
          <div className="card p-5">
            <SongSearch onSelect={applyResult} />
          </div>
        )}
        <section className="card grid gap-4 p-5 sm:grid-cols-2" aria-label="Song details">
          <Field label="Title *" htmlFor="title" error={errors.title}>
            <input id="title" className="input" value={form.title} onChange={(e) => set('title', e.target.value)} maxLength={255} required />
          </Field>
          <Field label="Artist" htmlFor="artist">
            <input id="artist" className="input" value={form.artist} onChange={(e) => set('artist', e.target.value)} maxLength={255} />
          </Field>
          <Field label="Album" htmlFor="album">
            <input id="album" className="input" value={form.album} onChange={(e) => set('album', e.target.value)} maxLength={255} />
          </Field>
          <Field label="Release date" htmlFor="release_date">
            <input id="release_date" type="date" className="input" value={form.release_date} onChange={(e) => set('release_date', e.target.value)} />
          </Field>
          <div className="grid grid-cols-3 gap-3 sm:col-span-2">
            <Field label="Key" htmlFor="key">
              <select id="key" className="input" value={form.key} onChange={(e) => set('key', e.target.value)}>
                <option value="">—</option>
                {KEY_OPTIONS.map((k) => <option key={k}>{k}</option>)}
              </select>
            </Field>
            <Field label="Tempo (BPM)" htmlFor="tempo" error={errors.tempo}>
              <input id="tempo" type="number" min={40} max={300} className="input" value={form.tempo} onChange={(e) => set('tempo', e.target.value)} />
            </Field>
            <Field label="Duration" htmlFor="duration" error={errors.duration} hint="m:ss">
              <input id="duration" className="input" placeholder="3:45" value={form.duration} onChange={(e) => set('duration', e.target.value)} />
            </Field>
          </div>
          <Field label="Genre" htmlFor="genre">
            <select id="genre" className="input" value={form.genre} onChange={(e) => set('genre', e.target.value)}>
              <option value="">—</option>
              {[...new Set([...GENRES, ...(form.genre ? [form.genre] : [])])].map((g) => <option key={g}>{g}</option>)}
            </select>
          </Field>
          <Field label="Guitar tuning" htmlFor="tuning">
            <input id="tuning" className="input" list="tunings" value={form.guitar_tuning} onChange={(e) => set('guitar_tuning', e.target.value)} maxLength={100} />
            <datalist id="tunings">{TUNINGS.map((t) => <option key={t} value={t} />)}</datalist>
          </Field>
          <div className="sm:col-span-2">
            <Toggle checked={form.is_original} onChange={(v) => set('is_original', v)} label="Original song" description="Originals stay private and are not added to the shared catalog." />
          </div>
        </section>

        <section className="card p-5" aria-label="Lyrics and chords">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <div className="flex rounded-lg bg-gray-800/70 p-1 text-sm" role="tablist">
              {(['lyrics', 'chords'] as const).map((t) => (
                <button key={t} type="button" role="tab" aria-selected={tab === t} onClick={() => setTab(t)} className={`rounded-md px-4 py-1.5 font-medium capitalize ${tab === t ? 'bg-purple-600 text-white' : 'text-gray-400 hover:text-white'}`}>{t}</button>
              ))}
            </div>
            <div className="flex items-center gap-2 text-xs text-gray-400">
              Transpose
              <button type="button" className="btn-secondary btn-sm" onClick={() => transpose(-1)} aria-label="Transpose down a semitone">−1</button>
              <button type="button" className="btn-secondary btn-sm" onClick={() => transpose(1)} aria-label="Transpose up a semitone">+1</button>
            </div>
          </div>
          {tab === 'lyrics' ? (
            <textarea className="input min-h-[320px] font-mono leading-relaxed" value={form.lyrics} onChange={(e) => set('lyrics', e.target.value)} placeholder="Paste or type the lyrics…" aria-label="Lyrics" />
          ) : (
            <textarea className="input min-h-[320px] font-mono leading-relaxed" value={form.chords} onChange={(e) => set('chords', e.target.value)} placeholder={'Chord chart, e.g.\nG        C        G        D\nHey, where did we go…'} aria-label="Chords" />
          )}
          <p className="mt-2 text-xs text-gray-500">Transposing shifts the key and any chord lines or [bracketed] chords in both tabs.</p>
        </section>

        <section className="card p-5">
          <Field label="Performance notes" htmlFor="notes" hint="Cues, arrangement notes, who takes the solo…">
            <textarea id="notes" className="input min-h-[100px]" value={form.notes} onChange={(e) => set('notes', e.target.value)} />
          </Field>
        </section>

        <div className="flex flex-wrap items-center justify-between gap-3">
          {editing ? (
            <button type="button" className="btn-ghost text-red-400 hover:text-red-300" onClick={() => setConfirmDelete(true)}><Trash2 className="h-4 w-4" /> Delete</button>
          ) : <span />}
          <div className="flex gap-2">
            <Link to="/songs" className="btn-secondary">Cancel</Link>
            <button className="btn-primary" disabled={saving}>{saving ? <Spinner className="h-4 w-4 text-white" /> : <Save className="h-4 w-4" />} {editing ? 'Save changes' : 'Add song'}</button>
          </div>
        </div>
      </div>
      <ConfirmDialog open={confirmDelete} title="Delete song?" body="This removes the song from your repertoire and all setlists." onCancel={() => setConfirmDelete(false)} onConfirm={remove} />
    </form>
  );
}
