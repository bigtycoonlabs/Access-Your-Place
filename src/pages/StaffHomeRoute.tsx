import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import StaffHome from './StaffHome';

/**
 * Route wrapper for the Success Team home.
 *
 * Exists so StaffHome stays a pure component that takes a session, while the session
 * loading and the sign-in redirect live here.
 *
 * The session is read from the same key the rest of the staff app uses. Reading it from a
 * different place is how one screen decides you are signed out while the next thinks you
 * are signed in.
 */
export default function StaffHomeRoute() {
  const navigate = useNavigate();
  const [session, setSession] = useState<any>(null);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem('staffSession');
      const parsed = raw ? JSON.parse(raw) : null;
      if (!parsed?.id) {
        navigate('/staff/login', { replace: true });
        return;
      }
      setSession(parsed);
    } catch {
      navigate('/staff/login', { replace: true });
      return;
    }
    setChecked(true);
  }, [navigate]);

  if (!checked || !session) {
    return (
      <main id="main-content" className="mx-auto max-w-[1200px] px-4 py-10">
        <p role="status" aria-live="polite" className="text-slate-600">
          Loading your day…
        </p>
      </main>
    );
  }

  return (
    <main id="main-content">
      <StaffHome staffSession={session} />
    </main>
  );
}
