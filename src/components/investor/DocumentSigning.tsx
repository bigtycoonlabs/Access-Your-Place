import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { SignaturePad, type SignatureResult } from './SignaturePad';
import { 
  Loader2, FileSignature, Download, Eye, CheckCircle, Clock, 
  AlertCircle, PenTool, X, Calendar, FileText, Shield, RefreshCw,
  ChevronDown, ChevronUp, ScrollText
} from 'lucide-react';

interface Props {
  investorId: string;
  investorName: string;
}

interface SignatureDocument {
  id: string;
  document_name: string;
  document_type: string;
  document_content?: string;
  document_url?: string;
  file_path?: string;
  signature_status: 'pending' | 'viewed' | 'signed' | 'rejected' | 'expired';
  signature_data?: any;
  signed_at?: string;
  signed_ip?: string;
  expires_at?: string;
  sent_by?: string;
  sent_by_id?: string;
  reminder_count: number;
  property_id?: string;
  acquisition_id?: string;
  created_at: string;
}

async function fetchClientIP(): Promise<string> {
  try {
    const services = [
      'https://api.ipify.org?format=json',
      'https://ipapi.co/json/',
    ];
    for (const url of services) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3000);
        const res = await fetch(url, { signal: controller.signal });
        clearTimeout(timeoutId);
        if (res.ok) {
          const data = await res.json();
          const ip = data.ip || data.IPv4 || data.query;
          if (ip && typeof ip === 'string' && ip.length > 0) return ip;
        }
      } catch { continue; }
    }
    return 'unavailable';
  } catch { return 'unavailable'; }
}

export function DocumentSigning({ investorId, investorName }: Props) {
  const [documents, setDocuments] = useState<SignatureDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDoc, setSelectedDoc] = useState<SignatureDocument | null>(null);
  const [showSignModal, setShowSignModal] = useState(false);
  const [signing, setSigning] = useState(false);
  const [clientIP, setClientIP] = useState<string>('');
  const [signatureResult, setSignatureResult] = useState<SignatureResult | null>(null);
  const [initials, setInitials] = useState('');
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [hasScrolledToBottom, setHasScrolledToBottom] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [lastSignedDoc, setLastSignedDoc] = useState<string>('');
  const { toast } = useToast();

  useEffect(() => {
    fetchClientIP().then(ip => setClientIP(ip));
  }, []);

  useEffect(() => { fetchDocuments(); }, [investorId]);

  const fetchDocuments = async () => {
    setLoading(true);
    try {
      const { data } = await supabase.functions.invoke('manage-document-signatures', {
        body: { action: 'get_documents', investor_id: investorId }
      });
      if (data?.documents) {
        setDocuments(data.documents);
      } else {
        const { data: directData } = await supabase
          .from('document_signatures')
          .select('*')
          .eq('investor_id', investorId)
          .order('created_at', { ascending: false });
        if (directData) setDocuments(directData);
      }
    } catch (err) {
      console.error('Error fetching documents:', err);
      try {
        const { data: directData } = await supabase
          .from('document_signatures')
          .select('*')
          .eq('investor_id', investorId)
          .order('created_at', { ascending: false });
        if (directData) setDocuments(directData);
      } catch (e) {
        console.error('Direct query also failed:', e);
      }
    }
    setLoading(false);
  };

  const handleViewDocument = async (doc: SignatureDocument) => {
    if (doc.signature_status === 'pending') {
      try {
        await supabase.functions.invoke('manage-document-signatures', {
          body: { action: 'mark_viewed', document_id: doc.id }
        });
      } catch {
        await supabase
          .from('document_signatures')
          .update({ signature_status: 'viewed', viewed_at: new Date().toISOString() })
          .eq('id', doc.id);
      }
    }
    if (doc.document_url) {
      window.open(doc.document_url, '_blank');
    }
    fetchDocuments();
  };

  const handleOpenSignModal = async (doc: SignatureDocument) => {
    setSelectedDoc(doc);
    setSignatureResult(null);
    setInitials('');
    setAgreedToTerms(false);
    setHasScrolledToBottom(false);
    setShowSignModal(true);

    // Mark as viewed
    if (doc.signature_status === 'pending') {
      try {
        await supabase.functions.invoke('manage-document-signatures', {
          body: { action: 'mark_viewed', document_id: doc.id }
        });
      } catch {
        await supabase
          .from('document_signatures')
          .update({ signature_status: 'viewed', viewed_at: new Date().toISOString() })
          .eq('id', doc.id);
      }
    }

    if (!clientIP || clientIP === 'unavailable') {
      fetchClientIP().then(ip => setClientIP(ip));
    }
  };

  const handleAgreementScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 50;
    if (atBottom && !hasScrolledToBottom) {
      setHasScrolledToBottom(true);
    }
  };

  const handleSign = async () => {
    if (!selectedDoc) return;

    if (!signatureResult) {
      toast({ title: 'Signature Required', description: 'Please provide your signature using the pad below.', variant: 'destructive' });
      return;
    }

    if (!agreedToTerms) {
      toast({ title: 'Agreement Required', description: 'Please agree to the terms before signing.', variant: 'destructive' });
      return;
    }

    setSigning(true);
    let resolvedIP = clientIP;
    if (!resolvedIP || resolvedIP === 'unavailable') {
      resolvedIP = await fetchClientIP();
      setClientIP(resolvedIP);
    }

    const signTimestamp = new Date().toISOString();

    try {
      // Try edge function first
      let signSuccess = false;
      try {
        const { data, error } = await supabase.functions.invoke('sign-agreement', {
          body: {
            action: 'sign_agreement',
            agreement_id: selectedDoc.id,
            investor_id: investorId,
            investor_name: investorName,
            signature_name: signatureResult.typedName || investorName,
            signature_type: signatureResult.type,
            signature_image: signatureResult.signatureImageDataUrl,
            initials: initials.trim(),
            ip_address: resolvedIP,
            source_table: 'document_signatures'
          }
        });

        if (error) throw error;
        signSuccess = data?.success === true;
        if (!signSuccess && data?.error) throw new Error(data.error);
      } catch (fnErr: any) {
        console.warn('[DocumentSigning] Edge function failed, using fallback:', fnErr.message);
        // Fallback: also try manage-document-signatures
        try {
          const { data, error } = await supabase.functions.invoke('manage-document-signatures', {
            body: {
              action: 'sign_document',
              document_id: selectedDoc.id,
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
                signature_image_url: signatureResult.signatureImageDataUrl,
              },
              signed_ip: resolvedIP
            }
          });
          if (!error && data?.success) {
            signSuccess = true;
          }
        } catch {
          // Final fallback: direct update
          const { error: updateErr } = await supabase
            .from('document_signatures')
            .update({
              signature_status: 'signed',
              signed_at: signTimestamp,
              signed_ip: resolvedIP,
              signature_data: {
                type: signatureResult.type,
                signature: signatureResult.signatureData,
                signed_name: signatureResult.typedName || investorName,
                typed_name: signatureResult.typedName || investorName,
                initials: initials.trim(),
                timestamp: signTimestamp,
                agreed_to_terms: true,
                has_drawn_signature: signatureResult.type === 'drawn',
              }
            })
            .eq('id', selectedDoc.id)
            .eq('investor_id', investorId);
          if (updateErr) throw updateErr;
          signSuccess = true;
        }
      }

      if (signSuccess) {
        setLastSignedDoc(selectedDoc.document_name);
        setShowSignModal(false);
        setShowConfirmation(true);
        toast({
          title: 'Document Signed!',
          description: 'Your signature has been recorded. Confirmation emails have been sent.'
        });
        fetchDocuments();
      }
    } catch (err: any) {
      toast({ title: 'Signing Failed', description: err.message || 'Failed to sign document. Please try again.', variant: 'destructive' });
    }
    setSigning(false);
  };

  const generateDownloadHTML = (doc: SignatureDocument) => {
    const sigData = doc.signature_data || {};
    const htmlContent = `<!DOCTYPE html><html><head><title>${doc.document_name}</title>
<style>body{font-family:Georgia,serif;max-width:800px;margin:40px auto;padding:20px;color:#333;line-height:1.6}
h1{color:#1a365d;border-bottom:2px solid #d4a574;padding-bottom:10px}.content{white-space:pre-wrap;margin:20px 0}
.sig-block{margin-top:40px;padding:20px;border:2px solid #1a365d;border-radius:8px;background:#f8f9fa}
.sig{font-family:cursive;font-size:24px;color:#1a365d;margin:10px 0}.meta{color:#666;font-size:12px;margin-top:20px;border-top:1px solid #ddd;padding-top:10px}
.badge{display:inline-block;background:#22c55e;color:white;padding:4px 12px;border-radius:20px;font-size:12px}</style></head>
<body><div style="text-align:center"><h1>${doc.document_name}</h1><span class="badge">SIGNED</span></div>
<div class="content">${doc.document_content || 'Agreement content on file.'}</div>
<div class="sig-block"><p><strong>Electronic Signature:</strong></p>
${sigData.signature_image_url ? `<img src="${sigData.signature_image_url}" style="max-width:300px;border:1px solid #ddd;border-radius:4px;padding:4px" />` : 
`<p class="sig">${sigData.signed_name || investorName}</p>`}
<p><strong>Signed by:</strong> ${sigData.signed_name || investorName}</p>
<p><strong>Date:</strong> ${doc.signed_at ? new Date(doc.signed_at).toLocaleString() : 'N/A'}</p>
<p><strong>IP Address:</strong> ${doc.signed_ip || 'N/A'}</p>
<p><strong>Document ID:</strong> ${doc.id}</p></div>
<div class="meta"><p>This document was electronically signed through the Access Your Place (AYP) Investor Portal.</p>
<p>Electronic signatures are legally binding under the ESIGN Act and UETA.</p></div></body></html>`;

    const blob = new Blob([htmlContent], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${doc.document_name.replace(/\s+/g, '_')}_signed.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const getStatusBadge = (status: string) => {
    const styles: Record<string, { bg: string; icon: typeof Clock }> = {
      pending: { bg: 'bg-yellow-500', icon: Clock },
      viewed: { bg: 'bg-blue-500', icon: Eye },
      signed: { bg: 'bg-green-500', icon: CheckCircle },
      rejected: { bg: 'bg-red-500', icon: X },
      expired: { bg: 'bg-gray-500', icon: AlertCircle }
    };
    const s = styles[status] || styles.pending;
    const Icon = s.icon;
    return (
      <Badge className={s.bg}>
        <Icon className="w-3 h-3 mr-1" />
        <span className="capitalize">{status}</span>
      </Badge>
    );
  };

  const getExpirationWarning = (expiresAt: string) => {
    const now = new Date();
    const expires = new Date(expiresAt);
    const daysLeft = Math.ceil((expires.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));
    if (daysLeft <= 0) return { text: 'Expired', color: 'text-red-600', urgent: true };
    if (daysLeft <= 1) return { text: 'Expires today!', color: 'text-red-600', urgent: true };
    if (daysLeft <= 3) return { text: `Expires in ${daysLeft} days`, color: 'text-orange-600', urgent: true };
    return { text: `Expires ${expires.toLocaleDateString()}`, color: 'text-gray-500', urgent: false };
  };

  const pendingDocs = documents.filter(d => d.signature_status === 'pending' || d.signature_status === 'viewed');
  const signedDocs = documents.filter(d => d.signature_status === 'signed');
  const expiredDocs = documents.filter(d => d.signature_status === 'expired');

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-[#d4a574]" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <FileSignature className="w-6 h-6 text-[#d4a574]" />
            Electronic Signatures
          </h2>
          <p className="text-sm text-gray-500">Review and sign documents securely online</p>
        </div>
        <div className="flex items-center gap-2">
          {pendingDocs.length > 0 && (
            <Badge variant="destructive" className="text-sm">
              {pendingDocs.length} Awaiting Signature
            </Badge>
          )}
          <Button variant="ghost" size="sm" onClick={fetchDocuments}>
            <RefreshCw className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Pending Documents */}
      {pendingDocs.length > 0 && (
        <Card className="border-yellow-200 bg-yellow-50">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2 text-yellow-800">
              <AlertCircle className="w-5 h-5" />
              Documents Awaiting Your Signature
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {pendingDocs.map(doc => {
              const expWarning = doc.expires_at ? getExpirationWarning(doc.expires_at) : null;
              return (
                <div
                  key={doc.id}
                  className={`flex items-center justify-between p-4 bg-white rounded-lg border ${expWarning?.urgent ? 'border-red-300 ring-1 ring-red-200' : 'border-yellow-200'}`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${expWarning?.urgent ? 'bg-red-100' : 'bg-yellow-100'}`}>
                      <FileText className={`w-5 h-5 ${expWarning?.urgent ? 'text-red-600' : 'text-yellow-600'}`} />
                    </div>
                    <div>
                      <p className="font-medium">{doc.document_name}</p>
                      <p className="text-sm text-gray-500">{doc.document_type?.replace(/_/g, ' ')}</p>
                      {doc.sent_by && <p className="text-xs text-gray-400">Sent by: {doc.sent_by}</p>}
                      {expWarning && (
                        <p className={`text-xs font-medium flex items-center gap-1 mt-1 ${expWarning.color}`}>
                          <Calendar className="w-3 h-3" />{expWarning.text}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {getStatusBadge(doc.signature_status)}
                    {doc.document_url && (
                      <Button size="sm" variant="outline" onClick={() => handleViewDocument(doc)}>
                        <Eye className="w-4 h-4 mr-1" />View
                      </Button>
                    )}
                    <Button size="sm" className="bg-[#d4a574] hover:bg-[#c49464]" onClick={() => handleOpenSignModal(doc)}>
                      <PenTool className="w-4 h-4 mr-1" />Sign Now
                    </Button>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {/* Signed Documents */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CheckCircle className="w-5 h-5 text-green-600" />
            Signed Documents
          </CardTitle>
          <CardDescription>Documents you have already signed</CardDescription>
        </CardHeader>
        <CardContent>
          {signedDocs.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <FileSignature className="w-12 h-12 mx-auto text-gray-300 mb-4" />
              <p className="font-medium">No signed documents yet</p>
              <p className="text-sm">Documents will appear here after you sign them</p>
            </div>
          ) : (
            <div className="space-y-2">
              {signedDocs.map(doc => (
                <div key={doc.id} className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50">
                  <div className="flex items-center gap-3">
                    <FileText className="w-5 h-5 text-green-600" />
                    <div>
                      <p className="font-medium">{doc.document_name}</p>
                      <div className="flex items-center gap-3 text-xs text-gray-500">
                        <span>Signed on {new Date(doc.signed_at!).toLocaleDateString()}</span>
                        {doc.signature_data?.signed_name && <span>by {doc.signature_data.signed_name}</span>}
                        {doc.signature_data?.has_drawn_signature && (
                          <Badge variant="outline" className="text-xs">Hand-signed</Badge>
                        )}
                        {doc.signed_ip && doc.signed_ip !== 'unknown' && doc.signed_ip !== 'unavailable' && (
                          <span className="flex items-center gap-1">
                            <Shield className="w-3 h-3" />IP: {doc.signed_ip}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {getStatusBadge(doc.signature_status)}
                    <Button size="sm" variant="ghost" onClick={() => generateDownloadHTML(doc)} title="Download signed copy">
                      <Download className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Expired Documents */}
      {expiredDocs.length > 0 && (
        <Card className="border-gray-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-gray-500">
              <AlertCircle className="w-5 h-5" />
              Expired Documents
            </CardTitle>
            <CardDescription>These documents have expired. Contact your Success Team if you need a new copy.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {expiredDocs.map(doc => (
                <div key={doc.id} className="flex items-center justify-between p-3 border rounded-lg bg-gray-50 opacity-75">
                  <div className="flex items-center gap-3">
                    <FileText className="w-5 h-5 text-gray-400" />
                    <div>
                      <p className="font-medium text-gray-600">{doc.document_name}</p>
                      <p className="text-xs text-gray-400">Expired {doc.expires_at ? new Date(doc.expires_at).toLocaleDateString() : 'N/A'}</p>
                    </div>
                  </div>
                  {getStatusBadge('expired')}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* No Documents State */}
      {documents.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center text-gray-500">
            <FileSignature className="w-16 h-16 mx-auto text-gray-300 mb-4" />
            <p className="font-medium text-lg">No Documents to Sign</p>
            <p className="text-sm mt-2">When documents require your signature, they will appear here.</p>
          </CardContent>
        </Card>
      )}

      {/* ===== SIGN DOCUMENT MODAL ===== */}
      <Dialog open={showSignModal} onOpenChange={setShowSignModal}>
        <DialogContent className="max-w-4xl max-h-[95vh] flex flex-col p-0 gap-0">
          <DialogHeader className="px-6 pt-6 pb-4 border-b flex-shrink-0">
            <DialogTitle className="flex items-center gap-2">
              <PenTool className="w-5 h-5 text-[#d4a574]" />
              Sign Document
            </DialogTitle>
            <DialogDescription>
              {selectedDoc?.document_name}
              {selectedDoc?.sent_by && <span className="ml-2 text-gray-400">| Sent by: {selectedDoc.sent_by}</span>}
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto px-6 py-4 space-y-6 min-h-0">
            {/* Step 1: Agreement Text Viewer */}
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
                {selectedDoc?.document_content ? (
                  <pre className="whitespace-pre-wrap text-sm font-mono text-gray-800 leading-relaxed">
                    {selectedDoc.document_content}
                  </pre>
                ) : (
                  <div className="text-center py-8 text-gray-400">
                    <FileText className="w-10 h-10 mx-auto mb-3 text-gray-300" />
                    <p>Agreement content is available for review upon request.</p>
                    <p className="text-xs mt-1">Contact your Success Team for a copy of the full agreement text.</p>
                  </div>
                )}
              </div>
              {!hasScrolledToBottom && selectedDoc?.document_content && (
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
                Step 3: Provide Your Signature
              </Label>
              <SignaturePad
                investorName={investorName}
                onSignatureChange={setSignatureResult}
                disabled={signing}
              />
            </div>

            {/* Signing Details */}
            <div className="flex items-center gap-2 text-xs text-gray-400 bg-gray-50 p-3 rounded-lg">
              <Shield className="w-4 h-4 flex-shrink-0" />
              <span>
                Signing as <strong>{investorName}</strong>
                {clientIP && clientIP !== 'unavailable' && <> from IP {clientIP}</>}
                {' '}on {new Date().toLocaleDateString('en-US', { dateStyle: 'long' })}
              </span>
            </div>

            {/* Terms Agreement */}
            <div className="flex items-start gap-3 p-4 bg-gray-50 rounded-lg border">
              <Checkbox
                id="agree-terms-ds"
                checked={agreedToTerms}
                onCheckedChange={(checked) => setAgreedToTerms(checked as boolean)}
                className="mt-0.5"
              />
              <label htmlFor="agree-terms-ds" className="text-sm text-gray-600 cursor-pointer leading-relaxed">
                I have read and agree to the terms of this document. I understand that my electronic
                signature is legally binding and has the same effect as a handwritten signature under
                the ESIGN Act and UETA. I acknowledge that this action cannot be undone.
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
                <><CheckCircle className="w-4 h-4 mr-2" />Sign Document</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Signing Confirmation Dialog */}
      <Dialog open={showConfirmation} onOpenChange={setShowConfirmation}>
        <DialogContent className="max-w-md text-center">
          <div className="py-6">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="w-8 h-8 text-green-600" />
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">Document Signed Successfully!</h3>
            <p className="text-gray-600 mb-4">
              "{lastSignedDoc}" has been signed and recorded.
            </p>
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-sm text-green-800 mb-4">
              <p className="font-medium mb-1">Confirmation emails sent to:</p>
              <p>You (investor) and the staff member who sent this agreement</p>
            </div>
            <p className="text-xs text-gray-400">
              You can access your signed documents anytime from the Signed Documents section above.
            </p>
          </div>
          <DialogFooter className="justify-center">
            <Button onClick={() => setShowConfirmation(false)} className="bg-[#d4a574] hover:bg-[#c49464]">
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
