/**
 * Session End and Export Controls Component
 * Feature: qr-chain-attendance
 * Requirements: 2.3, 14.1, 14.2, 14.3
 * 
 * Provides controls for teachers to:
 * - End a session and compute final attendance
 * - Display final attendance summary
 * - Export attendance data as JSON
 */

import React, { useState } from 'react';

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

interface AttendanceRecord {
  sessionId: string;
  studentId: string;
  entryStatus?: EntryStatus;
  entryAt?: number;
  exitVerified: boolean;
  exitVerifiedAt?: number;
  earlyLeaveAt?: number;
  finalStatus?: FinalStatus;
  joinedAt?: number;
  locationWarning?: string;
  locationDistance?: number;
}

interface EndSessionResponse {
  finalAttendance: AttendanceRecord[];
}

interface AttendanceResponse {
  attendance: AttendanceRecord[];
}

interface SessionEndAndExportControlsProps {
  sessionId: string;
  sessionStatus: SessionStatus;
  onSessionEnded?: (finalAttendance: AttendanceRecord[]) => void;
  onError?: (error: string) => void;
}

export const SessionEndAndExportControls: React.FC<SessionEndAndExportControlsProps> = ({
  sessionId,
  sessionStatus,
  onSessionEnded,
  onError,
}) => {
  // State
  const [isEnding, setIsEnding] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [finalAttendance, setFinalAttendance] = useState<AttendanceRecord[] | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  /**
   * End the session and compute final attendance
   * Requirements: 2.3, 14.1, 14.2
   */
  const handleEndSession = async () => {
    setIsEnding(true);
    setSuccessMessage(null);

    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || '/api';
      
      // Get authentication
      const isLocal = process.env.NEXT_PUBLIC_ENVIRONMENT === 'local';
      const authEndpoint = isLocal ? '/api/auth/me' : '/.auth/me';
      const authResponse = await fetch(authEndpoint, { credentials: 'include' });
      const authData = await authResponse.json();
      
      if (!authData.clientPrincipal) {
        throw new Error('Not authenticated');
      }
      
      // Create headers with authentication
      const headers: HeadersInit = {
        'Content-Type': 'application/json',
        'x-ms-client-principal': Buffer.from(JSON.stringify(authData.clientPrincipal)).toString('base64')
      };
      
      const response = await fetch(`${apiUrl}/sessions/${sessionId}/end`, {
        method: 'POST',
        headers
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          errorData.error?.message || `Failed to end session: ${response.statusText}`
        );
      }

      const data: EndSessionResponse = await response.json();
      
      setFinalAttendance(data.finalAttendance);
      setSuccessMessage(
        `Session ended successfully. Final attendance computed for ${data.finalAttendance.length} student(s).`
      );

      // Notify parent component
      if (onSessionEnded) {
        onSessionEnded(data.finalAttendance);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to end session';
      if (onError) {
        onError(errorMessage);
      }
    } finally {
      setIsEnding(false);
    }
  };

  /**
   * Export attendance data as JSON
   * Requirements: 14.1, 14.2, 14.3
   */
  const handleExportAttendance = async () => {
    setIsExporting(true);
    setSuccessMessage(null);

    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || '/api';
      
      // Get authentication
      const isLocal = process.env.NEXT_PUBLIC_ENVIRONMENT === 'local';
      const authEndpoint = isLocal ? '/api/auth/me' : '/.auth/me';
      const authResponse = await fetch(authEndpoint, { credentials: 'include' });
      const authData = await authResponse.json();
      
      if (!authData.clientPrincipal) {
        throw new Error('Not authenticated');
      }
      
      // Create headers with authentication
      const headers: HeadersInit = {
        'Content-Type': 'application/json',
        'x-ms-client-principal': Buffer.from(JSON.stringify(authData.clientPrincipal)).toString('base64')
      };
      
      const response = await fetch(`${apiUrl}/sessions/${sessionId}/attendance`, {
        headers
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          errorData.error?.message || `Failed to export attendance: ${response.statusText}`
        );
      }

      const data: AttendanceResponse = await response.json();

      // Create JSON blob and download
      const jsonString = JSON.stringify(data.attendance, null, 2);
      const blob = new Blob([jsonString], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      
      // Create download link
      const link = document.createElement('a');
      link.href = url;
      link.download = `attendance-${sessionId}-${new Date().toISOString()}.json`;
      document.body.appendChild(link);
      link.click();
      
      // Cleanup
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      setSuccessMessage(
        `Attendance data exported successfully for ${data.attendance.length} student(s).`
      );
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to export attendance';
      if (onError) {
        onError(errorMessage);
      }
    } finally {
      setIsExporting(false);
    }
  };

  /**
   * Export attendance data as CSV
   * Requirements: 14.1, 14.2, 14.3
   */
  const handleExportCSV = async () => {
    setIsExporting(true);
    setSuccessMessage(null);

    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || '/api';
      
      // Get authentication
      const isLocal = process.env.NEXT_PUBLIC_ENVIRONMENT === 'local';
      const authEndpoint = isLocal ? '/api/auth/me' : '/.auth/me';
      const authResponse = await fetch(authEndpoint, { credentials: 'include' });
      const authData = await authResponse.json();
      
      if (!authData.clientPrincipal) {
        throw new Error('Not authenticated');
      }
      
      // Create headers with authentication
      const headers: HeadersInit = {
        'Content-Type': 'application/json',
        'x-ms-client-principal': Buffer.from(JSON.stringify(authData.clientPrincipal)).toString('base64')
      };
      
      const response = await fetch(`${apiUrl}/sessions/${sessionId}/attendance`, {
        headers
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          errorData.error?.message || `Failed to export attendance: ${response.statusText}`
        );
      }

      const data: AttendanceResponse = await response.json();

      // Helper function to format student ID
      const formatStudentId = (studentId: string): string => {
        if (!studentId) return '';
        return studentId.replace('@stu.vtc.edu.hk', '');
      };

      // Convert to CSV format
      const csvHeaders = [
        'Student ID',
        'Join Time',
        'Entry Status',
        'Entry Time',
        'Exit Verified',
        'Exit Time',
        'Early Leave Time',
        'Final Status',
        'Location Warning',
        'Location Distance (m)'
      ];

      const rows = data.attendance.map(record => [
        formatStudentId(record.studentId),
        record.joinedAt ? new Date(record.joinedAt * 1000).toLocaleString() : '',
        record.entryStatus || '',
        record.entryAt ? new Date(record.entryAt * 1000).toLocaleString() : '',
        record.exitVerified ? 'Yes' : 'No',
        record.exitVerifiedAt ? new Date(record.exitVerifiedAt * 1000).toLocaleString() : '',
        record.earlyLeaveAt ? new Date(record.earlyLeaveAt * 1000).toLocaleString() : '',
        record.finalStatus || '',
        record.locationWarning || '',
        record.locationDistance !== undefined ? String(Math.round(record.locationDistance)) : ''
      ]);

      // Build CSV string
      const csvContent = [
        csvHeaders.join(','),
        ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
      ].join('\n');

      // Create CSV blob and download
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      
      // Create download link
      const link = document.createElement('a');
      link.href = url;
      link.download = `attendance-${sessionId}-${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(link);
      link.click();
      
      // Cleanup
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      setSuccessMessage(
        `Attendance CSV exported successfully for ${data.attendance.length} student(s).`
      );
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to export CSV';
      if (onError) {
        onError(errorMessage);
      }
    } finally {
      setIsExporting(false);
    }
  };

  /**
   * Format timestamp for display
   */
  const formatTimestamp = (timestamp?: number): string => {
    if (!timestamp) return 'N/A';
    return new Date(timestamp * 1000).toLocaleString();
  };

  /**
   * Get status badge class
   */
  const getStatusBadgeClass = (status?: FinalStatus): string => {
    if (!status) return 'status-unknown';
    
    switch (status) {
      case FinalStatus.PRESENT:
        return 'status-present';
      case FinalStatus.LATE:
        return 'status-late';
      case FinalStatus.LEFT_EARLY:
        return 'status-left-early';
      case FinalStatus.EARLY_LEAVE:
        return 'status-early-leave';
      case FinalStatus.ABSENT:
        return 'status-absent';
      default:
        return 'status-unknown';
    }
  };

  /**
   * Compute summary statistics
   */
  const computeSummary = (attendance: AttendanceRecord[]) => {
    const summary = {
      total: attendance.length,
      present: 0,
      late: 0,
      leftEarly: 0,
      earlyLeave: 0,
      absent: 0,
    };

    attendance.forEach(record => {
      if (record.finalStatus === FinalStatus.PRESENT) {
        summary.present++;
      } else if (record.finalStatus === FinalStatus.LATE) {
        summary.late++;
      } else if (record.finalStatus === FinalStatus.LEFT_EARLY) {
        summary.leftEarly++;
      } else if (record.finalStatus === FinalStatus.EARLY_LEAVE) {
        summary.earlyLeave++;
      } else if (record.finalStatus === FinalStatus.ABSENT) {
        summary.absent++;
      }
    });

    return summary;
  };

  const isSessionEnded = sessionStatus === SessionStatus.ENDED;
  const summary = finalAttendance ? computeSummary(finalAttendance) : null;

  return (
    <div className="session-end-export-controls">
      <h2>Session Management</h2>

      {/* Success message */}
      {successMessage && (
        <div className="success-message" role="status">
          ✓ {successMessage}
        </div>
      )}

      {/* Control buttons */}
      <div className="control-buttons">
        {!isSessionEnded && (
          <button
            onClick={handleEndSession}
            disabled={isEnding}
            className="btn btn-danger btn-end-session"
            aria-label="End session and compute final attendance"
          >
            {isEnding ? 'Ending Session...' : 'End Session'}
          </button>
        )}

        <button
          onClick={handleExportCSV}
          disabled={isExporting}
          className="btn btn-success btn-export-csv"
          aria-label="Export attendance data as CSV"
        >
          {isExporting ? 'Exporting...' : '📊 Export CSV'}
        </button>

        <button
          onClick={handleExportAttendance}
          disabled={isExporting}
          className="btn btn-primary btn-export"
          aria-label="Export attendance data as JSON"
        >
          {isExporting ? 'Exporting...' : '📄 Export JSON'}
        </button>
      </div>

      {/* Session status indicator */}
      <div className={`session-status-indicator ${isSessionEnded ? 'ended' : 'active'}`}>
        <span className="status-dot"></span>
        <span className="status-text">
          Session Status: <strong>{isSessionEnded ? 'ENDED' : 'ACTIVE'}</strong>
        </span>
      </div>

      {/* Final attendance summary */}
      {finalAttendance && summary && (
        <div className="final-attendance-summary">
          <h3>Final Attendance Summary</h3>
          
          {/* Summary statistics */}
          <div className="summary-stats">
            <div className="stat-card total">
              <div className="stat-value">{summary.total}</div>
              <div className="stat-label">Total Students</div>
            </div>
            
            <div className="stat-card present">
              <div className="stat-value">{summary.present}</div>
              <div className="stat-label">Present</div>
            </div>
            
            <div className="stat-card late">
              <div className="stat-value">{summary.late}</div>
              <div className="stat-label">Late</div>
            </div>
            
            <div className="stat-card left-early">
              <div className="stat-value">{summary.leftEarly}</div>
              <div className="stat-label">Left Early</div>
            </div>
            
            <div className="stat-card early-leave">
              <div className="stat-value">{summary.earlyLeave}</div>
              <div className="stat-label">Early Leave</div>
            </div>
            
            <div className="stat-card absent">
              <div className="stat-value">{summary.absent}</div>
              <div className="stat-label">Absent</div>
            </div>
          </div>

          {/* Detailed attendance table */}
          <div className="attendance-table-container">
            <h4>Detailed Attendance Records</h4>
            <table className="attendance-table">
              <thead>
                <tr>
                  <th>Student ID</th>
                  <th>Join Time</th>
                  <th>Final Status</th>
                  <th>Entry Status</th>
                  <th>Entry Time</th>
                  <th>Exit Verified</th>
                  <th>Exit Time</th>
                  <th>Early Leave Time</th>
                </tr>
              </thead>
              <tbody>
                {finalAttendance.map(record => (
                  <tr key={record.studentId}>
                    <td className="student-id">{record.studentId.replace('@stu.vtc.edu.hk', '')}</td>
                    <td>{formatTimestamp(record.joinedAt)}</td>
                    <td>
                      <span className={`status-badge ${getStatusBadgeClass(record.finalStatus)}`}>
                        {record.finalStatus || 'N/A'}
                      </span>
                    </td>
                    <td>{record.entryStatus || '—'}</td>
                    <td>{formatTimestamp(record.entryAt)}</td>
                    <td>
                      <span className={`verification-badge ${record.exitVerified ? 'verified' : 'not-verified'}`}>
                        {record.exitVerified ? '✓ Yes' : '✗ No'}
                      </span>
                    </td>
                    <td>{formatTimestamp(record.exitVerifiedAt)}</td>
                    <td>{formatTimestamp(record.earlyLeaveAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <style jsx>{`
        .session-end-export-controls {
          width: 100%;
          padding: 1.5rem;
          background: white;
          border-radius: 12px;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
        }

        h2 {
          margin: 0 0 1.5rem 0;
          font-size: 1.5rem;
          font-weight: 700;
          color: #333;
        }

        h3 {
          margin: 0 0 1rem 0;
          font-size: 1.25rem;
          font-weight: 600;
          color: #333;
        }

        h4 {
          margin: 1.5rem 0 1rem 0;
          font-size: 1.1rem;
          font-weight: 600;
          color: #555;
        }

        .success-message {
          padding: 1rem;
          background: #e8f5e9;
          border: 1px solid #4caf50;
          border-radius: 8px;
          color: #2e7d32;
          margin-bottom: 1.5rem;
          font-weight: 500;
        }

        .control-buttons {
          display: flex;
          gap: 1rem;
          margin-bottom: 1.5rem;
          flex-wrap: wrap;
        }

        .btn {
          padding: 0.75rem 1.5rem;
          border: none;
          border-radius: 8px;
          font-size: 1rem;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
          min-width: 180px;
        }

        .btn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .btn-danger {
          background: #f44336;
          color: white;
        }

        .btn-danger:hover:not(:disabled) {
          background: #d32f2f;
          transform: translateY(-1px);
          box-shadow: 0 4px 8px rgba(244, 67, 54, 0.3);
        }

        .btn-primary {
          background: #0078d4;
          color: white;
        }

        .btn-primary:hover:not(:disabled) {
          background: #005a9e;
          transform: translateY(-1px);
          box-shadow: 0 4px 8px rgba(0, 120, 212, 0.3);
        }

        .btn-success {
          background: #28a745;
          color: white;
        }

        .btn-success:hover:not(:disabled) {
          background: #218838;
          transform: translateY(-1px);
          box-shadow: 0 4px 8px rgba(40, 167, 69, 0.3);
        }

        .session-status-indicator {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.75rem 1rem;
          border-radius: 8px;
          font-size: 0.95rem;
          margin-bottom: 1.5rem;
        }

        .session-status-indicator.active {
          background: #e3f2fd;
          color: #1565c0;
          border: 2px solid #2196f3;
        }

        .session-status-indicator.ended {
          background: #f5f5f5;
          color: #424242;
          border: 2px solid #9e9e9e;
        }

        .status-dot {
          width: 10px;
          height: 10px;
          border-radius: 50%;
        }

        .session-status-indicator.active .status-dot {
          background: #2196f3;
          animation: pulse 2s infinite;
        }

        .session-status-indicator.ended .status-dot {
          background: #9e9e9e;
        }

        @keyframes pulse {
          0%, 100% {
            opacity: 1;
          }
          50% {
            opacity: 0.5;
          }
        }

        .final-attendance-summary {
          margin-top: 2rem;
          padding-top: 2rem;
          border-top: 2px solid #e0e0e0;
        }

        .summary-stats {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
          gap: 1rem;
          margin-bottom: 2rem;
        }

        .stat-card {
          padding: 1rem;
          border-radius: 8px;
          text-align: center;
          border: 2px solid;
        }

        .stat-card.total {
          background: #f5f5f5;
          border-color: #9e9e9e;
        }

        .stat-card.present {
          background: #e8f5e9;
          border-color: #4caf50;
        }

        .stat-card.late {
          background: #fff3e0;
          border-color: #ff9800;
        }

        .stat-card.left-early {
          background: #fff9c4;
          border-color: #fbc02d;
        }

        .stat-card.early-leave {
          background: #ffebee;
          border-color: #f44336;
        }

        .stat-card.absent {
          background: #fafafa;
          border-color: #757575;
        }

        .stat-value {
          font-size: 2rem;
          font-weight: 700;
          margin-bottom: 0.25rem;
        }

        .stat-label {
          font-size: 0.85rem;
          font-weight: 600;
          text-transform: uppercase;
          color: #666;
        }

        .attendance-table-container {
          overflow-x: auto;
        }

        .attendance-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 0.9rem;
        }

        .attendance-table th {
          background: #f5f5f5;
          padding: 0.75rem;
          text-align: left;
          font-weight: 600;
          border-bottom: 2px solid #ddd;
          white-space: nowrap;
        }

        .attendance-table td {
          padding: 0.75rem;
          border-bottom: 1px solid #eee;
        }

        .attendance-table tbody tr:hover {
          background: #f9f9f9;
        }

        .student-id {
          font-family: monospace;
          font-weight: 500;
        }

        .status-badge {
          display: inline-block;
          padding: 0.25rem 0.75rem;
          border-radius: 12px;
          font-size: 0.85rem;
          font-weight: 600;
          text-transform: uppercase;
        }

        .status-present {
          background: #4caf50;
          color: white;
        }

        .status-late {
          background: #ff9800;
          color: white;
        }

        .status-left-early {
          background: #fbc02d;
          color: #333;
        }

        .status-early-leave {
          background: #f44336;
          color: white;
        }

        .status-absent {
          background: #757575;
          color: white;
        }

        .status-unknown {
          background: #e0e0e0;
          color: #666;
        }

        .verification-badge {
          display: inline-block;
          padding: 0.25rem 0.5rem;
          border-radius: 4px;
          font-size: 0.85rem;
          font-weight: 600;
        }

        .verification-badge.verified {
          background: #e8f5e9;
          color: #2e7d32;
        }

        .verification-badge.not-verified {
          background: #ffebee;
          color: #c62828;
        }

        @media (max-width: 768px) {
          .control-buttons {
            flex-direction: column;
          }

          .btn {
            width: 100%;
          }

          .summary-stats {
            grid-template-columns: repeat(2, 1fr);
          }

          .attendance-table {
            font-size: 0.8rem;
          }

          .attendance-table th,
          .attendance-table td {
            padding: 0.5rem;
          }
        }
      `}</style>
    </div>
  );
};

export default SessionEndAndExportControls;
