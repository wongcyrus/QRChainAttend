/**
 * ChainManagementControls Component Examples
 * 
 * This file demonstrates various usage scenarios for the ChainManagementControls component.
 */

import React, { useState } from 'react';
import { ChainManagementControls } from './ChainManagementControls';

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

/**
 * Example 1: Basic Usage
 * Shows the component with no active chains
 */
export function BasicExample() {
  const [chains, setChains] = useState<Chain[]>([]);
  const [stalledChains, setStalledChains] = useState<string[]>([]);

  const handleChainsUpdated = () => {
    console.log('Chains updated, refreshing data...');
    // In a real app, this would fetch updated session data
  };

  const handleError = (error: string) => {
    console.error('Error:', error);
    alert(error);
  };

  return (
    <div style={{ padding: '20px' }}>
      <h1>Basic Chain Management</h1>
      <ChainManagementControls
        sessionId="example-session-1"
        chains={chains}
        stalledChains={stalledChains}
        onChainsUpdated={handleChainsUpdated}
        onError={handleError}
      />
    </div>
  );
}

/**
 * Example 2: With Active Entry Chains
 * Shows the component with several active entry chains
 */
export function ActiveEntryChainsExample() {
  const now = Math.floor(Date.now() / 1000);
  
  const [chains] = useState<Chain[]>([
    {
      sessionId: 'example-session-2',
      phase: ChainPhase.ENTRY,
      chainId: 'entry-chain-1',
      index: 0,
      state: ChainState.ACTIVE,
      lastHolder: 'student-001',
      lastSeq: 5,
      lastAt: now - 30,
    },
    {
      sessionId: 'example-session-2',
      phase: ChainPhase.ENTRY,
      chainId: 'entry-chain-2',
      index: 0,
      state: ChainState.ACTIVE,
      lastHolder: 'student-015',
      lastSeq: 8,
      lastAt: now - 45,
    },
    {
      sessionId: 'example-session-2',
      phase: ChainPhase.ENTRY,
      chainId: 'entry-chain-3',
      index: 0,
      state: ChainState.ACTIVE,
      lastHolder: 'student-023',
      lastSeq: 3,
      lastAt: now - 20,
    },
  ]);

  return (
    <div style={{ padding: '20px' }}>
      <h1>Active Entry Chains</h1>
      <p>Three entry chains are currently active with different holders and sequences.</p>
      <ChainManagementControls
        sessionId="example-session-2"
        chains={chains}
        stalledChains={[]}
        onChainsUpdated={() => console.log('Chains updated')}
        onError={(error) => console.error(error)}
      />
    </div>
  );
}

/**
 * Example 3: With Stalled Chains
 * Shows the component with stalled chains that need reseeding
 */
export function StalledChainsExample() {
  const now = Math.floor(Date.now() / 1000);
  
  const [chains] = useState<Chain[]>([
    {
      sessionId: 'example-session-3',
      phase: ChainPhase.ENTRY,
      chainId: 'entry-chain-1',
      index: 0,
      state: ChainState.STALLED,
      lastHolder: 'student-007',
      lastSeq: 4,
      lastAt: now - 120, // 2 minutes ago - stalled
    },
    {
      sessionId: 'example-session-3',
      phase: ChainPhase.ENTRY,
      chainId: 'entry-chain-2',
      index: 0,
      state: ChainState.ACTIVE,
      lastHolder: 'student-012',
      lastSeq: 6,
      lastAt: now - 30,
    },
  ]);

  const [stalledChains] = useState<string[]>(['entry-chain-1']);

  return (
    <div style={{ padding: '20px' }}>
      <h1>Stalled Chains</h1>
      <p>One chain is stalled and needs to be reseeded.</p>
      <ChainManagementControls
        sessionId="example-session-3"
        chains={chains}
        stalledChains={stalledChains}
        onChainsUpdated={() => console.log('Chains reseeded')}
        onError={(error) => console.error(error)}
      />
    </div>
  );
}

/**
 * Example 4: With Both Entry and Exit Chains
 * Shows the component managing both entry and exit chains simultaneously
 */
export function MixedChainsExample() {
  const now = Math.floor(Date.now() / 1000);
  
  const [chains] = useState<Chain[]>([
    // Entry chains
    {
      sessionId: 'example-session-4',
      phase: ChainPhase.ENTRY,
      chainId: 'entry-chain-1',
      index: 0,
      state: ChainState.ACTIVE,
      lastHolder: 'student-005',
      lastSeq: 12,
      lastAt: now - 40,
    },
    {
      sessionId: 'example-session-4',
      phase: ChainPhase.ENTRY,
      chainId: 'entry-chain-2',
      index: 0,
      state: ChainState.ACTIVE,
      lastHolder: 'student-018',
      lastSeq: 9,
      lastAt: now - 25,
    },
    // Exit chains
    {
      sessionId: 'example-session-4',
      phase: ChainPhase.EXIT,
      chainId: 'exit-chain-1',
      index: 0,
      state: ChainState.ACTIVE,
      lastHolder: 'student-003',
      lastSeq: 4,
      lastAt: now - 15,
    },
    {
      sessionId: 'example-session-4',
      phase: ChainPhase.EXIT,
      chainId: 'exit-chain-2',
      index: 0,
      state: ChainState.ACTIVE,
      lastHolder: 'student-021',
      lastSeq: 6,
      lastAt: now - 20,
    },
  ]);

  return (
    <div style={{ padding: '20px' }}>
      <h1>Mixed Entry and Exit Chains</h1>
      <p>Both entry and exit chains are active during the session.</p>
      <ChainManagementControls
        sessionId="example-session-4"
        chains={chains}
        stalledChains={[]}
        onChainsUpdated={() => console.log('Chains updated')}
        onError={(error) => console.error(error)}
      />
    </div>
  );
}

/**
 * Example 5: Large Class Scenario
 * Shows the component managing many chains for a large class
 */
export function LargeClassExample() {
  const now = Math.floor(Date.now() / 1000);
  
  // Generate 10 entry chains
  const [chains] = useState<Chain[]>(
    Array.from({ length: 10 }, (_, i) => ({
      sessionId: 'example-session-5',
      phase: ChainPhase.ENTRY,
      chainId: `entry-chain-${i + 1}`,
      index: 0,
      state: ChainState.ACTIVE,
      lastHolder: `student-${String(i + 1).padStart(3, '0')}`,
      lastSeq: Math.floor(Math.random() * 15) + 1,
      lastAt: now - Math.floor(Math.random() * 60),
    }))
  );

  // Mark 2 chains as stalled
  const [stalledChains] = useState<string[]>(['entry-chain-3', 'entry-chain-7']);

  return (
    <div style={{ padding: '20px' }}>
      <h1>Large Class (10 Chains)</h1>
      <p>Managing multiple chains for a large class with some stalled chains.</p>
      <ChainManagementControls
        sessionId="example-session-5"
        chains={chains}
        stalledChains={stalledChains}
        onChainsUpdated={() => console.log('Chains updated')}
        onError={(error) => console.error(error)}
      />
    </div>
  );
}

/**
 * Example 6: With Custom Error Handling
 * Shows the component with custom error handling and user feedback
 */
export function CustomErrorHandlingExample() {
  const [chains] = useState<Chain[]>([]);
  const [stalledChains] = useState<string[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const handleChainsUpdated = () => {
    setSuccessMessage('Chains updated successfully!');
    setErrorMessage(null);
    setTimeout(() => setSuccessMessage(null), 3000);
  };

  const handleError = (error: string) => {
    setErrorMessage(error);
    setSuccessMessage(null);
  };

  return (
    <div style={{ padding: '20px' }}>
      <h1>Custom Error Handling</h1>
      
      {errorMessage && (
        <div style={{
          padding: '10px',
          marginBottom: '20px',
          backgroundColor: '#fee',
          border: '1px solid #fcc',
          borderRadius: '4px',
          color: '#c00',
        }}>
          ❌ {errorMessage}
        </div>
      )}
      
      {successMessage && (
        <div style={{
          padding: '10px',
          marginBottom: '20px',
          backgroundColor: '#efe',
          border: '1px solid #cfc',
          borderRadius: '4px',
          color: '#0c0',
        }}>
          ✓ {successMessage}
        </div>
      )}
      
      <ChainManagementControls
        sessionId="example-session-6"
        chains={chains}
        stalledChains={stalledChains}
        onChainsUpdated={handleChainsUpdated}
        onError={handleError}
      />
    </div>
  );
}

/**
 * Example 7: Integration with Real-Time Updates
 * Shows the component with simulated real-time chain updates
 */
export function RealTimeUpdatesExample() {
  const [chains, setChains] = useState<Chain[]>([]);
  const [stalledChains, setStalledChains] = useState<string[]>([]);

  // Simulate real-time chain updates
  React.useEffect(() => {
    const interval = setInterval(() => {
      const now = Math.floor(Date.now() / 1000);
      
      // Update chain sequences randomly
      setChains(prevChains => 
        prevChains.map(chain => ({
          ...chain,
          lastSeq: chain.lastSeq + (Math.random() > 0.7 ? 1 : 0),
          lastAt: Math.random() > 0.7 ? now : chain.lastAt,
        }))
      );

      // Randomly mark chains as stalled
      setChains(prevChains => {
        const stalled = prevChains
          .filter(chain => now - (chain.lastAt || 0) > 90)
          .map(chain => chain.chainId);
        setStalledChains(stalled);
        return prevChains;
      });
    }, 2000);

    return () => clearInterval(interval);
  }, []);

  const handleChainsUpdated = () => {
    console.log('Chains updated via real-time event');
  };

  return (
    <div style={{ padding: '20px' }}>
      <h1>Real-Time Updates</h1>
      <p>Chains are updated in real-time (simulated).</p>
      <ChainManagementControls
        sessionId="example-session-7"
        chains={chains}
        stalledChains={stalledChains}
        onChainsUpdated={handleChainsUpdated}
        onError={(error) => console.error(error)}
      />
    </div>
  );
}

/**
 * Example 8: All Examples in One View
 * Renders all examples for comprehensive demonstration
 */
export function AllExamples() {
  return (
    <div>
      <BasicExample />
      <hr style={{ margin: '40px 0' }} />
      <ActiveEntryChainsExample />
      <hr style={{ margin: '40px 0' }} />
      <StalledChainsExample />
      <hr style={{ margin: '40px 0' }} />
      <MixedChainsExample />
      <hr style={{ margin: '40px 0' }} />
      <LargeClassExample />
      <hr style={{ margin: '40px 0' }} />
      <CustomErrorHandlingExample />
    </div>
  );
}

export default AllExamples;
