export interface DraftArticle {
  id: string;
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  category: string;
  tags: string[];
  seo_title: string;
  seo_description: string;
  seo_keywords: string[];
  featured_image: string;
  status: 'pending' | 'approved' | 'rejected' | 'published' | 'scheduled';
  author: string;
  research_sources: string[];
  ai_confidence_score: number;
  staff_notes: string;
  approved_by: string;
  approved_at: string;
  published_at: string;
  scheduled_for: string;
  created_at: string;
  updated_at: string;
  source_table?: 'draft_articles' | 'blog_articles';
}
