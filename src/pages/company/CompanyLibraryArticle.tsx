import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import SEO, { getBreadcrumbSchema } from '@/components/SEO';
import { supabase } from '@/lib/supabase';
import { articleToHtml } from '@/lib/articleContent';
import CompanyLayout, { gold, wrap } from './CompanyLayout';

type Article = {
  id: string; slug: string; title: string; content: string; excerpt: string | null;
  seo_title: string | null; seo_description: string | null; meta_description: string | null;
  category: string | null; city: string | null; state: string | null;
  published_at: string | null; updated_at: string | null; image_url: string | null;
};

export default function CompanyLibraryArticle() {
  const { slug } = useParams();
  const [article, setArticle] = useState<Article | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'missing' | 'failed'>('loading');
  const [more, setMore] = useState<Pick<Article, 'slug' | 'title'>[]>([]);

  useEffect(() => {
    if (!slug) return;
    setState('loading');
    (async () => {
      const { data, error } = await supabase
        .from('blog_articles').select('*').eq('slug', slug).eq('status', 'published').maybeSingle();
      if (error) { setState('failed'); return; }   // a failed read is not a missing article
      if (!data) { setState('missing'); return; }
      setArticle(data as Article);
      setState('ready');
      const { data: rest } = await supabase
        .from('blog_articles').select('slug, title').eq('status', 'published')
        .eq('category', (data as Article).category).neq('slug', slug).limit(4);
      setMore(rest || []);
    })();
  }, [slug]);

  const title = article?.seo_title || article?.title || 'Knowledge library';
  const description = article?.seo_description || article?.meta_description || article?.excerpt || '';

  return (
    <CompanyLayout
      eyebrow={article?.category ? `Knowledge library · ${article.category}` : 'Knowledge library'}
      title={article?.title || (state === 'missing' ? 'We could not find that article' : 'Loading')}
      intro={
        state === 'failed' ? <p>This article could not be loaded just now. That is a fault on our side, not a missing article. Please try again shortly.</p>
        : state === 'missing' ? <p>It may have been renamed. <Link to="/setupyourplace/library" className={`${gold} underline underline-offset-2`}>Browse the library</Link>, or email success@accessyourplace.com and we will point you at it.</p>
        : <p>{article?.excerpt || ''}</p>
      }
    >
      {article && (
        <SEO
          title={title} description={description}
          canonicalUrl={`/setupyourplace/library/${article.slug}`} ogType="article"
          structuredData={getBreadcrumbSchema([
            { name: 'Set Up Your Place', url: '/setupyourplace' },
            { name: 'Knowledge library', url: '/setupyourplace/library' },
            { name: article.title, url: `/setupyourplace/library/${article.slug}` },
          ])}
        />
      )}

      <article className="py-12">
        <div className={wrap}>
          {state === 'ready' && article && (
            <>
              <div className="library-body" dangerouslySetInnerHTML={{ __html: articleToHtml(article.content) }} />
              <style>{`
                .library-body{font-size:1.125rem;line-height:1.75;color:rgba(255,255,255,.9)}
                .library-body h2{font-size:1.75rem;font-weight:700;margin:2.2rem 0 .9rem;color:#fff}
                .library-body h3{font-size:1.3rem;font-weight:700;margin:1.8rem 0 .6rem;color:#d4a574}
                .library-body p{margin:0 0 1.1rem}
                .library-body ul{margin:0 0 1.2rem 1.25rem;list-style:disc}
                .library-body li{margin:.4rem 0}
                .library-body strong{color:#fff}
                .library-body a{color:#d4a574;text-decoration:underline;text-underline-offset:2px}
                .library-body hr{border:0;border-top:1px solid rgba(255,255,255,.15);margin:2.5rem 0}
                .library-body table{width:100%;border-collapse:collapse;margin:1.5rem 0;display:block;overflow-x:auto}
                .library-body th,.library-body td{border:1px solid rgba(255,255,255,.18);padding:.6rem .75rem;text-align:left}
                .library-body th{background:rgba(255,255,255,.07);font-weight:700;color:#fff}
              `}</style>

              <p className="mt-10 text-sm text-white/60">
                {article.published_at && <>Published {new Date(article.published_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}. </>}
                {article.updated_at && <>Last updated {new Date(article.updated_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}.</>}
              </p>

              {more.length > 0 && (
                <nav aria-labelledby="more-heading" className="mt-12 border-t border-white/10 pt-8">
                  <h2 id="more-heading" className="text-xl font-bold mb-3">More in {article.category}</h2>
                  <ul className="space-y-1" role="list">
                    {more.map((m) => (
                      <li key={m.slug}>
                        <Link to={`/setupyourplace/library/${m.slug}`} className={`inline-flex min-h-[44px] items-center ${gold} hover:underline`}>{m.title}</Link>
                      </li>
                    ))}
                  </ul>
                </nav>
              )}

              <p className="mt-10">
                <Link to="/setupyourplace/library" className={`inline-flex min-h-[44px] items-center ${gold} underline underline-offset-2`}>Back to the knowledge library</Link>
              </p>
            </>
          )}
        </div>
      </article>
    </CompanyLayout>
  );
}
