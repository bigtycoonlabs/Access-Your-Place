import { useParams, Link } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { blogArticles } from '@/data/blogArticles';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import SEO, { getArticleSchema, getBreadcrumbSchema } from '@/components/SEO';
import { CommentSection } from '@/components/blog/CommentSection';
import { SkipLinks } from '@/hooks/useAccessibility';
import { supabase } from '@/lib/supabase';

import { Button } from '@/components/ui/button';
import { ArrowLeft, Calendar, MapPin, FileCheck, TrendingUp, Users, Loader2, Share2, BookmarkPlus, Facebook, Twitter, Linkedin } from 'lucide-react';

interface DatabaseArticle {
  id: string;
  title: string;
  slug: string;
  category: string;
  excerpt: string;
  content: string;
  image_url?: string;
  city?: string;
  state?: string;
  published_at?: string;
  requires_license?: boolean;
  adr?: string;
  occupancy?: string;
}

export default function BlogArticle() {
  const { slug } = useParams();
  const [dbArticle, setDbArticle] = useState<DatabaseArticle | null>(null);
  const [loading, setLoading] = useState(true);
  const [showShareMenu, setShowShareMenu] = useState(false);
  
  // First try to find in static articles
  const staticArticle = blogArticles.find(a => a.slug === slug);
  
  // Then try to fetch from database if not found in static
  useEffect(() => {
    const fetchFromDatabase = async () => {
      if (staticArticle) {
        setLoading(false);
        return;
      }
      
      try {
        // Try draft_articles first
        const { data: draftData } = await supabase.functions.invoke('get-draft-articles', {
          body: { status: 'published' }
        });
        
        const foundInDrafts = (draftData?.articles || []).find((a: any) => a.slug === slug);
        if (foundInDrafts) {
          setDbArticle({
            id: foundInDrafts.id,
            title: foundInDrafts.title,
            slug: foundInDrafts.slug,
            category: foundInDrafts.category || 'General',
            excerpt: foundInDrafts.excerpt || '',
            content: foundInDrafts.content || '',
            image_url: foundInDrafts.image_url,
            city: foundInDrafts.city,
            state: foundInDrafts.state,
            published_at: foundInDrafts.published_at,
            requires_license: foundInDrafts.requires_license,
            adr: foundInDrafts.adr,
            occupancy: foundInDrafts.occupancy
          });
          setLoading(false);
          return;
        }
        
        // Try blog_articles table
        const { data: blogData } = await supabase
          .from('blog_articles')
          .select('*')
          .eq('slug', slug)
          .eq('status', 'published')
          .single();
        
        if (blogData) {
          setDbArticle({
            id: blogData.id,
            title: blogData.title,
            slug: blogData.slug,
            category: blogData.category || 'General',
            excerpt: blogData.excerpt || blogData.meta_description || '',
            content: blogData.content || '',
            image_url: blogData.image_url,
            city: blogData.city,
            state: blogData.state,
            published_at: blogData.published_at
          });
        }
      } catch (err) {
        console.error('Error fetching article from database:', err);
      } finally {
        setLoading(false);
      }
    };
    
    fetchFromDatabase();
  }, [slug, staticArticle]);
  
  // Use either static or database article
  const article = staticArticle || (dbArticle ? {
    id: dbArticle.id,
    title: dbArticle.title,
    slug: dbArticle.slug,
    category: dbArticle.category,
    excerpt: dbArticle.excerpt,
    content: dbArticle.content,
    imageUrl: dbArticle.image_url || 'https://images.unsplash.com/photo-1560518883-ce09059eeffa?w=800',
    city: dbArticle.city,
    state: dbArticle.state,
    publishDate: dbArticle.published_at ? new Date(dbArticle.published_at).toLocaleDateString() : undefined,
    requiresLicense: dbArticle.requires_license,
    adr: dbArticle.adr,
    occupancy: dbArticle.occupancy
  } : null);

  // Generate SEO keywords based on article content
  const generateKeywords = () => {
    const baseKeywords = ['rental arbitrage', 'short-term rental', 'STR investment', 'Airbnb business'];
    if (article?.city && article?.state) {
      baseKeywords.push(`${article.city} rental arbitrage`, `${article.city} STR`, `${article.state} short-term rental`);
    }
    if (article?.category) {
      baseKeywords.push(article.category.toLowerCase());
    }
    return baseKeywords.join(', ');
  };

  // Share functionality
  const shareUrl = typeof window !== 'undefined' ? window.location.href : '';
  const shareTitle = article?.title || 'Article';

  const handleShare = (platform: string) => {
    const encodedUrl = encodeURIComponent(shareUrl);
    const encodedTitle = encodeURIComponent(shareTitle);
    
    const shareUrls: Record<string, string> = {
      facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`,
      twitter: `https://twitter.com/intent/tweet?url=${encodedUrl}&text=${encodedTitle}`,
      linkedin: `https://www.linkedin.com/shareArticle?mini=true&url=${encodedUrl}&title=${encodedTitle}`,
    };
    
    if (shareUrls[platform]) {
      window.open(shareUrls[platform], '_blank', 'width=600,height=400');
    }
    setShowShareMenu(false);
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      alert('Link copied to clipboard!');
    } catch (err) {
      console.error('Failed to copy link:', err);
    }
    setShowShareMenu(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-white">
        <SkipLinks />
        <Header />
        <main id="main-content" className="max-w-4xl mx-auto px-4 py-20 text-center" role="main">
          <Loader2 className="w-8 h-8 animate-spin text-[#d4a574] mx-auto mb-4" />
          <p className="text-gray-600">Loading article...</p>
        </main>
        <Footer />
      </div>
    );
  }

  if (!article) {
    return (
      <div className="min-h-screen bg-white">
        <SEO 
          title="Article Not Found"
          description="The article you're looking for doesn't exist or has been moved."
          noIndex={true}
        />
        <SkipLinks />
        <Header />
        <main id="main-content" className="max-w-4xl mx-auto px-4 py-20 text-center" role="main">
          <h1 className="text-3xl font-bold mb-4">Article Not Found</h1>
          <p className="text-gray-600 mb-6">
            The article you're looking for doesn't exist or has been moved.
          </p>
          <Link to="/knowledge-library">
            <Button className="focus:ring-2 focus:ring-[#d4a574] focus:ring-offset-2">
              Browse Knowledge Library
            </Button>
          </Link>
        </main>
        <Footer />
      </div>
    );
  }

  // Find related articles in the same category
  const relatedArticles = blogArticles
    .filter(a => a.category === article.category && a.id !== article.id)
    .slice(0, 3);

  // Generate structured data
  const articleSchema = getArticleSchema({
    title: article.title,
    description: article.excerpt,
    slug: article.slug,
    imageUrl: article.imageUrl,
    publishDate: article.publishDate,
    category: article.category,
  });

  const breadcrumbSchema = getBreadcrumbSchema([
    { name: 'Home', url: '/' },
    { name: 'Knowledge Library', url: '/knowledge-library' },
    { name: article.title, url: `/blog/${article.slug}` },
  ]);

  const combinedSchema = {
    '@context': 'https://schema.org',
    '@graph': [articleSchema, breadcrumbSchema],
  };

  return (
    <div className="min-h-screen bg-white">
      <SEO 
        title={article.title}
        description={article.excerpt}
        keywords={generateKeywords()}
        canonicalUrl={`/blog/${article.slug}`}
        ogType="article"
        ogImage={article.imageUrl}
        ogImageAlt={`Featured image for ${article.title}`}
        publishedTime={article.publishDate}
        section={article.category}
        structuredData={combinedSchema}
      />
      <SkipLinks />
      <Header />
      
      <main id="main-content" role="main" aria-label={`Article: ${article.title}`}>
        <article className="max-w-4xl mx-auto px-4 py-12" itemScope itemType="https://schema.org/Article">
          {/* Breadcrumb Navigation */}
          <nav aria-label="Breadcrumb" className="mb-6" itemScope itemType="https://schema.org/BreadcrumbList">
            <ol className="flex items-center gap-2 text-sm">
              <li itemProp="itemListElement" itemScope itemType="https://schema.org/ListItem">
                <Link 
                  to="/" 
                  className="text-gray-500 hover:text-[#d4a574] focus:outline-none focus:ring-2 focus:ring-[#d4a574] rounded px-1"
                  itemProp="item"
                >
                  <span itemProp="name">Home</span>
                </Link>
                <meta itemProp="position" content="1" />
              </li>
              <li aria-hidden="true" className="text-gray-400">/</li>
              <li itemProp="itemListElement" itemScope itemType="https://schema.org/ListItem">
                <Link 
                  to="/knowledge-library" 
                  className="text-gray-500 hover:text-[#d4a574] focus:outline-none focus:ring-2 focus:ring-[#d4a574] rounded px-1"
                  itemProp="item"
                >
                  <span itemProp="name">Knowledge Library</span>
                </Link>
                <meta itemProp="position" content="2" />
              </li>
              <li aria-hidden="true" className="text-gray-400">/</li>
              <li itemProp="itemListElement" itemScope itemType="https://schema.org/ListItem">
                <span className="text-[#d4a574] font-medium" aria-current="page" itemProp="name">
                  {article.title.length > 40 ? article.title.substring(0, 40) + '...' : article.title}
                </span>
                <meta itemProp="position" content="3" />
              </li>
            </ol>
          </nav>

          {/* Back Link */}
          <Link 
            to="/knowledge-library" 
            className="inline-flex items-center text-[#d4a574] hover:underline mb-6 focus:outline-none focus:ring-2 focus:ring-[#d4a574] rounded px-2 py-1"
          >
            <ArrowLeft className="w-4 h-4 mr-2" aria-hidden="true" />
            Back to Knowledge Library
          </Link>
          
          {/* Article Header */}
          <header className="mb-8">
            {/* Meta badges */}
            <div className="flex flex-wrap items-center gap-3 mb-4" role="list" aria-label="Article metadata">
              <span 
                className="bg-[#d4a574] text-white px-3 py-1 rounded-full text-sm font-medium"
                role="listitem"
                itemProp="articleSection"
              >
                <span className="sr-only">Category: </span>
                {article.category}
              </span>
              
              {article.city && article.state && (
                <span 
                  className="flex items-center gap-1 text-gray-600 text-sm"
                  role="listitem"
                >
                  <MapPin className="w-4 h-4" aria-hidden="true" />
                  <span className="sr-only">Location: </span>
                  <span itemProp="contentLocation">{article.city}, {article.state}</span>
                </span>
              )}
              
              {article.requiresLicense && (
                <span 
                  className="flex items-center gap-1 bg-red-100 text-red-800 px-3 py-1 rounded-full text-sm font-medium"
                  role="listitem"
                >
                  <FileCheck className="w-4 h-4" aria-hidden="true" />
                  <span className="sr-only">Note: </span>
                  License Required
                </span>
              )}
            </div>
            
            {/* Title */}
            <h1 className="text-4xl font-bold text-[#1a2332] mb-4 leading-tight" itemProp="headline">
              {article.title}
            </h1>
            
            {/* Article stats and share */}
            <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
              <div 
                className="flex flex-wrap items-center gap-6 text-gray-600"
                role="list"
                aria-label="Article statistics"
              >
                {article.publishDate && (
                  <span className="flex items-center gap-2" role="listitem">
                    <Calendar className="w-4 h-4" aria-hidden="true" />
                    <span className="sr-only">Published: </span>
                    <time dateTime={article.publishDate} itemProp="datePublished">{article.publishDate}</time>
                  </span>
                )}
                
                {article.adr && (
                  <span className="flex items-center gap-2" role="listitem">
                    <TrendingUp className="w-4 h-4" aria-hidden="true" />
                    <span className="sr-only">Average Daily Rate: </span>
                    ADR: {article.adr}
                  </span>
                )}
                
                {article.occupancy && (
                  <span className="flex items-center gap-2" role="listitem">
                    <Users className="w-4 h-4" aria-hidden="true" />
                    <span className="sr-only">Occupancy Rate: </span>
                    Occupancy: {article.occupancy}
                  </span>
                )}
              </div>

              {/* Share buttons */}
              <div className="relative">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowShareMenu(!showShareMenu)}
                  className="flex items-center gap-2"
                >
                  <Share2 className="w-4 h-4" />
                  Share
                </Button>
                
                {showShareMenu && (
                  <div className="absolute right-0 top-full mt-2 bg-white rounded-lg shadow-lg border p-2 z-50 min-w-[150px]">
                    <button
                      onClick={() => handleShare('facebook')}
                      className="flex items-center gap-2 w-full px-3 py-2 text-sm hover:bg-gray-100 rounded"
                    >
                      <Facebook className="w-4 h-4 text-blue-600" />
                      Facebook
                    </button>
                    <button
                      onClick={() => handleShare('twitter')}
                      className="flex items-center gap-2 w-full px-3 py-2 text-sm hover:bg-gray-100 rounded"
                    >
                      <Twitter className="w-4 h-4 text-sky-500" />
                      Twitter
                    </button>
                    <button
                      onClick={() => handleShare('linkedin')}
                      className="flex items-center gap-2 w-full px-3 py-2 text-sm hover:bg-gray-100 rounded"
                    >
                      <Linkedin className="w-4 h-4 text-blue-700" />
                      LinkedIn
                    </button>
                    <hr className="my-1" />
                    <button
                      onClick={handleCopyLink}
                      className="flex items-center gap-2 w-full px-3 py-2 text-sm hover:bg-gray-100 rounded"
                    >
                      <BookmarkPlus className="w-4 h-4" />
                      Copy Link
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Author info (hidden but SEO-friendly) */}
            <div itemProp="author" itemScope itemType="https://schema.org/Organization" className="hidden">
              <span itemProp="name">Access Your Place</span>
            </div>
            <div itemProp="publisher" itemScope itemType="https://schema.org/Organization" className="hidden">
              <span itemProp="name">Access Your Place</span>
              <div itemProp="logo" itemScope itemType="https://schema.org/ImageObject">
                <meta itemProp="url" content="https://accessyourplace.com/logo.png" />
              </div>
            </div>
          </header>

          {/* Featured Image */}
          <figure className="mb-8">
            <img 
              src={article.imageUrl} 
              alt={`Featured image for ${article.title}`}
              className="w-full h-64 md:h-80 object-cover rounded-lg shadow-md"
              itemProp="image"
              onError={(e) => {
                (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1560518883-ce09059eeffa?w=800';
              }}
            />
            {article.city && article.state && (
              <figcaption className="sr-only">
                Image representing {article.city}, {article.state}
              </figcaption>
            )}
          </figure>

          {/* Article excerpt for SEO */}
          <meta itemProp="description" content={article.excerpt} />

          {/* Article Content Styles */}
          <style>{`
            .blog-content h2 { 
              font-size: 1.875rem; 
              font-weight: 700; 
              color: #1a2332; 
              margin-top: 2rem; 
              margin-bottom: 1rem;
              scroll-margin-top: 100px;
            }
            .blog-content h3 { 
              font-size: 1.5rem; 
              font-weight: 600; 
              color: #1a2332; 
              margin-top: 1.5rem; 
              margin-bottom: 0.75rem;
              scroll-margin-top: 100px;
            }
            .blog-content p { 
              margin-bottom: 1rem; 
              line-height: 1.75; 
              color: #374151; 
            }
            .blog-content ul, .blog-content ol { 
              margin-left: 1.5rem; 
              margin-bottom: 1rem; 
            }
            .blog-content li { 
              margin-bottom: 0.5rem; 
              line-height: 1.6;
            }
            .blog-content strong { 
              color: #1a2332; 
              font-weight: 600; 
            }
            .blog-content a {
              color: #d4a574;
              text-decoration: underline;
            }
            .blog-content a:hover {
              color: #c49464;
            }
            .blog-content a:focus {
              outline: 2px solid #d4a574;
              outline-offset: 2px;
              border-radius: 2px;
            }
            .blog-content table { 
              width: 100%; 
              border-collapse: collapse; 
              margin: 1.5rem 0; 
            }
            .blog-content th { 
              background: #1a2332; 
              color: white; 
              padding: 0.75rem; 
              text-align: left; 
              font-weight: 600; 
            }
            .blog-content td { 
              padding: 0.75rem; 
              border: 1px solid #e5e7eb; 
            }
            .blog-content tbody tr:nth-child(even) { 
              background: #f9fafb; 
            }
            .blog-content blockquote {
              border-left: 4px solid #d4a574;
              padding-left: 1rem;
              margin: 1.5rem 0;
              font-style: italic;
              color: #4b5563;
            }
          `}</style>

          {/* Article Body */}
          <div 
            className="blog-content prose prose-lg max-w-none" 
            dangerouslySetInnerHTML={{ __html: article.content }}
            role="article"
            itemProp="articleBody"
          />

          {/* Call to Action */}
          <aside 
            className="my-8 p-6 bg-[#1a2332] text-white rounded-lg text-center"
            aria-label="Call to action"
          >
            <h2 className="text-2xl font-bold mb-3">Ready to See Real Deals?</h2>
            <p className="mb-4 text-gray-300">
              Check out our vetted properties{article.city ? ` in ${article.city}` : ''} and start your investment journey.
            </p>
            <Link 
              to="/deals" 
              className="inline-block bg-[#d4a574] text-white px-8 py-3 rounded-lg font-semibold hover:bg-[#c49464] transition-colors focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-[#1a2332]"
            >
              View Active Deals
            </Link>
          </aside>

          {/* Related Articles */}
          {relatedArticles.length > 0 && (
            <aside aria-labelledby="related-articles-heading" className="my-12">
              <h2 id="related-articles-heading" className="text-2xl font-bold text-[#1a2332] mb-6">
                Related Articles
              </h2>
              <ul className="grid md:grid-cols-3 gap-6 list-none p-0">
                {relatedArticles.map(related => (
                  <li key={related.id}>
                    <Link
                      to={`/blog/${related.slug}`}
                      className="block bg-gray-50 rounded-lg overflow-hidden hover:shadow-md transition-shadow focus:outline-none focus:ring-2 focus:ring-[#d4a574] focus:ring-offset-2"
                    >
                      <img 
                        src={related.imageUrl} 
                        alt="" 
                        className="w-full h-32 object-cover"
                        aria-hidden="true"
                      />
                      <div className="p-4">
                        <h3 className="font-semibold text-[#1a2332] line-clamp-2 mb-2">
                          {related.title}
                        </h3>
                        <span className="text-sm text-[#d4a574]">Read more</span>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            </aside>
          )}

          {/* Comments Section */}
          <section aria-labelledby="comments-heading" className="mt-12 pt-8 border-t">
            <h2 id="comments-heading" className="sr-only">Comments</h2>
            <CommentSection articleSlug={article.slug} />
          </section>
        </article>
      </main>
      
      <Footer />
    </div>
  );
}
