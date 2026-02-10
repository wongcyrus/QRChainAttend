/**
 * Chain Management Controls Component - Enhanced Design
 * Requirements: 3.1, 6.1, 11.3
 */

import React, { useState } from 'react';
import { ChainVisualization } from './ChainVisualization';
import { getAuthHeaders } from '../utils/authHeaders';

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
  const [closingChain, setClosingChain] = useState<string | null>(null);
  const [settingHolder, setSettingHolder] = useState<string | null>(null);
  const [manualHolderInput, setManualHolderInput] = useState<{ [chainId: string]: string }>({});
  
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
      const headers = await getAuthHeaders();
      
      const response = await fetch(
        `${apiUrl}/sessions/${sessionId}/seed-entry?count=${entryChainCount}`,
        { method: 'POST', headers, credentials: 'include' }
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
      const headers = await getAuthHeaders();
      
      const response = await fetch(
        `${apiUrl}/sessions/${sessionId}/start-exit-chain?count=${exitChainCount}`,
        { credentials: 'include', method: 'POST', headers }
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

  const renderChainControls = (chain: Chain) => (
    <>
      <span>
        Holder: <strong style={{ color: '#2d3748' }}>{chain.lastHolder || 'None'}</strong>
      </span>
      <span>
        Seq: <strong style={{ color: '#2d3748' }}>{chain.lastSeq}</strong>
      </span>
      <span>
        Last: {formatTimestamp(chain.lastAt)}
      </span>
      
      {/* Manual holder assignment - only show if no holder */}
      {!chain.lastHolder && (
        <div style={{ 
          display: 'flex', 
          gap: '0.5rem', 
          alignItems: 'center',
          padding: '0.5rem',
          backgroundColor: '#fff3cd',
          borderRadius: '4px',
          border: '1px solid #ffc107'
        }}>
          <span style={{ fontSize: '0.75rem', color: '#856404', fontWeight: '600' }}>
            Manually assign:
          </span>
          <input
            type="text"
            placeholder="student@stu.vtc.edu.hk"
            value={manualHolderInput[chain.chainId] || ''}
            onChange={(e) => setManualHolderInput({ ...manualHolderInput, [chain.chainId]: e.target.value })}
            disabled={settingHolder === chain.chainId}
            style={{
              padding: '0.375rem 0.5rem',
              fontSize: '0.75rem',
              border: '1px solid #cbd5e0',
              borderRadius: '4px',
              width: '180px'
            }}
          />
          <button
            onClick={() => handleSetHolder(chain.chainId)}
            disabled={settingHolder === chain.chainId || !manualHolderInput[chain.chainId]?.trim()}
            style={{
              padding: '0.375rem 0.75rem',
              backgroundColor: settingHolder === chain.chainId || !manualHolderInput[chain.chainId]?.trim() ? '#ccc' : '#4299e1',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: settingHolder === chain.chainId || !manualHolderInput[chain.chainId]?.trim() ? 'not-allowed' : 'pointer',
              fontSize: '0.75rem',
              fontWeight: '600',
              transition: 'all 0.2s'
            }}
            onMouseOver={(e) => {
              if (settingHolder !== chain.chainId && manualHolderInput[chain.chainId]?.trim()) {
                e.currentTarget.style.backgroundColor = '#3182ce';
              }
            }}
            onMouseOut={(e) => {
              if (settingHolder !== chain.chainId && manualHolderInput[chain.chainId]?.trim()) {
                e.currentTarget.style.backgroundColor = '#4299e1';
              }
            }}
          >
            {settingHolder === chain.chainId ? '⏳' : '👤 Assign'}
          </button>
        </div>
      )}
      
      {chain.lastHolder && (
        <button
          onClick={() => handleCloseChain(chain.chainId)}
          disabled={closingChain === chain.chainId}
          style={{
            padding: '0.375rem 0.75rem',
            backgroundColor: closingChain === chain.chainId ? '#ccc' : '#dc3545',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: closingChain === chain.chainId ? 'not-allowed' : 'pointer',
            fontSize: '0.75rem',
            fontWeight: '600',
            transition: 'all 0.2s'
          }}
          onMouseOver={(e) => {
            if (closingChain !== chain.chainId) {
              e.currentTarget.style.backgroundColor = '#c82333';
            }
          }}
          onMouseOut={(e) => {
            if (closingChain !== chain.chainId) {
              e.currentTarget.style.backgroundColor = '#dc3545';
            }
          }}
        >
          {closingChain === chain.chainId ? '⏳ Closing...' : '🔒 Close & Mark Present'}
        </button>
      )}
    </>
  );

  const handleCloseChain = async (chainId: string) => {
    if (!confirm('Close this chain and mark the final holder as present?')) {
      return;
    }

    setClosingChain(chainId);
    setSuccessMessage(null);

    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || '/api';
      const headers = await getAuthHeaders();
      
      const response = await fetch(
        `${apiUrl}/sessions/${sessionId}/chains/${chainId}/close`,
        { credentials: 'include', method: 'POST', headers }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error?.message || `Failed to close chain: ${response.statusText}`);
      }

      const data = await response.json();
      setSuccessMessage(`Chain closed. ${data.finalHolder} marked present.`);
      onChainsUpdated?.();
    } catch (err) {
      onError?.(err instanceof Error ? err.message : 'Failed to close chain');
    } finally {
      setClosingChain(null);
    }
  };

  const handleSetHolder = async (chainId: string) => {
    const studentId = manualHolderInput[chainId]?.trim();
    
    if (!studentId) {
      onError?.('Please enter a student ID');
      return;
    }

    if (!confirm(`Set ${studentId} as the holder of this chain?`)) {
      return;
    }

    setSettingHolder(chainId);
    setSuccessMessage(null);

    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || '/api';
      const headers = await getAuthHeaders();
      
      const response = await fetch(
        `${apiUrl}/sessions/${sessionId}/chains/${chainId}/set-holder`,
        { credentials: 'include', 
          method: 'POST', 
          headers,
          body: JSON.stringify({ studentId })
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error?.message || `Failed to set holder: ${response.statusText}`);
      }

      const data = await response.json();
      setSuccessMessage(`${data.newHolder} is now the holder (seq ${data.sequence})`);
      setManualHolderInput({ ...manualHolderInput, [chainId]: '' });
      onChainsUpdated?.();
    } catch (err) {
      onError?.(err instanceof Error ? err.message : 'Failed to set holder');
    } finally {
      setSettingHolder(null);
    }
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
        marginBottom: '1rem',
        fontWeight: '700'
      }}>
        🔗 Chain Management
      </h2>

      {/* Help Text */}
      <div style={{
        padding: '1rem',
        backgroundColor: '#e3f2fd',
        borderRadius: '8px',
        marginBottom: '1.5rem',
        border: '1px solid #90caf9'
      }}>
        <p style={{ margin: '0 0 0.5rem 0', fontSize: '0.875rem', color: '#1976d2', fontWeight: '600' }}>
          💡 How Chain Attendance Works:
        </p>
        <ul style={{ margin: 0, paddingLeft: '1.5rem', fontSize: '0.875rem', color: '#0d47a1', lineHeight: '1.6' }}>
          <li><strong>Seed Entry Chains:</strong> Click to start attendance. Random students become "holders" and see a QR code on their phone.</li>
          <li><strong>Students scan each other:</strong> Holders show their QR code to another student, who scans it with their phone camera. The chain passes to the scanner.</li>
          <li><strong>Chain continues:</strong> Each scan marks the previous holder as present and passes the chain to the next student.</li>
          <li><strong>Last student problem:</strong> When the last student has the chain (no one left to pass to), you have 2 options:
            <ul style={{ marginTop: '0.25rem' }}>
              <li><strong>Option 1 - Manually assign:</strong> If chain shows "Holder: None", enter the last student's email and click "Assign" to give them the holder status.</li>
              <li><strong>Option 2 - Close chain:</strong> If chain already has a holder, click "🔒 Close & Mark Present" to end the chain and mark that student as present.</li>
            </ul>
          </li>
        </ul>
      </div>

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
                    border: stalledChains.includes(chain.chainId) ? '2px solid #fc8181' : '2px solid #e2e8f0'
                  }}
                >
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: '0.75rem'
                  }}>
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
                      flexWrap: 'wrap',
                      alignItems: 'center'
                    }}>
                      {renderChainControls(chain)}
                    </div>
                  </div>
                  
                  {/* Chain Visualization */}
                  <ChainVisualization
                    sessionId={sessionId}
                    chainId={chain.chainId}
                    lastSeq={chain.lastSeq}
                    lastHolder={chain.lastHolder}
                    phase={chain.phase as 'ENTRY' | 'EXIT'}
                  />
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
                    flexWrap: 'wrap',
                    alignItems: 'center'
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
                    
                    {/* Manual holder assignment */}
                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                      <input
                        type="text"
                        placeholder="Student ID"
                        value={manualHolderInput[chain.chainId] || ''}
                        onChange={(e) => setManualHolderInput({ ...manualHolderInput, [chain.chainId]: e.target.value })}
                        disabled={settingHolder === chain.chainId}
                        style={{
                          padding: '0.375rem 0.5rem',
                          fontSize: '0.75rem',
                          border: '1px solid #cbd5e0',
                          borderRadius: '4px',
                          width: '100px'
                        }}
                      />
                      <button
                        onClick={() => handleSetHolder(chain.chainId)}
                        disabled={settingHolder === chain.chainId || !manualHolderInput[chain.chainId]?.trim()}
                        style={{
                          padding: '0.375rem 0.75rem',
                          backgroundColor: settingHolder === chain.chainId || !manualHolderInput[chain.chainId]?.trim() ? '#ccc' : '#4299e1',
                          color: 'white',
                          border: 'none',
                          borderRadius: '4px',
                          cursor: settingHolder === chain.chainId || !manualHolderInput[chain.chainId]?.trim() ? 'not-allowed' : 'pointer',
                          fontSize: '0.75rem',
                          fontWeight: '600',
                          transition: 'all 0.2s'
                        }}
                        onMouseOver={(e) => {
                          if (settingHolder !== chain.chainId && manualHolderInput[chain.chainId]?.trim()) {
                            e.currentTarget.style.backgroundColor = '#3182ce';
                          }
                        }}
                        onMouseOut={(e) => {
                          if (settingHolder !== chain.chainId && manualHolderInput[chain.chainId]?.trim()) {
                            e.currentTarget.style.backgroundColor = '#4299e1';
                          }
                        }}
                      >
                        {settingHolder === chain.chainId ? '⏳' : '👤 Set Holder'}
                      </button>
                    </div>
                    
                    {chain.lastHolder && (
                      <button
                        onClick={() => handleCloseChain(chain.chainId)}
                        disabled={closingChain === chain.chainId}
                        style={{
                          padding: '0.375rem 0.75rem',
                          backgroundColor: closingChain === chain.chainId ? '#ccc' : '#dc3545',
                          color: 'white',
                          border: 'none',
                          borderRadius: '4px',
                          cursor: closingChain === chain.chainId ? 'not-allowed' : 'pointer',
                          fontSize: '0.75rem',
                          fontWeight: '600',
                          transition: 'all 0.2s'
                        }}
                        onMouseOver={(e) => {
                          if (closingChain !== chain.chainId) {
                            e.currentTarget.style.backgroundColor = '#c82333';
                          }
                        }}
                        onMouseOut={(e) => {
                          if (closingChain !== chain.chainId) {
                            e.currentTarget.style.backgroundColor = '#dc3545';
                          }
                        }}
                      >
                        {closingChain === chain.chainId ? '⏳ Closing...' : '🔒 Close Chain'}
                      </button>
                    )}
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


