
import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Loader2, Plus, Trash2, GripVertical, Save, FolderOpen, Eye,
  ChevronUp, ChevronDown, Copy, Settings2, FileText, X, Check,
  AlertTriangle, Type, AlignLeft, Calendar, List
} from 'lucide-react';

interface IntakeField {
  id: string;
  label: string;
  type: 'text' | 'textarea' | 'select' | 'date';
  required: boolean;
  placeholder?: string;
  options?: string[];
}

interface FormTemplate {
  id: string;
  name: string;
  description?: string;
  fields: IntakeField[];
  property_type?: string;
  created_by?: string;
  usage_count?: number;
  created_at: string;
}

interface Props {
  projectId: string;
  currentFields: IntakeField[];
  staffName: string;
  onUpdate: (project: any) => void;
}

const FIELD_TYPE_ICONS: Record<string, any> = {
  text: Type,
  textarea: AlignLeft,
  select: List,
  date: Calendar,
};

export function SetupIntakeFieldConfigurator({ projectId, currentFields, staffName, onUpdate }: Props) {
  const [fields, setFields] = useState<IntakeField[]>(currentFields || []);
  const [saving, setSaving] = useState(false);
  const [templates, setTemplates] = useState<FormTemplate[]>([]);
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const [showSaveTemplate, setShowSaveTemplate] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [editingField, setEditingField] = useState<string | null>(null);
  const [templateName, setTemplateName] = useState('');
  const [templateDesc, setTemplateDesc] = useState('');
  const [templatePropType, setTemplatePropType] = useState('');
  const [newOptionText, setNewOptionText] = useState('');
  const { toast } = useToast();

  useEffect(() => {
    setFields(currentFields || []);
  }, [currentFields]);

  const loadTemplates = async () => {
    setLoadingTemplates(true);
    try {
      const { data } = await supabase.functions.invoke('manage-setup-tasks', {
        body: { action: 'list_form_templates' }
      });
      if (data?.templates) setTemplates(data.templates);
    } catch (err) {
      console.error('Error loading templates:', err);
    }
    setLoadingTemplates(false);
  };

  const handleSaveFields = async () => {
    setSaving(true);
    try {
      const { data, error } = await supabase.functions.invoke('manage-setup-tasks', {
        body: { action: 'configure_intake_fields', project_id: projectId, fields, staff_name: staffName }
      });
      if (error) throw error;
      if (data?.project) onUpdate(data.project);
      toast({ title: 'Fields Saved', description: `${fields.length} intake form fields configured` });
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
    setSaving(false);
  };

  const handleSaveTemplate = async () => {
    if (!templateName.trim()) {
      toast({ title: 'Error', description: 'Template name is required', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      const { data, error } = await supabase.functions.invoke('manage-setup-tasks', {
        body: {
          action: 'save_form_template',
          name: templateName,
          description: templateDesc,
          fields,
          property_type: templatePropType || null,
          staff_name: staffName
        }
      });
      if (error) throw error;
      toast({ title: 'Template Saved', description: `"${templateName}" saved with ${fields.length} fields` });
      setShowSaveTemplate(false);
      setTemplateName('');
      setTemplateDesc('');
      setTemplatePropType('');
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
    setSaving(false);
  };

  const handleLoadTemplate = async (template: FormTemplate) => {
    setSaving(true);
    try {
      const { data, error } = await supabase.functions.invoke('manage-setup-tasks', {
        body: { action: 'load_form_template', project_id: projectId, template_id: template.id, staff_name: staffName }
      });
      if (error) throw error;
      if (data?.project) {
        onUpdate(data.project);
        setFields(template.fields);
      }
      toast({ title: 'Template Loaded', description: `"${template.name}" applied (${template.fields.length} fields)` });
      setShowTemplates(false);
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
    setSaving(false);
  };

  const handleDeleteTemplate = async (templateId: string) => {
    try {
      await supabase.functions.invoke('manage-setup-tasks', {
        body: { action: 'delete_form_template', template_id: templateId }
      });
      setTemplates(prev => prev.filter(t => t.id !== templateId));
      toast({ title: 'Template Deleted' });
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
  };

  const addField = () => {
    const newField: IntakeField = {
      id: `field_${Date.now()}`,
      label: 'New Field',
      type: 'text',
      required: false,
      placeholder: '',
    };
    setFields([...fields, newField]);
    setEditingField(newField.id);
  };

  const removeField = (id: string) => {
    setFields(fields.filter(f => f.id !== id));
    if (editingField === id) setEditingField(null);
  };

  const updateField = (id: string, updates: Partial<IntakeField>) => {
    setFields(fields.map(f => f.id === id ? { ...f, ...updates } : f));
  };

  const moveField = (index: number, direction: 'up' | 'down') => {
    const newFields = [...fields];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= newFields.length) return;
    [newFields[index], newFields[targetIndex]] = [newFields[targetIndex], newFields[index]];
    setFields(newFields);
  };

  const addOption = (fieldId: string) => {
    if (!newOptionText.trim()) return;
    const field = fields.find(f => f.id === fieldId);
    if (field) {
      updateField(fieldId, { options: [...(field.options || []), newOptionText.trim()] });
      setNewOptionText('');
    }
  };

  const removeOption = (fieldId: string, optionIndex: number) => {
    const field = fields.find(f => f.id === fieldId);
    if (field?.options) {
      updateField(fieldId, { options: field.options.filter((_, i) => i !== optionIndex) });
    }
  };

  const hasChanges = JSON.stringify(fields) !== JSON.stringify(currentFields);

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-xs">{fields.length} fields</Badge>
          {hasChanges && (
            <Badge className="bg-amber-100 text-amber-700 text-xs">
              <AlertTriangle className="w-3 h-3 mr-1" />Unsaved changes
            </Badge>
          )}
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => { loadTemplates(); setShowTemplates(true); }}
          >
            <FolderOpen className="w-3.5 h-3.5 mr-1" />Load Template
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowSaveTemplate(true)}
          >
            <Save className="w-3.5 h-3.5 mr-1" />Save as Template
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowPreview(true)}
          >
            <Eye className="w-3.5 h-3.5 mr-1" />Preview
          </Button>
          <Button
            size="sm"
            onClick={handleSaveFields}
            disabled={saving || !hasChanges}
            className="bg-[#d4a574] hover:bg-[#c49464]"
          >
            {saving ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <Check className="w-3.5 h-3.5 mr-1" />}
            Save Fields
          </Button>
        </div>
      </div>

      {/* Field List */}
      <div className="space-y-2">
        {fields.map((field, index) => {
          const TypeIcon = FIELD_TYPE_ICONS[field.type] || Type;
          const isEditing = editingField === field.id;

          return (
            <div
              key={field.id}
              className={`border rounded-lg transition-all ${isEditing ? 'border-[#d4a574] bg-[#d4a574]/5 shadow-sm' : 'border-gray-200 hover:border-gray-300'}`}
            >
              {/* Field Header */}
              <div className="flex items-center gap-2 p-3">
                <GripVertical className="w-4 h-4 text-gray-300 flex-shrink-0 cursor-grab" />
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button onClick={() => moveField(index, 'up')} disabled={index === 0} className="p-0.5 hover:bg-gray-100 rounded disabled:opacity-30">
                    <ChevronUp className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => moveField(index, 'down')} disabled={index === fields.length - 1} className="p-0.5 hover:bg-gray-100 rounded disabled:opacity-30">
                    <ChevronDown className="w-3.5 h-3.5" />
                  </button>
                </div>
                <TypeIcon className="w-4 h-4 text-gray-400 flex-shrink-0" />
                <span className="text-sm font-medium flex-1 truncate">{field.label}</span>
                <Badge variant="outline" className="text-[10px] flex-shrink-0">{field.type}</Badge>
                {field.required && <Badge className="bg-red-100 text-red-700 text-[10px]">Required</Badge>}
                <button
                  onClick={() => setEditingField(isEditing ? null : field.id)}
                  className="p-1 hover:bg-gray-100 rounded"
                >
                  <Settings2 className="w-3.5 h-3.5 text-gray-500" />
                </button>
                <button onClick={() => removeField(field.id)} className="p-1 hover:bg-red-50 rounded text-red-400 hover:text-red-600">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Field Editor */}
              {isEditing && (
                <div className="px-3 pb-3 pt-1 border-t space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs">Field Label</Label>
                      <Input
                        value={field.label}
                        onChange={e => updateField(field.id, { label: e.target.value })}
                        className="h-8 text-sm"
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Field Type</Label>
                      <Select value={field.type} onValueChange={(v: any) => updateField(field.id, { type: v })}>
                        <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="text">Text (single line)</SelectItem>
                          <SelectItem value="textarea">Textarea (multi-line)</SelectItem>
                          <SelectItem value="select">Dropdown Select</SelectItem>
                          <SelectItem value="date">Date Picker</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs">Placeholder Text</Label>
                      <Input
                        value={field.placeholder || ''}
                        onChange={e => updateField(field.id, { placeholder: e.target.value })}
                        className="h-8 text-sm"
                        placeholder="Hint text shown in the field"
                      />
                    </div>
                    <div className="flex items-end">
                      <div className="flex items-center gap-2 p-2 bg-white border rounded-md w-full h-8">
                        <Switch
                          checked={field.required}
                          onCheckedChange={c => updateField(field.id, { required: c })}
                          className="scale-75"
                        />
                        <span className="text-xs">Required field</span>
                      </div>
                    </div>
                  </div>

                  {/* Select Options Editor */}
                  {field.type === 'select' && (
                    <div>
                      <Label className="text-xs">Dropdown Options</Label>
                      <div className="space-y-1 mt-1">
                        {(field.options || []).map((opt, oi) => (
                          <div key={oi} className="flex items-center gap-2 bg-gray-50 rounded px-2 py-1">
                            <span className="text-xs flex-1">{opt}</span>
                            <button onClick={() => removeOption(field.id, oi)} className="text-red-400 hover:text-red-600">
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                        ))}
                        <div className="flex gap-2">
                          <Input
                            value={newOptionText}
                            onChange={e => setNewOptionText(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addOption(field.id))}
                            className="h-7 text-xs flex-1"
                            placeholder="Add option..."
                          />
                          <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => addOption(field.id)}>
                            <Plus className="w-3 h-3" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Add Field Button */}
      <Button variant="outline" onClick={addField} className="w-full border-dashed">
        <Plus className="w-4 h-4 mr-2" />Add Field
      </Button>

      {/* Load Template Dialog */}
      <Dialog open={showTemplates} onOpenChange={setShowTemplates}>
        <DialogContent className="max-w-lg max-h-[70vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FolderOpen className="w-5 h-5" />Saved Form Templates
            </DialogTitle>
            <DialogDescription>Load a previously saved intake form configuration</DialogDescription>
          </DialogHeader>
          {loadingTemplates ? (
            <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>
          ) : templates.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <FileText className="w-10 h-10 mx-auto mb-2 text-gray-300" />
              <p className="text-sm">No saved templates yet</p>
              <p className="text-xs text-gray-400 mt-1">Save your current field configuration as a template to reuse it</p>
            </div>
          ) : (
            <div className="space-y-2">
              {templates.map(t => (
                <div key={t.id} className="border rounded-lg p-3 hover:border-[#d4a574] transition-colors">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <p className="font-medium text-sm">{t.name}</p>
                      {t.description && <p className="text-xs text-gray-500 mt-0.5">{t.description}</p>}
                      <div className="flex items-center gap-2 mt-1.5">
                        <Badge variant="outline" className="text-[10px]">{t.fields.length} fields</Badge>
                        {t.property_type && <Badge variant="outline" className="text-[10px] capitalize">{t.property_type}</Badge>}
                        <span className="text-[10px] text-gray-400">
                          Used {t.usage_count || 0}x | by {t.created_by} | {new Date(t.created_at).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                    <div className="flex gap-1 ml-2">
                      <Button size="sm" onClick={() => handleLoadTemplate(t)} disabled={saving} className="h-7 text-xs bg-[#d4a574] hover:bg-[#c49464]">
                        {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Load'}
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => handleDeleteTemplate(t.id)} className="h-7 text-xs text-red-500 hover:text-red-700">
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Save Template Dialog */}
      <Dialog open={showSaveTemplate} onOpenChange={setShowSaveTemplate}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Save className="w-5 h-5" />Save as Template
            </DialogTitle>
            <DialogDescription>Save this {fields.length}-field configuration for reuse on other projects</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Template Name *</Label>
              <Input value={templateName} onChange={e => setTemplateName(e.target.value)} placeholder="e.g., Standard Apartment Setup" />
            </div>
            <div>
              <Label>Description</Label>
              <Textarea value={templateDesc} onChange={e => setTemplateDesc(e.target.value)} rows={2} placeholder="Optional description..." />
            </div>
            <div>
              <Label>Property Type (optional filter)</Label>
              <Select value={templatePropType} onValueChange={setTemplatePropType}>
                <SelectTrigger><SelectValue placeholder="Any property type" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="any">Any</SelectItem>
                  <SelectItem value="apartment">Apartment</SelectItem>
                  <SelectItem value="house">House</SelectItem>
                  <SelectItem value="condo">Condo</SelectItem>
                  <SelectItem value="townhouse">Townhouse</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSaveTemplate(false)}>Cancel</Button>
            <Button onClick={handleSaveTemplate} disabled={saving || !templateName.trim()} className="bg-[#d4a574] hover:bg-[#c49464]">
              {saving ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Save className="w-4 h-4 mr-1" />}
              Save Template
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Preview Dialog */}
      <Dialog open={showPreview} onOpenChange={setShowPreview}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Eye className="w-5 h-5" />Form Preview
            </DialogTitle>
            <DialogDescription>This is how the intake form will appear to the operator</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 p-4 bg-gray-50 rounded-lg border">
            <h3 className="font-semibold text-[#1a365d]">Property Setup Intake Form</h3>
            {fields.map(field => (
              <div key={field.id}>
                <Label className="text-sm">
                  {field.label}
                  {field.required && <span className="text-red-500 ml-1">*</span>}
                </Label>
                {field.type === 'text' && (
                  <Input disabled placeholder={field.placeholder || ''} className="mt-1 bg-white" />
                )}
                {field.type === 'textarea' && (
                  <Textarea disabled placeholder={field.placeholder || ''} rows={3} className="mt-1 bg-white" />
                )}
                {field.type === 'select' && (
                  <Select disabled>
                    <SelectTrigger className="mt-1 bg-white">
                      <SelectValue placeholder={field.placeholder || 'Select...'} />
                    </SelectTrigger>
                    <SelectContent>
                      {(field.options || []).map((opt, i) => (
                        <SelectItem key={i} value={opt}>{opt}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
                {field.type === 'date' && (
                  <Input type="date" disabled className="mt-1 bg-white w-48" />
                )}
              </div>
            ))}
            {fields.length === 0 && (
              <p className="text-sm text-gray-400 text-center py-4">No fields configured yet</p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPreview(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
