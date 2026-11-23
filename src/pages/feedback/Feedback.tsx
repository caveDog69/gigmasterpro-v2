import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { MessageSquare, Send } from 'lucide-react';
import { useToast } from '../../contexts/ToastContext';
import { api, errorMessage } from '../../lib/api';
import { FEEDBACK_STATUS_STYLES } from '../../lib/constants';
import { cx, relativeTime } from '../../lib/format';
import type { Feedback as FeedbackItem } from '../../lib/types';
import { EmptyState, ErrorBanner, Field, PageHeader, PageLoader, Spinner } from '../../components/ui';

const MESSAGE_MAX = 5000;

export default function Feedback() {
  const toast = useToast();
  const [items, setItems] = useState<FeedbackItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => { document.title = 'Feedback · GigMasterPro'; }, []);

  const load = useCallback(() => {
    setError(null);
    return api.get<FeedbackItem[]>('/feedback').then(setItems).catch((e) => setError(errorMessage(e)));
  }, []);
  useEffect(() => { load(); }, [load]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setFormError(null);
    if (!message.trim()) {
      setFormError('Please enter your feedback.');
      return;
    }
    setSending(true);
    try {
      const created = await api.post<FeedbackItem>('/feedback', { subject: subject.trim(), message: message.trim() });
      setItems((list) => [created, ...(list ?? [])]);
      setSubject('');
      setMessage('');
      toast.success('Thanks! Your feedback was sent to the GigMasterPro team.');
    } catch (err) {
      setFormError(errorMessage(err));
    } finally {
      setSending(false);
    }
  };

  return (
    <div>
      <PageHeader title="Feedback" icon={<MessageSquare className="h-5 w-5" />} subtitle="Found a bug or have an idea? Tell us. Every message is read by the GigMasterPro team." />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        <section className="card p-5 lg:col-span-2" aria-labelledby="feedback-form-heading">
          <h2 id="feedback-form-heading" className="font-semibold text-white">Send feedback</h2>
          <form className="mt-4 space-y-4" onSubmit={submit} noValidate>
            <Field label="Subject (optional)" htmlFor="feedback-subject">
              <input id="feedback-subject" className="input" value={subject} onChange={(e) => setSubject(e.target.value)} maxLength={191} placeholder="e.g. Setlist PDF export" autoComplete="off" />
            </Field>
            <Field label="Message" htmlFor="feedback-message" hint={`${message.length}/${MESSAGE_MAX}`}>
              <textarea id="feedback-message" className="input min-h-[160px]" value={message} onChange={(e) => setMessage(e.target.value)} maxLength={MESSAGE_MAX} required placeholder="What happened, or what would make GigMasterPro better for you?" />
            </Field>
            {formError && <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200" role="alert">{formError}</p>}
            <button type="submit" className="btn-primary w-full" disabled={sending || !message.trim()}>
              {sending ? <Spinner className="h-4 w-4 text-white" /> : <Send className="h-4 w-4" />} Send feedback
            </button>
          </form>
        </section>

        <section className="card lg:col-span-3" aria-labelledby="feedback-list-heading">
          <h2 id="feedback-list-heading" className="border-b border-gray-800 px-5 py-4 font-semibold text-white">Your feedback{items ? ` (${items.length})` : ''}</h2>
          {error ? (
            <div className="p-5"><ErrorBanner message={error} onRetry={load} /></div>
          ) : !items ? (
            <PageLoader />
          ) : items.length === 0 ? (
            <div className="p-5"><EmptyState icon={<MessageSquare className="h-7 w-7" />} title="No feedback yet" body="Messages you send show up here, along with their status." /></div>
          ) : (
            <ul className="divide-y divide-gray-800">
              {items.map((f) => {
                const st = FEEDBACK_STATUS_STYLES[f.status];
                return (
                  <li key={f.id} className="px-5 py-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="min-w-0 truncate font-medium text-white">{f.subject || 'No subject'}</p>
                      <span className={cx('rounded-full px-2.5 py-0.5 text-xs font-medium', st.className)}>{st.label}</span>
                    </div>
                    <p className="mt-1 whitespace-pre-wrap break-words text-sm text-gray-300">{f.message}</p>
                    <p className="mt-1 text-xs text-gray-500">Sent {relativeTime(f.created_at)}</p>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
