import { Link } from 'react-router-dom';
import { Sparkles, BookOpen, ArrowRight, Shield, DollarSign, Store, Brain } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

const featuredArticles = [
  { 
    slug: 'yp-referral-program-earn-money-rental-arbitrage', 
    title: 'The YP Referral Program: Make Money Without Owning Property', 
    excerpt: 'Earn $300 per investor referral and 20% commission on landlord/property referrals. Anyone in the rental arbitrage industry can participate.', 
    category: 'Referral Program', 
    featured: true,
    icon: DollarSign,
    date: 'Feb 14, 2026'
  },
  { 
    slug: 'deal-marketplace-buy-sell-rental-arbitrage-operations', 
    title: 'The Deal Marketplace: Buy & Sell Entire Operations', 
    excerpt: 'The first secure marketplace for rental arbitrage operations with escrow protection and verification services.', 
    category: 'Marketplace', 
    featured: false,
    icon: Store,
    date: 'Feb 14, 2026'
  },
  { 
    slug: 'penny-score-ai-market-analysis-rental-arbitrage', 
    title: 'The Penny Score: AI-Powered Deal Analysis', 
    excerpt: 'More detailed than AirDNA or Mashvisor — six pillars of evaluation with real-time market scanning.', 
    category: 'AI & Data', 
    featured: false,
    icon: Brain,
    date: 'Feb 14, 2026'
  },
];

export default function FeaturedArticles() {
  return (
    <section className="py-16 bg-gradient-to-b from-[#111827] to-[#0a0f1a]">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex justify-between items-end mb-8">
          <div>
            <div className="inline-flex items-center gap-2 text-[#d4a574] mb-2">
              <Sparkles className="w-4 h-4" />
              <span className="text-sm font-medium">Latest from Access Your Place</span>
            </div>
            <h2 className="text-3xl font-bold text-white">What's <span className="text-[#d4a574]">New</span> on the Platform</h2>
          </div>
          <Link to="/knowledge-library" className="text-[#d4a574] font-semibold flex items-center gap-1 hover:underline">
            View All <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
        <div className="grid md:grid-cols-3 gap-6">
          {featuredArticles.map((article, i) => {
            const Icon = article.icon;
            return (
              <Link 
                key={i} 
                to={`/blog/${article.slug}`} 
                className={`group rounded-xl overflow-hidden border transition-all hover:shadow-lg hover:-translate-y-1 duration-300 ${
                  article.featured 
                    ? 'md:col-span-2 md:row-span-2 bg-gradient-to-br from-[#1a365d] to-[#2d4a7c] text-white border-[#d4a574]/20' 
                    : 'bg-white/5 border-white/10 hover:border-[#d4a574]/30'
                }`}
              >
                <div className={`p-6 h-full flex flex-col ${article.featured ? 'justify-end min-h-[300px]' : ''}`}>
                  <div className="flex items-center gap-2 mb-3">
                    <Badge 
                      variant={article.featured ? 'secondary' : 'outline'} 
                      className={article.featured ? 'bg-[#d4a574] text-white w-fit' : 'w-fit border-[#d4a574]/50 text-[#d4a574]'}
                    >
                      <Icon className="w-3 h-3 mr-1" />
                      {article.category}
                    </Badge>
                    <span className="text-xs text-gray-400">{article.date}</span>
                  </div>
                  <h3 className={`font-bold mb-2 group-hover:text-[#d4a574] transition-colors ${
                    article.featured ? 'text-2xl text-white' : 'text-lg text-white'
                  }`}>
                    {article.title}
                  </h3>
                  <p className={`${article.featured ? 'text-gray-300' : 'text-gray-400'} mb-4`}>
                    {article.excerpt}
                  </p>
                  <div className="flex items-center gap-2 font-semibold text-[#d4a574] mt-auto">
                    <BookOpen className="w-4 h-4" />
                    Read Article
                    <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}
