/**
 * Co-Teacher Management Component
 * Allows session owner to add/remove co-teachers who can manage the session
 */

import React, { useState, useEffect, useCallback } from 'react';
import { getAuthHeaders } from '../utils/authHeaders';

interface CoTeacher {
  email: string;
  addedAt?: string;
}

interface CoTeacherManagementProps {
  sessionId: string;
  isOwner: boolean;
  onError?: (error: string) => void;
}

export const CoTeacherManagement: React.FC<CoTeacherManagementProps> = ({
  sessionId,
  isOwner,
  onError,
}) => {
  const [coTeachers, setCoTeachers] = useState<CoTeacher[]>([]);
  const [newEmail, setNewEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [adding, setAdding] = useState(false);
  const [removing, setRemoving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const apiUrl = process.env.NEXT_PUBLIC_API_URL || '/api';

  const fetchCoTeachers = useCallback(async () => {
    setLoading(true);
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`${apiUrl}/sessions/${sessionId}/co-teachers`, {
        headers,
        credentials: 'include',
      });
      if (response.ok) {
        const data = await response.json();
        // Backend returns array of email strings, convert to objects
        const teachers = (data.coTeachers || []).map((email: string) => ({ email }));
        setCoTeachers(teachers);
      }
    } catch (err) {
      console.error('Failed to fetch co-teachers:', err);
    } finally {
      setLoading(false);
    }
  }, [apiUrl, sessionId]);

  useEffect(() => {
    fetchCoTeachers();
  }, [fetchCoTeachers]);

  const handleAddCoTeacher = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmail.trim()) return;

    setAdding(true);
    setError(null);
    setSuccess(null);

    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`${apiUrl}/sessions/${sessionId}/share`, {
        method: 'POST',
        headers: {
          ...headers,
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ coTeacherEmail: newEmail.trim() }),
      });

      const data = await response.json();

      if (response.ok) {
        setSuccess(`Added ${newEmail.trim()} as co-teacher`);
        setNewEmail('');
        fetchCoTeachers();
      } else {
        setError(data.error?.message || 'Failed to add co-teacher');
        onError?.(data.error?.message || 'Failed to add co-teacher');
      }
    } catch (err) {
      setError('Network error. Please try again.');
      onError?.('Network error');
    } finally {
      setAdding(false);
    }
  };

  const handleRemoveCoTeacher = async (email: string) => {
    setRemoving(email);
    setError(null);
    setSuccess(null);

    try {
      const headers = await getAuthHeaders();
      const response = await fetch(
        `${apiUrl}/sessions/${sessionId}/co-teachers/${encodeURIComponent(email)}`,
        {
          method: 'DELETE',
          headers,
          credentials: 'include',
        }
      );

      const data = await response.json();

      if (response.ok) {
        setSuccess(`Removed ${email} from co-teachers`);
        fetchCoTeachers();
      } else {
        setError(data.error?.message || 'Failed to remove co-teacher');
        onError?.(data.error?.message || 'Failed to remove co-teacher');
      }
    } catch (err) {
      setError('Network error. Please try again.');
      onError?.('Network error');
    } finally {
      setRemoving(null);
    }
  };

  // Clear messages after 3 seconds
  useEffect(() => {
    if (success || error) {
      const timer = setTimeout(() => {
        setSuccess(null);
        setError(null);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [success, error]);

  return (
    <div style={{
      backgroundColor: 'white',
      padding: '1.5rem',
      borderRadius: '12px',
      boxShadow: '0 4px 16px rgba(0,0,0,0.06)',
    }}>
      <h4 style={{
        margin: '0 0 1rem 0',
        color: '#2d3748',
        fontSize: '1.1rem',
        fontWeight: '700',
        display: 'flex',
        alignItems: 'center',
        gap: '0.5rem',
      }}>
        👥 Co-Teachers
      </h4>

      {/* Status Messages */}
      {error && (
        <div style={{
          padding: '0.75rem 1rem',
          backgroundColor: '#fed7d7',
          color: '#c53030',
          borderRadius: '8px',
          marginBottom: '1rem',
          fontSize: '0.9rem',
        }}>
          {error}
        </div>
      )}
      {success && (
        <div style={{
          padding: '0.75rem 1rem',
          backgroundColor: '#c6f6d5',
          color: '#22543d',
          borderRadius: '8px',
          marginBottom: '1rem',
          fontSize: '0.9rem',
        }}>
          {success}
        </div>
      )}

      {/* Co-Teachers List */}
      {loading ? (
        <div style={{ color: '#718096', fontSize: '0.9rem' }}>Loading...</div>
      ) : coTeachers.length === 0 ? (
        <div style={{
          color: '#718096',
          fontSize: '0.9rem',
          padding: '1rem',
          backgroundColor: '#f7fafc',
          borderRadius: '8px',
          textAlign: 'center',
        }}>
          No co-teachers added yet
        </div>
      ) : (
        <div style={{ marginBottom: '1rem' }}>
          {coTeachers.map((teacher) => (
            <div
              key={teacher.email}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '0.75rem 1rem',
                backgroundColor: '#f7fafc',
                borderRadius: '8px',
                marginBottom: '0.5rem',
              }}
            >
              <span style={{ color: '#2d3748', fontSize: '0.95rem' }}>
                {teacher.email}
              </span>
              {isOwner && (
                <button
                  onClick={() => handleRemoveCoTeacher(teacher.email)}
                  disabled={removing === teacher.email}
                  style={{
                    padding: '0.375rem 0.75rem',
                    backgroundColor: removing === teacher.email ? '#e2e8f0' : '#fed7d7',
                    color: removing === teacher.email ? '#a0aec0' : '#c53030',
                    border: 'none',
                    borderRadius: '6px',
                    fontSize: '0.85rem',
                    fontWeight: '600',
                    cursor: removing === teacher.email ? 'not-allowed' : 'pointer',
                  }}
                >
                  {removing === teacher.email ? 'Removing...' : 'Remove'}
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Add Co-Teacher Form (only for owner) */}
      {isOwner && (
        <form onSubmit={handleAddCoTeacher} style={{ marginTop: '1rem' }}>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <input
              type="email"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              placeholder="Enter teacher email..."
              style={{
                flex: 1,
                padding: '0.75rem 1rem',
                border: '2px solid #e2e8f0',
                borderRadius: '8px',
                fontSize: '0.95rem',
                outline: 'none',
              }}
              disabled={adding}
            />
            <button
              type="submit"
              disabled={adding || !newEmail.trim()}
              style={{
                padding: '0.75rem 1.25rem',
                backgroundColor: adding || !newEmail.trim() ? '#e2e8f0' : '#4299e1',
                color: adding || !newEmail.trim() ? '#a0aec0' : 'white',
                border: 'none',
                borderRadius: '8px',
                fontSize: '0.95rem',
                fontWeight: '600',
                cursor: adding || !newEmail.trim() ? 'not-allowed' : 'pointer',
              }}
            >
              {adding ? 'Adding...' : 'Add'}
            </button>
          </div>
          <p style={{
            margin: '0.5rem 0 0 0',
            fontSize: '0.8rem',
            color: '#718096',
          }}>
            Co-teachers can view and manage this session but cannot delete it.
          </p>
        </form>
      )}
    </div>
  );
};
