/**
 * Unit tests for ChainManagementControls component
 * Feature: qr-chain-attendance
 * Requirements: 3.1, 6.1, 11.3
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ChainManagementControls } from './ChainManagementControls';

// Mock fetch
global.fetch = jest.fn();

describe('ChainManagementControls', () => {
  const mockSessionId = 'test-session-123';
  const mockChains = [
    {
      sessionId: mockSessionId,
      phase: 'ENTRY' as const,
      chainId: 'entry-chain-1',
      index: 0,
      state: 'ACTIVE' as const,
      lastHolder: 'student-1',
      lastSeq: 5,
      lastAt: Math.floor(Date.now() / 1000) - 30,
    },
    {
      sessionId: mockSessionId,
      phase: 'EXIT' as const,
      chainId: 'exit-chain-1',
      index: 0,
      state: 'ACTIVE' as const,
      lastHolder: 'student-2',
      lastSeq: 3,
      lastAt: Math.floor(Date.now() / 1000) - 60,
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({
        chainsCreated: 3,
        initialHolders: ['student-1', 'student-2', 'student-3'],
      }),
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Rendering', () => {
    it('should render chain management controls', () => {
      render(
        <ChainManagementControls
          sessionId={mockSessionId}
          chains={mockChains}
          stalledChains={[]}
        />
      );

      expect(screen.getByText('Chain Management')).toBeInTheDocument();
      expect(screen.getByText('Entry Chains')).toBeInTheDocument();
      expect(screen.getByText('Exit Chains')).toBeInTheDocument();
    });

    it('should display entry chains with holder and sequence information', () => {
      render(
        <ChainManagementControls
          sessionId={mockSessionId}
          chains={mockChains}
          stalledChains={[]}
        />
      );

      expect(screen.getByText(/Active Entry Chains/)).toBeInTheDocument();
      expect(screen.getByText('student-1')).toBeInTheDocument();
      expect(screen.getByText('5')).toBeInTheDocument();
    });

    it('should display exit chains with holder and sequence information', () => {
      render(
        <ChainManagementControls
          sessionId={mockSessionId}
          chains={mockChains}
          stalledChains={[]}
        />
      );

      expect(screen.getByText(/Active Exit Chains/)).toBeInTheDocument();
      expect(screen.getByText('student-2')).toBeInTheDocument();
      expect(screen.getByText('3')).toBeInTheDocument();
    });

    it('should display stall indicators for stalled chains', () => {
      render(
        <ChainManagementControls
          sessionId={mockSessionId}
          chains={mockChains}
          stalledChains={['entry-chain-1']}
        />
      );

      const stallBadges = screen.getAllByText(/⚠️ Stalled/);
      expect(stallBadges.length).toBeGreaterThan(0);
    });

    it('should show reseed section when chains are stalled', () => {
      render(
        <ChainManagementControls
          sessionId={mockSessionId}
          chains={mockChains}
          stalledChains={['entry-chain-1']}
        />
      );

      expect(screen.getByText(/entry chain\(s\) are stalled/)).toBeInTheDocument();
      expect(screen.getByText('Reseed Entry Chains')).toBeInTheDocument();
    });
  });

  describe('Seed Entry Chains - Requirement 3.1', () => {
    it('should call seed-entry API with correct count', async () => {
      const onChainsUpdated = jest.fn();
      
      render(
        <ChainManagementControls
          sessionId={mockSessionId}
          chains={[]}
          stalledChains={[]}
          onChainsUpdated={onChainsUpdated}
        />
      );

      // Set count to 5 using the specific ID
      const countInput = screen.getByLabelText('Number of chains:', { selector: '#entry-chain-count' }) as HTMLInputElement;
      fireEvent.change(countInput, { target: { value: '5' } });

      // Click seed button
      const seedButton = screen.getByText('Seed Entry Chains');
      fireEvent.click(seedButton);

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          `/api/sessions/${mockSessionId}/seed-entry?count=5`,
          { method: 'POST' }
        );
      });

      expect(onChainsUpdated).toHaveBeenCalled();
    });

    it('should display success message after seeding', async () => {
      render(
        <ChainManagementControls
          sessionId={mockSessionId}
          chains={[]}
          stalledChains={[]}
        />
      );

      const seedButton = screen.getByText('Seed Entry Chains');
      fireEvent.click(seedButton);

      await waitFor(() => {
        expect(screen.getByText(/Successfully seeded 3 entry chain/)).toBeInTheDocument();
      });
    });

    it('should show loading state while seeding', async () => {
      (global.fetch as jest.Mock).mockImplementation(
        () => new Promise(resolve => setTimeout(resolve, 100))
      );

      render(
        <ChainManagementControls
          sessionId={mockSessionId}
          chains={[]}
          stalledChains={[]}
        />
      );

      const seedButton = screen.getByText('Seed Entry Chains');
      fireEvent.click(seedButton);

      expect(screen.getByText('Seeding...')).toBeInTheDocument();
    });

    it('should handle API errors gracefully', async () => {
      const onError = jest.fn();
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        statusText: 'Bad Request',
        json: async () => ({
          error: {
            message: 'Insufficient eligible students',
          },
        }),
      });

      render(
        <ChainManagementControls
          sessionId={mockSessionId}
          chains={[]}
          stalledChains={[]}
          onError={onError}
        />
      );

      const seedButton = screen.getByText('Seed Entry Chains');
      fireEvent.click(seedButton);

      await waitFor(() => {
        expect(onError).toHaveBeenCalledWith('Insufficient eligible students');
      });
    });

    it('should validate count is positive', async () => {
      const onError = jest.fn();
      
      const { rerender } = render(
        <ChainManagementControls
          sessionId={mockSessionId}
          chains={[]}
          stalledChains={[]}
          onError={onError}
        />
      );

      // Set count to -1 using the specific ID (negative number)
      const countInput = screen.getByLabelText('Number of chains:', { selector: '#entry-chain-count' }) as HTMLInputElement;
      fireEvent.change(countInput, { target: { value: '-1' } });

      // Click seed button
      const seedButton = screen.getByText('Seed Entry Chains');
      fireEvent.click(seedButton);

      await waitFor(() => {
        expect(onError).toHaveBeenCalledWith('Chain count must be a positive number');
      });
      expect(global.fetch).not.toHaveBeenCalled();
    });
  });

  describe('Start Exit Chains - Requirement 6.1', () => {
    it('should call start-exit-chain API with correct count', async () => {
      const onChainsUpdated = jest.fn();
      
      render(
        <ChainManagementControls
          sessionId={mockSessionId}
          chains={[]}
          stalledChains={[]}
          onChainsUpdated={onChainsUpdated}
        />
      );

      // Find the exit chain count input using specific ID
      const exitCountInput = screen.getByLabelText('Number of chains:', { selector: '#exit-chain-count' }) as HTMLInputElement;
      fireEvent.change(exitCountInput, { target: { value: '4' } });

      // Click start exit button
      const startButton = screen.getByText('Start Exit Chains');
      fireEvent.click(startButton);

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          `/api/sessions/${mockSessionId}/start-exit-chain?count=4`,
          { method: 'POST' }
        );
      });

      expect(onChainsUpdated).toHaveBeenCalled();
    });

    it('should display success message after starting exit chains', async () => {
      render(
        <ChainManagementControls
          sessionId={mockSessionId}
          chains={[]}
          stalledChains={[]}
        />
      );

      const startButton = screen.getByText('Start Exit Chains');
      fireEvent.click(startButton);

      await waitFor(() => {
        expect(screen.getByText(/Successfully started 3 exit chain/)).toBeInTheDocument();
      });
    });

    it('should show loading state while starting', async () => {
      (global.fetch as jest.Mock).mockImplementation(
        () => new Promise(resolve => setTimeout(resolve, 100))
      );

      render(
        <ChainManagementControls
          sessionId={mockSessionId}
          chains={[]}
          stalledChains={[]}
        />
      );

      const startButton = screen.getByText('Start Exit Chains');
      fireEvent.click(startButton);

      expect(screen.getByText('Starting...')).toBeInTheDocument();
    });
  });

  describe('Reseed Stalled Chains - Requirement 11.3', () => {
    it('should call reseed-entry API for stalled entry chains', async () => {
      const onChainsUpdated = jest.fn();
      
      render(
        <ChainManagementControls
          sessionId={mockSessionId}
          chains={mockChains}
          stalledChains={['entry-chain-1']}
          onChainsUpdated={onChainsUpdated}
        />
      );

      // Set reseed count using specific ID
      const reseedInput = screen.getByLabelText('Reseed count:', { selector: '#reseed-entry-count' }) as HTMLInputElement;
      fireEvent.change(reseedInput, { target: { value: '2' } });

      // Click reseed button
      const reseedButton = screen.getByText('Reseed Entry Chains');
      fireEvent.click(reseedButton);

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          `/api/sessions/${mockSessionId}/reseed-entry?count=2`,
          { method: 'POST' }
        );
      });

      expect(onChainsUpdated).toHaveBeenCalled();
    });

    it('should call reseed-exit API for stalled exit chains', async () => {
      const onChainsUpdated = jest.fn();
      
      render(
        <ChainManagementControls
          sessionId={mockSessionId}
          chains={mockChains}
          stalledChains={['exit-chain-1']}
          onChainsUpdated={onChainsUpdated}
        />
      );

      // Find the exit reseed input using specific ID
      const exitReseedInput = screen.getByLabelText('Reseed count:', { selector: '#reseed-exit-count' }) as HTMLInputElement;
      fireEvent.change(exitReseedInput, { target: { value: '3' } });

      // Click reseed button
      const reseedButton = screen.getByText('Reseed Exit Chains');
      fireEvent.click(reseedButton);

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          `/api/sessions/${mockSessionId}/reseed-exit?count=3`,
          { method: 'POST' }
        );
      });

      expect(onChainsUpdated).toHaveBeenCalled();
    });

    it('should display success message after reseeding', async () => {
      render(
        <ChainManagementControls
          sessionId={mockSessionId}
          chains={mockChains}
          stalledChains={['entry-chain-1']}
        />
      );

      const reseedButton = screen.getByText('Reseed Entry Chains');
      fireEvent.click(reseedButton);

      await waitFor(() => {
        expect(screen.getByText(/Successfully reseeded 3 entry chain/)).toBeInTheDocument();
      });
    });

    it('should show loading state while reseeding', async () => {
      (global.fetch as jest.Mock).mockImplementation(
        () => new Promise(resolve => setTimeout(resolve, 100))
      );

      render(
        <ChainManagementControls
          sessionId={mockSessionId}
          chains={mockChains}
          stalledChains={['entry-chain-1']}
        />
      );

      const reseedButton = screen.getByText('Reseed Entry Chains');
      fireEvent.click(reseedButton);

      expect(screen.getByText('Reseeding...')).toBeInTheDocument();
    });

    it('should not show reseed section when no chains are stalled', () => {
      render(
        <ChainManagementControls
          sessionId={mockSessionId}
          chains={mockChains}
          stalledChains={[]}
        />
      );

      expect(screen.queryByText(/chain\(s\) are stalled/)).not.toBeInTheDocument();
      expect(screen.queryByText('Reseed Entry Chains')).not.toBeInTheDocument();
      expect(screen.queryByText('Reseed Exit Chains')).not.toBeInTheDocument();
    });
  });

  describe('Chain Display', () => {
    it('should format timestamps correctly', () => {
      const now = Math.floor(Date.now() / 1000);
      const chainsWithTimestamp = [
        {
          ...mockChains[0],
          lastAt: now,
        },
      ];

      render(
        <ChainManagementControls
          sessionId={mockSessionId}
          chains={chainsWithTimestamp}
          stalledChains={[]}
        />
      );

      // Should display a time (format varies by locale)
      const timeElements = screen.getAllByText(/\d{1,2}:\d{2}/);
      expect(timeElements.length).toBeGreaterThan(0);
    });

    it('should display None for missing holder', () => {
      const chainsWithoutHolder = [
        {
          ...mockChains[0],
          lastHolder: undefined,
        },
      ];

      render(
        <ChainManagementControls
          sessionId={mockSessionId}
          chains={chainsWithoutHolder}
          stalledChains={[]}
        />
      );

      expect(screen.getByText('None')).toBeInTheDocument();
    });

    it('should truncate chain IDs for display', () => {
      const longChainId = 'very-long-chain-id-that-should-be-truncated';
      const chainsWithLongId = [
        {
          ...mockChains[0],
          chainId: longChainId,
        },
      ];

      render(
        <ChainManagementControls
          sessionId={mockSessionId}
          chains={chainsWithLongId}
          stalledChains={[]}
        />
      );

      // Should show truncated version
      expect(screen.getByText(/Chain #very-lon/)).toBeInTheDocument();
    });

    it('should separate entry and exit chains', () => {
      render(
        <ChainManagementControls
          sessionId={mockSessionId}
          chains={mockChains}
          stalledChains={[]}
        />
      );

      expect(screen.getByText(/Active Entry Chains \(1\)/)).toBeInTheDocument();
      expect(screen.getByText(/Active Exit Chains \(1\)/)).toBeInTheDocument();
    });
  });

  describe('Input Validation', () => {
    it('should enforce minimum value of 1 for chain count', () => {
      render(
        <ChainManagementControls
          sessionId={mockSessionId}
          chains={[]}
          stalledChains={[]}
        />
      );

      const countInput = screen.getByLabelText('Number of chains:', { selector: '#entry-chain-count' }) as HTMLInputElement;
      expect(countInput.min).toBe('1');
    });

    it('should enforce maximum value of 50 for chain count', () => {
      render(
        <ChainManagementControls
          sessionId={mockSessionId}
          chains={[]}
          stalledChains={[]}
        />
      );

      const countInput = screen.getByLabelText('Number of chains:', { selector: '#entry-chain-count' }) as HTMLInputElement;
      expect(countInput.max).toBe('50');
    });

    it('should default to 1 when parsing invalid input', () => {
      render(
        <ChainManagementControls
          sessionId={mockSessionId}
          chains={[]}
          stalledChains={[]}
        />
      );

      const countInput = screen.getByLabelText('Number of chains:', { selector: '#entry-chain-count' }) as HTMLInputElement;
      fireEvent.change(countInput, { target: { value: 'invalid' } });

      // Should default to 1 when parsing fails (parseInt returns NaN, || 1 kicks in)
      expect(countInput.value).toBe('1');
    });
  });
});
