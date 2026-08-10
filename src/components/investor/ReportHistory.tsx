import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';
import { Loader2, FileText, Download, Eye, Calendar, MapPin, TrendingUp, Home, Sparkles } from 'lucide-react';
import { logReportViewed, logDocumentDownload } from '@/hooks/useActivityLog';

interface Props {
  investorId: string;
  preferredMarkets: string[];
}

export function ReportHistory({ investorId, preferredMarkets }: Props) {
  const [reports, setReports] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [selectedReport, setSelectedReport] = useState<any>(null);
  const { toast } = useToast();

  useEffect(() => { loadReports(); }, [investorId]);

  const loadReports = async () => {
    const { data } = await supabase.functions.invoke('generate-monthly-report', {
      body: { action: 'get_reports', investor_id: investorId }
    });
    setReports(data?.reports || []);
    setLoading(false);
  };

  const generateReport = async () => {
    if (preferredMarkets.length === 0) {
      toast({ title: 'No Markets', description: 'Please select preferred markets first.', variant: 'destructive' });
      return;
    }
    setGenerating(true);
    const { data, error } = await supabase.functions.invoke('generate-market-report', {
      body: { investor_id: investorId, markets: preferredMarkets, report_type: 'custom' }
    });
    setGenerating(false);
    if (data?.success) {
      toast({ title: 'Report Generated!', description: 'Your market report is ready.' });
      loadReports();
    } else {
      toast({ title: 'Error', description: error?.message || 'Failed to generate report', variant: 'destructive' });
    }
  };

  const viewReport = (report: any) => {
    setSelectedReport(report);
    
    // Log report viewed activity
    logReportViewed(investorId, {
      id: report.id,
      title: `${report.report_type === 'weekly' ? 'Weekly' : report.report_type === 'monthly' ? 'Monthly' : 'Custom'} Market Report`,
      market: report.markets?.join(', ')
    });
  };

  const downloadPDF = async (report: any) => {
    setDownloadingId(report.id);
    try {
      // Log download activity
      logDocumentDownload(investorId, {
        id: report.id,
        name: `Market Report - ${report.markets?.join(', ')}`,
        type: 'market_report_pdf'
      });

      if (report.pdf_url) {
        window.open(report.pdf_url, '_blank');
      } else {
        const { data, error } = await supabase.functions.invoke('generate-report-pdf', {
          body: { report_id: report.id }
        });
        if (data?.pdf_url) {
          window.open(data.pdf_url, '_blank');
          loadReports();
        } else {
          throw new Error(error?.message || 'Failed to generate PDF');
        }
      }
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    }
    setDownloadingId(null);
  };

  const formatDate = (d: string) => new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

  if (loading) return <div className="flex justify-center p-8"><Loader2 className="w-6 h-6 animate-spin" /></div>;

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2"><FileText className="w-5 h-5" />Market Reports</CardTitle>
          <Button onClick={generateReport} disabled={generating} className="bg-[#d4a574]">
            {generating ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Sparkles className="w-4 h-4 mr-2" />}
            Generate Report
          </Button>
        </CardHeader>
        <CardContent>
          {reports.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>No reports generated yet</p>
              <p className="text-sm">Click "Generate Report" to create your first market analysis</p>
            </div>
          ) : (
            <div className="space-y-3">
              {reports.map(report => (
                <div key={report.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50">
                  <div className="flex items-center gap-4">
                    <div className="p-2 bg-[#d4a574]/10 rounded-lg"><FileText className="w-5 h-5 text-[#d4a574]" /></div>
                    <div>
                      <p className="font-medium">{report.report_type === 'weekly' ? 'Weekly' : report.report_type === 'monthly' ? 'Monthly' : 'Custom'} Market Report</p>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Calendar className="w-3 h-3" />{formatDate(report.created_at)}
                        <MapPin className="w-3 h-3 ml-2" />{report.markets?.join(', ') || 'Multiple markets'}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={report.status === 'completed' ? 'default' : report.status === 'generating' ? 'secondary' : 'destructive'}>
                      {report.status}
                    </Badge>
                    {report.status === 'completed' && (
                      <>
                        <Button variant="ghost" size="sm" onClick={() => viewReport(report)}><Eye className="w-4 h-4" /></Button>
                        <Button variant="outline" size="sm" onClick={() => downloadPDF(report)} disabled={downloadingId === report.id}>
                          {downloadingId === report.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!selectedReport} onOpenChange={() => setSelectedReport(null)}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <DialogTitle>Market Report - {selectedReport?.markets?.join(', ')}</DialogTitle>
              {selectedReport && (
                <Button variant="outline" size="sm" onClick={() => downloadPDF(selectedReport)} disabled={downloadingId === selectedReport?.id}>
                  {downloadingId === selectedReport?.id ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Download className="w-4 h-4 mr-2" />}
                  Download PDF
                </Button>
              )}
            </div>
          </DialogHeader>
          {selectedReport?.report_data && <ReportContent data={selectedReport.report_data} />}
        </DialogContent>
      </Dialog>
    </>
  );
}

function ReportContent({ data }: { data: any }) {
  return (
    <div className="space-y-6">
      {data.market_overview && (
        <div><h3 className="font-semibold flex items-center gap-2 mb-2"><TrendingUp className="w-4 h-4" />Market Overview</h3>
          <p className="text-sm text-muted-foreground">{typeof data.market_overview === 'string' ? data.market_overview : JSON.stringify(data.market_overview)}</p>
        </div>
      )}
      {data.rental_data && (
        <div><h3 className="font-semibold flex items-center gap-2 mb-2"><Home className="w-4 h-4" />Rental Analysis</h3>
          <p className="text-sm text-muted-foreground">{typeof data.rental_data === 'string' ? data.rental_data : JSON.stringify(data.rental_data)}</p>
        </div>
      )}
      {data.str_data && (
        <div><h3 className="font-semibold mb-2">STR Performance</h3>
          <p className="text-sm text-muted-foreground">{typeof data.str_data === 'string' ? data.str_data : JSON.stringify(data.str_data)}</p>
        </div>
      )}
      {data.recommendations && (
        <div><h3 className="font-semibold flex items-center gap-2 mb-2"><Sparkles className="w-4 h-4" />Recommendations</h3>
          <p className="text-sm text-muted-foreground">{typeof data.recommendations === 'string' ? data.recommendations : JSON.stringify(data.recommendations)}</p>
        </div>
      )}
      {data.new_deals?.length > 0 && (
        <div><h3 className="font-semibold mb-2">New Deals ({data.new_deals.length})</h3>
          <div className="grid gap-2">{data.new_deals.slice(0, 5).map((d: any) => (
            <div key={d.id} className="p-3 border rounded text-sm"><p className="font-medium">{d.address || d.full_address}</p><p className="text-muted-foreground">${d.price?.toLocaleString()} • {d.bedrooms}bd/{d.bathrooms}ba</p></div>
          ))}</div>
        </div>
      )}
    </div>
  );
}
