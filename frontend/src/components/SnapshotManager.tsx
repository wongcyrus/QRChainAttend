/**
 * Snapshot Manager Component
 * Allows teachers to create snapshots and view snapshot history
 */

import React, { useState, useEffect } from 'react';
import { Snapshot } from '../types/shared';
import { ChainTraceViewer } from './ChainTraceViewer';
import { SnapshotComparison } from './SnapshotComparison';

interface SnapshotManagerProps {
  sessionId: string;
  onError?: (error: string) => void;
  className?: string;
}

export function SnapshotManager({
  sessionId,
  onError,
  className = ''
}: SnapshotManagerProps) {
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [selectedSnapshot, setSelectedSnapshot] = useState<Snapshot | null>(null);
  const [viewMode, setViewMode] = useState<'list' | 'trace' | 'compare'>('list');
  const [snapshotType, setSnapshotType] = useState<'ENTRY' | 'EXIT'>('ENTRY');
  const [chainCount, setChainCount] = useState(3);
  const [snapshotNotes, setSnapshotNotes] = useState('');
  const [compareSnapshots, setCompareSnapshots] = useState<[Snapshot | null, Snapshot | null]>([null, null]);

  // Load snapshots on mount
  useEffect(() => {
    loadSnapshots();
  }, [sessionId]);

  const loadSnapshots = async () => {
    setIsLoading(true);
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || '/api';
      const response = await fetch(`${apiUrl}/sessions/${sessionId}/snapshots`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          ...(process.env.NEXT_PUBLIC_ENVIRONMENT === 'local' && {
            'x-ms-client-principal': Buffer.from(JSON.stringify({
              userDetails: 'teacher@vtc.edu.hk',
              userRoles: ['authenticated', 'teacher']
            })).toString('base64')
          })
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to load snapshots: ${response.statusText}`);
      }

      const data = await response.json();
      setSnapshots(data.snapshots || []);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to load snapshots';
      onError?.(message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateSnapshot = async () => {
    setIsCreating(true);
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || '/api';
      const response = await fetch(
        `${apiUrl}/sessions/${sessionId}/snapshot?type=${snapshotType}&count=${chainCount}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(process.env.NEXT_PUBLIC_ENVIRONMENT === 'local' && {
              'x-ms-client-principal': Buffer.from(JSON.stringify({
                userDetails: 'teacher@vtc.edu.hk',
                userRoles: ['authenticated', 'teacher']
              })).toString('base64')
            })
          },
          body: JSON.stringify({ notes: snapshotNotes || undefined })
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to create snapshot: ${response.statusText}`);
      }

      // Reset form and reload snapshots
      setSnapshotNotes('');
      await loadSnapshots();
      setViewMode('list');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to create snapshot';
      onError?.(message);
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className={`snapshot-manager ${className}`} style={{
      display: 'flex',
      flexDirection: 'column',
      gap: '1.5rem'
    }}>
      {viewMode === 'list' && (
        <>
          {/* Create Snapshot Form */}
          <SnapshotCreationForm
            snapshotType={snapshotType}
            chainCount={chainCount}
            snapshotNotes={snapshotNotes}
            isCreating={isCreating}
            onSnapshotTypeChange={setSnapshotType}
            onChainCountChange={setChainCount}
            onNotesChange={setSnapshotNotes}
            onCreateSnapshot={handleCreateSnapshot}
          />

          {/* Snapshots List */}
          <SnapshotsList
            snapshots={snapshots}
            isLoading={isLoading}
            onSelectSnapshot={(snap) => {
              setSelectedSnapshot(snap);
              setViewMode('trace');
            }}
            onCompareSelect={(snap) => {
              if (!compareSnapshots[0]) {
                setCompareSnapshots([snap, null]);
              } else if (!compareSnapshots[1]) {
                setCompareSnapshots([compareSnapshots[0], snap]);
                setViewMode('compare');
              } else {
                setCompareSnapshots([snap, null]);
              }
            }}
          />
        </>
      )}

      {viewMode === 'trace' && selectedSnapshot && (
        <SnapshotTraceView
          snapshot={selectedSnapshot}
          sessionId={sessionId}
          onBack={() => {
            setViewMode('list');
            setSelectedSnapshot(null);
          }}
          onError={onError}
        />
      )}

      {viewMode === 'compare' && compareSnapshots[0] && compareSnapshots[1] && (
        <SnapshotCompareView
          snapshot1={compareSnapshots[0]}
          snapshot2={compareSnapshots[1]}
          sessionId={sessionId}
          onBack={() => {
            setViewMode('list');
            setCompareSnapshots([null, null]);
          }}
          onError={onError}
        />
      )}
    </div>
  );
}

interface SnapshotCreationFormProps {
  snapshotType: 'ENTRY' | 'EXIT';
  chainCount: number;
  snapshotNotes: string;
  isCreating: boolean;
  onSnapshotTypeChange: (type: 'ENTRY' | 'EXIT') => void;
  onChainCountChange: (count: number) => void;
  onNotesChange: (notes: string) => void;
  onCreateSnapshot: () => void;
}

function SnapshotCreationForm({
  snapshotType,
  chainCount,
  snapshotNotes,
  isCreating,
  onSnapshotTypeChange,
  onChainCountChange,
  onNotesChange,
  onCreateSnapshot
}: SnapshotCreationFormProps) {
  return (
    <div style={{
      backgroundColor: 'white',
      borderRadius: '8px',
      padding: '1.5rem',
      boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)'
    }}>
      <h3 style={{ marginBottom: '1.5rem', color: '#2d3748' }}>Create New Snapshot</h3>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
        gap: '1.5rem',
        marginBottom: '1.5rem'
      }}>
        {/* Snapshot Type */}
        <div>
          <label style={{
            display: 'block',
            marginBottom: '0.5rem',
            fontWeight: '600',
            color: '#2d3748'
          }}>
            Snapshot Type
          </label>
          <select
            value={snapshotType}
            onChange={(e) => onSnapshotTypeChange(e.target.value as 'ENTRY' | 'EXIT')}
            disabled={isCreating}
            style={{
              width: '100%',
              padding: '0.75rem',
              border: '1px solid #e2e8f0',
              borderRadius: '6px',
              fontSize: '0.95rem',
              cursor: 'pointer'
            }}
          >
            <option value="ENTRY">Entry Chain</option>
            <option value="EXIT">Exit Chain</option>
          </select>
        </div>

        {/* Chain Count */}
        <div>
          <label style={{
            display: 'block',
            marginBottom: '0.5rem',
            fontWeight: '600',
            color: '#2d3748'
          }}>
            Number of Chains
          </label>
          <input
            type="number"
            min="1"
            max="20"
            value={chainCount}
            onChange={(e) => onChainCountChange(parseInt(e.target.value, 10))}
            disabled={isCreating}
            style={{
              width: '100%',
              padding: '0.75rem',
              border: '1px solid #e2e8f0',
              borderRadius: '6px',
              fontSize: '0.95rem'
            }}
          />
        </div>
      </div>

      {/* Notes */}
      <div style={{ marginBottom: '1.5rem' }}>
        <label style={{
          display: 'block',
          marginBottom: '0.5rem',
          fontWeight: '600',
          color: '#2d3748'
        }}>
          Notes (Optional)
        </label>
        <textarea
          value={snapshotNotes}
          onChange={(e) => onNotesChange(e.target.value)}
          disabled={isCreating}
          placeholder="e.g., 'Mid-session check', 'Before break', etc."
          style={{
            width: '100%',
            padding: '0.75rem',
            border: '1px solid #e2e8f0',
            borderRadius: '6px',
            fontSize: '0.95rem',
            minHeight: '80px',
            fontFamily: 'inherit',
            resize: 'vertical'
          }}
        />
      </div>

      {/* Create Button */}
      <button
        onClick={onCreateSnapshot}
        disabled={isCreating || chainCount < 1 || chainCount > 20}
        style={{
          padding: '0.75rem 1.5rem',
          backgroundColor: isCreating ? '#d0d0d0' : '#107c10',
          color: 'white',
          border: 'none',
          borderRadius: '6px',
          fontSize: '0.95rem',
          fontWeight: '600',
          cursor: isCreating ? 'not-allowed' : 'pointer',
          transition: 'background-color 0.2s'
        }}
        onMouseOver={(e) => {
          if (!isCreating) e.currentTarget.style.backgroundColor = '#0b6e1f';
        }}
        onMouseOut={(e) => {
          if (!isCreating) e.currentTarget.style.backgroundColor = '#107c10';
        }}
      >
        {isCreating ? '🔄 Creating Snapshot...' : '📸 Take Snapshot'}
      </button>
    </div>
  );
}

interface SnapshotsListProps {
  snapshots: Snapshot[];
  isLoading: boolean;
  onSelectSnapshot: (snapshot: Snapshot) => void;
  onCompareSelect: (snapshot: Snapshot) => void;
}

function SnapshotsList({
  snapshots,
  isLoading,
  onSelectSnapshot,
  onCompareSelect
}: SnapshotsListProps) {
  if (isLoading) {
    return (
      <div style={{ textAlign: 'center', padding: '2rem', color: '#718096' }}>
        <div className="spinner" style={{
          width: '40px',
          height: '40px',
          border: '4px solid #f3f3f3',
          borderTop: '4px solid #0078d4',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite',
          margin: '0 auto 1rem'
        }}></div>
        Loading snapshots...
      </div>
    );
  }

  if (snapshots.length === 0) {
    return (
      <div style={{
        padding: '2rem',
        textAlign: 'center',
        backgroundColor: '#f0f4f8',
        borderRadius: '8px',
        color: '#718096'
      }}>
        <div style={{ fontSize: '2rem', marginBottom: '1rem' }}>📸</div>
        <p>No snapshots yet. Create one to get started!</p>
      </div>
    );
  }

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      gap: '0.75rem'
    }}>
      <h4 style={{ color: '#2d3748', marginBottom: '0.75rem' }}>Snapshots ({snapshots.length})</h4>
      {snapshots.map((snapshot) => (
        <SnapshotRow
          key={snapshot.snapshotId}
          snapshot={snapshot}
          onSelect={() => onSelectSnapshot(snapshot)}
          onCompare={() => onCompareSelect(snapshot)}
        />
      ))}
    </div>
  );
}

interface SnapshotRowProps {
  snapshot: Snapshot;
  onSelect: () => void;
  onCompare: () => void;
}

function SnapshotRow({ snapshot, onSelect, onCompare }: SnapshotRowProps) {
  const typeIcon = snapshot.snapshotType === 'ENTRY' ? '📥' : '📤';
  const typeColor = snapshot.snapshotType === 'ENTRY' ? '#107c10' : '#d13438';

  return (
    <div style={{
      padding: '1rem',
      backgroundColor: '#f9f9f9',
      border: '1px solid #e2e8f0',
      borderRadius: '6px',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      gap: '1rem'
    }}>
      <div style={{ flex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
          <span style={{ fontSize: '1.25rem' }}>{typeIcon}</span>
          <span style={{
            padding: '0.25rem 0.75rem',
            backgroundColor: `${typeColor}20`,
            color: typeColor,
            borderRadius: '4px',
            fontSize: '0.875rem',
            fontWeight: '600'
          }}>
            {snapshot.snapshotType} #{snapshot.snapshotIndex}
          </span>
          <span style={{ color: '#718096', fontSize: '0.875rem' }}>
            {new Date(snapshot.capturedAt * 1000).toLocaleTimeString()}
          </span>
        </div>
        <div style={{ fontSize: '0.875rem', color: '#718096' }}>
          {snapshot.chainsCreated} chains • {snapshot.studentsCaptured} students
          {snapshot.notes && ` • ${snapshot.notes}`}
        </div>
      </div>
      <div style={{ display: 'flex', gap: '0.5rem' }}>
        <button
          onClick={onSelect}
          style={{
            padding: '0.5rem 1rem',
            backgroundColor: '#0078d4',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '0.875rem',
            fontWeight: '600'
          }}
        >
          View Trace
        </button>
        <button
          onClick={onCompare}
          style={{
            padding: '0.5rem 1rem',
            backgroundColor: '#8764b8',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '0.875rem',
            fontWeight: '600'
          }}
        >
          Compare
        </button>
      </div>
    </div>
  );
}

interface SnapshotTraceViewProps {
  snapshot: Snapshot;
  sessionId: string;
  onBack: () => void;
  onError?: (error: string) => void;
}

function SnapshotTraceView({
  snapshot,
  sessionId,
  onBack,
  onError
}: SnapshotTraceViewProps) {
  const [traces, setTraces] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadTraces();
  }, [snapshot.snapshotId]);

  const loadTraces = async () => {
    setIsLoading(true);
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || '/api';
      const response = await fetch(
        `${apiUrl}/sessions/${sessionId}/snapshots/${snapshot.snapshotId}/chain-trace`,
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            ...(process.env.NEXT_PUBLIC_ENVIRONMENT === 'local' && {
              'x-ms-client-principal': Buffer.from(JSON.stringify({
                userDetails: 'teacher@vtc.edu.hk',
                userRoles: ['authenticated', 'teacher']
              })).toString('base64')
            })
          }
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to load traces: ${response.statusText}`);
      }

      const data = await response.json();
      setTraces(data.chains || []);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to load traces';
      onError?.(message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div>
      <button
        onClick={onBack}
        style={{
          marginBottom: '1rem',
          padding: '0.5rem 1rem',
          backgroundColor: '#e2e8f0',
          color: '#2d3748',
          border: 'none',
          borderRadius: '4px',
          cursor: 'pointer',
          fontWeight: '600'
        }}
      >
        ← Back to Snapshots
      </button>
      <ChainTraceViewer
        snapshotId={snapshot.snapshotId}
        sessionId={sessionId}
        traces={traces}
        isLoading={isLoading}
        onError={onError}
      />
    </div>
  );
}

interface SnapshotCompareViewProps {
  snapshot1: Snapshot;
  snapshot2: Snapshot;
  sessionId: string;
  onBack: () => void;
  onError?: (error: string) => void;
}

function SnapshotCompareView({
  snapshot1,
  snapshot2,
  sessionId,
  onBack,
  onError
}: SnapshotCompareViewProps) {
  const [comparison, setComparison] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadComparison();
  }, [snapshot1.snapshotId, snapshot2.snapshotId]);

  const loadComparison = async () => {
    setIsLoading(true);
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || '/api';
      const response = await fetch(
        `${apiUrl}/sessions/${sessionId}/snapshots/compare?snap1=${snapshot1.snapshotId}&snap2=${snapshot2.snapshotId}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(process.env.NEXT_PUBLIC_ENVIRONMENT === 'local' && {
              'x-ms-client-principal': Buffer.from(JSON.stringify({
                userDetails: 'teacher@vtc.edu.hk',
                userRoles: ['authenticated', 'teacher']
              })).toString('base64')
            })
          }
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to compare snapshots: ${response.statusText}`);
      }

      const data = await response.json();
      setComparison(data.comparison);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to compare snapshots';
      onError?.(message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div>
      <button
        onClick={onBack}
        style={{
          marginBottom: '1rem',
          padding: '0.5rem 1rem',
          backgroundColor: '#e2e8f0',
          color: '#2d3748',
          border: 'none',
          borderRadius: '4px',
          cursor: 'pointer',
          fontWeight: '600'
        }}
      >
        ← Back to Snapshots
      </button>
      {isLoading ? (
        <div style={{ textAlign: 'center', padding: '2rem' }}>
          <div style={{ color: '#718096' }}>Loading comparison...</div>
        </div>
      ) : comparison ? (
        <SnapshotComparison comparison={comparison} />
      ) : null}
    </div>
  );
}
