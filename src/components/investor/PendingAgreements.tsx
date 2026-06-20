import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { SignaturePad, type SignatureResult } from './SignaturePad';
import {
  Loader2, FileSignature, AlertCircle, Clock, CheckCircle,
  Eye, PenTool, Shield, Calendar, FileText, ChevronDown, ChevronUp,
  ScrollText, RefreshCw
} from 'lucide-react';

interface Agreement {
  id: string;
  document_name: string;
  document_type: string;
  content: string;
  status: string;
  created_at: string;
  expires_at?: string;
  signed_at?: string;
  sent_by?: string;
  sent_by_id?: string;
  source_table?: string;
  metadata?: any;
}

interface Props {
  investorId: string;
  investorName: string;
  investorEmail: string;
  onNavigateToSignatures?: () => void;
}

export function PendingAgreements({ investorId, investorName, investorEmail, onNavigateToSignatures }: Props) {
  const [agreements, setAgreements] = useState<Agreement[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedAgreement, setSelectedAgreement] = useState<Agreement | null>(null);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [showSignModal, setShowSignModal] = useState(false);
  const [signing, setSigning] = useState(false);
  const [signatureResult, setSignatureResult] = useState<SignatureResult | null>(null);
  const [initials, setInitials] = useState('');
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [hasScrolledToBottom, setHasScrolledToBottom] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const { toast } = useToast();

  const fetchAgreements = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('sign-agreement', {
        body: { action: 'get_pending_agreements', investor_id: investorId }
      });
      if (data?.agreements) {
        setAgreements(data.agreements);
      }
    } catch (err) {
      console.error('Error fetching agreements:', err);
    }
    setLoading(false);
  }, [investorId]);

  useEffect(() => { fetchAgreements(); }, [fetchAgreements]);

  const handleReview = (agreement: Agreement) => {
    setSelectedAgreement(agreement);
    setShowReviewModal(true);
  };

  const handleOpenSign = (agreement: Agreement) => {
    setSelectedAgreement(agreement);
    setSignatureResult(null);
    setInitials('');
    setAgreedToTerms(false);
    setHasScrolledToBottom(false);
    setShowSignModal(true);
  };

  const handleAgreementScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 50;
    if (atBottom && !hasScrolledToBottom) {
      setHasScrolledToBottom(true);
    }
  };

  const handleSign = async () => {
    if (!selectedAgreement) return;

    if (!signatureResult) {
      toast({ title: 'Signature Required', description: 'Please provide your signature using the pad below.', variant: 'destructive' });
      return;
    }

    if (!agreedToTerms) {
      toast({ title: 'Agreement Required', description: 'You must agree to the terms before signing.', variant: 'destructive' });
      return;
    }

    setSigning(true);
    try {
      // Get IP address for audit trail
      let ipAddress = 'unknown';
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3000);
        const ipRes = await fetch('https://api.ipify.org?format=json', { signal: controller.signal });
        clearTimeout(timeoutId);
        const ipData = await ipRes.json();
        ipAddress = ipData.ip || 'unknown';
      } catch { /* ignore IP fetch errors */ }

      const { data, error } = await supabase.functions.invoke('sign-agreement', {
        body: {
          action: 'sign_agreement',
          agreement_id: selectedAgreement.id,
          investor_id: investorId,
          investor_name: investorName,
          investor_email: investorEmail,
          signature_name: signatureResult.typedName || investorName,
          signature_type: signatureResult.type,
          signature_image: signatureResult.signatureImageDataUrl,
          initials: initials.trim(),
          ip_address: ipAddress,
          source_table: selectedAgreement.source_table
        }
      });

      if (data?.success) {
        toast({
          title: 'Agreement Signed Successfully!',
          description: 'Your signature has been recorded. Confirmation emails have been sent to you and your Success Team.'
        });
        setShowSignModal(false);
        setSelectedAgreement(null);
        fetchAgreements();
      } else {
        throw new Error(data?.error || 'Failed to sign agreement');
      }
    } catch (err: any) {
      // Fallback: try manage-document-signatures
      try {
        const signTimestamp = new Date().toISOString();
        const { data, error } = await supabase.functions.invoke('manage-document-signatures', {
          body: {
            action: 'sign_document',
            document_id: selectedAgreement.id,
            investor_id: investorId,
            signature_data: {
              type: signatureResult.type,
              signature: signatureResult.signatureData,
              signed_name: signatureResult.typedName || investorName,
              typed_name: signatureResult.typedName || investorName,
              initials: initials.trim(),
              timestamp: signTimestamp,
              agreed_to_terms: true,
              has_drawn_signature: signatureResult.type === 'drawn',
            },
            signed_ip: 'unknown'
          }
        });
        if (data?.success) {
          toast({
            title: 'Agreement Signed Successfully!',
            description: 'Your signature has been recorded.'
          });
          setShowSignModal(false);
          setSelectedAgreement(null);
          fetchAgreements();
        } else {
          throw new Error(data?.error || err.message || 'Failed to sign');
        }
      } catch (fallbackErr: any) {
        toast({ title: 'Error', description: fallbackErr.message || err.message || 'Failed to sign agreement', variant: 'destructive' });
      }
    }
    setSigning(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-6">
        <Loader2 className="w-6 h-6 animate-spin text-[#d4a574]" />
      </div>
    );
  }

  if (agreements.length === 0) return null;

  return (
    <>
      <Card className="border-amber-300 bg-gradient-to-br from-amber-50 to-orange-50 shadow-lg">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2 text-amber-900">
              <FileSignature className="w-5 h-5 text-amber-600" />
              Pending Agreements
              <Badge variant="destructive" className="ml-2">
                {agreements.length} Awaiting Signature
              </Badge>
            </CardTitle>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" onClick={fetchAgreements} className="text-amber-700 h-8 w-8 p-0">
                <RefreshCw className="w-4 h-4" />
              </Button>
              {onNavigateToSignatures && (
                <Button variant="ghost" size="sm" onClick={onNavigateToSignatures} className="text-amber-700">
                  View All Signatures
                </Button>
              )}
            </div>
          </div>
          <CardDescription className="text-amber-700">
            You have agreements that require your review and electronic signature. Please review each document carefully before signing.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {agreements.map(agreement => (
            <div
              key={agreement.id}
              className="bg-white rounded-xl border border-amber-200 overflow-hidden shadow-sm hover:shadow-md transition-shadow"
            >
              <div className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3 flex-1">
                    <div className="p-2.5 bg-amber-100 rounded-lg flex-shrink-0">
                      <FileText className="w-5 h-5 text-amber-700" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="font-semibold text-gray-900">{agreement.document_name}</h4>
                      <div className="flex items-center gap-3 mt-1 text-sm text-gray-500">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3.5 h-3.5" />
                          Sent {new Date(agreement.created_at).toLocaleDateString()}
                        </span>
                        {agreement.expires_at && (
                          <span className="flex items-center gap-1 text-red-500">
                            <Clock className="w-3.5 h-3.5" />
                            Expires {new Date(agreement.expires_at).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                      {(agreement.metadata?.sent_by_name || agreement.sent_by) && (
                        <p className="text-xs text-gray-400 mt-1">
                          Sent by: {agreement.metadata?.sent_by_name || agreement.sent_by}
                        </p>
                      )}
                    </div>
                  </div>
                  <Badge className="bg-amber-500 flex-shrink-0">
                    <Clock className="w-3 h-3 mr-1" />Pending
                  </Badge>
                </div>

                {/* Expandable Preview */}
                {agreement.content && (
                  <div className="mt-3">
                    <button
                      onClick={() => setExpandedId(expandedId === agreement.id ? null : agreement.id)}
                      className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800 font-medium"
                    >
                      {expandedId === agreement.id ? (
                        <><ChevronUp className="w-4 h-4" />Hide Preview</>
                      ) : (
                        <><ChevronDown className="w-4 h-4" />Preview Agreement</>
                      )}
                    </button>
                    {expandedId === agreement.id && (
                      <div className="mt-2 p-4 bg-gray-50 rounded-lg border max-h-64 overflow-y-auto">
                        <pre className="whitespace-pre-wrap text-xs font-mono text-gray-700 leading-relaxed">
                          {agreement.content.substring(0, 2000)}
                          {agreement.content.length > 2000 && '\n\n... [Click "Review & Sign" to see the complete document]'}
                        </pre>
                      </div>
                    )}
                  </div>
                )}

                {/* Action Buttons */}
                <div className="flex items-center gap-2 mt-4 pt-3 border-t border-gray-100">
                  <Button variant="outline" size="sm" onClick={() => handleReview(agreement)} className="flex-1 sm:flex-none">
                    <Eye className="w-4 h-4 mr-1.5" />Review Full Agreement
                  </Button>
                  <Button size="sm" onClick={() => handleOpenSign(agreement)} className="flex-1 sm:flex-none bg-[#d4a574] hover:bg-[#c49464]">
                    <PenTool className="w-4 h-4 mr-1.5" />Review & Sign
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Full Review Modal (read-only) */}
      <Dialog open={showReviewModal} onOpenChange={setShowReviewModal}>
        <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Eye className="w-5 h-5 text-[#d4a574]" />
              {selectedAgreement?.document_name}
            </DialogTitle>
            <DialogDescription>
              Review this agreement carefully before signing. Scroll down to read the entire document.
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 max-h-[60vh] overflow-y-auto">
            <div className="bg-white p-6 sm:p-8 border rounded-lg">
              <pre className="whitespace-pre-wrap font-mono text-sm leading-relaxed text-gray-800">
                {selectedAgreement?.content || 'No content available.'}
              </pre>
            </div>
          </div>
          <DialogFooter className="border-t pt-4 flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={() => setShowReviewModal(false)}>Close</Button>
            <Button
              onClick={() => {
                setShowReviewModal(false);
                if (selectedAgreement) handleOpenSign(selectedAgreement);
              }}
              className="bg-[#d4a574] hover:bg-[#c49464]"
            >
              <PenTool className="w-4 h-4 mr-2" />Proceed to Sign
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ===== SIGN AGREEMENT MODAL ===== */}
      <Dialog open={showSignModal} onOpenChange={setShowSignModal}>
        <DialogContent className="max-w-4xl max-h-[95vh] flex flex-col p-0 gap-0">
          <DialogHeader className="px-6 pt-6 pb-4 border-b flex-shrink-0">
            <DialogTitle className="flex items-center gap-2">
              <PenTool className="w-5 h-5 text-[#d4a574]" />
              Sign Agreement
            </DialogTitle>
            <DialogDescription>
              {selectedAgreement?.document_name}
              {(selectedAgreement?.metadata?.sent_by_name || selectedAgreement?.sent_by) && (
                <span className="ml-2 text-gray-400">| Sent by: {selectedAgreement.metadata?.sent_by_name || selectedAgreement.sent_by}</span>
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto px-6 py-4 space-y-6 min-h-0">
            {/* Step 1: Full Agreement Text */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <Label className="text-sm font-semibold flex items-center gap-1.5 text-gray-700">
                  <ScrollText className="w-4 h-4" />
                  Step 1: Review the Full Agreement
                </Label>
                {hasScrolledToBottom ? (
                  <Badge className="bg-green-500 text-xs">
                    <CheckCircle className="w-3 h-3 mr-1" />Reviewed
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-xs text-amber-600 border-amber-300">
                    <ChevronDown className="w-3 h-3 mr-1" />Scroll to read
                  </Badge>
                )}
              </div>
              <div
                className="bg-white border-2 border-gray-200 rounded-xl p-5 max-h-[350px] overflow-y-auto shadow-inner"
                onScroll={handleAgreementScroll}
              >
                {selectedAgreement?.content ? (
                  <pre className="whitespace-pre-wrap text-sm font-mono text-gray-800 leading-relaxed">
                    {selectedAgreement.content}
                  </pre>
                ) : (
                  <div className="text-center py-8 text-gray-400">
                    <FileText className="w-10 h-10 mx-auto mb-3 text-gray-300" />
                    <p>Agreement content is available for review upon request.</p>
                    <p className="text-xs mt-1">Contact your Success Team for a copy.</p>
                  </div>
                )}
              </div>
              {!hasScrolledToBottom && selectedAgreement?.content && (
                <p className="text-xs text-amber-600 mt-1.5 flex items-center gap-1">
                  <ChevronDown className="w-3 h-3 animate-bounce" />
                  Please scroll through the entire agreement before signing
                </p>
              )}
            </div>

            {/* Step 2: Initials */}
            <div>
              <Label className="text-sm font-semibold flex items-center gap-1.5 text-gray-700 mb-2">
                Step 2: Your Initials
              </Label>
              <Input
                value={initials}
                onChange={(e) => setInitials(e.target.value.toUpperCase())}
                placeholder="e.g., JD"
                maxLength={4}
                className="w-28 text-center text-lg font-bold tracking-wider"
              />
            </div>

            {/* Step 3: Signature Pad */}
            <div>
              <Label className="text-sm font-semibold flex items-center gap-1.5 text-gray-700 mb-2">
                <PenTool className="w-4 h-4" />
                Step 3: Provide Your Electronic Signature
              </Label>
              <SignaturePad
                investorName={investorName}
                onSignatureChange={setSignatureResult}
                disabled={signing}
              />
            </div>

            {/* Security Notice */}
            <div className="flex items-start gap-3 p-4 bg-blue-50 rounded-lg border border-blue-200">
              <Shield className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-blue-800">
                <p className="font-medium">Secure Electronic Signature</p>
                <p className="mt-1 text-blue-600">
                  Your signature is legally binding under the ESIGN Act and UETA.
                  Your IP address and timestamp will be recorded for verification.
                  Confirmation emails will be sent to you and the staff member who sent this agreement.
                </p>
              </div>
            </div>

            {/* Terms Agreement */}
            <div className="flex items-start gap-3 p-4 bg-gray-50 rounded-lg border">
              <Checkbox
                id="agree-sign-terms-pa"
                checked={agreedToTerms}
                onCheckedChange={(checked) => setAgreedToTerms(checked as boolean)}
                className="mt-0.5"
              />
              <label htmlFor="agree-sign-terms-pa" className="text-sm text-gray-700 cursor-pointer leading-relaxed">
                I have read and understand the full agreement above. I confirm that my electronic signature
                is legally binding and has the same legal effect as a handwritten signature. I acknowledge
                that this action cannot be undone.
              </label>
            </div>
          </div>

          <DialogFooter className="px-6 py-4 border-t flex-shrink-0 gap-2">
            <Button variant="outline" onClick={() => setShowSignModal(false)}>Cancel</Button>
            <Button
              onClick={handleSign}
              disabled={signing || !agreedToTerms || !signatureResult}
              className="bg-[#1a365d] hover:bg-[#2d4a7c]"
            >
              {signing ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Signing...</>
              ) : (
                <><CheckCircle className="w-4 h-4 mr-2" />Sign Agreement</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
