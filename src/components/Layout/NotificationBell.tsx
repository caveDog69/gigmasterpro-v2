import { useEffect, useRef, useState } from 'react';
import { Bell, CheckCheck } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../lib/api';
import type { AppNotification } from '../../lib/types';
import { useNotifications } from '../../contexts/NotificationsContext';
import { relativeTime, cx } from '../../lib/format';
import { Avatar, Spinner } from '../ui';

export default function NotificationBell() {
  const { summary, refresh } = useNotifications();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<AppNotification[] | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (!open) return;
    api.get<AppNotification[]>('/notifications').then(setItems).catch(() => setItems([]));
    const close = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setOpen(false);
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open, summary.latest_notification_id]);

  const openItem = async (n: AppNotification) => {
    setOpen(false);
    if (!n.is_read) await api.put(`/notifications/${n.id}/read`).catch(() => undefined);
    refresh();
    if (n.link) navigate(n.link);
  };

  const markAll = async () => {
    await api.put('/notifications/read-all').catch(() => undefined);
    setItems((list) => list?.map((n) => ({ ...n, is_read: true })) ?? null);
    refresh();
  };

  return (
    <div className="relative" ref={ref}>
      <button className="btn-icon relative" onClick={() => setOpen((o) => !o)} aria-label={`Notifications (${summary.unread_notifications} unread)`}>
        <Bell className="h-5 w-5" />
        {summary.unread_notifications > 0 && (
          <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-purple-500 px-1 text-[10px] font-bold text-white">
            {summary.unread_notifications > 9 ? '9+' : summary.unread_notifications}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute right-0 z-40 mt-2 w-80 animate-slide-in overflow-hidden rounded-xl border border-gray-700 bg-gray-900 shadow-2xl">
          <div className="flex items-center justify-between border-b border-gray-800 px-4 py-3">
            <span className="text-sm font-semibold text-white">Notifications</span>
            <button className="flex items-center gap-1 text-xs text-purple-300 hover:text-purple-200" onClick={markAll}>
              <CheckCheck className="h-3.5 w-3.5" /> Mark all read
            </button>
          </div>
          <div className="scrollbar-thin max-h-96 overflow-y-auto">
            {items === null ? (
              <div className="flex justify-center py-8"><Spinner /></div>
            ) : items.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-gray-500">You're all caught up.</p>
            ) : (
              items.map((n) => (
                <button key={n.id} onClick={() => openItem(n)} className={cx('flex w-full gap-3 px-4 py-3 text-left transition hover:bg-gray-800', !n.is_read && 'bg-purple-500/5')}>
                  <Avatar name={n.actor?.display_name ?? 'GigMasterPro'} url={n.actor?.avatar_url} size="sm" />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm text-gray-100">{n.title}</span>
                    {n.body && <span className="block truncate text-xs text-gray-400">{n.body}</span>}
                    <span className="block text-[11px] text-gray-500">{relativeTime(n.created_at)}</span>
                  </span>
                  {!n.is_read && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-purple-400" />}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
