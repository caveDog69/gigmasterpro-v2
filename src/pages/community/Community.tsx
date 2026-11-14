import { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { MessageSquare, UserPlus, Users } from 'lucide-react';
import { useNotifications } from '../../contexts/NotificationsContext';
import { PageHeader } from '../../components/ui';
import { cx } from '../../lib/format';
import Discover from './Discover';
import Connections from './Connections';
import Messages from './Messages';

type Tab = 'discover' | 'requests' | 'messages';

export default function Community() {
  const [params, setParams] = useSearchParams();
  const tab = (params.get('tab') as Tab) || 'discover';
  const { summary } = useNotifications();
  useEffect(() => { document.title = 'Community · GigMasterPro'; }, []);

  const tabs: { id: Tab; label: string; icon: typeof Users; badge?: number }[] = [
    { id: 'discover', label: 'Discover', icon: Users },
    { id: 'requests', label: 'Connections', icon: UserPlus, badge: summary.pending_connections },
    { id: 'messages', label: 'Messages', icon: MessageSquare, badge: summary.unread_messages },
  ];

  return (
    <div>
      <PageHeader title="Community" icon={<Users className="h-5 w-5" />} subtitle="Find musicians near you, connect and chat." />
      <div className="mb-6 flex gap-1 border-b border-gray-800" role="tablist">
        {tabs.map(({ id, label, icon: Icon, badge }) => (
          <button
            key={id}
            role="tab"
            aria-selected={tab === id}
            onClick={() => setParams(id === 'discover' ? {} : { tab: id })}
            className={cx('-mb-px flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-medium transition', tab === id ? 'border-purple-500 text-white' : 'border-transparent text-gray-400 hover:text-gray-200')}
          >
            <Icon className="h-4 w-4" /> {label}
            {!!badge && <span className="rounded-full bg-purple-600 px-1.5 text-[11px] text-white">{badge}</span>}
          </button>
        ))}
      </div>
      {tab === 'discover' && <Discover />}
      {tab === 'requests' && <Connections />}
      {tab === 'messages' && <Messages />}
    </div>
  );
}
