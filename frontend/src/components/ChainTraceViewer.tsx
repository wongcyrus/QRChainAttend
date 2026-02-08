/**
 * Chain Trace Viewer Component
 * Visualizes chain transfer progression for a snapshot
 * Shows which student passed to which, with sequence numbers
 */

import React, { useState } from 'react';
import { ChainTraceData, ChainTransfer } from '../types/shared';

interface ChainTraceViewerProps {
  snapshotId: string;
  sessionId: string;
  traces: ChainTraceData[];
  isLoading?: boolean;
  onError?: (error: string) => void;
  className?: string;
}

export function ChainTraceViewer({
  snapshotId,
  sessionId,
  traces,
  isLoading = false,
  onError,
  className = ''
}: ChainTraceViewerProps) {
  const [expandedChains, setExpandedChains] = useState<Set<string>>(new Set());

  const toggleChainExpanded = (chainId: string) => {
    const newSet = new Set(expandedChains);
    if (newSet.has(chainId)) {
      newSet.delete(chainId);
    } else {
      newSet.add(chainId);
    }
    setExpandedChains(newSet);
  };

  if (isLoading) {
    return (
      <div className={`chain-trace-viewer ${className}`} style={{ padding: '2rem', textAlign: 'center' }}>
        <div className="spinner"></div>
        <p>Loading chain traces...</p>
      </div>
    );
  }

  if (!traces || traces.length === 0) {
    return (
      <div className={`chain-trace-viewer ${className}`} style={{ padding: '2rem', textAlign: 'center', color: '#666' }}>
        <p>No chain data available for this snapshot</p>
      </div>
    );
  }

  return (
    <div className={`chain-trace-viewer ${className}`} style={{ padding: '1.5rem' }}>
      <h3 style={{ marginBottom: '1.5rem', color: '#2d3748' }}>Chain Transfer Traces</h3>
      
      {/* Summary Stats */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
        gap: '1rem',
        marginBottom: '2rem'
      }}>
        <div style={{
          padding: '1rem',
          backgroundColor: '#f0f4f8',
          borderRadius: '8px',
          textAlign: 'center'
        }}>
          <div style={{ fontSize: '0.875rem', color: '#666' }}>Total Chains</div>
          <div style={{ fontSize: '1.75rem', fontWeight: 'bold', color: '#0078d4' }}>
            {traces.length}
          </div>
        </div>
        <div style={{
          padding: '1rem',
          backgroundColor: '#f0f4f8',
          borderRadius: '8px',
          textAlign: 'center'
        }}>
          <div style={{ fontSize: '0.875rem', color: '#666' }}>Total Transfers</div>
          <div style={{ fontSize: '1.75rem', fontWeight: 'bold', color: '#107c10' }}>
            {traces.reduce((sum, t) => sum + t.totalTransfers, 0)}
          </div>
        </div>
        <div style={{
          padding: '1rem',
          backgroundColor: '#f0f4f8',
          borderRadius: '8px',
          textAlign: 'center'
        }}>
          <div style={{ fontSize: '0.875rem', color: '#666' }}>Success Rate</div>
          <div style={{ fontSize: '1.75rem', fontWeight: 'bold', color: '#107c10' }}>
            {traces.length > 0 
              ? Math.round(
                  (traces.reduce((sum, t) => sum + t.successfulTransfers, 0) / 
                    traces.reduce((sum, t) => sum + t.totalTransfers, 0)) * 100
                ) + '%'
              : 'N/A'
            }
          </div>
        </div>
      </div>

      {/* Chains List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {traces.map((trace) => (
          <ChainTraceCard
            key={trace.chainId}
            trace={trace}
            isExpanded={expandedChains.has(trace.chainId)}
            onToggleExpand={() => toggleChainExpanded(trace.chainId)}
          />
        ))}
      </div>

      <style>{`
        .chain-trace-viewer {
          background: white;
          border-radius: 8px;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
        }

        .spinner {
          width: 40px;
          height: 40px;
          border: 4px solid #f3f3f3;
          border-top: 4px solid #0078d4;
          border-radius: 50%;
          animation: spin 1s linear infinite;
          margin: 0 auto 1rem;
        }

        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}

interface ChainTraceCardProps {
  trace: ChainTraceData;
  isExpanded: boolean;
  onToggleExpand: () => void;
}

function ChainTraceCard({ trace, isExpanded, onToggleExpand }: ChainTraceCardProps) {
  const stateColors: Record<string, string> = {
    ACTIVE: '#107c10',
    STALLED: '#ffb900',
    COMPLETED: '#0078d4'
  };

  const stateIcons: Record<string, string> = {
    ACTIVE: '🔄',
    STALLED: '⚠️',
    COMPLETED: '✅'
  };

  return (
    <div style={{
      border: '1px solid #e2e8f0',
      borderRadius: '8px',
      overflow: 'hidden',
      backgroundColor: '#fafbfc'
    }}>
      {/* Header */}
      <div
        onClick={onToggleExpand}
        style={{
          padding: '1rem',
          backgroundColor: '#f0f4f8',
          cursor: 'pointer',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          userSelect: 'none'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flex: 1 }}>
          <span style={{
            fontSize: '1.25rem',
            color: stateColors[trace.state],
            fontWeight: 'bold'
          }}>
            {trace.phase === 'ENTRY' ? '📥' : '📤'}
          </span>
          <div>
            <div style={{ fontWeight: '600', color: '#2d3748' }}>
              {trace.phase} Chain
            </div>
            <div style={{ fontSize: '0.875rem', color: '#718096' }}>
              {trace.chainId.substring(0, 8)}...
            </div>
          </div>
        </div>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '2rem' }}>
          <div style={{ textAlign: 'right', fontSize: '0.875rem' }}>
            <div style={{ color: '#107c10', fontWeight: '600' }}>
              {trace.successfulTransfers}/{trace.totalTransfers}
            </div>
            <div style={{ color: '#718096' }}>
              Transfers
            </div>
          </div>
          
          <div style={{
            backgroundColor: stateColors[trace.state],
            color: 'white',
            padding: '0.5rem 1rem',
            borderRadius: '4px',
            fontSize: '0.875rem',
            fontWeight: '600',
            minWidth: '100px',
            textAlign: 'center'
          }}>
            {stateIcons[trace.state]} {trace.state}
          </div>

          <span style={{
            transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
            transition: 'transform 0.3s',
            fontSize: '1.25rem'
          }}>
            ▼
          </span>
        </div>
      </div>

      {/* Expanded Content */}
      {isExpanded && (
        <div style={{ padding: '1.5rem', borderTop: '1px solid #e2e8f0' }}>
          <TransferSequence transfers={trace.transfers} />
        </div>
      )}
    </div>
  );
}

interface TransferSequenceProps {
  transfers: ChainTransfer[];
}

function TransferSequence({ transfers }: TransferSequenceProps) {
  if (transfers.length === 0) {
    return (
      <div style={{ textAlign: 'center', color: '#718096', padding: '1rem' }}>
        No transfers yet
      </div>
    );
  }

  return (
    <div>
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '0.5rem'
      }}>
        {transfers.map((transfer, index) => (
          <div key={index} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            {/* Sequence Number */}
            <div style={{
              minWidth: '30px',
              height: '30px',
              backgroundColor: transfer.success ? '#107c10' : '#d13438',
              color: 'white',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '0.875rem',
              fontWeight: 'bold'
            }}>
              {transfer.seq}
            </div>

            {/* Transfer Details */}
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '0.875rem', color: '#2d3748' }}>
                <span style={{ fontWeight: '600' }}>{transfer.holder}</span>
                {transfer.nextHolder && (
                  <>
                    <span style={{ margin: '0 0.5rem', color: '#718096' }}>→</span>
                    <span style={{ fontWeight: '600' }}>{transfer.nextHolder}</span>
                  </>
                )}
              </div>
              <div style={{ fontSize: '0.75rem', color: '#718096' }}>
                {new Date(transfer.timestamp * 1000).toLocaleTimeString()}
                {transfer.error && ` • ${transfer.error}`}
              </div>
            </div>

            {/* Status Icon */}
            <div style={{ fontSize: '1rem' }}>
              {transfer.success ? '✅' : '❌'}
            </div>
          </div>
        ))}
      </div>

      {/* Flow Visualization */}
      <div style={{
        marginTop: '1.5rem',
        padding: '1rem',
        backgroundColor: '#f9f9f9',
        borderRadius: '6px',
        overflow: 'auto'
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          flexWrap: 'wrap',
          fontSize: '0.875rem',
          fontWeight: '600'
        }}>
          {transfers.map((transfer, index) => (
            <React.Fragment key={index}>
              <div style={{
                padding: '0.5rem 0.75rem',
                backgroundColor: '#e8f4f8',
                borderRadius: '4px',
                border: `2px solid ${transfer.success ? '#107c10' : '#d13438'}`
              }}>
                {transfer.holder.split('@')[0]}
              </div>
              {index < transfers.length - 1 && (
                <div style={{ color: '#718096', fontSize: '1.25rem' }}>→</div>
              )}
            </React.Fragment>
          ))}
        </div>
      </div>
    </div>
  );
}
