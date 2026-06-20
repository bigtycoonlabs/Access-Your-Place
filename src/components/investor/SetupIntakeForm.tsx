import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import {
  Loader2, ClipboardList, CheckCircle, AlertCircle, 
  Home, Wifi, Palette, DollarSign, Key, Zap, Send, Info
} from 'lucide-react';

interface IntakeField {
  id: string;
  label: string;
  type: 'text' | 'textarea' | 'select' | 'date';
  required: boolean;
  placeholder?: string;
  options?: string[];
}

interface Props {
  projectId: string;
  investorId: string;
  investorName: string;
  onSubmitted?: () => void;
}

const FIELD_ICONS: Record<string, any> = {
  property_access: Key,
  key_lockbox: Key,
  wifi_provider: Wifi,
  wifi_notes: Wifi,
  design_style: Palette,
  color_preferences: Palette,
  budget_range: DollarSign,
  budget_notes: DollarSign,
  utility_electric: Zap,
  utility_gas: Zap,
  utility_water: Zap,
  special_instructions: Info,
  existing_items: Home,
  guest_profile: Home,
  move_in_date: Home,
};

export function SetupIntakeForm({ projectId, investorId, investorName, onSubmitted }: Props) {
  const [fields, setFields] = useState<IntakeField[]>([]);
  const [formData, setFormData] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [alreadySubmitted, setAlreadySubmitted] = useState(false);
  const [existingData, setExistingData] = useState<Record<string, string> | null>(null);
  const [projectInfo, setProjectInfo] = useState<any>(null);
  const { toast } = useToast();

  useEffect(() => {
    fetchIntakeFields();
  }, [projectId]);

  const fetchIntakeFields = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('manage-setup-tasks', {
        body: { action: 'get_intake_fields', project_id: projectId }
      });
      if (error) throw error;
      if (data?.fields) {
        setFields(data.fields);
        // Pre-fill with existing data if form was already submitted
        if (data.project?.intake_form_data) {
          setFormData(data.project.intake_form_data);
          setExistingData(data.project.intake_form_data);
        }
        if (data.project?.intake_form_submitted) {
          setAlreadySubmitted(true);
        }
        setProjectInfo(data.project);
      }
    } catch (err: any) {
      console.error('Error fetching intake fields:', err);
      toast({ title: 'Error', description: 'Failed to load intake form', variant: 'destructive' });
    }
    setLoading(false);
  };

  const handleFieldChange = (fieldId: string, value: string) => {
    setFormData(prev => ({ ...prev, [fieldId]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate required fields
    const missingFields = fields
      .filter(f => f.required && (!formData[f.id] || formData[f.id].trim() === ''))
      .map(f => f.label);
    
    if (missingFields.length > 0) {
      toast({
        title: 'Missing Required Fields',
        description: `Please fill in: ${missingFields.join(', ')}`,
        variant: 'destructive'
      });
      return;
    }

    setSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke('manage-setup-tasks', {
        body: {
          action: 'submit_intake_form',
          project_id: projectId,
          form_data: formData,
          investor_id: investorId,
          investor_name: investorName
        }
      });
      
      if (error || data?.error) throw new Error(data?.error || 'Failed to submit');
      
      setAlreadySubmitted(true);
      setExistingData(formData);
      toast({
        title: 'Intake Form Submitted!',
        description: 'Your Setup Manager has been notified and will review your submission.',
      });
      onSubmitted?.();
    } catch (err: any) {
      toast({
        title: 'Error',
        description: err.message || 'Failed to submit intake form',
        variant: 'destructive'
      });
    }
    setSubmitting(false);
  };

  const getFieldIcon = (fieldId: string) => {
    const IconComponent = FIELD_ICONS[fieldId] || ClipboardList;
    return <IconComponent className="w-4 h-4" />;
  };

  // Group fields by category
  const groupFields = (fields: IntakeField[]) => {
    const groups: { title: string; icon: any; fields: IntakeField[] }[] = [
      { title: 'Property Access', icon: Key, fields: [] },
      { title: 'Wi-Fi & Internet', icon: Wifi, fields: [] },
      { title: 'Design & Style', icon: Palette, fields: [] },
      { title: 'Budget', icon: DollarSign, fields: [] },
      { title: 'Utilities', icon: Zap, fields: [] },
      { title: 'Additional Details', icon: Info, fields: [] },
    ];

    for (const field of fields) {
      if (['property_access', 'key_lockbox'].includes(field.id)) groups[0].fields.push(field);
      else if (['wifi_provider', 'wifi_notes'].includes(field.id)) groups[1].fields.push(field);
      else if (['design_style', 'color_preferences'].includes(field.id)) groups[2].fields.push(field);
      else if (['budget_range', 'budget_notes'].includes(field.id)) groups[3].fields.push(field);
      else if (['utility_electric', 'utility_gas', 'utility_water'].includes(field.id)) groups[4].fields.push(field);
      else groups[5].fields.push(field);
    }

    return groups.filter(g => g.fields.length > 0);
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="py-12 flex flex-col items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-emerald-600 mb-3" />
          <p className="text-gray-500">Loading intake form...</p>
        </CardContent>
      </Card>
    );
  }

  if (alreadySubmitted && existingData) {
    return (
      <Card className="border-emerald-200">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-emerald-600" />
                Intake Form Submitted
              </CardTitle>
              <CardDescription>
                Your Setup Manager is reviewing your submission
              </CardDescription>
            </div>
            <Badge className="bg-emerald-100 text-emerald-700">Submitted</Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {groupFields(fields).map((group) => (
              <div key={group.title} className="bg-gray-50 rounded-lg p-4">
                <h4 className="font-medium text-gray-700 flex items-center gap-2 mb-3">
                  <group.icon className="w-4 h-4 text-emerald-600" />
                  {group.title}
                </h4>
                <div className="space-y-2">
                  {group.fields.map((field) => (
                    <div key={field.id} className="flex flex-col sm:flex-row sm:items-start gap-1">
                      <span className="text-sm font-medium text-gray-500 sm:w-48 flex-shrink-0">{field.label}:</span>
                      <span className="text-sm text-gray-900">{existingData[field.id] || '—'}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
          
          <div className="mt-6 p-4 bg-emerald-50 rounded-lg border border-emerald-200">
            <p className="text-sm text-emerald-800">
              <strong>What happens next?</strong> Your Setup Manager will review this information and generate a Setup Service Agreement for you to sign. You'll receive a notification when it's ready.
            </p>
          </div>

          <Button
            variant="outline"
            className="mt-4"
            onClick={() => { setAlreadySubmitted(false); }}
          >
            Edit Submission
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-emerald-200">
      <CardHeader className="bg-gradient-to-r from-emerald-50 to-teal-50 rounded-t-lg">
        <CardTitle className="text-lg flex items-center gap-2">
          <ClipboardList className="w-5 h-5 text-emerald-600" />
          Setup Intake Form
        </CardTitle>
        <CardDescription>
          {projectInfo?.property_address ? (
            <span>For: <strong>{projectInfo.property_address}</strong></span>
          ) : (
            'Please fill out all required fields to help your Setup Manager prepare for your property setup.'
          )}
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-6">
        <form onSubmit={handleSubmit} className="space-y-6">
          {groupFields(fields).map((group) => (
            <div key={group.title} className="space-y-4">
              <h3 className="font-semibold text-gray-800 flex items-center gap-2 pb-2 border-b border-gray-200">
                <group.icon className="w-4 h-4 text-emerald-600" />
                {group.title}
              </h3>
              <div className="grid gap-4 md:grid-cols-2">
                {group.fields.map((field) => (
                  <div key={field.id} className={field.type === 'textarea' ? 'md:col-span-2' : ''}>
                    <Label htmlFor={`intake-${field.id}`} className="flex items-center gap-1.5 mb-1.5">
                      {field.label}
                      {field.required && <span className="text-red-500 text-xs">*</span>}
                    </Label>
                    
                    {field.type === 'text' && (
                      <Input
                        id={`intake-${field.id}`}
                        value={formData[field.id] || ''}
                        onChange={(e) => handleFieldChange(field.id, e.target.value)}
                        placeholder={field.placeholder}
                        required={field.required}
                        className="border-gray-300 focus:border-emerald-500 focus:ring-emerald-500"
                      />
                    )}
                    
                    {field.type === 'textarea' && (
                      <Textarea
                        id={`intake-${field.id}`}
                        value={formData[field.id] || ''}
                        onChange={(e) => handleFieldChange(field.id, e.target.value)}
                        placeholder={field.placeholder}
                        required={field.required}
                        rows={3}
                        className="border-gray-300 focus:border-emerald-500 focus:ring-emerald-500"
                      />
                    )}
                    
                    {field.type === 'select' && (
                      <select
                        id={`intake-${field.id}`}
                        value={formData[field.id] || ''}
                        onChange={(e) => handleFieldChange(field.id, e.target.value)}
                        required={field.required}
                        className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:border-emerald-500 focus:ring-emerald-500 focus:outline-none"
                      >
                        <option value="">{field.placeholder || 'Select...'}</option>
                        {field.options?.map((opt) => (
                          <option key={opt} value={opt}>{opt}</option>
                        ))}
                      </select>
                    )}
                    
                    {field.type === 'date' && (
                      <Input
                        id={`intake-${field.id}`}
                        type="date"
                        value={formData[field.id] || ''}
                        onChange={(e) => handleFieldChange(field.id, e.target.value)}
                        required={field.required}
                        className="border-gray-300 focus:border-emerald-500 focus:ring-emerald-500"
                      />
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}

          <div className="flex items-center gap-3 pt-4 border-t border-gray-200">
            <Button
              type="submit"
              disabled={submitting}
              className="bg-emerald-600 hover:bg-emerald-700 flex-1 sm:flex-none"
            >
              {submitting ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : (
                <Send className="w-4 h-4 mr-2" />
              )}
              {submitting ? 'Submitting...' : 'Submit Intake Form'}
            </Button>
            <p className="text-xs text-gray-500">
              Fields marked with <span className="text-red-500">*</span> are required
            </p>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
