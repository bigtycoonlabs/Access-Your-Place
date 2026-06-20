import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/lib/supabase';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { BookOpen, Loader2, ExternalLink, ChevronRight } from 'lucide-react';

interface SOPHelpButtonProps {
  // The SOP identifier - can be title, category, or keyword to search
  sopKey: string;
  // Optional: specific SOP title to fetch
  sopTitle?: string;
  // Optional: category to filter by
  category?: string;
  // User's role for permission checking
  userRole: string;
  // Button variant
  variant?: 'default' | 'outline' | 'ghost' | 'link' | 'icon';
  // Button size
  size?: 'default' | 'sm' | 'lg' | 'icon';
  // Custom button text (defaults to "Help" or icon)
  buttonText?: string;
  // Custom aria-label
  ariaLabel?: string;
  // Custom class name
  className?: string;
}

interface SOP {
  id: string;
  role_id: string;
  category: string;
  title: string;
  content_html: string;
  version?: number;
  last_updated: string;
  updated_by?: string;
}

const roleLabels: Record<string, { label: string; color: string }> = {
  'Success_Team': { label: 'Success Team', color: 'bg-amber-100 text-amber-800' },
  'Acquisition_Manager': { label: 'Acquisition Manager', color: 'bg-indigo-100 text-indigo-800' },
  'Setup_Manager': { label: 'Setup Manager', color: 'bg-emerald-100 text-emerald-800' },
  'Cross_Team': { label: 'All Teams', color: 'bg-purple-100 text-purple-800' },
};

export function SOPHelpButton({
  sopKey,
  sopTitle,
  category,
  userRole,
  variant = 'outline',
  size = 'sm',
  buttonText,
  ariaLabel,
  className = ''
}: SOPHelpButtonProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [sops, setSOPs] = useState<SOP[]>([]);
  const [selectedSOP, setSelectedSOP] = useState<SOP | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchSOPs = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: fetchError } = await supabase.functions.invoke('manage-sop-repository', {
        body: {
          action: 'get_sops',
          user_role: userRole,
          category: category || 'all',
          search_query: sopTitle || sopKey
        }
      });

      if (fetchError) throw fetchError;

      const results = data?.sops || [];
      setSOPs(results);
      
      // If only one result or exact title match, auto-select it
      if (results.length === 1) {
        setSelectedSOP(results[0]);
      } else if (sopTitle) {
        const exactMatch = results.find((s: SOP) => 
          s.title.toLowerCase() === sopTitle.toLowerCase()
        );
        if (exactMatch) setSelectedSOP(exactMatch);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load SOP');
    } finally {
      setLoading(false);
    }
  };

  const handleOpen = () => {
    setOpen(true);
    fetchSOPs();
  };

  const handleSelectSOP = (sop: SOP) => {
    setSelectedSOP(sop);
  };

  const handleBack = () => {
    setSelectedSOP(null);
  };

  const isIconOnly = variant === 'icon' || size === 'icon';

  return (
    <>
      <Button
        variant={variant === 'icon' ? 'ghost' : variant}
        size={size}
        onClick={handleOpen}
        className={`${className} ${isIconOnly ? 'p-2' : ''}`}
        aria-label={ariaLabel || `View SOP help for ${sopKey}`}
      >
        <BookOpen className={`w-4 h-4 ${isIconOnly ? '' : 'mr-1'}`} aria-hidden="true" />
        {!isIconOnly && (buttonText || 'SOP Help')}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-amber-600" aria-hidden="true" />
              {selectedSOP ? selectedSOP.title : `SOP Reference: ${sopKey}`}
            </DialogTitle>
            <DialogDescription>
              {selectedSOP 
                ? `${selectedSOP.category} • Last updated ${new Date(selectedSOP.last_updated).toLocaleDateString()}`
                : 'Standard Operating Procedure guidance for this task'}
            </DialogDescription>
          </DialogHeader>

          {loading ? (
            <div className="flex items-center justify-center py-12" role="status">
              <Loader2 className="w-6 h-6 animate-spin text-amber-600" aria-hidden="true" />
              <span className="ml-2 text-gray-600">Loading SOP...</span>
            </div>
          ) : error ? (
            <div className="py-8 text-center">
              <p className="text-red-600 mb-4">{error}</p>
              <Button variant="outline" onClick={fetchSOPs}>
                Try Again
              </Button>
            </div>
          ) : selectedSOP ? (
            <div className="space-y-4">
              {sops.length > 1 && (
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={handleBack}
                  className="text-amber-600 hover:text-amber-700"
                >
                  ← Back to list
                </Button>
              )}
              
              <div className="flex items-center gap-2 flex-wrap">
                <Badge className={roleLabels[selectedSOP.role_id]?.color || 'bg-gray-100'}>
                  {roleLabels[selectedSOP.role_id]?.label || selectedSOP.role_id}
                </Badge>
                <Badge variant="outline">{selectedSOP.category}</Badge>
                {selectedSOP.version && selectedSOP.version > 1 && (
                  <Badge variant="outline">v{selectedSOP.version}</Badge>
                )}
              </div>

              <ScrollArea className="h-[400px] pr-4">
                <article 
                  className="sop-content prose prose-sm max-w-none"
                  dangerouslySetInnerHTML={{ __html: selectedSOP.content_html }}
                  aria-label={`SOP content for ${selectedSOP.title}`}
                />
              </ScrollArea>
            </div>
          ) : sops.length === 0 ? (
            <div className="py-12 text-center">
              <BookOpen className="w-12 h-12 mx-auto text-gray-300 mb-4" aria-hidden="true" />
              <p className="text-gray-600 mb-2">No SOP found for "{sopKey}"</p>
              <p className="text-sm text-gray-500">
                Contact the Success Team to request documentation for this process.
              </p>
            </div>
          ) : (
            <ScrollArea className="h-[400px]">
              <nav aria-label="Related SOPs">
                <p className="text-sm text-gray-600 mb-4">
                  {sops.length} related procedure{sops.length !== 1 ? 's' : ''} found:
                </p>
                <ul className="space-y-2" role="list">
                  {sops.map(sop => (
                    <li key={sop.id}>
                      <button
                        onClick={() => handleSelectSOP(sop)}
                        className="w-full text-left p-4 rounded-lg border hover:bg-amber-50 hover:border-amber-200 transition-colors flex items-center justify-between group"
                        aria-label={`View ${sop.title}`}
                      >
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-[#1a365d] group-hover:text-amber-700">
                            {sop.title}
                          </p>
                          <div className="flex items-center gap-2 mt-1">
                            <Badge 
                              variant="outline" 
                              className="text-xs"
                            >
                              {sop.category}
                            </Badge>
                            <span className="text-xs text-gray-500">
                              {roleLabels[sop.role_id]?.label || sop.role_id}
                            </span>
                          </div>
                        </div>
                        <ChevronRight 
                          className="w-4 h-4 text-gray-400 group-hover:text-amber-600 flex-shrink-0" 
                          aria-hidden="true" 
                        />
                      </button>
                    </li>
                  ))}
                </ul>
              </nav>
            </ScrollArea>
          )}

          {/* SOP Content Styles */}
          <style>{`
            .sop-content h4 { font-size: 1.1rem; font-weight: 600; color: #1a365d; margin-bottom: 0.75rem; margin-top: 1.25rem; }
            .sop-content h5 { font-size: 0.95rem; font-weight: 600; color: #374151; margin-top: 1rem; margin-bottom: 0.5rem; }
            .sop-content p { color: #4b5563; margin-bottom: 0.75rem; line-height: 1.6; }
            .sop-content ul, .sop-content ol { margin-left: 1.5rem; margin-bottom: 0.75rem; }
            .sop-content li { color: #4b5563; margin-bottom: 0.25rem; line-height: 1.5; }
            .sop-content .alert-info { background: #eff6ff; border-left: 4px solid #3b82f6; padding: 0.75rem 1rem; border-radius: 0.375rem; color: #1e40af; margin: 0.75rem 0; }
            .sop-content .alert-warning { background: #fffbeb; border-left: 4px solid #f59e0b; padding: 0.75rem 1rem; border-radius: 0.375rem; color: #92400e; margin: 0.75rem 0; }
            .sop-content .alert-critical { background: #fef2f2; border-left: 4px solid #ef4444; padding: 0.75rem 1rem; border-radius: 0.375rem; color: #991b1b; margin: 0.75rem 0; }
            .sop-content strong { font-weight: 600; color: #1f2937; }
            .sop-content em { font-style: italic; }
            .sop-content code { background: #f3f4f6; padding: 0.125rem 0.375rem; border-radius: 0.25rem; font-size: 0.875rem; }
          `}</style>
        </DialogContent>
      </Dialog>
    </>
  );
}

// Predefined SOP help buttons for common contexts
export const SOPHelpButtons = {
  // Success Team
  DiscoveryOnboarding: (props: Partial<SOPHelpButtonProps>) => (
    <SOPHelpButton 
      sopKey="Discovery & Onboarding" 
      category="Onboarding"
      buttonText="Onboarding SOP"
      {...props}
      userRole={props.userRole || 'Success_Team'}
    />
  ),
  
  DisputeResolution: (props: Partial<SOPHelpButtonProps>) => (
    <SOPHelpButton 
      sopKey="Dispute Resolution" 
      category="Dispute Resolution"
      buttonText="Dispute SOP"
      {...props}
      userRole={props.userRole || 'Success_Team'}
    />
  ),
  
  CreditManagement: (props: Partial<SOPHelpButtonProps>) => (
    <SOPHelpButton 
      sopKey="Credit Management" 
      category="Compliance"
      buttonText="Credits SOP"
      {...props}
      userRole={props.userRole || 'Success_Team'}
    />
  ),
  
  // Acquisition Manager
  PropertyResearch: (props: Partial<SOPHelpButtonProps>) => (
    <SOPHelpButton 
      sopKey="Property Research" 
      category="Property Research"
      buttonText="Research SOP"
      {...props}
      userRole={props.userRole || 'Acquisition_Manager'}
    />
  ),
  
  LandlordOutreach: (props: Partial<SOPHelpButtonProps>) => (
    <SOPHelpButton 
      sopKey="Landlord Outreach" 
      category="Landlord Outreach"
      buttonText="Outreach SOP"
      {...props}
      userRole={props.userRole || 'Acquisition_Manager'}
    />
  ),
  
  DealNegotiation: (props: Partial<SOPHelpButtonProps>) => (
    <SOPHelpButton 
      sopKey="Deal Negotiation" 
      category="Deal Negotiation"
      buttonText="Negotiation SOP"
      {...props}
      userRole={props.userRole || 'Acquisition_Manager'}
    />
  ),
  
  // Setup Manager
  PropertyPreparation: (props: Partial<SOPHelpButtonProps>) => (
    <SOPHelpButton 
      sopKey="Property Preparation" 
      category="Property Preparation"
      buttonText="Prep SOP"
      {...props}
      userRole={props.userRole || 'Setup_Manager'}
    />
  ),
  
  FurnitureProcurement: (props: Partial<SOPHelpButtonProps>) => (
    <SOPHelpButton 
      sopKey="Furniture Procurement" 
      category="Furniture Procurement"
      buttonText="Furniture SOP"
      {...props}
      userRole={props.userRole || 'Setup_Manager'}
    />
  ),
  
  QualityInspection: (props: Partial<SOPHelpButtonProps>) => (
    <SOPHelpButton 
      sopKey="Quality Inspection" 
      category="Quality Inspection"
      buttonText="Inspection SOP"
      {...props}
      userRole={props.userRole || 'Setup_Manager'}
    />
  ),
  
  // Cross-Team
  HandoffProtocol: (props: Partial<SOPHelpButtonProps>) => (
    <SOPHelpButton 
      sopKey="Handoff" 
      category="Cross-Team Handoffs"
      buttonText="Handoff SOP"
      {...props}
      userRole={props.userRole || 'Cross_Team'}
    />
  ),
  
  CommunicationStandards: (props: Partial<SOPHelpButtonProps>) => (
    <SOPHelpButton 
      sopKey="Communication" 
      category="Communication Standards"
      buttonText="Communication SOP"
      {...props}
      userRole={props.userRole || 'Cross_Team'}
    />
  ),
};

export default SOPHelpButton;
