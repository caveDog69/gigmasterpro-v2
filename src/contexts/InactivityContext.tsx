import { useEffect, useRef, type ReactNode } from 'react';
import { useAuth } from './AuthContext';
import { useToast } from './ToastContext';

const TIMEOUT_MS = 20 * 60 * 1000;
const WARNING_MS = 60 * 1000;
const EVENTS = ['mousedown', 'mousemove', 'keydown', 'scroll', 'touchstart', 'click', 'wheel'] as const;
const LAST_ACTIVE_KEY = 'gmp_last_active';

/** Signs the user out after 20 minutes without interaction (tracked across tabs). */
export function InactivityProvider({ children }: { children: ReactNode }) {
  const { user, signOut } = useAuth();
  const toast = useToast();
  const warned = useRef(false);

  useEffect(() => {
    if (!user) return;
    let lastWrite = 0;
    const markActive = () => {
      const now = Date.now();
      warned.current = false;
      if (now - lastWrite > 5000) {
        lastWrite = now;
        try {
          localStorage.setItem(LAST_ACTIVE_KEY, String(now));
        } catch {
          /* ignore */
        }
      }
    };
    markActive();
    EVENTS.forEach((e) => window.addEventListener(e, markActive, { passive: true }));
    const interval = setInterval(() => {
      let last = Date.now();
      try {
        last = Number(localStorage.getItem(LAST_ACTIVE_KEY)) || last;
      } catch {
        /* ignore */
      }
      const idle = Date.now() - last;
      if (idle >= TIMEOUT_MS) {
        signOut('You were signed out after 20 minutes of inactivity.');
        toast.info('You were signed out after 20 minutes of inactivity.', 8000);
      } else if (idle >= TIMEOUT_MS - WARNING_MS && !warned.current) {
        warned.current = true;
        toast.info('You will be signed out in 1 minute due to inactivity. Move the mouse or press a key to stay signed in.', 10000);
      }
    }, 10000);
    return () => {
      EVENTS.forEach((e) => window.removeEventListener(e, markActive));
      clearInterval(interval);
    };
  }, [user, signOut, toast]);

  return <>{children}</>;
}
