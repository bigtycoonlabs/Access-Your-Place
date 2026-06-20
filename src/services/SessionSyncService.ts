/**
 * Session Synchronization Service v2.0
 * 
 * Keeps staff and investor sessions in sync across browser tabs using
 * BroadcastChannel API with localStorage fallback for older browsers.
 * 
 * Features:
 * - Real-time session sync across tabs
 * - Proper logout handling across all tabs
 * - Account switching notifications
 * - Session backup/restore for account switching
 */

export type UserType = 'staff' | 'investor';

export interface SessionData {
  userId: string;
  userType: UserType;
  email: string;
  name: string;
  token?: string;
  linkedAccountId?: string;
  linkedAccountType?: UserType;
  timestamp: number;
}

export interface SessionMessage {
  type: 'SESSION_SWITCH' | 'SESSION_UPDATE' | 'SESSION_LOGOUT' | 'SESSION_SYNC_REQUEST' | 'SESSION_SYNC_RESPONSE' | 'FORCE_LOGOUT_ALL';
  session: SessionData | null;
  sourceTabId: string;
  targetTabId?: string;
  logoutType?: UserType | 'all';
}

type SessionChangeCallback = (session: SessionData | null, previousSession: SessionData | null) => void;
type LogoutCallback = (userType: UserType | 'all') => void;

class SessionSyncService {
  private channel: BroadcastChannel | null = null;
  private tabId: string;
  private currentSession: SessionData | null = null;
  private listeners: Set<SessionChangeCallback> = new Set();
  private logoutListeners: Set<LogoutCallback> = new Set();
  private useLocalStorage: boolean = false;
  private storageKey = 'ayp_session_sync';
  private initialized = false;
  private heartbeatInterval: number | null = null;

  constructor() {
    this.tabId = this.generateTabId();
    this.initializeChannel();
    this.startHeartbeat();
  }

  private generateTabId(): string {
    return `tab_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private initializeChannel(): void {
    if (this.initialized) return;
    
    // Try BroadcastChannel first (modern browsers)
    if (typeof BroadcastChannel !== 'undefined') {
      try {
        this.channel = new BroadcastChannel('ayp_session_sync');
        this.channel.onmessage = (event) => this.handleMessage(event.data);
        console.log('[SessionSync v2] BroadcastChannel initialized');
      } catch (e) {
        console.warn('[SessionSync v2] BroadcastChannel failed, falling back to localStorage');
        this.useLocalStorage = true;
      }
    } else {
      this.useLocalStorage = true;
    }

    // Fallback to localStorage events
    if (this.useLocalStorage && typeof window !== 'undefined') {
      window.addEventListener('storage', (event) => {
        if (event.key === this.storageKey && event.newValue) {
          try {
            const message = JSON.parse(event.newValue) as SessionMessage;
            this.handleMessage(message);
          } catch (e) {
            console.error('[SessionSync v2] Failed to parse storage event', e);
          }
        }
      });
      console.log('[SessionSync v2] Using localStorage fallback');
    }

    // Load existing session from storage
    this.loadStoredSession();
    
    // Request sync from other tabs
    this.requestSync();
    
    this.initialized = true;
  }

  private startHeartbeat(): void {
    // Check session validity every 30 seconds
    if (typeof window !== 'undefined') {
      this.heartbeatInterval = window.setInterval(() => {
        this.validateCurrentSession();
      }, 30000);
    }
  }

  private validateCurrentSession(): void {
    // Check if the session in localStorage still matches our current session
    const staffSession = localStorage.getItem('staffSession');
    const investorSession = localStorage.getItem('investorSession');
    
    if (this.currentSession?.userType === 'staff' && !staffSession) {
      // Staff session was removed in another context
      this.handleSessionLogout({ userType: 'staff' } as SessionData);
    } else if (this.currentSession?.userType === 'investor' && !investorSession) {
      // Investor session was removed in another context
      this.handleSessionLogout({ userType: 'investor' } as SessionData);
    }
  }

  private loadStoredSession(): void {
    try {
      const staffSession = localStorage.getItem('staffSession');
      const investorSession = localStorage.getItem('investorSession');
      
      // Prefer the most recent session
      let staffData: SessionData | null = null;
      let investorData: SessionData | null = null;
      
      if (staffSession) {
        const parsed = JSON.parse(staffSession);
        if (parsed && this.isSessionValid(parsed)) {
          staffData = {
            userId: parsed.id,
            userType: 'staff',
            email: parsed.email,
            name: parsed.name || `${parsed.first_name || ''} ${parsed.last_name || ''}`.trim(),
            linkedAccountId: parsed.linked_investor_id,
            linkedAccountType: parsed.linked_investor_id ? 'investor' : undefined,
            timestamp: parsed.loginTime || Date.now()
          };
        }
      }
      
      if (investorSession) {
        const parsed = JSON.parse(investorSession);
        if (parsed && this.isSessionValid(parsed)) {
          investorData = {
            userId: parsed.id,
            userType: 'investor',
            email: parsed.email,
            name: parsed.full_name || `${parsed.first_name || ''} ${parsed.last_name || ''}`.trim(),
            linkedAccountId: parsed.linked_staff_id,
            linkedAccountType: parsed.linked_staff_id ? 'staff' : undefined,
            timestamp: parsed.loginTime || Date.now()
          };
        }
      }
      
      // Use the most recent valid session
      if (staffData && investorData) {
        this.currentSession = staffData.timestamp > investorData.timestamp ? staffData : investorData;
      } else {
        this.currentSession = staffData || investorData;
      }
    } catch (e) {
      console.error('[SessionSync v2] Failed to load stored session', e);
    }
  }

  private isSessionValid(session: any): boolean {
    if (!session || !session.id) return false;
    
    // Check if session is within 24 hours
    const sessionTime = session.timestamp || session.loginTime || 0;
    const maxAge = 24 * 60 * 60 * 1000; // 24 hours
    
    if (sessionTime && Date.now() - sessionTime > maxAge) {
      return false;
    }
    
    return true;
  }

  private handleMessage(message: SessionMessage): void {
    // Ignore messages from this tab
    if (message.sourceTabId === this.tabId) return;
    
    // Handle targeted messages
    if (message.targetTabId && message.targetTabId !== this.tabId) return;

    console.log('[SessionSync v2] Received message:', message.type);

    switch (message.type) {
      case 'SESSION_SWITCH':
        this.handleSessionSwitch(message.session);
        break;
      case 'SESSION_UPDATE':
        this.handleSessionUpdate(message.session);
        break;
      case 'SESSION_LOGOUT':
        this.handleSessionLogout(message.session);
        break;
      case 'FORCE_LOGOUT_ALL':
        this.handleForceLogoutAll(message.logoutType);
        break;
      case 'SESSION_SYNC_REQUEST':
        this.handleSyncRequest(message.sourceTabId);
        break;
      case 'SESSION_SYNC_RESPONSE':
        this.handleSyncResponse(message.session);
        break;
    }
  }

  private handleSessionSwitch(newSession: SessionData | null): void {
    const previousSession = this.currentSession;
    this.currentSession = newSession;
    this.notifyListeners(newSession, previousSession);
  }

  private handleSessionUpdate(session: SessionData | null): void {
    if (session && this.currentSession?.userId === session.userId) {
      const previousSession = this.currentSession;
      this.currentSession = { ...this.currentSession, ...session };
      this.notifyListeners(this.currentSession, previousSession);
    }
  }

  private handleSessionLogout(session: SessionData | null): void {
    if (!session || (this.currentSession?.userType === session.userType)) {
      const previousSession = this.currentSession;
      this.currentSession = null;
      this.notifyListeners(null, previousSession);
      
      // Notify logout listeners
      if (session?.userType) {
        this.notifyLogoutListeners(session.userType);
      }
    }
  }

  private handleForceLogoutAll(logoutType?: UserType | 'all'): void {
    const previousSession = this.currentSession;
    
    if (logoutType === 'all') {
      // Clear all sessions
      localStorage.removeItem('staffSession');
      localStorage.removeItem('investorSession');
      localStorage.removeItem('staffSessionBackup');
      localStorage.removeItem('investorSessionBackup');
      this.currentSession = null;
      this.notifyListeners(null, previousSession);
      this.notifyLogoutListeners('all');
    } else if (logoutType === 'staff') {
      localStorage.removeItem('staffSession');
      localStorage.removeItem('staffSessionBackup');
      if (this.currentSession?.userType === 'staff') {
        this.currentSession = null;
        this.notifyListeners(null, previousSession);
      }
      this.notifyLogoutListeners('staff');
    } else if (logoutType === 'investor') {
      localStorage.removeItem('investorSession');
      localStorage.removeItem('investorSessionBackup');
      if (this.currentSession?.userType === 'investor') {
        this.currentSession = null;
        this.notifyListeners(null, previousSession);
      }
      this.notifyLogoutListeners('investor');
    }
  }

  private handleSyncRequest(sourceTabId: string): void {
    if (this.currentSession) {
      this.broadcast({
        type: 'SESSION_SYNC_RESPONSE',
        session: this.currentSession,
        sourceTabId: this.tabId,
        targetTabId: sourceTabId
      });
    }
  }

  private handleSyncResponse(session: SessionData | null): void {
    if (session && !this.currentSession) {
      this.currentSession = session;
      this.notifyListeners(session, null);
    }
  }

  private broadcast(message: SessionMessage): void {
    if (this.channel) {
      this.channel.postMessage(message);
    }
    
    if (this.useLocalStorage) {
      try {
        // Use a unique key with timestamp to ensure storage event fires
        localStorage.setItem(this.storageKey, JSON.stringify({
          ...message,
          _ts: Date.now()
        }));
      } catch (e) {
        console.error('[SessionSync v2] Failed to broadcast via localStorage', e);
      }
    }
  }

  private requestSync(): void {
    this.broadcast({
      type: 'SESSION_SYNC_REQUEST',
      session: null,
      sourceTabId: this.tabId
    });
  }

  private notifyListeners(session: SessionData | null, previousSession: SessionData | null): void {
    this.listeners.forEach(callback => {
      try {
        callback(session, previousSession);
      } catch (e) {
        console.error('[SessionSync v2] Listener error', e);
      }
    });
  }

  private notifyLogoutListeners(userType: UserType | 'all'): void {
    this.logoutListeners.forEach(callback => {
      try {
        callback(userType);
      } catch (e) {
        console.error('[SessionSync v2] Logout listener error', e);
      }
    });
  }

  // Public API

  /**
   * Subscribe to session changes
   */
  subscribe(callback: SessionChangeCallback): () => void {
    this.listeners.add(callback);
    
    // Immediately call with current session
    if (this.currentSession) {
      callback(this.currentSession, null);
    }
    
    // Return unsubscribe function
    return () => {
      this.listeners.delete(callback);
    };
  }

  /**
   * Subscribe to logout events across tabs
   */
  subscribeToLogout(callback: LogoutCallback): () => void {
    this.logoutListeners.add(callback);
    return () => {
      this.logoutListeners.delete(callback);
    };
  }

  /**
   * Get current session
   */
  getCurrentSession(): SessionData | null {
    return this.currentSession;
  }

  /**
   * Switch to a different account type (staff <-> investor)
   */
  switchAccount(newSession: SessionData): void {
    const previousSession = this.currentSession;
    this.currentSession = newSession;
    
    this.broadcast({
      type: 'SESSION_SWITCH',
      session: newSession,
      sourceTabId: this.tabId
    });
    
    this.notifyListeners(newSession, previousSession);
  }

  /**
   * Update current session data
   */
  updateSession(updates: Partial<SessionData>): void {
    if (!this.currentSession) return;
    
    this.currentSession = { ...this.currentSession, ...updates, timestamp: Date.now() };
    
    this.broadcast({
      type: 'SESSION_UPDATE',
      session: this.currentSession,
      sourceTabId: this.tabId
    });
  }

  /**
   * Logout from current session
   */
  logout(userType?: UserType): void {
    const sessionToLogout = userType 
      ? { ...this.currentSession, userType } as SessionData
      : this.currentSession;
    
    this.broadcast({
      type: 'SESSION_LOGOUT',
      session: sessionToLogout,
      sourceTabId: this.tabId
    });
    
    const previousSession = this.currentSession;
    this.currentSession = null;
    this.notifyListeners(null, previousSession);
  }

  /**
   * Force logout across all tabs
   */
  forceLogoutAll(userType: UserType | 'all' = 'all'): void {
    this.broadcast({
      type: 'FORCE_LOGOUT_ALL',
      session: null,
      sourceTabId: this.tabId,
      logoutType: userType
    });
    
    // Also handle locally
    this.handleForceLogoutAll(userType);
  }

  /**
   * Set staff session and sync across tabs
   */
  setStaffSession(staffData: any): void {
    const session: SessionData = {
      userId: staffData.id,
      userType: 'staff',
      email: staffData.email,
      name: staffData.name || `${staffData.first_name || ''} ${staffData.last_name || ''}`.trim(),
      linkedAccountId: staffData.linked_investor_id,
      linkedAccountType: staffData.linked_investor_id ? 'investor' : undefined,
      timestamp: Date.now()
    };
    
    this.switchAccount(session);
  }

  /**
   * Set investor session and sync across tabs
   */
  setInvestorSession(investorData: any): void {
    const session: SessionData = {
      userId: investorData.id,
      userType: 'investor',
      email: investorData.email,
      name: investorData.full_name || `${investorData.first_name || ''} ${investorData.last_name || ''}`.trim(),
      linkedAccountId: investorData.linked_staff_id,
      linkedAccountType: investorData.linked_staff_id ? 'staff' : undefined,
      timestamp: Date.now()
    };
    
    this.switchAccount(session);
  }

  /**
   * Check if accounts are linked
   */
  hasLinkedAccount(): boolean {
    return !!this.currentSession?.linkedAccountId;
  }

  /**
   * Get the linked account type
   */
  getLinkedAccountType(): UserType | undefined {
    return this.currentSession?.linkedAccountType;
  }

  /**
   * Get tab ID for debugging
   */
  getTabId(): string {
    return this.tabId;
  }

  /**
   * Clean up resources
   */
  destroy(): void {
    if (this.channel) {
      this.channel.close();
      this.channel = null;
    }
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
    this.listeners.clear();
    this.logoutListeners.clear();
    this.initialized = false;
  }
}

// Singleton instance
export const sessionSyncService = new SessionSyncService();

// React hook for using session sync
import { useState, useEffect } from 'react';

export function useSessionSync() {
  const [session, setSession] = useState<SessionData | null>(sessionSyncService.getCurrentSession());
  const [previousSession, setPreviousSession] = useState<SessionData | null>(null);

  useEffect(() => {
    const unsubscribe = sessionSyncService.subscribe((newSession, prevSession) => {
      setSession(newSession);
      setPreviousSession(prevSession);
    });

    return unsubscribe;
  }, []);

  return {
    session,
    previousSession,
    isStaff: session?.userType === 'staff',
    isInvestor: session?.userType === 'investor',
    hasLinkedAccount: sessionSyncService.hasLinkedAccount(),
    linkedAccountType: sessionSyncService.getLinkedAccountType(),
    switchAccount: sessionSyncService.switchAccount.bind(sessionSyncService),
    setStaffSession: sessionSyncService.setStaffSession.bind(sessionSyncService),
    setInvestorSession: sessionSyncService.setInvestorSession.bind(sessionSyncService),
    logout: sessionSyncService.logout.bind(sessionSyncService),
    forceLogoutAll: sessionSyncService.forceLogoutAll.bind(sessionSyncService),
    updateSession: sessionSyncService.updateSession.bind(sessionSyncService)
  };
}

/**
 * Hook to listen for logout events across tabs
 */
export function useLogoutSync(onLogout: (userType: UserType | 'all') => void) {
  useEffect(() => {
    const unsubscribe = sessionSyncService.subscribeToLogout(onLogout);
    return unsubscribe;
  }, [onLogout]);
}
