/**
 * Attendee List Manager Component
 * 
 * Requirements: 2.1, 2.2, 2.3, 2.4, 2.5
 * 
 * Full CRUD UI for master attendee lists:
 * - List all lists owned by the organizer
 * - Create new list (name + emails textarea)
 * - View list entries
 * - Add/remove emails from existing lists
 * - Delete lists
 */

import React, { useState, useEffect, useCallback } from 'react';
import { getAuthHeaders } from '../utils/authHeaders';

interface AttendeeList {
  listId: string;
  listName: string;
  emailCount: number;
}

interface AttendeeListDetail {
  listId: string;
  listName: string;
  emailCount: number;
  emails: string[];
}

type View = 'list' | 'create' | 'detail';

export const AttendeeListManager: React.FC = () => {
  const [view, setView] = useState<View>('list');
  const [lists, setLists] = useState<AttendeeList[]>([]);
  const [selectedList, setSelectedList] = useState<AttendeeListDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Create form state
  const [newListName, setNewListName] = useState('');
  const [newListEmails, setNewListEmails] = useState('');
  const [invalidEmails, setInvalidEmails] = useState<string[]>([]);

  // Add emails state (for detail view)
  const [addEmailsInput, setAddEmailsInput] = useState('');
  const [addInvalidEmails, setAddInvalidEmails] = useState<string[]>([]);

  // Delete confirmation
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const apiUrl = process.env.NEXT_PUBLIC_API_URL || '/api';

  const fetchLists = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`${apiUrl}/attendee-lists`, {
        credentials: 'include',
        headers,
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error?.message || 'Failed to fetch attendee lists');
      }
      const data = await response.json();
      setLists(data.lists || []);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch attendee lists');
    } finally {
      setLoading(false);
    }
  }, [apiUrl]);

  useEffect(() => {
    fetchLists();
  }, [fetchLists]);

  const fetchListDetail = async (listId: string) => {
    setLoading(true);
    setError(null);
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`${apiUrl}/attendee-lists/${listId}`, {
        credentials: 'include',
        headers,
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error?.message || 'Failed to fetch list details');
      }
      const data: AttendeeListDetail = await response.json();
      setSelectedList(data);
      setView('detail');
    } catch (err: any) {
      setError(err.message || 'Failed to fetch list details');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateList = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setInvalidEmails([]);

    const name = newListName.trim();
    if (!name) {
      setError('List name is required');
      return;
    }

    const emails = newListEmails
      .split(/[,\n]+/)
      .map(e => e.trim())
      .filter(e => e.length > 0);

    if (emails.length === 0) {
      setError('At least one email address is required');
      return;
    }

    setLoading(true);
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`${apiUrl}/attendee-lists`, {
        method: 'POST',
        credentials: 'include',
        headers,
        body: JSON.stringify({ name, emails }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        if (data.error?.code === 'INVALID_EMAIL' && data.error?.details?.invalidEmails) {
          setInvalidEmails(data.error.details.invalidEmails);
        }
        throw new Error(data.error?.message || 'Failed to create list');
      }

      setNewListName('');
      setNewListEmails('');
      setInvalidEmails([]);
      setView('list');
      await fetchLists();
    } catch (err: any) {
      setError(err.message || 'Failed to create list');
    } finally {
      setLoading(false);
    }
  };

  const handleAddEmails = async () => {
    if (!selectedList) return;
    setError(null);
    setAddInvalidEmails([]);

    const emails = addEmailsInput
      .split(/[,\n]+/)
      .map(e => e.trim())
      .filter(e => e.length > 0);

    if (emails.length === 0) return;

    setLoading(true);
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`${apiUrl}/attendee-lists/${selectedList.listId}`, {
        method: 'PATCH',
        credentials: 'include',
        headers,
        body: JSON.stringify({ addEmails: emails }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        if (data.error?.code === 'INVALID_EMAIL' && data.error?.details?.invalidEmails) {
          setAddInvalidEmails(data.error.details.invalidEmails);
        }
        throw new Error(data.error?.message || 'Failed to add emails');
      }

      setAddEmailsInput('');
      setAddInvalidEmails([]);
      await fetchListDetail(selectedList.listId);
    } catch (err: any) {
      setError(err.message || 'Failed to add emails');
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveEmail = async (email: string) => {
    if (!selectedList) return;
    setError(null);
    setLoading(true);
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`${apiUrl}/attendee-lists/${selectedList.listId}`, {
        method: 'PATCH',
        credentials: 'include',
        headers,
        body: JSON.stringify({ removeEmails: [email] }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error?.message || 'Failed to remove email');
      }

      await fetchListDetail(selectedList.listId);
    } catch (err: any) {
      setError(err.message || 'Failed to remove email');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteList = async (listId: string) => {
    setError(null);
    setLoading(true);
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`${apiUrl}/attendee-lists/${listId}`, {
        method: 'DELETE',
        credentials: 'include',
        headers,
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error?.message || 'Failed to delete list');
      }

      setDeleteConfirmId(null);
      if (view === 'detail') {
        setSelectedList(null);
        setView('list');
      }
      await fetchLists();
    } catch (err: any) {
      setError(err.message || 'Failed to delete list');
    } finally {
      setLoading(false);
    }
  };

  const goBack = () => {
    setView('list');
    setSelectedList(null);
    setError(null);
    setAddEmailsInput('');
    setAddInvalidEmails([]);
  };

  // ── Shared styles ──
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

  // ── Error banner ──
  const renderError = () => {
    if (!error) return null;
    return (
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
    );
  };

  // ── Invalid emails highlight ──
  const renderInvalidEmails = (emails: string[]) => {
    if (emails.length === 0) return null;
    return (
      <div style={{
        padding: '0.75rem 1rem',
        backgroundColor: '#fff5f5',
        border: '1px solid #fc8181',
        borderRadius: '8px',
        marginTop: '0.5rem',
        color: '#c53030',
        fontSize: '0.875rem',
      }}>
        <strong>Invalid emails:</strong>{' '}
        {emails.map((email, i) => (
          <span key={i} style={{
            display: 'inline-block',
            backgroundColor: '#fed7d7',
            padding: '0.125rem 0.5rem',
            borderRadius: '4px',
            margin: '0.125rem 0.25rem',
            fontFamily: 'monospace',
            fontSize: '0.8rem',
          }}>
            {email}
          </span>
        ))}
      </div>
    );
  };

  // ── CREATE VIEW ──
  if (view === 'create') {
    return (
      <div style={cardStyle}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem' }}>
          <button onClick={goBack} style={secondaryBtnStyle}>← Back</button>
          <h3 style={{ ...headerStyle, marginBottom: 0 }}>📝 Create New Attendee List</h3>
        </div>

        {renderError()}

        <form onSubmit={handleCreateList}>
          <div style={{ marginBottom: '1.25rem' }}>
            <label style={labelStyle}>
              List Name <span style={{ color: '#e53e3e' }}>*</span>
            </label>
            <input
              type="text"
              value={newListName}
              onChange={(e) => setNewListName(e.target.value)}
              placeholder="e.g., CS101 Fall 2026"
              disabled={loading}
              style={inputStyle}
              onFocus={(e) => e.currentTarget.style.borderColor = '#667eea'}
              onBlur={(e) => e.currentTarget.style.borderColor = '#e2e8f0'}
            />
          </div>

          <div style={{ marginBottom: '1.25rem' }}>
            <label style={labelStyle}>
              Email Addresses <span style={{ color: '#e53e3e' }}>*</span>
            </label>
            <textarea
              value={newListEmails}
              onChange={(e) => setNewListEmails(e.target.value)}
              placeholder={'Enter emails separated by commas or one per line:\nstudent1@example.com\nstudent2@example.com, student3@example.com'}
              disabled={loading}
              rows={8}
              style={{
                ...inputStyle,
                resize: 'vertical',
                minHeight: '120px',
              }}
              onFocus={(e) => e.currentTarget.style.borderColor = '#667eea'}
              onBlur={(e) => e.currentTarget.style.borderColor = '#e2e8f0'}
            />
            <small style={{ color: '#718096', fontSize: '0.875rem', marginTop: '0.5rem', display: 'block' }}>
              Separate emails with commas or newlines. Duplicates will be removed automatically.
            </small>
            {renderInvalidEmails(invalidEmails)}
          </div>

          <div style={{ display: 'flex', gap: '1rem' }}>
            <button type="submit" disabled={loading} style={{
              ...primaryBtnStyle,
              opacity: loading ? 0.7 : 1,
              cursor: loading ? 'not-allowed' : 'pointer',
            }}>
              {loading ? '⏳ Creating...' : '✅ Create List'}
            </button>
            <button type="button" onClick={goBack} disabled={loading} style={secondaryBtnStyle}>
              Cancel
            </button>
          </div>
        </form>
      </div>
    );
  }

  // ── DETAIL VIEW ──
  if (view === 'detail' && selectedList) {
    return (
      <div>
        <div style={cardStyle}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <button onClick={goBack} style={secondaryBtnStyle}>← Back</button>
              <h3 style={{ ...headerStyle, marginBottom: 0 }}>📋 {selectedList.listName}</h3>
            </div>
            <span style={{
              padding: '0.5rem 1rem',
              backgroundColor: '#e0f2fe',
              color: '#075985',
              borderRadius: '20px',
              fontSize: '0.875rem',
              fontWeight: '700',
            }}>
              {selectedList.emailCount} {selectedList.emailCount === 1 ? 'email' : 'emails'}
            </span>
          </div>

          {renderError()}

          {/* Add emails section */}
          <div style={{
            backgroundColor: '#f7fafc',
            padding: '1.25rem',
            borderRadius: '10px',
            border: '2px solid #e2e8f0',
            marginBottom: '1.5rem',
          }}>
            <label style={labelStyle}>Add Emails</label>
            <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
              <textarea
                value={addEmailsInput}
                onChange={(e) => setAddEmailsInput(e.target.value)}
                placeholder="Enter emails to add (comma or newline separated)"
                disabled={loading}
                rows={3}
                style={{
                  ...inputStyle,
                  flex: 1,
                  resize: 'vertical',
                  minHeight: '60px',
                }}
                onFocus={(e) => e.currentTarget.style.borderColor = '#667eea'}
                onBlur={(e) => e.currentTarget.style.borderColor = '#e2e8f0'}
              />
              <button
                onClick={handleAddEmails}
                disabled={loading || !addEmailsInput.trim()}
                style={{
                  ...primaryBtnStyle,
                  opacity: loading || !addEmailsInput.trim() ? 0.7 : 1,
                  cursor: loading || !addEmailsInput.trim() ? 'not-allowed' : 'pointer',
                  whiteSpace: 'nowrap',
                }}
              >
                {loading ? '⏳' : '➕ Add'}
              </button>
            </div>
            {renderInvalidEmails(addInvalidEmails)}
          </div>

          {/* Email entries list */}
          <div>
            <h4 style={{ color: '#2d3748', fontSize: '1.1rem', fontWeight: '700', marginBottom: '1rem' }}>
              Email Entries
            </h4>
            {selectedList.emails.length === 0 ? (
              <p style={{ color: '#718096', fontStyle: 'italic' }}>No emails in this list.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {selectedList.emails.map((email) => (
                  <div key={email} style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '0.75rem 1rem',
                    backgroundColor: '#f7fafc',
                    borderRadius: '8px',
                    border: '1px solid #e2e8f0',
                  }}>
                    <span style={{
                      fontFamily: 'monospace',
                      fontSize: '0.9rem',
                      color: '#2d3748',
                    }}>
                      {email}
                    </span>
                    <button
                      onClick={() => handleRemoveEmail(email)}
                      disabled={loading}
                      style={{
                        ...dangerBtnStyle,
                        opacity: loading ? 0.7 : 1,
                        cursor: loading ? 'not-allowed' : 'pointer',
                      }}
                    >
                      ✕ Remove
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Delete list section */}
        <div style={{
          ...cardStyle,
          border: '2px solid #fed7d7',
        }}>
          <h4 style={{ color: '#c53030', fontSize: '1.1rem', fontWeight: '700', marginBottom: '0.75rem' }}>
            ⚠️ Danger Zone
          </h4>
          <p style={{ color: '#718096', fontSize: '0.9rem', marginBottom: '1rem' }}>
            Deleting this list is permanent. Existing session copies will not be affected.
          </p>
          {deleteConfirmId === selectedList.listId ? (
            <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
              <span style={{ color: '#c53030', fontWeight: '600', fontSize: '0.9rem' }}>Are you sure?</span>
              <button
                onClick={() => handleDeleteList(selectedList.listId)}
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
                {loading ? '⏳ Deleting...' : 'Yes, Delete'}
              </button>
              <button
                onClick={() => setDeleteConfirmId(null)}
                disabled={loading}
                style={secondaryBtnStyle}
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              onClick={() => setDeleteConfirmId(selectedList.listId)}
              style={dangerBtnStyle}
            >
              🗑️ Delete This List
            </button>
          )}
        </div>
      </div>
    );
  }

  // ── LIST VIEW (default) ──
  return (
    <div>
      {/* Header */}
      <div style={{
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        padding: '1.5rem 2rem',
        borderRadius: '12px',
        marginBottom: '1.5rem',
        color: 'white',
        boxShadow: '0 4px 20px rgba(102, 126, 234, 0.3)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '1rem',
      }}>
        <h2 style={{ margin: 0, fontSize: '1.5rem', fontWeight: '700' }}>
          📋 Attendee Lists
        </h2>
        <button
          onClick={() => { setView('create'); setError(null); setInvalidEmails([]); }}
          style={{
            padding: '0.75rem 1.25rem',
            backgroundColor: 'rgba(255,255,255,0.2)',
            color: 'white',
            border: '2px solid rgba(255,255,255,0.4)',
            borderRadius: '10px',
            cursor: 'pointer',
            fontSize: '0.95rem',
            fontWeight: '600',
            transition: 'all 0.2s',
          }}
          onMouseOver={(e) => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.3)'}
          onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.2)'}
        >
          ➕ New List
        </button>
      </div>

      {renderError()}

      {/* Loading state */}
      {loading && lists.length === 0 && (
        <div style={{
          ...cardStyle,
          textAlign: 'center',
          padding: '3rem 2rem',
        }}>
          <div style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>⏳</div>
          <p style={{ color: '#718096', fontSize: '1rem' }}>Loading attendee lists...</p>
        </div>
      )}

      {/* Empty state */}
      {!loading && lists.length === 0 && (
        <div style={{
          ...cardStyle,
          textAlign: 'center',
          padding: '3rem 2rem',
        }}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📭</div>
          <h3 style={{ color: '#2d3748', marginBottom: '0.5rem' }}>No Attendee Lists Yet</h3>
          <p style={{ color: '#718096', marginBottom: '1.5rem' }}>
            Create your first attendee list to manage who can check in to your sessions.
          </p>
          <button
            onClick={() => { setView('create'); setError(null); setInvalidEmails([]); }}
            style={primaryBtnStyle}
          >
            ➕ Create Your First List
          </button>
        </div>
      )}

      {/* Lists grid */}
      {lists.length > 0 && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
          gap: '1rem',
        }}>
          {lists.map((list) => (
            <div
              key={list.listId}
              style={{
                backgroundColor: 'white',
                padding: '1.5rem',
                borderRadius: '12px',
                boxShadow: '0 4px 16px rgba(0,0,0,0.06)',
                border: '2px solid #e2e8f0',
                cursor: 'pointer',
                transition: 'all 0.2s',
              }}
              onClick={() => fetchListDetail(list.listId)}
              onMouseOver={(e) => {
                e.currentTarget.style.borderColor = '#667eea';
                e.currentTarget.style.boxShadow = '0 8px 24px rgba(102, 126, 234, 0.15)';
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.borderColor = '#e2e8f0';
                e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.06)';
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
                <h4 style={{
                  margin: 0,
                  color: '#2d3748',
                  fontSize: '1.1rem',
                  fontWeight: '700',
                }}>
                  {list.listName}
                </h4>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (deleteConfirmId === list.listId) {
                      handleDeleteList(list.listId);
                    } else {
                      setDeleteConfirmId(list.listId);
                    }
                  }}
                  style={{
                    ...dangerBtnStyle,
                    padding: '0.375rem 0.75rem',
                    fontSize: '0.8rem',
                  }}
                >
                  {deleteConfirmId === list.listId ? 'Confirm?' : '🗑️'}
                </button>
              </div>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                color: '#718096',
                fontSize: '0.9rem',
              }}>
                <span>📧</span>
                <span>{list.emailCount} {list.emailCount === 1 ? 'email' : 'emails'}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
