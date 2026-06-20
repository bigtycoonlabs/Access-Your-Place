import { useState, useEffect } from 'react';
import { 
  X, 
  Download, 
  Mail, 
  Save, 
  CheckCircle2, 
  Loader2,
  FileText,
  AlertCircle,
  User,
  LogIn
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { CalculatorData } from './SetupCostCalculator';

interface QuoteOptionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  quoteData: CalculatorData;
  onScrollToForm: () => void;
}

export default function QuoteOptionsModal({ 
  isOpen, 
  onClose, 
  quoteData,
  onScrollToForm 
}: QuoteOptionsModalProps) {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [activeAction, setActiveAction] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [investor, setInvestor] = useState<any>(null);

  // Check if user is logged in
  useEffect(() => {
    const storedInvestor = localStorage.getItem('investor');
    if (storedInvestor) {
      try {
        const parsed = JSON.parse(storedInvestor);
        setInvestor(parsed);
        setEmail(parsed.email || '');
      } catch (e) {
        console.error('Error parsing investor data:', e);
      }
    }
  }, [isOpen]);

  const handleDownloadPDF = async () => {
    setIsLoading(true);
    setActiveAction('download');
    setError(null);
    setSuccess(null);

    try {
      const { data, error: fnError } = await supabase.functions.invoke('generate-setup-quote', {
        body: {
          action: 'generate',
          quoteData
        }
      });

      if (fnError || data?.error) {
        throw new Error(data?.error || fnError?.message || 'Failed to generate quote');
      }

      // Create a blob and download
      const blob = new Blob([data.html], { type: 'text/html' });
      const url = URL.createObjectURL(blob);
      
      // Create a temporary link and trigger download
      const link = document.createElement('a');
      link.href = url;
      link.download = `AYP-Setup-Quote-${data.quoteNumber}.html`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      setSuccess(`Quote downloaded! Valid until ${data.validUntil}. Open the file in your browser and use Print > Save as PDF for a PDF version.`);
    } catch (err: any) {
      setError(err.message || 'Failed to download quote');
    } finally {
      setIsLoading(false);
      setActiveAction(null);
    }
  };

  const handleEmailQuote = async () => {
    if (!email) {
      setError('Please enter your email address');
      return;
    }

    setIsLoading(true);
    setActiveAction('email');
    setError(null);
    setSuccess(null);

    try {
      const { data, error: fnError } = await supabase.functions.invoke('generate-setup-quote', {
        body: {
          action: 'email',
          quoteData,
          email
        }
      });

      if (fnError || data?.error) {
        throw new Error(data?.error || fnError?.message || 'Failed to send email');
      }

      setSuccess(`Quote sent to ${email}! Check your inbox for quote #${data.quoteNumber}.`);
    } catch (err: any) {
      setError(err.message || 'Failed to send email');
    } finally {
      setIsLoading(false);
      setActiveAction(null);
    }
  };

  const handleSaveToAccount = async () => {
    if (!investor?.id) {
      setError('Please log in to save quotes to your account');
      return;
    }

    setIsLoading(true);
    setActiveAction('save');
    setError(null);
    setSuccess(null);

    try {
      const { data, error: fnError } = await supabase.functions.invoke('generate-setup-quote', {
        body: {
          action: 'save',
          quoteData,
          investorId: investor.id
        }
      });

      if (fnError || data?.error) {
        throw new Error(data?.error || fnError?.message || 'Failed to save quote');
      }

      setSuccess(`Quote #${data.quoteNumber} saved to your account! View it anytime in your investor portal.`);
    } catch (err: any) {
      setError(err.message || 'Failed to save quote');
    } finally {
      setIsLoading(false);
      setActiveAction(null);
    }
  };

  const handleGetDetailedQuote = () => {
    onClose();
    onScrollToForm();
  };

  if (!isOpen) return null;

  const getBedroomLabel = (value: string) => {
    const labels: Record<string, string> = {
      'studio': 'Studio',
      '1': '1 Bedroom',
      '2': '2 Bedrooms',
      '3': '3 Bedrooms',
      '4': '4 Bedrooms',
      '5+': '5+ Bedrooms'
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
      'str': 'Short-Term Rental',
      'mtr': 'Mid-Term Rental',
      'coliving': 'Co-Living',
      'corporate': 'Corporate Housing',
      'peerspace': 'Peerspace'
    };
    return labels[value] || value;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="relative bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-gradient-to-r from-[#1a2332] to-[#2a3d52] text-white p-6 rounded-t-2xl">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-white/70 hover:text-white transition-colors"
          >
            <X size={24} />
          </button>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-[#d4a574]/20 rounded-full flex items-center justify-center">
              <FileText className="w-6 h-6 text-[#d4a574]" />
            </div>
            <div>
              <h2 className="text-2xl font-bold">Your Setup Quote</h2>
              <p className="text-gray-300 text-sm">Save, download, or email your estimate</p>
            </div>
          </div>
        </div>

        <div className="p-6">
          {/* Quote Summary */}
          <div className="bg-gray-50 rounded-xl p-5 mb-6">
            <h3 className="font-semibold text-[#1a2332] mb-4">Quote Summary</h3>
            <div className="grid grid-cols-2 gap-4 text-sm mb-4">
              <div>
                <span className="text-gray-500">Properties:</span>
                <span className="ml-2 font-medium">{quoteData.propertyCount}</span>
              </div>
              <div>
                <span className="text-gray-500">Bedrooms:</span>
                <span className="ml-2 font-medium">{getBedroomLabel(quoteData.bedrooms)}</span>
              </div>
              <div>
                <span className="text-gray-500">Type:</span>
                <span className="ml-2 font-medium">{getPropertyTypeLabel(quoteData.propertyType)}</span>
              </div>
              <div>
                <span className="text-gray-500">Operation:</span>
                <span className="ml-2 font-medium">{getOperationTypeLabel(quoteData.operationType)}</span>
              </div>
              {quoteData.location && (
                <div className="col-span-2">
                  <span className="text-gray-500">Location:</span>
                  <span className="ml-2 font-medium">{quoteData.location}</span>
                </div>
              )}
            </div>
            <div className="border-t pt-4 flex justify-between items-center">
              <div>
                <span className="text-gray-600">Total Estimate</span>
                {quoteData.totals.savings > 0 && (
                  <span className="ml-2 text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full">
                    Save ${quoteData.totals.savings.toLocaleString()}
                  </span>
                )}
              </div>
              <span className="text-2xl font-bold text-[#d4a574]">
                ${quoteData.totals.total.toLocaleString()}
              </span>
            </div>
          </div>

          {/* Success/Error Messages */}
          {success && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4 mb-6 flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
              <p className="text-emerald-800 text-sm">{success}</p>
            </div>
          )}

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <p className="text-red-800 text-sm">{error}</p>
            </div>
          )}

          {/* Action Options */}
          <div className="space-y-4">
            {/* Download PDF */}
            <div className="border rounded-xl p-5 hover:border-[#d4a574] transition-colors">
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                    <Download className="w-5 h-5 text-blue-600" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-[#1a2332]">Download Quote</h4>
                    <p className="text-sm text-gray-600 mt-1">
                      Download an HTML file you can print or save as PDF. Includes full breakdown and company branding.
                    </p>
                  </div>
                </div>
                <button
                  onClick={handleDownloadPDF}
                  disabled={isLoading}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {isLoading && activeAction === 'download' ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Download size={16} />
                  )}
                  Download
                </button>
              </div>
            </div>

            {/* Email Quote */}
            <div className="border rounded-xl p-5 hover:border-[#d4a574] transition-colors">
              <div className="flex items-start gap-4 mb-4">
                <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center flex-shrink-0">
                  <Mail className="w-5 h-5 text-purple-600" />
                </div>
                <div className="flex-1">
                  <h4 className="font-semibold text-[#1a2332]">Email Quote</h4>
                  <p className="text-sm text-gray-600 mt-1">
                    Receive your quote via email with a professional PDF attachment.
                  </p>
                </div>
              </div>
              <div className="flex gap-3">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Enter your email address"
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#d4a574] focus:border-transparent"
                />
                <button
                  onClick={handleEmailQuote}
                  disabled={isLoading || !email}
                  className="px-4 py-2 bg-purple-600 text-white rounded-lg font-medium hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {isLoading && activeAction === 'email' ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Mail size={16} />
                  )}
                  Send
                </button>
              </div>
            </div>

            {/* Save to Account */}
            <div className="border rounded-xl p-5 hover:border-[#d4a574] transition-colors">
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 bg-emerald-100 rounded-full flex items-center justify-center flex-shrink-0">
                    {investor ? (
                      <Save className="w-5 h-5 text-emerald-600" />
                    ) : (
                      <User className="w-5 h-5 text-emerald-600" />
                    )}
                  </div>
                  <div>
                    <h4 className="font-semibold text-[#1a2332]">
                      {investor ? 'Save to Your Account' : 'Save to Investor Portal'}
                    </h4>
                    <p className="text-sm text-gray-600 mt-1">
                      {investor 
                        ? `Logged in as ${investor.full_name || investor.email}. Save this quote to access it anytime from your investor portal.`
                        : 'Log in to your investor portal to save quotes and access them anytime.'
                      }
                    </p>
                  </div>
                </div>
                {investor ? (
                  <button
                    onClick={handleSaveToAccount}
                    disabled={isLoading}
                    className="px-4 py-2 bg-emerald-600 text-white rounded-lg font-medium hover:bg-emerald-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    {isLoading && activeAction === 'save' ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Save size={16} />
                    )}
                    Save
                  </button>
                ) : (
                  <a
                    href="/investor/login"
                    className="px-4 py-2 bg-gray-600 text-white rounded-lg font-medium hover:bg-gray-700 transition-colors flex items-center gap-2"
                  >
                    <LogIn size={16} />
                    Log In
                  </a>
                )}
              </div>
            </div>
          </div>

          {/* Divider */}
          <div className="relative my-8">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-200" />
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="bg-white px-4 text-gray-500">or</span>
            </div>
          </div>

          {/* Get Detailed Quote CTA */}
          <button
            onClick={handleGetDetailedQuote}
            className="w-full bg-[#d4a574] text-[#1a2332] py-4 rounded-lg font-bold text-lg hover:bg-[#c49564] transition-colors flex items-center justify-center gap-2"
          >
            Request Detailed Consultation
          </button>
          <p className="text-center text-sm text-gray-500 mt-3">
            Get a personalized quote with exact pricing based on your specific requirements
          </p>
        </div>
      </div>
    </div>
  );
}
