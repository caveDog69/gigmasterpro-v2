import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowDownAZ, Download, FileText, Guitar, Music, Pencil, Plus, Search, Trash2, Upload } from 'lucide-react';
import { api, downloadFile, errorMessage } from '../../lib/api';
import type { Song } from '../../lib/types';
import { formatDuration } from '../../lib/format';
import { useToast } from '../../contexts/ToastContext';
import { ConfirmDialog, EmptyState, ErrorBanner, PageHeader, PageLoader } from '../../components/ui';

type SortKey = 'title' | 'artist' | 'created_at' | 'key';

export default function SongsList() {
  const toast = useToast();
  const [songs, setSongs] = useState<Song[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [genre, setGenre] = useState('');
  const [sort, setSort] = useState<SortKey>('title');
  const [toDelete, setToDelete] = useState<Song | null>(null);
  const [busy, setBusy] = useState(false);

  const load = () => {
    setError(null);
    api.get<Song[]>('/songs').then(setSongs).catch((e) => setError(errorMessage(e)));
  };
  useEffect(() => {
    document.title = 'Songs · GigMasterPro';
    load();
  }, []);

  const genres = useMemo(() => Array.from(new Set((songs ?? []).map((s) => s.genre).filter(Boolean))).sort(), [songs]);
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (songs ?? [])
      .filter((s) => (!genre || s.genre === genre) && (!q || [s.title, s.artist, s.album, s.genre].some((v) => v?.toLowerCase().includes(q))))
      .sort((a, b) => (sort === 'created_at' ? b.created_at.localeCompare(a.created_at) : String(a[sort] || '').localeCompare(String(b[sort] || ''), undefined, { sensitivity: 'base' })));
  }, [songs, search, genre, sort]);

  const remove = async () => {
    if (!toDelete) return;
    setBusy(true);
    try {
      await api.del(`/songs/${toDelete.id}`);
      setSongs((list) => list?.filter((s) => s.id !== toDelete.id) ?? null);
      toast.success(`Deleted “${toDelete.title}”.`);
      setToDelete(null);
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  if (error) return <ErrorBanner message={error} onRetry={load} />;
  if (!songs) return <PageLoader />;

  return (
    <div>
      <PageHeader
        title="Songs"
        icon={<Music className="h-5 w-5" />}
        subtitle={`${songs.length} song${songs.length === 1 ? '' : 's'} in your repertoire`}
        actions={
          <>
            <button className="btn-ghost" onClick={() => downloadFile('/export/songs.csv', 'songs.csv').catch((e) => toast.error(errorMessage(e)))} disabled={!songs.length}>
              <Download className="h-4 w-4" /> CSV
            </button>
            <Link to="/songs/import" className="btn-secondary"><Upload className="h-4 w-4" /> Import</Link>
            <Link to="/songs/new" className="btn-primary"><Plus className="h-4 w-4" /> Add song</Link>
          </>
        }
      />
      {songs.length === 0 ? (
        <EmptyState
          icon={<Music className="h-7 w-7" />}
          title="Build your repertoire"
          body="Add songs one at a time with catalog search, or import a whole list from a spreadsheet."
          action={<div className="flex gap-2"><Link to="/songs/new" className="btn-primary"><Plus className="h-4 w-4" /> Add song</Link><Link to="/songs/import" className="btn-secondary"><Upload className="h-4 w-4" /> Import list</Link></div>}
        />
      ) : (
        <>
          <div className="mb-4 flex flex-col gap-3 sm:flex-row">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
              <input className="input pl-9" placeholder="Search title, artist, album…" value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Search songs" />
            </div>
            <select className="input sm:w-44" value={genre} onChange={(e) => setGenre(e.target.value)} aria-label="Filter by genre">
              <option value="">All genres</option>
              {genres.map((g) => <option key={g}>{g}</option>)}
            </select>
            <div className="relative sm:w-44">
              <ArrowDownAZ className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
              <select className="input pl-9" value={sort} onChange={(e) => setSort(e.target.value as SortKey)} aria-label="Sort songs">
                <option value="title">Title</option>
                <option value="artist">Artist</option>
                <option value="key">Key</option>
                <option value="created_at">Recently added</option>
              </select>
            </div>
          </div>
          <div className="card overflow-hidden">
            <table className="w-full text-sm">
              <thead className="hidden border-b border-gray-800 bg-gray-900/50 text-left text-xs uppercase tracking-wider text-gray-500 md:table-header-group">
                <tr>
                  <th className="px-4 py-3 font-medium">Song</th>
                  <th className="px-4 py-3 font-medium">Key</th>
                  <th className="px-4 py-3 font-medium">BPM</th>
                  <th className="px-4 py-3 font-medium">Length</th>
                  <th className="px-4 py-3 font-medium">Genre</th>
                  <th className="px-4 py-3"><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {filtered.map((s) => (
                  <tr key={s.id} className="group transition hover:bg-gray-800/40">
                    <td className="px-4 py-3">
                      <Link to={`/songs/edit/${s.id}`} className="block">
                        <span className="flex items-center gap-2 font-medium text-gray-100">
                          {s.title}
                          {s.is_original && <span className="chip bg-amber-500/15 text-amber-300 ring-amber-500/30">Original</span>}
                        </span>
                        <span className="block text-xs text-gray-500">{s.artist}{s.album ? ` · ${s.album}` : ''}</span>
                        <span className="mt-1 flex gap-3 text-xs text-gray-400 md:hidden">
                          {s.key && <span>{s.key}</span>}<span>{s.tempo} BPM</span><span>{formatDuration(s.duration)}</span>
                        </span>
                      </Link>
                    </td>
                    <td className="hidden px-4 py-3 text-gray-300 md:table-cell">{s.key || '—'}</td>
                    <td className="hidden px-4 py-3 text-gray-300 md:table-cell">{s.tempo}</td>
                    <td className="hidden px-4 py-3 text-gray-300 md:table-cell">{s.duration ? formatDuration(s.duration) : '—'}</td>
                    <td className="hidden px-4 py-3 text-gray-400 md:table-cell">{s.genre || '—'}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        {s.has_lyrics && <span title="Has lyrics"><FileText className="h-4 w-4 text-gray-500" /></span>}
                        {s.has_chords && <span title="Has chords"><Guitar className="h-4 w-4 text-gray-500" /></span>}
                        <Link to={`/songs/edit/${s.id}`} className="btn-icon" aria-label={`Edit ${s.title}`}><Pencil className="h-4 w-4" /></Link>
                        <button className="btn-icon hover:text-red-400" onClick={() => setToDelete(s)} aria-label={`Delete ${s.title}`}><Trash2 className="h-4 w-4" /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filtered.length === 0 && <p className="px-4 py-10 text-center text-sm text-gray-500">No songs match your filters.</p>}
          </div>
        </>
      )}
      <ConfirmDialog
        open={!!toDelete}
        title="Delete song?"
        body={<>“{toDelete?.title}” will be removed from your repertoire and from any setlists that include it.</>}
        onCancel={() => setToDelete(null)}
        onConfirm={remove}
        busy={busy}
      />
    </div>
  );
}
