/**
 * Attendee List Selector Component
 * 
 * Requirements: 8.1
 * 
 * Simple dropdown for selecting an existing master attendee list.
 * List creation is handled separately in AttendeeListManager.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { getAuthHeaders } from '../utils/authHeaders';

interface AttendeeList {
  listId: string;
  listName: string;
  emailCount: number;
}

interface AttendeeListSelectorProps {
  onSelect: (listId: string | null) => void;
}

export const AttendeeListSelector: React.FC<AttendeeListSelectorProps> = ({
  onSelect,
}) => {
  const [lists, setLists] = useState<AttendeeList[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedValue, setSelectedValue] = useState<string>('');

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

  const handleSelectChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value;
    setSelectedValue(value);
    setError(null);
    onSelect(value || null);
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

  return (
    <div style={{
      backgroundColor: '#f7fafc',
      padding: '1.25rem',
      borderRadius: '10px',
      border: '2px solid #e2e8f0',
    }}>
      <label style={{
        display: 'block',
        marginBottom: '0.5rem',
        color: '#2d3748',
        fontWeight: '600',
        fontSize: '0.95rem',
      }}>
        📋 Attendee List <span style={{ color: '#718096', fontWeight: '400', fontSize: '0.85rem' }}>(optional — a copy will be made for this session)</span>
      </label>

      <select
        value={selectedValue}
        onChange={handleSelectChange}
        disabled={loading}
        style={{
          ...inputStyle,
          cursor: loading ? 'not-allowed' : 'pointer',
          backgroundColor: 'white',
        }}
        onFocus={(e) => { e.currentTarget.style.borderColor = '#667eea'; }}
        onBlur={(e) => { e.currentTarget.style.borderColor = '#e2e8f0'; }}
      >
        <option value="">— No attendee list —</option>
        {lists.map((list) => (
          <option key={list.listId} value={list.listId}>
            {list.listName} ({list.emailCount} {list.emailCount === 1 ? 'email' : 'emails'})
          </option>
        ))}
      </select>

      {loading && (
        <small style={{ color: '#718096', fontSize: '0.85rem', marginTop: '0.5rem', display: 'block' }}>
          Loading lists...
        </small>
      )}

      {lists.length === 0 && !loading && !error && (
        <small style={{ color: '#718096', fontSize: '0.85rem', marginTop: '0.5rem', display: 'block' }}>
          No attendee lists yet. Create one from the main page using "Manage Attendee Lists".
        </small>
      )}

      {error && (
        <div style={{
          padding: '0.75rem 1rem',
          backgroundColor: '#fff5f5',
          border: '2px solid #fc8181',
          borderRadius: '8px',
          marginTop: '0.75rem',
          color: '#c53030',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          fontSize: '0.9rem',
        }}>
          <span>⚠️</span>
          <span style={{ fontWeight: '500' }}>{error}</span>
        </div>
      )}
    </div>
  );
};
