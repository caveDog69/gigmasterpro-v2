import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ArrowLeft, MessageSquare, RotateCcw, Send } from 'lucide-react';
import { api, errorMessage } from '../../lib/api';
import type { Conversation, Message } from '../../lib/types';
import { relativeTime, cx } from '../../lib/format';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { useNotifications } from '../../contexts/NotificationsContext';
import { Avatar, EmptyState, ErrorBanner, PageLoader } from '../../components/ui';

const LIST_POLL = 8000;
const THREAD_POLL = 5000;

export default function Messages() {
  const { user } = useAuth();
  const toast = useToast();
  const { refresh } = useNotifications();
  const [params, setParams] = useSearchParams();
  const [convos, setConvos] = useState<Conversation[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeId, setActiveId] = useState<number | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loadingThread, setLoadingThread] = useState(false);
  const [draft, setDraft] = useState('');
  const bottom = useRef<HTMLDivElement>(null);
  const lastId = useRef(0);
  const tempId = useRef(-1);

  const loadConvos = useCallback(() => api.get<Conversation[]>('/conversations').then(setConvos).catch((e) => setError(errorMessage(e))), []);

  useEffect(() => {
    loadConvos();
    const t = setInterval(() => document.visibilityState === 'visible' && loadConvos(), LIST_POLL);
    return () => clearInterval(t);
  }, [loadConvos]);

  useEffect(() => {
    const withUser = Number(params.get('with'));
    if (!withUser) return;
    api.post<Conversation>('/conversations', { user_id: withUser })
      .then((c) => {
        setConvos((list) => (list?.some((x) => x.id === c.id) ? list : [c, ...(list ?? [])]));
        setActiveId(c.id);
        setParams({ tab: 'messages' }, { replace: true });
      })
      .catch((e) => toast.error(errorMessage(e)));
  }, [params, setParams, toast]);

  const markRead = useCallback((id: number) => {
    api.put(`/conversations/${id}/read`).then(() => {
      setConvos((l) => l?.map((c) => (c.id === id ? { ...c, unread_count: 0 } : c)) ?? null);
      refresh();
    }).catch(() => undefined);
  }, [refresh]);

  useEffect(() => {
    if (!activeId) return;
    setLoadingThread(true);
    setMessages([]);
    lastId.current = 0;
    api.get<Message[]>(`/conversations/${activeId}/messages`)
      .then((m) => { setMessages(m); lastId.current = m.at(-1)?.id ?? 0; markRead(activeId); })
      .catch((e) => toast.error(errorMessage(e)))
      .finally(() => setLoadingThread(false));
    const t = setInterval(() => {
      if (document.visibilityState !== 'visible') return;
      api.get<Message[]>(`/conversations/${activeId}/messages?after_id=${lastId.current}`).then((m) => {
        if (!m.length) return;
        lastId.current = m.at(-1)!.id;
        setMessages((cur) => [...cur.filter((x) => !m.some((n) => n.id === x.id)), ...m]);
        if (m.some((x) => x.sender_id !== user?.id)) markRead(activeId);
      }).catch(() => undefined);
    }, THREAD_POLL);
    return () => clearInterval(t);
  }, [activeId, markRead, toast, user?.id]);

  useEffect(() => { bottom.current?.scrollIntoView({ block: 'end' }); }, [messages.length]);

  const send = async (content: string, retryOf?: number) => {
    if (!activeId || !user) return;
    const tid = retryOf ?? tempId.current--;
    const optimistic: Message = { id: tid, conversation_id: activeId, sender_id: user.id, content, is_read: false, created_at: new Date().toISOString(), pending: true };
    setMessages((m) => (retryOf ? m.map((x) => (x.id === tid ? optimistic : x)) : [...m, optimistic]));
    try {
      const saved = await api.post<Message>(`/conversations/${activeId}/messages`, { content });
      lastId.current = Math.max(lastId.current, saved.id);
      setMessages((m) => m.filter((x) => x.id !== saved.id).map((x) => (x.id === tid ? saved : x)));
      setConvos((l) => l?.map((c) => (c.id === activeId ? { ...c, last_message_content: content, last_message_at: saved.created_at, last_message_sender_id: user.id } : c)).sort((a, b) => b.last_message_at.localeCompare(a.last_message_at)) ?? null);
    } catch (e) {
      setMessages((m) => m.map((x) => (x.id === tid ? { ...x, pending: false, failed: true } : x)));
      toast.error(errorMessage(e));
    }
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const c = draft.trim();
    if (!c) return;
    setDraft('');
    send(c);
  };

  if (error) return <ErrorBanner message={error} />;
  if (!convos) return <PageLoader />;
  const active = convos.find((c) => c.id === activeId);

  if (!convos.length && !activeId) return <EmptyState icon={<MessageSquare className="h-7 w-7" />} title="No conversations yet" body="Connect with a musician, then send them a message." />;

  return (
    <div className="card flex h-[calc(100vh-16rem)] min-h-[420px] overflow-hidden">
      <aside className={cx('w-full shrink-0 border-r border-gray-800 md:w-80', active && 'hidden md:block')}>
        <ul className="scrollbar-thin h-full divide-y divide-gray-800 overflow-y-auto">
          {convos.map((c) => (
            <li key={c.id}>
              <button onClick={() => setActiveId(c.id)} className={cx('flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-gray-800/50', c.id === activeId && 'bg-purple-600/10')}>
                <Avatar name={c.other_participant.display_name} url={c.other_participant.avatar_url} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <p className={cx('truncate text-sm', c.unread_count ? 'font-semibold text-white' : 'text-gray-200')}>{c.other_participant.display_name}</p>
                    <span className="shrink-0 text-[11px] text-gray-500">{relativeTime(c.last_message_at)}</span>
                  </div>
                  <p className="truncate text-xs text-gray-500">{c.last_message_sender_id === user?.id ? 'You: ' : ''}{c.last_message_content || 'No messages yet'}</p>
                </div>
                {c.unread_count > 0 && <span className="rounded-full bg-purple-600 px-1.5 text-[11px] text-white">{c.unread_count}</span>}
              </button>
            </li>
          ))}
        </ul>
      </aside>
      <section className={cx('flex min-w-0 flex-1 flex-col', !active && 'hidden md:flex')}>
        {!active ? (
          <div className="flex flex-1 items-center justify-center text-sm text-gray-500">Select a conversation</div>
        ) : (
          <>
            <header className="flex items-center gap-3 border-b border-gray-800 px-4 py-3">
              <button className="btn-icon md:hidden" onClick={() => setActiveId(null)} aria-label="Back to conversations"><ArrowLeft className="h-5 w-5" /></button>
              <Avatar name={active.other_participant.display_name} url={active.other_participant.avatar_url} size="sm" />
              <div className="min-w-0">
                <p className="truncate font-medium text-white">{active.other_participant.display_name}</p>
                <p className="truncate text-xs text-gray-500">@{active.other_participant.username}</p>
              </div>
            </header>
            <div className="scrollbar-thin flex-1 space-y-2 overflow-y-auto px-4 py-4">
              {loadingThread && <PageLoader />}
              {!loadingThread && messages.length === 0 && <p className="py-10 text-center text-sm text-gray-500">Say hi to {active.other_participant.display_name}!</p>}
              {messages.map((m) => {
                const mine = m.sender_id === user?.id;
                return (
                  <div key={m.id} className={cx('flex', mine ? 'justify-end' : 'justify-start')}>
                    <div className={cx('max-w-[75%] rounded-2xl px-3.5 py-2 text-sm', mine ? 'rounded-br-sm bg-purple-600 text-white' : 'rounded-bl-sm bg-gray-800 text-gray-100', m.pending && 'opacity-60', m.failed && 'bg-red-900/60')}>
                      <p className="whitespace-pre-wrap break-words">{m.content}</p>
                      <p className={cx('mt-0.5 text-right text-[10px]', mine ? 'text-purple-200' : 'text-gray-500')}>
                        {m.failed ? (
                          <button className="inline-flex items-center gap-1 underline" onClick={() => send(m.content, m.id)}><RotateCcw className="h-3 w-3" /> Failed, retry</button>
                        ) : m.pending ? 'Sending…' : `${relativeTime(m.created_at)}${mine && m.is_read ? ' · Read' : ''}`}
                      </p>
                    </div>
                  </div>
                );
              })}
              <div ref={bottom} />
            </div>
            <form onSubmit={submit} className="flex items-end gap-2 border-t border-gray-800 p-3">
              <textarea
                className="input max-h-32 min-h-[42px] flex-1 resize-none"
                rows={1}
                placeholder="Write a message…"
                value={draft}
                maxLength={5000}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit(e); } }}
                aria-label="Message"
              />
              <button className="btn-primary h-[42px]" disabled={!draft.trim()} aria-label="Send"><Send className="h-4 w-4" /></button>
            </form>
          </>
        )}
      </section>
    </div>
  );
}
