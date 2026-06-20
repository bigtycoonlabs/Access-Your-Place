import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Loader2, CheckCircle, Shield, FileText, AlertTriangle, Lock, Clock, Download, ArrowRight } from 'lucide-react';

interface Agreement {
  id: string;
  staff_id: string;
  am_name: string;
  am_email: string;
  mentor_name?: string;
  status: string;
  sent_at?: string;
  viewed_at?: string;
  signed_at?: string;
  signature_text?: string;
  signature_ip?: string;
  signature_hash?: string;
}

export default function AMAgreementSign() {
  const { agreementId } = useParams<{ agreementId: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [agreement, setAgreement] = useState<Agreement | null>(null);
  const [loading, setLoading] = useState(true);
  const [signing, setSigning] = useState(false);
  const [signed, setSigned] = useState(false);
  const [signatureText, setSignatureText] = useState('');
  const [agreedTerms, setAgreedTerms] = useState(false);
  const [agreedAccuracy, setAgreedAccuracy] = useState(false);
  const [error, setError] = useState('');
  const [clientIp, setClientIp] = useState('');
  const [signResult, setSignResult] = useState<{ signed_at: string; signature_hash: string } | null>(null);
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [redirectCountdown, setRedirectCountdown] = useState<number | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (agreementId) {
      loadAgreement();
      fetchClientIp();
    }
  }, [agreementId]);

  // Cleanup countdown on unmount
  useEffect(() => {
    return () => {
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  }, []);

  const fetchClientIp = async () => {
    try {
      const res = await fetch('https://api.ipify.org?format=json');
      const data = await res.json();
      setClientIp(data.ip || '');
    } catch {
      setClientIp('unavailable');
    }
  };

  const loadAgreement = async () => {
    setLoading(true);
    try {
      const { data, error: err } = await supabase.functions.invoke('send-investor-invitation', {
        body: { action: 'get_agreement_for_signing', agreement_id: agreementId }
      });
      if (data?.success && data.agreement) {
        setAgreement(data.agreement);
        if (data.agreement.status === 'signed') {
          setSigned(true);
          setSignResult({ signed_at: data.agreement.signed_at, signature_hash: data.agreement.signature_hash });
        }
      } else {
        setError(data?.error || 'Agreement not found');
      }
    } catch (err: any) {
      setError('Failed to load agreement');
    }
    setLoading(false);
  };

  // Update localStorage staffSession after signing
  const updateStaffSession = () => {
    try {
      const sessionStr = localStorage.getItem('staffSession');
      if (sessionStr) {
        const session = JSON.parse(sessionStr);
        session.agreement_signed = true;
        session.agreement_id = null;
        localStorage.setItem('staffSession', JSON.stringify(session));
        console.log('[AMAgreementSign] Updated staffSession in localStorage: agreement_signed=true');
        return true;
      } else {
        // No staffSession exists - this can happen if the user navigated directly to the agreement URL
        // or if the invitation flow didn't store a session (pre-v8.0 bug)
        console.warn('[AMAgreementSign] No staffSession found in localStorage. Creating minimal session from agreement data.');
        
        // Create a minimal session so the user can access the dashboard
        if (agreement) {
          const minimalSession = {
            id: agreement.staff_id || '',
            email: agreement.am_email || '',
            name: agreement.am_name || '',
            first_name: agreement.am_name?.split(' ')[0] || '',
            last_name: agreement.am_name?.split(' ').slice(1).join(' ') || '',
            team: 'acquisition_managers',
            role: 'staff',
            department: 'acquisition_managers',
            permissions: ['deals', 'acquisitions', 'investors', 'crm', 'inquiries', 'marketplace'],
            linked_investor_id: null,
            roles: ['acquisition_managers'],
            agreement_signed: true,
            agreement_id: null,
            loginTime: Date.now()
          };
          localStorage.setItem('staffSession', JSON.stringify(minimalSession));
          console.log('[AMAgreementSign] Created minimal staffSession from agreement data:', {
            id: minimalSession.id,
            email: minimalSession.email,
            name: minimalSession.name,
          });
          return true;
        }
        
        console.error('[AMAgreementSign] Cannot create session - no agreement data available');
        return false;
      }
    } catch (err) {
      console.error('[AMAgreementSign] Failed to update localStorage:', err);
      return false;
    }
  };


  // Start countdown and redirect to dashboard (or login if no session)
  const startRedirectCountdown = (hasSession: boolean) => {
    const redirectTarget = hasSession ? '/staff' : '/staff/login';
    setRedirectCountdown(3);
    countdownRef.current = setInterval(() => {
      setRedirectCountdown(prev => {
        if (prev === null || prev <= 1) {
          if (countdownRef.current) clearInterval(countdownRef.current);
          navigate(redirectTarget);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const handleSign = async () => {
    if (!signatureText.trim()) { setError('Please type your full legal name as your signature'); return; }
    if (!agreedTerms || !agreedAccuracy) { setError('Please accept all terms before signing'); return; }
    if (signatureText.trim().toLowerCase() !== agreement?.am_name?.toLowerCase()) {
      setError('Your typed signature must match your full name: ' + agreement?.am_name);
      return;
    }

    setSigning(true);
    setError('');
    try {
      const { data, error: err } = await supabase.functions.invoke('send-investor-invitation', {
        body: {
          action: 'sign_agreement',
          agreement_id: agreementId,
          signature_text: signatureText.trim(),
          signature_ip: clientIp,
          user_agent: navigator.userAgent
        }
      });
      if (data?.success) {
        setSigned(true);
        setSignResult({ signed_at: data.signed_at, signature_hash: data.signature_hash });
        
        // Update localStorage so dashboard knows agreement is signed
        const sessionUpdated = updateStaffSession();
        
        // Show success toast
        toast({
          title: 'Agreement Signed Successfully!',
          description: sessionUpdated 
            ? 'Your AM Service Agreement has been recorded. Redirecting to dashboard...'
            : 'Your AM Service Agreement has been recorded. Please log in to access the dashboard.',
        });
        
        // Start countdown redirect - to dashboard if session exists, to login if not
        startRedirectCountdown(sessionUpdated);
      } else {
        setError(data?.error || 'Failed to sign agreement');
      }
    } catch (err: any) {
      setError('Failed to sign agreement. Please try again.');
    }
    setSigning(false);
  };

  const handleDownloadPdf = async () => {
    if (!agreementId) return;
    setDownloadingPdf(true);
    try {
      const { data, error: err } = await supabase.functions.invoke('generate-agreement-pdf', {
        body: { agreement_id: agreementId }
      });
      if (data?.success && data.html) {
        const printWindow = window.open('', '_blank');
        if (printWindow) {
          printWindow.document.write(data.html);
          printWindow.document.close();
          setTimeout(() => {
            printWindow.print();
          }, 500);
        } else {
          const blob = new Blob([data.html], { type: 'text/html' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `AM-Agreement-${agreement?.am_name?.replace(/\s+/g, '-') || 'document'}.html`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
        }
      } else {
        setError(data?.error || 'Failed to generate PDF');
      }
    } catch (err: any) {
      setError('Failed to generate PDF. Please try again.');
    }
    setDownloadingPdf(false);
  };

  const handleGoToDashboard = () => {
    // Stop countdown if running
    if (countdownRef.current) clearInterval(countdownRef.current);
    
    // Check if we have a valid session before redirecting to dashboard
    const hasSession = !!localStorage.getItem('staffSession');
    if (hasSession) {
      navigate('/staff');
    } else {
      toast({ 
        title: 'Please Log In', 
        description: 'Your agreement has been signed. Please log in to access the dashboard.' 
      });
      navigate('/staff/login');
    }
  };


  const now = new Date();
  const day = now.getDate();
  const monthNames = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  const month = monthNames[now.getMonth()];
  const year = now.getFullYear();

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center" role="status" aria-label="Loading agreement">
        <div className="text-center">
          <Loader2 className="w-10 h-10 animate-spin text-[#d4a574] mx-auto mb-4" aria-hidden="true" />
          <p className="text-gray-600">Loading agreement...</p>
        </div>
      </div>
    );
  }

  if (error && !agreement) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center p-4" role="alert">
        <Card className="max-w-lg w-full">
          <CardContent className="pt-8 pb-8 text-center">
            <AlertTriangle className="w-16 h-16 text-red-400 mx-auto mb-4" aria-hidden="true" />
            <h2 className="text-xl font-bold text-gray-800 mb-2">Agreement Not Found</h2>
            <p className="text-gray-600 mb-6">{error}</p>
            <div className="flex gap-3 justify-center">
              <Button onClick={() => navigate('/')} variant="outline">Return Home</Button>
              <Button onClick={() => navigate('/staff/login')} className="bg-[#1a365d] hover:bg-[#2d4a7c]">
                Go to Staff Login
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (agreement?.status === 'voided') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center p-4" role="alert">
        <Card className="max-w-lg w-full border-red-200">
          <CardContent className="pt-8 pb-8 text-center">
            <AlertTriangle className="w-16 h-16 text-red-400 mx-auto mb-4" aria-hidden="true" />
            <h2 className="text-xl font-bold text-red-800 mb-2">Agreement Voided</h2>
            <p className="text-gray-600 mb-4">This service agreement has been voided and is no longer valid.</p>
            <p className="text-sm text-gray-500">Please contact your Success Manager for a new agreement.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (agreement?.status === 'expired') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center p-4" role="alert">
        <Card className="max-w-lg w-full border-amber-200">
          <CardContent className="pt-8 pb-8 text-center">
            <Clock className="w-16 h-16 text-amber-400 mx-auto mb-4" aria-hidden="true" />
            <h2 className="text-xl font-bold text-amber-800 mb-2">Agreement Expired</h2>
            <p className="text-gray-600 mb-4">This service agreement has expired. Please contact your Success Manager to request a new one.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (signed && signResult) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-50 flex items-center justify-center p-4">
        <Card className="max-w-lg w-full border-green-200 shadow-xl">
          <CardContent className="pt-8 pb-8 text-center">
            <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6" aria-hidden="true">
              <CheckCircle className="w-12 h-12 text-green-600" />
            </div>
            <h2 className="text-2xl font-bold text-green-800 mb-2">Agreement Signed Successfully</h2>
            <p className="text-gray-600 mb-6">Your AM Service Agreement has been digitally signed and recorded.</p>
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-left space-y-2 mb-6" role="region" aria-label="Signature details">
              <p className="text-sm"><span className="font-medium text-gray-700">Signer:</span> <span className="text-gray-600">{agreement?.am_name}</span></p>
              <p className="text-sm"><span className="font-medium text-gray-700">Signed At:</span> <span className="text-gray-600">{new Date(signResult.signed_at).toLocaleString()}</span></p>
              <p className="text-sm"><span className="font-medium text-gray-700">IP Address:</span> <span className="text-gray-600">{clientIp}</span></p>
              <p className="text-sm"><span className="font-medium text-gray-700">Verification Hash:</span> <span className="text-gray-600 font-mono text-xs">{signResult.signature_hash.substring(0, 24)}...</span></p>
            </div>
            <p className="text-sm text-gray-500 mb-4">A confirmation email has been sent to {agreement?.am_email}.</p>
            
            {/* Redirect countdown */}
            {redirectCountdown !== null && redirectCountdown > 0 && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
                <p className="text-sm text-blue-700">
                  Redirecting to dashboard in <span className="font-bold">{redirectCountdown}</span> second{redirectCountdown !== 1 ? 's' : ''}...
                </p>
              </div>
            )}
            
            <div className="flex gap-3 justify-center flex-wrap">
              <Button
                onClick={handleDownloadPdf}
                disabled={downloadingPdf}
                variant="outline"
                className="border-green-300 text-green-700 hover:bg-green-50"
                aria-label="Download signed agreement as PDF"
              >
                {downloadingPdf ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" aria-hidden="true" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4 mr-2" aria-hidden="true" />
                    Download PDF
                  </>
                )}
              </Button>
              <Button 
                onClick={handleGoToDashboard} 
                className="bg-[#1a365d] hover:bg-[#2d4a7c] text-white"
              >
                <ArrowRight className="w-4 h-4 mr-2" aria-hidden="true" />
                Go to Dashboard
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      {/* Header */}
      <header className="bg-[#1a365d] text-white py-6" role="banner">
        <div className="max-w-4xl mx-auto px-4 flex items-center gap-4">
          <div className="w-12 h-12 bg-gradient-to-br from-[#f59e0b] to-[#d97706] rounded-xl flex items-center justify-center" aria-hidden="true">
            <span className="text-white font-bold text-lg">AYP</span>
          </div>
          <div>
            <h1 className="text-xl font-bold">Acquisition Manager Service Agreement</h1>
            <p className="text-blue-200 text-sm">Set Up Your Place LLC (DBA: Access Your Place)</p>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <Lock className="w-4 h-4 text-green-400" aria-hidden="true" />
            <span className="text-green-300 text-sm font-medium">Secure Document</span>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8" role="main">
        {/* Agreement Info Bar */}
        <div className="bg-white border rounded-lg p-4 mb-6 flex flex-wrap items-center justify-between gap-4" role="region" aria-label="Agreement information">
          <div className="flex items-center gap-4">
            <div>
              <p className="text-sm text-gray-500">Prepared for</p>
              <p className="font-semibold text-[#1a365d]">{agreement?.am_name}</p>
            </div>
            <div className="border-l pl-4">
              <p className="text-sm text-gray-500">Email</p>
              <p className="text-gray-700">{agreement?.am_email}</p>
            </div>
            {agreement?.mentor_name && (
              <div className="border-l pl-4">
                <p className="text-sm text-gray-500">Mentor</p>
                <p className="text-gray-700">{agreement.mentor_name}</p>
              </div>
            )}
          </div>
          <Badge className="bg-amber-100 text-amber-800 flex items-center gap-1">
            <FileText className="w-3 h-3" aria-hidden="true" />
            Awaiting Signature
          </Badge>
        </div>

        {/* Agreement Document */}
        <Card className="mb-8 shadow-lg">
          <CardHeader className="bg-[#1a365d] text-white rounded-t-lg">
            <CardTitle className="text-center">
              <p className="text-lg font-bold tracking-wide">INDEPENDENT CONTRACTOR AGREEMENT</p>
              <p className="text-blue-200 text-sm font-normal mt-1">Acquisition Manager Service Agreement</p>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-8 prose prose-sm max-w-none text-gray-700 leading-relaxed">
            <p>THIS INDEPENDENT CONTRACTOR AGREEMENT (the "Agreement") is made and entered into on this <strong>{day}</strong> day of <strong>{month}</strong>, {year}, by and between:</p>

            <div className="bg-slate-50 border rounded-lg p-4 my-4">
              <p className="font-bold text-[#1a365d] mb-1">THE COMPANY:</p>
              <p className="mb-0">Set Up Your Place LLC (DBA: Access Your Place / AYP)<br />
              A Subsidiary of Cooper Family Inc.<br />
              1150 NW 72nd Ave, Tower I, Suite 455, Miami, FL 33126<br />
              (Hereinafter referred to as the "Company" or "AYP")</p>
            </div>

            <div className="bg-slate-50 border rounded-lg p-4 my-4">
              <p className="font-bold text-[#1a365d] mb-1">THE CONTRACTOR:</p>
              <p className="mb-0">Name: <strong className="text-[#1a365d] border-b-2 border-[#f59e0b] pb-0.5">{agreement?.am_name}</strong><br />
              Email: {agreement?.am_email}<br />
              (Hereinafter referred to as the "Acquisition Manager" or "AM")</p>
            </div>

            <h3 className="text-[#1a365d] border-b-2 border-[#f59e0b] pb-2 mt-8">1. ENGAGEMENT &amp; STATUS</h3>
            <p><strong>1.1 Independent Contractor Status.</strong> The Acquisition Manager is engaged as an independent contractor, not an employee of the Company. The AM shall not be entitled to any employee benefits, including but not limited to health insurance, retirement plans, paid time off, or workers' compensation. The AM is solely responsible for their own taxes, insurance, and business expenses.</p>
            <p><strong>1.2 The "Standard of Truth" Mandate.</strong> The AM acknowledges that AYP operates on a rigorous "Standard of Truth." Every deal presented, every financial projection shared, and every claim made to a client must be verifiable and accurate. Any deliberate misrepresentation of property data, financial projections, market conditions, or company capabilities is grounds for immediate termination of this Agreement and forfeiture of any pending commissions.</p>
            <p><strong>1.3 Scope of Work.</strong> The AM shall be responsible for: (a) Sourcing and analyzing potential rental arbitrage properties; (b) Presenting qualified deals to investors through the AYP platform; (c) Managing client relationships from discovery through lease signing; (d) Maintaining accurate records of all transactions and communications.</p>

            <h3 className="text-[#1a365d] border-b-2 border-[#f59e0b] pb-2 mt-8">2. TRAINING, CERTIFICATION &amp; OVERSIGHT</h3>
            <p><strong>2.1 The Shadow Phase (AMT Status).</strong> Upon execution of this Agreement, the AM enters the "Acquisition Manager in Training" (AMT) phase. During this phase:</p>
            <ul className="list-disc pl-6 space-y-1">
              <li>All deals must be reviewed and approved by the assigned Certified Mentor before submission</li>
              <li>Commission split during training: <strong>50/50</strong> with the supervising Certified Manager</li>
              <li>The AM has exactly <strong>four (4) months</strong> from the date of this Agreement to complete the 4 Pillars of Certification</li>
              <li>Failure to achieve certification within the deadline results in immediate revocation of platform access</li>
            </ul>

            <p><strong>2.2 The 4 Pillars of Excellence.</strong></p>
            <div className="bg-blue-50 border-l-4 border-blue-500 p-4 my-3">
              <p className="font-bold text-blue-800 mb-1">Pillar 1: MARKET MASTERY (The Analyst)</p>
              <p className="text-blue-700 mb-0">Source, negotiate, and submit 3 consecutive qualified deals that pass the Foundation of Truth audit without rejection.</p>
            </div>
            <div className="bg-green-50 border-l-4 border-green-500 p-4 my-3">
              <p className="font-bold text-green-800 mb-1">Pillar 2: THE RAINMAKER (The Hunter)</p>
              <p className="text-green-700 mb-0">Within a 30-day window, generate 3 New Investor Leads and close 2 of them into active investors.</p>
            </div>
            <div className="bg-amber-50 border-l-4 border-amber-500 p-4 my-3">
              <p className="font-bold text-amber-800 mb-1">Pillar 3: THE CONSULTANT (The Guide)</p>
              <p className="text-amber-700 mb-0">Complete 3 full-cycle transactions (Discovery Call to Lease Signing) consecutively without error.</p>
            </div>
            <div className="bg-purple-50 border-l-4 border-purple-500 p-4 my-3">
              <p className="font-bold text-purple-800 mb-1">Pillar 4: TECHNICAL PROFICIENCY (The Scholar)</p>
              <p className="text-purple-700 mb-0">Pass the Final Certification Exam with a score of 90% or higher, demonstrating mastery of AYP processes, market analysis, and client management.</p>
            </div>

            <p><strong>2.3 Maintenance of Certification.</strong> Once certified, the AM must maintain: minimum 6 closed transactions per quarter, minimum 2 new qualified deals submitted per month, and a client satisfaction rating of 4.5/5.0 or higher. Failure to maintain these standards may result in probation or decertification.</p>

            <h3 className="text-[#1a365d] border-b-2 border-[#f59e0b] pb-2 mt-8">3. COMPENSATION STRUCTURE</h3>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse border border-gray-300 my-4">
                <thead>
                  <tr className="bg-[#1a365d] text-white">
                    <th className="border border-gray-300 p-3 text-left">Commission Type</th>
                    <th className="border border-gray-300 p-3 text-center">Rate</th>
                    <th className="border border-gray-300 p-3 text-left">Description</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="border border-gray-300 p-3 font-medium">Finder's Fee</td>
                    <td className="border border-gray-300 p-3 text-center font-bold text-[#d4a574]">15%</td>
                    <td className="border border-gray-300 p-3">Sourcing and qualifying a deal that results in a closed transaction</td>
                  </tr>
                  <tr className="bg-gray-50">
                    <td className="border border-gray-300 p-3 font-medium">Closing Fee</td>
                    <td className="border border-gray-300 p-3 text-center font-bold text-[#d4a574]">15%</td>
                    <td className="border border-gray-300 p-3">Managing the client through the closing process to lease signing</td>
                  </tr>
                  <tr>
                    <td className="border border-gray-300 p-3 font-medium">Full-Cycle</td>
                    <td className="border border-gray-300 p-3 text-center font-bold text-[#d4a574]">30%</td>
                    <td className="border border-gray-300 p-3">End-to-end management from deal sourcing through lease signing</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p><strong>3.1 Payment Terms.</strong> Commissions are paid within 14 business days of the investor's payment clearing. During the AMT phase, commissions are split 50/50 with the assigned mentor.</p>
            <p><strong>3.2 Clawback Provision.</strong> If a transaction is reversed, disputed, or the investor cancels within 30 days, the AM's commission may be clawed back in full.</p>

            <h3 className="text-[#1a365d] border-b-2 border-[#f59e0b] pb-2 mt-8">4. CONFIDENTIALITY &amp; NON-COMPETE</h3>
            <p><strong>4.1 Confidentiality.</strong> The AM agrees to maintain strict confidentiality regarding all proprietary information, including but not limited to: investor databases, deal sourcing methodologies, financial models, client information, and internal processes.</p>
            <p><strong>4.2 Non-Compete.</strong> During the term of this Agreement and for a period of 12 months following termination, the AM shall not directly or indirectly engage in any rental arbitrage deal sourcing or consulting business that competes with AYP within the markets served by the Company.</p>
            <p><strong>4.3 Non-Solicitation.</strong> For 18 months following termination, the AM shall not solicit any AYP clients, investors, or staff members.</p>

            <h3 className="text-[#1a365d] border-b-2 border-[#f59e0b] pb-2 mt-8">5. TERMINATION</h3>
            <p><strong>5.1</strong> Either party may terminate this Agreement with 30 days written notice.</p>
            <p><strong>5.2</strong> The Company may terminate immediately for cause, including: violation of the Standard of Truth, failure to achieve certification within the deadline, breach of confidentiality, or conduct detrimental to the Company's reputation.</p>
            <p><strong>5.3</strong> Upon termination, the AM shall immediately return all Company materials, cease use of the AYP platform, and transfer all active client relationships to the Company.</p>

            <h3 className="text-[#1a365d] border-b-2 border-[#f59e0b] pb-2 mt-8">6. GOVERNING LAW</h3>
            <p>This Agreement shall be governed by and construed in accordance with the laws of the State of Florida. Any disputes arising under this Agreement shall be resolved through binding arbitration in Miami-Dade County, Florida.</p>

            <h3 className="text-[#1a365d] border-b-2 border-[#f59e0b] pb-2 mt-8">7. ENTIRE AGREEMENT</h3>
            <p>This Agreement constitutes the entire agreement between the parties and supersedes all prior negotiations, representations, warranties, commitments, offers, contracts, and writings. This Agreement may only be modified by a written instrument signed by both parties.</p>
          </CardContent>
        </Card>

        {/* Signature Section */}
        <Card className="shadow-lg border-2 border-[#d4a574]">
          <CardHeader className="bg-gradient-to-r from-[#fef3c7] to-[#fde68a] border-b">
            <CardTitle className="flex items-center gap-2 text-[#92400e]">
              <Shield className="w-5 h-5" aria-hidden="true" />
              Digital Signature
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6 space-y-6">
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-center gap-2 text-red-700 text-sm" role="alert">
                <AlertTriangle className="w-4 h-4 flex-shrink-0" aria-hidden="true" />
                {error}
              </div>
            )}

            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <p className="text-sm text-gray-500 mb-1">Full Legal Name</p>
                <p className="font-semibold text-[#1a365d]">{agreement?.am_name}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500 mb-1">Email Address</p>
                <p className="text-gray-700">{agreement?.am_email}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500 mb-1">Date</p>
                <p className="text-gray-700">{now.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500 mb-1">IP Address</p>
                <p className="text-gray-700 font-mono text-sm">{clientIp || 'Detecting...'}</p>
              </div>
            </div>

            <div className="border-t pt-6 space-y-4">
              <div className="flex items-start space-x-3">
                <Checkbox
                  id="agree-terms"
                  checked={agreedTerms}
                  onCheckedChange={(checked) => setAgreedTerms(checked === true)}
                  aria-describedby="agree-terms-desc"
                />
                <label htmlFor="agree-terms" id="agree-terms-desc" className="text-sm text-gray-700 cursor-pointer leading-relaxed">
                  I have read and understand the entire Acquisition Manager Service Agreement, including the compensation structure, training requirements, confidentiality obligations, non-compete clause, and termination provisions. I agree to be bound by all terms and conditions set forth herein.
                </label>
              </div>

              <div className="flex items-start space-x-3">
                <Checkbox
                  id="agree-accuracy"
                  checked={agreedAccuracy}
                  onCheckedChange={(checked) => setAgreedAccuracy(checked === true)}
                  aria-describedby="agree-accuracy-desc"
                />
                <label htmlFor="agree-accuracy" id="agree-accuracy-desc" className="text-sm text-gray-700 cursor-pointer leading-relaxed">
                  I acknowledge that this digital signature is legally binding and has the same legal effect as a handwritten signature. I confirm that the information provided is accurate and that I am the person named in this Agreement.
                </label>
              </div>
            </div>

            <div className="border-t pt-6">
              <Label htmlFor="signature" className="text-base font-semibold text-[#1a365d] mb-2 block">
                Type Your Full Legal Name as Your Signature
              </Label>
              <p className="text-xs text-gray-500 mb-3" id="signature-hint">
                Your signature must exactly match: <strong>{agreement?.am_name}</strong>
              </p>
              <div className="relative">
                <Input
                  id="signature"
                  value={signatureText}
                  onChange={(e) => { setSignatureText(e.target.value); setError(''); }}
                  placeholder={`Type "${agreement?.am_name}" here`}
                  className="text-xl h-16 font-serif italic border-2 border-dashed border-gray-300 focus:border-[#d4a574] bg-[#fffbf0]"
                  style={{ fontFamily: "'Dancing Script', 'Brush Script MT', cursive, serif" }}
                  aria-describedby="signature-hint"
                  aria-invalid={signatureText.length > 0 && signatureText.trim().toLowerCase() !== agreement?.am_name?.toLowerCase()}
                />
                {signatureText && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2" aria-hidden="true">
                    {signatureText.trim().toLowerCase() === agreement?.am_name?.toLowerCase() ? (
                      <CheckCircle className="w-5 h-5 text-green-500" />
                    ) : (
                      <AlertTriangle className="w-5 h-5 text-amber-500" />
                    )}
                  </div>
                )}
              </div>
              {signatureText && signatureText.trim().toLowerCase() !== agreement?.am_name?.toLowerCase() && (
                <p className="text-xs text-amber-600 mt-1" role="alert">Signature does not match. Please type: {agreement?.am_name}</p>
              )}
            </div>

            <div className="border-t pt-6 flex flex-col sm:flex-row gap-4 items-center justify-between">
              <p className="text-xs text-gray-400">
                By clicking "Sign Agreement" you are digitally signing this document. Your signature, IP address ({clientIp}), and timestamp will be recorded.
              </p>
              <Button
                onClick={handleSign}
                disabled={signing || !agreedTerms || !agreedAccuracy || !signatureText.trim() || signatureText.trim().toLowerCase() !== agreement?.am_name?.toLowerCase()}
                className="bg-[#d4a574] hover:bg-[#c49464] text-white px-8 py-3 text-lg min-w-[200px]"
                aria-label="Digitally sign the agreement"
              >
                {signing ? (
                  <>
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" aria-hidden="true" />
                    Signing...
                  </>
                ) : (
                  <>
                    <Shield className="w-5 h-5 mr-2" aria-hidden="true" />
                    Sign Agreement
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Footer */}
        <footer className="text-center py-8 text-sm text-gray-400">
          <p>&copy; {year} Set Up Your Place LLC. All rights reserved.</p>
          <p className="mt-1">This document is confidential and intended only for the named recipient.</p>
        </footer>
      </main>
    </div>
  );
}
