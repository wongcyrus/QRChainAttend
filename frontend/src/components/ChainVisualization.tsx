/**
 * Chain Visualization Component
 * Shows the actual chain flow: Student1 -> Student2 -> Student3
 */

import React, { useState, useEffect } from 'react';
import { getAuthHeaders } from '../utils/authHeaders';

interface ChainVisualizationProps {
  sessionId: string;
  chainId: string;
  lastSeq: number;
  lastHolder?: string;
  phase: 'ENTRY' | 'EXIT';
}

interface ChainHistoryItem {
  sequence: number;
  fromHolder: string;
  toHolder: string;
  scannedAt: number;
}

export const ChainVisualization: React.FC<ChainVisualizationProps> = ({
  sessionId,
  chainId,
  lastSeq,
  lastHolder,
  phase
}) => {
  const [history, setHistory] = useState<ChainHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || '/api';
        const headers: HeadersInit = {};
        
        if (process.env.NEXT_PUBLIC_ENVIRONMENT === 'local') {
          const mockPrincipal = {
            userId: 'local-dev-teacher',
            userDetails: 'teacher@vtc.edu.hk',
            userRoles: ['authenticated', 'teacher'],
            identityProvider: 'aad'
          };
          headers['x-ms-client-principal'] = Buffer.from(JSON.stringify(mockPrincipal)).toString('base64');
        }
        
        const response = await fetch(
          `${apiUrl}/sessions/${sessionId}/chains/${chainId}/history`,
          { credentials: 'include', headers }
        );
        
        if (response.ok) {
          const data = await response.json();
          setHistory(data.history || []);
        }
      } catch (error) {
        console.error('Failed to fetch chain history:', error);
      } finally {
        setLoading(false);
      }
    };

    if (lastSeq > 0 || lastHolder) {
      fetchHistory();
    } else {
      setLoading(false);
    }
  }, [sessionId, chainId, lastSeq, lastHolder]);

  if (loading) {
    return (
      <div style={{
        marginTop: '1rem',
        padding: '1rem',
        backgroundColor: '#f7fafc',
        borderRadius: '6px',
        textAlign: 'center',
        color: '#718096',
        fontSize: '0.875rem'
      }}>
        Loading chain history...
      </div>
    );
  }

  // Show basic info even if history fetch failed
  const hasData = lastSeq > 0 || lastHolder;
  
  if (!hasData) {
    return null;
  }

  return (
    <div style={{
      marginTop: '1rem',
      padding: '1rem',
      backgroundColor: '#f7fafc',
      borderRadius: '6px',
      border: '1px solid #e2e8f0'
    }}>
      <div style={{ 
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: expanded ? '1rem' : 0
      }}>
        <div style={{ 
          fontSize: '0.75rem', 
          color: '#4a5568', 
          fontWeight: '600',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem'
        }}>
          <span>📊 Chain Flow</span>
          <span style={{
            padding: '0.125rem 0.5rem',
            backgroundColor: phase === 'ENTRY' ? '#d1fae5' : '#fecaca',
            color: phase === 'ENTRY' ? '#065f46' : '#7f1d1d',
            borderRadius: '10px',
            fontSize: '0.625rem',
            fontWeight: '700'
          }}>
            {phase}
          </span>
          <span style={{ color: '#718096', fontWeight: 'normal' }}>
            ({history.length} transfer{history.length !== 1 ? 's' : ''})
          </span>
        </div>
        
        <button
          onClick={() => setExpanded(!expanded)}
          style={{
            padding: '0.25rem 0.5rem',
            backgroundColor: '#e2e8f0',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '0.75rem',
            fontWeight: '600',
            color: '#4a5568'
          }}
        >
          {expanded ? '▼ Hide' : '▶ Show Details'}
        </button>
      </div>

      {expanded && history.length > 0 && (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '0.5rem'
        }}>
          {history.map((item, index) => (
            <div
              key={index}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                padding: '0.75rem',
                backgroundColor: 'white',
                borderRadius: '6px',
                border: '1px solid #e2e8f0',
                fontSize: '0.875rem'
              }}
            >
              <div style={{
                minWidth: '30px',
                height: '30px',
                borderRadius: '50%',
                backgroundColor: index === history.length - 1 ? '#fbbf24' : '#10b981',
                color: 'white',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: '700',
                fontSize: '0.75rem'
              }}>
                {index + 1}
              </div>
              
              <div style={{ flex: 1 }}>
                <div style={{ 
                  color: '#2d3748',
                  fontWeight: '600',
                  fontFamily: 'monospace',
                  fontSize: '0.875rem'
                }}>
                  {item.fromHolder === 'TEACHER' ? '🎯 Initial Seed' : item.fromHolder}
                </div>
                <div style={{ 
                  color: '#718096',
                  fontSize: '0.75rem',
                  marginTop: '0.125rem'
                }}>
                  → {item.toHolder}
                </div>
              </div>
              
              <div style={{
                fontSize: '0.75rem',
                color: '#718096',
                textAlign: 'right'
              }}>
                {new Date(item.scannedAt * 1000).toLocaleTimeString()}
              </div>
            </div>
          ))}
        </div>
      )}
      
      {expanded && history.length === 0 && (
        <div style={{
          padding: '1rem',
          textAlign: 'center',
          color: '#718096',
          fontSize: '0.875rem',
          backgroundColor: 'white',
          borderRadius: '6px',
          border: '1px solid #e2e8f0'
        }}>
          No chain history available yet. History tracking starts from new scans.
        </div>
      )}
    </div>
  );
};



