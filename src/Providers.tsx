import type { ReactNode } from 'react';
import { AuthProvider } from './contexts/AuthContext';
import { InactivityProvider } from './contexts/InactivityContext';
import { NotificationsProvider } from './contexts/NotificationsContext';
import { ToastProvider } from './contexts/ToastContext';

export default function Providers({ children }: { children: ReactNode }) {
  return (
    <ToastProvider>
      <AuthProvider>
        <InactivityProvider>
          <NotificationsProvider>{children}</NotificationsProvider>
        </InactivityProvider>
      </AuthProvider>
    </ToastProvider>
  );
}
