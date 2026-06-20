import { useState, useEffect } from 'react';
import { 
  FileText, 
  Download, 
  Mail, 
  Trash2, 
  Calendar, 
  Building, 
  BedDouble,
  MapPin,
  DollarSign,
  Loader2,
  AlertCircle,
  CheckCircle2,
  ExternalLink,
  RefreshCw
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';

interface SavedQuote {
  id: string;
  quote_number: string;
  property_count: number;
  bedrooms: string;
  property_type: string;
  operation_type: string;
  location: string | null;
  admin_fee: number;
  furniture_cost: number;
  logistics_fee: number;
  total_estimate: number;
  per_property_cost: number;
  bulk_savings: number;
  valid_until: string;
  status: string;
  created_at: string;
}

interface SavedQuotesProps {
  investorId: string;
}

export function SavedQuotes({ investorId }: SavedQuotesProps) {
  const [quotes, setQuotes] = useState<SavedQuote[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const { toast } = useToast();

  const fetchQuotes = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-setup-quote', {
        body: {
          action: 'list',
          investorId
        }
      });

      if (error || data?.error) {
        throw new Error(data?.error || error?.message);
      }

      setQuotes(data.quotes || []);
    } catch (err: any) {
      console.error('Error fetching quotes:', err);
      toast({
        title: 'Error',
        description: 'Failed to load saved quotes',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchQuotes();
  }, [investorId]);

  const handleDownload = async (quote: SavedQuote) => {
    setActionLoading(`download-${quote.id}`);
    try {
      const { data, error } = await supabase.functions.invoke('generate-setup-quote', {
        body: {
          action: 'generate',
          quoteData: {
            propertyCount: quote.property_count,
            bedrooms: quote.bedrooms,
            propertyType: quote.property_type,
            operationType: quote.operation_type,
            location: quote.location || '',
            totals: {
              adminFee: quote.admin_fee,
              furnitureCost: quote.furniture_cost,
              logisticsFee: quote.logistics_fee,
              total: quote.total_estimate,
              perProperty: quote.per_property_cost,
              savings: quote.bulk_savings
            }
          }
        }
      });

      if (error || data?.error) {
        throw new Error(data?.error || error?.message);
      }

      const blob = new Blob([data.html], { type: 'text/html' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `AYP-Setup-Quote-${quote.quote_number}.html`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast({
        title: 'Downloaded',
        description: 'Quote downloaded successfully'
      });
    } catch (err: any) {
      toast({
        title: 'Error',
        description: 'Failed to download quote',
        variant: 'destructive'
      });
    } finally {
      setActionLoading(null);
    }
  };

  const handleEmail = async (quote: SavedQuote, email: string) => {
    setActionLoading(`email-${quote.id}`);
    try {
      const { data, error } = await supabase.functions.invoke('generate-setup-quote', {
        body: {
          action: 'email',
          email,
          quoteData: {
            propertyCount: quote.property_count,
            bedrooms: quote.bedrooms,
            propertyType: quote.property_type,
            operationType: quote.operation_type,
            location: quote.location || '',
            totals: {
              adminFee: quote.admin_fee,
              furnitureCost: quote.furniture_cost,
              logisticsFee: quote.logistics_fee,
              total: quote.total_estimate,
              perProperty: quote.per_property_cost,
              savings: quote.bulk_savings
            }
          }
        }
      });

      if (error || data?.error) {
        throw new Error(data?.error || error?.message);
      }

      toast({
        title: 'Sent',
        description: `Quote emailed to ${email}`
      });
    } catch (err: any) {
      toast({
        title: 'Error',
        description: 'Failed to send email',
        variant: 'destructive'
      });
    } finally {
      setActionLoading(null);
    }
  };

  const getBedroomLabel = (value: string) => {
    const labels: Record<string, string> = {
      'studio': 'Studio',
      '1': '1 BR',
      '2': '2 BR',
      '3': '3 BR',
      '4': '4 BR',
      '5+': '5+ BR'
    };
    return labels[value] || value;
  };

  const getPropertyTypeLabel = (value: string) => {
    const labels: Record<string, string> = {
      'apartment': 'Apartment',
      'condo': 'Condo',
      'townhome': 'Townhome',
      'single-family': 'Single Family',
      'high-rise': 'High-Rise'
    };
    return labels[value] || value;
  };

  const getOperationTypeLabel = (value: string) => {
    const labels: Record<string, string> = {
      'str': 'STR',
      'mtr': 'MTR',
      'coliving': 'Co-Living',
      'corporate': 'Corporate',
      'peerspace': 'Peerspace'
    };
    return labels[value] || value;
  };

  const isExpired = (validUntil: string) => {
    return new Date(validUntil) < new Date();
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-[#d4a574]" />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Saved Quotes</h2>
          <p className="text-gray-600">Your setup service estimates</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={fetchQuotes}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
          <Button 
            onClick={() => window.open('/setup-services#cost-calculator', '_blank')}
            className="bg-[#d4a574] hover:bg-[#c49564]"
          >
            <FileText className="w-4 h-4 mr-2" />
            New Quote
          </Button>
        </div>
      </div>

      {quotes.length === 0 ? (
        <Card>
          <CardContent className="text-center py-12">
            <FileText className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No Saved Quotes</h3>
            <p className="text-gray-600 mb-6">
              Use our Setup Cost Calculator to create and save estimates for your property setups.
            </p>
            <Button 
              onClick={() => window.open('/setup-services#cost-calculator', '_blank')}
              className="bg-[#d4a574] hover:bg-[#c49564]"
            >
              <ExternalLink className="w-4 h-4 mr-2" />
              Go to Calculator
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {quotes.map((quote) => {
            const expired = isExpired(quote.valid_until);
            
            return (
              <Card key={quote.id} className={expired ? 'opacity-70' : ''}>
                <CardContent className="p-6">
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    {/* Quote Info */}
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-3">
                        <h3 className="font-semibold text-lg">Quote #{quote.quote_number}</h3>
                        {expired ? (
                          <Badge variant="destructive" className="text-xs">
                            Expired
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-xs bg-emerald-50 text-emerald-700 border-emerald-200">
                            Valid
                          </Badge>
                        )}
                        {quote.bulk_savings > 0 && (
                          <Badge className="bg-[#d4a574]/10 text-[#d4a574] text-xs">
                            Bulk Discount
                          </Badge>
                        )}
                      </div>
                      
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        <div className="flex items-center gap-2">
                          <Building className="w-4 h-4 text-gray-400" />
                          <span>{quote.property_count} {quote.property_count === 1 ? 'Property' : 'Properties'}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <BedDouble className="w-4 h-4 text-gray-400" />
                          <span>{getBedroomLabel(quote.bedrooms)}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-gray-500">{getPropertyTypeLabel(quote.property_type)}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-gray-500">{getOperationTypeLabel(quote.operation_type)}</span>
                        </div>
                        {quote.location && (
                          <div className="flex items-center gap-2 col-span-2">
                            <MapPin className="w-4 h-4 text-gray-400" />
                            <span>{quote.location}</span>
                          </div>
                        )}
                      </div>

                      <div className="flex items-center gap-4 mt-3 text-xs text-gray-500">
                        <span>Created: {new Date(quote.created_at).toLocaleDateString()}</span>
                        <span>Valid until: {new Date(quote.valid_until).toLocaleDateString()}</span>
                      </div>
                    </div>

                    {/* Pricing */}
                    <div className="lg:text-right">
                      <div className="text-2xl font-bold text-[#d4a574]">
                        ${quote.total_estimate.toLocaleString()}
                      </div>
                      <div className="text-sm text-gray-500">
                        ${quote.per_property_cost.toLocaleString()}/property
                      </div>
                      {quote.bulk_savings > 0 && (
                        <div className="text-xs text-emerald-600 mt-1">
                          Save ${quote.bulk_savings.toLocaleString()}
                        </div>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex lg:flex-col gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDownload(quote)}
                        disabled={actionLoading === `download-${quote.id}`}
                      >
                        {actionLoading === `download-${quote.id}` ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Download className="w-4 h-4" />
                        )}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          const investor = JSON.parse(localStorage.getItem('investor') || '{}');
                          if (investor.email) {
                            handleEmail(quote, investor.email);
                          }
                        }}
                        disabled={actionLoading === `email-${quote.id}`}
                      >
                        {actionLoading === `email-${quote.id}` ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Mail className="w-4 h-4" />
                        )}
                      </Button>
                    </div>
                  </div>

                  {/* Cost Breakdown */}
                  <div className="mt-4 pt-4 border-t grid grid-cols-3 gap-4 text-sm">
                    <div>
                      <span className="text-gray-500">Admin Fee</span>
                      <div className="font-medium">${quote.admin_fee.toLocaleString()}</div>
                    </div>
                    <div>
                      <span className="text-gray-500">Furniture</span>
                      <div className="font-medium">${quote.furniture_cost.toLocaleString()}</div>
                    </div>
                    <div>
                      <span className="text-gray-500">Logistics</span>
                      <div className="font-medium">${quote.logistics_fee.toLocaleString()}</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Info Card */}
      <Card className="bg-blue-50 border-blue-200">
        <CardContent className="p-4 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-blue-800">
            <p className="font-medium mb-1">About Setup Quotes</p>
            <p>
              Quotes are estimates based on the calculator inputs and are valid for 30 days. 
              Final pricing may vary based on actual property conditions, design selections, and market factors. 
              Contact our team for a detailed consultation and binding proposal.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
