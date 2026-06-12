
import { useState, useMemo } from 'react';
import { DraftArticle } from '@/types/admin';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { RefreshCw, FileText, Eye, Edit, CheckCircle, XCircle, Clock, AlertCircle, Loader2, Trash2, Database, Calendar } from 'lucide-react';
import { ArticleFilters } from './ArticleFilters';

interface BlogArticlesTabProps {
  draftArticles: DraftArticle[];
  generatingArticles: boolean;
  syncingArticles?: boolean;
  onGenerateArticles: () => void;
  onSyncStaticArticles?: () => void;
  onArticleAction: (id: string, action: 'approve' | 'reject' | 'publish' | 'delete') => void;
  onArticleEdit: (article: DraftArticle) => void;
  onArticlePreview: (article: DraftArticle) => void;
  onBulkAction?: (ids: string[], action: 'approve' | 'publish' | 'delete') => void;
}

export function BlogArticlesTab({ draftArticles, generatingArticles, syncingArticles, onGenerateArticles, onSyncStaticArticles, onArticleAction, onArticleEdit, onArticlePreview, onBulkAction }: BlogArticlesTabProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkLoading, setBulkLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sortBy, setSortBy] = useState('date-desc');

  const categories = useMemo(() => {
    const cats = new Set(draftArticles.map(a => a.category).filter(Boolean));
    return Array.from(cats).sort();
  }, [draftArticles]);

  const filteredArticles = useMemo(() => {
    let result = [...draftArticles];
    if (searchQuery) result = result.filter(a => a.title.toLowerCase().includes(searchQuery.toLowerCase()));
    if (categoryFilter !== 'all') result = result.filter(a => a.category === categoryFilter);
    if (statusFilter !== 'all') result = result.filter(a => a.status === statusFilter);
    result.sort((a, b) => {
      if (sortBy === 'date-desc') return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      if (sortBy === 'date-asc') return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      if (sortBy === 'title-asc') return a.title.localeCompare(b.title);
      if (sortBy === 'title-desc') return b.title.localeCompare(a.title);
      return 0;
    });
    return result;
  }, [draftArticles, searchQuery, categoryFilter, statusFilter, sortBy]);

  const counts = useMemo(() => ({
    pending: draftArticles.filter(a => a.status === 'pending').length,
    approved: draftArticles.filter(a => a.status === 'approved').length,
    scheduled: draftArticles.filter(a => a.status === 'scheduled').length,
    published: draftArticles.filter(a => a.status === 'published').length,
    total: draftArticles.length
  }), [draftArticles]);

  const getStatusBadge = (status: string) => {
    const colors: Record<string, string> = { pending: 'bg-yellow-100 text-yellow-800', approved: 'bg-green-100 text-green-800', rejected: 'bg-red-100 text-red-800', published: 'bg-blue-100 text-blue-800', scheduled: 'bg-purple-100 text-purple-800' };
    return <Badge className={colors[status] || 'bg-gray-100'}>{status}</Badge>;
  };

  const toggleSelect = (id: string) => { const s = new Set(selectedIds); s.has(id) ? s.delete(id) : s.add(id); setSelectedIds(s); };
  const toggleSelectAll = () => { const ids = filteredArticles.filter(a => a.status !== 'published').map(a => a.id); const all = ids.every(id => selectedIds.has(id)); const s = new Set(selectedIds); ids.forEach(id => all ? s.delete(id) : s.add(id)); setSelectedIds(s); };

  const handleBulkAction = async (action: 'approve' | 'publish' | 'delete') => {
    if (selectedIds.size === 0) return;
    setBulkLoading(true);
    if (onBulkAction) await onBulkAction(Array.from(selectedIds), action);
    else for (const id of selectedIds) await onArticleAction(id, action);
    setSelectedIds(new Set());
    setBulkLoading(false);
  };

  const ArticleRow = ({ article }: { article: DraftArticle }) => (
    <div className={`border p-4 rounded-lg ${article.status === 'published' ? 'bg-blue-50/50 border-blue-200' : article.status === 'scheduled' ? 'bg-purple-50/50 border-purple-200' : 'bg-white'}`}>
      <div className="flex items-start gap-3">
        {article.status !== 'published' && <Checkbox checked={selectedIds.has(article.id)} onCheckedChange={() => toggleSelect(article.id)} className="mt-1" />}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2 flex-wrap"><h3 className="font-semibold truncate">{article.title}</h3>{getStatusBadge(article.status)}</div>
          <p className="text-sm text-gray-600 mb-2 line-clamp-2">{article.excerpt}</p>
          <div className="text-xs text-gray-500">{article.category} • {article.status === 'scheduled' && article.scheduled_for ? `Scheduled: ${new Date(article.scheduled_for).toLocaleString()}` : article.status === 'published' ? `Published: ${new Date(article.published_at || article.created_at).toLocaleDateString()}` : `Created: ${new Date(article.created_at).toLocaleDateString()}`}</div>
        </div>
        <div className="flex gap-2 flex-shrink-0">
          <Button size="sm" variant="outline" onClick={() => onArticlePreview(article)}><Eye className="w-4 h-4" /></Button>
          <Button size="sm" variant="outline" onClick={() => onArticleEdit(article)}><Edit className="w-4 h-4" /></Button>
          {article.status === 'pending' && <><Button size="sm" className="bg-green-600 hover:bg-green-700" onClick={() => onArticleAction(article.id, 'approve')}><CheckCircle className="w-4 h-4" /></Button><Button size="sm" variant="destructive" onClick={() => onArticleAction(article.id, 'reject')}><XCircle className="w-4 h-4" /></Button></>}
          {article.status === 'approved' && <Button size="sm" className="bg-blue-600 hover:bg-blue-700" onClick={() => onArticleAction(article.id, 'publish')}>Publish</Button>}
          <Button size="sm" variant="destructive" onClick={() => onArticleAction(article.id, 'delete')}><Trash2 className="w-4 h-4" /></Button>
        </div>
      </div>
    </div>
  );

  return (
    <Card className="relative">
      <CardHeader>
        <div className="flex justify-between items-center flex-wrap gap-3">
          <div><CardTitle>Blog Articles</CardTitle><CardDescription>{counts.pending} pending • {counts.approved} approved • {counts.scheduled} scheduled • {counts.published} published</CardDescription></div>
          <div className="flex gap-2">
            {onSyncStaticArticles && <Button onClick={onSyncStaticArticles} disabled={syncingArticles} variant="outline">{syncingArticles ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Syncing...</> : <><Database className="w-4 h-4 mr-2" />Sync Static</>}</Button>}
            <Button onClick={onGenerateArticles} disabled={generatingArticles} className="bg-[#d4a574]">{generatingArticles ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Generating...</> : <><RefreshCw className="w-4 h-4 mr-2" />Generate</>}</Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="mb-6 grid grid-cols-5 gap-3">
          <div className="bg-yellow-50 p-3 rounded-lg"><div className="flex items-center gap-2"><Clock className="w-4 h-4 text-yellow-600" /><span className="text-xl font-bold">{counts.pending}</span></div><p className="text-xs text-gray-600">Pending</p></div>
          <div className="bg-green-50 p-3 rounded-lg"><div className="flex items-center gap-2"><CheckCircle className="w-4 h-4 text-green-600" /><span className="text-xl font-bold">{counts.approved}</span></div><p className="text-xs text-gray-600">Approved</p></div>
          <div className="bg-purple-50 p-3 rounded-lg"><div className="flex items-center gap-2"><Calendar className="w-4 h-4 text-purple-600" /><span className="text-xl font-bold">{counts.scheduled}</span></div><p className="text-xs text-gray-600">Scheduled</p></div>
          <div className="bg-blue-50 p-3 rounded-lg"><div className="flex items-center gap-2"><FileText className="w-4 h-4 text-blue-600" /><span className="text-xl font-bold">{counts.published}</span></div><p className="text-xs text-gray-600">Published</p></div>
          <div className="bg-gray-50 p-3 rounded-lg"><div className="flex items-center gap-2"><FileText className="w-4 h-4 text-gray-600" /><span className="text-xl font-bold">{counts.total}</span></div><p className="text-xs text-gray-600">Total</p></div>
        </div>
        <ArticleFilters searchQuery={searchQuery} onSearchChange={setSearchQuery} categoryFilter={categoryFilter} onCategoryChange={setCategoryFilter} statusFilter={statusFilter} onStatusChange={setStatusFilter} sortBy={sortBy} onSortChange={setSortBy} categories={categories} />
        {filteredArticles.filter(a => a.status !== 'published').length > 0 && <div className="flex items-center gap-4 mb-4 p-3 bg-gray-50 rounded-lg"><Checkbox checked={filteredArticles.filter(a => a.status !== 'published').every(a => selectedIds.has(a.id))} onCheckedChange={toggleSelectAll} /><span className="text-sm font-medium">Select All ({filteredArticles.filter(a => a.status !== 'published').length})</span>{selectedIds.size > 0 && <span className="text-sm text-blue-600">{selectedIds.size} selected</span>}</div>}
        <div className="space-y-3 max-h-[600px] overflow-y-auto">{filteredArticles.length === 0 ? <div className="text-center py-8 bg-gray-50 rounded-lg"><AlertCircle className="w-12 h-12 text-gray-400 mx-auto mb-3" /><p className="text-gray-600">No articles match your filters</p></div> : filteredArticles.map(a => <ArticleRow key={a.id} article={a} />)}</div>
      </CardContent>
      {selectedIds.size > 0 && <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-gray-900 text-white px-6 py-3 rounded-full shadow-xl flex items-center gap-4 z-50"><span className="font-medium">{selectedIds.size} selected</span><div className="h-6 w-px bg-gray-600" /><Button size="sm" variant="secondary" onClick={() => handleBulkAction('approve')} disabled={bulkLoading}><CheckCircle className="w-4 h-4 mr-1" />Approve</Button><Button size="sm" className="bg-blue-600 hover:bg-blue-700" onClick={() => handleBulkAction('publish')} disabled={bulkLoading}><FileText className="w-4 h-4 mr-1" />Publish</Button><Button size="sm" variant="destructive" onClick={() => handleBulkAction('delete')} disabled={bulkLoading}><Trash2 className="w-4 h-4 mr-1" />Delete</Button><Button size="sm" variant="ghost" onClick={() => setSelectedIds(new Set())} className="text-gray-300 hover:text-white"><XCircle className="w-4 h-4" /></Button>{bulkLoading && <Loader2 className="w-4 h-4 animate-spin" />}</div>}
    </Card>
  );
}
