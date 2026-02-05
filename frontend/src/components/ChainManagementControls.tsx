/**
 * Chain Management Controls Component - Enhanced Design
 * Requirements: 3.1, 6.1, 11.3
 */

import React, { useState } from 'react';

enum ChainPhase {
  ENTRY = "ENTRY",
  EXIT = "EXIT"
}

enum ChainState {
  ACTIVE = "ACTIVE",
  STALLED = "STALLED",
  COMPLETED = "COMPLETED"
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

interface SeedResponse {
  chainsCreated: number;
  initialHolders: string[];
}

interface ChainManagementControlsProps {
  sessionId: string;
  chains: Chain[];
  stalledChains: string[];
  onChainsUpdated?: () => void;
  onError?: (error: string) => void;
}

export const ChainManagementControls: React.FC<ChainManagementControlsProps> = ({
  sessionId,
  chains,
  stalledChains,
  onChainsUpdated,
  onError,
}) => {
  const [entryChainCount, setEntryChainCount] = useState<number>(3);
  const [exitChainCount, setExitChainCount] = useState<number>(3);
  const [reseedCount, setReseedCount] = useState<number>(2);
  
  const [seedingEntry, setSeedingEntry] = useState(false);
  const [startingExit, setStartingExit] = useState(false);
  const [reseedingEntry, setReseedingEntry] = useState(false);
  const [reseedingExit, setReseedingExit] = useState(false);
  
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const handleSeedEntry = async () => {
    if (entryChainCount <= 0) {
      onError?.('Chain count must be a positive number');
      return;
    }

    setSeedingEntry(true);
    setSuccessMessage(null);

    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || '/api';
      const headers: HeadersInit = { 'Content-Type': 'application/json' };
      
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
        `${apiUrl}/sessions/${sessionId}/seed-entry?count=${entryChainCount}`,
        { method: 'POST', headers }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error?.message || `Failed to seed entry chains: ${response.statusText}`);
      }

      const data: SeedResponse = await response.json();
      setSuccessMessage(`Successfully seeded ${data.chainsCreated} entry chain(s)`);
      onChainsUpdated?.();
    } catch (err) {
      onError?.(err instanceof Error ? err.message : 'Failed to seed entry chains');
    } finally {
      setSeedingEntry(false);
    }
  };

  const handleStartExit = async () => {
    if (exitChainCount <= 0) {
      onError?.('Chain count must be a positive number');
      return;
    }

    setStartingExit(true);
    setSuccessMessage(null);

    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || '/api';
      const headers: HeadersInit = { 'Content-Type': 'application/json' };
      
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
        `${apiUrl}/sessions/${sessionId}/start-exit-chain?count=${exitChainCount}`,
        { method: 'POST', headers }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error?.message || `Failed to start exit chains: ${response.statusText}`);
      }

      const data: SeedResponse = await response.json();
      setSuccessMessage(`Successfully started ${data.chainsCreated} exit chain(s)`);
      onChainsUpdated?.();
    } catch (err) {
      onError?.(err instanceof Error ? err.message : 'Failed to start exit chains');
    } finally {
      setStartingExit(false);
    }
  };

  const formatTimestamp = (timestamp?: number): string => {
    if (!timestamp) return 'N/A';
    return new Date(timestamp * 1000).toLocaleTimeString();
  };

  const entryChains = chains.filter(c => c.phase === ChainPhase.ENTRY);
  const exitChains = chains.filter(c => c.phase === ChainPhase.EXIT);

  const inputStyle: React.CSSProperties = {
    width: '80px',
    padding: '0.5rem 0.75rem',
    fontSize: '0.95rem',
    border: '2px solid #e2e8f0',
    borderRadius: '8px',
    textAlign: 'center',
    fontWeight: '600',
    boxSizing: 'border-box'
  };

  const buttonStyle: React.CSSProperties = {
    padding: '0.625rem 1.25rem',
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    color: 'white',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    fontSize: '0.95rem',
    fontWeight: '600',
    boxShadow: '0 4px 12px rgba(102, 126, 234, 0.3)',
    transition: 'all 0.2s',
    whiteSpace: 'nowrap'
  };

  return (
    <div style={{
      backgroundColor: 'white',
      padding: '2rem',
      borderRadius: '16px',
      boxShadow: '0 8px 32px rgba(0,0,0,0.08)'
    }}>
      <h2 style={{ 
        color: '#2d3748',
        fontSize: '1.5rem',
        marginBottom: '1.5rem',
        fontWeight: '700'
      }}>
        🔗 Chain Management
      </h2>

      {successMessage && (
        <div style={{
          padding: '1rem 1.25rem',
          backgroundColor: '#c6f6d5',
          border: '2px solid #48bb78',
          borderRadius: '10px',
          marginBottom: '1.5rem',
          color: '#22543d',
          fontWeight: '500'
        }}>
          ✓ {successMessage}
        </div>
      )}

      {/* Entry Chains */}
      <div style={{
        marginBottom: '2rem',
        padding: '1.5rem',
        backgroundColor: '#f7fafc',
        borderRadius: '12px',
        border: '2px solid #e2e8f0'
      }}>
        <h3 style={{ 
          color: '#2d3748',
          fontSize: '1.25rem',
          marginBottom: '1rem',
          fontWeight: '600',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem'
        }}>
          <span>🟢</span> Entry Chains
        </h3>
        
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: '1rem',
          flexWrap: 'wrap',
          marginBottom: entryChains.length > 0 ? '1.5rem' : 0
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <label htmlFor="entry-chain-count" style={{ 
              color: '#4a5568',
              fontSize: '0.95rem',
              fontWeight: '600'
            }}>
              Number of chains:
            </label>
            <input
              id="entry-chain-count"
              type="number"
              min="1"
              max="50"
              value={entryChainCount}
              onChange={(e) => setEntryChainCount(parseInt(e.target.value) || 1)}
              disabled={seedingEntry}
              style={inputStyle}
              onFocus={(e) => e.currentTarget.style.borderColor = '#667eea'}
              onBlur={(e) => e.currentTarget.style.borderColor = '#e2e8f0'}
            />
          </div>
          
          <button
            onClick={handleSeedEntry}
            disabled={seedingEntry}
            style={{
              ...buttonStyle,
              opacity: seedingEntry ? 0.6 : 1,
              cursor: seedingEntry ? 'not-allowed' : 'pointer'
            }}
            onMouseOver={(e) => {
              if (!seedingEntry) {
                e.currentTarget.style.transform = 'scale(1.02)';
                e.currentTarget.style.boxShadow = '0 6px 16px rgba(102, 126, 234, 0.4)';
              }
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.transform = 'scale(1)';
              e.currentTarget.style.boxShadow = '0 4px 12px rgba(102, 126, 234, 0.3)';
            }}
          >
            {seedingEntry ? '⏳ Seeding...' : '🌱 Seed Entry Chains'}
          </button>
        </div>

        {entryChains.length > 0 && (
          <div>
            <h4 style={{ 
              color: '#4a5568',
              fontSize: '1rem',
              marginBottom: '0.75rem',
              fontWeight: '600'
            }}>
              Active Chains ({entryChains.length})
            </h4>
            <div style={{ display: 'grid', gap: '0.75rem' }}>
              {entryChains.map(chain => (
                <div 
                  key={chain.chainId}
                  style={{
                    padding: '1rem',
                    backgroundColor: 'white',
                    borderRadius: '8px',
                    border: stalledChains.includes(chain.chainId) ? '2px solid #fc8181' : '2px solid #e2e8f0',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: '0.75rem'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                    <span style={{
                      fontFamily: 'monospace',
                      fontSize: '0.875rem',
                      color: '#4a5568',
                      fontWeight: '600'
                    }}>
                      #{chain.chainId.substring(0, 8)}
                    </span>
                    {stalledChains.includes(chain.chainId) && (
                      <span style={{
                        padding: '0.25rem 0.625rem',
                        backgroundColor: '#fed7d7',
                        color: '#742a2a',
                        borderRadius: '12px',
                        fontSize: '0.75rem',
                        fontWeight: '700'
                      }}>
                        ⚠️ STALLED
                      </span>
                    )}
                  </div>
                  <div style={{ 
                    display: 'flex', 
                    gap: '1rem',
                    fontSize: '0.875rem',
                    color: '#718096',
                    flexWrap: 'wrap'
                  }}>
                    <span>
                      Holder: <strong style={{ color: '#2d3748' }}>{chain.lastHolder || 'None'}</strong>
                    </span>
                    <span>
                      Seq: <strong style={{ color: '#2d3748' }}>{chain.lastSeq}</strong>
                    </span>
                    <span>
                      Last: {formatTimestamp(chain.lastAt)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Exit Chains */}
      <div style={{
        padding: '1.5rem',
        backgroundColor: '#f7fafc',
        borderRadius: '12px',
        border: '2px solid #e2e8f0'
      }}>
        <h3 style={{ 
          color: '#2d3748',
          fontSize: '1.25rem',
          marginBottom: '1rem',
          fontWeight: '600',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem'
        }}>
          <span>🔴</span> Exit Chains
        </h3>
        
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: '1rem',
          flexWrap: 'wrap',
          marginBottom: exitChains.length > 0 ? '1.5rem' : 0
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <label htmlFor="exit-chain-count" style={{ 
              color: '#4a5568',
              fontSize: '0.95rem',
              fontWeight: '600'
            }}>
              Number of chains:
            </label>
            <input
              id="exit-chain-count"
              type="number"
              min="1"
              max="50"
              value={exitChainCount}
              onChange={(e) => setExitChainCount(parseInt(e.target.value) || 1)}
              disabled={startingExit}
              style={inputStyle}
              onFocus={(e) => e.currentTarget.style.borderColor = '#667eea'}
              onBlur={(e) => e.currentTarget.style.borderColor = '#e2e8f0'}
            />
          </div>
          
          <button
            onClick={handleStartExit}
            disabled={startingExit}
            style={{
              ...buttonStyle,
              opacity: startingExit ? 0.6 : 1,
              cursor: startingExit ? 'not-allowed' : 'pointer'
            }}
            onMouseOver={(e) => {
              if (!startingExit) {
                e.currentTarget.style.transform = 'scale(1.02)';
                e.currentTarget.style.boxShadow = '0 6px 16px rgba(102, 126, 234, 0.4)';
              }
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.transform = 'scale(1)';
              e.currentTarget.style.boxShadow = '0 4px 12px rgba(102, 126, 234, 0.3)';
            }}
          >
            {startingExit ? '⏳ Starting...' : '🚀 Start Exit Chains'}
          </button>
        </div>

        {exitChains.length > 0 && (
          <div>
            <h4 style={{ 
              color: '#4a5568',
              fontSize: '1rem',
              marginBottom: '0.75rem',
              fontWeight: '600'
            }}>
              Active Chains ({exitChains.length})
            </h4>
            <div style={{ display: 'grid', gap: '0.75rem' }}>
              {exitChains.map(chain => (
                <div 
                  key={chain.chainId}
                  style={{
                    padding: '1rem',
                    backgroundColor: 'white',
                    borderRadius: '8px',
                    border: stalledChains.includes(chain.chainId) ? '2px solid #fc8181' : '2px solid #e2e8f0',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: '0.75rem'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                    <span style={{
                      fontFamily: 'monospace',
                      fontSize: '0.875rem',
                      color: '#4a5568',
                      fontWeight: '600'
                    }}>
                      #{chain.chainId.substring(0, 8)}
                    </span>
                    {stalledChains.includes(chain.chainId) && (
                      <span style={{
                        padding: '0.25rem 0.625rem',
                        backgroundColor: '#fed7d7',
                        color: '#742a2a',
                        borderRadius: '12px',
                        fontSize: '0.75rem',
                        fontWeight: '700'
                      }}>
                        ⚠️ STALLED
                      </span>
                    )}
                  </div>
                  <div style={{ 
                    display: 'flex', 
                    gap: '1rem',
                    fontSize: '0.875rem',
                    color: '#718096',
                    flexWrap: 'wrap'
                  }}>
                    <span>
                      Holder: <strong style={{ color: '#2d3748' }}>{chain.lastHolder || 'None'}</strong>
                    </span>
                    <span>
                      Seq: <strong style={{ color: '#2d3748' }}>{chain.lastSeq}</strong>
                    </span>
                    <span>
                      Last: {formatTimestamp(chain.lastAt)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
