import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';
import { 
  Loader2, Save, UserPlus, CheckCircle, ArrowLeft, 
  Phone, Mail, Building2, StickyNote, Users, Target, 
  MapPin, Sparkles, Plus, QrCode, Share2, Copy, Check,
  Smartphone, X
} from 'lucide-react';

interface InvestorTag {
  id: string;
  name: string;
  category: 'source' | 'interest_level' | 'market' | 'custom';
  color: string;
  description?: string;
}

const TAG_CATEGORY_ICONS: Record<string, any> = {
  source: Users,
  interest_level: Target,
  market: MapPin,
  custom: Sparkles,
};

const TAG_CATEGORY_LABELS: Record<string, string> = {
  source: 'Source',
  interest_level: 'Interest Level',
  market: 'Market',
  custom: 'Custom',
};

export default function StaffQuickAddContact() {
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [contact, setContact] = useState({
    name: '',
    phone: '',
    email: '',
    company: '',
    notes: ''
  });
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [tags, setTags] = useState<InvestorTag[]>([]);
  const [loadingTags, setLoadingTags] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [lastAddedName, setLastAddedName] = useState('');
  const [showShareOptions, setShowShareOptions] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [showTagSelector, setShowTagSelector] = useState(false);

  // Check authentication
  useEffect(() => {
    const checkAuth = async () => {
      const staffSession = localStorage.getItem('staff_session');
      if (staffSession) {
        try {
          const session = JSON.parse(staffSession);
          if (session.staff_id && session.role) {
            setIsAuthenticated(true);
            return;
          }
        } catch (e) {
          console.error('Invalid staff session');
        }
      }
      setIsAuthenticated(false);
    };
    checkAuth();
  }, []);

  // Fetch tags
  useEffect(() => {
    const fetchTags = async () => {
      try {
        const { data, error } = await supabase.functions.invoke('send-investor-invitation', {
          body: { action: 'get_tags' }
        });

        if (error) throw error;

        if (data?.success) {
          setTags(data.tags || []);
        }
      } catch (err: any) {
        console.error('Failed to load tags:', err);
      }
      setLoadingTags(false);
    };

    if (isAuthenticated) {
      fetchTags();
    }
  }, [isAuthenticated]);

  const formatPhoneNumber = (value: string) => {
    const digits = value.replace(/\D/g, '');
    if (digits.length <= 3) return digits;
    if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6, 10)}`;
  };

  const handleSave = async () => {
    if (!contact.name.trim()) {
      toast({ title: 'Error', description: 'Name is required', variant: 'destructive' });
      return;
    }

    if (!contact.phone && !contact.email) {
      toast({ title: 'Error', description: 'Phone or email is required', variant: 'destructive' });
      return;
    }

    setSaving(true);
    try {
      const { data, error } = await supabase.functions.invoke('send-investor-invitation', {
        body: {
          action: 'add_pending',
          contacts: [{
            name: contact.name.trim(),
            phone: contact.phone ? contact.phone.replace(/\D/g, '') : undefined,
            email: contact.email.trim() || undefined,
            company: contact.company.trim() || undefined,
            notes: contact.notes.trim() || undefined
          }],
          tag_ids: selectedTags.length > 0 ? selectedTags : undefined
        }
      });

      if (error) throw error;

      if (data?.added > 0) {
        setLastAddedName(contact.name);
        setShowSuccess(true);
        
        // Reset form
        setContact({ name: '', phone: '', email: '', company: '', notes: '' });
        setSelectedTags([]);
        
        // Hide success after 3 seconds
        setTimeout(() => setShowSuccess(false), 3000);
      } else if (data?.results?.[0]?.error) {
        toast({ title: 'Error', description: data.results[0].error, variant: 'destructive' });
      }
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
    setSaving(false);
  };

  const toggleTag = (tagId: string) => {
    setSelectedTags(prev => 
      prev.includes(tagId) 
        ? prev.filter(id => id !== tagId)
        : [...prev, tagId]
    );
  };

  const shareUrl = `${window.location.origin}/staff/quick-add`;

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      toast({ title: 'Link Copied!', description: 'Share this link with your team' });
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      toast({ title: 'Error', description: 'Failed to copy link', variant: 'destructive' });
    }
  };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Quick Add Contact',
          text: 'Add investor contacts on the go',
          url: shareUrl
        });
      } catch (err) {
        // User cancelled or error
      }
    } else {
      setShowShareOptions(true);
    }
  };

  // Group tags by category
  const tagsByCategory = tags.reduce((acc, tag) => {
    if (!acc[tag.category]) acc[tag.category] = [];
    acc[tag.category].push(tag);
    return acc;
  }, {} as Record<string, InvestorTag[]>);

  // Not authenticated
  if (isAuthenticated === false) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#1e3a5f] to-[#2d5a87] flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6 text-center">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <UserPlus className="w-8 h-8 text-red-500" />
            </div>
            <h2 className="text-xl font-bold mb-2">Authentication Required</h2>
            <p className="text-gray-600 mb-6">
              Please log in to the staff dashboard to add contacts.
            </p>
            <Button 
              onClick={() => navigate('/staff/login')}
              className="w-full bg-[#1e3a5f] hover:bg-[#2d5a87]"
            >
              Go to Success Team Login
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Loading
  if (isAuthenticated === null) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#1e3a5f] to-[#2d5a87] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-white" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#1e3a5f] to-[#2d5a87]">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-white/95 backdrop-blur-sm border-b shadow-sm">
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center justify-between">
          <Button 
            variant="ghost" 
            size="sm"
            onClick={() => navigate('/staff/dashboard')}
            className="text-gray-600"
          >
            <ArrowLeft className="w-4 h-4 mr-1" />
            Dashboard
          </Button>
          <h1 className="font-semibold text-gray-900">Quick Add</h1>
          <Button 
            variant="ghost" 
            size="sm"
            onClick={handleShare}
            className="text-gray-600"
          >
            <Share2 className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Success Banner */}
      {showSuccess && (
        <div className="bg-green-500 text-white px-4 py-3 flex items-center justify-center gap-2 animate-in slide-in-from-top">
          <CheckCircle className="w-5 h-5" />
          <span className="font-medium">{lastAddedName} added successfully!</span>
        </div>
      )}

      {/* Main Content */}
      <div className="max-w-lg mx-auto p-4 pb-24">
        <Card className="shadow-xl">
          <CardHeader className="pb-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-[#d4a574]/20 rounded-full flex items-center justify-center">
                <UserPlus className="w-6 h-6 text-[#d4a574]" />
              </div>
              <div>
                <CardTitle className="text-xl">Add Contact</CardTitle>
                <CardDescription>
                  Quick add to pending investor list
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          
          <CardContent className="space-y-5">
            {/* Name - Required */}
            <div className="space-y-2">
              <Label htmlFor="name" className="text-base font-medium flex items-center gap-2">
                <Users className="w-4 h-4 text-gray-400" />
                Name <span className="text-red-500">*</span>
              </Label>
              <Input
                id="name"
                value={contact.name}
                onChange={(e) => setContact({ ...contact, name: e.target.value })}
                placeholder="John Doe"
                className="h-12 text-lg"
                autoComplete="name"
              />
            </div>

            {/* Phone */}
            <div className="space-y-2">
              <Label htmlFor="phone" className="text-base font-medium flex items-center gap-2">
                <Phone className="w-4 h-4 text-gray-400" />
                Phone Number
              </Label>
              <Input
                id="phone"
                type="tel"
                value={contact.phone}
                onChange={(e) => setContact({ ...contact, phone: formatPhoneNumber(e.target.value) })}
                placeholder="(555) 123-4567"
                className="h-12 text-lg"
                autoComplete="tel"
              />
            </div>

            {/* Email */}
            <div className="space-y-2">
              <Label htmlFor="email" className="text-base font-medium flex items-center gap-2">
                <Mail className="w-4 h-4 text-gray-400" />
                Email Address
              </Label>
              <Input
                id="email"
                type="email"
                value={contact.email}
                onChange={(e) => setContact({ ...contact, email: e.target.value })}
                placeholder="john@example.com"
                className="h-12 text-lg"
                autoComplete="email"
              />
            </div>

            {/* Company */}
            <div className="space-y-2">
              <Label htmlFor="company" className="text-base font-medium flex items-center gap-2">
                <Building2 className="w-4 h-4 text-gray-400" />
                Company <span className="text-gray-400 text-sm font-normal">(optional)</span>
              </Label>
              <Input
                id="company"
                value={contact.company}
                onChange={(e) => setContact({ ...contact, company: e.target.value })}
                placeholder="ABC Properties LLC"
                className="h-12 text-lg"
                autoComplete="organization"
              />
            </div>

            {/* Notes */}
            <div className="space-y-2">
              <Label htmlFor="notes" className="text-base font-medium flex items-center gap-2">
                <StickyNote className="w-4 h-4 text-gray-400" />
                Notes <span className="text-gray-400 text-sm font-normal">(optional)</span>
              </Label>
              <Textarea
                id="notes"
                value={contact.notes}
                onChange={(e) => setContact({ ...contact, notes: e.target.value })}
                placeholder="Met at networking event, interested in Texas market..."
                className="text-base min-h-[80px]"
                rows={2}
              />
            </div>

            {/* Tags Section */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-base font-medium">Tags</Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowTagSelector(!showTagSelector)}
                >
                  {showTagSelector ? (
                    <>
                      <X className="w-4 h-4 mr-1" />
                      Close
                    </>
                  ) : (
                    <>
                      <Plus className="w-4 h-4 mr-1" />
                      Add Tags
                    </>
                  )}
                </Button>
              </div>

              {/* Selected Tags Display */}
              {selectedTags.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {selectedTags.map(tagId => {
                    const tag = tags.find(t => t.id === tagId);
                    if (!tag) return null;
                    return (
                      <Badge 
                        key={tag.id}
                        className="px-3 py-1.5 text-sm cursor-pointer"
                        style={{ backgroundColor: tag.color, color: '#fff' }}
                        onClick={() => toggleTag(tag.id)}
                      >
                        {tag.name}
                        <X className="w-3 h-3 ml-1" />
                      </Badge>
                    );
                  })}
                </div>
              )}

              {/* Tag Selector */}
              {showTagSelector && (
                <div className="border rounded-lg p-4 bg-gray-50 space-y-4 animate-in slide-in-from-top-2">
                  {loadingTags ? (
                    <div className="flex items-center justify-center py-4">
                      <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
                    </div>
                  ) : tags.length === 0 ? (
                    <p className="text-center text-gray-500 py-4">No tags available</p>
                  ) : (
                    Object.entries(tagsByCategory).map(([category, categoryTags]) => (
                      <div key={category}>
                        <div className="flex items-center gap-2 mb-2">
                          {TAG_CATEGORY_ICONS[category] && (
                            <span className="text-gray-400">
                              {(() => {
                                const Icon = TAG_CATEGORY_ICONS[category];
                                return <Icon className="w-4 h-4" />;
                              })()}
                            </span>
                          )}
                          <span className="text-sm font-medium text-gray-600">
                            {TAG_CATEGORY_LABELS[category] || category}
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {categoryTags.map(tag => (
                            <Badge 
                              key={tag.id}
                              className={`px-3 py-1.5 text-sm cursor-pointer transition-all ${
                                selectedTags.includes(tag.id) 
                                  ? 'ring-2 ring-offset-2 ring-gray-400' 
                                  : 'opacity-70 hover:opacity-100'
                              }`}
                              style={{ backgroundColor: tag.color, color: '#fff' }}
                              onClick={() => toggleTag(tag.id)}
                            >
                              {tag.name}
                              {selectedTags.includes(tag.id) && (
                                <CheckCircle className="w-3 h-3 ml-1" />
                              )}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>

            {/* Quick Source Tags */}
            {!showTagSelector && tagsByCategory.source && tagsByCategory.source.length > 0 && (
              <div className="space-y-2">
                <Label className="text-sm text-gray-500">Quick Source Tags</Label>
                <div className="flex flex-wrap gap-2">
                  {tagsByCategory.source.slice(0, 5).map(tag => (
                    <Badge 
                      key={tag.id}
                      variant="outline"
                      className={`px-3 py-1.5 cursor-pointer transition-all ${
                        selectedTags.includes(tag.id) 
                          ? 'border-2' 
                          : 'opacity-70 hover:opacity-100'
                      }`}
                      style={{ 
                        borderColor: tag.color, 
                        backgroundColor: selectedTags.includes(tag.id) ? tag.color : 'transparent',
                        color: selectedTags.includes(tag.id) ? '#fff' : tag.color
                      }}
                      onClick={() => toggleTag(tag.id)}
                    >
                      {tag.name}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Floating Save Button */}
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-white via-white to-transparent">
          <div className="max-w-lg mx-auto">
            <Button 
              onClick={handleSave}
              disabled={saving || !contact.name.trim()}
              className="w-full h-14 text-lg font-semibold bg-[#d4a574] hover:bg-[#c49464] shadow-lg"
            >
              {saving ? (
                <>
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="w-5 h-5 mr-2" />
                  Save Contact
                </>
              )}
            </Button>
          </div>
        </div>
      </div>

      {/* Share Options Modal */}
      {showShareOptions && (
        <div 
          className="fixed inset-0 bg-black/50 z-50 flex items-end justify-center"
          onClick={() => setShowShareOptions(false)}
        >
          <div 
            className="bg-white w-full max-w-lg rounded-t-2xl p-6 space-y-4 animate-in slide-in-from-bottom"
            onClick={e => e.stopPropagation()}
          >
            <div className="w-12 h-1 bg-gray-300 rounded-full mx-auto mb-4" />
            
            <h3 className="text-lg font-semibold text-center">Share Quick Add Link</h3>
            <p className="text-sm text-gray-500 text-center">
              Share this link with your team so they can add contacts from their mobile devices
            </p>

            {/* QR Code Placeholder */}
            <div className="flex justify-center py-4">
              <div className="w-48 h-48 bg-gray-100 rounded-lg flex items-center justify-center border-2 border-dashed border-gray-300">
                <div className="text-center">
                  <QrCode className="w-12 h-12 text-gray-400 mx-auto mb-2" />
                  <p className="text-xs text-gray-500">QR Code</p>
                </div>
              </div>
            </div>

            {/* Link Copy */}
            <div className="flex gap-2">
              <Input 
                value={shareUrl}
                readOnly
                className="flex-1 text-sm"
              />
              <Button onClick={handleCopyLink} variant="outline">
                {copied ? (
                  <Check className="w-4 h-4 text-green-500" />
                ) : (
                  <Copy className="w-4 h-4" />
                )}
              </Button>
            </div>

            {/* Mobile Tip */}
            <div className="flex items-start gap-3 p-3 bg-blue-50 rounded-lg">
              <Smartphone className="w-5 h-5 text-blue-500 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-blue-900">Mobile Tip</p>
                <p className="text-xs text-blue-700">
                  Add this page to your home screen for quick access. On iOS, tap Share → Add to Home Screen.
                </p>
              </div>
            </div>

            <Button 
              variant="outline" 
              className="w-full"
              onClick={() => setShowShareOptions(false)}
            >
              Close
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
