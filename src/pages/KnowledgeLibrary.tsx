import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { blogArticles } from '@/data/blogArticles';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import SEO, { getBreadcrumbSchema } from '@/components/SEO';
import { SkipLinks, LiveRegion } from '@/hooks/useAccessibility';
import { supabase } from '@/lib/supabase';
import { Loader2 } from 'lucide-react';

interface DatabaseArticle {
  id: string;
  title: string;
  slug: string;
  category: string;
  excerpt: string;
  content: string;
  image_url?: string;
  meta_description?: string;
  status: string;
  published_at: string;
  city?: string;
  state?: string;
}

export default function KnowledgeLibrary() {
  const [filter, setFilter] = useState('All');
  const [announcement, setAnnouncement] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [dbArticles, setDbArticles] = useState<DatabaseArticle[]>([]);
  const [loading, setLoading] = useState(true);
  
  const categories = ['All', 'STR Regulations', 'Co-Living', 'Market Data', 'Property Management', 'Tips & Tricks'];
  
  // Fetch published articles from database
  useEffect(() => {
    const fetchPublishedArticles = async () => {
      try {
        // Fetch from draft_articles table (published status)
        const { data: draftData } = await supabase.functions.invoke('get-draft-articles', {
          body: { status: 'published' }
        });
        
        // Also try to fetch from blog_articles table
        const { data: blogData } = await supabase
          .from('blog_articles')
          .select('*')
          .eq('status', 'published')
          .order('published_at', { ascending: false });
        
        const publishedFromDrafts = (draftData?.articles || []).map((a: any) => ({
          id: a.id,
          title: a.title,
          slug: a.slug || a.id,
          category: a.category || 'General',
          excerpt: a.excerpt || '',
          content: a.content || '',
          image_url: a.image_url,
          status: 'published',
          published_at: a.published_at || a.created_at,
          city: a.city,
          state: a.state
        }));
        
        const publishedFromBlog = (blogData || []).map((a: any) => ({
          id: a.id,
          title: a.title,
          slug: a.slug,
          category: a.category || 'General',
          excerpt: a.excerpt || a.meta_description || '',
          content: a.content || '',
          image_url: a.image_url,
          status: 'published',
          published_at: a.published_at || a.created_at,
          city: a.city,
          state: a.state
        }));
        
        // Combine and deduplicate by slug
        const allDbArticles = [...publishedFromDrafts, ...publishedFromBlog];
        const uniqueArticles = allDbArticles.reduce((acc: DatabaseArticle[], article) => {
          if (!acc.find(a => a.slug === article.slug)) {
            acc.push(article);
          }
          return acc;
        }, []);
        
        setDbArticles(uniqueArticles);
      } catch (err) {
        console.error('Error fetching published articles:', err);
      } finally {
        setLoading(false);
      }
    };
    
    fetchPublishedArticles();
  }, []);
  
  // Combine static articles with database articles
  const allArticles = [
    // Database articles first (newer content)
    ...dbArticles.map(a => ({
      id: a.id,
      title: a.title,
      slug: a.slug,
      category: a.category,
      excerpt: a.excerpt,
      content: a.content,
      imageUrl: a.image_url || 'https://images.unsplash.com/photo-1560518883-ce09059eeffa?w=800',
      city: a.city,
      state: a.state,
      isFromDatabase: true
    })),
    // Static articles (filter out any that exist in database)
    ...blogArticles.filter(a => !dbArticles.find(db => db.slug === a.slug))
  ];
  
  // Filter articles by category and search query
  const filtered = allArticles.filter(article => {
    const matchesCategory = filter === 'All' || article.category === filter;
    const matchesSearch = searchQuery === '' || 
      article.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      article.excerpt.toLowerCase().includes(searchQuery.toLowerCase()) ||
      article.city?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      article.state?.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  // Announce filter changes to screen readers
  useEffect(() => {
    if (filter || searchQuery) {
      const count = filtered.length;
      const filterText = filter !== 'All' ? ` in ${filter}` : '';
      const searchText = searchQuery ? ` matching "${searchQuery}"` : '';
      setAnnouncement(`Showing ${count} article${count !== 1 ? 's' : ''}${filterText}${searchText}`);
    }
  }, [filter, searchQuery, filtered.length]);

  const handleFilterChange = (category: string) => {
    setFilter(category);
  };

  // Generate structured data for the knowledge library
  const breadcrumbSchema = getBreadcrumbSchema([
    { name: 'Home', url: '/' },
    { name: 'Knowledge Library', url: '/knowledge-library' }
  ]);

  const collectionSchema = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: 'Rental Arbitrage Knowledge Library',
    description: 'The most comprehensive database of rental arbitrage information on the internet. Free guides, market data, and expert insights.',
    url: 'https://accessyourplace.com/knowledge-library',
    mainEntity: {
      '@type': 'ItemList',
      numberOfItems: allArticles.length,
      itemListElement: allArticles.slice(0, 20).map((article, index) => ({
        '@type': 'ListItem',
        position: index + 1,
        item: {
          '@type': 'Article',
          headline: article.title,
          description: article.excerpt,
          url: `https://accessyourplace.com/blog/${article.slug}`,
          image: article.imageUrl,
          articleSection: article.category
        }
      }))
    }
  };

  const pageSchema = {
    '@context': 'https://schema.org',
    '@graph': [breadcrumbSchema, collectionSchema]
  };

  return (
    <div className="min-h-screen flex flex-col">
      <SEO 
        title="Knowledge Library - Free Rental Arbitrage Guides & Market Data"
        description={`Access ${allArticles.length}+ free articles on rental arbitrage, STR regulations, co-living strategies, and market data. The most comprehensive resource for short-term rental investors.`}
        keywords="rental arbitrage guide, STR regulations, co-living tips, Airbnb business guide, short-term rental market data, property management tips, vacation rental strategies, real estate investment education"
        canonicalUrl="/knowledge-library"
        ogType="website"
        structuredData={pageSchema}
      />
      
      {/* Skip Links */}
      <SkipLinks />
      
      {/* Live region for announcements */}
      <LiveRegion message={announcement} />
      
      <Header />
      
      <main id="main-content" className="flex-grow bg-gray-50 py-16" role="main" aria-label="Knowledge Library">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Page Header */}
          <header className="text-center mb-12">
            <h1 className="text-5xl font-bold text-[#1a2332] mb-4">Knowledge Library</h1>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              The most comprehensive database of rental arbitrage information on the internet—completely free. 
              Backed by 5+ years of real-world data and hundreds of property launches.
            </p>
          </header>

          {/* Search Bar */}
          <div className="max-w-xl mx-auto mb-8">
            <label htmlFor="article-search" className="sr-only">
              Search articles
            </label>
            <div className="relative">
              <input
                id="article-search"
                type="search"
                placeholder="Search articles by title, city, or topic..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full px-4 py-3 pl-12 rounded-lg border border-gray-300 focus:border-[#d4a574] focus:ring-2 focus:ring-[#d4a574] focus:ring-opacity-50 focus:outline-none transition-colors"
                aria-describedby="search-help"
              />
              <svg 
                className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" 
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <p id="search-help" className="sr-only">
              Type to search through article titles, cities, and content
            </p>
          </div>

          {/* Category Filters */}
          <nav 
            className="flex flex-wrap justify-center gap-3 mb-12" 
            role="navigation" 
            aria-label="Article categories"
          >
            <p className="sr-only" id="filter-instructions">
              Select a category to filter articles. Currently showing {filter} articles.
            </p>
            {categories.map(cat => (
              <button 
                key={cat} 
                onClick={() => handleFilterChange(cat)} 
                className={`px-6 py-2 rounded-full font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-[#d4a574] focus:ring-offset-2 ${
                  filter === cat 
                    ? 'bg-[#d4a574] text-white' 
                    : 'bg-white text-gray-700 hover:bg-gray-100'
                }`}
                aria-pressed={filter === cat}
                aria-label={`Filter by ${cat}${filter === cat ? ' (currently selected)' : ''}`}
              >
                {cat}
              </button>
            ))}
          </nav>

          {/* Loading State */}
          {loading && (
            <div className="flex justify-center items-center py-8">
              <Loader2 className="w-8 h-8 animate-spin text-[#d4a574]" />
              <span className="ml-2 text-gray-600">Loading articles...</span>
            </div>
          )}

          {/* Results Count */}
          {!loading && (
            <div className="mb-6 text-center" aria-live="polite">
              <p className="text-gray-600">
                Showing <span className="font-semibold">{filtered.length}</span> article{filtered.length !== 1 ? 's' : ''}
                {filter !== 'All' && <span> in <span className="font-semibold">{filter}</span></span>}
                {searchQuery && <span> matching "<span className="font-semibold">{searchQuery}</span>"</span>}
              </p>
            </div>
          )}

          {/* Articles Grid */}
          {!loading && filtered.length === 0 ? (
            <div className="text-center py-12" role="status">
              <p className="text-xl text-gray-600 mb-4">No articles found matching your criteria.</p>
              <button
                onClick={() => { setFilter('All'); setSearchQuery(''); }}
                className="text-[#d4a574] font-semibold hover:underline focus:outline-none focus:ring-2 focus:ring-[#d4a574] rounded px-2 py-1"
              >
                Clear filters and show all articles
              </button>
            </div>
          ) : !loading && (
            <section aria-label="Articles list">
              <h2 className="sr-only">Articles</h2>
              <ul className="grid md:grid-cols-2 lg:grid-cols-3 gap-8 list-none p-0">
                {filtered.map((article) => (
                  <li key={article.id}>
                    <article className="h-full" itemScope itemType="https://schema.org/Article">
                      <Link 
                        to={`/blog/${article.slug}`} 
                        className="block h-full bg-white rounded-lg shadow-lg overflow-hidden hover:shadow-xl transition-shadow focus:outline-none focus:ring-2 focus:ring-[#d4a574] focus:ring-offset-2"
                        aria-label={`Read article: ${article.title}. Category: ${article.category}. ${article.excerpt}`}
                        itemProp="url"
                      >
                        <div className="relative">
                          <img 
                            src={article.imageUrl} 
                            alt="" 
                            className="w-full h-48 object-cover"
                            aria-hidden="true"
                            itemProp="image"
                            onError={(e) => {
                              (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1560518883-ce09059eeffa?w=800';
                            }}
                          />
                          {/* Category badge */}
                          <span 
                            className="absolute top-3 left-3 bg-[#d4a574] text-white px-3 py-1 rounded-full text-xs font-semibold"
                            aria-hidden="true"
                          >
                            {article.category}
                          </span>
                          {/* New badge for database articles */}
                          {(article as any).isFromDatabase && (
                            <span 
                              className="absolute top-3 right-3 bg-green-500 text-white px-3 py-1 rounded-full text-xs font-semibold"
                              aria-hidden="true"
                            >
                              New
                            </span>
                          )}
                        </div>
                        <div className="p-6">
                          <div className="flex items-center gap-2 mb-2">
                            <span className="sr-only">Category:</span>
                            <span className="text-xs text-[#d4a574] font-semibold" itemProp="articleSection">{article.category}</span>
                            {article.city && article.state && (
                              <>
                                <span className="sr-only">Location:</span>
                                <span className="text-xs text-gray-500" itemProp="contentLocation">• {article.city}, {article.state}</span>
                              </>
                            )}
                          </div>
                          <h3 className="text-xl font-bold text-[#1a2332] mb-2 line-clamp-2" itemProp="headline">
                            {article.title}
                          </h3>
                          <p className="text-gray-600 mb-3 line-clamp-3" itemProp="description">{article.excerpt}</p>
                          <span 
                            className="text-[#d4a574] font-semibold inline-flex items-center gap-1"
                            aria-hidden="true"
                          >
                            Read More 
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                          </span>
                        </div>
                      </Link>
                    </article>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* Pagination info for large lists */}
          {!loading && filtered.length > 12 && (
            <div className="mt-8 text-center">
              <p className="text-gray-500 text-sm">
                Scroll to see all {filtered.length} articles
              </p>
            </div>
          )}
        </div>
      </main>
      
      <Footer />
    </div>
  );
}
