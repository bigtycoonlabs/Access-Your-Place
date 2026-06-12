import { useState, useRef, useCallback, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Switch } from '@/components/ui/switch';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';
import {
  Loader2, Save, Eye, Plus, Trash2, GripVertical, Type, Image, Link2,
  Square, Minus, AlignLeft, AlignCenter, AlignRight, Bold, Italic,
  Copy, Code, Palette, Mail, Send, ChevronUp, ChevronDown, Settings,
  FileText, Sparkles, Variable, MousePointer2
} from 'lucide-react';

// Content block types
type BlockType = 'header' | 'text' | 'button' | 'image' | 'divider' | 'spacer' | 'columns';

interface ContentBlock {
  id: string;
  type: BlockType;
  content: string;
  settings: {
    alignment?: 'left' | 'center' | 'right';
    fontSize?: string;
    fontWeight?: string;
    color?: string;
    backgroundColor?: string;
    padding?: string;
    buttonUrl?: string;
    imageUrl?: string;
    imageAlt?: string;
    height?: string;
    columns?: { content: string }[];
  };
}

interface EmailTemplate {
  id?: string;
  name: string;
  subject: string;
  category: string;
  blocks: ContentBlock[];
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

// Available dynamic variables
const dynamicVariables = [
  { key: 'investor_name', label: 'Investor Name', example: 'John Smith' },
  { key: 'investor_email', label: 'Investor Email', example: 'john@example.com' },
  { key: 'investor_phone', label: 'Investor Phone', example: '(555) 123-4567' },
  { key: 'property_address', label: 'Property Address', example: '123 Main St, Austin, TX' },
  { key: 'property_price', label: 'Property Price', example: '$350,000' },
  { key: 'projected_profit', label: 'Projected Profit', example: '$2,500/mo' },
  { key: 'bedrooms', label: 'Bedrooms', example: '3' },
  { key: 'bathrooms', label: 'Bathrooms', example: '2' },
  { key: 'manager_name', label: 'Manager Name', example: 'Sarah Johnson' },
  { key: 'manager_email', label: 'Manager Email', example: 'sarah@accessyourplace.com' },
  { key: 'portal_link', label: 'Portal Link', example: 'https://accessyourplace.com/portal' },
  { key: 'deal_link', label: 'Deal Link', example: 'https://accessyourplace.com/deals/123' },
  { key: 'document_name', label: 'Document Name', example: 'Lease Agreement' },
  { key: 'signing_link', label: 'Signing Link', example: 'https://accessyourplace.com/sign/abc' },
  { key: 'amount', label: 'Amount', example: '$499.00' },
  { key: 'hours_remaining', label: 'Hours Remaining', example: '12' },
  { key: 'current_date', label: 'Current Date', example: new Date().toLocaleDateString() },
];

const blockTypes: { type: BlockType; label: string; icon: any; description: string }[] = [
  { type: 'header', label: 'Header', icon: Type, description: 'Large heading text' },
  { type: 'text', label: 'Text', icon: AlignLeft, description: 'Paragraph content' },
  { type: 'button', label: 'Button', icon: MousePointer2, description: 'Call-to-action button' },
  { type: 'image', label: 'Image', icon: Image, description: 'Add an image' },
  { type: 'divider', label: 'Divider', icon: Minus, description: 'Horizontal line' },
  { type: 'spacer', label: 'Spacer', icon: Square, description: 'Empty space' },
];

const createBlock = (type: BlockType): ContentBlock => {
  const id = `block-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  const defaults: Record<BlockType, Partial<ContentBlock>> = {
    header: { content: 'Your Heading Here', settings: { alignment: 'center', fontSize: '24px', fontWeight: 'bold', color: '#1a365d' } },
    text: { content: 'Add your text content here. You can use {{investor_name}} to personalize.', settings: { alignment: 'left', fontSize: '16px', color: '#374151' } },
    button: { content: 'Click Here', settings: { alignment: 'center', backgroundColor: '#d4a574', color: '#ffffff', buttonUrl: '{{portal_link}}', padding: '12px 24px' } },
    image: { content: '', settings: { alignment: 'center', imageUrl: '', imageAlt: 'Image description' } },
    divider: { content: '', settings: { color: '#e5e7eb', height: '1px' } },
    spacer: { content: '', settings: { height: '20px' } },
    columns: { content: '', settings: { columns: [{ content: 'Column 1' }, { content: 'Column 2' }] } },
  };
  return { id, type, ...defaults[type] } as ContentBlock;
};

export function EmailTemplateBuilder() {
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<EmailTemplate | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewHtml, setPreviewHtml] = useState('');
  const [editingBlock, setEditingBlock] = useState<ContentBlock | null>(null);
  const [draggedBlock, setDraggedBlock] = useState<string | null>(null);
  const [newTemplateName, setNewTemplateName] = useState('');
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const { toast } = useToast();
  const dragOverRef = useRef<string | null>(null);

  useEffect(() => {
    fetchTemplates();
  }, []);

  const fetchTemplates = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('manage-email-templates', {
        body: { action: 'list_custom_templates' }
      });
      if (data?.templates) {
        setTemplates(data.templates);
      }
    } catch (err) {
      console.error('Error fetching templates:', err);
    }
    setLoading(false);
  };

  const handleCreateTemplate = async () => {
    if (!newTemplateName.trim()) return;
    
    const newTemplate: EmailTemplate = {
      name: newTemplateName,
      subject: 'New Email Subject',
      category: 'custom',
      blocks: [
        createBlock('header'),
        createBlock('text'),
        createBlock('button'),
      ],
      is_active: true,
    };
    
    setSaving(true);
    try {
      const { data, error } = await supabase.functions.invoke('manage-email-templates', {
        body: { action: 'create_custom_template', template: newTemplate }
      });
      
      if (error) throw error;
      
      toast({ title: 'Template created successfully!' });
      setNewTemplateName('');
      setCreateDialogOpen(false);
      fetchTemplates();
      if (data?.template) {
        setSelectedTemplate(data.template);
      }
    } catch (err) {
      toast({ title: 'Failed to create template', variant: 'destructive' });
    }
    setSaving(false);
  };

  const handleSaveTemplate = async () => {
    if (!selectedTemplate) return;
    
    setSaving(true);
    try {
      const { error } = await supabase.functions.invoke('manage-email-templates', {
        body: { action: 'update_custom_template', template: selectedTemplate }
      });
      
      if (error) throw error;
      
      toast({ title: 'Template saved successfully!' });
      fetchTemplates();
    } catch (err) {
      toast({ title: 'Failed to save template', variant: 'destructive' });
    }
    setSaving(false);
  };

  const handleDeleteTemplate = async () => {
    if (!selectedTemplate?.id) return;
    
    if (!confirm('Are you sure you want to delete this template?')) return;
    
    try {
      await supabase.functions.invoke('manage-email-templates', {
        body: { action: 'delete_custom_template', template_id: selectedTemplate.id }
      });
      
      toast({ title: 'Template deleted' });
      setSelectedTemplate(null);
      fetchTemplates();
    } catch (err) {
      toast({ title: 'Failed to delete template', variant: 'destructive' });
    }
  };

  const addBlock = (type: BlockType) => {
    if (!selectedTemplate) return;
    const newBlock = createBlock(type);
    setSelectedTemplate({
      ...selectedTemplate,
      blocks: [...selectedTemplate.blocks, newBlock]
    });
    // Announce to screen readers
    const announcement = document.getElementById('sr-announcement');
    if (announcement) {
      announcement.textContent = `${type} block added to template`;
    }
  };

  const removeBlock = (blockId: string) => {
    if (!selectedTemplate) return;
    setSelectedTemplate({
      ...selectedTemplate,
      blocks: selectedTemplate.blocks.filter(b => b.id !== blockId)
    });
  };

  const moveBlock = (blockId: string, direction: 'up' | 'down') => {
    if (!selectedTemplate) return;
    const blocks = [...selectedTemplate.blocks];
    const index = blocks.findIndex(b => b.id === blockId);
    if (index === -1) return;
    
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= blocks.length) return;
    
    [blocks[index], blocks[newIndex]] = [blocks[newIndex], blocks[index]];
    setSelectedTemplate({ ...selectedTemplate, blocks });
  };

  const updateBlock = (blockId: string, updates: Partial<ContentBlock>) => {
    if (!selectedTemplate) return;
    setSelectedTemplate({
      ...selectedTemplate,
      blocks: selectedTemplate.blocks.map(b => 
        b.id === blockId ? { ...b, ...updates } : b
      )
    });
  };

  const insertVariable = (variable: string, targetField: 'content' | 'subject') => {
    const varString = `{{${variable}}}`;
    if (targetField === 'subject' && selectedTemplate) {
      setSelectedTemplate({
        ...selectedTemplate,
        subject: selectedTemplate.subject + varString
      });
    } else if (editingBlock) {
      updateBlock(editingBlock.id, {
        content: editingBlock.content + varString
      });
      setEditingBlock({ ...editingBlock, content: editingBlock.content + varString });
    }
    toast({ title: `Variable {{${variable}}} inserted` });
  };

  const generatePreviewHtml = (): string => {
    if (!selectedTemplate) return '';
    
    let html = `
      <div style="max-width: 600px; margin: 0 auto; font-family: Arial, sans-serif; background-color: #ffffff;">
        <div style="background: linear-gradient(135deg, #1a365d 0%, #2d5a87 100%); padding: 20px; text-align: center;">
          <img src="https://accessyourplace.com/logo-white.png" alt="Access Your Place" style="height: 40px;" onerror="this.style.display='none'"/>
        </div>
        <div style="padding: 30px;">
    `;
    
    // Replace variables with sample data
    const sampleData: Record<string, string> = {};
    dynamicVariables.forEach(v => { sampleData[v.key] = v.example; });
    
    selectedTemplate.blocks.forEach(block => {
      let content = block.content;
      Object.entries(sampleData).forEach(([key, value]) => {
        content = content.replace(new RegExp(`{{${key}}}`, 'g'), value);
      });
      
      switch (block.type) {
        case 'header':
          html += `<h1 style="text-align: ${block.settings.alignment}; font-size: ${block.settings.fontSize}; font-weight: ${block.settings.fontWeight}; color: ${block.settings.color}; margin: 20px 0;">${content}</h1>`;
          break;
        case 'text':
          html += `<p style="text-align: ${block.settings.alignment}; font-size: ${block.settings.fontSize}; color: ${block.settings.color}; line-height: 1.6; margin: 15px 0;">${content}</p>`;
          break;
        case 'button':
          let buttonUrl = block.settings.buttonUrl || '#';
          Object.entries(sampleData).forEach(([key, value]) => {
            buttonUrl = buttonUrl.replace(new RegExp(`{{${key}}}`, 'g'), value);
          });
          html += `<div style="text-align: ${block.settings.alignment}; margin: 25px 0;"><a href="${buttonUrl}" style="display: inline-block; background-color: ${block.settings.backgroundColor}; color: ${block.settings.color}; padding: ${block.settings.padding}; text-decoration: none; border-radius: 6px; font-weight: 600;">${content}</a></div>`;
          break;
        case 'image':
          if (block.settings.imageUrl) {
            html += `<div style="text-align: ${block.settings.alignment}; margin: 20px 0;"><img src="${block.settings.imageUrl}" alt="${block.settings.imageAlt}" style="max-width: 100%; height: auto; border-radius: 8px;"/></div>`;
          }
          break;
        case 'divider':
          html += `<hr style="border: none; border-top: ${block.settings.height} solid ${block.settings.color}; margin: 25px 0;"/>`;
          break;
        case 'spacer':
          html += `<div style="height: ${block.settings.height};"></div>`;
          break;
      }
    });
    
    html += `
        </div>
        <div style="background-color: #f3f4f6; padding: 20px; text-align: center; font-size: 12px; color: #6b7280;">
          <p>Access Your Place | Rental Arbitrage Deals</p>
          <p><a href="{{unsubscribe_link}}" style="color: #6b7280;">Unsubscribe</a></p>
        </div>
      </div>
    `;
    
    return html;
  };

  const handlePreview = () => {
    const html = generatePreviewHtml();
    setPreviewHtml(html);
    setPreviewOpen(true);
  };

  // Drag and drop handlers
  const handleDragStart = (e: React.DragEvent, blockId: string) => {
    setDraggedBlock(blockId);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent, blockId: string) => {
    e.preventDefault();
    dragOverRef.current = blockId;
  };

  const handleDrop = (e: React.DragEvent, targetBlockId: string) => {
    e.preventDefault();
    if (!selectedTemplate || !draggedBlock || draggedBlock === targetBlockId) return;
    
    const blocks = [...selectedTemplate.blocks];
    const draggedIndex = blocks.findIndex(b => b.id === draggedBlock);
    const targetIndex = blocks.findIndex(b => b.id === targetBlockId);
    
    if (draggedIndex === -1 || targetIndex === -1) return;
    
    const [removed] = blocks.splice(draggedIndex, 1);
    blocks.splice(targetIndex, 0, removed);
    
    setSelectedTemplate({ ...selectedTemplate, blocks });
    setDraggedBlock(null);
  };

  const handleDragEnd = () => {
    setDraggedBlock(null);
    dragOverRef.current = null;
  };

  // Keyboard navigation for blocks
  const handleBlockKeyDown = (e: React.KeyboardEvent, block: ContentBlock, index: number) => {
    if (e.key === 'ArrowUp' && e.altKey) {
      e.preventDefault();
      moveBlock(block.id, 'up');
    } else if (e.key === 'ArrowDown' && e.altKey) {
      e.preventDefault();
      moveBlock(block.id, 'down');
    } else if (e.key === 'Delete' && e.altKey) {
      e.preventDefault();
      removeBlock(block.id);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      setEditingBlock(block);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center p-12">
        <Loader2 className="w-8 h-8 animate-spin text-[#1e3a5f]" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Screen reader announcements */}
      <div id="sr-announcement" className="sr-only" aria-live="polite" aria-atomic="true"></div>
      
      {/* Header */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-[#d4a574]" aria-hidden="true" />
                Email Template Builder
              </CardTitle>
              <CardDescription>
                Create and edit email templates with drag-and-drop blocks and dynamic variables
              </CardDescription>
            </div>
            <Button onClick={() => setCreateDialogOpen(true)} className="bg-[#1e3a5f]">
              <Plus className="w-4 h-4 mr-2" aria-hidden="true" />
              New Template
            </Button>
          </div>
        </CardHeader>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Template List */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="text-lg">Templates</CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[400px]">
              <div className="space-y-2" role="listbox" aria-label="Email templates">
                {templates.length === 0 ? (
                  <p className="text-sm text-gray-500 text-center py-4">No custom templates yet</p>
                ) : (
                  templates.map(template => (
                    <button
                      key={template.id}
                      onClick={() => setSelectedTemplate(template)}
                      className={`w-full text-left p-3 rounded-lg border transition-all ${
                        selectedTemplate?.id === template.id
                          ? 'border-[#1e3a5f] bg-blue-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                      role="option"
                      aria-selected={selectedTemplate?.id === template.id}
                    >
                      <p className="font-medium text-sm truncate">{template.name}</p>
                      <p className="text-xs text-gray-500 truncate">{template.subject}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant={template.is_active ? 'default' : 'secondary'} className="text-xs">
                          {template.is_active ? 'Active' : 'Inactive'}
                        </Badge>
                        <span className="text-xs text-gray-400">{template.blocks?.length || 0} blocks</span>
                      </div>
                    </button>
                  ))
                )}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Editor */}
        <Card className="lg:col-span-3">
          {selectedTemplate ? (
            <>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex-1 mr-4">
                    <Input
                      value={selectedTemplate.name}
                      onChange={(e) => setSelectedTemplate({ ...selectedTemplate, name: e.target.value })}
                      className="text-lg font-semibold border-none p-0 h-auto focus-visible:ring-0"
                      aria-label="Template name"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-2">
                      <Label htmlFor="template-active" className="text-sm">Active</Label>
                      <Switch
                        id="template-active"
                        checked={selectedTemplate.is_active}
                        onCheckedChange={(v) => setSelectedTemplate({ ...selectedTemplate, is_active: v })}
                      />
                    </div>
                    <Button variant="outline" onClick={handlePreview}>
                      <Eye className="w-4 h-4 mr-2" aria-hidden="true" />
                      Preview
                    </Button>
                    <Button variant="outline" onClick={handleDeleteTemplate} className="text-red-600">
                      <Trash2 className="w-4 h-4" aria-hidden="true" />
                    </Button>
                    <Button onClick={handleSaveTemplate} disabled={saving} className="bg-[#d4a574]">
                      {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" aria-hidden="true" /> : <Save className="w-4 h-4 mr-2" aria-hidden="true" />}
                      Save
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Subject Line */}
                <div>
                  <Label htmlFor="subject-line">Subject Line</Label>
                  <div className="flex gap-2 mt-1">
                    <Input
                      id="subject-line"
                      value={selectedTemplate.subject}
                      onChange={(e) => setSelectedTemplate({ ...selectedTemplate, subject: e.target.value })}
                      placeholder="Email subject..."
                      className="flex-1"
                    />
                    <Select onValueChange={(v) => insertVariable(v, 'subject')}>
                      <SelectTrigger className="w-[180px]">
                        <SelectValue placeholder="Insert variable" />
                      </SelectTrigger>
                      <SelectContent>
                        {dynamicVariables.map(v => (
                          <SelectItem key={v.key} value={v.key}>{v.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                  {/* Block Palette */}
                  <div>
                    <Label className="mb-2 block">Add Content Blocks</Label>
                    <div className="grid grid-cols-2 gap-2" role="toolbar" aria-label="Content block types">
                      {blockTypes.map(({ type, label, icon: Icon, description }) => (
                        <Button
                          key={type}
                          variant="outline"
                          className="h-auto py-3 flex flex-col items-center gap-1"
                          onClick={() => addBlock(type)}
                          aria-label={`Add ${label} block: ${description}`}
                        >
                          <Icon className="w-5 h-5" aria-hidden="true" />
                          <span className="text-xs">{label}</span>
                        </Button>
                      ))}
                    </div>
                    
                    {/* Variables Reference */}
                    <div className="mt-4">
                      <Label className="mb-2 block">Dynamic Variables</Label>
                      <ScrollArea className="h-[200px] border rounded-lg p-2">
                        <div className="space-y-1">
                          {dynamicVariables.map(v => (
                            <button
                              key={v.key}
                              onClick={() => {
                                navigator.clipboard.writeText(`{{${v.key}}}`);
                                toast({ title: `Copied {{${v.key}}}` });
                              }}
                              className="w-full text-left p-2 rounded hover:bg-gray-100 text-xs"
                              aria-label={`Copy ${v.label} variable`}
                            >
                              <code className="text-[#1e3a5f] font-mono">{`{{${v.key}}}`}</code>
                              <p className="text-gray-500 mt-0.5">{v.label}</p>
                            </button>
                          ))}
                        </div>
                      </ScrollArea>
                    </div>
                  </div>

                  {/* Block List */}
                  <div className="lg:col-span-2">
                    <Label className="mb-2 block">Email Content</Label>
                    <p className="text-xs text-gray-500 mb-2">
                      Drag blocks to reorder, or use Alt+Arrow keys. Press Enter to edit, Alt+Delete to remove.
                    </p>
                    <div 
                      className="border rounded-lg p-4 min-h-[400px] bg-gray-50"
                      role="list"
                      aria-label="Email content blocks"
                    >
                      {selectedTemplate.blocks.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-[300px] text-gray-400">
                          <FileText className="w-12 h-12 mb-2" aria-hidden="true" />
                          <p>Add content blocks to build your email</p>
                        </div>
                      ) : (
                        selectedTemplate.blocks.map((block, index) => (
                          <div
                            key={block.id}
                            draggable
                            onDragStart={(e) => handleDragStart(e, block.id)}
                            onDragOver={(e) => handleDragOver(e, block.id)}
                            onDrop={(e) => handleDrop(e, block.id)}
                            onDragEnd={handleDragEnd}
                            onKeyDown={(e) => handleBlockKeyDown(e, block, index)}
                            tabIndex={0}
                            role="listitem"
                            aria-label={`${block.type} block ${index + 1} of ${selectedTemplate.blocks.length}`}
                            className={`group bg-white border rounded-lg p-3 mb-2 cursor-move transition-all ${
                              draggedBlock === block.id ? 'opacity-50' : ''
                            } ${dragOverRef.current === block.id ? 'border-[#d4a574] border-2' : ''} focus:ring-2 focus:ring-[#1e3a5f] focus:outline-none`}
                          >
                            <div className="flex items-start gap-2">
                              <div className="flex flex-col items-center gap-1 pt-1">
                                <GripVertical className="w-4 h-4 text-gray-400" aria-hidden="true" />
                                <button
                                  onClick={() => moveBlock(block.id, 'up')}
                                  disabled={index === 0}
                                  className="p-1 hover:bg-gray-100 rounded disabled:opacity-30"
                                  aria-label="Move block up"
                                >
                                  <ChevronUp className="w-3 h-3" aria-hidden="true" />
                                </button>
                                <button
                                  onClick={() => moveBlock(block.id, 'down')}
                                  disabled={index === selectedTemplate.blocks.length - 1}
                                  className="p-1 hover:bg-gray-100 rounded disabled:opacity-30"
                                  aria-label="Move block down"
                                >
                                  <ChevronDown className="w-3 h-3" aria-hidden="true" />
                                </button>
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-2">
                                  <Badge variant="outline" className="text-xs capitalize">{block.type}</Badge>
                                  <button
                                    onClick={() => setEditingBlock(block)}
                                    className="text-xs text-[#1e3a5f] hover:underline"
                                    aria-label={`Edit ${block.type} block`}
                                  >
                                    Edit
                                  </button>
                                </div>
                                <p className="text-sm text-gray-600 truncate">
                                  {block.content || (block.type === 'divider' ? '— Divider —' : block.type === 'spacer' ? `Spacer (${block.settings.height})` : 'No content')}
                                </p>
                              </div>
                              <button
                                onClick={() => removeBlock(block.id)}
                                className="p-1 text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                                aria-label={`Remove ${block.type} block`}
                              >
                                <Trash2 className="w-4 h-4" aria-hidden="true" />
                              </button>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </>
          ) : (
            <CardContent className="flex flex-col items-center justify-center py-16">
              <Mail className="w-16 h-16 text-gray-300 mb-4" aria-hidden="true" />
              <p className="text-gray-500 mb-4">Select a template to edit or create a new one</p>
              <Button onClick={() => setCreateDialogOpen(true)} className="bg-[#1e3a5f]">
                <Plus className="w-4 h-4 mr-2" aria-hidden="true" />
                Create Template
              </Button>
            </CardContent>
          )}
        </Card>
      </div>

      {/* Block Editor Dialog */}
      <Dialog open={!!editingBlock} onOpenChange={(open) => !open && setEditingBlock(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="capitalize">Edit {editingBlock?.type} Block</DialogTitle>
            <DialogDescription>Customize the content and appearance of this block</DialogDescription>
          </DialogHeader>
          {editingBlock && (
            <div className="space-y-4">
              {/* Content */}
              {editingBlock.type !== 'divider' && editingBlock.type !== 'spacer' && (
                <div>
                  <Label htmlFor="block-content">Content</Label>
                  <Textarea
                    id="block-content"
                    value={editingBlock.content}
                    onChange={(e) => setEditingBlock({ ...editingBlock, content: e.target.value })}
                    rows={3}
                    className="mt-1"
                  />
                  <div className="flex flex-wrap gap-1 mt-2">
                    {dynamicVariables.slice(0, 6).map(v => (
                      <Button
                        key={v.key}
                        variant="outline"
                        size="sm"
                        className="text-xs h-7"
                        onClick={() => insertVariable(v.key, 'content')}
                      >
                        <Variable className="w-3 h-3 mr-1" aria-hidden="true" />
                        {v.label}
                      </Button>
                    ))}
                  </div>
                </div>
              )}

              {/* Alignment */}
              {editingBlock.type !== 'divider' && editingBlock.type !== 'spacer' && (
                <div>
                  <Label>Alignment</Label>
                  <div className="flex gap-2 mt-1" role="radiogroup" aria-label="Text alignment">
                    {(['left', 'center', 'right'] as const).map(align => (
                      <Button
                        key={align}
                        variant={editingBlock.settings.alignment === align ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setEditingBlock({
                          ...editingBlock,
                          settings: { ...editingBlock.settings, alignment: align }
                        })}
                        aria-pressed={editingBlock.settings.alignment === align}
                      >
                        {align === 'left' && <AlignLeft className="w-4 h-4" aria-hidden="true" />}
                        {align === 'center' && <AlignCenter className="w-4 h-4" aria-hidden="true" />}
                        {align === 'right' && <AlignRight className="w-4 h-4" aria-hidden="true" />}
                      </Button>
                    ))}
                  </div>
                </div>
              )}

              {/* Colors */}
              {(editingBlock.type === 'header' || editingBlock.type === 'text') && (
                <div>
                  <Label htmlFor="block-color">Text Color</Label>
                  <Input
                    id="block-color"
                    type="color"
                    value={editingBlock.settings.color || '#374151'}
                    onChange={(e) => setEditingBlock({
                      ...editingBlock,
                      settings: { ...editingBlock.settings, color: e.target.value }
                    })}
                    className="w-20 h-10 mt-1"
                  />
                </div>
              )}

              {/* Button specific */}
              {editingBlock.type === 'button' && (
                <>
                  <div>
                    <Label htmlFor="button-url">Button URL</Label>
                    <Input
                      id="button-url"
                      value={editingBlock.settings.buttonUrl || ''}
                      onChange={(e) => setEditingBlock({
                        ...editingBlock,
                        settings: { ...editingBlock.settings, buttonUrl: e.target.value }
                      })}
                      placeholder="https://... or {{portal_link}}"
                      className="mt-1"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="button-bg">Background Color</Label>
                      <Input
                        id="button-bg"
                        type="color"
                        value={editingBlock.settings.backgroundColor || '#d4a574'}
                        onChange={(e) => setEditingBlock({
                          ...editingBlock,
                          settings: { ...editingBlock.settings, backgroundColor: e.target.value }
                        })}
                        className="w-20 h-10 mt-1"
                      />
                    </div>
                    <div>
                      <Label htmlFor="button-text-color">Text Color</Label>
                      <Input
                        id="button-text-color"
                        type="color"
                        value={editingBlock.settings.color || '#ffffff'}
                        onChange={(e) => setEditingBlock({
                          ...editingBlock,
                          settings: { ...editingBlock.settings, color: e.target.value }
                        })}
                        className="w-20 h-10 mt-1"
                      />
                    </div>
                  </div>
                </>
              )}

              {/* Image specific */}
              {editingBlock.type === 'image' && (
                <>
                  <div>
                    <Label htmlFor="image-url">Image URL</Label>
                    <Input
                      id="image-url"
                      value={editingBlock.settings.imageUrl || ''}
                      onChange={(e) => setEditingBlock({
                        ...editingBlock,
                        settings: { ...editingBlock.settings, imageUrl: e.target.value }
                      })}
                      placeholder="https://..."
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label htmlFor="image-alt">Alt Text (for accessibility)</Label>
                    <Input
                      id="image-alt"
                      value={editingBlock.settings.imageAlt || ''}
                      onChange={(e) => setEditingBlock({
                        ...editingBlock,
                        settings: { ...editingBlock.settings, imageAlt: e.target.value }
                      })}
                      placeholder="Describe the image"
                      className="mt-1"
                    />
                  </div>
                </>
              )}

              {/* Spacer height */}
              {editingBlock.type === 'spacer' && (
                <div>
                  <Label htmlFor="spacer-height">Height</Label>
                  <Select
                    value={editingBlock.settings.height || '20px'}
                    onValueChange={(v) => setEditingBlock({
                      ...editingBlock,
                      settings: { ...editingBlock.settings, height: v }
                    })}
                  >
                    <SelectTrigger id="spacer-height" className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="10px">Small (10px)</SelectItem>
                      <SelectItem value="20px">Medium (20px)</SelectItem>
                      <SelectItem value="40px">Large (40px)</SelectItem>
                      <SelectItem value="60px">Extra Large (60px)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingBlock(null)}>Cancel</Button>
            <Button
              onClick={() => {
                if (editingBlock) {
                  updateBlock(editingBlock.id, editingBlock);
                  setEditingBlock(null);
                }
              }}
              className="bg-[#d4a574]"
            >
              Apply Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Template Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Template</DialogTitle>
            <DialogDescription>Enter a name for your new email template</DialogDescription>
          </DialogHeader>
          <div>
            <Label htmlFor="new-template-name">Template Name</Label>
            <Input
              id="new-template-name"
              value={newTemplateName}
              onChange={(e) => setNewTemplateName(e.target.value)}
              placeholder="e.g., Welcome Email, Deal Alert..."
              className="mt-1"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleCreateTemplate} disabled={saving || !newTemplateName.trim()} className="bg-[#1e3a5f]">
              {saving && <Loader2 className="w-4 h-4 animate-spin mr-2" aria-hidden="true" />}
              Create Template
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Preview Dialog */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Eye className="w-5 h-5" aria-hidden="true" />
              Email Preview
            </DialogTitle>
            <DialogDescription>
              Preview with sample data. Subject: {selectedTemplate?.subject}
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto border rounded-lg">
            <div
              dangerouslySetInnerHTML={{ __html: previewHtml }}
              className="bg-gray-100 p-4"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPreviewOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
