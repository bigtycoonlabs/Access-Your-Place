import { useState, useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Plus, 
  Minus, 
  ArrowRight, 
  Clock, 
  User,
  FileText,
  History,
  Eye
} from 'lucide-react';

interface SOPVersion {
  id: string;
  sop_id: string;
  version_number: number;
  title: string;
  content_html: string;
  previous_content_html: string | null;
  change_summary: string;
  changed_by: string;
  created_at: string;
}

interface SOPDiffViewerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  version: SOPVersion | null;
  sopTitle: string;
}

// Simple diff algorithm to find additions and removals
function computeDiff(oldText: string, newText: string): { type: 'add' | 'remove' | 'same'; text: string }[] {
  if (!oldText) {
    return [{ type: 'add', text: newText }];
  }
  
  // Strip HTML tags for comparison
  const stripHtml = (html: string) => html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  
  const oldLines = stripHtml(oldText).split(/[.!?]+/).filter(s => s.trim());
  const newLines = stripHtml(newText).split(/[.!?]+/).filter(s => s.trim());
  
  const result: { type: 'add' | 'remove' | 'same'; text: string }[] = [];
  
  const oldSet = new Set(oldLines.map(l => l.trim().toLowerCase()));
  const newSet = new Set(newLines.map(l => l.trim().toLowerCase()));
  
  // Find removed lines
  oldLines.forEach(line => {
    const trimmed = line.trim();
    if (trimmed && !newSet.has(trimmed.toLowerCase())) {
      result.push({ type: 'remove', text: trimmed });
    }
  });
  
  // Find added lines
  newLines.forEach(line => {
    const trimmed = line.trim();
    if (trimmed && !oldSet.has(trimmed.toLowerCase())) {
      result.push({ type: 'add', text: trimmed });
    }
  });
  
  // Find unchanged (common) lines
  newLines.forEach(line => {
    const trimmed = line.trim();
    if (trimmed && oldSet.has(trimmed.toLowerCase())) {
      result.push({ type: 'same', text: trimmed });
    }
  });
  
  return result;
}

export function SOPDiffViewer({ open, onOpenChange, version, sopTitle }: SOPDiffViewerProps) {
  const [viewMode, setViewMode] = useState<'diff' | 'old' | 'new'>('diff');

  const diffResult = useMemo(() => {
    if (!version) return [];
    return computeDiff(version.previous_content_html || '', version.content_html);
  }, [version]);

  const additions = diffResult.filter(d => d.type === 'add');
  const removals = diffResult.filter(d => d.type === 'remove');

  if (!version) return null;

  const handleViewModeChange = (value: string) => {
    setViewMode(value as 'diff' | 'old' | 'new');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent 
        className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col"
        aria-describedby="diff-viewer-description"
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <History className="w-5 h-5 text-amber-600" aria-hidden="true" />
            What's Changed - Version {version.version_number}
          </DialogTitle>
          <DialogDescription id="diff-viewer-description">
            Review changes made to "{sopTitle}"
          </DialogDescription>
        </DialogHeader>

        {/* Change Summary */}
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="pt-4">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <h3 className="font-semibold text-amber-900 mb-1">Change Summary</h3>
                <p className="text-amber-800">{version.change_summary || 'Content updated'}</p>
              </div>
              <div className="text-right text-sm">
                <div className="flex items-center gap-1 text-gray-600">
                  <User className="w-4 h-4" aria-hidden="true" />
                  <span>Changed by: {version.changed_by || 'Unknown'}</span>
                </div>
                <div className="flex items-center gap-1 text-gray-500 mt-1">
                  <Clock className="w-4 h-4" aria-hidden="true" />
                  <time dateTime={version.created_at}>
                    {new Date(version.created_at).toLocaleString()}
                  </time>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Stats */}
        <div className="flex gap-4" role="group" aria-label="Change statistics">
          <div 
            className="flex items-center gap-2 px-3 py-2 bg-green-50 border border-green-200 rounded-lg"
            aria-label={`${additions.length} additions`}
          >
            <Plus className="w-4 h-4 text-green-600" aria-hidden="true" />
            <span className="text-green-700 font-medium">{additions.length} addition{additions.length !== 1 ? 's' : ''}</span>
          </div>
          <div 
            className="flex items-center gap-2 px-3 py-2 bg-red-50 border border-red-200 rounded-lg"
            aria-label={`${removals.length} removals`}
          >
            <Minus className="w-4 h-4 text-red-600" aria-hidden="true" />
            <span className="text-red-700 font-medium">{removals.length} removal{removals.length !== 1 ? 's' : ''}</span>
          </div>
        </div>

        {/* View Mode Tabs */}
        <Tabs 
          value={viewMode} 
          onValueChange={handleViewModeChange} 
          className="flex-1 flex flex-col min-h-0"
        >
          <TabsList className="w-full grid grid-cols-3" aria-label="View mode">
            <TabsTrigger value="diff" className="gap-2">
              <ArrowRight className="w-4 h-4" aria-hidden="true" />
              <span>Diff View</span>
            </TabsTrigger>
            <TabsTrigger value="old" className="gap-2">
              <FileText className="w-4 h-4" aria-hidden="true" />
              <span>Previous Version</span>
            </TabsTrigger>
            <TabsTrigger value="new" className="gap-2">
              <Eye className="w-4 h-4" aria-hidden="true" />
              <span>Current Version</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent 
            value="diff" 
            className="flex-1 mt-4 min-h-0"
            role="tabpanel"
            aria-label="Difference view showing additions and removals"
          >
            <ScrollArea className="h-[400px] border rounded-lg">
              <div className="p-4 space-y-3">
                {!version.previous_content_html ? (
                  <div className="text-center py-8 text-gray-500" role="status">
                    <FileText className="w-12 h-12 mx-auto mb-2 text-gray-300" aria-hidden="true" />
                    <p>This is the initial version - no previous content to compare</p>
                  </div>
                ) : (
                  <>
                    {removals.length > 0 && (
                      <section aria-labelledby="removed-content-heading">
                        <h4 
                          id="removed-content-heading" 
                          className="font-semibold text-red-700 flex items-center gap-2 mb-2"
                        >
                          <Minus className="w-4 h-4" aria-hidden="true" />
                          Removed Content
                        </h4>
                        <ul className="space-y-2" role="list" aria-label="Removed content items">
                          {removals.map((item, idx) => (
                            <li 
                              key={`remove-${idx}`}
                              className="bg-red-50 border-l-4 border-red-400 p-3 rounded-r text-red-800"
                            >
                              <span className="line-through">{item.text}</span>
                            </li>
                          ))}
                        </ul>
                      </section>
                    )}
                    
                    {additions.length > 0 && (
                      <section aria-labelledby="added-content-heading" className="mt-4">
                        <h4 
                          id="added-content-heading" 
                          className="font-semibold text-green-700 flex items-center gap-2 mb-2"
                        >
                          <Plus className="w-4 h-4" aria-hidden="true" />
                          Added Content
                        </h4>
                        <ul className="space-y-2" role="list" aria-label="Added content items">
                          {additions.map((item, idx) => (
                            <li 
                              key={`add-${idx}`}
                              className="bg-green-50 border-l-4 border-green-400 p-3 rounded-r text-green-800"
                            >
                              {item.text}
                            </li>
                          ))}
                        </ul>
                      </section>
                    )}

                    {additions.length === 0 && removals.length === 0 && (
                      <div className="text-center py-8 text-gray-500" role="status">
                        <p>No significant text changes detected (formatting may have changed)</p>
                      </div>
                    )}
                  </>
                )}
              </div>
            </ScrollArea>
          </TabsContent>

          <TabsContent 
            value="old" 
            className="flex-1 mt-4 min-h-0"
            role="tabpanel"
            aria-label="Previous version content"
          >
            <ScrollArea className="h-[400px] border rounded-lg bg-gray-50">
              <div className="p-4">
                {version.previous_content_html ? (
                  <article 
                    className="prose prose-sm max-w-none sop-content"
                    dangerouslySetInnerHTML={{ __html: version.previous_content_html }}
                    aria-label="Previous version content"
                  />
                ) : (
                  <div className="text-center py-8 text-gray-500" role="status">
                    <p>No previous version available</p>
                  </div>
                )}
              </div>
            </ScrollArea>
          </TabsContent>

          <TabsContent 
            value="new" 
            className="flex-1 mt-4 min-h-0"
            role="tabpanel"
            aria-label="Current version content"
          >
            <ScrollArea className="h-[400px] border rounded-lg">
              <div className="p-4">
                <article 
                  className="prose prose-sm max-w-none sop-content"
                  dangerouslySetInnerHTML={{ __html: version.content_html }}
                  aria-label="Current version content"
                />
              </div>
            </ScrollArea>
          </TabsContent>
        </Tabs>

        <div className="flex justify-end pt-4 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
