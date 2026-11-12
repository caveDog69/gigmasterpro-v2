import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Clock, FileDown, ListMusic, Pencil, Printer, Trash2 } from 'lucide-react';
import { api, errorMessage } from '../../lib/api';
import type { Setlist } from '../../lib/types';
import { formatDuration, formatTotal } from '../../lib/format';
import { exportSetlistPdf } from '../../lib/pdf';
import { useToast } from '../../contexts/ToastContext';
import { ConfirmDialog, EmptyState, ErrorBanner, PageHeader, PageLoader } from '../../components/ui';

export default function SetlistDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const [setlist, setSetlist] = useState<Setlist | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirm, setConfirm] = useState(false);

  useEffect(() => {
    api.get<Setlist>(`/setlists/${id}`).then((s) => { setSetlist(s); document.title = `${s.name} · GigMasterPro`; }).catch((e) => setError(errorMessage(e)));
  }, [id]);

  if (error) return <ErrorBanner message={error} />;
  if (!setlist) return <PageLoader />;
  const entries = setlist.songs ?? [];

  const pdf = () =>
    exportSetlistPdf(setlist.name, [setlist.description ?? '', `${entries.length} songs · ${formatTotal(setlist.duration)}`], [{ songs: entries.map((e) => ({ ...e.song, notes: e.notes || e.song.notes })) }], `${setlist.name}.pdf`).catch((e) => toast.error(errorMessage(e)));

  const remove = async () => {
    try {
      await api.del(`/setlists/${id}`);
      toast.success('Setlist deleted.');
      navigate('/setlists');
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };

  return (
    <div>
      <Link to="/setlists" className="no-print mb-4 inline-flex items-center gap-1 text-sm text-gray-400 hover:text-white"><ArrowLeft className="h-4 w-4" /> Setlists</Link>
      <PageHeader
        title={setlist.name}
        icon={<ListMusic className="h-5 w-5" />}
        subtitle={<span className="flex items-center gap-3">{setlist.description}<span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" />{entries.length} songs · {formatTotal(setlist.duration)}</span></span>}
        actions={
          <div className="no-print flex flex-wrap gap-2">
            <button className="btn-ghost" onClick={() => window.print()}><Printer className="h-4 w-4" /> Print</button>
            <button className="btn-secondary" onClick={pdf} disabled={!entries.length}><FileDown className="h-4 w-4" /> PDF</button>
            {setlist.is_owner && <Link to={`/setlists/edit/${setlist.id}`} className="btn-primary"><Pencil className="h-4 w-4" /> Edit</Link>}
            {setlist.is_owner && <button className="btn-icon hover:text-red-400" onClick={() => setConfirm(true)} aria-label="Delete setlist"><Trash2 className="h-4 w-4" /></button>}
          </div>
        }
      />
      {entries.length === 0 ? (
        <EmptyState icon={<ListMusic className="h-7 w-7" />} title="This setlist is empty" action={setlist.is_owner ? <Link to={`/setlists/edit/${setlist.id}`} className="btn-primary">Add songs</Link> : undefined} />
      ) : (
        <ol className="card divide-y divide-gray-800">
          {entries.map((e, i) => (
            <li key={e.id} className="flex items-start gap-4 px-5 py-3">
              <span className="w-6 pt-0.5 text-right text-sm text-gray-500">{i + 1}</span>
              <div className="min-w-0 flex-1">
                <p className="font-medium text-gray-100">{e.song.title} <span className="text-sm font-normal text-gray-500">{e.song.artist}</span></p>
                {(e.notes || e.song.notes) && <p className="mt-0.5 text-xs text-purple-300">{e.notes || e.song.notes}</p>}
              </div>
              <div className="flex shrink-0 gap-3 text-xs text-gray-400">
                {e.song.key && <span className="rounded bg-gray-800 px-1.5 py-0.5 text-gray-300">{e.song.key}</span>}
                <span>{e.song.tempo} BPM</span>
                <span className="w-10 text-right">{e.song.duration ? formatDuration(e.song.duration) : '—'}</span>
              </div>
            </li>
          ))}
        </ol>
      )}
      <ConfirmDialog open={confirm} title="Delete setlist?" body="The setlist will be removed from any gigs that use it. Your songs are not affected." onCancel={() => setConfirm(false)} onConfirm={remove} />
    </div>
  );
}
