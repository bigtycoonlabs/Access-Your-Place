import { useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';
import {
  Play, CheckCircle, XCircle, Clock, RefreshCw, AlertTriangle,
  Server, Shield, ChevronDown, ChevronUp, Zap, Activity,
  Copy, Wrench, Search, Trash2
} from 'lucide-react';


// ─── Types ────────────────────────────────────────────────────────────────────

interface TestResult {
  id: string;
  functionName: string;
  action: string;
  status: 'pending' | 'running' | 'pass' | 'fail' | 'warn';
  responseTime: number;
  httpStatus?: number;
  responsePreview?: string;
  error?: string;
  expectedFormat?: string;
  actualFormat?: string;
  timestamp: string;
}

interface FunctionAuditEntry {
  name: string;
  status: 'fixed' | 'vulnerable' | 'unknown' | 'no-db';
  description: string;
  usesCreateClient: boolean;
  usesDirectREST: boolean;
  hasRLS: boolean;
  priority: 'critical' | 'high' | 'medium' | 'low';
  lastTested?: string;
  notes?: string;
  version?: string;
}

interface CleanupResult {
  running: boolean;
  result: any | null;
  error: string | null;
}

// ─── Test Definitions ─────────────────────────────────────────────────────────

interface TestDefinition {
  id: string;
  functionName: string;
  action: string;
  body: Record<string, any>;
  expectedFields: string[];
  description: string;
  category: 'leads' | 'landlord' | 'staff' | 'investor' | 'deals' | 'marketplace' | 'crm' | 'ai' | 'analytics' | 'other';
}

const TEST_DEFINITIONS: TestDefinition[] = [

  // ── get-leads ──
  {
    id: 'leads-basic',
    functionName: 'get-leads',
    action: 'get_all',
    body: {},
    expectedFields: ['success', 'leads'],
    description: 'Fetch all leads (basic invocation)',
    category: 'leads',
  },
  // ── manage-landlord-portal ──
  {
    id: 'landlord-applications',
    functionName: 'manage-landlord-portal',
    action: 'get_applications',
    body: { action: 'get_applications' },
    expectedFields: ['applications'],
    description: 'Get all landlord applications',
    category: 'landlord',
  },
  {
    id: 'landlord-all-portal',
    functionName: 'manage-landlord-portal',
    action: 'get_all_portal_landlords',
    body: { action: 'get_all_portal_landlords' },
    expectedFields: ['landlords'],
    description: 'Get all portal-enabled landlords',
    category: 'landlord',
  },
  {
    id: 'landlord-unassigned',
    functionName: 'manage-landlord-portal',
    action: 'get_unassigned_landlords',
    body: { action: 'get_unassigned_landlords' },
    expectedFields: ['landlords'],
    description: 'Get landlords without assigned AM',
    category: 'landlord',
  },
  {
    id: 'landlord-properties',
    functionName: 'manage-landlord-portal',
    action: 'get_landlord_properties',
    body: { action: 'get_landlord_properties' },
    expectedFields: ['properties'],
    description: 'Get all landlord properties',
    category: 'landlord',
  },
  {
    id: 'landlord-documents',
    functionName: 'manage-landlord-portal',
    action: 'get_documents',
    body: { action: 'get_documents' },
    expectedFields: ['documents'],
    description: 'Get landlord documents',
    category: 'landlord',
  },
  {
    id: 'landlord-messages',
    functionName: 'manage-landlord-portal',
    action: 'get_messages',
    body: { action: 'get_messages' },
    expectedFields: ['messages'],
    description: 'Get landlord messages',
    category: 'landlord',
  },
  // ── manage-staff ──
  {
    id: 'staff-list',
    functionName: 'manage-staff',
    action: 'get_staff_list',
    body: { action: 'get_staff_list' },
    expectedFields: ['staff'],
    description: 'Get all staff members',
    category: 'staff',
  },
  {
    id: 'staff-am-requests',
    functionName: 'manage-staff',
    action: 'get_am_assignment_requests',
    body: { action: 'get_am_assignment_requests' },
    expectedFields: ['requests'],
    description: 'Get AM assignment requests',
    category: 'staff',
  },
  // ── manage-investor-admin ──
  {
    id: 'investor-admin-unassigned',
    functionName: 'manage-investor-admin',
    action: 'get_unassigned_investors',
    body: { action: 'get_unassigned_investors', limit: 5 },
    expectedFields: ['investors'],
    description: 'Get unassigned investors (limit 5)',
    category: 'investor',
  },
  // ── manage-acquisitions ──
  {
    id: 'acquisitions-active',
    functionName: 'manage-acquisitions',
    action: 'get_all_active',
    body: { action: 'get_all_active' },
    expectedFields: ['acquisitions'],
    description: 'Get all active acquisitions (v2.3)',
    category: 'deals',
  },
  // ── manage-acquisition-workflow ──
  {
    id: 'acq-workflow-get',
    functionName: 'manage-acquisition-workflow',
    action: 'get_workflow',
    body: { action: 'get_workflow', property_id: '00000000-0000-0000-0000-000000000000' },
    expectedFields: ['success', 'workflow'],
    description: 'Get acquisition workflow (v2.0 REST API)',
    category: 'deals',
  },
  // ── manage-investor-documents ──
  {
    id: 'investor-docs-count',
    functionName: 'manage-investor-documents',
    action: 'count',
    body: { action: 'count', investor_id: '00000000-0000-0000-0000-000000000000' },
    expectedFields: ['success', 'count'],
    description: 'Count investor documents (v2.1 REST API)',
    category: 'investor',
  },
  // ── manage-email-templates ──
  {
    id: 'email-templates-list',
    functionName: 'manage-email-templates',
    action: 'list',
    body: { action: 'list' },
    expectedFields: ['templates'],
    description: 'List email templates (REST API)',
    category: 'other',
  },
  // ── manage-deal-marketplace ──
  {
    id: 'marketplace-stats',
    functionName: 'manage-deal-marketplace',
    action: 'get_marketplace_stats',
    body: { action: 'get_marketplace_stats' },
    expectedFields: ['success', 'stats'],
    description: 'Get marketplace stats (v11.0 REST API)',
    category: 'marketplace',
  },
  {
    id: 'marketplace-pending',
    functionName: 'manage-deal-marketplace',
    action: 'get_pending_listings',
    body: { action: 'get_pending_listings' },
    expectedFields: ['success', 'listings'],
    description: 'Get pending marketplace listings',
    category: 'marketplace',
  },
  // ── manage-referrals ──
  {
    id: 'referrals-leaderboard',
    functionName: 'manage-referrals',
    action: 'get_leaderboard',
    body: { action: 'get_leaderboard' },
    expectedFields: ['leaderboard'],
    description: 'Get referral leaderboard (REST API)',
    category: 'investor',
  },
  // ── manage-market-reports ──
  {
    id: 'market-reports-templates',
    functionName: 'manage-market-reports',
    action: 'get_templates',
    body: { action: 'get_templates' },
    expectedFields: ['templates'],
    description: 'Get market report templates (REST API)',
    category: 'other',
  },
  // ── manage-investor-pipeline ──
  {
    id: 'pipeline-get',
    functionName: 'manage-investor-pipeline',
    action: 'get_pipeline',
    body: { action: 'get_pipeline' },
    expectedFields: ['lead', 'qualified', 'active', 'closed'],
    description: 'Get investor pipeline stages (v2.0 REST API)',
    category: 'crm',
  },
  {
    id: 'pipeline-sequences',
    functionName: 'manage-investor-pipeline',
    action: 'get_sequences',
    body: { action: 'get_sequences' },
    expectedFields: [],
    description: 'Get pipeline email sequences',
    category: 'crm',
  },
  // ── manage-investor-crm ──
  {
    id: 'crm-stats',
    functionName: 'manage-investor-crm',
    action: 'get_stats',
    body: { action: 'get_stats' },
    expectedFields: ['total', 'byActivity', 'byPipeline', 'avgEngagement'],
    description: 'Get CRM stats (v2.0 REST API)',
    category: 'crm',
  },
  // ── manage-support-requests ──
  {
    id: 'support-list',
    functionName: 'manage-support-requests',
    action: 'get_requests',
    body: { action: 'get_requests' },
    expectedFields: ['requests'],
    description: 'Get support requests',
    category: 'other',
  },
  // ── investor-auth-v2 ──
  {
    id: 'investor-auth-v2-ping',
    functionName: 'investor-auth-v2',
    action: 'ping',
    body: { action: 'ping' },
    expectedFields: [],
    description: 'Ping investor-auth-v2 (health check)',
    category: 'investor',
  },
  // ── ai-investor-chat (v9.0 — confirmed direct REST API) ──
  {
    id: 'ai-chat-suggestions',
    functionName: 'ai-investor-chat',
    action: 'get_suggested_questions',
    body: { action: 'get_suggested_questions', user_type: 'staff' },
    expectedFields: ['success', 'suggestions'],
    description: 'Penny AI suggested questions (v9.0 REST API)',
    category: 'ai',
  },
  {
    id: 'ai-chat-markets',
    functionName: 'ai-investor-chat',
    action: 'get_all_markets',
    body: { action: 'get_all_markets' },
    expectedFields: ['success', 'markets'],
    description: 'Penny AI market data (v9.0 REST API)',
    category: 'ai',
  },
  // ── get-deal-analytics (v2.0 — migrated from createClient) ──
  {
    id: 'deal-analytics-30d',
    functionName: 'get-deal-analytics',
    action: 'default',
    body: { dateRange: '30' },
    expectedFields: ['overview', 'topMarkets', 'pipelineStats'],
    description: 'Deal analytics 30-day overview (v2.0 REST API)',
    category: 'analytics',
  },
  // ── send-investor-invitation (v25.0 — confirmed direct REST API) ──
  {
    id: 'invitation-stats',
    functionName: 'send-investor-invitation',
    action: 'get_stats',
    body: { action: 'get_stats' },
    expectedFields: ['success', 'stats'],
    description: 'Invitation stats (v25.0 REST API)',
    category: 'investor',
  },
  // ── investor-login (v11.0 — confirmed direct REST API) ──
  {
    id: 'investor-login-auth-errors',
    functionName: 'investor-login',
    action: 'get_auth_errors',
    body: { action: 'get_auth_errors', limit: 5 },
    expectedFields: ['success', 'errors', 'counts'],
    description: 'Get auth errors (v11.0 REST API)',
    category: 'investor',
  },
];


// ─── Audit Data (Updated 2026-04-10 — ALL 13 priority functions confirmed migrated, 0 unknown) ─


const FUNCTION_AUDIT: FunctionAuditEntry[] = [
  {
    name: 'get-leads',
    status: 'fixed',
    description: 'Fetches leads from leads table',
    usesCreateClient: false,
    usesDirectREST: true,
    hasRLS: true,
    priority: 'critical',
    version: 'v2.0',
    notes: 'Migrated to direct PostgREST REST API in v2.0. RLS has permissive true policy.',
  },
  {
    name: 'manage-landlord-portal',
    status: 'fixed',
    description: 'CRUD for landlord portal (applications, properties, documents, messages)',
    usesCreateClient: false,
    usesDirectREST: true,
    hasRLS: false,
    priority: 'critical',
    version: 'v5.0',
    notes: 'Migrated to direct PostgREST REST API in v5.0.',
  },
  {
    name: 'manage-staff',
    status: 'fixed',
    description: 'Staff CRUD, AM assignments, certifications, account linking',
    usesCreateClient: false,
    usesDirectREST: true,
    hasRLS: false,
    priority: 'critical',
    version: 'v10.0',
    notes: 'Migrated to direct PostgREST REST API in v10.0.',
  },
  {
    name: 'manage-acquisitions',
    status: 'fixed',
    description: 'Acquisition workflow management (stages, notes, cleanup)',
    usesCreateClient: false,
    usesDirectREST: true,
    hasRLS: false,
    priority: 'high',
    version: 'v2.3',
    notes: 'Migrated v2.0, fixed full_address v2.1, JSONB fix v2.2, cleanup_test_data v2.3.',
  },
  {
    name: 'manage-acquisition-workflow',
    status: 'fixed',
    description: 'Property-level acquisition workflow (assign, payment, advance stages)',
    usesCreateClient: false,
    usesDirectREST: true,
    hasRLS: false,
    priority: 'high',
    version: 'v2.0',
    notes: 'Migrated to direct PostgREST REST API in v2.0. Uses db() helper + getHeaders/mutHeaders.',
  },
  {
    name: 'manage-investor-documents',
    status: 'fixed',
    description: 'Investor document CRUD, signed URLs, bulk download',
    usesCreateClient: false,
    usesDirectREST: true,
    hasRLS: false,
    priority: 'high',
    version: 'v2.1',
    notes: 'Migrated to direct REST API in v2.1. Uses getH/mutH headers pattern.',
  },
  {
    name: 'manage-email-templates',
    status: 'fixed',
    description: 'Email/document templates, campaigns, scheduled sends',
    usesCreateClient: false,
    usesDirectREST: true,
    hasRLS: false,
    priority: 'medium',
    version: 'latest',
    notes: 'Uses safeFetch() helper with explicit apikey + Bearer headers. Never used createClient.',
  },
  {
    name: 'manage-deal-marketplace',
    status: 'fixed',
    description: 'Deal marketplace listings, offers, negotiations, verification',
    usesCreateClient: false,
    usesDirectREST: true,
    hasRLS: false,
    priority: 'high',
    version: 'v11.0',
    notes: 'Massive migration in v11.0. 30+ actions migrated to dbGet/dbPost/dbPatch/dbDel helpers.',
  },
  {
    name: 'manage-referrals',
    status: 'fixed',
    description: 'Referral tracking, rewards, payouts, leaderboard',
    usesCreateClient: false,
    usesDirectREST: true,
    hasRLS: false,
    priority: 'medium',
    version: 'latest',
    notes: 'Uses db() helper with direct REST API. Never used createClient.',
  },
  {
    name: 'manage-market-reports',
    status: 'fixed',
    description: 'Market report CRUD, schedules, dashboard data',
    usesCreateClient: false,
    usesDirectREST: true,
    hasRLS: false,
    priority: 'medium',
    version: 'latest',
    notes: 'Uses direct fetch() with explicit apikey + Bearer headers throughout.',
  },
  {
    name: 'generate-market-report',
    status: 'fixed',
    description: 'AI-powered market report generation with static fallback data',
    usesCreateClient: false,
    usesDirectREST: true,
    hasRLS: false,
    priority: 'medium',
    version: 'latest',
    notes: 'Uses direct fetch() with explicit headers. Calls AI Gateway for report generation.',
  },
  {
    name: 'manage-investor-pipeline',
    status: 'fixed',
    description: 'Investor pipeline stages, email sequences, history',
    usesCreateClient: false,
    usesDirectREST: true,
    hasRLS: false,
    priority: 'high',
    version: 'v2.0',
    notes: 'Migrated to direct PostgREST REST API in v2.0. Uses dbGet/dbPost/dbPatch/dbDelete.',
  },
  {
    name: 'manage-investor-crm',
    status: 'fixed',
    description: 'Investor CRM: list, search, create, update, communications, CSV import',
    usesCreateClient: false,
    usesDirectREST: true,
    hasRLS: false,
    priority: 'high',
    version: 'v2.0',
    notes: 'Migrated to direct PostgREST REST API in v2.0. Uses dbGetWithCount for pagination.',
  },
  {
    name: 'investor-auth-v2',
    status: 'fixed',
    description: 'Investor authentication, portfolio, credits, preferences',
    usesCreateClient: false,
    usesDirectREST: true,
    hasRLS: true,
    priority: 'critical',
    version: 'latest',
    notes: 'Uses dbFetch() helper with direct REST API. Core investor auth function.',
  },
  {
    name: 'manage-investor-admin',
    status: 'fixed',
    description: 'Admin-side investor management (assign AM, update status, etc.)',
    usesCreateClient: false,
    usesDirectREST: true,
    hasRLS: false,
    priority: 'high',
    version: 'v17.3',
    notes: 'Uses getH/mutH headers pattern. Migrated from createClient.',
  },
  {
    name: 'manage-support-requests',
    status: 'fixed',
    description: 'Support ticket CRUD and assignment',
    usesCreateClient: false,
    usesDirectREST: true,
    hasRLS: false,
    priority: 'medium',
    version: 'latest',
    notes: 'Uses direct REST API with explicit headers.',
  },
  {
    name: 'cleanup-error-logs',
    status: 'fixed',
    description: 'Daily error log cleanup and digest generation',
    usesCreateClient: false,
    usesDirectREST: true,
    hasRLS: false,
    priority: 'low',
    version: 'latest',
    notes: 'Built with direct REST API pattern from the start.',
  },
  {
    name: 'check-error-thresholds',
    status: 'fixed',
    description: 'Proactive error alerting every 15 minutes',
    usesCreateClient: false,
    usesDirectREST: true,
    hasRLS: false,
    priority: 'low',
    version: 'latest',
    notes: 'Built with direct REST API pattern from the start.',
  },
  {
    name: 'ai-investor-chat',
    status: 'fixed',
    description: 'Penny AI chat v9.0: market data, investor context, intent detection, DB actions',
    usesCreateClient: false,
    usesDirectREST: true,
    hasRLS: false,
    priority: 'medium',
    version: 'v9.0',
    notes: 'Audited 2026-04-10: Uses dbGet/dbPatch/dbPost helpers with explicit apikey + Bearer headers. Never used createClient.',
  },
  {
    name: 'staff-login',
    status: 'fixed',
    description: 'Staff authentication and session management',
    usesCreateClient: false,
    usesDirectREST: true,
    hasRLS: false,
    priority: 'critical',
    version: 'v8.0',
    notes: 'Uses direct REST API. Confirmed safe during audit.',
  },
  {
    name: 'investor-login',
    status: 'fixed',
    description: 'Investor login v11.0: multi-format password verification, sessions, password reset',
    usesCreateClient: false,
    usesDirectREST: true,
    hasRLS: false,
    priority: 'critical',
    version: 'v11.0',
    notes: 'Audited 2026-04-10: Uses direct fetch() with explicit apikey + Authorization Bearer headers throughout. Handles v1$, v2$, auth_v2_sha256, and plain text password formats.',
  },
  {
    name: 'get-deal-analytics',
    status: 'fixed',
    description: 'Analytics dashboard: inquiries, acquisitions, pipeline, market stats',
    usesCreateClient: false,
    usesDirectREST: true,
    hasRLS: false,
    priority: 'medium',
    version: 'v2.0',
    notes: 'MIGRATED 2026-04-10: Was using createClient (returned 0 investors/properties due to silent failures). Now uses dbGet() with direct REST API. totalProperties went from 0→3 after migration.',
  },
  {
    name: 'send-investor-invitation',
    status: 'fixed',
    description: 'Investor invitations v25.0: contacts, SMS/email, AM agreements, trainee progress, tags',
    usesCreateClient: false,
    usesDirectREST: true,
    hasRLS: false,
    priority: 'medium',
    version: 'v25.0',
    notes: 'Audited 2026-04-10: Uses dbQuery/dbInsert/dbUpdate/dbDelete helpers with getDbHeaders() returning explicit apikey + Bearer. Never used createClient.',
  },
];


// ─── Component ────────────────────────────────────────────────────────────────

export function EdgeFunctionTestSuite() {
  const [results, setResults] = useState<TestResult[]>([]);
  const [running, setRunning] = useState(false);
  const [runningIds, setRunningIds] = useState<Set<string>>(new Set());
  const [expanded, setExpanded] = useState(false);
  const [activeView, setActiveView] = useState<'tests' | 'audit'>('tests');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [auditFilter, setAuditFilter] = useState<string>('all');
  const [expandedResults, setExpandedResults] = useState<Set<string>>(new Set());
  const [cleanup, setCleanup] = useState<CleanupResult>({ running: false, result: null, error: null });
  const [cleanupIds, setCleanupIds] = useState<string>('');
  const [showCleanup, setShowCleanup] = useState(false);
  const [testAcquisitionIds, setTestAcquisitionIds] = useState<string[]>([]);
  const { toast } = useToast();

  // Run a single test
  const runTest = useCallback(async (test: TestDefinition): Promise<TestResult> => {
    const startTime = Date.now();
    
    try {
      const { data, error } = await supabase.functions.invoke(test.functionName, {
        body: test.body,
      });
      
      const responseTime = Date.now() - startTime;
      
      if (error) {
        return {
          id: test.id,
          functionName: test.functionName,
          action: test.action,
          status: 'fail',
          responseTime,
          error: error.message || 'Edge function invocation failed',
          responsePreview: JSON.stringify(error, null, 2).slice(0, 500),
          timestamp: new Date().toISOString(),
        };
      }
      
      if (data?.error) {
        const isAuthError = typeof data.error === 'string' && 
          (data.error.includes('Authorization') || data.error.includes('token') || data.error.includes('JWT'));
        
        return {
          id: test.id,
          functionName: test.functionName,
          action: test.action,
          status: isAuthError ? 'fail' : 'warn',
          responseTime,
          error: typeof data.error === 'string' ? data.error : JSON.stringify(data.error),
          responsePreview: JSON.stringify(data, null, 2).slice(0, 500),
          timestamp: new Date().toISOString(),
        };
      }
      
      const missingFields = test.expectedFields.filter(f => !(f in (data || {})));
      
      if (missingFields.length > 0) {
        return {
          id: test.id,
          functionName: test.functionName,
          action: test.action,
          status: 'warn',
          responseTime,
          error: `Missing expected fields: ${missingFields.join(', ')}`,
          expectedFormat: `Expected: { ${test.expectedFields.join(', ')} }`,
          actualFormat: `Got: { ${Object.keys(data || {}).join(', ')} }`,
          responsePreview: JSON.stringify(data, null, 2).slice(0, 500),
          timestamp: new Date().toISOString(),
        };
      }
      
      return {
        id: test.id,
        functionName: test.functionName,
        action: test.action,
        status: 'pass',
        responseTime,
        responsePreview: JSON.stringify(data, null, 2).slice(0, 500),
        expectedFormat: `{ ${test.expectedFields.join(', ')} }`,
        actualFormat: `{ ${Object.keys(data || {}).join(', ')} }`,
        timestamp: new Date().toISOString(),
      };
    } catch (err: any) {
      return {
        id: test.id,
        functionName: test.functionName,
        action: test.action,
        status: 'fail',
        responseTime: Date.now() - startTime,
        error: err.message || 'Unexpected error',
        timestamp: new Date().toISOString(),
      };
    }
  }, []);

  // Run single test
  const handleRunSingle = useCallback(async (test: TestDefinition) => {
    setRunningIds(prev => new Set([...prev, test.id]));
    
    const result = await runTest(test);
    
    setResults(prev => {
      const filtered = prev.filter(r => r.id !== test.id);
      return [result, ...filtered];
    });
    
    setRunningIds(prev => {
      const next = new Set(prev);
      next.delete(test.id);
      return next;
    });
  }, [runTest]);

  // Run all tests
  const handleRunAll = useCallback(async () => {
    setRunning(true);
    setResults([]);
    
    const filteredTests = categoryFilter === 'all' 
      ? TEST_DEFINITIONS 
      : TEST_DEFINITIONS.filter(t => t.category === categoryFilter);
    
    const allIds = new Set(filteredTests.map(t => t.id));
    setRunningIds(allIds);
    
    const newResults: TestResult[] = [];
    
    for (const test of filteredTests) {
      const result = await runTest(test);
      newResults.push(result);
      setResults([...newResults]);
      setRunningIds(prev => {
        const next = new Set(prev);
        next.delete(test.id);
        return next;
      });
    }
    
    const passCount = newResults.filter(r => r.status === 'pass').length;
    const failCount = newResults.filter(r => r.status === 'fail').length;
    const warnCount = newResults.filter(r => r.status === 'warn').length;
    
    toast({
      title: 'Test Suite Complete',
      description: `${passCount} passed, ${failCount} failed, ${warnCount} warnings out of ${newResults.length} tests`,
      variant: failCount > 0 ? 'destructive' : undefined,
    });
    
    setRunning(false);
  }, [categoryFilter, runTest, toast]);

  // Run priority audit tests (just the vulnerable ones)
  const handleRunAuditTests = useCallback(async () => {
    setRunning(true);
    
    const vulnerableFunctions = FUNCTION_AUDIT.filter(f => f.status === 'vulnerable' || f.status === 'unknown');
    const testsToRun = TEST_DEFINITIONS.filter(t => 
      vulnerableFunctions.some(f => f.name === t.functionName)
    );
    
    if (testsToRun.length === 0) {
      toast({ title: 'No tests available', description: 'No test definitions match vulnerable functions. All priority functions are migrated!' });
      setRunning(false);
      return;
    }
    
    const allIds = new Set(testsToRun.map(t => t.id));
    setRunningIds(allIds);
    
    const newResults: TestResult[] = [];
    
    for (const test of testsToRun) {
      const result = await runTest(test);
      newResults.push(result);
      setResults(prev => {
        const filtered = prev.filter(r => r.id !== test.id);
        return [result, ...filtered];
      });
      setRunningIds(prev => {
        const next = new Set(prev);
        next.delete(test.id);
        return next;
      });
    }
    
    const failCount = newResults.filter(r => r.status === 'fail').length;
    
    toast({
      title: 'Vulnerability Audit Complete',
      description: failCount > 0 
        ? `${failCount} function(s) confirmed failing — need direct REST API migration`
        : 'All tested functions are responding (but may still have intermittent issues)',
      variant: failCount > 0 ? 'destructive' : undefined,
    });
    
    setRunning(false);
  }, [runTest, toast]);

  // Run cleanup
  const handleRunCleanup = useCallback(async () => {
    const ids = cleanupIds
      .split(/[\n,;]+/)
      .map(id => id.trim())
      .filter(id => id.length > 0);

    // Also include any test acquisition IDs collected during test runs
    const allIds = [...new Set([...ids, ...testAcquisitionIds])];

    if (allIds.length === 0) {
      toast({ title: 'No IDs to clean up', description: 'Enter acquisition IDs or run E2E tests first.' });
      return;
    }

    setCleanup({ running: true, result: null, error: null });

    try {
      const { data, error } = await supabase.functions.invoke('manage-acquisitions', {
        body: { action: 'cleanup_test_data', acquisition_ids: allIds },
      });

      if (error) {
        setCleanup({ running: false, result: null, error: error.message });
        toast({ title: 'Cleanup Failed', description: error.message, variant: 'destructive' });
      } else {
        setCleanup({ running: false, result: data, error: null });
        setTestAcquisitionIds([]);
        setCleanupIds('');
        toast({
          title: data?.success ? 'Cleanup Complete' : 'Cleanup Partial',
          description: `${data?.total_delete_operations || 0} delete operations, ${data?.total_errors || 0} errors across ${data?.acquisitions_processed || 0} acquisition(s)`,
          variant: data?.total_errors > 0 ? 'destructive' : undefined,
        });
      }
    } catch (err: any) {
      setCleanup({ running: false, result: null, error: err.message });
      toast({ title: 'Cleanup Error', description: err.message, variant: 'destructive' });
    }
  }, [cleanupIds, testAcquisitionIds, toast]);

  const toggleResultExpand = (id: string) => {
    setExpandedResults(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: 'Copied to clipboard' });
  };

  // Stats
  const passCount = results.filter(r => r.status === 'pass').length;
  const failCount = results.filter(r => r.status === 'fail').length;
  const warnCount = results.filter(r => r.status === 'warn').length;
  const avgResponseTime = results.length > 0 
    ? Math.round(results.reduce((sum, r) => sum + r.responseTime, 0) / results.length)
    : 0;

  const filteredAudit = auditFilter === 'all' 
    ? FUNCTION_AUDIT 
    : FUNCTION_AUDIT.filter(f => f.status === auditFilter);

  const vulnerableCount = FUNCTION_AUDIT.filter(f => f.status === 'vulnerable').length;
  const fixedCount = FUNCTION_AUDIT.filter(f => f.status === 'fixed').length;
  const unknownCount = FUNCTION_AUDIT.filter(f => f.status === 'unknown').length;

  const categories = [...new Set(TEST_DEFINITIONS.map(t => t.category))];

  return (
    <Card className="border-indigo-200 bg-gradient-to-r from-indigo-50/50 to-violet-50/50 shadow-sm">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-indigo-100 flex items-center justify-center">
              <Activity className="w-5 h-5 text-indigo-600" />
            </div>
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                Edge Function Health & Audit
                {results.length > 0 && (
                  <div className="flex items-center gap-1">
                    {passCount > 0 && <Badge className="bg-green-500 text-white text-[10px]">{passCount} pass</Badge>}
                    {failCount > 0 && <Badge className="bg-red-500 text-white text-[10px]">{failCount} fail</Badge>}
                    {warnCount > 0 && <Badge className="bg-amber-500 text-white text-[10px]">{warnCount} warn</Badge>}
                  </div>
                )}
              </CardTitle>
              <CardDescription className="text-indigo-700">
                Test edge function endpoints & audit createClient vulnerability status
              </CardDescription>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setExpanded(!expanded)}
              className="h-8 w-8 p-0"
            >
              {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </Button>
          </div>
        </div>
      </CardHeader>

      {/* Quick Summary - Always visible */}
      <CardContent className="pt-0 pb-3">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <div className="p-2 bg-white rounded-lg border border-green-100 text-center">
            <p className="text-lg font-bold text-green-600">{fixedCount}</p>
            <p className="text-[10px] text-gray-500">Fixed (Direct REST)</p>
          </div>
          <div className="p-2 bg-white rounded-lg border border-red-100 text-center">
            <p className="text-lg font-bold text-red-600">{vulnerableCount}</p>
            <p className="text-[10px] text-gray-500">Vulnerable (createClient)</p>
          </div>
          <div className="p-2 bg-white rounded-lg border border-amber-100 text-center">
            <p className="text-lg font-bold text-amber-600">{unknownCount}</p>
            <p className="text-[10px] text-gray-500">Unknown Status</p>
          </div>
          <div className="p-2 bg-white rounded-lg border border-gray-100 text-center">
            <p className="text-lg font-bold text-gray-600">{FUNCTION_AUDIT.length}</p>
            <p className="text-[10px] text-gray-500">Total Audited</p>
          </div>
        </div>
      </CardContent>

      {/* Expanded View */}
      {expanded && (
        <CardContent className="pt-0 border-t border-indigo-200/60">
          {/* Tab Navigation */}
          <div className="flex items-center gap-1 pt-3 mb-3 border-b border-gray-200/60 pb-2">
            <button
              onClick={() => setActiveView('tests')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                activeView === 'tests' ? 'bg-indigo-600 text-white' : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              <Play className="w-3 h-3" />
              Live Tests
              {results.length > 0 && (
                <span className={`ml-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                  activeView === 'tests' ? 'bg-white/20' : 'bg-indigo-100 text-indigo-700'
                }`}>{results.length}</span>
              )}
            </button>
            <button
              onClick={() => setActiveView('audit')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                activeView === 'audit' ? 'bg-indigo-600 text-white' : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              <Search className="w-3 h-3" />
              Vulnerability Audit
              {(vulnerableCount + unknownCount) > 0 && (
                <span className={`ml-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                  activeView === 'audit' ? 'bg-white/20' : 'bg-amber-100 text-amber-700'
                }`}>{vulnerableCount + unknownCount}</span>
              )}
            </button>
          </div>

          {/* ═══ TESTS VIEW ═══ */}
          {activeView === 'tests' && (
            <>
              {/* Test Controls */}
              <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <select
                    value={categoryFilter}
                    onChange={(e) => setCategoryFilter(e.target.value)}
                    className="text-xs border border-gray-200 rounded-md px-2 py-1.5 bg-white"
                  >
                    <option value="all">All Categories</option>
                    {categories.map(c => (
                      <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)} ({TEST_DEFINITIONS.filter(t => t.category === c).length})</option>
                    ))}
                  </select>
                  <span className="text-xs text-gray-500">
                    {categoryFilter === 'all' ? TEST_DEFINITIONS.length : TEST_DEFINITIONS.filter(t => t.category === categoryFilter).length} test{categoryFilter === 'all' && TEST_DEFINITIONS.length !== 1 ? 's' : ''}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setShowCleanup(!showCleanup)}
                    className="h-7 text-xs gap-1.5 border-orange-200 text-orange-700 hover:bg-orange-50"
                  >
                    <Trash2 className="w-3 h-3" />
                    Cleanup
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleRunAuditTests}
                    disabled={running}
                    className="h-7 text-xs gap-1.5 border-red-200 text-red-700 hover:bg-red-50"
                  >
                    {running ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Shield className="w-3 h-3" />}
                    Test Vulnerable Only
                  </Button>
                  <Button
                    size="sm"
                    onClick={handleRunAll}
                    disabled={running}
                    className="h-7 text-xs gap-1.5 bg-indigo-600 hover:bg-indigo-700"
                  >
                    {running ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Zap className="w-3 h-3" />}
                    Run All Tests
                  </Button>
                </div>
              </div>

              {/* ── Cleanup Panel ── */}
              {showCleanup && (
                <div className="mb-4 p-3 bg-orange-50 rounded-lg border border-orange-200">
                  <h4 className="text-xs font-semibold text-orange-800 mb-2 flex items-center gap-1.5">
                    <Trash2 className="w-3.5 h-3.5" />
                    E2E Test Data Cleanup
                  </h4>
                  <p className="text-[10px] text-orange-700 mb-2">
                    Cascading-deletes test acquisitions and all related records: notifications, portfolio entries, credits, workflow entries, and documents.
                    Enter acquisition UUIDs (one per line or comma-separated).
                  </p>
                  <textarea
                    value={cleanupIds}
                    onChange={(e) => setCleanupIds(e.target.value)}
                    placeholder="e.g. bf6b47f2-a9d8-45fe-85fd-0eaa9077cad5"
                    className="w-full text-xs font-mono border border-orange-200 rounded-md px-2 py-1.5 bg-white mb-2 h-16 resize-none"
                  />
                  {testAcquisitionIds.length > 0 && (
                    <div className="mb-2 p-2 bg-white rounded border border-orange-100">
                      <p className="text-[10px] text-orange-600 font-medium mb-1">
                        Auto-collected from test runs ({testAcquisitionIds.length}):
                      </p>
                      <code className="text-[10px] text-gray-600 break-all">
                        {testAcquisitionIds.join(', ')}
                      </code>
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      onClick={handleRunCleanup}
                      disabled={cleanup.running}
                      className="h-7 text-xs gap-1.5 bg-orange-600 hover:bg-orange-700 text-white"
                    >
                      {cleanup.running ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
                      Run Cleanup
                    </Button>
                    {cleanup.result && (
                      <Badge className={`text-[10px] ${cleanup.result.success ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                        {cleanup.result.total_delete_operations} deletes, {cleanup.result.total_errors} errors
                      </Badge>
                    )}
                    {cleanup.error && (
                      <Badge className="text-[10px] bg-red-100 text-red-700">
                        Error: {cleanup.error}
                      </Badge>
                    )}
                  </div>
                  {/* Cleanup Result Detail */}
                  {cleanup.result?.summary && (
                    <div className="mt-2 space-y-1">
                      {Object.entries(cleanup.result.summary).map(([acqId, detail]: [string, any]) => (
                        <div key={acqId} className={`p-2 rounded text-[10px] font-mono ${
                          detail.errors.length === 0 ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'
                        }`}>
                          <span className="font-semibold">{acqId.substring(0, 8)}...</span>
                          <span className="ml-2">{detail.deleted} deletes</span>
                          {detail.errors.length > 0 && (
                            <span className="ml-2 text-red-600">{detail.errors.join('; ')}</span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Results Summary Bar */}
              {results.length > 0 && (
                <div className="flex items-center gap-4 mb-3 p-2.5 bg-white rounded-lg border border-gray-200">
                  <div className="flex items-center gap-1.5 text-xs">
                    <CheckCircle className="w-3.5 h-3.5 text-green-500" />
                    <span className="font-semibold text-green-700">{passCount}</span>
                    <span className="text-gray-500">passed</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs">
                    <XCircle className="w-3.5 h-3.5 text-red-500" />
                    <span className="font-semibold text-red-700">{failCount}</span>
                    <span className="text-gray-500">failed</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                    <span className="font-semibold text-amber-700">{warnCount}</span>
                    <span className="text-gray-500">warnings</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs ml-auto">
                    <Clock className="w-3.5 h-3.5 text-gray-400" />
                    <span className="text-gray-500">Avg: <span className="font-semibold text-gray-700">{avgResponseTime}ms</span></span>
                  </div>
                </div>
              )}

              {/* Test List */}
              <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
                {(categoryFilter === 'all' ? TEST_DEFINITIONS : TEST_DEFINITIONS.filter(t => t.category === categoryFilter)).map(test => {
                  const result = results.find(r => r.id === test.id);
                  const isRunning = runningIds.has(test.id);
                  const isExpanded = expandedResults.has(test.id);
                  
                  return (
                    <div key={test.id} className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                      <div className="flex items-center gap-3 p-3">
                        {/* Status Icon */}
                        <div className="flex-shrink-0">
                          {isRunning ? (
                            <RefreshCw className="w-4 h-4 text-indigo-500 animate-spin" />
                          ) : result?.status === 'pass' ? (
                            <CheckCircle className="w-4 h-4 text-green-500" />
                          ) : result?.status === 'fail' ? (
                            <XCircle className="w-4 h-4 text-red-500" />
                          ) : result?.status === 'warn' ? (
                            <AlertTriangle className="w-4 h-4 text-amber-500" />
                          ) : (
                            <Server className="w-4 h-4 text-gray-300" />
                          )}
                        </div>
                        
                        {/* Test Info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <code className="text-xs font-mono font-semibold text-gray-800">{test.functionName}</code>
                            <Badge variant="outline" className="text-[10px] px-1.5 py-0">{test.action}</Badge>
                            <Badge className={`text-[10px] px-1.5 py-0 ${
                              test.category === 'leads' ? 'bg-blue-100 text-blue-700' :
                              test.category === 'landlord' ? 'bg-green-100 text-green-700' :
                              test.category === 'staff' ? 'bg-purple-100 text-purple-700' :
                              test.category === 'investor' ? 'bg-amber-100 text-amber-700' :
                              test.category === 'deals' ? 'bg-indigo-100 text-indigo-700' :
                              test.category === 'marketplace' ? 'bg-teal-100 text-teal-700' :
                              test.category === 'crm' ? 'bg-pink-100 text-pink-700' :
                              'bg-gray-100 text-gray-700'
                            }`}>{test.category}</Badge>
                          </div>
                          <p className="text-[11px] text-gray-500 mt-0.5">{test.description}</p>
                          {result?.error && (
                            <p className="text-[11px] text-red-600 mt-1 font-medium truncate">{result.error}</p>
                          )}
                        </div>
                        
                        {/* Response Time & Actions */}
                        <div className="flex items-center gap-2 flex-shrink-0">
                          {result && (
                            <span className={`text-[11px] font-mono ${
                              result.responseTime > 3000 ? 'text-red-500' :
                              result.responseTime > 1000 ? 'text-amber-500' :
                              'text-green-500'
                            }`}>
                              {result.responseTime}ms
                            </span>
                          )}
                          {result && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => toggleResultExpand(test.id)}
                              className="h-6 w-6 p-0"
                            >
                              {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                            </Button>
                          )}
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleRunSingle(test)}
                            disabled={isRunning}
                            className="h-7 text-xs gap-1 px-2"
                          >
                            {isRunning ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Play className="w-3 h-3" />}
                            Run
                          </Button>
                        </div>
                      </div>
                      
                      {/* Expanded Response Preview */}
                      {isExpanded && result && (
                        <div className="border-t border-gray-100 p-3 bg-gray-50">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Response Preview</span>
                            <div className="flex items-center gap-1">
                              {result.responsePreview && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => copyToClipboard(result.responsePreview || '')}
                                  className="h-5 text-[10px] gap-1 px-1.5"
                                >
                                  <Copy className="w-2.5 h-2.5" />
                                  Copy
                                </Button>
                              )}
                            </div>
                          </div>
                          {result.expectedFormat && (
                            <div className="flex items-center gap-2 mb-1.5 text-[10px]">
                              <span className="text-gray-400">Expected:</span>
                              <code className="bg-green-50 text-green-700 px-1.5 py-0.5 rounded">{result.expectedFormat}</code>
                            </div>
                          )}
                          {result.actualFormat && (
                            <div className="flex items-center gap-2 mb-2 text-[10px]">
                              <span className="text-gray-400">Actual:</span>
                              <code className={`px-1.5 py-0.5 rounded ${
                                result.status === 'pass' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
                              }`}>{result.actualFormat}</code>
                            </div>
                          )}
                          <pre className="text-[10px] bg-gray-900 text-green-400 p-3 rounded-md overflow-x-auto max-h-48 overflow-y-auto font-mono leading-relaxed">
                            {result.responsePreview || 'No response data'}
                          </pre>
                          <p className="text-[10px] text-gray-400 mt-1.5">
                            Tested at {new Date(result.timestamp).toLocaleTimeString()} | {result.responseTime}ms
                          </p>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {/* ═══ AUDIT VIEW ═══ */}
          {activeView === 'audit' && (
            <>
              {/* Audit Controls */}
              <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <select
                    value={auditFilter}
                    onChange={(e) => setAuditFilter(e.target.value)}
                    className="text-xs border border-gray-200 rounded-md px-2 py-1.5 bg-white"
                  >
                    <option value="all">All ({FUNCTION_AUDIT.length})</option>
                    <option value="fixed">Fixed ({fixedCount})</option>
                    <option value="vulnerable">Vulnerable ({vulnerableCount})</option>
                    <option value="unknown">Unknown ({unknownCount})</option>
                  </select>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setShowCleanup(!showCleanup)}
                    className="h-7 text-xs gap-1.5 border-orange-200 text-orange-700 hover:bg-orange-50"
                  >
                    <Trash2 className="w-3 h-3" />
                    Cleanup
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleRunAuditTests}
                    disabled={running}
                    className="h-7 text-xs gap-1.5 border-red-200 text-red-700 hover:bg-red-50"
                  >
                    {running ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Shield className="w-3 h-3" />}
                    Test All Vulnerable
                  </Button>
                </div>
              </div>

              {/* Cleanup Panel (also available in audit view) */}
              {showCleanup && (
                <div className="mb-4 p-3 bg-orange-50 rounded-lg border border-orange-200">
                  <h4 className="text-xs font-semibold text-orange-800 mb-2 flex items-center gap-1.5">
                    <Trash2 className="w-3.5 h-3.5" />
                    E2E Test Data Cleanup (manage-acquisitions v2.3)
                  </h4>
                  <p className="text-[10px] text-orange-700 mb-2">
                    Calls <code className="bg-white px-1 rounded">cleanup_test_data</code> action. Cascading-deletes: investor_notifications, investor_portfolio, portfolio_credits, acquisition_workflow, investor_documents, and the acquisition itself.
                    Max 20 IDs per call.
                  </p>
                  <textarea
                    value={cleanupIds}
                    onChange={(e) => setCleanupIds(e.target.value)}
                    placeholder="Enter acquisition UUIDs (one per line or comma-separated)"
                    className="w-full text-xs font-mono border border-orange-200 rounded-md px-2 py-1.5 bg-white mb-2 h-16 resize-none"
                  />
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      onClick={handleRunCleanup}
                      disabled={cleanup.running || (!cleanupIds.trim() && testAcquisitionIds.length === 0)}
                      className="h-7 text-xs gap-1.5 bg-orange-600 hover:bg-orange-700 text-white"
                    >
                      {cleanup.running ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
                      Run Cleanup
                    </Button>
                    {cleanup.result && (
                      <Badge className={`text-[10px] ${cleanup.result.success ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                        {cleanup.result.total_delete_operations} deletes, {cleanup.result.total_errors} errors
                      </Badge>
                    )}
                  </div>
                  {cleanup.result?.summary && (
                    <div className="mt-2 space-y-1">
                      {Object.entries(cleanup.result.summary).map(([acqId, detail]: [string, any]) => (
                        <div key={acqId} className={`p-2 rounded text-[10px] font-mono ${
                          detail.errors.length === 0 ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'
                        }`}>
                          <span className="font-semibold">{acqId.substring(0, 8)}...</span>
                          <span className="ml-2">{detail.deleted} deletes</span>
                          {detail.errors.length > 0 && (
                            <span className="ml-2 text-red-600">{detail.errors.join('; ')}</span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Migration Success Banner */}
              {vulnerableCount === 0 && unknownCount === 0 && (
                <div className="mb-4 p-3 bg-green-50 rounded-lg border border-green-200">
                  <h4 className="text-xs font-semibold text-green-800 mb-1 flex items-center gap-1.5">
                    <CheckCircle className="w-3.5 h-3.5" />
                    Complete Audit: All {fixedCount} Functions Migrated!
                  </h4>
                  <p className="text-[10px] text-green-700">
                    All {fixedCount} audited edge functions use direct PostgREST REST API with explicit <code className="bg-white px-1 rounded">apikey</code> + <code className="bg-white px-1 rounded">Authorization: Bearer</code> headers.
                    Zero functions use <code className="bg-white px-1 rounded">createClient</code>. The intermittent 'Authorization token is required' bug is fully eliminated.
                    Last audited: 2026-04-10. Functions migrated: get-deal-analytics (v2.0). Functions confirmed safe: ai-investor-chat (v9.0), investor-login (v11.0), send-investor-invitation (v25.0).
                  </p>
                </div>
              )}
              {vulnerableCount === 0 && unknownCount > 0 && (
                <div className="mb-4 p-3 bg-green-50 rounded-lg border border-green-200">
                  <h4 className="text-xs font-semibold text-green-800 mb-1 flex items-center gap-1.5">
                    <CheckCircle className="w-3.5 h-3.5" />
                    All Priority Functions Migrated!
                  </h4>
                  <p className="text-[10px] text-green-700">
                    All priority edge functions have been migrated. {unknownCount} lower-priority function(s) still need audit.
                  </p>
                </div>
              )}


              {/* Fix Pattern Documentation */}
              <div className="mb-4 p-3 bg-white rounded-lg border border-indigo-200">
                <h4 className="text-xs font-semibold text-indigo-800 mb-2 flex items-center gap-1.5">
                  <Wrench className="w-3.5 h-3.5" />
                  Required Fix Pattern: Direct PostgREST REST API
                </h4>
                <p className="text-[10px] text-gray-600 mb-2">
                  Replace <code className="bg-red-50 text-red-700 px-1 rounded">createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)</code> with direct 
                  <code className="bg-green-50 text-green-700 px-1 rounded ml-1">fetch()</code> calls using explicit <code className="bg-green-50 text-green-700 px-1 rounded">apikey</code> and <code className="bg-green-50 text-green-700 px-1 rounded">Authorization: Bearer</code> headers.
                </p>
                <pre className="text-[10px] bg-gray-900 text-green-400 p-3 rounded-md overflow-x-auto font-mono leading-relaxed">
{`// FIXED PATTERN - Direct REST API helper
const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

async function db(table, options = {}) {
  const { method = 'GET', filters = '', body, select = '*' } = options;
  const url = \`\${SUPABASE_URL}/rest/v1/\${table}?select=\${select}\${filters}\`;
  const res = await fetch(url, {
    method,
    headers: {
      'apikey': SERVICE_KEY,
      'Authorization': \`Bearer \${SERVICE_KEY}\`,
      'Content-Type': 'application/json',
      'Prefer': method === 'POST' ? 'return=representation' : 'return=minimal',
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  if (!res.ok) throw new Error(await res.text());
  return method === 'DELETE' ? null : res.json();
}`}
                </pre>
              </div>

              {/* Audit List */}
              <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1">
                {filteredAudit.map(fn => {
                  const testResult = results.find(r => r.functionName === fn.name);
                  
                  return (
                    <div key={fn.name} className={`p-3 bg-white rounded-lg border ${
                      fn.status === 'fixed' ? 'border-green-200' :
                      fn.status === 'vulnerable' ? 'border-red-200' :
                      'border-amber-200'
                    }`}>
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap mb-1">
                            <code className="text-xs font-mono font-semibold">{fn.name}</code>
                            {fn.version && (
                              <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-gray-300 text-gray-600">
                                {fn.version}
                              </Badge>
                            )}
                            <Badge className={`text-[10px] px-1.5 py-0 ${
                              fn.status === 'fixed' ? 'bg-green-100 text-green-700' :
                              fn.status === 'vulnerable' ? 'bg-red-100 text-red-700' :
                              'bg-amber-100 text-amber-700'
                            }`}>
                              {fn.status === 'fixed' ? <CheckCircle className="w-2.5 h-2.5 mr-0.5" /> :
                               fn.status === 'vulnerable' ? <XCircle className="w-2.5 h-2.5 mr-0.5" /> :
                               <AlertTriangle className="w-2.5 h-2.5 mr-0.5" />}
                              {fn.status.toUpperCase()}
                            </Badge>
                            <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${
                              fn.priority === 'critical' ? 'border-red-300 text-red-700' :
                              fn.priority === 'high' ? 'border-orange-300 text-orange-700' :
                              fn.priority === 'medium' ? 'border-amber-300 text-amber-700' :
                              'border-gray-300 text-gray-600'
                            }`}>
                              {fn.priority}
                            </Badge>
                            {testResult && (
                              <Badge className={`text-[10px] px-1.5 py-0 ${
                                testResult.status === 'pass' ? 'bg-green-500 text-white' :
                                testResult.status === 'fail' ? 'bg-red-500 text-white' :
                                'bg-amber-500 text-white'
                              }`}>
                                Test: {testResult.status} ({testResult.responseTime}ms)
                              </Badge>
                            )}
                          </div>
                          <p className="text-[11px] text-gray-600">{fn.description}</p>
                          
                          {/* Technical Details */}
                          <div className="flex items-center gap-3 mt-1.5 text-[10px]">
                            <span className={fn.usesCreateClient ? 'text-red-500 font-medium' : 'text-green-500'}>
                              {fn.usesCreateClient ? 'Uses createClient' : 'No createClient'}
                            </span>
                            <span className={fn.usesDirectREST ? 'text-green-500 font-medium' : 'text-gray-400'}>
                              {fn.usesDirectREST ? 'Direct REST API' : 'No direct REST'}
                            </span>
                            <span className={fn.hasRLS ? 'text-amber-500' : 'text-gray-400'}>
                              RLS: {fn.hasRLS ? 'Enabled' : 'Disabled'}
                            </span>
                          </div>
                          
                          {fn.notes && (
                            <p className="text-[10px] text-gray-400 mt-1 italic">{fn.notes}</p>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Remaining Migration Priority */}
              {(vulnerableCount + unknownCount) > 0 && (
                <div className="mt-4 p-3 bg-amber-50 rounded-lg border border-amber-200">
                  <h4 className="text-xs font-semibold text-amber-800 mb-2 flex items-center gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    Remaining Functions to Audit/Migrate
                  </h4>
                  <ol className="space-y-1">
                    {FUNCTION_AUDIT
                      .filter(f => f.status === 'vulnerable' || f.status === 'unknown')
                      .sort((a, b) => {
                        const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
                        return (priorityOrder[a.priority] || 4) - (priorityOrder[b.priority] || 4);
                      })
                      .map((fn, idx) => (
                        <li key={fn.name} className="flex items-center gap-2 text-[11px]">
                          <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0 ${
                            fn.priority === 'critical' ? 'bg-red-200 text-red-800' :
                            fn.priority === 'high' ? 'bg-orange-200 text-orange-800' :
                            'bg-amber-200 text-amber-800'
                          }`}>{idx + 1}</span>
                          <code className="font-mono font-medium">{fn.name}</code>
                          <Badge variant="outline" className={`text-[9px] px-1 py-0 ${
                            fn.status === 'vulnerable' ? 'border-red-300 text-red-600' : 'border-amber-300 text-amber-600'
                          }`}>{fn.status}</Badge>
                          <span className="text-gray-500">— {fn.description}</span>
                        </li>
                      ))}
                  </ol>
                </div>
              )}
            </>
          )}
        </CardContent>
      )}
    </Card>
  );
}
