/**
 * Snapshot Manager Component
 * Simplified: Take instant attendance snapshots via chains
 */

import React, { useState, useEffect } from 'react';
import { getAuthHeaders } from '../utils/authHeaders';

interface Snapshot {
  snapshotId: string;
  snapshotIndex: number;
  capturedAt: number;
  totalStudents: number;
  chainsCreated: number;
  presentCount?: number;
  status: string;
}

interface SnapshotManagerProps {
  sessionId: string;
  onError?: (error: string) => void;
}

export function SnapshotManager({
  sessionId,
  onError
}: SnapshotManagerProps) {
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [chainCount, setChainCount] = useState(3);

  // Load snapshots on mount
  useEffect(() => {
    loadSnapshots();
  }, [sessionId]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadSnapshots = async () => {
    setIsLoading(true);
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || '/api';
      const authHeaders = await getAuthHeaders();
      
      const response = await fetch(`${apiUrl}/sessions/${sessionId}/snapshots`, {
        method: 'GET',
        credentials: 'include',
        headers: authHeaders
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error?.message || `Failed to load snapshots: ${response.statusText}`);
      }

      const data = await response.json();
      setSnapshots(data.snapshots || []);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to load snapshots';
      console.error('Load snapshots error:', error);
      onError?.(message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleTakeSnapshot = async () => {
    setIsCreating(true);
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || '/api';
      const authHeaders = await getAuthHeaders();
      
      const response = await fetch(
        `${apiUrl}/sessions/${sessionId}/snapshot?count=${chainCount}`,
        {
          method: 'POST',
          credentials: 'include',
          headers: authHeaders
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error?.message || `Failed to take snapshot: ${response.statusText}`);
      }

      // Reload snapshots
      await loadSnapshots();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to take snapshot';
      console.error('Take snapshot error:', error);
      onError?.(message);
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div style={{
      backgroundColor: 'white',
      borderRadius: '12px',
      padding: '1.5rem',
      boxShadow: '0 4px 16px rgba(0,0,0,0.08)'
    }}>
      <h3 style={{ 
        margin: '0 0 1rem 0',
        color: '#2d3748',
        fontSize: '1.25rem',
        fontWeight: '700'
      }}>
        📸 Instant Attendance Snapshots
      </h3>
      
      <p style={{
        margin: '0 0 1.5rem 0',
        color: '#718096',
        fontSize: '0.9rem'
      }}>
        Take a snapshot to record who's present right now by running chains on demand.
      </p>

      {/* Create Snapshot Form */}
      <div style={{
        display: 'flex',
        gap: '1rem',
        alignItems: 'flex-end',
        marginBottom: '1.5rem',
        flexWrap: 'wrap'
      }}>
        <div style={{ flex: '0 0 auto' }}>
          <label style={{
            display: 'block',
            marginBottom: '0.5rem',
            fontWeight: '600',
            color: '#2d3748',
            fontSize: '0.9rem'
          }}>
            Number of Chains
          </label>
          <input
            type="number"
            min="1"
            max="20"
            value={chainCount}
            onChange={(e) => setChainCount(parseInt(e.target.value, 10))}
            disabled={isCreating}
            style={{
              width: '100px',
              padding: '0.75rem',
              border: '1px solid #e2e8f0',
              borderRadius: '8px',
              fontSize: '0.95rem'
            }}
          />
        </div>

        <button
          onClick={handleTakeSnapshot}
          disabled={isCreating || chainCount < 1 || chainCount > 20}
          style={{
            padding: '0.75rem 1.5rem',
            backgroundColor: isCreating ? '#d0d0d0' : '#667eea',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            fontSize: '0.95rem',
            fontWeight: '600',
            cursor: isCreating ? 'not-allowed' : 'pointer',
            transition: 'all 0.2s',
            boxShadow: isCreating ? 'none' : '0 4px 12px rgba(102, 126, 234, 0.3)'
          }}
          onMouseOver={(e) => {
            if (!isCreating) e.currentTarget.style.backgroundColor = '#5a67d8';
          }}
          onMouseOut={(e) => {
            if (!isCreating) e.currentTarget.style.backgroundColor = '#667eea';
          }}
        >
          {isCreating ? '⏳ Taking Snapshot...' : '📸 Take Snapshot Now'}
        </button>
      </div>

      {/* Snapshots List */}
      {isLoading ? (
        <div style={{ 
          textAlign: 'center', 
          padding: '2rem', 
          color: '#718096' 
        }}>
          Loading snapshots...
        </div>
      ) : snapshots.length === 0 ? (
        <div style={{
          padding: '2rem',
          textAlign: 'center',
          backgroundColor: '#f7fafc',
          borderRadius: '8px',
          color: '#718096'
        }}>
          <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>📸</div>
          <p style={{ margin: 0 }}>No snapshots yet. Take one to record instant attendance!</p>
        </div>
      ) : (
        <div>
          <h4 style={{ 
            color: '#2d3748', 
            marginBottom: '1rem',
            fontSize: '1rem',
            fontWeight: '600'
          }}>
            Snapshot History ({snapshots.length})
          </h4>
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '0.75rem'
          }}>
            {snapshots.map((snapshot) => (
              <div
                key={snapshot.snapshotId}
                style={{
                  padding: '1rem',
                  backgroundColor: '#f7fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: '1rem'
                }}
              >
                <div style={{ flex: 1 }}>
                  <div style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: '0.75rem',
                    marginBottom: '0.25rem'
                  }}>
                    <span style={{
                      padding: '0.25rem 0.75rem',
                      backgroundColor: '#667eea',
                      color: 'white',
                      borderRadius: '6px',
                      fontSize: '0.875rem',
                      fontWeight: '600'
                    }}>
                      Snapshot #{snapshot.snapshotIndex}
                    </span>
                    <span style={{ color: '#2d3748', fontSize: '0.95rem', fontWeight: '500' }}>
                      {new Date(snapshot.capturedAt * 1000).toLocaleString()}
                    </span>
                  </div>
                  <div style={{ fontSize: '0.875rem', color: '#718096' }}>
                    {snapshot.chainsCreated} chains started • {snapshot.totalStudents} students online
                    {snapshot.presentCount !== undefined && ` • ${snapshot.presentCount} verified present`}
                  </div>
                </div>
                <div style={{
                  padding: '0.5rem 1rem',
                  backgroundColor: snapshot.status === 'COMPLETED' ? '#c6f6d5' : '#fff3cd',
                  color: snapshot.status === 'COMPLETED' ? '#22543d' : '#856404',
                  borderRadius: '6px',
                  fontSize: '0.875rem',
                  fontWeight: '600'
                }}>
                  {snapshot.status === 'COMPLETED' ? '✓ Complete' : '⏳ Active'}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default SnapshotManager;
