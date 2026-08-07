import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import {
  Loader2, Plus, Edit2, Copy, Trash2, Eye, Save, FileText,
  Clock, Search, RefreshCw, ChevronDown, ChevronRight,
  History, Tag, AlertCircle, CheckCircle, X, FileSignature
} from 'lucide-react';

interface AgreementTemplate {
  id: string;
  name: string;
  category: string;
  description?: string;
  content: string;
  placeholder_fields: string[];
  is_active: boolean;
  version: number;
  created_by?: string;
  created_by_id?: string;
  updated_by?: string;
  created_at: string;
  updated_at: string;
}

interface TemplateVersion {
  id: string;
  template_id: string;
  version: number;
  name: string;
  content: string;
  placeholder_fields: string[];
  change_notes?: string;
  created_by?: string;
  created_at: string;
}

interface Props {
  staffId: string;
  staffName: string;
}

const CATEGORIES = [
  { value: 'acquisition', label: 'Acquisition Agreement' },
  { value: 'sublease', label: 'Sublease Agreement' },
  { value: 'setup', label: 'Setup Services' },
  { value: 'corporate', label: 'Corporate Agreement' },
  { value: 'addendum', label: 'Addendum / Amendment' },
  { value: 'general', label: 'General / Other' },
];

const COMMON_PLACEHOLDERS = [
  '{{DATE}}', '{{INVESTOR_NAME}}', '{{INVESTOR_EMAIL}}', '{{STAFF_NAME}}',
  '[PROPERTY ADDRESS]', '[COMMUNITY NAME]', '[UNIT CONFIGURATION]',
  '[MONTHLY RENT]', '[AMOUNT]', '[LANDLORD NAME]', '[SETUP PACKAGE]',
  '[SETUP FEE]', '[ESTIMATED DAYS]', '[TERM MONTHS]', '[MOVE-IN DATE]',
  '[EXPIRATION DATE]', '[DEPOSIT AMOUNT]', '[PRORATED AMOUNT]'
];

export function AgreementTemplateManager({ staffId, staffName }: Props) {
  const [templates, setTemplates] = useState<AgreementTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState<string>('all');

  // Editor modal
  const [showEditor, setShowEditor] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<AgreementTemplate | null>(null);
  const [editorForm, setEditorForm] = useState({
    name: '', category: 'general', description: '', content: '',
    placeholder_fields: [] as string[], is_active: true, change_notes: ''
  });
  const [saving, setSaving] = useState(false);

  // Preview modal
  const [showPreview, setShowPreview] = useState(false);
  const [previewContent, setPreviewContent] = useState('');
  const [previewName, setPreviewName] = useState('');

  // Version history modal
  const [showVersions, setShowVersions] = useState(false);
  const [versions, setVersions] = useState<TemplateVersion[]>([]);
  const [loadingVersions, setLoadingVersions] = useState(false);
  const [versionsTemplateName, setVersionsTemplateName] = useState('');

  // Delete confirmation
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const { toast } = useToast();

  useEffect(() => { fetchTemplates(); }, []);

  const fetchTemplates = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('agreement_templates')
        .select('*')
        .order('updated_at', { ascending: false });
      
      if (error) throw error;
      setTemplates(data || []);
    } catch (err: any) {
      console.error('Failed to fetch templates:', err);
      toast({ title: 'Error', description: 'Failed to load templates. ' + (err.message || ''), variant: 'destructive' });
    }
    setLoading(false);
  };

  const extractPlaceholders = (content: string): string[] => {
    const placeholders = new Set<string>();
    // Match {{...}} patterns
    const mustacheMatches = content.match(/\{\{[^}]+\}\}/g) || [];
    mustacheMatches.forEach(m => placeholders.add(m));
    // Match [...] patterns (but not checkboxes)
    const bracketMatches = content.match(/\[[A-Z][A-Z\s_]+\]/g) || [];
    bracketMatches.forEach(m => placeholders.add(m));
    return Array.from(placeholders);
  };

  const openCreateModal = () => {
    setEditingTemplate(null);
    setEditorForm({
      name: '', category: 'general', description: '', content: '',
      placeholder_fields: [], is_active: true, change_notes: ''
    });
    setShowEditor(true);
  };

  const openEditModal = (template: AgreementTemplate) => {
    setEditingTemplate(template);
    setEditorForm({
      name: template.name,
      category: template.category,
      description: template.description || '',
      content: template.content,
      placeholder_fields: template.placeholder_fields || [],
      is_active: template.is_active,
      change_notes: ''
    });
    setShowEditor(true);
  };

  const handleDuplicate = (template: AgreementTemplate) => {
    setEditingTemplate(null);
    setEditorForm({
      name: `${template.name} (Copy)`,
      category: template.category,
      description: template.description || '',
      content: template.content,
      placeholder_fields: template.placeholder_fields || [],
      is_active: true,
      change_notes: `Duplicated from "${template.name}"`
    });
    setShowEditor(true);
  };

  const handleSave = async () => {
    if (!editorForm.name.trim() || !editorForm.content.trim()) {
      toast({ title: 'Missing Fields', description: 'Name and content are required.', variant: 'destructive' });
      return;
    }

    setSaving(true);
    const detectedPlaceholders = extractPlaceholders(editorForm.content);

    try {
      if (editingTemplate) {
        // Update existing template
        const newVersion = (editingTemplate.version || 1) + 1;

        // Save version history first
        await supabase.from('agreement_template_versions').insert({
          template_id: editingTemplate.id,
          version: editingTemplate.version || 1,
          name: editingTemplate.name,
          content: editingTemplate.content,
          placeholder_fields: editingTemplate.placeholder_fields || [],
          change_notes: editorForm.change_notes || `Updated by ${staffName}`,
          created_by: staffName
        });

        // Update the template
        const { error } = await supabase
          .from('agreement_templates')
          .update({
            name: editorForm.name.trim(),
            category: editorForm.category,
            description: editorForm.description.trim(),
            content: editorForm.content,
            placeholder_fields: detectedPlaceholders,
            is_active: editorForm.is_active,
            version: newVersion,
            updated_by: staffName,
            updated_at: new Date().toISOString()
          })
          .eq('id', editingTemplate.id);

        if (error) throw error;
        toast({ title: 'Template Updated', description: `"${editorForm.name}" saved as version ${newVersion}.` });
      } else {
        // Create new template
        const { error } = await supabase
          .from('agreement_templates')
          .insert({
            name: editorForm.name.trim(),
            category: editorForm.category,
            description: editorForm.description.trim(),
            content: editorForm.content,
            placeholder_fields: detectedPlaceholders,
            is_active: editorForm.is_active,
            version: 1,
            created_by: staffName,
            created_by_id: staffId,
            updated_by: staffName
          });

        if (error) throw error;
        toast({ title: 'Template Created', description: `"${editorForm.name}" has been created.` });
      }

      setShowEditor(false);
      fetchTemplates();
    } catch (err: any) {
      toast({ title: 'Error', description: err.message || 'Failed to save template.', variant: 'destructive' });
    }
    setSaving(false);
  };

  const handleDelete = async (templateId: string) => {
    try {
      const { error } = await supabase
        .from('agreement_templates')
        .delete()
        .eq('id', templateId);
      
      if (error) throw error;
      toast({ title: 'Template Deleted' });
      setDeleteConfirm(null);
      fetchTemplates();
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
  };

  const handleToggleActive = async (template: AgreementTemplate) => {
    try {
      await supabase
        .from('agreement_templates')
        .update({ is_active: !template.is_active, updated_at: new Date().toISOString() })
        .eq('id', template.id);
      
      toast({ title: template.is_active ? 'Template Deactivated' : 'Template Activated' });
      fetchTemplates();
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
  };

  const openPreview = (template: AgreementTemplate) => {
    let content = template.content;
    content = content.replace(/\{\{DATE\}\}/g, new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }));
    content = content.replace(/\{\{STAFF_NAME\}\}/g, staffName);
    content = content.replace(/\{\{INVESTOR_NAME\}\}/g, '[Investor Name]');
    content = content.replace(/\{\{INVESTOR_EMAIL\}\}/g, '[investor@email.com]');
    setPreviewContent(content);
    setPreviewName(template.name);
    setShowPreview(true);
  };

  const openVersionHistory = async (template: AgreementTemplate) => {
    setVersionsTemplateName(template.name);
    setShowVersions(true);
    setLoadingVersions(true);
    try {
      const { data, error } = await supabase
        .from('agreement_template_versions')
        .select('*')
        .eq('template_id', template.id)
        .order('version', { ascending: false });
      
      if (error) throw error;
      setVersions(data || []);
    } catch (err: any) {
      toast({ title: 'Error', description: 'Failed to load version history.', variant: 'destructive' });
      setVersions([]);
    }
    setLoadingVersions(false);
  };

  const restoreVersion = (version: TemplateVersion) => {
    const template = templates.find(t => t.id === version.template_id);
    if (!template) return;
    
    setEditingTemplate(template);
    setEditorForm({
      name: template.name,
      category: template.category,
      description: template.description || '',
      content: version.content,
      placeholder_fields: version.placeholder_fields || [],
      is_active: template.is_active,
      change_notes: `Restored from version ${version.version}`
    });
    setShowVersions(false);
    setShowEditor(true);
  };

  // Filter templates
  const filteredTemplates = templates.filter(t => {
    const matchesSearch = !searchQuery || 
      t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.description?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = filterCategory === 'all' || t.category === filterCategory;
    return matchesSearch && matchesCategory;
  });

  const getCategoryLabel = (cat: string) => CATEGORIES.find(c => c.value === cat)?.label || cat;
  const getCategoryColor = (cat: string) => {
    const colors: Record<string, string> = {
      acquisition: 'bg-blue-100 text-blue-700',
      sublease: 'bg-purple-100 text-purple-700',
      setup: 'bg-green-100 text-green-700',
      corporate: 'bg-indigo-100 text-indigo-700',
      addendum: 'bg-orange-100 text-orange-700',
      general: 'bg-gray-100 text-gray-700'
    };
    return colors[cat] || colors.general;
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-[#d4a574]" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row gap-4 justify-between">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <FileSignature className="w-6 h-6 text-[#d4a574]" />
            Agreement Template Manager
          </h2>
          <p className="text-sm text-gray-500 mt-1">
            Create, edit, and manage custom agreement templates. {templates.length} template{templates.length !== 1 ? 's' : ''} total.
          </p>
        </div>
        <Button onClick={openCreateModal} className="bg-[#d4a574] hover:bg-[#c49464] self-start">
          <Plus className="w-4 h-4 mr-2" />New Template
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input aria-label="Search templates" type="text" placeholder="Search templates..." value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 h-10 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          />
        </div>
        <Select value={filterCategory} onValueChange={setFilterCategory}>
          <SelectTrigger className="w-48"><SelectValue placeholder="All Categories" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {CATEGORIES.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Button variant="outline" size="icon" aria-label="Refresh agreement templates" onClick={fetchTemplates}><RefreshCw className="w-4 h-4" /></Button>
      </div>

      {/* Template List */}
      {filteredTemplates.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <FileText className="w-12 h-12 mx-auto text-gray-300 mb-4" />
            <p className="text-gray-500 font-medium">
              {templates.length === 0 ? 'No templates yet' : 'No templates match your search'}
            </p>
            <p className="text-sm text-gray-400 mt-1">
              {templates.length === 0 ? 'Create your first agreement template to get started.' : 'Try adjusting your search or category filter.'}
            </p>
            {templates.length === 0 && (
              <Button onClick={openCreateModal} className="mt-4 bg-[#d4a574] hover:bg-[#c49464]">
                <Plus className="w-4 h-4 mr-2" />Create First Template
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {filteredTemplates.map(template => (
            <Card key={template.id} className={`transition-all hover:shadow-md ${!template.is_active ? 'opacity-60 border-dashed' : ''}`}>
              <CardContent className="p-5">
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-semibold text-gray-900 truncate">{template.name}</h3>
                      {!template.is_active && <Badge variant="outline" className="text-xs text-gray-400">Inactive</Badge>}
                    </div>
                    {template.description && (
                      <p className="text-sm text-gray-500 mt-1 line-clamp-2">{template.description}</p>
                    )}
                  </div>
                  <Badge className={`text-xs flex-shrink-0 ${getCategoryColor(template.category)}`}>
                    {getCategoryLabel(template.category)}
                  </Badge>
                </div>

                {/* Meta info */}
                <div className="flex items-center gap-3 text-xs text-gray-400 mb-3 flex-wrap">
                  <span className="flex items-center gap-1">
                    <Tag className="w-3 h-3" />v{template.version}
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {new Date(template.updated_at || template.created_at).toLocaleDateString()}
                  </span>
                  {template.created_by && (
                    <span>by {template.updated_by || template.created_by}</span>
                  )}
                  {template.placeholder_fields?.length > 0 && (
                    <span className="flex items-center gap-1">
                      <FileText className="w-3 h-3" />
                      {template.placeholder_fields.length} placeholder{template.placeholder_fields.length !== 1 ? 's' : ''}
                    </span>
                  )}
                </div>

                {/* Placeholder preview */}
                {template.placeholder_fields?.length > 0 && (
                  <div className="flex flex-wrap gap-1 mb-3">
                    {template.placeholder_fields.slice(0, 5).map((p, i) => (
                      <span key={i} className="text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded font-mono">{p}</span>
                    ))}
                    {template.placeholder_fields.length > 5 && (
                      <span className="text-xs text-gray-400">+{template.placeholder_fields.length - 5} more</span>
                    )}
                  </div>
                )}

                {/* Content preview */}
                <div className="bg-gray-50 rounded-lg p-3 mb-3 max-h-20 overflow-hidden relative">
                  <p className="text-xs text-gray-600 font-mono whitespace-pre-wrap line-clamp-3">
                    {template.content.substring(0, 200)}...
                  </p>
                  <div className="absolute bottom-0 left-0 right-0 h-6 bg-gradient-to-t from-gray-50 to-transparent" />
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 flex-wrap">
                  <Button variant="outline" size="sm" onClick={() => openPreview(template)}>
                    <Eye className="w-3.5 h-3.5 mr-1" />Preview
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => openEditModal(template)}>
                    <Edit2 className="w-3.5 h-3.5 mr-1" />Edit
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => handleDuplicate(template)}>
                    <Copy className="w-3.5 h-3.5 mr-1" />Duplicate
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => openVersionHistory(template)}>
                    <History className="w-3.5 h-3.5 mr-1" />History
                  </Button>
                  <div className="flex-1" />
                  <Button variant="ghost" size="sm" className="text-gray-400 hover:text-gray-600"
                    onClick={() => handleToggleActive(template)}>
                    {template.is_active ? 'Deactivate' : 'Activate'}
                  </Button>
                  <Button variant="ghost" size="sm" className="text-red-400 hover:text-red-600 hover:bg-red-50"
                    onClick={() => setDeleteConfirm(template.id)}>
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Editor Modal */}
      <Dialog open={showEditor} onOpenChange={setShowEditor}>
        <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
          <DialogHeader className="flex-shrink-0">
            <DialogTitle className="flex items-center gap-2">
              {editingTemplate ? <Edit2 className="w-5 h-5 text-[#d4a574]" /> : <Plus className="w-5 h-5 text-[#d4a574]" />}
              {editingTemplate ? 'Edit Template' : 'Create New Template'}
            </DialogTitle>
            <DialogDescription>
              {editingTemplate 
                ? `Editing "${editingTemplate.name}" (v${editingTemplate.version}). Changes will create a new version.`
                : 'Create a new agreement template with placeholder fields.'}
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto space-y-4 min-h-0 pr-1">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="template-name">Template Name *</Label>
                <input id="template-name" type="text" placeholder="e.g., Standard Acquisition Agreement" value={editorForm.name}
                  onChange={(e) => setEditorForm({ ...editorForm, name: e.target.value })}
                  className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                />
              </div>
              <div>
                <Label>Category</Label>
                <Select value={editorForm.category} onValueChange={(v) => setEditorForm({ ...editorForm, category: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label htmlFor="description-optional">Description (optional)</Label>
              <input id="description-optional" type="text" placeholder="Brief description of when to use this template..." value={editorForm.description}
                onChange={(e) => setEditorForm({ ...editorForm, description: e.target.value })}
                className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              />
            </div>

            {/* Common Placeholders Reference */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <p className="text-xs font-medium text-blue-700 mb-2">Available Placeholders (click to insert):</p>
              <div className="flex flex-wrap gap-1">
                {COMMON_PLACEHOLDERS.map(p => (
                  <button key={p} onClick={() => {
                    setEditorForm(prev => ({ ...prev, content: prev.content + ' ' + p }));
                  }}
                    className="text-xs bg-white border border-blue-200 text-blue-700 px-2 py-0.5 rounded font-mono hover:bg-blue-100 transition-colors">
                    {p}
                  </button>
                ))}
              </div>
            </div>

            {/* Content Editor */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <Label>Agreement Content *</Label>
                <span className="text-xs text-gray-400">
                  {editorForm.content.length.toLocaleString()} characters | {extractPlaceholders(editorForm.content).length} placeholders detected
                </span>
              </div>
              <textarea
                value={editorForm.content}
                onChange={(e) => setEditorForm({ ...editorForm, content: e.target.value })}
                rows={20}
                placeholder="Enter the full agreement text here. Use {{PLACEHOLDER}} or [PLACEHOLDER] syntax for dynamic fields..."
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 resize-y min-h-[300px]"
              />
            </div>

            {/* Detected Placeholders */}
            {editorForm.content && extractPlaceholders(editorForm.content).length > 0 && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                <p className="text-xs font-medium text-green-700 mb-2 flex items-center gap-1">
                  <CheckCircle className="w-3 h-3" />
                  Detected Placeholders ({extractPlaceholders(editorForm.content).length}):
                </p>
                <div className="flex flex-wrap gap-1">
                  {extractPlaceholders(editorForm.content).map((p, i) => (
                    <span key={i} className="text-xs bg-white border border-green-200 text-green-700 px-2 py-0.5 rounded font-mono">{p}</span>
                  ))}
                </div>
              </div>
            )}

            {/* Change Notes (for edits) */}
            {editingTemplate && (
              <div>
                <Label htmlFor="change-notes-optional">Change Notes (optional)</Label>
                <input id="change-notes-optional" type="text" placeholder="What changed in this version?" value={editorForm.change_notes}
                  onChange={(e) => setEditorForm({ ...editorForm, change_notes: e.target.value })}
                  className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                />
              </div>
            )}
          </div>

          <DialogFooter className="flex-shrink-0 gap-2 border-t pt-4">
            <Button variant="outline" onClick={() => setShowEditor(false)}>Cancel</Button>
            <Button variant="outline" onClick={() => {
              let preview = editorForm.content;
              preview = preview.replace(/\{\{DATE\}\}/g, new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }));
              preview = preview.replace(/\{\{STAFF_NAME\}\}/g, staffName);
              setPreviewContent(preview);
              setPreviewName(editorForm.name || 'Untitled Template');
              setShowPreview(true);
            }}>
              <Eye className="w-4 h-4 mr-2" />Preview
            </Button>
            <Button onClick={handleSave} disabled={saving || !editorForm.name.trim() || !editorForm.content.trim()}
              className="bg-[#d4a574] hover:bg-[#c49464]">
              {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
              {editingTemplate ? 'Save Changes' : 'Create Template'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Preview Modal */}
      <Dialog open={showPreview} onOpenChange={setShowPreview}>
        <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col">
          <DialogHeader className="flex-shrink-0">
            <DialogTitle className="flex items-center gap-2">
              <Eye className="w-5 h-5 text-blue-600" />
              Template Preview: {previewName}
            </DialogTitle>
            <DialogDescription>
              This is how the agreement will look with sample data filled in. Remaining placeholders are shown in brackets.
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto min-h-0">
            <div className="bg-white border rounded-lg p-8 shadow-inner">
              <pre className="whitespace-pre-wrap text-sm text-gray-700 font-sans leading-relaxed">
                {previewContent || 'No content to preview'}
              </pre>
            </div>
          </div>
          <DialogFooter className="flex-shrink-0">
            <Button variant="outline" onClick={() => setShowPreview(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Version History Modal */}
      <Dialog open={showVersions} onOpenChange={setShowVersions}>
        <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
          <DialogHeader className="flex-shrink-0">
            <DialogTitle className="flex items-center gap-2">
              <History className="w-5 h-5 text-[#1a365d]" />
              Version History: {versionsTemplateName}
            </DialogTitle>
            <DialogDescription>
              View previous versions and restore if needed.
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto min-h-0">
            {loadingVersions ? (
              <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-[#d4a574]" /></div>
            ) : versions.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <History className="w-10 h-10 mx-auto text-gray-300 mb-3" />
                <p>No version history yet</p>
                <p className="text-sm text-gray-400 mt-1">Versions are created each time you edit and save a template.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {versions.map(version => (
                  <Card key={version.id}>
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <Badge variant="outline" className="text-xs">v{version.version}</Badge>
                            <span className="text-sm font-medium">{version.name}</span>
                          </div>
                          <div className="flex items-center gap-3 text-xs text-gray-500">
                            <span className="flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {new Date(version.created_at).toLocaleString()}
                            </span>
                            {version.created_by && <span>by {version.created_by}</span>}
                          </div>
                          {version.change_notes && (
                            <p className="text-sm text-gray-600 mt-2 bg-gray-50 rounded p-2">{version.change_notes}</p>
                          )}
                          <div className="mt-2 bg-gray-50 rounded p-2 max-h-20 overflow-hidden relative">
                            <p className="text-xs text-gray-500 font-mono line-clamp-3">{version.content.substring(0, 200)}...</p>
                            <div className="absolute bottom-0 left-0 right-0 h-4 bg-gradient-to-t from-gray-50 to-transparent" />
                          </div>
                        </div>
                        <Button variant="outline" size="sm" onClick={() => restoreVersion(version)}>
                          Restore
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
          <DialogFooter className="flex-shrink-0">
            <Button variant="outline" onClick={() => setShowVersions(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <Dialog open={!!deleteConfirm} onOpenChange={(open) => !open && setDeleteConfirm(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <AlertCircle className="w-5 h-5" />
              Delete Template?
            </DialogTitle>
            <DialogDescription>
              This will permanently delete this template and all its version history. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirm(null)}>Cancel</Button>
            <Button variant="destructive" onClick={() => deleteConfirm && handleDelete(deleteConfirm)}>
              <Trash2 className="w-4 h-4 mr-2" />Delete Template
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
