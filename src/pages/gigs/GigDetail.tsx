import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, CalendarPlus, Clock, DollarSign, FileDown, MapPin, Pencil, PlayCircle, Printer, Timer, Trash2, Truck } from 'lucide-react';
import { api, downloadFile, errorMessage } from '../../lib/api';
import type { Gig } from '../../lib/types';
import { formatDate, formatDuration, formatMoney, formatTime, formatTotal } from '../../lib/format';
import { exportSetlistPdf } from '../../lib/pdf';
import { useToast } from '../../contexts/ToastContext';
import { ConfirmDialog, ErrorBanner, PageLoader, StatusBadge } from '../../components/ui';

export default function GigDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const [gig, setGig] = useState<Gig | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirm, setConfirm] = useState(false);

  useEffect(() => {
    api.get<Gig>(`/gigs/${id}`).then((g) => { setGig(g); document.title = `${g.name} · GigMasterPro`; }).catch((e) => setError(errorMessage(e)));
  }, [id]);

  if (error) return <ErrorBanner message={error} />;
  if (!gig) return <PageLoader />;
  const links = gig.setlists ?? [];
  const allSongs = links.flatMap((l) => l.setlist.songs);
  const total = allSongs.reduce((s, e) => s + (e.song.duration || 0), 0);
  const where = [gig.venue, gig.location].filter(Boolean).join(', ');

  const pdf = () =>
    exportSetlistPdf(
      gig.name,
      [`${formatDate(gig.date_time, { weekday: 'long' })} · ${formatTime(gig.date_time)}`, where, gig.load_in_time ? `Load-in ${formatTime(gig.load_in_time)}` : ''],
      links.map((l) => ({ heading: l.setlist.name, songs: l.setlist.songs.map((e) => ({ ...e.song, notes: e.notes || e.song.notes })) })),
      `${gig.name}.pdf`,
    ).catch((e) => toast.error(errorMessage(e)));

  const remove = async () => {
    try {
      await api.del(`/gigs/${id}`);
      toast.success('Gig deleted.');
      navigate('/gigs');
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };

  const info = [
    { icon: Clock, label: 'When', value: `${formatDate(gig.date_time, { weekday: 'long' })} at ${formatTime(gig.date_time)}` },
    gig.load_in_time && { icon: Truck, label: 'Load-in', value: formatTime(gig.load_in_time) },
    where && { icon: MapPin, label: 'Where', value: where, href: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(where)}` },
    gig.duration > 0 && { icon: Timer, label: 'Length', value: `${gig.duration} min` },
    gig.payment !== null && { icon: DollarSign, label: 'Pay', value: formatMoney(gig.payment) },
  ].filter(Boolean) as { icon: typeof Clock; label: string; value: string; href?: string }[];

  return (
    <div className="print-plain">
      <Link to="/gigs" className="no-print mb-4 inline-flex items-center gap-1 text-sm text-gray-400 hover:text-white"><ArrowLeft className="h-4 w-4" /> Gigs</Link>
      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-bold text-white sm:text-3xl">{gig.name}</h1>
            <StatusBadge status={gig.status} />
          </div>
        </div>
        <div className="no-print flex flex-wrap gap-2">
          <Link to={`/gigs/${gig.id}/play`} className="btn-primary"><PlayCircle className="h-4 w-4" /> Play Mode</Link>
          <button className="btn-secondary" onClick={() => window.print()}><Printer className="h-4 w-4" /> Print</button>
          <button className="btn-secondary" onClick={pdf} disabled={!allSongs.length}><FileDown className="h-4 w-4" /> PDF</button>
          <button className="btn-secondary" onClick={() => downloadFile(`/gigs/${gig.id}/calendar.ics`, `${gig.name}.ics`).catch((e) => toast.error(errorMessage(e)))}><CalendarPlus className="h-4 w-4" /> Add to calendar</button>
          {gig.is_owner && <Link to={`/gigs/edit/${gig.id}`} className="btn-secondary"><Pencil className="h-4 w-4" /> Edit</Link>}
          {gig.is_owner && <button className="btn-icon hover:text-red-400" onClick={() => setConfirm(true)} aria-label="Delete gig"><Trash2 className="h-4 w-4" /></button>}
        </div>
      </div>
      <div className="grid gap-6 lg:grid-cols-3">
        <aside className="card h-fit space-y-4 p-5">
          {info.map(({ icon: Icon, label, value, href }) => (
            <div key={label} className="flex gap-3">
              <Icon className="mt-0.5 h-4 w-4 shrink-0 text-purple-400" />
              <div>
                <p className="text-xs uppercase tracking-wider text-gray-500">{label}</p>
                {href ? <a href={href} target="_blank" rel="noopener noreferrer" className="link text-sm">{value}</a> : <p className="text-sm text-gray-100">{value}</p>}
              </div>
            </div>
          ))}
          {gig.notes && (
            <div className="border-t border-gray-800 pt-4">
              <p className="text-xs uppercase tracking-wider text-gray-500">Notes</p>
              <p className="mt-1 whitespace-pre-wrap text-sm text-gray-300">{gig.notes}</p>
            </div>
          )}
        </aside>
        <section className="space-y-4 lg:col-span-2">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-white">Setlists</h2>
            <span className="text-sm text-gray-400">{allSongs.length} songs · {formatTotal(total)}</span>
          </div>
          {links.length === 0 && (
            <div className="card px-5 py-10 text-center text-sm text-gray-400">No setlists attached. {gig.is_owner && <Link to={`/gigs/edit/${gig.id}`} className="link">Add one</Link>}</div>
          )}
          {links.map((l) => (
            <div key={l.id} className="card overflow-hidden">
              <div className="flex items-center justify-between border-b border-gray-800 bg-gray-900/50 px-5 py-3">
                <Link to={`/setlists/${l.setlist_id}`} className="font-medium text-white hover:text-purple-200">{l.setlist.name}</Link>
                <span className="text-xs text-gray-400">{l.setlist.songs.length} songs · {formatTotal(l.setlist.songs.reduce((s, e) => s + (e.song.duration || 0), 0))}</span>
              </div>
              <ol className="divide-y divide-gray-800">
                {l.setlist.songs.map((e, i) => (
                  <li key={e.id} className="flex items-start gap-4 px-5 py-2.5 text-sm">
                    <span className="w-5 text-right text-gray-500">{i + 1}</span>
                    <div className="min-w-0 flex-1">
                      <span className="text-gray-100">{e.song.title}</span> <span className="text-xs text-gray-500">{e.song.artist}</span>
                      {(e.notes || e.song.notes) && <p className="text-xs text-purple-300">{e.notes || e.song.notes}</p>}
                    </div>
                    <span className="text-xs text-gray-400">{[e.song.key, `${e.song.tempo} BPM`, e.song.duration ? formatDuration(e.song.duration) : ''].filter(Boolean).join(' · ')}</span>
                  </li>
                ))}
              </ol>
            </div>
          ))}
        </section>
      </div>
      <ConfirmDialog open={confirm} title="Delete gig?" body="This permanently deletes the gig. Setlists and songs are kept." onCancel={() => setConfirm(false)} onConfirm={remove} />
    </div>
  );
}
