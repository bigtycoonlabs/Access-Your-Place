import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import SEO, { getBreadcrumbSchema } from '@/components/SEO';
import { supabase } from '@/lib/supabase';
import CompanyLayout, { gold, section, wrap, h2 } from './CompanyLayout';

type Article = { id: string; slug: string; title: string; excerpt: string | null; category: string | null; city: string | null; state: string | null; published_at: string | null };

export default function CompanyLibrary() {
  const [articles, setArticles] = useState<Article[]>([]);
  const [state, setState] = useState<'loading' | 'ready' | 'failed'>('loading');
  const [category, setCategory] = useState('All');
  const [query, setQuery] = useState('');

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from('blog_articles')
        .select('id, slug, title, excerpt, category, city, state, published_at')
        .eq('status', 'published')
        .order('published_at', { ascending: false });
      // A failed read is not an empty library: say which one happened.
      if (error) { setState('failed'); return; }
      setArticles(data || []);
      setState('ready');
    })();
  }, []);

  const categories = useMemo(
    () => ['All', ...Array.from(new Set(articles.map((a) => a.category).filter(Boolean) as string[])).sort()],
    [articles]
  );

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return articles.filter((a) =>
      (category === 'All' || a.category === category) &&
      (!q || `${a.title} ${a.excerpt || ''} ${a.city || ''} ${a.state || ''}`.toLowerCase().includes(q))
    );
  }, [articles, category, query]);

  return (
    <CompanyLayout
      eyebrow="Knowledge library"
      title="What we have learned, written down."
      intro={<p>Free guides on furnished rentals, acquisitions, city rules, accessibility and the software we build. Written from our own operating experience, and honest about what we have not verified.</p>}
    >
      <SEO
        title="Knowledge Library | Set Up Your Place"
        description="Free guides on furnished rental operations, acquisitions, city short-term rental regulations, accessibility and the technology behind Access Your Place, YP Labs and YP Flow."
        canonicalUrl="/setupyourplace/library"
        ogType="website"
        structuredData={getBreadcrumbSchema([{ name: 'Set Up Your Place', url: '/setupyourplace' }, { name: 'Knowledge library', url: '/setupyourplace/library' }])}
      />

      <section className={section} aria-labelledby="find-heading">
        <div className={wrap}>
          <h2 id="find-heading" className={h2}>Find an article</h2>

          <label htmlFor="library-search" className="block font-medium">Search the library</label>
          <input
            id="library-search" type="search" value={query} onChange={(e) => setQuery(e.target.value)}
            placeholder="A city, a topic, a question"
            className="mt-1 w-full max-w-xl min-h-[44px] rounded-md border border-white/25 bg-white/5 px-3 py-2 text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-[#d4a574]"
          />

          <nav aria-label="Article categories" className="mt-6">
            <ul className="flex flex-wrap gap-2" role="list">
              {categories.map((c) => (
                <li key={c}>
                  <button
                    type="button" onClick={() => setCategory(c)} aria-pressed={category === c}
                    className={`inline-flex min-h-[44px] items-center rounded-md px-4 focus:outline-none focus:ring-2 focus:ring-[#d4a574] ${category === c ? 'bg-[#d4a574] text-[#0a0f1a] font-semibold' : 'border border-white/25 text-white/85 hover:text-white'}`}
                  >
                    {c}
                  </button>
                </li>
              ))}
            </ul>
          </nav>

          <p role="status" aria-live="polite" className="mt-6 text-white/85">
            {state === 'loading' && 'Loading the library.'}
            {state === 'failed' && 'The library could not be loaded just now. This is a fault on our side, not an empty library. Please try again shortly.'}
            {state === 'ready' && `${shown.length} article${shown.length === 1 ? '' : 's'}${category === 'All' ? '' : ` in ${category}`}${query ? ` matching “${query}”` : ''}.`}
          </p>
        </div>
      </section>

      <section className="py-14" aria-labelledby="articles-heading">
        <div className={wrap}>
          <h2 id="articles-heading" className={h2}>Articles</h2>
          <ul className="space-y-4" role="list">
            {shown.map((a) => (
              <li key={a.id} className="rounded-lg bg-white/5 border border-white/10 p-5">
                <h3 className="text-xl font-semibold">
                  <Link to={`/setupyourplace/library/${a.slug}`} className={`${gold} hover:underline focus:outline-none focus:ring-2 focus:ring-[#d4a574]`}>
                    {a.title}
                  </Link>
                </h3>
                {a.category && <p className="mt-1 text-sm text-white/60">{a.category}{a.city ? ` · ${a.city}${a.state ? `, ${a.state}` : ''}` : ''}</p>}
                {a.excerpt && <p className="mt-2 text-white/85 leading-relaxed">{a.excerpt}</p>}
              </li>
            ))}
          </ul>
          {state === 'ready' && shown.length === 0 && (
            <p className="text-white/85">Nothing matches that yet. Try a broader search, or ask us directly at success@accessyourplace.com.</p>
          )}
        </div>
      </section>
    </CompanyLayout>
  );
}
