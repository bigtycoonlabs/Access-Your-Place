import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import {
  Loader2, Award, Clock, CheckCircle, AlertTriangle,
  Target, TrendingUp, Users, BookOpen, Shield,
  Calendar, Timer, ChevronRight, Star, Zap,
  UserCheck, Send, RefreshCw, XCircle, MessageSquare,
  ClipboardCheck, ChevronDown, ChevronUp, FileText,
  Save, Edit3, BarChart3, UserPlus, HandHelping
} from 'lucide-react';


interface Props {
  staffId: string;
  staffRole: string;
  isSuccessManager?: boolean;
  isTrainee?: boolean;
  compact?: boolean;
}

interface TraineeProgress {
  trainee_status: string;
  trainee_start_date: string;
  certification_deadline: string;
  assigned_mentor_id: string;
  assigned_mentor_name: string;
  commission_split: number;
  pillar_1_deals_approved: number;
  pillar_2_leads_generated: number;
  pillar_2_leads_closed: number;
  pillar_3_full_cycles: number;
  pillar_4_exam_score: number | null;
  pillar_4_exam_passed: boolean;
  yp_certified: boolean;
  welcome_email_sent: boolean;
  agreement_email_sent: boolean;
  first_name?: string;
  last_name?: string;
}

interface CertTask {
  id: string;
  pillar_number: number;
  pillar_name: string;
  task_description: string;
  task_type: string;
  completed: boolean;
  completed_at: string | null;
  verified_by_name: string | null;
  notes: string | null;
}

interface CertifiedAM {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
}

interface MentorTrainee {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  trainee_start_date: string;
  certification_deadline: string;
  commission_split: number;
  pillar_1_deals_approved: number;
  pillar_2_leads_generated: number;
  pillar_2_leads_closed: number;
  pillar_3_full_cycles: number;
  pillar_4_exam_score: number | null;
  pillar_4_exam_passed: boolean;
  tasks: CertTask[];
  trainee_notes?: string;
  days_since_start?: number | null;
  days_until_deadline?: number | null;
  completion_percentage?: number;
  account_completed?: boolean;
  is_active?: boolean;
}

interface UnassignedTrainee {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  trainee_start_date: string | null;
  certification_deadline: string | null;
  trainee_status: string | null;
  created_at: string;
}

interface CommLogEntry {
  id: string;
  mentor_id: string;
  mentor_name: string;
  trainee_id: string;
  task_id?: string;
  message_type: string;
  message: string;
  created_at: string;
}


const PILLARS = [
  {
    number: 1,
    name: 'Market Mastery',
    subtitle: 'The Analyst',
    icon: Target,
    color: 'blue',
    bgGradient: 'from-blue-500 to-blue-700',
    borderColor: 'border-blue-500',
    bgLight: 'bg-blue-50',
    textColor: 'text-blue-700',
    requirement: '3 consecutive verified deals',
    maxValue: 3,
    field: 'pillar_1_deals_approved' as const
  },
  {
    number: 2,
    name: 'Rainmaker',
    subtitle: 'The Hunter',
    icon: TrendingUp,
    color: 'emerald',
    bgGradient: 'from-emerald-500 to-emerald-700',
    borderColor: 'border-emerald-500',
    bgLight: 'bg-emerald-50',
    textColor: 'text-emerald-700',
    requirement: '3 leads + 2 closed in 30 days',
    maxValue: 5,
    fields: ['pillar_2_leads_generated', 'pillar_2_leads_closed'] as const
  },
  {
    number: 3,
    name: 'Consultant',
    subtitle: 'The Guide',
    icon: Users,
    color: 'amber',
    bgGradient: 'from-amber-500 to-amber-700',
    borderColor: 'border-amber-500',
    bgLight: 'bg-amber-50',
    textColor: 'text-amber-700',
    requirement: '3 full-cycle transactions',
    maxValue: 3,
    field: 'pillar_3_full_cycles' as const
  },
  {
    number: 4,
    name: 'Technical Proficiency',
    subtitle: 'The Scholar',
    icon: BookOpen,
    color: 'purple',
    bgGradient: 'from-purple-500 to-purple-700',
    borderColor: 'border-purple-500',
    bgLight: 'bg-purple-50',
    textColor: 'text-purple-700',
    requirement: '90%+ exam score',
    maxValue: 100,
    field: 'pillar_4_exam_score' as const
  }
];

export function TraineeCertificationProgress({ staffId, staffRole, isSuccessManager = false, isTrainee = false, compact = false }: Props) {
  const [loading, setLoading] = useState(true);
  const [progress, setProgress] = useState<TraineeProgress | null>(null);
  const [tasks, setTasks] = useState<CertTask[]>([]);
  const [certifiedAMs, setCertifiedAMs] = useState<CertifiedAM[]>([]);
  const [showMentorModal, setShowMentorModal] = useState(false);
  const [selectedMentorId, setSelectedMentorId] = useState('');
  const [processing, setProcessing] = useState(false);
  const [trainees, setTrainees] = useState<any[]>([]);
  const [selectedTraineeId, setSelectedTraineeId] = useState('');
  
  // Mentor dashboard state
  const [mentorTrainees, setMentorTrainees] = useState<MentorTrainee[]>([]);
  const [commLog, setCommLog] = useState<CommLogEntry[]>([]);
  const [loadingMentorData, setLoadingMentorData] = useState(false);
  const [expandedTrainee, setExpandedTrainee] = useState<string | null>(null);
  const [verifyingTask, setVerifyingTask] = useState<string | null>(null);
  const [verifyNotes, setVerifyNotes] = useState('');
  const [examScore, setExamScore] = useState('');
  const [showVerifyModal, setShowVerifyModal] = useState(false);
  const [selectedTask, setSelectedTask] = useState<CertTask | null>(null);
  const [selectedTaskTraineeId, setSelectedTaskTraineeId] = useState('');
  const [mentorNote, setMentorNote] = useState('');
  const [mentorNoteTraineeId, setMentorNoteTraineeId] = useState('');
  const [addingNote, setAddingNote] = useState(false);
  const [isMentor, setIsMentor] = useState(false);
  // Trainee progress notes state
  const [editingTraineeNotes, setEditingTraineeNotes] = useState<string | null>(null);
  const [traineeNotesText, setTraineeNotesText] = useState('');
  const [savingTraineeNotes, setSavingTraineeNotes] = useState(false);
  
  // Unassigned trainees state (for certified AMs)
  const [unassignedTrainees, setUnassignedTrainees] = useState<UnassignedTrainee[]>([]);
  const [loadingUnassigned, setLoadingUnassigned] = useState(false);
  const [volunteeringFor, setVolunteeringFor] = useState<string | null>(null);
  
  // Editable progress state (for mentors and success managers)
  const [editingProgressFor, setEditingProgressFor] = useState<string | null>(null);
  const [progressEdits, setProgressEdits] = useState({
    pillar_1_deals_approved: 0,
    pillar_2_leads_generated: 0,
    pillar_2_leads_closed: 0,
    pillar_3_full_cycles: 0,
    pillar_4_exam_score: 0
  });
  const [savingProgress, setSavingProgress] = useState(false);
  
  // SM expanded trainee for editing
  const [smExpandedTrainee, setSmExpandedTrainee] = useState<string | null>(null);
  
  const { toast } = useToast();


  const fetchProgress = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('send-investor-invitation', {
        body: { action: 'get_trainee_progress', staff_id: staffId }
      });
      if (data?.progress) {
        setProgress(data.progress);
        setTasks(data.tasks || []);
        if (data.progress.yp_certified && !isSuccessManager) {
          setIsMentor(true);
          fetchMentorTrainees();
          fetchUnassignedTrainees();
        }
      }
    } catch (err) {
      console.error('Failed to fetch trainee progress:', err);
    }
    setLoading(false);
  }, [staffId, isSuccessManager]);

  const fetchCertifiedAMs = useCallback(async () => {
    try {
      const { data } = await supabase.functions.invoke('send-investor-invitation', {
        body: { action: 'get_certified_ams' }
      });
      if (data?.certified_ams) {
        setCertifiedAMs(data.certified_ams);
      }
    } catch (err) {
      console.error('Failed to fetch certified AMs:', err);
    }
  }, []);

  const fetchTrainees = useCallback(async () => {
    if (!isSuccessManager) return;
    try {
      const { data } = await supabase.functions.invoke('send-investor-invitation', {
        body: { action: 'get_trainee_ams' }
      });
      if (data?.trainees) {
        setTrainees(data.trainees);
      }
    } catch (err) {
      console.error('Failed to fetch trainees:', err);
    }
  }, [isSuccessManager]);

  const fetchMentorTrainees = useCallback(async () => {
    setLoadingMentorData(true);
    try {
      const { data } = await supabase.functions.invoke('send-investor-invitation', {
        body: { action: 'get_mentor_trainees', mentor_id: staffId }
      });
      if (data?.trainees) {
        setMentorTrainees(data.trainees);
      }
      if (data?.communication_log) {
        setCommLog(data.communication_log);
      }
    } catch (err) {
      console.error('Failed to fetch mentor trainees:', err);
    }
    setLoadingMentorData(false);
  }, [staffId]);

  const fetchUnassignedTrainees = useCallback(async () => {
    setLoadingUnassigned(true);
    try {
      const { data } = await supabase.functions.invoke('send-investor-invitation', {
        body: { action: 'get_unassigned_trainees', requester_id: staffId }
      });
      if (data?.trainees) {
        setUnassignedTrainees(data.trainees);
      }
    } catch (err) {
      console.error('Failed to fetch unassigned trainees:', err);
    }
    setLoadingUnassigned(false);
  }, [staffId]);

  const handleVolunteerAsMentor = async (traineeId: string) => {
    setVolunteeringFor(traineeId);
    try {
      const { data, error } = await supabase.functions.invoke('send-investor-invitation', {
        body: { action: 'self_assign_mentor', mentor_id: staffId, trainee_id: traineeId }
      });
      if (error) throw error;
      if (data?.success) {
        toast({ 
          title: 'Mentor Assignment Successful', 
          description: data.message || 'You are now mentoring this trainee.'
        });
        // Refresh both lists
        fetchMentorTrainees();
        fetchUnassignedTrainees();
      } else {
        throw new Error(data?.error || 'Failed to self-assign as mentor');
      }
    } catch (err: any) {
      toast({ 
        title: 'Error', 
        description: err.message || 'Failed to volunteer as mentor', 
        variant: 'destructive' 
      });
    }
    setVolunteeringFor(null);
  };

  useEffect(() => {
    fetchProgress();
    if (isSuccessManager) {
      fetchCertifiedAMs();
      fetchTrainees();
    }
  }, [fetchProgress, fetchCertifiedAMs, fetchTrainees, isSuccessManager]);

  const assignMentor = async (traineeId: string, mentorId: string) => {
    setProcessing(true);
    try {
      const mentor = certifiedAMs.find(am => am.id === mentorId);
      const mentorName = mentor ? `${mentor.first_name} ${mentor.last_name}`.trim() : '';
      
      const { data } = await supabase.functions.invoke('send-investor-invitation', {
        body: { action: 'assign_mentor', staff_id: traineeId, mentor_id: mentorId, mentor_name: mentorName }
      });

      if (data?.success) {
        toast({ title: 'Mentor Assigned', description: `${mentorName} assigned as mentor successfully.` });
        setShowMentorModal(false);
        fetchProgress();
        fetchTrainees();
      }
    } catch (err) {
      toast({ title: 'Error', description: 'Failed to assign mentor', variant: 'destructive' });
    }
    setProcessing(false);
  };

  const sendWelcomeEmail = async (traineeId: string, traineeName: string, traineeEmail: string, mentorName: string, mentorId: string) => {
    setProcessing(true);
    try {
      const { data } = await supabase.functions.invoke('send-investor-invitation', {
        body: {
          action: 'send_am_welcome_email',
          staff_id: traineeId,
          am_name: traineeName,
          am_email: traineeEmail,
          mentor_name: mentorName,
          mentor_id: mentorId
        }
      });

      if (data?.success) {
        toast({ title: 'Welcome Email Sent', description: `Welcome email and Service Agreement sent to ${traineeName}` });
        fetchProgress();
        fetchTrainees();
      } else {
        throw new Error(data?.error || 'Failed to send');
      }
    } catch (err: any) {
      toast({ title: 'Error', description: err.message || 'Failed to send welcome email', variant: 'destructive' });
    }
    setProcessing(false);
  };

  const handleMentorVerifyTask = async () => {
    if (!selectedTask || !selectedTaskTraineeId) return;
    setVerifyingTask(selectedTask.id);
    try {
      const mentorName = progress ? `${progress.first_name || ''} ${progress.last_name || ''}`.trim() : 'Mentor';
      const { data } = await supabase.functions.invoke('send-investor-invitation', {
        body: {
          action: 'mentor_verify_task',
          task_id: selectedTask.id,
          mentor_id: staffId,
          mentor_name: mentorName,
          trainee_id: selectedTaskTraineeId,
          notes: verifyNotes || undefined,
          exam_score: selectedTask.task_type === 'exam' && examScore ? parseInt(examScore) : undefined
        }
      });

      if (data?.success) {
        toast({ title: 'Task Verified', description: `Task "${selectedTask.task_description}" has been verified and marked complete.` });
        setShowVerifyModal(false);
        setVerifyNotes('');
        setExamScore('');
        setSelectedTask(null);
        fetchMentorTrainees();
      } else {
        throw new Error(data?.error || 'Failed to verify task');
      }
    } catch (err: any) {
      toast({ title: 'Error', description: err.message || 'Failed to verify task', variant: 'destructive' });
    }
    setVerifyingTask(null);
  };

  const handleAddMentorNote = async (traineeId: string) => {
    if (!mentorNote.trim()) return;
    setAddingNote(true);
    try {
      const mentorName = progress ? `${progress.first_name || ''} ${progress.last_name || ''}`.trim() : 'Mentor';
      const { data } = await supabase.functions.invoke('send-investor-invitation', {
        body: {
          action: 'add_mentor_note',
          mentor_id: staffId,
          mentor_name: mentorName,
          trainee_id: traineeId,
          message: mentorNote,
          message_type: 'note'
        }
      });

      if (data?.success) {
        toast({ title: 'Note Added', description: 'Your mentor note has been saved.' });
        setMentorNote('');
        setMentorNoteTraineeId('');
        fetchMentorTrainees();
      }
    } catch (err: any) {
      toast({ title: 'Error', description: 'Failed to add note', variant: 'destructive' });
    }
    setAddingNote(false);
  };

  const handleSaveTraineeNotes = async (traineeId: string) => {
    setSavingTraineeNotes(true);
    try {
      const { data } = await supabase.functions.invoke('send-investor-invitation', {
        body: {
          action: 'update_trainee_notes',
          trainee_id: traineeId,
          trainee_notes: traineeNotesText,
          mentor_id: staffId
        }
      });
      if (data?.success) {
        toast({ title: 'Progress Notes Saved', description: 'Trainee progress notes have been updated.' });
        setEditingTraineeNotes(null);
        setMentorTrainees(prev => prev.map(t => 
          t.id === traineeId ? { ...t, trainee_notes: traineeNotesText } : t
        ));
      } else {
        throw new Error(data?.error || 'Failed to save notes');
      }
    } catch (err: any) {
      toast({ title: 'Error', description: err.message || 'Failed to save trainee notes', variant: 'destructive' });
    }
    setSavingTraineeNotes(false);
  };


  const startEditingProgress = (traineeData: any) => {
    setEditingProgressFor(traineeData.id);
    setProgressEdits({
      pillar_1_deals_approved: traineeData.pillar_1_deals_approved || 0,
      pillar_2_leads_generated: traineeData.pillar_2_leads_generated || 0,
      pillar_2_leads_closed: traineeData.pillar_2_leads_closed || 0,
      pillar_3_full_cycles: traineeData.pillar_3_full_cycles || 0,
      pillar_4_exam_score: traineeData.pillar_4_exam_score || 0
    });
  };

  const handleUpdateProgress = async (traineeId: string) => {
    setSavingProgress(true);
    try {
      const updaterName = progress 
        ? `${progress.first_name || ''} ${progress.last_name || ''}`.trim() || 'Staff'
        : isSuccessManager ? 'Success Manager' : 'Mentor';
      
      const { data, error } = await supabase.functions.invoke('manage-staff', {
        body: {
          action: 'update_trainee_progress',
          trainee_id: traineeId,
          updated_by_id: staffId,
          updated_by_name: updaterName,
          pillar_1_deals_approved: progressEdits.pillar_1_deals_approved,
          pillar_2_leads_generated: progressEdits.pillar_2_leads_generated,
          pillar_2_leads_closed: progressEdits.pillar_2_leads_closed,
          pillar_3_full_cycles: progressEdits.pillar_3_full_cycles,
          pillar_4_exam_score: progressEdits.pillar_4_exam_score
        }
      });

      if (error) throw error;
      if (data?.success) {
        toast({ 
          title: data.auto_certified ? 'Trainee Certified!' : 'Progress Updated', 
          description: data.auto_certified 
            ? 'All pillars complete! Trainee has been auto-certified as a YP Acquisition Manager.'
            : 'Trainee pillar progress has been updated successfully.'
        });
        setEditingProgressFor(null);
        
        // Update local state for both mentor and SM views
        if (isMentor) {
          setMentorTrainees(prev => prev.map(t => 
            t.id === traineeId ? { 
              ...t, 
              ...progressEdits,
              pillar_4_exam_passed: progressEdits.pillar_4_exam_score >= 90
            } : t
          ));
        }
        if (isSuccessManager) {
          setTrainees((prev: any[]) => prev.map(t => 
            t.id === traineeId ? { 
              ...t, 
              ...progressEdits,
              pillar_4_exam_passed: progressEdits.pillar_4_exam_score >= 90
            } : t
          ));
        }
      } else {
        throw new Error(data?.error || 'Failed to update progress');
      }
    } catch (err: any) {
      toast({ title: 'Error', description: err.message || 'Failed to update trainee progress', variant: 'destructive' });
    }
    setSavingProgress(false);
  };

  // Reusable editable progress inputs component
  const renderProgressEditor = (traineeData: any) => {
    const isEditing = editingProgressFor === traineeData.id;
    
    return (
      <div role="region" aria-label={`Edit pillar progress for ${traineeData.first_name || 'trainee'}`} className="mt-4">
        <div className="flex items-center justify-between mb-3">
          <h5 className="font-semibold text-[#1a365d] flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-[#d4a574]" aria-hidden="true" />
            Update Pillar Progress
          </h5>
          {!isEditing && (
            <Button
              size="sm"
              variant="outline"
              className="border-indigo-300 text-indigo-700 hover:bg-indigo-50"
              onClick={() => startEditingProgress(traineeData)}
              aria-label={`Edit progress numbers for ${traineeData.first_name || 'trainee'}`}
            >
              <Edit3 className="w-3 h-3 mr-1" aria-hidden="true" />
              Edit Numbers
            </Button>
          )}
        </div>
        
        {isEditing ? (
          <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-4 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Pillar 1: Deals Approved */}
              <div>
                <Label htmlFor={`p1-${traineeData.id}`} className="text-xs font-medium text-blue-700 flex items-center gap-1">
                  <Target className="w-3 h-3" aria-hidden="true" />
                  P1: Deals Approved (goal: 3)
                </Label>
                <Input
                  id={`p1-${traineeData.id}`}
                  type="number"
                  min="0"
                  max="99"
                  value={progressEdits.pillar_1_deals_approved}
                  onChange={(e) => setProgressEdits(prev => ({ ...prev, pillar_1_deals_approved: parseInt(e.target.value) || 0 }))}
                  className="mt-1 h-9"
                  aria-label="Deals approved count"
                />
              </div>
              
              {/* Pillar 2: Leads Generated */}
              <div>
                <Label htmlFor={`p2g-${traineeData.id}`} className="text-xs font-medium text-emerald-700 flex items-center gap-1">
                  <TrendingUp className="w-3 h-3" aria-hidden="true" />
                  P2: Leads Generated (goal: 3)
                </Label>
                <Input
                  id={`p2g-${traineeData.id}`}
                  type="number"
                  min="0"
                  max="99"
                  value={progressEdits.pillar_2_leads_generated}
                  onChange={(e) => setProgressEdits(prev => ({ ...prev, pillar_2_leads_generated: parseInt(e.target.value) || 0 }))}
                  className="mt-1 h-9"
                  aria-label="Leads generated count"
                />
              </div>
              
              {/* Pillar 2: Leads Closed */}
              <div>
                <Label htmlFor={`p2c-${traineeData.id}`} className="text-xs font-medium text-emerald-700 flex items-center gap-1">
                  <TrendingUp className="w-3 h-3" aria-hidden="true" />
                  P2: Leads Closed (goal: 2)
                </Label>
                <Input
                  id={`p2c-${traineeData.id}`}
                  type="number"
                  min="0"
                  max="99"
                  value={progressEdits.pillar_2_leads_closed}
                  onChange={(e) => setProgressEdits(prev => ({ ...prev, pillar_2_leads_closed: parseInt(e.target.value) || 0 }))}
                  className="mt-1 h-9"
                  aria-label="Leads closed count"
                />
              </div>
              
              {/* Pillar 3: Full Cycles */}
              <div>
                <Label htmlFor={`p3-${traineeData.id}`} className="text-xs font-medium text-amber-700 flex items-center gap-1">
                  <Users className="w-3 h-3" aria-hidden="true" />
                  P3: Full Cycles (goal: 3)
                </Label>
                <Input
                  id={`p3-${traineeData.id}`}
                  type="number"
                  min="0"
                  max="99"
                  value={progressEdits.pillar_3_full_cycles}
                  onChange={(e) => setProgressEdits(prev => ({ ...prev, pillar_3_full_cycles: parseInt(e.target.value) || 0 }))}
                  className="mt-1 h-9"
                  aria-label="Full cycles completed count"
                />
              </div>
              
              {/* Pillar 4: Exam Score */}
              <div className="sm:col-span-2">
                <Label htmlFor={`p4-${traineeData.id}`} className="text-xs font-medium text-purple-700 flex items-center gap-1">
                  <BookOpen className="w-3 h-3" aria-hidden="true" />
                  P4: Exam Score % (pass: 90+)
                </Label>
                <Input
                  id={`p4-${traineeData.id}`}
                  type="number"
                  min="0"
                  max="100"
                  value={progressEdits.pillar_4_exam_score}
                  onChange={(e) => setProgressEdits(prev => ({ ...prev, pillar_4_exam_score: Math.min(100, parseInt(e.target.value) || 0) }))}
                  className="mt-1 h-9"
                  aria-label="Exam score percentage"
                />
                {progressEdits.pillar_4_exam_score > 0 && progressEdits.pillar_4_exam_score < 90 && (
                  <p className="text-xs text-red-600 mt-1">Score below 90% - exam not passed</p>
                )}
                {progressEdits.pillar_4_exam_score >= 90 && (
                  <p className="text-xs text-green-600 mt-1">Score 90%+ - exam passed!</p>
                )}
              </div>
            </div>
            
            {/* Auto-certification check */}
            {progressEdits.pillar_1_deals_approved >= 3 && 
             progressEdits.pillar_2_leads_generated >= 3 && 
             progressEdits.pillar_2_leads_closed >= 2 && 
             progressEdits.pillar_3_full_cycles >= 3 && 
             progressEdits.pillar_4_exam_score >= 90 && (
              <div className="bg-green-100 border border-green-300 rounded-lg p-3" role="alert">
                <p className="text-sm text-green-800 font-medium flex items-center gap-2">
                  <Award className="w-4 h-4" aria-hidden="true" />
                  All pillars will be complete! Trainee will be auto-certified upon save.
                </p>
              </div>
            )}
            
            <div className="flex gap-2 pt-2">
              <Button
                size="sm"
                className="bg-indigo-600 hover:bg-indigo-700 text-white"
                disabled={savingProgress}
                onClick={() => handleUpdateProgress(traineeData.id)}
                aria-label="Save progress updates"
              >
                {savingProgress ? (
                  <Loader2 className="w-4 h-4 mr-1 animate-spin" aria-hidden="true" />
                ) : (
                  <Save className="w-4 h-4 mr-1" aria-hidden="true" />
                )}
                Update Progress
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setEditingProgressFor(null)}
                disabled={savingProgress}
                aria-label="Cancel progress editing"
              >
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <div className="bg-gray-50 rounded-lg p-3">
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-center">
              <div>
                <p className="text-[10px] text-gray-500 uppercase">Deals</p>
                <p className="text-lg font-bold text-blue-700">{traineeData.pillar_1_deals_approved || 0}<span className="text-xs text-gray-400">/3</span></p>
              </div>
              <div>
                <p className="text-[10px] text-gray-500 uppercase">Leads</p>
                <p className="text-lg font-bold text-emerald-700">{traineeData.pillar_2_leads_generated || 0}<span className="text-xs text-gray-400">/3</span></p>
              </div>
              <div>
                <p className="text-[10px] text-gray-500 uppercase">Closed</p>
                <p className="text-lg font-bold text-emerald-700">{traineeData.pillar_2_leads_closed || 0}<span className="text-xs text-gray-400">/2</span></p>
              </div>
              <div>
                <p className="text-[10px] text-gray-500 uppercase">Cycles</p>
                <p className="text-lg font-bold text-amber-700">{traineeData.pillar_3_full_cycles || 0}<span className="text-xs text-gray-400">/3</span></p>
              </div>
              <div>
                <p className="text-[10px] text-gray-500 uppercase">Exam</p>
                <p className="text-lg font-bold text-purple-700">{traineeData.pillar_4_exam_score || 0}<span className="text-xs text-gray-400">%</span></p>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };


  const getCountdown = () => {
    if (!progress?.certification_deadline) return null;
    const deadline = new Date(progress.certification_deadline);
    const now = new Date();
    const diff = deadline.getTime() - now.getTime();
    if (diff <= 0) return { expired: true, days: 0, hours: 0, minutes: 0 };
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    return { expired: false, days, hours, minutes };
  };

  const getPillarProgress = (pillar: typeof PILLARS[0], data?: any) => {
    const src = data || progress;
    if (!src) return 0;
    if (pillar.number === 1) return Math.min(((src.pillar_1_deals_approved || 0) / 3) * 100, 100);
    if (pillar.number === 2) {
      const leadProg = Math.min((src.pillar_2_leads_generated || 0) / 3, 1) * 60;
      const closeProg = Math.min((src.pillar_2_leads_closed || 0) / 2, 1) * 40;
      return Math.min(leadProg + closeProg, 100);
    }
    if (pillar.number === 3) return Math.min(((src.pillar_3_full_cycles || 0) / 3) * 100, 100);
    if (pillar.number === 4) {
      if (src.pillar_4_exam_passed) return 100;
      if (src.pillar_4_exam_score) return Math.min((src.pillar_4_exam_score / 90) * 100, 100);
      return 0;
    }
    return 0;
  };

  const getPillarComplete = (pillar: typeof PILLARS[0], data?: any) => getPillarProgress(pillar, data) >= 100;

  const getOverallProgress = (data?: any) => {
    return PILLARS.reduce((sum, p) => sum + getPillarProgress(p, data), 0) / 4;
  };

  const getPillarValue = (pillar: typeof PILLARS[0], data?: any) => {
    const src = data || progress;
    if (!src) return '0';
    if (pillar.number === 1) return `${src.pillar_1_deals_approved || 0}/3`;
    if (pillar.number === 2) return `${src.pillar_2_leads_generated || 0}/3 leads, ${src.pillar_2_leads_closed || 0}/2 closed`;
    if (pillar.number === 3) return `${src.pillar_3_full_cycles || 0}/3`;
    if (pillar.number === 4) return src.pillar_4_exam_score ? `${src.pillar_4_exam_score}%` : 'Not taken';
    return '0';
  };

  const getDaysUntilDeadline = (deadline: string | null): number | null => {
    if (!deadline) return null;
    const d = new Date(deadline);
    const now = new Date();
    return Math.max(0, Math.floor((d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
  };

  if (loading) {
    return (
      <div className="flex justify-center py-8" role="status" aria-label="Loading certification progress">
        <Loader2 className="w-6 h-6 animate-spin text-[#d4a574]" aria-hidden="true" />
        <span className="sr-only">Loading certification progress...</span>
      </div>
    );
  }

  // ==================== MENTOR DASHBOARD VIEW ====================
  if (isMentor && !isSuccessManager && !isTrainee) {
    return (
      <div className="space-y-6" role="region" aria-label="Mentor Dashboard">
        {/* Certified Badge */}
        <Card className="border-[#d4a574] bg-gradient-to-br from-[#d4a574]/10 to-[#d4a574]/5">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 bg-gradient-to-br from-[#d4a574] to-[#c49464] rounded-full flex items-center justify-center" aria-hidden="true">
                <Award className="w-7 h-7 text-white" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-[#1a365d]">YP Certified Acquisition Manager</h3>
                <p className="text-sm text-gray-600">You are certified and eligible to mentor trainee AMs</p>
                <Badge className="mt-1 bg-[#d4a574] text-white">Full Commission Rate Active</Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* ==================== UNASSIGNED TRAINEES SECTION ==================== */}
        <Card className="border-amber-300 bg-amber-50/50" role="region" aria-label="Unassigned trainees needing mentors">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg text-amber-900 flex items-center gap-2">
                  <HandHelping className="w-5 h-5 text-amber-600" aria-hidden="true" />
                  Unassigned Trainees
                  {unassignedTrainees.length > 0 && (
                    <Badge className="bg-amber-500 text-white ml-2" aria-label={`${unassignedTrainees.length} trainees need mentors`}>
                      {unassignedTrainees.length}
                    </Badge>
                  )}
                </CardTitle>
                <CardDescription className="text-amber-700">
                  These trainees don't have a mentor yet. Volunteer to guide them through certification.
                </CardDescription>
              </div>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={fetchUnassignedTrainees} 
                disabled={loadingUnassigned}
                aria-label="Refresh unassigned trainees list"
                className="border-amber-300 text-amber-700 hover:bg-amber-100"
              >
                {loadingUnassigned ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" /> : <RefreshCw className="w-4 h-4" aria-hidden="true" />}
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {loadingUnassigned ? (
              <div className="flex justify-center py-6" role="status">
                <Loader2 className="w-5 h-5 animate-spin text-amber-500" aria-hidden="true" />
                <span className="sr-only">Loading unassigned trainees...</span>
              </div>
            ) : unassignedTrainees.length === 0 ? (
              <div className="text-center py-6">
                <CheckCircle className="w-10 h-10 mx-auto text-green-400 mb-2" aria-hidden="true" />
                <p className="text-gray-500 font-medium">All trainees have mentors assigned</p>
                <p className="text-sm text-gray-400 mt-1">Great job! No trainees are waiting for a mentor right now.</p>
              </div>
            ) : (
              <div className="space-y-3" role="list" aria-label="List of unassigned trainees">
                {unassignedTrainees.map(trainee => {
                  const daysLeft = getDaysUntilDeadline(trainee.certification_deadline);
                  const startDate = trainee.trainee_start_date 
                    ? new Date(trainee.trainee_start_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                    : trainee.created_at 
                      ? new Date(trainee.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                      : 'Unknown';
                  const isVolunteering = volunteeringFor === trainee.id;
                  const isUrgent = daysLeft !== null && daysLeft < 30;

                  return (
                    <div 
                      key={trainee.id} 
                      role="listitem"
                      className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-lg border transition-colors ${
                        isUrgent ? 'bg-red-50 border-red-200' : 'bg-white border-amber-200 hover:border-amber-400'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center text-white font-bold text-sm flex-shrink-0" aria-hidden="true">
                          {trainee.first_name?.[0]}{trainee.last_name?.[0]}
                        </div>
                        <div>
                          <h4 className="font-semibold text-gray-900">
                            {trainee.first_name} {trainee.last_name}
                          </h4>
                          <p className="text-sm text-gray-500">{trainee.email}</p>
                          <div className="flex flex-wrap gap-2 mt-1">
                            <Badge variant="outline" className="text-xs">
                              <Calendar className="w-3 h-3 mr-1" aria-hidden="true" />
                              Started: {startDate}
                            </Badge>
                            {daysLeft !== null && (
                              <Badge 
                                variant="outline" 
                                className={`text-xs ${isUrgent ? 'border-red-400 text-red-700 bg-red-50' : 'border-amber-400 text-amber-700'}`}
                              >
                                <Timer className="w-3 h-3 mr-1" aria-hidden="true" />
                                {daysLeft === 0 ? 'Deadline today!' : `${daysLeft} days until deadline`}
                              </Badge>
                            )}
                            {isUrgent && (
                              <Badge className="bg-red-500 text-white text-xs">
                                <AlertTriangle className="w-3 h-3 mr-1" aria-hidden="true" />
                                Urgent
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>
                      <Button
                        className="bg-[#d4a574] hover:bg-[#c49464] text-white flex-shrink-0"
                        disabled={isVolunteering}
                        onClick={() => handleVolunteerAsMentor(trainee.id)}
                        aria-label={`Volunteer as mentor for ${trainee.first_name} ${trainee.last_name}`}
                      >
                        {isVolunteering ? (
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" aria-hidden="true" />
                        ) : (
                          <UserPlus className="w-4 h-4 mr-2" aria-hidden="true" />
                        )}
                        {isVolunteering ? 'Assigning...' : 'Volunteer as Mentor'}
                      </Button>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Mentor Dashboard Header */}
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-bold text-[#1a365d] flex items-center gap-2">
              <UserCheck className="w-5 h-5 text-[#d4a574]" aria-hidden="true" />
              My Trainees
            </h3>
            <p className="text-sm text-gray-500">
              {mentorTrainees.length} trainee{mentorTrainees.length !== 1 ? 's' : ''} assigned to you
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={() => { fetchMentorTrainees(); fetchUnassignedTrainees(); }} disabled={loadingMentorData} aria-label="Refresh trainee list">
            {loadingMentorData ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" /> : <RefreshCw className="w-4 h-4 mr-2" aria-hidden="true" />}
            Refresh
          </Button>
        </div>

        {loadingMentorData ? (
          <div className="flex justify-center py-8" role="status">
            <Loader2 className="w-6 h-6 animate-spin text-[#d4a574]" aria-hidden="true" />
            <span className="sr-only">Loading your trainees...</span>
          </div>
        ) : mentorTrainees.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Users className="w-12 h-12 mx-auto text-gray-300 mb-4" aria-hidden="true" />
              <p className="text-gray-500 font-medium">No trainees assigned to you yet</p>
              <p className="text-sm text-gray-400 mt-1">
                {unassignedTrainees.length > 0 
                  ? 'Check the Unassigned Trainees section above to volunteer as a mentor.'
                  : 'When a Success Manager assigns trainees to you, they will appear here.'}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4" role="list" aria-label="Your assigned trainees">
            {mentorTrainees.map(trainee => {
              const overall = getOverallProgress(trainee);
              const deadline = trainee.certification_deadline ? new Date(trainee.certification_deadline) : null;
              const now = new Date();
              const daysLeft = deadline ? Math.max(0, Math.floor((deadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))) : 0;
              const isExpired = deadline ? deadline.getTime() < now.getTime() : false;
              const isExpanded = expandedTrainee === trainee.id;
              const traineeCommLog = commLog.filter(l => l.trainee_id === trainee.id);

              return (
                <Card key={trainee.id} role="listitem" className={`transition-all ${isExpired ? 'border-red-300 bg-red-50/30' : 'hover:shadow-lg'}`}>
                  <CardContent className="pt-4">
                    {/* Trainee Header */}
                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                      <div className="flex items-start gap-4">
                        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#1a365d] to-[#2d4a7c] flex items-center justify-center text-white font-bold" aria-hidden="true">
                          {trainee.first_name?.[0]}{trainee.last_name?.[0]}
                        </div>
                        <div>
                          <h4 className="font-semibold text-lg">{trainee.first_name} {trainee.last_name}</h4>
                          <p className="text-sm text-gray-500">{trainee.email}</p>
                          <div className="flex flex-wrap gap-2 mt-1">
                            <Badge variant="outline" className={`text-xs ${isExpired ? 'border-red-500 text-red-700' : daysLeft < 30 ? 'border-amber-500 text-amber-700' : ''}`}>
                              <Timer className="w-3 h-3 mr-1" aria-hidden="true" />
                              {isExpired ? 'EXPIRED' : `${daysLeft} days left`}
                            </Badge>
                            <Badge variant="outline" className="text-xs">50/50 Split</Badge>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <p className="text-xs text-gray-500">Overall Progress</p>
                          <p className="text-lg font-bold text-[#1a365d]" aria-label={`${Math.round(overall)} percent complete`}>{Math.round(overall)}%</p>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setExpandedTrainee(isExpanded ? null : trainee.id)}
                          aria-expanded={isExpanded}
                          aria-label={`${isExpanded ? 'Collapse' : 'Expand'} details for ${trainee.first_name} ${trainee.last_name}`}
                        >
                          {isExpanded ? <ChevronUp className="w-5 h-5" aria-hidden="true" /> : <ChevronDown className="w-5 h-5" aria-hidden="true" />}
                        </Button>
                      </div>
                    </div>

                    {/* Mini Pillar Progress */}
                    <div className="grid grid-cols-4 gap-3 mt-4" role="list" aria-label="Pillar progress">
                      {PILLARS.map(pillar => {
                        const prog = getPillarProgress(pillar, trainee);
                        const complete = prog >= 100;
                        const colors = ['bg-blue-500', 'bg-emerald-500', 'bg-amber-500', 'bg-purple-500'];
                        return (
                          <div key={pillar.number} className="text-center" role="listitem">
                            <div className="text-xs text-gray-500 mb-1">{pillar.name}</div>
                            <div className="h-2 bg-gray-200 rounded-full overflow-hidden" role="progressbar" aria-valuenow={Math.round(prog)} aria-valuemin={0} aria-valuemax={100} aria-label={`${pillar.name}: ${Math.round(prog)}%`}>
                              <div className={`h-full ${colors[pillar.number - 1]} rounded-full transition-all`} style={{ width: `${prog}%` }} />
                            </div>
                            <div className="text-xs font-medium mt-1">
                              {complete ? (
                                <span className="text-green-600 flex items-center justify-center gap-1">
                                  <CheckCircle className="w-3 h-3" aria-hidden="true" /> Done
                                </span>
                              ) : `${Math.round(prog)}%`}
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Expanded: Task Verification + Notes */}
                    {isExpanded && (
                      <div className="mt-6 border-t pt-6 space-y-6">
                        {/* Trainee Progress Notes */}
                        <div role="region" aria-label={`Progress notes for ${trainee.first_name}`}>
                          <h5 className="font-semibold text-[#1a365d] flex items-center gap-2 mb-3">
                            <Edit3 className="w-4 h-4 text-[#d4a574]" aria-hidden="true" />
                            Progress Notes
                          </h5>
                          {editingTraineeNotes === trainee.id ? (
                            <div className="space-y-2">
                              <Textarea
                                value={traineeNotesText}
                                onChange={(e) => setTraineeNotesText(e.target.value)}
                                placeholder="Write persistent progress notes about this trainee..."
                                rows={3}
                                aria-label={`Progress notes for ${trainee.first_name} ${trainee.last_name}`}
                              />
                              <div className="flex gap-2">
                                <Button
                                  size="sm"
                                  className="bg-green-600 hover:bg-green-700"
                                  disabled={savingTraineeNotes}
                                  onClick={() => handleSaveTraineeNotes(trainee.id)}
                                  aria-label="Save progress notes"
                                >
                                  {savingTraineeNotes ? <Loader2 className="w-4 h-4 mr-1 animate-spin" aria-hidden="true" /> : <Save className="w-4 h-4 mr-1" aria-hidden="true" />}
                                  Save
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => setEditingTraineeNotes(null)}
                                  aria-label="Cancel editing notes"
                                >
                                  Cancel
                                </Button>
                              </div>
                            </div>
                          ) : (
                            <div 
                              className="p-3 bg-gray-50 rounded-lg cursor-pointer hover:bg-gray-100 transition-colors"
                              onClick={() => {
                                setEditingTraineeNotes(trainee.id);
                                setTraineeNotesText(trainee.trainee_notes || '');
                              }}
                              role="button"
                              tabIndex={0}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' || e.key === ' ') {
                                  e.preventDefault();
                                  setEditingTraineeNotes(trainee.id);
                                  setTraineeNotesText(trainee.trainee_notes || '');
                                }
                              }}
                              aria-label={`Click to edit progress notes for ${trainee.first_name}. ${trainee.trainee_notes ? `Current notes: ${trainee.trainee_notes}` : 'No notes yet.'}`}
                            >
                              {trainee.trainee_notes ? (
                                <p className="text-sm text-gray-700 whitespace-pre-wrap">{trainee.trainee_notes}</p>
                              ) : (
                                <p className="text-sm text-gray-400 italic">Click to add progress notes...</p>
                              )}
                            </div>
                          )}
                        </div>

                        {/* Editable Pillar Progress (Mentor) */}
                        {renderProgressEditor(trainee)}


                        {/* Task Verification Section */}
                        <div role="region" aria-label={`Certification tasks for ${trainee.first_name}`}>
                          <h5 className="font-semibold text-[#1a365d] flex items-center gap-2 mb-3">
                            <ClipboardCheck className="w-4 h-4 text-[#d4a574]" aria-hidden="true" />
                            Certification Tasks - Verify & Approve
                          </h5>
                          <div className="space-y-2">
                            {PILLARS.map(pillar => {
                              const pillarTasks = trainee.tasks.filter(t => t.pillar_number === pillar.number);
                              if (pillarTasks.length === 0) return null;
                              return (
                                <div key={pillar.number} className="space-y-1">
                                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mt-3 mb-1" id={`pillar-${pillar.number}-${trainee.id}`}>
                                    Pillar {pillar.number}: {pillar.name}
                                  </p>
                                  <div role="list" aria-labelledby={`pillar-${pillar.number}-${trainee.id}`}>
                                    {pillarTasks.map(task => (
                                      <div key={task.id} role="listitem" className={`flex items-center justify-between p-3 rounded-lg border ${task.completed ? 'bg-green-50 border-green-200' : 'bg-white border-gray-200 hover:border-[#d4a574]'}`}>
                                        <div className="flex items-start gap-3">
                                          {task.completed ? (
                                            <CheckCircle className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" aria-label="Completed" />
                                          ) : (
                                            <div className="w-5 h-5 border-2 border-gray-300 rounded-full mt-0.5 flex-shrink-0" aria-label="Not completed" />
                                          )}
                                          <div>
                                            <p className={`text-sm ${task.completed ? 'text-green-700 line-through' : 'text-gray-700'}`}>
                                              {task.task_description}
                                            </p>
                                            {task.completed_at && (
                                              <p className="text-[10px] text-gray-400 mt-0.5">
                                                Verified {new Date(task.completed_at).toLocaleDateString()}
                                                {task.verified_by_name && ` by ${task.verified_by_name}`}
                                                {task.notes && ` - "${task.notes}"`}
                                              </p>
                                            )}
                                          </div>
                                        </div>
                                        {!task.completed && (
                                          <Button
                                            size="sm"
                                            className="bg-[#d4a574] hover:bg-[#c49464] h-8 px-3 text-xs"
                                            onClick={() => {
                                              setSelectedTask(task);
                                              setSelectedTaskTraineeId(trainee.id);
                                              setVerifyNotes('');
                                              setExamScore('');
                                              setShowVerifyModal(true);
                                            }}
                                            aria-label={`Verify task: ${task.task_description}`}
                                          >
                                            <CheckCircle className="w-3 h-3 mr-1" aria-hidden="true" />
                                            Verify
                                          </Button>
                                        )}
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>

                        {/* Add Mentor Note */}
                        <div role="region" aria-label={`Communication notes for ${trainee.first_name}`}>
                          <h5 className="font-semibold text-[#1a365d] flex items-center gap-2 mb-3">
                            <MessageSquare className="w-4 h-4 text-[#d4a574]" aria-hidden="true" />
                            Mentor Notes
                          </h5>
                          <div className="flex gap-2">
                            <Textarea
                              placeholder="Add a note about this trainee's progress, feedback, or next steps..."
                              value={mentorNoteTraineeId === trainee.id ? mentorNote : ''}
                              onChange={(e) => {
                                setMentorNote(e.target.value);
                                setMentorNoteTraineeId(trainee.id);
                              }}
                              rows={2}
                              className="flex-1"
                              aria-label={`Add mentor note for ${trainee.first_name} ${trainee.last_name}`}
                            />
                            <Button
                              className="bg-[#d4a574] hover:bg-[#c49464] self-end"
                              disabled={addingNote || !mentorNote.trim() || mentorNoteTraineeId !== trainee.id}
                              onClick={() => handleAddMentorNote(trainee.id)}
                              aria-label="Send mentor note"
                            >
                              {addingNote ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" /> : <Send className="w-4 h-4" aria-hidden="true" />}
                            </Button>
                          </div>
                        </div>

                        {/* Communication Log */}
                        <div role="region" aria-label={`Communication log for ${trainee.first_name}`}>
                          <div className="flex items-center justify-between mb-3">
                            <h5 className="font-semibold text-[#1a365d] flex items-center gap-2">
                              <FileText className="w-4 h-4 text-[#d4a574]" aria-hidden="true" />
                              Communication Log
                            </h5>
                            <Badge variant="outline" className="text-xs">{traineeCommLog.length} entries</Badge>
                          </div>
                          {traineeCommLog.length === 0 ? (
                            <p className="text-sm text-gray-400 text-center py-4">No communication log entries yet</p>
                          ) : (
                            <div className="space-y-2 max-h-60 overflow-y-auto" role="log" aria-label="Communication entries">
                              {traineeCommLog.slice(0, 10).map(entry => (
                                <div key={entry.id} className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg text-sm">
                                  <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${
                                    entry.message_type === 'task_verification' ? 'bg-green-100' : 'bg-blue-100'
                                  }`} aria-hidden="true">
                                    {entry.message_type === 'task_verification' ? (
                                      <CheckCircle className="w-3 h-3 text-green-600" />
                                    ) : (
                                      <MessageSquare className="w-3 h-3 text-blue-600" />
                                    )}
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-0.5">
                                      <span className="font-medium text-gray-700">{entry.mentor_name}</span>
                                      <Badge variant="outline" className="text-[10px] h-4 px-1">
                                        {entry.message_type === 'task_verification' ? 'Verification' : 'Note'}
                                      </Badge>
                                    </div>
                                    <p className="text-gray-600">{entry.message}</p>
                                    <p className="text-[10px] text-gray-400 mt-1">
                                      {new Date(entry.created_at).toLocaleString()}
                                    </p>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {/* Task Verification Modal */}
        <Dialog open={showVerifyModal} onOpenChange={setShowVerifyModal}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <ClipboardCheck className="w-5 h-5 text-[#d4a574]" aria-hidden="true" />
                Verify Certification Task
              </DialogTitle>
              <DialogDescription>
                Confirm that this trainee has completed this task. Your verification will be recorded.
              </DialogDescription>
            </DialogHeader>
            {selectedTask && (
              <div className="space-y-4">
                <div className="bg-gray-50 p-4 rounded-lg">
                  <p className="font-medium text-sm">{selectedTask.task_description}</p>
                  <p className="text-xs text-gray-500 mt-1">Pillar {selectedTask.pillar_number}: {selectedTask.pillar_name}</p>
                </div>

                {selectedTask.task_type === 'exam' && (
                  <div>
                    <Label htmlFor="exam-score">Exam Score (%) *</Label>
                    <Input
                      id="exam-score"
                      type="number"
                      min="0"
                      max="100"
                      value={examScore}
                      onChange={(e) => setExamScore(e.target.value)}
                      placeholder="Enter score (90+ to pass)"
                      aria-describedby={examScore && parseInt(examScore) < 90 ? 'exam-score-error' : undefined}
                    />
                    {examScore && parseInt(examScore) < 90 && (
                      <p id="exam-score-error" className="text-xs text-red-600 mt-1" role="alert">Score must be 90% or higher to pass</p>
                    )}
                  </div>
                )}

                <div>
                  <Label htmlFor="verify-notes">Verification Notes (optional)</Label>
                  <Textarea
                    id="verify-notes"
                    value={verifyNotes}
                    onChange={(e) => setVerifyNotes(e.target.value)}
                    placeholder="Add notes about the verification (e.g., deal details, lead info, exam observations)..."
                    rows={3}
                  />
                </div>
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowVerifyModal(false)}>Cancel</Button>
              <Button
                className="bg-green-600 hover:bg-green-700"
                disabled={verifyingTask !== null || (selectedTask?.task_type === 'exam' && (!examScore || parseInt(examScore) < 90))}
                onClick={handleMentorVerifyTask}
                aria-label="Confirm task verification"
              >
                {verifyingTask ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" aria-hidden="true" />
                ) : (
                  <CheckCircle className="w-4 h-4 mr-2" aria-hidden="true" />
                )}
                Verify & Approve
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  // ==================== SUCCESS MANAGER VIEW ====================
  if (isSuccessManager && !isTrainee) {
    return (
      <div className="space-y-6" role="region" aria-label="AM Certification Tracker for Success Managers">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-bold text-[#1a365d] flex items-center gap-2">
              <Award className="w-5 h-5 text-[#d4a574]" aria-hidden="true" />
              AM Certification Tracker
            </h3>
            <p className="text-sm text-gray-500">Manage trainee AMs and their certification progress</p>
          </div>
          <Button variant="outline" size="sm" onClick={() => { fetchTrainees(); fetchCertifiedAMs(); }} aria-label="Refresh certification data">
            <RefreshCw className="w-4 h-4 mr-2" aria-hidden="true" />
            Refresh
          </Button>
        </div>

        {/* Certified AMs available as mentors */}
        <Card className="border-[#d4a574] bg-[#d4a574]/5" role="region" aria-label="Available certified mentors">
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 mb-2">
              <Shield className="w-4 h-4 text-[#d4a574]" aria-hidden="true" />
              <span className="font-medium text-sm text-[#1a365d]">
                {certifiedAMs.length} Certified AM{certifiedAMs.length !== 1 ? 's' : ''} Available as Mentors
              </span>
            </div>
            <div className="flex flex-wrap gap-2" role="list" aria-label="Certified acquisition managers">
              {certifiedAMs.map(am => (
                <Badge key={am.id} className="bg-[#d4a574] text-white" role="listitem">
                  <Award className="w-3 h-3 mr-1" aria-hidden="true" />
                  {am.first_name} {am.last_name}
                </Badge>
              ))}
              {certifiedAMs.length === 0 && (
                <span className="text-sm text-gray-500">No certified AMs yet. Manually certify AMs in Staff Management.</span>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Trainee list */}
        {trainees.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center">
              <Users className="w-12 h-12 mx-auto text-gray-300 mb-4" aria-hidden="true" />
              <p className="text-gray-500">No trainee AMs currently active</p>
              <p className="text-sm text-gray-400 mt-1">New AMs added with the Acquisition Manager role will appear here automatically</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4" role="list" aria-label="Trainee acquisition managers">
            {trainees.map((trainee: any) => {
              const deadline = trainee.certification_deadline ? new Date(trainee.certification_deadline) : null;
              const now = new Date();
              const daysLeft = deadline ? Math.max(0, Math.floor((deadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))) : 0;
              const isExpired = deadline ? deadline.getTime() < now.getTime() : false;
              const p1 = Math.min((trainee.pillar_1_deals_approved || 0) / 3 * 100, 100);
              const p2leads = Math.min((trainee.pillar_2_leads_generated || 0) / 3, 1) * 60;
              const p2close = Math.min((trainee.pillar_2_leads_closed || 0) / 2, 1) * 40;
              const p2 = Math.min(p2leads + p2close, 100);
              const p3 = Math.min((trainee.pillar_3_full_cycles || 0) / 3 * 100, 100);
              const p4 = trainee.pillar_4_exam_passed ? 100 : 0;
              const overall = (p1 + p2 + p3 + p4) / 4;

              return (
                <Card key={trainee.id} role="listitem" className={`${isExpired ? 'border-red-300 bg-red-50/50' : ''}`}>
                  <CardContent className="pt-4">
                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                      <div className="flex items-start gap-4">
                        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#1a365d] to-[#2d4a7c] flex items-center justify-center text-white font-bold" aria-hidden="true">
                          {trainee.first_name?.[0]}{trainee.last_name?.[0]}
                        </div>
                        <div>
                          <h4 className="font-semibold">{trainee.first_name} {trainee.last_name}</h4>
                          <p className="text-sm text-gray-500">{trainee.email}</p>
                          <div className="flex flex-wrap gap-2 mt-1">
                            <Badge variant="outline" className="text-xs">
                              <Timer className="w-3 h-3 mr-1" aria-hidden="true" />
                              {isExpired ? 'EXPIRED' : `${daysLeft} days left`}
                            </Badge>
                            <Badge variant="outline" className="text-xs">50/50 Split</Badge>
                            {trainee.assigned_mentor_name ? (
                              <Badge className="bg-green-100 text-green-800 text-xs">
                                <UserCheck className="w-3 h-3 mr-1" aria-hidden="true" />
                                Mentor: {trainee.assigned_mentor_name}
                              </Badge>
                            ) : (
                              <Badge className="bg-red-100 text-red-800 text-xs">
                                <AlertTriangle className="w-3 h-3 mr-1" aria-hidden="true" />
                                No Mentor Assigned
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex flex-col gap-2">
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-gray-500 w-16">Overall:</span>
                          <Progress value={overall} className="h-2 flex-1 min-w-[120px]" aria-label={`Overall progress: ${Math.round(overall)}%`} />
                          <span className="text-xs font-medium w-10 text-right">{Math.round(overall)}%</span>
                        </div>
                        <div className="flex gap-2 flex-wrap">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setSelectedTraineeId(trainee.id);
                              setShowMentorModal(true);
                            }}
                            aria-label={`${trainee.assigned_mentor_name ? 'Change' : 'Assign'} mentor for ${trainee.first_name} ${trainee.last_name}`}
                          >
                            <UserCheck className="w-3 h-3 mr-1" aria-hidden="true" />
                            {trainee.assigned_mentor_name ? 'Change Mentor' : 'Assign Mentor'}
                          </Button>
                          {!trainee.welcome_email_sent && (
                            <Button
                              size="sm"
                              className="bg-[#d4a574] hover:bg-[#c49464]"
                              disabled={processing}
                              onClick={() => sendWelcomeEmail(
                                trainee.id,
                                `${trainee.first_name} ${trainee.last_name}`,
                                trainee.email,
                                trainee.assigned_mentor_name || 'TBD',
                                trainee.assigned_mentor_id || ''
                              )}
                              aria-label={`Send welcome email to ${trainee.first_name} ${trainee.last_name}`}
                            >
                              <Send className="w-3 h-3 mr-1" aria-hidden="true" />
                              Send Welcome
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Mini pillar progress */}
                    <div className="grid grid-cols-4 gap-3 mt-4" role="list" aria-label="Pillar progress">
                      {[
                        { name: 'Market', val: p1, color: 'bg-blue-500' },
                        { name: 'Rainmaker', val: p2, color: 'bg-emerald-500' },
                        { name: 'Consultant', val: p3, color: 'bg-amber-500' },
                        { name: 'Technical', val: p4, color: 'bg-purple-500' }
                      ].map((p, i) => (
                        <div key={i} className="text-center" role="listitem">
                          <div className="text-xs text-gray-500 mb-1">{p.name}</div>
                          <div className="h-2 bg-gray-200 rounded-full overflow-hidden" role="progressbar" aria-valuenow={Math.round(p.val)} aria-valuemin={0} aria-valuemax={100} aria-label={`${p.name}: ${Math.round(p.val)}%`}>
                            <div className={`h-full ${p.color} rounded-full transition-all`} style={{ width: `${p.val}%` }} />
                          </div>
                          <div className="text-xs font-medium mt-1">
                            {p.val >= 100 ? (
                               <span className="text-green-600 flex items-center justify-center gap-1">
                                 <CheckCircle className="w-3 h-3" aria-hidden="true" /> Done
                               </span>
                             ) : `${Math.round(p.val)}%`}
                           </div>
                         </div>
                       ))}
                     </div>


                    {/* Editable Pillar Progress (Success Manager) */}
                    <div className="mt-3">
                      <Button
                        size="sm"
                        variant="outline"
                        className="w-full border-indigo-200 text-indigo-700 hover:bg-indigo-50 mb-2"
                        onClick={() => setSmExpandedTrainee(smExpandedTrainee === trainee.id ? null : trainee.id)}
                      >
                        <BarChart3 className="w-3 h-3 mr-1" />
                        {smExpandedTrainee === trainee.id ? 'Hide Progress Editor' : 'Edit Progress Numbers'}
                        {smExpandedTrainee === trainee.id ? <ChevronUp className="w-3 h-3 ml-1" /> : <ChevronDown className="w-3 h-3 ml-1" />}
                      </Button>
                      {smExpandedTrainee === trainee.id && renderProgressEditor(trainee)}
                    </div>

                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {/* Mentor Assignment Modal */}
        <Dialog open={showMentorModal} onOpenChange={setShowMentorModal}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <UserCheck className="w-5 h-5 text-[#d4a574]" aria-hidden="true" />
                Assign Certified Mentor
              </DialogTitle>
              <DialogDescription>
                Select a YP Certified Acquisition Manager to mentor this trainee. The mentor will oversee all deals and transactions during the shadow phase.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="mentor-select">Select Certified AM</Label>
                <Select value={selectedMentorId} onValueChange={setSelectedMentorId}>
                  <SelectTrigger id="mentor-select" aria-label="Choose a certified AM as mentor">
                    <SelectValue placeholder="Choose a certified AM..." />
                  </SelectTrigger>
                  <SelectContent>
                    {certifiedAMs.map(am => (
                      <SelectItem key={am.id} value={am.id}>
                        <div className="flex items-center gap-2">
                          <Award className="w-4 h-4 text-[#d4a574]" aria-hidden="true" />
                          {am.first_name} {am.last_name}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {certifiedAMs.length === 0 && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3" role="alert">
                  <p className="text-sm text-amber-800">
                    <AlertTriangle className="w-4 h-4 inline mr-1" aria-hidden="true" />
                    No certified AMs available. You need to manually certify an AM first in Staff Management by uploading and verifying their certification.
                  </p>
                </div>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowMentorModal(false)}>Cancel</Button>
              <Button
                className="bg-[#d4a574] hover:bg-[#c49464]"
                disabled={!selectedMentorId || processing}
                onClick={() => assignMentor(selectedTraineeId, selectedMentorId)}
                aria-label="Confirm mentor assignment"
              >
                {processing && <Loader2 className="w-4 h-4 mr-2 animate-spin" aria-hidden="true" />}
                Assign Mentor
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  // ==================== TRAINEE'S OWN VIEW ====================
  if (!progress || !progress.trainee_status) {
    return null;
  }

  if (progress.yp_certified || progress.trainee_status === 'certified') {
    return (
      <Card className="border-[#d4a574] bg-gradient-to-br from-[#d4a574]/10 to-[#d4a574]/5" role="region" aria-label="Certification status">
        <CardContent className="pt-6 text-center">
          <div className="w-16 h-16 mx-auto bg-gradient-to-br from-[#d4a574] to-[#c49464] rounded-full flex items-center justify-center mb-4" aria-hidden="true">
            <Award className="w-8 h-8 text-white" />
          </div>
          <h3 className="text-xl font-bold text-[#1a365d]">YP Certified Acquisition Manager</h3>
          <p className="text-gray-600 mt-2">Congratulations! You've completed all 4 Pillars of Excellence.</p>
          <Badge className="mt-3 bg-[#d4a574] text-white text-sm px-4 py-1">
            Full Commission Rate Active
          </Badge>
        </CardContent>
      </Card>
    );
  }

  const countdown = getCountdown();
  const overall = getOverallProgress();

  return (
    <div className="space-y-6" role="region" aria-label="Your certification progress">
      {/* Header Banner */}
      <Card className="bg-gradient-to-r from-[#0f172a] to-[#1e3a5f] text-white border-none overflow-hidden">
        <CardContent className="pt-6 pb-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h3 className="text-xl font-bold flex items-center gap-2">
                <Target className="w-6 h-6 text-[#f59e0b]" aria-hidden="true" />
                Your Path to YP Certification
              </h3>
              <p className="text-gray-300 mt-1 text-sm">
                Complete all 4 Pillars of Excellence to earn your certification
              </p>
              {progress.assigned_mentor_name && (
                <div className="flex items-center gap-2 mt-2">
                  <UserCheck className="w-4 h-4 text-[#f59e0b]" aria-hidden="true" />
                  <span className="text-sm text-gray-300">
                    Mentor: <strong className="text-[#f59e0b]">{progress.assigned_mentor_name}</strong>
                  </span>
                </div>
              )}
              <div className="flex items-center gap-2 mt-1">
                <Zap className="w-4 h-4 text-[#f59e0b]" aria-hidden="true" />
                <span className="text-sm text-gray-300">
                  Commission: <strong className="text-[#f59e0b]">50/50 split</strong> during training
                </span>
              </div>
            </div>

            {/* Countdown */}
            {countdown && (
              <div className={`text-center p-4 rounded-xl ${countdown.expired ? 'bg-red-900/50 border border-red-500' : countdown.days < 30 ? 'bg-amber-900/50 border border-amber-500' : 'bg-white/10 border border-white/20'}`} role="timer" aria-label={countdown.expired ? 'Certification deadline has expired' : `${countdown.days} days, ${countdown.hours} hours, ${countdown.minutes} minutes remaining`}>
                {countdown.expired ? (
                  <div>
                    <XCircle className="w-8 h-8 mx-auto text-red-400 mb-1" aria-hidden="true" />
                    <p className="text-red-300 font-bold text-sm">DEADLINE EXPIRED</p>
                    <p className="text-red-400 text-xs">Contact Success Team</p>
                  </div>
                ) : (
                  <div>
                    <div className="flex items-center justify-center gap-3">
                      <div className="text-center">
                        <p className="text-2xl font-bold text-white">{countdown.days}</p>
                        <p className="text-[10px] text-gray-400 uppercase">Days</p>
                      </div>
                      <span className="text-gray-500 text-xl" aria-hidden="true">:</span>
                      <div className="text-center">
                        <p className="text-2xl font-bold text-white">{countdown.hours}</p>
                        <p className="text-[10px] text-gray-400 uppercase">Hours</p>
                      </div>
                      <span className="text-gray-500 text-xl" aria-hidden="true">:</span>
                      <div className="text-center">
                        <p className="text-2xl font-bold text-white">{countdown.minutes}</p>
                        <p className="text-[10px] text-gray-400 uppercase">Min</p>
                      </div>
                    </div>
                    <p className="text-[10px] text-gray-400 mt-2">
                      Deadline: {new Date(progress.certification_deadline).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Overall Progress */}
          <div className="mt-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-gray-300">Overall Certification Progress</span>
              <span className="text-sm font-bold text-[#f59e0b]">{Math.round(overall)}%</span>
            </div>
            <div className="h-3 bg-white/10 rounded-full overflow-hidden" role="progressbar" aria-valuenow={Math.round(overall)} aria-valuemin={0} aria-valuemax={100} aria-label={`Overall certification progress: ${Math.round(overall)}%`}>
              <div
                className="h-full bg-gradient-to-r from-[#f59e0b] to-[#d97706] rounded-full transition-all duration-1000"
                style={{ width: `${overall}%` }}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 4 Pillars Grid */}
      <div className="grid md:grid-cols-2 gap-4" role="list" aria-label="Certification pillars">
        {PILLARS.map(pillar => {
          const prog = getPillarProgress(pillar);
          const complete = getPillarComplete(pillar);
          const Icon = pillar.icon;
          const pillarTasks = tasks.filter(t => t.pillar_number === pillar.number);

          return (
            <Card key={pillar.number} role="listitem" className={`${complete ? 'border-green-400 bg-green-50/50' : pillar.borderColor} transition-all hover:shadow-lg`}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${pillar.bgGradient} flex items-center justify-center`} aria-hidden="true">
                      {complete ? (
                        <CheckCircle className="w-5 h-5 text-white" />
                      ) : (
                        <Icon className="w-5 h-5 text-white" />
                      )}
                    </div>
                    <div>
                      <CardTitle className="text-base">
                        Pillar {pillar.number}: {pillar.name}
                      </CardTitle>
                      <CardDescription className="text-xs">{pillar.subtitle}</CardDescription>
                    </div>
                  </div>
                  {complete ? (
                    <Badge className="bg-green-500 text-white">Complete</Badge>
                  ) : (
                    <Badge variant="outline" className={pillar.textColor}>{Math.round(prog)}%</Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <Progress value={prog} className="h-2 mb-3" aria-label={`Pillar ${pillar.number} progress: ${Math.round(prog)}%`} />
                <p className="text-xs text-gray-500 mb-3">{pillar.requirement}</p>
                <p className="text-sm font-medium mb-3">{getPillarValue(pillar)}</p>

                {/* Task checklist */}
                {pillarTasks.length > 0 && (
                  <div className="space-y-2" role="list" aria-label={`Tasks for Pillar ${pillar.number}`}>
                    {pillarTasks.map(task => (
                      <div key={task.id} role="listitem" className={`flex items-start gap-2 text-xs p-2 rounded ${task.completed ? 'bg-green-50' : 'bg-gray-50'}`}>
                        {task.completed ? (
                          <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" aria-label="Completed" />
                        ) : (
                          <div className="w-4 h-4 border-2 border-gray-300 rounded-full mt-0.5 flex-shrink-0" aria-label="Not completed" />
                        )}
                        <div>
                          <p className={task.completed ? 'text-green-700 line-through' : 'text-gray-700'}>
                            {task.task_description}
                          </p>
                          {task.completed_at && (
                            <p className="text-gray-400 text-[10px] mt-0.5">
                              Completed {new Date(task.completed_at).toLocaleDateString()}
                              {task.verified_by_name && ` - Verified by ${task.verified_by_name}`}
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Warning if deadline approaching */}
      {countdown && !countdown.expired && countdown.days < 30 && (
        <Card className="border-red-300 bg-red-50" role="alert">
          <CardContent className="pt-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" aria-hidden="true" />
              <div>
                <h4 className="font-semibold text-red-800">Certification Deadline Approaching</h4>
                <p className="text-sm text-red-700 mt-1">
                  You have <strong>{countdown.days} days</strong> remaining to complete all 4 Pillars. 
                  Failure to certify will result in dashboard access revocation and a 3-6 month cooling-off period.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
