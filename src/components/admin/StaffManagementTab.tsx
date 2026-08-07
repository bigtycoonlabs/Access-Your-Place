import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';

import { useToast } from '@/hooks/use-toast';
import { AccountLinkingModal } from './AccountLinkingModal';
import { 
  Loader2, UserPlus, Mail, Phone, Shield, Users, 
  CheckCircle, XCircle, Clock, RefreshCw, Search,
  Building, Briefcase, Star, Link2, ArrowRightLeft,
  Award, Upload, FileCheck, FileX, Eye, Download,
  ShieldCheck, AlertCircle, FileText, Send, Ban,
  Calendar
} from 'lucide-react';

interface StaffMember {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  name: string;
  phone?: string;
  department: string;
  roles?: string[];
  role: string;
  team: string;
  is_active: boolean;
  account_completed: boolean;
  created_at: string;
  linked_investor_id?: string;
  linked_investor_name?: string;
  linked_investor_email?: string;
  yp_certified?: boolean;
  yp_certification_id?: string;
  yp_certification_url?: string;
  yp_certification_verified?: boolean;
  certification_badge_url?: string;
}

interface Certification {
  id: string;
  staff_id: string;
  staff_name?: string;
  certification_type: string;
  file_url: string;
  file_name: string;
  status: string;
  uploaded_by: string;
  uploaded_by_name?: string;
  uploaded_at: string;
  verified_by?: string;
  verified_by_name?: string;
  verified_at?: string;
  rejection_reason?: string;
}

interface AMAgreement {
  id: string;
  staff_id: string;
  am_name: string;
  am_email: string;
  mentor_id?: string;
  mentor_name?: string;
  status: string;
  sent_at?: string;
  viewed_at?: string;
  signed_at?: string;
  expired_at?: string;
  voided_at?: string;
  voided_by?: string;
  resend_count?: number;
  created_at?: string;
  signature_text?: string;
  signature_ip?: string;
  signature_hash?: string;
  signer_user_agent?: string;
  agreement_version?: string;
}


interface Department {
  id: string;
  name: string;
  description: string;
  permissions: string[];
}

interface Props {
  currentStaffId?: string;
  isSuccessManager?: boolean;
}

export function StaffManagementTab({ currentStaffId, isSuccessManager = false }: Props) {
  const { toast } = useToast();
  const [staff, setStaff] = useState<StaffMember[]>([]);

  const [certifications, setCertifications] = useState<Certification[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [agreements, setAgreements] = useState<AMAgreement[]>([]);
  const [loading, setLoading] = useState(true);
  const [inviteModalOpen, setInviteModalOpen] = useState(false);
  const [certModalOpen, setCertModalOpen] = useState(false);
  const [rolesModalOpen, setRolesModalOpen] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterDepartment, setFilterDepartment] = useState('all');
  const [activeTab, setActiveTab] = useState('staff');
  const [linkModalOpen, setLinkModalOpen] = useState(false);
  const [selectedStaffForLink, setSelectedStaffForLink] = useState<StaffMember | null>(null);
  const [selectedStaffForCert, setSelectedStaffForCert] = useState<StaffMember | null>(null);
  const [selectedStaffForRoles, setSelectedStaffForRoles] = useState<StaffMember | null>(null);
  const [selectedCertification, setSelectedCertification] = useState<Certification | null>(null);
  const [certViewModalOpen, setCertViewModalOpen] = useState(false);
  const [uploadingCert, setUploadingCert] = useState(false);
  const [successModalOpen, setSuccessModalOpen] = useState(false);
  const [newStaffDetails, setNewStaffDetails] = useState<{ name: string; email: string; department: string } | null>(null);
  const [loadingAgreements, setLoadingAgreements] = useState(false);
  const [resendingAgreement, setResendingAgreement] = useState<string | null>(null);
  const [voidingAgreement, setVoidingAgreement] = useState<string | null>(null);
  const [signedAgreementModalOpen, setSignedAgreementModalOpen] = useState(false);
  const [selectedSignedAgreement, setSelectedSignedAgreement] = useState<AMAgreement | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [staffToDelete, setStaffToDelete] = useState<StaffMember | null>(null);
  const [deletingStaff, setDeletingStaff] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Form validation state
  const [formSubmitAttempted, setFormSubmitAttempted] = useState(false);

  // v10.0: Investor search for import/convert
  const [investorSearchQuery, setInvestorSearchQuery] = useState('');
  const [investorSearchResults, setInvestorSearchResults] = useState<any[]>([]);
  const [searchingInvestors, setSearchingInvestors] = useState(false);
  const [selectedInvestorForConvert, setSelectedInvestorForConvert] = useState<any | null>(null);

  const defaultInviteForm = {
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    department: '',
    roles: [] as string[],
    mentor_id: '',
    mentor_name: ''
  };

  const [inviteForm, setInviteForm] = useState(defaultInviteForm);

  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);
  const [rejectionReason, setRejectionReason] = useState('');
  
  // v8.0: Certified AMs for mentor assignment
  const [certifiedAMs, setCertifiedAMs] = useState<{ id: string; name: string; email: string }[]>([]);
  const [loadingCertifiedAMs, setLoadingCertifiedAMs] = useState(false);

  // Safe edge function invoker that handles non-JSON "upstream connect error" responses
  const safeInvoke = async (fnName: string, body: any): Promise<{ data: any; error: any }> => {
    try {
      const { data, error } = await supabase.functions.invoke(fnName, { body });
      if (error) {
        // The Supabase client may wrap upstream errors in a FunctionsHttpError
        const errMsg = typeof error === 'object' && error.message ? error.message : String(error);
        console.error(`[safeInvoke] ${fnName} error:`, errMsg);
        return { data: null, error: { message: errMsg } };
      }
      // Guard against data being a raw string instead of parsed JSON
      if (typeof data === 'string') {
        try {
          return { data: JSON.parse(data), error: null };
        } catch {
          console.error(`[safeInvoke] ${fnName} returned non-JSON:`, data.substring(0, 100));
          return { data: null, error: { message: 'Server returned an unexpected response. Please try again.' } };
        }
      }
      return { data, error: null };
    } catch (err: any) {
      console.error(`[safeInvoke] ${fnName} exception:`, err);
      return { data: null, error: { message: err.message || 'Network error. Please check your connection.' } };
    }
  };

  const ROLE_TEXT_COLORS: Record<string, string> = {
    purple: 'text-purple-600',
    blue: 'text-blue-600',
    green: 'text-green-600',
    orange: 'text-orange-600',
    teal: 'text-teal-600',
  };


  const allRoles = [
    { id: 'success_managers', name: 'Success Manager', icon: Star, color: 'purple' },
    { id: 'acquisition_managers', name: 'Acquisition Manager', icon: Briefcase, color: 'blue' },
    { id: 'setup_managers', name: 'Setup Manager', icon: Building, color: 'green' },
    { id: 'content_team', name: 'Content Team', icon: FileCheck, color: 'orange' },
    { id: 'support_team', name: 'Support Team', icon: Users, color: 'teal' }
  ];

  // v10.0: Search investors for import/convert
  const handleInvestorSearch = async () => {
    if (!investorSearchQuery.trim() || investorSearchQuery.trim().length < 2) return;
    setSearchingInvestors(true);
    try {
      const { data } = await safeInvoke('manage-staff', {
        action: 'search_investors',
        query: investorSearchQuery.trim()
      });
      if (data?.investors) {
        setInvestorSearchResults(data.investors);
      } else {
        setInvestorSearchResults([]);
      }
    } catch {
      setInvestorSearchResults([]);
    }
    setSearchingInvestors(false);
  };

  // v10.0: Import investor data into the form
  const handleImportInvestor = (investor: any) => {
    const nameParts = (investor.full_name || '').split(' ');
    setInviteForm(f => ({
      ...f,
      first_name: nameParts[0] || '',
      last_name: nameParts.slice(1).join(' ') || '',
      email: investor.email || '',
      phone: investor.phone || ''
    }));
    setSelectedInvestorForConvert(investor);
    setInvestorSearchResults([]);
    setInvestorSearchQuery('');
    toast({
      title: 'Investor Data Imported',
      description: `${investor.full_name}'s info has been filled in. Select roles and submit to create their staff account.${investor.already_linked ? ' (Note: already linked to a staff account)' : ' Their accounts will be auto-linked.'}`
    });
  };



  useEffect(() => {
    loadStaff();
    loadDepartments();
    if (isSuccessManager) {
      loadCertifications();
      loadAgreements();
    }
  }, [isSuccessManager]);

  const loadStaff = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('manage-staff', {
        body: { action: 'get_staff' }
      });
      if (data?.staff) {
        const staffWithLinks = await Promise.all(data.staff.map(async (s: StaffMember) => {
          if (s.linked_investor_id) {
            try {
              const { data: invData } = await supabase.functions.invoke('manage-staff', {
                body: { action: 'get_linked_investor', staff_id: s.id }
              });
              if (invData?.investor) {
                return {
                  ...s,
                  linked_investor_name: invData.investor.full_name,
                  linked_investor_email: invData.investor.email
                };
              }
            } catch (err) {
              console.error('Failed to fetch linked investor:', err);
            }
          }
          return s;
        }));
        setStaff(staffWithLinks);
      }
    } catch (err) {
      console.error('Failed to load staff:', err);
    }
    setLoading(false);
  };

  const loadDepartments = async () => {
    try {
      const { data } = await supabase.functions.invoke('manage-staff', {
        body: { action: 'get_departments' }
      });
      if (data?.departments) {
        setDepartments(data.departments);
      }
    } catch (err) {
      console.error('Failed to load departments:', err);
    }
  };

  const loadCertifications = async () => {
    try {
      const { data } = await supabase.functions.invoke('manage-staff', {
        body: { action: 'get_certifications' }
      });
      if (data?.certifications) {
        setCertifications(data.certifications);
      }
    } catch (err) {
      console.error('Failed to load certifications:', err);
    }
  };

  const loadAgreements = async () => {
    setLoadingAgreements(true);
    try {
      const { data } = await supabase.functions.invoke('send-investor-invitation', {
        body: { action: 'get_am_agreements' }
      });
      if (data?.agreements) {
        setAgreements(data.agreements);
      }
    } catch (err) {
      console.error('Failed to load agreements:', err);
    }
    setLoadingAgreements(false);
  };

  const handleResendAgreement = async (agreementId: string) => {
    setResendingAgreement(agreementId);
    try {
      const { data, error } = await supabase.functions.invoke('send-investor-invitation', {
        body: { action: 'resend_agreement', agreement_id: agreementId }
      });
      if (data?.success) {
        toast({ title: 'Agreement Resent', description: 'The service agreement has been resent successfully.' });
        loadAgreements();
      } else {
        throw new Error(data?.error || 'Failed to resend agreement');
      }
    } catch (err: any) {
      toast({ title: 'Error', description: err.message || 'Failed to resend agreement', variant: 'destructive' });
    }
    setResendingAgreement(null);
  };

  const handleVoidAgreement = async (agreementId: string) => {
    if (!confirm('Are you sure you want to void this agreement? This action cannot be undone.')) return;
    setVoidingAgreement(agreementId);
    try {
      const { data, error } = await supabase.functions.invoke('send-investor-invitation', {
        body: { action: 'void_agreement', agreement_id: agreementId, voided_by: currentStaffId }
      });
      if (data?.success) {
        toast({ title: 'Agreement Voided', description: 'The service agreement has been voided.' });
        loadAgreements();
      } else {
        throw new Error(data?.error || 'Failed to void agreement');
      }
    } catch (err: any) {
      toast({ title: 'Error', description: err.message || 'Failed to void agreement', variant: 'destructive' });
    }
    setVoidingAgreement(null);
  };

  const handleUpdateAgreementStatus = async (agreementId: string, status: string) => {
    try {
      const { data } = await supabase.functions.invoke('send-investor-invitation', {
        body: { action: 'update_agreement_status', agreement_id: agreementId, status }
      });
      if (data?.success) {
        toast({ title: 'Status Updated', description: `Agreement marked as ${status}.` });
        loadAgreements();
      }
    } catch (err: any) {
      toast({ title: 'Error', description: 'Failed to update status', variant: 'destructive' });
    }
  };

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormSubmitAttempted(true);
    
    // Validate required fields - roles replaces the old department dropdown
    const hasRoles = inviteForm.roles.length > 0;
    const department = hasRoles ? inviteForm.roles[0] : inviteForm.department;
    
    if (!inviteForm.first_name.trim() || !inviteForm.last_name.trim() || !inviteForm.email.trim() || !hasRoles) {
      toast({
        title: 'Missing Required Fields',
        description: !hasRoles 
          ? 'Please select at least one role for this staff member.'
          : 'Please fill in First Name, Last Name, and Email.',
        variant: 'destructive'
      });
      return;
    }

    // Ensure department is synced with first role
    if (!inviteForm.department && hasRoles) {
      setInviteForm(f => ({ ...f, department: inviteForm.roles[0] }));
    }


    
    setProcessing(true);
    try {
      // v8.0: Clean up mentor_id - treat "none" as no mentor
      const mentorId = inviteForm.mentor_id && inviteForm.mentor_id !== 'none' ? inviteForm.mentor_id : undefined;
      const mentorName = mentorId ? inviteForm.mentor_name : undefined;

      // Use the derived department (first role) to ensure it's always in sync
      const primaryDepartment = inviteForm.roles[0];

      const { data, error } = await supabase.functions.invoke('manage-staff', {
        body: {
          action: 'add_staff',
          first_name: inviteForm.first_name,
          last_name: inviteForm.last_name,
          email: inviteForm.email,
          phone: inviteForm.phone,
          department: primaryDepartment,
          roles: inviteForm.roles,
          mentor_id: mentorId,
          mentor_name: mentorName,
          base_url: window.location.origin
        }
      });


      if (data?.success) {
        const newStaffId = data.staff_id || data.id;
        const fullName = `${inviteForm.first_name} ${inviteForm.last_name}`.trim();

        let toastMsg = `${inviteForm.first_name} has been added to the team.`;
        if (data.mentor_assigned) {
          toastMsg += ` Mentor ${mentorName} has been assigned.`;
        } else if (primaryDepartment === 'acquisition_managers' || inviteForm.roles.includes('acquisition_managers')) {
          toastMsg += ' Success team notified to assign a mentor.';
        }

        toast({
          title: 'Staff Member Added',
          description: toastMsg
        });

        // If the new staff member is an Acquisition Manager, automatically send the AM welcome email and service agreement
        const isAcquisitionManager = primaryDepartment === 'acquisition_managers' || 
          inviteForm.roles.includes('acquisition_managers');


        if (isAcquisitionManager && newStaffId && inviteForm.email) {
          try {
            const { data: welcomeData, error: welcomeError } = await supabase.functions.invoke('send-investor-invitation', {
              body: {
                action: 'send_am_welcome_email',
                staff_id: newStaffId,
                am_name: fullName,
                am_email: inviteForm.email,
                mentor_id: mentorId,
                mentor_name: mentorName
              }
            });

            if (welcomeData?.success) {
              toast({
                title: 'AM Onboarding Sent',
                description: `Welcome email and Service Agreement automatically sent to ${inviteForm.first_name}.`
              });
            } else {
              console.error('AM welcome email failed:', welcomeError || welcomeData?.error);
              toast({
                title: 'Staff Added (Email Warning)',
                description: `${inviteForm.first_name} was added but the AM welcome email could not be sent. You can resend it from the Certification tab.`,
                variant: 'destructive'
              });
            }
          } catch (welcomeErr) {
            console.error('Failed to send AM welcome email:', welcomeErr);
            toast({
              title: 'Staff Added (Email Warning)',
              description: `${inviteForm.first_name} was added but the AM welcome email failed. You can resend from the Certification tab.`,
              variant: 'destructive'
            });
          }
        }

        setInviteModalOpen(false);
        setInviteForm({ first_name: '', last_name: '', email: '', phone: '', department: '', roles: [], mentor_id: '', mentor_name: '' });
        setCertifiedAMs([]);
        loadStaff();
        if (isSuccessManager) loadAgreements();
      } else {
        toast({
          title: 'Error',
          description: data?.error || 'Failed to add staff member',
          variant: 'destructive'
        });
      }
    } catch (err) {
      toast({
        title: 'Error',
        description: 'Failed to add staff member',
        variant: 'destructive'
      });
    }
    setProcessing(false);
  };





  const handleUpdateRoles = async () => {
    if (!selectedStaffForRoles) return;
    
    setProcessing(true);
    try {
      const { data } = await supabase.functions.invoke('manage-staff', {
        body: {
          action: 'update_roles',
          staff_id: selectedStaffForRoles.id,
          roles: selectedRoles
        }
      });

      if (data?.success) {
        toast({
          title: 'Roles Updated',
          description: 'Staff member roles have been updated successfully.'
        });
        setRolesModalOpen(false);
        loadStaff();
      }
    } catch (err) {
      toast({
        title: 'Error',
        description: 'Failed to update roles',
        variant: 'destructive'
      });
    }
    setProcessing(false);
  };

  const handleCertificationUpload = async (file: File) => {
    if (!selectedStaffForCert || !currentStaffId) return;
    
    setUploadingCert(true);
    try {
      const fileName = `yp-cert-${selectedStaffForCert.id}-${Date.now()}.${file.name.split('.').pop()}`;
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('investor-documents')
        .upload(`certifications/${fileName}`, file);

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from('investor-documents')
        .getPublicUrl(`certifications/${fileName}`);

      const { data, error } = await supabase.functions.invoke('manage-staff', {
        body: {
          action: 'upload_certification',
          staff_id: selectedStaffForCert.id,
          certification_url: urlData.publicUrl,
          file_name: file.name,
          uploaded_by: currentStaffId
        }
      });

      if (data?.success) {
        toast({
          title: 'Certification Uploaded',
          description: 'The YP certification has been uploaded and is pending verification.'
        });
        setCertModalOpen(false);
        loadStaff();
        loadCertifications();
      }
    } catch (err) {
      toast({
        title: 'Error',
        description: 'Failed to upload certification',
        variant: 'destructive'
      });
    }
    setUploadingCert(false);
  };

  const handleVerifyCertification = async (certId: string, approved: boolean) => {
    if (!currentStaffId) return;
    
    setProcessing(true);
    try {
      const { data } = await supabase.functions.invoke('manage-staff', {
        body: {
          action: approved ? 'verify_certification' : 'reject_certification',
          certification_id: certId,
          verified_by: currentStaffId,
          rejection_reason: !approved ? rejectionReason : undefined
        }
      });

      if (data?.success) {
        toast({
          title: approved ? 'Certification Verified' : 'Certification Rejected',
          description: approved 
            ? 'The staff member is now YP certified.' 
            : 'The certification has been rejected.'
        });
        setCertViewModalOpen(false);
        setRejectionReason('');
        loadStaff();
        loadCertifications();
      }
    } catch (err) {
      toast({
        title: 'Error',
        description: 'Failed to process certification',
        variant: 'destructive'
      });
    }
    setProcessing(false);
  };

  const handleResendInvitation = async (staffId: string) => {
    setProcessing(true);
    try {
      const { data } = await supabase.functions.invoke('manage-staff', {
        body: {
          action: 'resend_invitation',
          staff_id: staffId,
          base_url: window.location.origin
        }
      });

      if (data?.success) {
        toast({
          title: 'Invitation Resent',
          description: 'A new invitation email has been sent.'
        });
      }
    } catch (err) {
      toast({
        title: 'Error',
        description: 'Failed to resend invitation',
        variant: 'destructive'
      });
    }
    setProcessing(false);
  };

  const handleDeleteStaff = async () => {
    if (!staffToDelete) return;
    setDeletingStaff(true);
    try {
      const { data, error } = await supabase.functions.invoke('manage-staff', {
        body: {
          action: 'delete_staff',
          staff_id: staffToDelete.id
        }
      });
      if (data?.success) {
        toast({
          title: 'Staff Deleted',
          description: `${staffToDelete.first_name} ${staffToDelete.last_name} has been permanently removed.`
        });
        setDeleteConfirmOpen(false);
        setStaffToDelete(null);
        loadStaff();
      } else {
        toast({
          title: 'Error',
          description: data?.error || 'Failed to delete staff member',
          variant: 'destructive'
        });
      }
    } catch (err: any) {
      toast({
        title: 'Error',
        description: err.message || 'Failed to delete staff member',
        variant: 'destructive'
      });
    }
    setDeletingStaff(false);
  };

  const handleDeactivate = async (staffId: string) => {
    if (!confirm('Are you sure you want to deactivate this staff member?')) return;

    setProcessing(true);
    try {
      const { data } = await supabase.functions.invoke('manage-staff', {
        body: {
          action: 'deactivate_staff',
          staff_id: staffId,
          deactivated_by: currentStaffId
        }
      });

      if (data?.success) {
        toast({
          title: 'Staff Deactivated',
          description: 'The staff member has been deactivated.'
        });
        loadStaff();
      }
    } catch (err) {
      toast({
        title: 'Error',
        description: 'Failed to deactivate staff',
        variant: 'destructive'
      });
    }
    setProcessing(false);
  };


  const handleOpenLinkModal = (member: StaffMember) => {
    setSelectedStaffForLink(member);
    setLinkModalOpen(true);
  };

  const handleOpenCertModal = (member: StaffMember) => {
    setSelectedStaffForCert(member);
    setCertModalOpen(true);
  };

  const handleOpenRolesModal = (member: StaffMember) => {
    setSelectedStaffForRoles(member);
    setSelectedRoles(member.roles || [member.department]);
    setRolesModalOpen(true);
  };

  const getDepartmentBadge = (department: string, roles?: string[]) => {
    const styles: Record<string, string> = {
      success_managers: 'bg-purple-100 text-purple-800',
      acquisition_managers: 'bg-blue-100 text-blue-800',
      setup_managers: 'bg-green-100 text-green-800',
      content_team: 'bg-orange-100 text-orange-800',
      support_team: 'bg-teal-100 text-teal-800'
    };

    const labels: Record<string, string> = {
      success_managers: 'Success',
      acquisition_managers: 'Acquisition',
      setup_managers: 'Setup',
      content_team: 'Content',
      support_team: 'Support'
    };

    const icons: Record<string, React.ReactNode> = {
      success_managers: <Star className="w-3 h-3 mr-1" aria-hidden="true" />,
      acquisition_managers: <Briefcase className="w-3 h-3 mr-1" aria-hidden="true" />,
      setup_managers: <Building className="w-3 h-3 mr-1" aria-hidden="true" />,
      content_team: <FileCheck className="w-3 h-3 mr-1" aria-hidden="true" />,
      support_team: <Users className="w-3 h-3 mr-1" aria-hidden="true" />
    };

    const displayRoles = roles && roles.length > 0 ? roles : [department];

    return (
      <div className="flex flex-wrap gap-1">
        {displayRoles.map(role => (
          <Badge key={role} className={`${styles[role] || 'bg-gray-100 text-gray-800'} flex items-center`}>
            {icons[role]}
            {labels[role] || role}
          </Badge>
        ))}
      </div>
    );
  };

  const getAgreementStatusBadge = (status: string) => {
    const config: Record<string, { className: string; icon: React.ReactNode; label: string }> = {
      sent: { className: 'bg-blue-100 text-blue-800', icon: <Send className="w-3 h-3 mr-1" />, label: 'Sent' },
      viewed: { className: 'bg-amber-100 text-amber-800', icon: <Eye className="w-3 h-3 mr-1" />, label: 'Viewed' },
      signed: { className: 'bg-green-100 text-green-800', icon: <CheckCircle className="w-3 h-3 mr-1" />, label: 'Signed' },
      expired: { className: 'bg-red-100 text-red-800', icon: <Clock className="w-3 h-3 mr-1" />, label: 'Expired' },
      voided: { className: 'bg-gray-100 text-gray-800', icon: <Ban className="w-3 h-3 mr-1" />, label: 'Voided' },
      pending: { className: 'bg-yellow-100 text-yellow-800', icon: <Clock className="w-3 h-3 mr-1" />, label: 'Pending' }
    };
    const c = config[status] || config.pending;
    return <Badge className={`${c.className} flex items-center`}>{c.icon}{c.label}</Badge>;
  };

  const filteredStaff = staff.filter(s => {
    const matchesSearch = 
      s.first_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.last_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.email?.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesDepartment = filterDepartment === 'all' || 
      s.department === filterDepartment ||
      s.roles?.includes(filterDepartment);
    
    return matchesSearch && matchesDepartment;
  });

  const pendingCertifications = certifications.filter(c => c.status === 'pending');

  const agreementStats = {
    total: agreements.length,
    sent: agreements.filter(a => a.status === 'sent').length,
    viewed: agreements.filter(a => a.status === 'viewed').length,
    signed: agreements.filter(a => a.status === 'signed').length,
    expired: agreements.filter(a => a.status === 'expired').length,
    voided: agreements.filter(a => a.status === 'voided').length,
    pending: agreements.filter(a => a.status === 'pending').length
  };

  const stats = {
    total: staff.length,
    active: staff.filter(s => s.is_active && s.account_completed).length,
    pending: staff.filter(s => !s.account_completed).length,
    linked: staff.filter(s => s.linked_investor_id).length,
    certified: staff.filter(s => s.yp_certified).length,
    pendingCerts: pendingCertifications.length,
    successManagers: staff.filter(s => s.department === 'success_managers' || s.roles?.includes('success_managers')).length,
    acquisitionManagers: staff.filter(s => s.department === 'acquisition_managers' || s.roles?.includes('acquisition_managers')).length,
    setupManagers: staff.filter(s => s.department === 'setup_managers' || s.roles?.includes('setup_managers')).length
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12" role="status" aria-label="Loading staff members">
        <Loader2 className="w-8 h-8 animate-spin text-[#d4a574]" aria-hidden="true" />
        <span className="sr-only">Loading staff members...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6" role="region" aria-label="Staff Management">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-[#1a365d]">Staff Management</h2>
          <p className="text-gray-600">Manage team members, roles, certifications, and account linking</p>
        </div>
        <div className="flex gap-2">
          {isSuccessManager && (
            <Button 
              onClick={() => {
                // Reset form state when opening modal
                setInviteForm({ first_name: '', last_name: '', email: '', phone: '', department: '', roles: [], mentor_id: '', mentor_name: '' });
                setFormSubmitAttempted(false);
                setCertifiedAMs([]);
                setLoadingCertifiedAMs(false);
                setInviteModalOpen(true);
              }}
              className="bg-[#d4a574] hover:bg-[#c49464]"
              aria-label="Add new staff member"
            >
              <UserPlus className="w-4 h-4 mr-2" aria-hidden="true" />
              Add Staff
            </Button>
          )}
        </div>
      </div>


      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4" role="group" aria-label="Staff statistics">
        <Card>
          <CardContent className="pt-4 text-center">
            <p className="text-2xl font-bold text-[#1a365d]">{stats.total}</p>
            <p className="text-xs text-gray-500">Total Staff</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 text-center">
            <p className="text-2xl font-bold text-green-600">{stats.active}</p>
            <p className="text-xs text-gray-500">Active</p>
          </CardContent>
        </Card>
        <Card className="border-[#d4a574] bg-[#d4a574]/5">
          <CardContent className="pt-4 text-center">
            <p className="text-2xl font-bold text-[#d4a574]">{stats.certified}</p>
            <p className="text-xs text-gray-500">YP Certified</p>
          </CardContent>
        </Card>
        <Card className="border-blue-200 bg-blue-50/50">
          <CardContent className="pt-4 text-center">
            <p className="text-2xl font-bold text-blue-600">{stats.linked}</p>
            <p className="text-xs text-blue-700">Linked Accounts</p>
          </CardContent>
        </Card>
        {isSuccessManager && stats.pendingCerts > 0 && (
          <Card className="border-amber-300 bg-amber-50">
            <CardContent className="pt-4 text-center">
              <p className="text-2xl font-bold text-amber-600">{stats.pendingCerts}</p>
              <p className="text-xs text-amber-700">Pending Certs</p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="flex-wrap h-auto p-1">
          <TabsTrigger value="staff" className="flex items-center gap-2">
            <Users className="w-4 h-4" />
            Staff Members
          </TabsTrigger>
          {isSuccessManager && (
            <TabsTrigger value="certifications" className="flex items-center gap-2">
              <Award className="w-4 h-4" />
              Certifications
              {stats.pendingCerts > 0 && (
                <Badge className="ml-1 bg-amber-500">{stats.pendingCerts}</Badge>
              )}
            </TabsTrigger>
          )}
          {isSuccessManager && (
            <TabsTrigger value="agreements" className="flex items-center gap-2">
              <FileText className="w-4 h-4" />
              AM Agreements
              {agreementStats.total > 0 && (
                <Badge className="ml-1 bg-blue-500">{agreementStats.total}</Badge>
              )}
            </TabsTrigger>
          )}
        </TabsList>

        {/* Staff Tab */}
        <TabsContent value="staff" className="space-y-4">
          {/* Filters */}
          <div className="flex flex-col md:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" aria-hidden="true" />
              <Input aria-label="Search by name or email"
                placeholder="Search by name or email..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
                aria-label="Search staff members"
              />
            </div>
            <select
              value={filterDepartment}
              onChange={(e) => setFilterDepartment(e.target.value)}
              aria-label="Filter by department"
              className="h-10 w-full md:w-48 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
            >
              <option value="all">All Departments</option>
              <option value="success_managers">Success Managers</option>
              <option value="acquisition_managers">Acquisition Managers</option>
              <option value="setup_managers">Setup Managers</option>
              <option value="content_team">Content Team</option>
              <option value="support_team">Support Team</option>
            </select>

          </div>

          {/* Staff List */}
          <div className="space-y-4" role="list" aria-label="Staff members list">
            {filteredStaff.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <Users className="w-12 h-12 mx-auto text-gray-300 mb-4" aria-hidden="true" />
                  <p className="text-gray-500">No staff members found</p>
                </CardContent>
              </Card>
            ) : (
              filteredStaff.map(member => (
                <Card 
                  key={member.id} 
                  className={`hover:shadow-md transition-shadow ${!member.is_active ? 'opacity-60' : ''}`}
                  role="listitem"
                >
                  <CardContent className="pt-4">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <div className="flex items-start gap-4">
                        <div className="relative">
                          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#1a365d] to-[#2d4a7c] flex items-center justify-center text-white font-bold" aria-hidden="true">
                            {member.first_name?.[0]}{member.last_name?.[0]}
                          </div>
                          {member.yp_certified && (
                            <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-[#d4a574] rounded-full flex items-center justify-center" title="YP Certified">
                              <Award className="w-3 h-3 text-white" />
                            </div>
                          )}
                        </div>
                        <div>
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <h4 className="font-semibold">
                              {member.first_name} {member.last_name}
                            </h4>
                            {getDepartmentBadge(member.department, member.roles)}
                            {member.yp_certified && (
                              <Badge className="bg-[#d4a574] text-white">
                                <Award className="w-3 h-3 mr-1" />
                                YP Certified
                              </Badge>
                            )}
                            {!member.account_completed && (
                              <Badge variant="outline" className="border-amber-500 text-amber-700">
                                <Clock className="w-3 h-3 mr-1" aria-hidden="true" />
                                Pending Setup
                              </Badge>
                            )}
                            {!member.is_active && member.account_completed && (
                              <Badge variant="outline" className="border-red-500 text-red-700">
                                <XCircle className="w-3 h-3 mr-1" aria-hidden="true" />
                                Inactive
                              </Badge>
                            )}
                            {member.linked_investor_id && (
                              <Badge className="bg-blue-100 text-blue-800">
                                <Link2 className="w-3 h-3 mr-1" aria-hidden="true" />
                                Linked
                              </Badge>
                            )}
                          </div>
                          <div className="flex flex-wrap gap-4 text-sm text-gray-600">
                            <span className="flex items-center">
                              <Mail className="w-4 h-4 mr-1" aria-hidden="true" />
                              <a href={`mailto:${member.email}`} className="hover:text-[#d4a574]">
                                {member.email}
                              </a>
                            </span>
                            {member.phone && (
                              <span className="flex items-center">
                                <Phone className="w-4 h-4 mr-1" aria-hidden="true" />
                                <a href={`tel:${member.phone}`} className="hover:text-[#d4a574]">
                                  {member.phone}
                                </a>
                              </span>
                            )}
                          </div>
                          
                          {member.linked_investor_id && member.linked_investor_name && (
                            <div className="mt-2 p-2 bg-blue-50 rounded-lg border border-blue-100">
                              <p className="text-xs text-blue-800 flex items-center gap-1">
                                <ArrowRightLeft className="w-3 h-3" />
                                <span className="font-medium">Linked Investor:</span>
                                {member.linked_investor_name} ({member.linked_investor_email})
                              </p>
                            </div>
                          )}
                          
                          <p className="text-xs text-gray-400 mt-1">
                            Added {new Date(member.created_at).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                      
                      <div className="flex gap-2 flex-wrap">
                        {/* Resend Welcome Email - for AM staff who have completed account setup */}
                        {isSuccessManager && member.is_active && member.account_completed && 
                         (member.department === 'acquisition_managers' || member.roles?.includes('acquisition_managers')) && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-indigo-600 hover:text-indigo-700"
                            disabled={processing}
                            onClick={async () => {
                              setProcessing(true);
                              try {
                                const fullName = `${member.first_name} ${member.last_name}`.trim();
                                const { data: welcomeData, error: welcomeError } = await supabase.functions.invoke('send-investor-invitation', {
                                  body: {
                                    action: 'send_am_welcome_email',
                                    staff_id: member.id,
                                    am_name: fullName,
                                    am_email: member.email
                                  }
                                });
                                if (welcomeError) {
                                  toast({ title: 'Email Failed', description: `Edge function error: ${welcomeError.message || 'Unknown error'}`, variant: 'destructive' });
                                } else if (welcomeData?.success) {
                                  toast({ title: 'Welcome Email Sent', description: `Welcome email and agreement resent to ${member.first_name}.` });
                                  if (isSuccessManager) loadAgreements();
                                } else {
                                  toast({ title: 'Email Failed', description: welcomeData?.error || 'The welcome email could not be sent. Check Resend API configuration.', variant: 'destructive' });
                                }
                              } catch (err: any) {
                                toast({ title: 'Email Failed', description: err.message || 'Network error sending welcome email', variant: 'destructive' });
                              }
                              setProcessing(false);
                            }}
                            aria-label={`Resend welcome email to ${member.first_name}`}
                          >
                            <Mail className="w-4 h-4 mr-1" aria-hidden="true" />
                            Resend Welcome
                          </Button>
                        )}

                        {isSuccessManager && member.is_active && member.account_completed && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleOpenRolesModal(member)}
                            aria-label={`Manage roles for ${member.first_name}`}
                          >
                            <Shield className="w-4 h-4 mr-1" aria-hidden="true" />
                            Roles
                          </Button>
                        )}

                        {isSuccessManager && member.is_active && member.account_completed && 
                         (member.department === 'acquisition_managers' || member.roles?.includes('acquisition_managers')) && 
                         !member.yp_certified && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleOpenCertModal(member)}
                            className="text-[#d4a574] hover:text-[#c49464]"
                            aria-label={`Upload certification for ${member.first_name}`}
                          >
                            <Upload className="w-4 h-4 mr-1" aria-hidden="true" />
                            Upload Cert
                          </Button>
                        )}

                        {member.is_active && member.account_completed && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleOpenLinkModal(member)}
                            className={member.linked_investor_id ? 'text-blue-600 hover:text-blue-700' : ''}
                            aria-label={member.linked_investor_id ? `Manage linked account for ${member.first_name}` : `Link investor account for ${member.first_name}`}
                          >
                            <Link2 className="w-4 h-4 mr-1" aria-hidden="true" />
                            {member.linked_investor_id ? 'Manage Link' : 'Link Account'}
                          </Button>
                        )}
                        
                        {!member.account_completed && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleResendInvitation(member.id)}
                            disabled={processing}
                            aria-label={`Resend invitation to ${member.first_name} ${member.last_name}`}
                          >
                            <RefreshCw className="w-4 h-4 mr-1" aria-hidden="true" />
                            Resend Invite
                          </Button>
                        )}
                        {isSuccessManager && member.is_active && member.account_completed && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-red-600 hover:text-red-700"
                            onClick={() => handleDeactivate(member.id)}
                            disabled={processing}
                            aria-label={`Deactivate ${member.first_name} ${member.last_name}`}
                          >
                            <XCircle className="w-4 h-4 mr-1" aria-hidden="true" />
                            Deactivate
                          </Button>
                        )}
                        {isSuccessManager && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-red-700 hover:text-red-800 hover:bg-red-50 border-red-200"
                            onClick={() => {
                              setStaffToDelete(member);
                              setDeleteConfirmOpen(true);
                            }}
                            disabled={processing || deletingStaff}
                            aria-label={`Delete ${member.first_name} ${member.last_name} permanently`}
                          >
                            <XCircle className="w-4 h-4 mr-1" aria-hidden="true" />
                            Delete
                          </Button>
                        )}
                      </div>

                    </div>
                  </CardContent>

                </Card>
              ))
            )}

          </div>
        </TabsContent>

        {/* Certifications Tab */}
        {isSuccessManager && (
          <TabsContent value="certifications" className="space-y-4">
            {pendingCertifications.length > 0 && (
              <Card className="border-amber-300 bg-amber-50">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-amber-800">
                    <AlertCircle className="w-5 h-5" />
                    Pending Verification ({pendingCertifications.length})
                  </CardTitle>
                  <CardDescription className="text-amber-700">
                    Review and verify YP certifications for acquisition managers
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {pendingCertifications.map(cert => {
                      const staffMember = staff.find(s => s.id === cert.staff_id);
                      return (
                        <div key={cert.id} className="flex items-center justify-between p-4 bg-white rounded-lg border">
                          <div className="flex items-center gap-4">
                            <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center">
                              <Award className="w-5 h-5 text-amber-600" />
                            </div>
                            <div>
                              <p className="font-medium">{staffMember?.first_name} {staffMember?.last_name}</p>
                              <p className="text-sm text-gray-500">{cert.file_name}</p>
                              <p className="text-xs text-gray-400">
                                Uploaded {new Date(cert.uploaded_at).toLocaleDateString()} by {cert.uploaded_by_name}
                              </p>
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setSelectedCertification(cert);
                                setCertViewModalOpen(true);
                              }}
                            >
                              <Eye className="w-4 h-4 mr-1" />
                              Review
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Award className="w-5 h-5 text-[#d4a574]" />
                  All Certifications
                </CardTitle>
              </CardHeader>
              <CardContent>
                {certifications.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <Award className="w-12 h-12 mx-auto text-gray-300 mb-4" />
                    <p>No certifications uploaded yet</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {certifications.map(cert => {
                      const staffMember = staff.find(s => s.id === cert.staff_id);
                      return (
                        <div key={cert.id} className="flex items-center justify-between p-4 border rounded-lg">
                          <div className="flex items-center gap-4">
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                              cert.status === 'approved' ? 'bg-green-100' :
                              cert.status === 'rejected' ? 'bg-red-100' : 'bg-amber-100'
                            }`}>
                              {cert.status === 'approved' ? (
                                <ShieldCheck className="w-5 h-5 text-green-600" />
                              ) : cert.status === 'rejected' ? (
                                <FileX className="w-5 h-5 text-red-600" />
                              ) : (
                                <Clock className="w-5 h-5 text-amber-600" />
                              )}
                            </div>
                            <div>
                              <p className="font-medium">{staffMember?.first_name} {staffMember?.last_name}</p>
                              <p className="text-sm text-gray-500">{cert.file_name}</p>
                              <div className="flex items-center gap-2 mt-1">
                                <Badge className={
                                  cert.status === 'approved' ? 'bg-green-500' :
                                  cert.status === 'rejected' ? 'bg-red-500' : 'bg-amber-500'
                                }>
                                  {cert.status}
                                </Badge>
                                {cert.verified_at && (
                                  <span className="text-xs text-gray-400">
                                    {cert.status === 'approved' ? 'Verified' : 'Reviewed'} {new Date(cert.verified_at).toLocaleDateString()}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => window.open(cert.file_url, '_blank')}
                            >
                              <Download className="w-4 h-4 mr-1" />
                              View
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        )}

        {/* AM Agreements Tab */}
        {isSuccessManager && (
          <TabsContent value="agreements" className="space-y-4">
            {/* Agreement Stats */}
            <div className="grid grid-cols-2 md:grid-cols-7 gap-3">
              <Card className="border-blue-200 bg-blue-50/50">
                <CardContent className="pt-3 pb-3 text-center">
                  <p className="text-xl font-bold text-blue-700">{agreementStats.total}</p>
                  <p className="text-[10px] text-blue-600 uppercase font-medium">Total</p>
                </CardContent>
              </Card>
              <Card className="border-yellow-200 bg-yellow-50/50">
                <CardContent className="pt-3 pb-3 text-center">
                  <p className="text-xl font-bold text-yellow-600">{agreementStats.pending}</p>
                  <p className="text-[10px] text-yellow-500 uppercase font-medium">Pending</p>
                </CardContent>
              </Card>
              <Card className="border-blue-200 bg-blue-50/50">
                <CardContent className="pt-3 pb-3 text-center">
                  <p className="text-xl font-bold text-blue-600">{agreementStats.sent}</p>
                  <p className="text-[10px] text-blue-500 uppercase font-medium">Sent</p>
                </CardContent>
              </Card>
              <Card className="border-amber-200 bg-amber-50/50">
                <CardContent className="pt-3 pb-3 text-center">
                  <p className="text-xl font-bold text-amber-600">{agreementStats.viewed}</p>
                  <p className="text-[10px] text-amber-500 uppercase font-medium">Viewed</p>
                </CardContent>
              </Card>
              <Card className="border-green-200 bg-green-50/50">
                <CardContent className="pt-3 pb-3 text-center">
                  <p className="text-xl font-bold text-green-600">{agreementStats.signed}</p>
                  <p className="text-[10px] text-green-500 uppercase font-medium">Signed</p>
                </CardContent>
              </Card>
              <Card className="border-red-200 bg-red-50/50">
                <CardContent className="pt-3 pb-3 text-center">
                  <p className="text-xl font-bold text-red-600">{agreementStats.expired}</p>
                  <p className="text-[10px] text-red-500 uppercase font-medium">Expired</p>
                </CardContent>
              </Card>
              <Card className="border-gray-200 bg-gray-50/50">
                <CardContent className="pt-3 pb-3 text-center">
                  <p className="text-xl font-bold text-gray-600">{agreementStats.voided}</p>
                  <p className="text-[10px] text-gray-500 uppercase font-medium">Voided</p>
                </CardContent>
              </Card>
            </div>

            {/* Unsigned Agreements Alert */}
            {(agreementStats.sent + agreementStats.viewed + agreementStats.pending) > 0 && (
              <Card className="border-amber-300 bg-amber-50">
                <CardContent className="py-4">
                  <div className="flex items-center justify-between gap-4 flex-wrap">
                    <div className="flex items-center gap-3">
                      <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0" />
                      <div>
                        <p className="font-medium text-amber-800">
                          {agreementStats.sent + agreementStats.viewed + agreementStats.pending} AM{(agreementStats.sent + agreementStats.viewed + agreementStats.pending) !== 1 ? 's' : ''} with unsigned agreements
                        </p>
                        <p className="text-sm text-amber-600">Send reminders to ensure all AMs complete their service agreements</p>
                      </div>
                    </div>
                    <Button
                      size="sm"
                      className="bg-amber-600 hover:bg-amber-700 text-white"
                      disabled={processing}
                      onClick={async () => {
                        setProcessing(true);
                        const unsignedAgreements = agreements.filter(a => a.status !== 'signed' && a.status !== 'voided');
                        let sentCount = 0;
                        for (const ag of unsignedAgreements) {
                          try {
                            const { data } = await supabase.functions.invoke('send-investor-invitation', {
                              body: { action: 'resend_agreement', agreement_id: ag.id }
                            });
                            if (data?.success) sentCount++;
                          } catch (err) {
                            console.error('Failed to resend to', ag.am_email, err);
                          }
                        }
                        toast({
                          title: 'Reminders Sent',
                          description: `Successfully sent ${sentCount} of ${unsignedAgreements.length} reminder(s).`
                        });
                        loadAgreements();
                        setProcessing(false);
                      }}
                    >
                      {processing ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Send className="w-4 h-4 mr-1" />}
                      Send All Reminders
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* AMs Without Agreements */}
            {(() => {
              const amStaff = staff.filter(s => 
                s.is_active && s.account_completed &&
                (s.department === 'acquisition_managers' || s.roles?.includes('acquisition_managers'))
              );
              const amsWithAgreements = new Set(agreements.map(a => a.staff_id));
              const amsWithoutAgreements = amStaff.filter(s => !amsWithAgreements.has(s.id));
              
              if (amsWithoutAgreements.length === 0) return null;
              
              return (
                <Card className="border-red-200 bg-red-50/50">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2 text-red-800">
                      <AlertCircle className="w-5 h-5" />
                      AMs Without Agreements ({amsWithoutAgreements.length})
                    </CardTitle>
                    <CardDescription className="text-red-600">
                      These Acquisition Managers do not have a service agreement on file. Generate and send one now.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {amsWithoutAgreements.map(am => (
                        <div key={am.id} className="flex items-center justify-between p-3 bg-white rounded-lg border border-red-100">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#1a365d] to-[#2d4a7c] flex items-center justify-center text-white text-xs font-bold">
                              {am.first_name?.[0]}{am.last_name?.[0]}
                            </div>
                            <div>
                              <p className="font-medium text-sm">{am.first_name} {am.last_name}</p>
                              <p className="text-xs text-gray-500">{am.email}</p>
                            </div>
                          </div>
                          <Button
                            size="sm"
                            className="bg-[#d4a574] hover:bg-[#c49464] text-white"
                            disabled={processing}
                            onClick={async () => {
                              setProcessing(true);
                              try {
                                const fullName = `${am.first_name} ${am.last_name}`.trim();
                                const { data, error: err } = await supabase.functions.invoke('send-investor-invitation', {
                                  body: {
                                    action: 'send_am_welcome_email',
                                    staff_id: am.id,
                                    am_name: fullName,
                                    am_email: am.email
                                  }
                                });
                                if (data?.success) {
                                  toast({ title: 'Agreement Sent', description: `Service agreement sent to ${am.first_name}.` });
                                  loadAgreements();
                                } else {
                                  toast({ title: 'Error', description: data?.error || 'Failed to send agreement', variant: 'destructive' });
                                }
                              } catch (err: any) {
                                toast({ title: 'Error', description: err.message || 'Failed to generate agreement', variant: 'destructive' });
                              }
                              setProcessing(false);
                            }}
                          >
                            {processing ? <Loader2 className="w-3 h-3 animate-spin" /> : <FileText className="w-3 h-3 mr-1" />}
                            Generate Agreement
                          </Button>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              );
            })()}

            {/* Agreements Table */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <FileText className="w-5 h-5 text-[#d4a574]" />
                      AM Service Agreement Tracker
                    </CardTitle>
                    <CardDescription>
                      Track which Acquisition Managers have received, opened, and signed their service agreements
                    </CardDescription>
                  </div>
                  <Button variant="outline" size="sm" onClick={loadAgreements} disabled={loadingAgreements}>
                    {loadingAgreements ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />}
                    Refresh
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {loadingAgreements ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="w-6 h-6 animate-spin text-[#d4a574]" />
                  </div>
                ) : agreements.length === 0 ? (
                  <div className="text-center py-12">
                    <FileText className="w-12 h-12 mx-auto text-gray-300 mb-4" />
                    <p className="text-gray-500 font-medium">No agreements found</p>
                    <p className="text-sm text-gray-400 mt-1">
                      Agreements are automatically created when new Acquisition Managers are added
                    </p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b bg-gray-50">
                          <th className="text-left py-3 px-3 font-medium text-gray-700">AM Name</th>
                          <th className="text-left py-3 px-3 font-medium text-gray-700">Email</th>
                          <th className="text-left py-3 px-3 font-medium text-gray-700">Status</th>
                          <th className="text-left py-3 px-3 font-medium text-gray-700">Timeline</th>
                          <th className="text-left py-3 px-3 font-medium text-gray-700">Signature Details</th>
                          <th className="text-center py-3 px-3 font-medium text-gray-700">Resends</th>
                          <th className="text-right py-3 px-3 font-medium text-gray-700">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {agreements.map(agreement => (
                          <tr key={agreement.id} className="border-b hover:bg-gray-50 transition-colors">
                            <td className="py-3 px-3">
                              <div className="flex items-center gap-2">
                                <div className="w-7 h-7 rounded-full bg-gradient-to-br from-[#1a365d] to-[#2d4a7c] flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0">
                                  {agreement.am_name?.split(' ').map(n => n[0]).join('').slice(0, 2)}
                                </div>
                                <div>
                                  <span className="font-medium text-sm">{agreement.am_name}</span>
                                  {agreement.mentor_name && (
                                    <p className="text-[10px] text-gray-400">Mentor: {agreement.mentor_name}</p>
                                  )}
                                </div>
                              </div>
                            </td>
                            <td className="py-3 px-3 text-gray-600">
                              <a href={`mailto:${agreement.am_email}`} className="hover:text-[#d4a574] text-xs">
                                {agreement.am_email}
                              </a>
                            </td>
                            <td className="py-3 px-3">
                              {getAgreementStatusBadge(agreement.status)}
                              {agreement.agreement_version && (
                                <p className="text-[10px] text-gray-400 mt-0.5">v{agreement.agreement_version}</p>
                              )}
                            </td>
                            <td className="py-3 px-3">
                              <div className="space-y-0.5 text-[11px]">
                                {agreement.sent_at && (
                                  <div className="flex items-center gap-1 text-blue-600">
                                    <Send className="w-2.5 h-2.5" />
                                    <span>Sent: {new Date(agreement.sent_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                                  </div>
                                )}
                                {agreement.viewed_at && (
                                  <div className="flex items-center gap-1 text-amber-600">
                                    <Eye className="w-2.5 h-2.5" />
                                    <span>Viewed: {new Date(agreement.viewed_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                                  </div>
                                )}
                                {agreement.signed_at && (
                                  <div className="flex items-center gap-1 text-green-600">
                                    <CheckCircle className="w-2.5 h-2.5" />
                                    <span>Signed: {new Date(agreement.signed_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</span>
                                  </div>
                                )}
                                {agreement.voided_at && (
                                  <div className="flex items-center gap-1 text-red-600">
                                    <Ban className="w-2.5 h-2.5" />
                                    <span>Voided: {new Date(agreement.voided_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                                  </div>
                                )}
                                {agreement.expired_at && (
                                  <div className="flex items-center gap-1 text-red-500">
                                    <Clock className="w-2.5 h-2.5" />
                                    <span>Expired: {new Date(agreement.expired_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                                  </div>
                                )}
                              </div>
                            </td>
                            <td className="py-3 px-3">
                              {agreement.status === 'signed' ? (
                                <div className="space-y-0.5 text-[11px]">
                                  {agreement.signature_ip && (
                                    <div className="flex items-center gap-1 text-gray-600">
                                      <Shield className="w-2.5 h-2.5" />
                                      <span className="font-mono">{agreement.signature_ip}</span>
                                    </div>
                                  )}
                                  {agreement.signature_text && (
                                    <div className="text-gray-500 italic" style={{ fontFamily: "'Dancing Script', cursive, serif" }}>
                                      "{agreement.signature_text}"
                                    </div>
                                  )}
                                  {agreement.signer_user_agent && (
                                    <div className="text-[10px] text-gray-400 truncate max-w-[180px]" title={agreement.signer_user_agent}>
                                      {agreement.signer_user_agent.substring(0, 40)}...
                                    </div>
                                  )}
                                  {agreement.signature_hash && (
                                    <div className="text-[10px] text-gray-400 font-mono">
                                      Hash: {agreement.signature_hash.substring(0, 16)}...
                                    </div>
                                  )}
                                </div>
                              ) : (
                                <span className="text-[11px] text-gray-400 italic">Not yet signed</span>
                              )}
                            </td>
                            <td className="py-3 px-3 text-center text-gray-600">
                              {agreement.resend_count || 0}
                            </td>
                            <td className="py-3 px-3">
                              <div className="flex gap-1 justify-end flex-wrap">
                                {agreement.status !== 'voided' && agreement.status !== 'signed' && (
                                  <>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      className="h-7 px-2 text-xs"
                                      onClick={() => handleResendAgreement(agreement.id)}
                                      disabled={resendingAgreement === agreement.id}
                                    >
                                      {resendingAgreement === agreement.id ? (
                                        <Loader2 className="w-3 h-3 animate-spin" />
                                      ) : (
                                        <>
                                          <Send className="w-3 h-3 mr-1" />
                                          Resend
                                        </>
                                      )}
                                    </Button>
                                    {agreement.status === 'sent' && (
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        className="h-7 px-2 text-xs text-amber-600 hover:text-amber-700"
                                        onClick={() => handleUpdateAgreementStatus(agreement.id, 'viewed')}
                                      >
                                        <Eye className="w-3 h-3 mr-1" />
                                        Mark Viewed
                                      </Button>
                                    )}
                                    {(agreement.status === 'sent' || agreement.status === 'viewed') && (
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        className="h-7 px-2 text-xs text-green-600 hover:text-green-700"
                                        onClick={() => handleUpdateAgreementStatus(agreement.id, 'signed')}
                                      >
                                        <CheckCircle className="w-3 h-3 mr-1" />
                                        Mark Signed
                                      </Button>
                                    )}
                                  </>
                                )}
                                {agreement.status === 'signed' && (
                                  <>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      className="h-7 px-2 text-xs text-green-600 hover:text-green-700"
                                      onClick={() => {
                                        setSelectedSignedAgreement(agreement);
                                        setSignedAgreementModalOpen(true);
                                      }}
                                      aria-label={`View signed agreement for ${agreement.am_name}`}
                                    >
                                      <Eye className="w-3 h-3 mr-1" aria-hidden="true" />
                                      View
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      className="h-7 px-2 text-xs text-blue-600 hover:text-blue-700"
                                      onClick={async () => {
                                        try {
                                          const { data } = await supabase.functions.invoke('generate-agreement-pdf', {
                                            body: { agreement_id: agreement.id }
                                          });
                                          if (data?.success && data.html) {
                                            const printWindow = window.open('', '_blank');
                                            if (printWindow) {
                                              printWindow.document.write(data.html);
                                              printWindow.document.close();
                                              setTimeout(() => printWindow.print(), 500);
                                            }
                                          } else {
                                            toast({ title: 'Error', description: data?.error || 'Failed to generate PDF', variant: 'destructive' });
                                          }
                                        } catch (err: any) {
                                          toast({ title: 'Error', description: 'Failed to generate PDF', variant: 'destructive' });
                                        }
                                      }}
                                      aria-label={`Download agreement PDF for ${agreement.am_name}`}
                                    >
                                      <Download className="w-3 h-3 mr-1" aria-hidden="true" />
                                      PDF
                                    </Button>
                                  </>
                                )}
                                {agreement.status !== 'voided' && agreement.status !== 'signed' && (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-7 px-2 text-xs text-red-600 hover:text-red-700"
                                    onClick={() => handleVoidAgreement(agreement.id)}
                                    disabled={voidingAgreement === agreement.id}
                                  >
                                    {voidingAgreement === agreement.id ? (
                                      <Loader2 className="w-3 h-3 animate-spin" />
                                    ) : (
                                      <>
                                        <Ban className="w-3 h-3 mr-1" />
                                        Void
                                      </>
                                    )}
                                  </Button>
                                )}
                                {(agreement.status === 'voided' || agreement.status === 'expired') && (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-7 px-2 text-xs text-[#d4a574] hover:text-[#c49464]"
                                    disabled={processing}
                                    onClick={async () => {
                                      setProcessing(true);
                                      try {
                                        const { data } = await supabase.functions.invoke('send-investor-invitation', {
                                          body: {
                                            action: 'send_am_welcome_email',
                                            staff_id: agreement.staff_id,
                                            am_name: agreement.am_name,
                                            am_email: agreement.am_email
                                          }
                                        });
                                        if (data?.success) {
                                          toast({ title: 'New Agreement Sent', description: `A new service agreement has been sent to ${agreement.am_name}.` });
                                          loadAgreements();
                                        } else {
                                          toast({ title: 'Error', description: data?.error || 'Failed to generate new agreement', variant: 'destructive' });
                                        }
                                      } catch (err: any) {
                                        toast({ title: 'Error', description: 'Failed to generate new agreement', variant: 'destructive' });
                                      }
                                      setProcessing(false);
                                    }}
                                  >
                                    <FileText className="w-3 h-3 mr-1" />
                                    New Agreement
                                  </Button>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))}
                        </tbody>

                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        )}

      </Tabs>

      {/* Invite Modal */}

      <Dialog open={inviteModalOpen} onOpenChange={setInviteModalOpen}>
        <DialogContent aria-describedby="invite-description">
          <DialogHeader>
            <DialogTitle>Add Staff Member</DialogTitle>
            <DialogDescription id="invite-description">
              Add a new team member to Access Your Place. Select one or more roles.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleInvite} noValidate className="space-y-4">

            {/* v10.0: Import from Investor Account */}
            <div className="border border-blue-200 bg-blue-50/50 rounded-lg p-3">
              <Label className="text-xs font-medium text-blue-800 mb-1.5 block" htmlFor="import-from-existing-investor-account">
                <Search className="w-3 h-3 inline mr-1" aria-hidden="true" />
                Import from Existing Investor Account
              </Label>
              <div className="flex gap-2">
                <Input id="import-from-existing-investor-account"
                  placeholder="Search investor by name or email..."
                  value={investorSearchQuery}
                  onChange={(e) => setInvestorSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleInvestorSearch())}
                  className="text-sm h-8 bg-white"
                  aria-label="Search for an existing investor account to import"
                />
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-8 px-3 text-xs shrink-0"
                  onClick={handleInvestorSearch}
                  disabled={searchingInvestors || investorSearchQuery.trim().length < 2}
                >
                  {searchingInvestors ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Search'}
                </Button>
              </div>
              {investorSearchResults.length > 0 && (
                <div className="mt-2 max-h-32 overflow-y-auto space-y-1">
                  {investorSearchResults.map((inv) => (
                    <button
                      key={inv.id}
                      type="button"
                      className={`w-full text-left p-2 rounded text-xs hover:bg-blue-100 transition-colors flex items-center justify-between ${inv.already_linked ? 'opacity-50' : 'bg-white border border-blue-100'}`}
                      onClick={() => !inv.already_linked && handleImportInvestor(inv)}
                      disabled={inv.already_linked}
                    >
                      <div>
                        <span className="font-medium">{inv.full_name || inv.email}</span>
                        <span className="text-gray-500 ml-2">{inv.email}</span>
                      </div>
                      {inv.already_linked ? (
                        <Badge variant="outline" className="text-[10px] border-amber-300 text-amber-600 ml-2">Already Linked</Badge>
                      ) : (
                        <Badge variant="outline" className="text-[10px] border-blue-300 text-blue-600 ml-2">Import</Badge>
                      )}
                    </button>
                  ))}
                </div>
              )}
              {investorSearchQuery && investorSearchResults.length === 0 && !searchingInvestors && (
                <p className="text-xs text-gray-500 mt-1">No investors found. You can still add staff manually below.</p>
              )}
              {selectedInvestorForConvert && (
                <div className="mt-2 p-2 bg-green-50 border border-green-200 rounded flex items-center justify-between">
                  <p className="text-xs text-green-800">
                    <CheckCircle className="w-3 h-3 inline mr-1" />
                    Imported from: <strong>{selectedInvestorForConvert.full_name}</strong> — accounts will be auto-linked
                  </p>
                  <button
                    type="button"
                    className="text-xs text-red-500 hover:text-red-700 ml-2"
                    onClick={() => {
                      setSelectedInvestorForConvert(null);
                      setInviteForm(defaultInviteForm);
                    }}
                  >
                    Clear
                  </button>
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">

              <div>
                <Label htmlFor="invite-first-name">First Name *</Label>
                <Input
                  id="invite-first-name"
                  value={inviteForm.first_name}
                  onChange={(e) => setInviteForm(f => ({ ...f, first_name: e.target.value }))}
                  required
                  aria-required="true"
                  aria-invalid={formSubmitAttempted && !inviteForm.first_name.trim()}
                  aria-describedby={formSubmitAttempted && !inviteForm.first_name.trim() ? 'first-name-error' : undefined}
                  className={formSubmitAttempted && !inviteForm.first_name.trim() ? 'border-red-400 focus:ring-red-400' : ''}
                />
                {formSubmitAttempted && !inviteForm.first_name.trim() && (
                  <p id="first-name-error" className="text-xs text-red-500 mt-1" role="alert">First name is required</p>
                )}
              </div>
              <div>
                <Label htmlFor="invite-last-name">Last Name *</Label>
                <Input
                  id="invite-last-name"
                  value={inviteForm.last_name}
                  onChange={(e) => setInviteForm(f => ({ ...f, last_name: e.target.value }))}
                  required
                  aria-required="true"
                  aria-invalid={formSubmitAttempted && !inviteForm.last_name.trim()}
                  aria-describedby={formSubmitAttempted && !inviteForm.last_name.trim() ? 'last-name-error' : undefined}
                  className={formSubmitAttempted && !inviteForm.last_name.trim() ? 'border-red-400 focus:ring-red-400' : ''}
                />
                {formSubmitAttempted && !inviteForm.last_name.trim() && (
                  <p id="last-name-error" className="text-xs text-red-500 mt-1" role="alert">Last name is required</p>
                )}
              </div>
            </div>

            <div>
              <Label htmlFor="invite-email">Email *</Label>
              <Input
                id="invite-email"
                type="email"
                value={inviteForm.email}
                onChange={(e) => setInviteForm(f => ({ ...f, email: e.target.value }))}
                required
                aria-required="true"
                aria-invalid={formSubmitAttempted && !inviteForm.email.trim()}
                aria-describedby={formSubmitAttempted && !inviteForm.email.trim() ? 'email-error' : undefined}
                className={formSubmitAttempted && !inviteForm.email.trim() ? 'border-red-400 focus:ring-red-400' : ''}
              />
              {formSubmitAttempted && !inviteForm.email.trim() && (
                <p id="email-error" className="text-xs text-red-500 mt-1" role="alert">Email is required</p>
              )}
            </div>

            <div>
              <Label htmlFor="invite-phone">Phone Number</Label>
              <Input
                id="invite-phone"
                type="tel"
                value={inviteForm.phone}
                onChange={(e) => setInviteForm(f => ({ ...f, phone: e.target.value }))}
                placeholder="(555) 123-4567"
              />
            </div>


            {/* Role Selection via Checkboxes - replaces the department dropdown */}
            <fieldset
              aria-required="true"
              aria-invalid={formSubmitAttempted && inviteForm.roles.length === 0}
              aria-describedby="roles-help-text roles-error-text roles-selected-text"
            >
              <legend className="text-sm font-medium mb-1">
                Assign Roles * <span className="text-xs font-normal text-gray-500">(select at least one)</span>
              </legend>
              <p id="roles-help-text" className="text-xs text-gray-500 mb-3">The first selected role will be the primary department.</p>
              {formSubmitAttempted && inviteForm.roles.length === 0 && (
                <p id="roles-error-text" className="text-xs text-red-500 mb-2" role="alert">Please select at least one role</p>
              )}
              <div
                className={`space-y-2 rounded-lg border p-3 ${formSubmitAttempted && inviteForm.roles.length === 0 ? 'border-red-400 bg-red-50/30' : 'border-gray-200'}`}
                role="group"
                aria-label="Available staff roles"
              >
                {allRoles.map(role => {
                  const isChecked = inviteForm.roles.includes(role.id);
                  const toggleRole = (checked: boolean | 'indeterminate') => {
                    if (checked === 'indeterminate') return;
                    const newRoles = checked
                      ? [...inviteForm.roles, role.id]
                      : inviteForm.roles.filter(r => r !== role.id);
                    
                    // Auto-set department to first selected role
                    const newDepartment = newRoles.length > 0 ? newRoles[0] : '';
                    
                    setInviteForm(f => ({ 
                      ...f, 
                      roles: newRoles, 
                      department: newDepartment,
                      // Reset mentor if acquisition_managers is deselected
                      mentor_id: newRoles.includes('acquisition_managers') ? f.mentor_id : '',
                      mentor_name: newRoles.includes('acquisition_managers') ? f.mentor_name : ''
                    }));

                    // Fetch certified AMs when acquisition_managers is newly selected
                    if (checked && role.id === 'acquisition_managers') {
                      setLoadingCertifiedAMs(true);
                      supabase.functions.invoke('send-investor-invitation', {
                        body: { action: 'get_certified_ams' }
                      }).then(({ data }) => {
                        if (data?.certified_ams) {
                          setCertifiedAMs(data.certified_ams.map((am: any) => ({
                            id: am.id,
                            name: `${am.first_name || ''} ${am.last_name || ''}`.trim() || am.email,
                            email: am.email
                          })));
                        }
                        setLoadingCertifiedAMs(false);
                      }).catch(() => setLoadingCertifiedAMs(false));
                    }
                  };

                  return (
                    <div 
                      key={role.id} 
                      className={`flex items-center space-x-3 p-2.5 rounded-md transition-colors ${
                        isChecked 
                          ? 'bg-[#d4a574]/10 border border-[#d4a574]/30' 
                          : 'hover:bg-gray-50 border border-transparent'
                      }`}
                    >
                      <Checkbox
                        id={`invite-role-${role.id}`}
                        checked={isChecked}
                        onCheckedChange={toggleRole}
                        aria-label={`${role.name}${isChecked && inviteForm.roles[0] === role.id ? ' (Primary role)' : ''}`}
                      />
                      <label 
                        htmlFor={`invite-role-${role.id}`} 
                        className="flex-1 flex items-center cursor-pointer select-none"
                      >
                        <role.icon className={`w-4 h-4 mr-2 ${ROLE_TEXT_COLORS[role.color] || 'text-gray-600'}`} aria-hidden="true" />
                        <span className="text-sm font-medium">{role.name}</span>
                      </label>
                      {isChecked && inviteForm.roles[0] === role.id && (
                        <Badge variant="outline" className="text-[10px] border-[#d4a574] text-[#d4a574] px-1.5 py-0" aria-hidden="true">
                          Primary
                        </Badge>
                      )}
                    </div>
                  );
                })}
              </div>
              {inviteForm.roles.length > 0 && (
                <p id="roles-selected-text" className="text-xs text-gray-500 mt-2" aria-live="polite">
                  Primary department: <span className="font-medium text-[#1a365d]">
                    {allRoles.find(r => r.id === inviteForm.roles[0])?.name || inviteForm.roles[0]}
                  </span>
                  {inviteForm.roles.length > 1 && (
                    <> + {inviteForm.roles.length - 1} additional role{inviteForm.roles.length > 2 ? 's' : ''}</>
                  )}
                </p>
              )}
            </fieldset>


            {/* v8.0: Assign Mentor for Acquisition Managers - native select */}
            {inviteForm.roles.includes('acquisition_managers') && (
              <div>
                <Label htmlFor="invite-mentor">Assign Mentor (Certified AM)</Label>
                <p className="text-xs text-gray-500 mb-2">
                  Assign a certified AM as mentor for this trainee. If left empty, the success team will be notified to assign one.
                </p>
                {loadingCertifiedAMs ? (
                  <div className="flex items-center gap-2 p-2 text-sm text-gray-500">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Loading certified AMs...
                  </div>
                ) : certifiedAMs.length === 0 ? (
                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
                    <div className="flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 flex-shrink-0" />
                      <span>No certified AMs available. The success team will be notified to assign a mentor after creation.</span>
                    </div>
                  </div>
                ) : (
                  <select
                    id="invite-mentor"
                    value={inviteForm.mentor_id}
                    onChange={(e) => {
                      const selectedId = e.target.value;
                      const selectedAM = certifiedAMs.find(am => am.id === selectedId);
                      setInviteForm(f => ({
                        ...f,
                        mentor_id: selectedId,
                        mentor_name: selectedAM?.name || ''
                      }));
                    }}
                    className="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                  >
                    <option value="">No mentor (notify success team)</option>
                    {certifiedAMs.map(am => (
                      <option key={am.id} value={am.id}>
                        {am.name} ({am.email})
                      </option>
                    ))}
                  </select>
                )}
              </div>
            )}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setInviteModalOpen(false)}>
                Cancel
              </Button>
              <Button 
                type="submit" 
                disabled={processing || inviteForm.roles.length === 0}
                className="bg-[#d4a574] hover:bg-[#c49464]"
              >
                {processing && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Add Staff Member
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>





      {/* Roles Management Modal */}
      <Dialog open={rolesModalOpen} onOpenChange={setRolesModalOpen}>
        <DialogContent aria-describedby="manage-roles-description">
          <DialogHeader>
            <DialogTitle>Manage Roles</DialogTitle>
            <DialogDescription id="manage-roles-description">
              Update roles for {selectedStaffForRoles?.first_name} {selectedStaffForRoles?.last_name}
            </DialogDescription>
          </DialogHeader>

          <fieldset aria-required="true">
            <legend className="text-sm text-gray-600 mb-3">Select all roles that apply to this staff member:</legend>
            <div className="space-y-3" role="group" aria-label="Staff role options">
              {allRoles.map(role => {
                const isChecked = selectedRoles.includes(role.id);
                return (
                  <div key={role.id} className={`flex items-center space-x-3 p-3 border rounded-lg transition-colors ${
                    isChecked ? 'bg-[#d4a574]/10 border-[#d4a574]/30' : 'hover:bg-gray-50'
                  }`}>
                    <Checkbox
                      id={`manage-role-${role.id}`}
                      checked={isChecked}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          setSelectedRoles(prev => [...prev, role.id]);
                        } else {
                          setSelectedRoles(prev => prev.filter(r => r !== role.id));
                        }
                      }}
                      aria-label={`${role.name} role`}
                    />
                    <label htmlFor={`manage-role-${role.id}`} className="flex-1 cursor-pointer select-none">
                      <div className="flex items-center">
                        <role.icon className={`w-5 h-5 mr-2 ${ROLE_TEXT_COLORS[role.color] || 'text-gray-600'}`} aria-hidden="true" />
                        <span className="font-medium">{role.name}</span>
                      </div>
                    </label>
                  </div>
                );
              })}
            </div>
            {selectedRoles.length === 0 && (
              <p className="text-xs text-red-500 mt-2" role="alert">At least one role must be selected</p>
            )}
          </fieldset>

          <DialogFooter>
            <Button variant="outline" onClick={() => setRolesModalOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleUpdateRoles}
              disabled={processing || selectedRoles.length === 0}
              className="bg-[#d4a574] hover:bg-[#c49464]"
            >
              {processing && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Update Roles
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>


      {/* Certification Upload Modal */}
      <Dialog open={certModalOpen} onOpenChange={setCertModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Award className="w-5 h-5 text-[#d4a574]" />
              Upload YP Certification
            </DialogTitle>
            <DialogDescription>
              Upload the YP certification document for {selectedStaffForCert?.first_name} {selectedStaffForCert?.last_name}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
              <input
                type="file"
                ref={fileInputRef}
                className="hidden"
                accept=".pdf,.jpg,.jpeg,.png"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    handleCertificationUpload(file);
                  }
                }}
              />
              <Upload className="w-12 h-12 mx-auto text-gray-400 mb-4" />
              <p className="text-gray-600 mb-2">Click to upload certification document</p>
              <p className="text-xs text-gray-400">PDF, JPG, or PNG (max 10MB)</p>
              <Button
                variant="outline"
                className="mt-4"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingCert}
              >
                {uploadingCert ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Uploading...
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4 mr-2" />
                    Select File
                  </>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Certification Review Modal */}
      <Dialog open={certViewModalOpen} onOpenChange={setCertViewModalOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Award className="w-5 h-5 text-[#d4a574]" />
              Review Certification
            </DialogTitle>
          </DialogHeader>

          {selectedCertification && (
            <div className="space-y-4">
              <div className="bg-gray-50 p-4 rounded-lg">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-gray-500">Staff Member</p>
                    <p className="font-medium">
                      {staff.find(s => s.id === selectedCertification.staff_id)?.first_name}{' '}
                      {staff.find(s => s.id === selectedCertification.staff_id)?.last_name}
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-500">File Name</p>
                    <p className="font-medium">{selectedCertification.file_name}</p>
                  </div>
                  <div>
                    <p className="text-gray-500">Uploaded By</p>
                    <p className="font-medium">{selectedCertification.uploaded_by_name}</p>
                  </div>
                  <div>
                    <p className="text-gray-500">Upload Date</p>
                    <p className="font-medium">
                      {new Date(selectedCertification.uploaded_at).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              </div>

              <div className="border rounded-lg p-4">
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => window.open(selectedCertification.file_url, '_blank')}
                >
                  <Eye className="w-4 h-4 mr-2" />
                  View Document in New Tab
                </Button>
              </div>

              {selectedCertification.status === 'pending' && (
                <>
                  <div>
                    <Label htmlFor="rejection-reason-if-rejecting">Rejection Reason (if rejecting)</Label>
                    <Textarea id="rejection-reason-if-rejecting"
                      value={rejectionReason}
                      onChange={(e) => setRejectionReason(e.target.value)}
                      placeholder="Enter reason for rejection..."
                      rows={3}
                    />
                  </div>

                  <div className="flex gap-3">
                    <Button
                      variant="outline"
                      className="flex-1 text-red-600 hover:text-red-700"
                      onClick={() => handleVerifyCertification(selectedCertification.id, false)}
                      disabled={processing}
                    >
                      <FileX className="w-4 h-4 mr-2" />
                      Reject
                    </Button>
                    <Button
                      className="flex-1 bg-green-600 hover:bg-green-700"
                      onClick={() => handleVerifyCertification(selectedCertification.id, true)}
                      disabled={processing}
                    >
                      {processing ? (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      ) : (
                        <ShieldCheck className="w-4 h-4 mr-2" />
                      )}
                      Approve & Certify
                    </Button>
                  </div>
                </>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* View Signed Agreement Modal */}
      <Dialog open={signedAgreementModalOpen} onOpenChange={setSignedAgreementModalOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-green-600" />
              Signed Agreement - {selectedSignedAgreement?.am_name}
            </DialogTitle>
            <DialogDescription>
              Digitally signed service agreement with verification details
            </DialogDescription>
          </DialogHeader>
          {selectedSignedAgreement && (
            <div className="space-y-6">
              {/* Agreement Summary */}
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-3">
                  <CheckCircle className="w-5 h-5 text-green-600" />
                  <span className="font-semibold text-green-800">Agreement Successfully Signed</span>
                </div>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div><span className="text-gray-500">Signer:</span> <span className="font-medium">{selectedSignedAgreement.am_name}</span></div>
                  <div><span className="text-gray-500">Email:</span> <span className="font-medium">{selectedSignedAgreement.am_email}</span></div>
                  <div><span className="text-gray-500">Signed At:</span> <span className="font-medium">{selectedSignedAgreement.signed_at ? new Date(selectedSignedAgreement.signed_at).toLocaleString() : 'N/A'}</span></div>
                  <div><span className="text-gray-500">Mentor:</span> <span className="font-medium">{selectedSignedAgreement.mentor_name || 'N/A'}</span></div>
                </div>
              </div>

              {/* Digital Signature Details */}
              <div className="border rounded-lg p-4 space-y-3">
                <h4 className="font-semibold text-[#1a365d] flex items-center gap-2"><Shield className="w-4 h-4" /> Digital Signature Verification</h4>
                <div className="bg-[#fffbf0] border-2 border-dashed border-[#d4a574] rounded-lg p-4 text-center">
                  <p className="text-2xl italic font-serif text-[#1a365d]" style={{ fontFamily: "'Dancing Script', 'Brush Script MT', cursive, serif" }}>
                    {selectedSignedAgreement.signature_text || selectedSignedAgreement.am_name}
                  </p>
                  <p className="text-xs text-gray-500 mt-2">Digital Signature</p>
                </div>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div><span className="text-gray-500">IP Address:</span> <span className="font-mono text-xs">{selectedSignedAgreement.signature_ip || 'N/A'}</span></div>
                  <div><span className="text-gray-500">User Agent:</span> <span className="font-mono text-xs truncate block max-w-[250px]">{selectedSignedAgreement.signer_user_agent?.substring(0, 60) || 'N/A'}...</span></div>
                  <div><span className="text-gray-500">Verification Hash:</span> <span className="font-mono text-xs">{selectedSignedAgreement.signature_hash?.substring(0, 24) || 'N/A'}...</span></div>
                  <div><span className="text-gray-500">Agreement Version:</span> <span className="font-medium">{selectedSignedAgreement.agreement_version || '1.0'}</span></div>
                </div>
              </div>

              {/* Agreement Timeline */}
              <div className="border rounded-lg p-4 space-y-2">
                <h4 className="font-semibold text-[#1a365d] flex items-center gap-2"><Calendar className="w-4 h-4" /> Agreement Timeline</h4>
                <div className="space-y-2 text-sm">
                  {selectedSignedAgreement.sent_at && (
                    <div className="flex items-center gap-2"><Send className="w-3 h-3 text-blue-500" /><span className="text-gray-500">Sent:</span> {new Date(selectedSignedAgreement.sent_at).toLocaleString()}</div>
                  )}
                  {selectedSignedAgreement.viewed_at && (
                    <div className="flex items-center gap-2"><Eye className="w-3 h-3 text-amber-500" /><span className="text-gray-500">Viewed:</span> {new Date(selectedSignedAgreement.viewed_at).toLocaleString()}</div>
                  )}
                  {selectedSignedAgreement.signed_at && (
                    <div className="flex items-center gap-2"><CheckCircle className="w-3 h-3 text-green-500" /><span className="text-gray-500">Signed:</span> {new Date(selectedSignedAgreement.signed_at).toLocaleString()}</div>
                  )}
                  {selectedSignedAgreement.resend_count && selectedSignedAgreement.resend_count > 0 && (
                    <div className="flex items-center gap-2"><RefreshCw className="w-3 h-3 text-gray-400" /><span className="text-gray-500">Resent {selectedSignedAgreement.resend_count} time(s)</span></div>
                  )}
                </div>
              </div>

              {/* Signing Link */}
              <div className="bg-gray-50 border rounded-lg p-3 text-xs text-gray-500">
                <span className="font-medium">Agreement URL:</span>{' '}
                <span className="font-mono break-all">https://accessyourplace.com/am-agreement/{selectedSignedAgreement.id}</span>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setSignedAgreementModalOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Staff Confirmation Dialog */}
      <Dialog open={deleteConfirmOpen} onOpenChange={(open) => { if (!open) { setDeleteConfirmOpen(false); setStaffToDelete(null); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-700">
              <AlertCircle className="w-5 h-5" />
              Permanently Delete Staff Member
            </DialogTitle>
            <DialogDescription>
              This action cannot be undone. This will permanently delete{' '}
              <strong>{staffToDelete?.first_name} {staffToDelete?.last_name}</strong> ({staffToDelete?.email}) 
              from the staff database, including all their certifications, agreements, and assignment records.
            </DialogDescription>
          </DialogHeader>
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 my-2">
            <p className="text-sm text-red-800 font-medium">Are you absolutely sure?</p>
            <p className="text-xs text-red-600 mt-1">
              Consider using "Deactivate" instead if you want to preserve their records but prevent login access.
            </p>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => { setDeleteConfirmOpen(false); setStaffToDelete(null); }}>
              Cancel
            </Button>
            <Button 
              variant="destructive" 
              onClick={handleDeleteStaff}
              disabled={deletingStaff}
              className="bg-red-600 hover:bg-red-700"
            >
              {deletingStaff ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Deleting...</>
              ) : (
                <><XCircle className="w-4 h-4 mr-2" />Delete Permanently</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>



      {/* Account Linking Modal */}
      {selectedStaffForLink && (
        <AccountLinkingModal
          open={linkModalOpen}
          onOpenChange={setLinkModalOpen}
          mode="staff"
          sourceAccount={{
            id: selectedStaffForLink.id,
            name: `${selectedStaffForLink.first_name} ${selectedStaffForLink.last_name}`,
            email: selectedStaffForLink.email,
            linkedAccountId: selectedStaffForLink.linked_investor_id,
            linkedAccountName: selectedStaffForLink.linked_investor_name,
            linkedAccountEmail: selectedStaffForLink.linked_investor_email
          }}
          onLinked={() => {
            loadStaff();
            setSelectedStaffForLink(null);
          }}
        />
      )}
    </div>
  );
}
