/**
 * Chain Management Controls Component
 * 
 * Requirements: 3.1, 6.1, 11.3
 * 
 * Provides controls for teachers to manage entry and exit chains:
 * - Seed entry chains with count input
 * - Start exit chains with count input
 * - Reseed stalled chains
 * - Display chain holders and sequence numbers
 */

import React, { useState } from 'react';

// Type definitions
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
  // State for count inputs
  const [entryChainCount, setEntryChainCount] = useState<number>(3);
  const [exitChainCount, setExitChainCount] = useState<number>(3);
  const [reseedCount, setReseedCount] = useState<number>(2);
  
  // Loading states
  const [seedingEntry, setSeedingEntry] = useState(false);
  const [startingExit, setStartingExit] = useState(false);
  const [reseedingEntry, setReseedingEntry] = useState(false);
  const [reseedingExit, setReseedingExit] = useState(false);
  
  // Success messages
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  /**
   * Seed entry chains
   * Requirements: 3.1
   */
  const handleSeedEntry = async () => {
    if (entryChainCount <= 0) {
      onError?.('Chain count must be a positive number');
      return;
    }

    setSeedingEntry(true);
    setSuccessMessage(null);

    try {
      const response = await fetch(
        `/api/sessions/${sessionId}/seed-entry?count=${entryChainCount}`,
        {
          method: 'POST',
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          errorData.error?.message || `Failed to seed entry chains: ${response.statusText}`
        );
      }

      const data: SeedResponse = await response.json();
      setSuccessMessage(
        `Successfully seeded ${data.chainsCreated} entry chain(s) with holders: ${data.initialHolders.join(', ')}`
      );
      
      // Notify parent to refresh data
      onChainsUpdated?.();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to seed entry chains';
      onError?.(errorMessage);
    } finally {
      setSeedingEntry(false);
    }
  };

  /**
   * Start exit chains
   * Requirements: 6.1
   */
  const handleStartExit = async () => {
    if (exitChainCount <= 0) {
      onError?.('Chain count must be a positive number');
      return;
    }

    setStartingExit(true);
    setSuccessMessage(null);

    try {
      const response = await fetch(
        `/api/sessions/${sessionId}/start-exit-chain?count=${exitChainCount}`,
        {
          method: 'POST',
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          errorData.error?.message || `Failed to start exit chains: ${response.statusText}`
        );
      }

      const data: SeedResponse = await response.json();
      setSuccessMessage(
        `Successfully started ${data.chainsCreated} exit chain(s) with holders: ${data.initialHolders.join(', ')}`
      );
      
      // Notify parent to refresh data
      onChainsUpdated?.();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to start exit chains';
      onError?.(errorMessage);
    } finally {
      setStartingExit(false);
    }
  };

  /**
   * Reseed stalled entry chains
   * Requirements: 11.3
   */
  const handleReseedEntry = async () => {
    if (reseedCount <= 0) {
      onError?.('Reseed count must be a positive number');
      return;
    }

    setReseedingEntry(true);
    setSuccessMessage(null);

    try {
      const response = await fetch(
        `/api/sessions/${sessionId}/reseed-entry?count=${reseedCount}`,
        {
          method: 'POST',
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          errorData.error?.message || `Failed to reseed entry chains: ${response.statusText}`
        );
      }

      const data: SeedResponse = await response.json();
      setSuccessMessage(
        `Successfully reseeded ${data.chainsCreated} entry chain(s) with new holders: ${data.initialHolders.join(', ')}`
      );
      
      // Notify parent to refresh data
      onChainsUpdated?.();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to reseed entry chains';
      onError?.(errorMessage);
    } finally {
      setReseedingEntry(false);
    }
  };

  /**
   * Reseed stalled exit chains
   * Requirements: 11.3
   */
  const handleReseedExit = async () => {
    if (reseedCount <= 0) {
      onError?.('Reseed count must be a positive number');
      return;
    }

    setReseedingExit(true);
    setSuccessMessage(null);

    try {
      const response = await fetch(
        `/api/sessions/${sessionId}/reseed-exit?count=${reseedCount}`,
        {
          method: 'POST',
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          errorData.error?.message || `Failed to reseed exit chains: ${response.statusText}`
        );
      }

      const data: SeedResponse = await response.json();
      setSuccessMessage(
        `Successfully reseeded ${data.chainsCreated} exit chain(s) with new holders: ${data.initialHolders.join(', ')}`
      );
      
      // Notify parent to refresh data
      onChainsUpdated?.();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to reseed exit chains';
      onError?.(errorMessage);
    } finally {
      setReseedingExit(false);
    }
  };

  /**
   * Format timestamp for display
   */
  const formatTimestamp = (timestamp?: number): string => {
    if (!timestamp) return 'N/A';
    return new Date(timestamp * 1000).toLocaleTimeString();
  };

  // Get entry and exit chains
  const entryChains = chains.filter(c => c.phase === ChainPhase.ENTRY);
  const exitChains = chains.filter(c => c.phase === ChainPhase.EXIT);
  
  // Get stalled chains by phase
  const stalledEntryChains = entryChains.filter(c => stalledChains.includes(c.chainId));
  const stalledExitChains = exitChains.filter(c => stalledChains.includes(c.chainId));

  return (
    <div className="chain-management-controls">
      <h2>Chain Management</h2>

      {/* Success message */}
      {successMessage && (
        <div className="success-message" role="status">
          ✓ {successMessage}
        </div>
      )}

      {/* Entry Chain Controls */}
      <div className="chain-control-section">
        <h3>Entry Chains</h3>
        
        <div className="chain-control-row">
          <div className="control-group">
            <label htmlFor="entry-chain-count">Number of chains:</label>
            <input
              id="entry-chain-count"
              type="number"
              min="1"
              max="50"
              value={entryChainCount}
              onChange={(e) => setEntryChainCount(parseInt(e.target.value) || 1)}
              disabled={seedingEntry}
              className="chain-count-input"
            />
          </div>
          
          <button
            onClick={handleSeedEntry}
            disabled={seedingEntry}
            className="btn btn-primary"
          >
            {seedingEntry ? 'Seeding...' : 'Seed Entry Chains'}
          </button>
        </div>

        {/* Display entry chains */}
        {entryChains.length > 0 && (
          <div className="chains-display">
            <h4>Active Entry Chains ({entryChains.length})</h4>
            <div className="chains-list">
              {entryChains.map(chain => (
                <div 
                  key={chain.chainId} 
                  className={`chain-item ${chain.state.toLowerCase()} ${stalledChains.includes(chain.chainId) ? 'stalled' : ''}`}
                >
                  <div className="chain-info">
                    <span className="chain-id" title={chain.chainId}>
                      Chain #{chain.chainId.substring(0, 8)}
                    </span>
                    {stalledChains.includes(chain.chainId) && (
                      <span className="stall-badge" title="Chain is stalled">⚠️ Stalled</span>
                    )}
                  </div>
                  <div className="chain-details">
                    <span className="holder">
                      Holder: <strong>{chain.lastHolder || 'None'}</strong>
                    </span>
                    <span className="sequence">
                      Seq: <strong>{chain.lastSeq}</strong>
                    </span>
                    <span className="last-activity">
                      Last: {formatTimestamp(chain.lastAt)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Reseed entry chains button */}
        {stalledEntryChains.length > 0 && (
          <div className="reseed-section">
            <div className="stall-alert">
              ⚠️ {stalledEntryChains.length} entry chain(s) are stalled
            </div>
            <div className="chain-control-row">
              <div className="control-group">
                <label htmlFor="reseed-entry-count">Reseed count:</label>
                <input
                  id="reseed-entry-count"
                  type="number"
                  min="1"
                  max="50"
                  value={reseedCount}
                  onChange={(e) => setReseedCount(parseInt(e.target.value) || 1)}
                  disabled={reseedingEntry}
                  className="chain-count-input"
                />
              </div>
              
              <button
                onClick={handleReseedEntry}
                disabled={reseedingEntry}
                className="btn btn-warning"
              >
                {reseedingEntry ? 'Reseeding...' : 'Reseed Entry Chains'}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Exit Chain Controls */}
      <div className="chain-control-section">
        <h3>Exit Chains</h3>
        
        <div className="chain-control-row">
          <div className="control-group">
            <label htmlFor="exit-chain-count">Number of chains:</label>
            <input
              id="exit-chain-count"
              type="number"
              min="1"
              max="50"
              value={exitChainCount}
              onChange={(e) => setExitChainCount(parseInt(e.target.value) || 1)}
              disabled={startingExit}
              className="chain-count-input"
            />
          </div>
          
          <button
            onClick={handleStartExit}
            disabled={startingExit}
            className="btn btn-primary"
          >
            {startingExit ? 'Starting...' : 'Start Exit Chains'}
          </button>
        </div>

        {/* Display exit chains */}
        {exitChains.length > 0 && (
          <div className="chains-display">
            <h4>Active Exit Chains ({exitChains.length})</h4>
            <div className="chains-list">
              {exitChains.map(chain => (
                <div 
                  key={chain.chainId} 
                  className={`chain-item ${chain.state.toLowerCase()} ${stalledChains.includes(chain.chainId) ? 'stalled' : ''}`}
                >
                  <div className="chain-info">
                    <span className="chain-id" title={chain.chainId}>
                      Chain #{chain.chainId.substring(0, 8)}
                    </span>
                    {stalledChains.includes(chain.chainId) && (
                      <span className="stall-badge" title="Chain is stalled">⚠️ Stalled</span>
                    )}
                  </div>
                  <div className="chain-details">
                    <span className="holder">
                      Holder: <strong>{chain.lastHolder || 'None'}</strong>
                    </span>
                    <span className="sequence">
                      Seq: <strong>{chain.lastSeq}</strong>
                    </span>
                    <span className="last-activity">
                      Last: {formatTimestamp(chain.lastAt)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Reseed exit chains button */}
        {stalledExitChains.length > 0 && (
          <div className="reseed-section">
            <div className="stall-alert">
              ⚠️ {stalledExitChains.length} exit chain(s) are stalled
            </div>
            <div className="chain-control-row">
              <div className="control-group">
                <label htmlFor="reseed-exit-count">Reseed count:</label>
                <input
                  id="reseed-exit-count"
                  type="number"
                  min="1"
                  max="50"
                  value={reseedCount}
                  onChange={(e) => setReseedCount(parseInt(e.target.value) || 1)}
                  disabled={reseedingExit}
                  className="chain-count-input"
                />
              </div>
              
              <button
                onClick={handleReseedExit}
                disabled={reseedingExit}
                className="btn btn-warning"
              >
                {reseedingExit ? 'Reseeding...' : 'Reseed Exit Chains'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
