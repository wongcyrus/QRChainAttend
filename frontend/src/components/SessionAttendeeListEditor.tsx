/**
 * Session Attendee List Editor Component
 * 
 * Requirements: 4.1, 4.2, 4.3, 4.6
 * 
 * View/edit the per-session attendee list:
 * - Display all entries (email, addedBy, addedAt)
 * - Add individual emails
 * - Remove entries
 * - Unlink the session list entirely
 */

import React, { useState, useEffect, useCallback } from 'react';
import { getAuthHeaders } from '../utils/authHeaders';

interface SessionAttendeeEntry {
  email: string;
  sourceListId: string;
  addedBy: string;
  addedAt: string;
}

interface SessionAttendeeListEditorProps {
  sessionId: string;
  onUnlink?: () => void;
  /** Emails of attendees who have already checked in (lowercased) */
  checkedInEmails?: string[];
}

export const SessionAttendeeListEditor: React.FC<SessionAttendeeListEditorProps> = ({
  sessionId,
  onUnlink,
  checkedInEmails = [],
}) => {
  const [entries, setEntries] = useState<SessionAttendeeEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [addEmailInput, setAddEmailInput] = useState('');
  const [unlinkConfirm, setUnlinkConfirm] = useState(false);
  const [filter, setFilter] = useState<'all' | 'absent' | 'present'>('all');

  const apiUrl = process.env.NEXT_PUBLIC_API_URL || '/api';

  const fetchEntries = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`${apiUrl}/sessions/${sessionId}/attendee-list`, {
        credentials: 'include',
        headers,
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error?.message || 'Failed to fetch session attendee list');
      }
      const data = await response.json();
      setEntries(data.entries || []);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch session attendee list');
    } finally {
      setLoading(false);
    }
  }, [apiUrl, sessionId]);

  useEffect(() => {
    fetchEntries();
  }, [fetchEntries]);

  const handleAddEmail = async () => {
    const email = addEmailInput.trim();
    if (!email) return;
    setError(null);
    setLoading(true);
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`${apiUrl}/sessions/${sessionId}/attendee-list`, {
        method: 'PATCH',
        credentials: 'include',
        headers,
        body: JSON.stringify({ addEmails: [email] }),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        const code = data.error?.code;
        if (code === 'DUPLICATE_EMAIL') {
          throw new Error(`Email "${email}" is already on this session's attendee list`);
        }
        if (code === 'INVALID_EMAIL') {
          const invalids = data.error?.details?.invalidEmails || [];
          throw new Error(`Invalid email format: ${invalids.join(', ')}`);
        }
        throw new Error(data.error?.message || 'Failed to add email');
      }
      setAddEmailInput('');
      await fetchEntries();
    } catch (err: any) {
      setError(err.message || 'Failed to add email');
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveEmail = async (email: string) => {
    setError(null);
    setLoading(true);
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`${apiUrl}/sessions/${sessionId}/attendee-list`, {
        method: 'PATCH',
        credentials: 'include',
        headers,
        body: JSON.stringify({ removeEmails: [email] }),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error?.message || 'Failed to remove email');
      }
      await fetchEntries();
    } catch (err: any) {
      setError(err.message || 'Failed to remove email');
    } finally {
      setLoading(false);
    }
  };

  const handleUnlink = async () => {
    setError(null);
    setLoading(true);
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`${apiUrl}/sessions/${sessionId}/attendee-list`, {
        method: 'DELETE',
        credentials: 'include',
        headers,
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error?.message || 'Failed to unlink attendee list');
      }
      setUnlinkConfirm(false);
      setEntries([]);
      onUnlink?.();
    } catch (err: any) {
      setError(err.message || 'Failed to unlink attendee list');
    } finally {
      setLoading(false);
    }
  };

  const handleAddKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddEmail();
    }
  };

  // ── Shared styles (matching AttendeeListManager) ──
  const cardStyle: React.CSSProperties = {
    backgroundColor: 'white',
    padding: '2rem',
    borderRadius: '16px',
    boxShadow: '0 8px 32px rgba(0,0,0,0.08)',
    marginBottom: '1.5rem',
  };

  const headerStyle: React.CSSProperties = {
    margin: '0 0 1.5rem 0',
    color: '#2d3748',
    fontSize: '1.5rem',
    fontWeight: '700',
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
  };

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '0.75rem 1rem',
    fontSize: '0.95rem',
    border: '2px solid #e2e8f0',
    borderRadius: '8px',
    fontFamily: 'inherit',
    boxSizing: 'border-box',
    transition: 'border-color 0.2s',
  };

  const labelStyle: React.CSSProperties = {
    display: 'block',
    marginBottom: '0.5rem',
    color: '#2d3748',
    fontWeight: '600',
    fontSize: '0.95rem',
  };

  const primaryBtnStyle: React.CSSProperties = {
    padding: '0.875rem 1.5rem',
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    color: 'white',
    border: 'none',
    borderRadius: '10px',
    cursor: 'pointer',
    fontSize: '0.95rem',
    fontWeight: '600',
    boxShadow: '0 4px 12px rgba(102, 126, 234, 0.3)',
    transition: 'all 0.2s',
  };

  const secondaryBtnStyle: React.CSSProperties = {
    padding: '0.75rem 1.25rem',
    backgroundColor: '#e2e8f0',
    color: '#4a5568',
    border: 'none',
    borderRadius: '10px',
    cursor: 'pointer',
    fontSize: '0.95rem',
    fontWeight: '600',
    transition: 'all 0.2s',
  };

  const dangerBtnStyle: React.CSSProperties = {
    padding: '0.5rem 1rem',
    backgroundColor: '#fed7d7',
    color: '#c53030',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    fontSize: '0.85rem',
    fontWeight: '600',
    transition: 'all 0.2s',
  };

  return (
    <div>
      <div style={cardStyle}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.5rem' }}>
          <h3 style={{ ...headerStyle, marginBottom: 0 }}>📋 Session Attendee List</h3>
          <span style={{
            padding: '0.5rem 1rem',
            backgroundColor: '#e0f2fe',
            color: '#075985',
            borderRadius: '20px',
            fontSize: '0.875rem',
            fontWeight: '700',
          }}>
            {entries.length} {entries.length === 1 ? 'attendee' : 'attendees'}
          </span>
        </div>
        <p style={{ color: '#718096', fontSize: '0.875rem', marginBottom: '1.5rem' }}>
          This is a copy of the master list for this session only. Changes here do not affect the original list.
        </p>

        {/* Error banner */}
        {error && (
          <div style={{
            padding: '1rem 1.25rem',
            backgroundColor: '#fff5f5',
            border: '2px solid #fc8181',
            borderRadius: '10px',
            marginBottom: '1.5rem',
            color: '#c53030',
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
          }}>
            <span style={{ fontSize: '1.25rem' }}>⚠️</span>
            <span style={{ fontWeight: '500' }}>{error}</span>
          </div>
        )}

        {/* Add email section */}
        <div style={{
          backgroundColor: '#f7fafc',
          padding: '1.25rem',
          borderRadius: '10px',
          border: '2px solid #e2e8f0',
          marginBottom: '1.5rem',
        }}>
          <label style={labelStyle}>Add Email</label>
          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
            <input
              type="email"
              value={addEmailInput}
              onChange={(e) => setAddEmailInput(e.target.value)}
              onKeyDown={handleAddKeyDown}
              placeholder="Enter email address to add"
              disabled={loading}
              style={{ ...inputStyle, flex: 1 }}
              onFocus={(e) => e.currentTarget.style.borderColor = '#667eea'}
              onBlur={(e) => e.currentTarget.style.borderColor = '#e2e8f0'}
            />
            <button
              onClick={handleAddEmail}
              disabled={loading || !addEmailInput.trim()}
              style={{
                ...primaryBtnStyle,
                opacity: loading || !addEmailInput.trim() ? 0.7 : 1,
                cursor: loading || !addEmailInput.trim() ? 'not-allowed' : 'pointer',
                whiteSpace: 'nowrap',
              }}
            >
              {loading ? '⏳' : '➕ Add'}
            </button>
          </div>
        </div>

        {/* Loading state */}
        {loading && entries.length === 0 && (
          <div style={{ textAlign: 'center', padding: '2rem' }}>
            <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>⏳</div>
            <p style={{ color: '#718096', fontSize: '0.95rem' }}>Loading attendee list...</p>
          </div>
        )}

        {/* Empty state */}
        {!loading && entries.length === 0 && (
          <div style={{ textAlign: 'center', padding: '2rem' }}>
            <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>📭</div>
            <p style={{ color: '#718096', fontSize: '0.95rem' }}>No entries in this session's attendee list.</p>
          </div>
        )}

        {/* Entries list */}
        {entries.length > 0 && (
          <div>
            {/* Summary */}
            {checkedInEmails.length > 0 && (
              <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
                <button onClick={() => setFilter('all')} style={{
                  padding: '0.4rem 0.8rem', borderRadius: '12px', fontSize: '0.85rem', fontWeight: '600', border: 'none', cursor: 'pointer',
                  backgroundColor: filter === 'all' ? '#667eea' : '#e2e8f0', color: filter === 'all' ? 'white' : '#4a5568',
                }}>
                  All ({entries.length})
                </button>
                <button onClick={() => setFilter('present')} style={{
                  padding: '0.4rem 0.8rem', borderRadius: '12px', fontSize: '0.85rem', fontWeight: '600', border: 'none', cursor: 'pointer',
                  backgroundColor: filter === 'present' ? '#48bb78' : '#c6f6d5', color: filter === 'present' ? 'white' : '#22543d',
                }}>
                  ✓ Checked in ({entries.filter(e => checkedInEmails.includes(e.email.toLowerCase())).length})
                </button>
                <button onClick={() => setFilter('absent')} style={{
                  padding: '0.4rem 0.8rem', borderRadius: '12px', fontSize: '0.85rem', fontWeight: '600', border: 'none', cursor: 'pointer',
                  backgroundColor: filter === 'absent' ? '#e53e3e' : '#fed7d7', color: filter === 'absent' ? 'white' : '#742a2a',
                }}>
                  ✗ Absent ({entries.filter(e => !checkedInEmails.includes(e.email.toLowerCase())).length})
                </button>
              </div>
            )}
            <h4 style={{ color: '#2d3748', fontSize: '1.1rem', fontWeight: '700', marginBottom: '1rem' }}>
              Email Entries
            </h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {entries
                .filter((entry) => {
                  if (filter === 'all') return true;
                  const isIn = checkedInEmails.includes(entry.email.toLowerCase());
                  return filter === 'present' ? isIn : !isIn;
                })
                .map((entry) => {
                const isCheckedIn = checkedInEmails.includes(entry.email.toLowerCase());
                return (
                <div key={entry.email} style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '0.75rem 1rem',
                  backgroundColor: isCheckedIn ? '#f0fff4' : '#f7fafc',
                  borderRadius: '8px',
                  border: `1px solid ${isCheckedIn ? '#c6f6d5' : '#e2e8f0'}`,
                }}>
                  <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{ fontSize: '1rem' }}>{isCheckedIn ? '✅' : '⬜'}</span>
                    <div>
                      <span style={{
                        fontFamily: 'monospace',
                        fontSize: '0.9rem',
                        color: '#2d3748',
                        display: 'block',
                      }}>
                        {entry.email}
                      </span>
                      <span style={{
                        fontSize: '0.75rem',
                        color: '#a0aec0',
                        display: 'block',
                        marginTop: '0.25rem',
                      }}>
                        {isCheckedIn ? 'Checked in' : 'Not checked in'}
                        {' · '}Added by {entry.addedBy === 'SNAPSHOT' ? 'snapshot' : entry.addedBy}
                        {entry.addedAt && ` · ${new Date(entry.addedAt).toLocaleDateString()}`}
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={() => handleRemoveEmail(entry.email)}
                    disabled={loading}
                    style={{
                      ...dangerBtnStyle,
                      opacity: loading ? 0.7 : 1,
                      cursor: loading ? 'not-allowed' : 'pointer',
                      flexShrink: 0,
                      marginLeft: '0.75rem',
                    }}
                  >
                    ✕ Remove
                  </button>
                </div>
              )})}
            </div>
          </div>
        )}
      </div>

      {/* Unlink section */}
      <div style={{
        ...cardStyle,
        border: '2px solid #fed7d7',
      }}>
        <h4 style={{ color: '#c53030', fontSize: '1.1rem', fontWeight: '700', marginBottom: '0.75rem' }}>
          ⚠️ Danger Zone
        </h4>
        <p style={{ color: '#718096', fontSize: '0.9rem', marginBottom: '1rem' }}>
          Removing the attendee list will delete all entries and allow anyone to check in to this session.
        </p>
        {unlinkConfirm ? (
          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
            <span style={{ color: '#c53030', fontWeight: '600', fontSize: '0.9rem' }}>Are you sure?</span>
            <button
              onClick={handleUnlink}
              disabled={loading}
              style={{
                padding: '0.5rem 1rem',
                backgroundColor: '#e53e3e',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                cursor: loading ? 'not-allowed' : 'pointer',
                fontSize: '0.85rem',
                fontWeight: '600',
              }}
            >
              {loading ? '⏳ Removing...' : 'Yes, Remove List'}
            </button>
            <button
              onClick={() => setUnlinkConfirm(false)}
              disabled={loading}
              style={secondaryBtnStyle}
            >
              Cancel
            </button>
          </div>
        ) : (
          <button
            onClick={() => setUnlinkConfirm(true)}
            style={dangerBtnStyle}
          >
            🗑️ Remove Attendee List
          </button>
        )}
      </div>
    </div>
  );
};
