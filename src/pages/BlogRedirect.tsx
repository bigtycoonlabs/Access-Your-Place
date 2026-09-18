import { Navigate, useParams } from 'react-router-dom';

// The library moved to the company site. Old article addresses keep working: anyone arriving
// on /blog/<slug> is sent to the same article in its new home. The server also answers these
// with a permanent redirect, so search engines move their record across rather than dropping it.
export default function BlogRedirect() {
  const { slug } = useParams();
  return <Navigate to={slug ? `/setupyourplace/library/${slug}` : '/setupyourplace/library'} replace />;
}
