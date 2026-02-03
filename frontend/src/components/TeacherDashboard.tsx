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

export const TeacherDashboard: React.FC<TeacherDashboardProps> = ({
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

  /**
   * Fetch initial session data
   * Requirements: 12.4
   */
  const fetchSessionData = useCallback(async () => {
    try {
      const response = await fetch(`/api/sessions/${sessionId}`);
      
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
        return [...prev, newRecord];
      } else {
        // Update existing record
        const updated = [...prev];
        updated[index] = {
          ...updated[index],
          ...(update.entryStatus && { entryStatus: update.entryStatus }),
          ...(update.exitVerified !== undefined && { exitVerified: update.exitVerified }),
          ...(update.earlyLeaveAt !== undefined && { earlyLeaveAt: update.earlyLeaveAt }),
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
    try {
      setConnectionStatus('connecting');
      
      // Negotiate connection with backend
      const negotiateResponse = await fetch(`/api/sessions/${sessionId}/dashboard/negotiate`, {
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
      });
      
      // Start connection
      await connection.start();
      setConnectionStatus('connected');
      
      connectionRef.current = connection;
      
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to connect to SignalR';
      setError(errorMessage);
      setConnectionStatus('disconnected');
      if (onError) {
        onError(errorMessage);
      }
    }
  }, [sessionId, handleAttendanceUpdate, handleChainUpdate, handleStallAlert, fetchSessionData, onError]);

  /**
   * Initialize dashboard
   */
  useEffect(() => {
    // Fetch initial data
    fetchSessionData();
    
    // Connect to SignalR
    connectSignalR();
    
    // Cleanup on unmount
    return () => {
      if (connectionRef.current) {
        connectionRef.current.stop();
      }
    };
  }, [fetchSessionData, connectSignalR]);

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
      <div className="teacher-dashboard loading">
        <div className="loading-spinner">Loading dashboard...</div>
      </div>
    );
  }

  // Error state
  if (error && !session) {
    return (
      <div className="teacher-dashboard error">
        <div className="error-message" role="alert">
          <strong>Error:</strong> {error}
        </div>
        <button onClick={fetchSessionData} className="retry-button">
          Retry
        </button>
      </div>
    );
  }

  if (!session) {
    return null;
  }

  return (
    <div className="teacher-dashboard">
      {/* Header */}
      <div className="dashboard-header">
        <h1>Teacher Dashboard</h1>
        <div className="session-info">
          <span className="session-id">Session: {session.classId}</span>
          <span className={`session-status ${session.status.toLowerCase()}`}>
            {session.status}
          </span>
          <span className={`connection-status ${connectionStatus}`}>
            {connectionStatus === 'connected' && '🟢 Live'}
            {connectionStatus === 'connecting' && '🟡 Connecting...'}
            {connectionStatus === 'disconnected' && '🔴 Disconnected'}
          </span>
        </div>
      </div>

      {/* Error banner */}
      {error && (
        <div className="error-banner" role="alert">
          {error}
        </div>
      )}

      {/* Statistics Cards - Requirements: 12.4 */}
      <div className="stats-grid">
        <div className="stat-card total">
          <div className="stat-value">{stats.totalStudents}</div>
          <div className="stat-label">Total Students</div>
        </div>
        
        <div className="stat-card present">
          <div className="stat-value">{stats.presentEntry}</div>
          <div className="stat-label">Present Entry</div>
        </div>
        
        <div className="stat-card late">
          <div className="stat-value">{stats.lateEntry}</div>
          <div className="stat-label">Late Entry</div>
        </div>
        
        <div className="stat-card early-leave">
          <div className="stat-value">{stats.earlyLeave}</div>
          <div className="stat-label">Early Leave</div>
        </div>
        
        <div className="stat-card verified">
          <div className="stat-value">{stats.exitVerified}</div>
          <div className="stat-label">Exit Verified</div>
        </div>
        
        <div className="stat-card pending">
          <div className="stat-value">{stats.notYetVerified}</div>
          <div className="stat-label">Not Yet Verified</div>
        </div>
      </div>

      {/* Chain Status - Requirements: 12.2, 12.3 */}
      {chains.length > 0 && (
        <div className="chains-section">
          <h2>Chain Status</h2>
          <div className="chains-grid">
            {chains.map(chain => (
              <div 
                key={chain.chainId} 
                className={`chain-card ${chain.state.toLowerCase()} ${stalledChains.includes(chain.chainId) ? 'stalled' : ''}`}
              >
                <div className="chain-header">
                  <span className="chain-phase">{chain.phase}</span>
                  <span className={`chain-state ${chain.state.toLowerCase()}`}>
                    {chain.state}
                  </span>
                  {stalledChains.includes(chain.chainId) && (
                    <span className="stall-indicator" title="Chain is stalled">⚠️</span>
                  )}
                </div>
                <div className="chain-details">
                  <div className="chain-detail">
                    <span className="label">Chain ID:</span>
                    <span className="value">{chain.chainId.substring(0, 8)}...</span>
                  </div>
                  <div className="chain-detail">
                    <span className="label">Last Holder:</span>
                    <span className="value">{chain.lastHolder || 'None'}</span>
                  </div>
                  <div className="chain-detail">
                    <span className="label">Sequence:</span>
                    <span className="value">{chain.lastSeq}</span>
                  </div>
                  <div className="chain-detail">
                    <span className="label">Last Activity:</span>
                    <span className="value">{formatTimestamp(chain.lastAt)}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Chain Management Controls - Requirements: 3.1, 6.1, 11.3 */}
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

      {/* Student List - Requirements: 12.4 */}
      <div className="students-section">
        <h2>Student Attendance ({attendance.length})</h2>
        
        {attendance.length === 0 ? (
          <div className="empty-state">
            <p>No students have joined this session yet.</p>
          </div>
        ) : (
          <div className="students-table-container">
            <table className="students-table">
              <thead>
                <tr>
                  <th>Student ID</th>
                  <th>Status</th>
                  <th>Entry Time</th>
                  <th>Exit Verified</th>
                  <th>Exit Time</th>
                  <th>Early Leave</th>
                </tr>
              </thead>
              <tbody>
                {attendance.map(record => (
                  <tr key={record.studentId} className={getStatusBadgeClass(record)}>
                    <td className="student-id">{record.studentId}</td>
                    <td>
                      <span className={`status-badge ${getStatusBadgeClass(record)}`}>
                        {getStatusText(record)}
                      </span>
                    </td>
                    <td>{formatTimestamp(record.entryAt)}</td>
                    <td>
                      <span className={`verification-badge ${record.exitVerified ? 'verified' : 'not-verified'}`}>
                        {record.exitVerified ? '✓ Yes' : '✗ No'}
                      </span>
                    </td>
                    <td>{formatTimestamp(record.exitVerifiedAt)}</td>
                    <td>
                      {record.earlyLeaveAt ? (
                        <span className="early-leave-time">
                          {formatTimestamp(record.earlyLeaveAt)}
                        </span>
                      ) : (
                        '—'
                      )}
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
