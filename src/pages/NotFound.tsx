import { Link } from 'react-router-dom';
import { Compass } from 'lucide-react';
import { EmptyState } from '../components/ui';

export default function NotFound() {
  return (
    <EmptyState
      icon={<Compass className="h-7 w-7" />}
      title="Page not found"
      body="That page doesn't exist or you don't have access to it."
      action={<Link to="/dashboard" className="btn-primary">Back to dashboard</Link>}
    />
  );
}
