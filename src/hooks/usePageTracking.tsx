import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { trackPageview } from '@/lib/analytics';

/**
 * Fires a pageview event whenever the React Router location changes.
 * Must be rendered inside a <BrowserRouter>.
 */
export function PageTracker() {
  const location = useLocation();

  useEffect(() => {
    // Include search params so /deals?city=Atlanta is distinct from /deals
    const fullPath = location.pathname + (location.search || '');
    trackPageview(fullPath);
  }, [location.pathname, location.search]);

  return null;
}

export default PageTracker;
