/**
 * Teacher Dashboard Component
 * 
 * Requirements: 12.1, 12.2, 12.3, 12.4
 * 
 * Real-time dashboard for teachers to monitor attendance status and chain progress.
 * Connects to Azure SignalR Service for live updates.
 * 
 * Features:
 * - Real-time attendance counts by status
 * - Chain status display with stall indicators
 * - Student list with current status
 * - SignalR connection for push updates
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import * as signalR from '@microsoft/signalr';
import { ChainManagementControls } from './ChainManagementControls';
import { SessionEndAndExportControls } from './SessionEndAndExportControls';

// Type definitions
enum EntryStatus {
  PRESENT_ENTRY = "PRESENT_ENTRY",
  LATE_ENTRY = "LATE_ENTRY"
}

enum FinalStatus {
  PRESENT = "PRESENT",
  LATE = "LATE",
  LEFT_EARLY = "LEFT_EARLY",
  EARLY_LEAVE = "EARLY_LEAVE",
  ABSENT = "ABSENT"
}

enum SessionStatus {
  ACTIVE = "ACTIVE",
  ENDED = "ENDED"
}

enum ChainPhase {
  ENTRY = "ENTRY",
  EXIT = "EXIT"
}

enum ChainState {
  ACTIVE = "ACTIVE",
  STALLED = "STALLED",
  COMPLETED = "COMPLETED"
}

interface SessionConstraints {
  geofence?: {
    latitude: number;
    longitude: number;
    radiusMeters: number;
  };
  wifiAllowlist?: string[];
}

interface Session {
  sessionId: string;
  classId: string;
  teacherId: string;
  startAt: string;
  endAt: string;
  lateCutoffMinutes: number;
  exitWindowMinutes: number;
  status: SessionStatus;
  ownerTransfer: boolean;
  constraints?: SessionConstraints;
  lateEntryActive: boolean;
  currentLateTokenId?: string;
  earlyLeaveActive: boolean;
  currentEarlyTokenId?: string;
  createdAt: string;
  endedAt?: string;
}

interface AttendanceRecord {
  sessionId: string;
  studentId: string;
  entryStatus?: EntryStatus;
  entryAt?: number;
  exitVerified: boolean;
  exitVerifiedAt?: number;
  earlyLeaveAt?: number;
  finalStatus?: FinalStatus;
}

interface Chain {
  sessionId: string;
  phase: ChainPhase;
  chainId: string;
  index: number;
  state: ChainState;
  lastHolder?: string;
  lastSeq: number;
  lastAt?: number;
}

interface SessionStats {
  totalStudents: number;
  presentEntry: number;
  lateEntry: number;
  earlyLeave: number;
  exitVerified: number;
  notYetVerified: number;
}

interface SessionStatusResponse {
  session: Session;
  attendance: AttendanceRecord[];
  chains: Chain[];
  stats: SessionStats;
}

interface AttendanceUpdate {
  studentId: string;
  entryStatus?: EntryStatus;
  exitVerified?: boolean;
  earlyLeaveAt?: number;
}

interface ChainUpdate {
  chainId: string;
  phase: ChainPhase;
  lastHolder: string;
  lastSeq: number;
  state: ChainState;
}

interface TeacherDashboardProps {
  sessionId: string;
  onError?: (error: string) => void;
}

const TeacherDashboardComponent: React.FC<TeacherDashboardProps> = ({
  sessionId,
  onError,
}) => {
  // State management
  const [session, setSession] = useState<Session | null>(null);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [chains, setChains] = useState<Chain[]>([]);
  const [stats, setStats] = useState<SessionStats>({
    totalStudents: 0,
    presentEntry: 0,
    lateEntry: 0,
    earlyLeave: 0,
    exitVerified: 0,
    notYetVerified: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<'disconnected' | 'connecting' | 'connected'>('disconnected');
  const [stalledChains, setStalledChains] = useState<string[]>([]);

  // SignalR connection ref
  const connectionRef = useRef<signalR.HubConnection | null>(null);
  const isConnectingRef = useRef<boolean>(false);

  /**
   * Fetch initial session data
   * Requirements: 12.4
   */
  const fetchSessionData = useCallback(async () => {
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || '/api';
      
      // Create headers with authentication
      const headers: HeadersInit = {
        'Content-Type': 'application/json'
      };
      
      // Add authentication header
      const isLocal = process.env.NEXT_PUBLIC_ENVIRONMENT === 'local';
      if (isLocal) {
        const mockPrincipal = {
          userId: 'local-dev-teacher-' + Date.now(),
          userDetails: 'teacher@vtc.edu.hk',
          userRoles: ['authenticated', 'teacher'],
          identityProvider: 'aad'
        };
        headers['x-ms-client-principal'] = Buffer.from(JSON.stringify(mockPrincipal)).toString('base64');
      } else {
        const authResponse = await fetch('/.auth/me', { credentials: 'include' });
        const authData = await authResponse.json();
        if (authData.clientPrincipal) {
          headers['x-ms-client-principal'] = Buffer.from(JSON.stringify(authData.clientPrincipal)).toString('base64');
        } else {
          throw new Error('Not authenticated');
        }
      }
      
      const response = await fetch(`${apiUrl}/sessions/${sessionId}`, {
        headers
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          errorData.error?.message || `Failed to fetch session: ${response.statusText}`
        );
      }
      
      const data: SessionStatusResponse = await response.json();
      
      setSession(data.session);
      setAttendance(data.attendance);
      setChains(data.chains);
      setStats(data.stats);
      
      // Identify stalled chains (Requirement 12.3)
      const stalled = data.chains
        .filter(chain => chain.state === ChainState.STALLED)
        .map(chain => chain.chainId);
      setStalledChains(stalled);
      
      setError(null);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch session data';
      setError(errorMessage);
      if (onError) {
        onError(errorMessage);
      }
    } finally {
      setLoading(false);
    }
  }, [sessionId, onError]);

  /**
   * Handle attendance update from SignalR
   * Requirements: 12.1
   */
  const handleAttendanceUpdate = useCallback((update: AttendanceUpdate) => {
    setAttendance(prev => {
      const index = prev.findIndex(a => a.studentId === update.studentId);
      
      if (index === -1) {
        // New student record
        const newRecord: AttendanceRecord = {
          sessionId,
          studentId: update.studentId,
          entryStatus: update.entryStatus,
          exitVerified: update.exitVerified ?? false,
          earlyLeaveAt: update.earlyLeaveAt,
        };
        // Add isOnline if provided
        if ('isOnline' in update) {
          (newRecord as any).isOnline = update.isOnline;
        }
        return [...prev, newRecord];
      } else {
        // Update existing record
        const updated = [...prev];
        updated[index] = {
          ...updated[index],
          ...(update.entryStatus && { entryStatus: update.entryStatus }),
          ...(update.exitVerified !== undefined && { exitVerified: update.exitVerified }),
          ...(update.earlyLeaveAt !== undefined && { earlyLeaveAt: update.earlyLeaveAt }),
          ...('isOnline' in update && { isOnline: update.isOnline }),
        };
        return updated;
      }
    });

    // Recompute stats
    setStats(prev => {
      const newStats = { ...prev };
      
      if (update.entryStatus === EntryStatus.PRESENT_ENTRY) {
        newStats.presentEntry++;
      } else if (update.entryStatus === EntryStatus.LATE_ENTRY) {
        newStats.lateEntry++;
      }
      
      if (update.earlyLeaveAt !== undefined) {
        newStats.earlyLeave++;
      }
      
      if (update.exitVerified) {
        newStats.exitVerified++;
      }
      
      return newStats;
    });
  }, [sessionId]);

  /**
   * Handle chain update from SignalR
   * Requirements: 12.2
   */
  const handleChainUpdate = useCallback((update: ChainUpdate) => {
    setChains(prev => {
      const index = prev.findIndex(c => c.chainId === update.chainId);
      
      if (index === -1) {
        // New chain
        const newChain: Chain = {
          sessionId,
          chainId: update.chainId,
          phase: update.phase,
          lastHolder: update.lastHolder,
          lastSeq: update.lastSeq,
          state: update.state,
          index: 0,
          lastAt: Date.now() / 1000,
        };
        return [...prev, newChain];
      } else {
        // Update existing chain
        const updated = [...prev];
        updated[index] = {
          ...updated[index],
          lastHolder: update.lastHolder,
          lastSeq: update.lastSeq,
          state: update.state,
          lastAt: Date.now() / 1000,
        };
        return updated;
      }
    });
  }, [sessionId]);

  /**
   * Handle stall alert from SignalR
   * Requirements: 12.3
   */
  const handleStallAlert = useCallback((chainIds: string[]) => {
    setStalledChains(chainIds);
    
    // Update chain states
    setChains(prev => 
      prev.map(chain => 
        chainIds.includes(chain.chainId)
          ? { ...chain, state: ChainState.STALLED }
          : chain
      )
    );
  }, []);

  /**
   * Establish SignalR connection
   * Requirements: 12.1, 12.2, 12.3, 12.6
   */
  const connectSignalR = useCallback(async () => {
    // Prevent multiple simultaneous connection attempts
    if (isConnectingRef.current || connectionRef.current) {
      return;
    }
    
    isConnectingRef.current = true;
    
    try {
      setConnectionStatus('connecting');
      
      // Negotiate connection with backend
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || '/api';
      const negotiateResponse = await fetch(`${apiUrl}/sessions/${sessionId}/dashboard/negotiate`, {
        method: 'POST',
      });
      
      if (!negotiateResponse.ok) {
        throw new Error('Failed to negotiate SignalR connection');
      }
      
      const connectionInfo = await negotiateResponse.json();
      
      // Create SignalR connection
      const connection = new signalR.HubConnectionBuilder()
        .withUrl(connectionInfo.url, {
          accessTokenFactory: () => connectionInfo.accessToken,
        })
        .withAutomaticReconnect({
          nextRetryDelayInMilliseconds: (retryContext) => {
            // Exponential backoff: 0s, 2s, 10s, 30s, then 30s
            if (retryContext.previousRetryCount === 0) return 0;
            if (retryContext.previousRetryCount === 1) return 2000;
            if (retryContext.previousRetryCount === 2) return 10000;
            return 30000;
          },
        })
        .configureLogging(signalR.LogLevel.Information)
        .build();
      
      // Register event handlers
      connection.on('attendanceUpdate', handleAttendanceUpdate);
      connection.on('chainUpdate', handleChainUpdate);
      connection.on('stallAlert', handleStallAlert);
      
      // Handle reconnection events
      connection.onreconnecting(() => {
        setConnectionStatus('connecting');
      });
      
      connection.onreconnected(() => {
        setConnectionStatus('connected');
        // Refresh data after reconnection
        fetchSessionData();
      });
      
      connection.onclose(() => {
        setConnectionStatus('disconnected');
        isConnectingRef.current = false;
        connectionRef.current = null;
      });
      
      // Start connection
      await connection.start();
      setConnectionStatus('connected');
      
      connectionRef.current = connection;
      isConnectingRef.current = false;
      
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to connect to SignalR';
      setError(errorMessage);
      setConnectionStatus('disconnected');
      isConnectingRef.current = false;
      if (onError) {
        onError(errorMessage);
      }
    }
  }, [sessionId, handleAttendanceUpdate, handleChainUpdate, handleStallAlert, fetchSessionData, onError]);

  /**
   * Initialize dashboard
   */
  useEffect(() => {
    // Only run once when sessionId changes
    // Fetch initial data
    fetchSessionData();
    
    // Connect to SignalR only if not already connected
    if (!connectionRef.current && !isConnectingRef.current) {
      connectSignalR();
    }
    
    // Fallback polling for local dev (when SignalR is not available)
    // Poll every 5 seconds to update online status and holder info
    const pollInterval = setInterval(() => {
      if (connectionRef.current?.state !== signalR.HubConnectionState.Connected) {
        // Only poll if SignalR is not connected
        fetchSessionData();
      }
    }, 5000); // 5 seconds
    
    // Cleanup on unmount
    return () => {
      if (connectionRef.current) {
        connectionRef.current.stop();
        connectionRef.current = null;
      }
      isConnectingRef.current = false;
      clearInterval(pollInterval);
    };
  }, [sessionId]); // ONLY depend on sessionId - nothing else!

  /**
   * Format timestamp for display
   */
  const formatTimestamp = (timestamp?: number): string => {
    if (!timestamp) return 'N/A';
    return new Date(timestamp * 1000).toLocaleTimeString();
  };

  /**
   * Get status badge class
   */
  const getStatusBadgeClass = (record: AttendanceRecord): string => {
    if (record.earlyLeaveAt) return 'status-early-leave';
    if (record.entryStatus === EntryStatus.PRESENT_ENTRY && record.exitVerified) return 'status-present';
    if (record.entryStatus === EntryStatus.LATE_ENTRY && record.exitVerified) return 'status-late';
    if (record.entryStatus === EntryStatus.PRESENT_ENTRY) return 'status-present-entry';
    if (record.entryStatus === EntryStatus.LATE_ENTRY) return 'status-late-entry';
    return 'status-absent';
  };

  /**
   * Get status display text
   */
  const getStatusText = (record: AttendanceRecord): string => {
    if (record.finalStatus) return record.finalStatus;
    if (record.earlyLeaveAt) return 'Early Leave';
    if (record.entryStatus === EntryStatus.PRESENT_ENTRY && record.exitVerified) return 'Present (Verified)';
    if (record.entryStatus === EntryStatus.LATE_ENTRY && record.exitVerified) return 'Late (Verified)';
    if (record.entryStatus === EntryStatus.PRESENT_ENTRY) return 'Present Entry';
    if (record.entryStatus === EntryStatus.LATE_ENTRY) return 'Late Entry';
    return 'Not Yet Marked';
  };

  // Loading state
  if (loading) {
    return (
      <div style={{ 
        padding: '4rem 2rem',
        textAlign: 'center',
        backgroundColor: 'white',
        borderRadius: '16px',
        boxShadow: '0 8px 32px rgba(0,0,0,0.08)'
      }}>
        <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>⏳</div>
        <p style={{ color: '#718096', fontSize: '1.1rem' }}>Loading dashboard...</p>
      </div>
    );
  }

  // Error state
  if (error && !session) {
    return (
      <div style={{
        padding: '2rem',
        backgroundColor: 'white',
        borderRadius: '16px',
        boxShadow: '0 8px 32px rgba(0,0,0,0.08)'
      }}>
        <div style={{
          padding: '1.5rem',
          backgroundColor: '#fff5f5',
          border: '2px solid #fc8181',
          borderRadius: '12px',
          marginBottom: '1.5rem',
          color: '#c53030'
        }}>
          <strong>Error:</strong> {error}
        </div>
        <button 
          onClick={fetchSessionData}
          style={{
            padding: '0.875rem 1.5rem',
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            color: 'white',
            border: 'none',
            borderRadius: '10px',
            cursor: 'pointer',
            fontSize: '0.95rem',
            fontWeight: '600',
            boxShadow: '0 4px 12px rgba(102, 126, 234, 0.3)'
          }}
        >
          Retry
        </button>
      </div>
    );
  }

  if (!session) {
    return null;
  }

  return (
    <div>
      {/* Session Status Header */}
      <div style={{
        backgroundColor: 'white',
        padding: '1.5rem 2rem',
        borderRadius: '12px',
        marginBottom: '1.5rem',
        boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '1rem'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
          <span style={{
            padding: '0.5rem 1rem',
            backgroundColor: session.status === 'ACTIVE' ? '#48bb78' : '#a0aec0',
            color: 'white',
            borderRadius: '20px',
            fontSize: '0.875rem',
            fontWeight: '700',
            textTransform: 'uppercase',
            letterSpacing: '0.5px'
          }}>
            {session.status}
          </span>
          <span style={{
            padding: '0.5rem 1rem',
            backgroundColor: connectionStatus === 'connected' ? '#48bb78' : connectionStatus === 'connecting' ? '#ed8936' : '#e53e3e',
            color: 'white',
            borderRadius: '20px',
            fontSize: '0.875rem',
            fontWeight: '600'
          }}>
            {connectionStatus === 'connected' && '🟢 Live'}
            {connectionStatus === 'connecting' && '🟡 Connecting...'}
            {connectionStatus === 'disconnected' && '🔴 Disconnected'}
          </span>
        </div>
      </div>

      {/* Error banner */}
      {error && (
        <div style={{
          padding: '1rem 1.25rem',
          backgroundColor: '#fff5f5',
          border: '2px solid #fc8181',
          borderRadius: '10px',
          marginBottom: '1.5rem',
          color: '#c53030'
        }}>
          {error}
        </div>
      )}

      {/* Statistics Cards */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
        gap: '1rem',
        marginBottom: '2rem'
      }}>
        <div style={{
          backgroundColor: 'white',
          padding: '1.5rem',
          borderRadius: '12px',
          boxShadow: '0 4px 16px rgba(0,0,0,0.08)',
          textAlign: 'center',
          border: '2px solid #667eea'
        }}>
          <div style={{ fontSize: '2.5rem', fontWeight: '700', color: '#667eea', marginBottom: '0.5rem' }}>
            {stats.totalStudents}
          </div>
          <div style={{ color: '#718096', fontSize: '0.875rem', fontWeight: '600' }}>
            Total Students
          </div>
        </div>
        
        <div style={{
          backgroundColor: 'white',
          padding: '1.5rem',
          borderRadius: '12px',
          boxShadow: '0 4px 16px rgba(0,0,0,0.08)',
          textAlign: 'center',
          border: '2px solid #48bb78'
        }}>
          <div style={{ fontSize: '2.5rem', fontWeight: '700', color: '#48bb78', marginBottom: '0.5rem' }}>
            {(stats as any).onlineStudents || 0}
          </div>
          <div style={{ color: '#718096', fontSize: '0.875rem', fontWeight: '600' }}>
            🟢 Online Now
          </div>
        </div>
        
        <div style={{
          backgroundColor: 'white',
          padding: '1.5rem',
          borderRadius: '12px',
          boxShadow: '0 4px 16px rgba(0,0,0,0.08)',
          textAlign: 'center',
          border: '2px solid #48bb78'
        }}>
          <div style={{ fontSize: '2.5rem', fontWeight: '700', color: '#48bb78', marginBottom: '0.5rem' }}>
            {stats.presentEntry}
          </div>
          <div style={{ color: '#718096', fontSize: '0.875rem', fontWeight: '600' }}>
            Present Entry
          </div>
        </div>
        
        <div style={{
          backgroundColor: 'white',
          padding: '1.5rem',
          borderRadius: '12px',
          boxShadow: '0 4px 16px rgba(0,0,0,0.08)',
          textAlign: 'center',
          border: '2px solid #ed8936'
        }}>
          <div style={{ fontSize: '2.5rem', fontWeight: '700', color: '#ed8936', marginBottom: '0.5rem' }}>
            {stats.lateEntry}
          </div>
          <div style={{ color: '#718096', fontSize: '0.875rem', fontWeight: '600' }}>
            Late Entry
          </div>
        </div>
        
        <div style={{
          backgroundColor: 'white',
          padding: '1.5rem',
          borderRadius: '12px',
          boxShadow: '0 4px 16px rgba(0,0,0,0.08)',
          textAlign: 'center',
          border: '2px solid #f6ad55'
        }}>
          <div style={{ fontSize: '2.5rem', fontWeight: '700', color: '#f6ad55', marginBottom: '0.5rem' }}>
            {stats.earlyLeave}
          </div>
          <div style={{ color: '#718096', fontSize: '0.875rem', fontWeight: '600' }}>
            Early Leave
          </div>
        </div>
        
        <div style={{
          backgroundColor: 'white',
          padding: '1.5rem',
          borderRadius: '12px',
          boxShadow: '0 4px 16px rgba(0,0,0,0.08)',
          textAlign: 'center',
          border: '2px solid #4299e1'
        }}>
          <div style={{ fontSize: '2.5rem', fontWeight: '700', color: '#4299e1', marginBottom: '0.5rem' }}>
            {stats.exitVerified}
          </div>
          <div style={{ color: '#718096', fontSize: '0.875rem', fontWeight: '600' }}>
            Exit Verified
          </div>
        </div>
        
        <div style={{
          backgroundColor: 'white',
          padding: '1.5rem',
          borderRadius: '12px',
          boxShadow: '0 4px 16px rgba(0,0,0,0.08)',
          textAlign: 'center',
          border: '2px solid #a0aec0'
        }}>
          <div style={{ fontSize: '2.5rem', fontWeight: '700', color: '#a0aec0', marginBottom: '0.5rem' }}>
            {stats.notYetVerified}
          </div>
          <div style={{ color: '#718096', fontSize: '0.875rem', fontWeight: '600' }}>
            Not Yet Verified
          </div>
        </div>
      </div>

      {/* Chain Management Controls */}
      <div style={{ marginBottom: '2rem' }}>
        <ChainManagementControls
          sessionId={sessionId}
          chains={chains}
          stalledChains={stalledChains}
          onChainsUpdated={fetchSessionData}
          onError={(error) => {
            setError(error);
            if (onError) {
              onError(error);
            }
          }}
        />
      </div>

      {/* Session End and Export Controls */}
      <div style={{ marginBottom: '2rem' }}>
        <SessionEndAndExportControls
          sessionId={sessionId}
          sessionStatus={session.status}
          onSessionEnded={(finalAttendance) => {
            // Refresh session data after ending
            fetchSessionData();
          }}
          onError={(error) => {
            setError(error);
            if (onError) {
              onError(error);
            }
          }}
        />
      </div>

      {/* Student List */}
      <div style={{
        backgroundColor: 'white',
        padding: '2rem',
        borderRadius: '16px',
        boxShadow: '0 8px 32px rgba(0,0,0,0.08)',
        marginTop: '2rem'
      }}>
        <h2 style={{ 
          color: '#2d3748',
          fontSize: '1.5rem',
          marginBottom: '1.5rem',
          fontWeight: '700'
        }}>
          👥 Student Attendance ({attendance.length})
        </h2>
        
        {attendance.length === 0 ? (
          <div style={{
            padding: '3rem 2rem',
            textAlign: 'center',
            backgroundColor: '#f7fafc',
            borderRadius: '12px'
          }}>
            <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>👥</div>
            <p style={{ color: '#718096', fontSize: '1.1rem', margin: 0 }}>
              No students have joined this session yet.
            </p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{
              width: '100%',
              borderCollapse: 'collapse',
              fontSize: '0.95rem'
            }}>
              <thead>
                <tr style={{ backgroundColor: '#f7fafc' }}>
                  <th style={{ 
                    padding: '1rem',
                    textAlign: 'left',
                    fontWeight: '600',
                    color: '#4a5568',
                    borderBottom: '2px solid #e2e8f0'
                  }}>Student ID</th>
                  <th style={{ 
                    padding: '1rem',
                    textAlign: 'center',
                    fontWeight: '600',
                    color: '#4a5568',
                    borderBottom: '2px solid #e2e8f0'
                  }}>Online</th>
                  <th style={{ 
                    padding: '1rem',
                    textAlign: 'center',
                    fontWeight: '600',
                    color: '#4a5568',
                    borderBottom: '2px solid #e2e8f0'
                  }}>Chain Holder</th>
                  <th style={{ 
                    padding: '1rem',
                    textAlign: 'left',
                    fontWeight: '600',
                    color: '#4a5568',
                    borderBottom: '2px solid #e2e8f0'
                  }}>Status</th>
                  <th style={{ 
                    padding: '1rem',
                    textAlign: 'left',
                    fontWeight: '600',
                    color: '#4a5568',
                    borderBottom: '2px solid #e2e8f0'
                  }}>Entry Time</th>
                  <th style={{ 
                    padding: '1rem',
                    textAlign: 'center',
                    fontWeight: '600',
                    color: '#4a5568',
                    borderBottom: '2px solid #e2e8f0'
                  }}>Exit Verified</th>
                  <th style={{ 
                    padding: '1rem',
                    textAlign: 'left',
                    fontWeight: '600',
                    color: '#4a5568',
                    borderBottom: '2px solid #e2e8f0'
                  }}>Exit Time</th>
                  <th style={{ 
                    padding: '1rem',
                    textAlign: 'left',
                    fontWeight: '600',
                    color: '#4a5568',
                    borderBottom: '2px solid #e2e8f0'
                  }}>Early Leave</th>
                </tr>
              </thead>
              <tbody>
                {attendance.map(record => (
                  <tr key={record.studentId} style={{
                    borderBottom: '1px solid #e2e8f0',
                    transition: 'background-color 0.2s'
                  }}
                  onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#f7fafc'}
                  onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                  >
                    <td style={{ padding: '1rem', color: '#2d3748', fontWeight: '500' }}>
                      {record.studentId || 'Unknown'}
                    </td>
                    <td style={{ padding: '1rem', textAlign: 'center' }}>
                      <span style={{
                        padding: '0.375rem 0.75rem',
                        backgroundColor: (record as any).isOnline ? '#c6f6d5' : '#e2e8f0',
                        color: (record as any).isOnline ? '#22543d' : '#718096',
                        borderRadius: '12px',
                        fontSize: '0.875rem',
                        fontWeight: '600'
                      }}>
                        {(record as any).isOnline ? '🟢 Online' : '⚪ Offline'}
                      </span>
                    </td>
                    <td style={{ padding: '1rem', textAlign: 'center' }}>
                      {(record as any).isHolder ? (
                        <span style={{
                          padding: '0.375rem 0.75rem',
                          backgroundColor: '#fff3cd',
                          color: '#856404',
                          borderRadius: '12px',
                          fontSize: '0.875rem',
                          fontWeight: '600',
                          border: '2px solid #ffc107'
                        }}>
                          🎯 Holder
                        </span>
                      ) : (
                        <span style={{ color: '#a0aec0', fontSize: '0.875rem' }}>—</span>
                      )}
                    </td>
                    <td style={{ padding: '1rem' }}>
                      <span style={{
                        padding: '0.375rem 0.75rem',
                        backgroundColor: 
                          record.entryStatus === EntryStatus.PRESENT_ENTRY ? '#c6f6d5' :
                          record.entryStatus === EntryStatus.LATE_ENTRY ? '#fed7d7' :
                          '#e2e8f0',
                        color:
                          record.entryStatus === EntryStatus.PRESENT_ENTRY ? '#22543d' :
                          record.entryStatus === EntryStatus.LATE_ENTRY ? '#742a2a' :
                          '#4a5568',
                        borderRadius: '12px',
                        fontSize: '0.875rem',
                        fontWeight: '600'
                      }}>
                        {getStatusText(record)}
                      </span>
                    </td>
                    <td style={{ padding: '1rem', color: '#718096' }}>
                      {formatTimestamp(record.entryAt)}
                    </td>
                    <td style={{ padding: '1rem', textAlign: 'center' }}>
                      <span style={{
                        padding: '0.375rem 0.75rem',
                        backgroundColor: record.exitVerified ? '#c6f6d5' : '#fed7d7',
                        color: record.exitVerified ? '#22543d' : '#742a2a',
                        borderRadius: '12px',
                        fontSize: '0.875rem',
                        fontWeight: '600'
                      }}>
                        {record.exitVerified ? '✓ Yes' : '✗ No'}
                      </span>
                    </td>
                    <td style={{ padding: '1rem', color: '#718096' }}>
                      {formatTimestamp(record.exitVerifiedAt)}
                    </td>
                    <td style={{ padding: '1rem', color: '#718096' }}>
                      {record.earlyLeaveAt ? formatTimestamp(record.earlyLeaveAt) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export const TeacherDashboard = React.memo(TeacherDashboardComponent);
