import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { api } from '../lib/api';
import type { NotificationSummary } from '../lib/types';
import { useAuth } from './AuthContext';
import { useToast } from './ToastContext';

const POLL_MS = 8000;
const EMPTY: NotificationSummary = { unread_notifications: 0, unread_messages: 0, pending_connections: 0, pending_band_invitations: 0, latest_notification_id: 0 };

interface NotificationsState {
  summary: NotificationSummary;
  refresh: () => Promise<void>;
}

const NotificationsContext = createContext<NotificationsState>({ summary: EMPTY, refresh: async () => undefined });

/** Polls the notification summary every 8s while the tab is visible (replaces Supabase realtime). */
export function NotificationsProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const toast = useToast();
  const [summary, setSummary] = useState<NotificationSummary>(EMPTY);
  const latestSeen = useRef<number | null>(null);

  const refresh = useCallback(async () => {
    try {
      const s = await api.get<NotificationSummary>('/notifications/summary');
      setSummary(s);
      if (latestSeen.current !== null && s.latest_notification_id > latestSeen.current && s.unread_notifications > 0) {
        const items = await api.get<{ id: number; title: string; is_read: boolean }[]>('/notifications');
        const prev = latestSeen.current;
        items.filter((n) => n.id > prev && !n.is_read).slice(0, 2).forEach((n) => toast.info(n.title));
      }
      latestSeen.current = s.latest_notification_id;
    } catch {
      /* transient polling failure */
    }
  }, [toast]);

  useEffect(() => {
    if (!user) {
      setSummary(EMPTY);
      latestSeen.current = null;
      return;
    }
    refresh();
    const id = setInterval(() => {
      if (document.visibilityState === 'visible') refresh();
    }, POLL_MS);
    const onVisible = () => document.visibilityState === 'visible' && refresh();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [user, refresh]);

  return <NotificationsContext.Provider value={{ summary, refresh }}>{children}</NotificationsContext.Provider>;
}

export const useNotifications = () => useContext(NotificationsContext);
