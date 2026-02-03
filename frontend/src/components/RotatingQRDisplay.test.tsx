/**
 * Rotating QR Display Component Unit Tests
 * Feature: qr-chain-attendance
 * Requirements: 4.1, 4.2, 5.1, 5.2
 */

import { render, screen, waitFor, act, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { RotatingQRDisplay } from './RotatingQRDisplay';
import type { RotatingQRData } from '@qr-attendance/shared';

// Mock QRDisplay component
jest.mock('./QRDisplay', () => ({
  QRDisplay: ({ qrData, onExpire }: any) => (
    <div data-testid="qr-display">
      <div data-testid="qr-data">{JSON.stringify(qrData)}</div>
      <button data-testid="expire-button" onClick={onExpire}>
        Expire
      </button>
    </div>
  ),
}));

// Mock fetch
global.fetch = jest.fn();

describe('RotatingQRDisplay Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Don't use fake timers by default as they interfere with waitFor
    // jest.useFakeTimers();
  });

  afterEach(() => {
    // jest.useRealTimers();
  });

  const mockLateEntryToken: RotatingQRData = {
    type: 'LATE_ENTRY',
    sessionId: 'session-123',
    tokenId: 'token-abc',
    etag: 'etag-xyz',
    exp: Math.floor(Date.now() / 1000) + 60,
  };

  const mockEarlyLeaveToken: RotatingQRData = {
    type: 'EARLY_LEAVE',
    sessionId: 'session-123',
    tokenId: 'token-def',
    etag: 'etag-uvw',
    exp: Math.floor(Date.now() / 1000) + 60,
  };

  describe('Late Entry Display', () => {
    it('should render late entry QR display with correct title', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ token: mockLateEntryToken, active: true }),
      });

      render(
        <RotatingQRDisplay
          sessionId="session-123"
          type="LATE_ENTRY"
          isActive={true}
        />
      );

      expect(screen.getByText('Late Entry QR Code')).toBeInTheDocument();
      expect(
        screen.getByText('Students arriving late should scan this code to mark their attendance.')
      ).toBeInTheDocument();
    });

    it('should fetch late entry token on mount when active', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ token: mockLateEntryToken, active: true }),
      });

      render(
        <RotatingQRDisplay
          sessionId="session-123"
          type="LATE_ENTRY"
          isActive={true}
        />
      );

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith('/api/sessions/session-123/late-qr');
      });

      await waitFor(() => {
        expect(screen.getByTestId('qr-display')).toBeInTheDocument();
      });
    });

    it('should display active status when window is active', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ token: mockLateEntryToken, active: true }),
      });

      render(
        <RotatingQRDisplay
          sessionId="session-123"
          type="LATE_ENTRY"
          isActive={true}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Window Active')).toBeInTheDocument();
      });
    });

    it('should display inactive status when window is not active', () => {
      render(
        <RotatingQRDisplay
          sessionId="session-123"
          type="LATE_ENTRY"
          isActive={false}
        />
      );

      expect(screen.getByText('Window Inactive')).toBeInTheDocument();
      expect(screen.getByText('Late entry window is not active yet.')).toBeInTheDocument();
    });

    it('should not show controls for late entry', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ token: mockLateEntryToken, active: true }),
      });

      render(
        <RotatingQRDisplay
          sessionId="session-123"
          type="LATE_ENTRY"
          isActive={true}
          showControls={true}
        />
      );

      await waitFor(() => {
        expect(screen.queryByText('Start Early-Leave Window')).not.toBeInTheDocument();
        expect(screen.queryByText('Stop Early-Leave Window')).not.toBeInTheDocument();
      });
    });
  });

  describe('Early Leave Display', () => {
    it('should render early leave QR display with correct title', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ token: mockEarlyLeaveToken, active: true }),
      });

      render(
        <RotatingQRDisplay
          sessionId="session-123"
          type="EARLY_LEAVE"
          isActive={true}
        />
      );

      expect(screen.getByText('Early Leave QR Code')).toBeInTheDocument();
      expect(
        screen.getByText('Students leaving early should scan this code before departing.')
      ).toBeInTheDocument();
    });

    it('should fetch early leave token on mount when active', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ token: mockEarlyLeaveToken, active: true }),
      });

      render(
        <RotatingQRDisplay
          sessionId="session-123"
          type="EARLY_LEAVE"
          isActive={true}
        />
      );

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith('/api/sessions/session-123/early-qr');
      });

      await waitFor(() => {
        expect(screen.getByTestId('qr-display')).toBeInTheDocument();
      });
    });

    it('should show start button when window is inactive', () => {
      render(
        <RotatingQRDisplay
          sessionId="session-123"
          type="EARLY_LEAVE"
          isActive={false}
          showControls={true}
        />
      );

      expect(screen.getByText('Start Early-Leave Window')).toBeInTheDocument();
      expect(screen.queryByText('Stop Early-Leave Window')).not.toBeInTheDocument();
    });

    it('should show stop button when window is active', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ token: mockEarlyLeaveToken, active: true }),
      });

      render(
        <RotatingQRDisplay
          sessionId="session-123"
          type="EARLY_LEAVE"
          isActive={true}
          showControls={true}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Stop Early-Leave Window')).toBeInTheDocument();
      });

      expect(screen.queryByText('Start Early-Leave Window')).not.toBeInTheDocument();
    });

    it('should hide controls when showControls is false', () => {
      render(
        <RotatingQRDisplay
          sessionId="session-123"
          type="EARLY_LEAVE"
          isActive={false}
          showControls={false}
        />
      );

      expect(screen.queryByText('Start Early-Leave Window')).not.toBeInTheDocument();
      expect(screen.queryByText('Stop Early-Leave Window')).not.toBeInTheDocument();
    });
  });

  describe('Start/Stop Controls', () => {
    it('should start early-leave window when start button clicked', async () => {
      const onStart = jest.fn();

      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({}),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ token: mockEarlyLeaveToken, active: true }),
        });

      render(
        <RotatingQRDisplay
          sessionId="session-123"
          type="EARLY_LEAVE"
          isActive={false}
          showControls={true}
          onStart={onStart}
        />
      );

      const startButton = screen.getByText('Start Early-Leave Window');
      
      await act(async () => {
        fireEvent.click(startButton);
      });

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          '/api/sessions/session-123/start-early-leave',
          { method: 'POST' }
        );
      });

      await waitFor(() => {
        expect(onStart).toHaveBeenCalledTimes(1);
      });
    });

    it('should stop early-leave window when stop button clicked', async () => {
      const onStop = jest.fn();

      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ token: mockEarlyLeaveToken, active: true }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({}),
        });

      render(
        <RotatingQRDisplay
          sessionId="session-123"
          type="EARLY_LEAVE"
          isActive={true}
          showControls={true}
          onStop={onStop}
        />
      );

      await waitFor(() => {
        const button = screen.getByText('Stop Early-Leave Window');
        expect(button).toBeInTheDocument();
        expect(button).not.toBeDisabled();
      });

      const stopButton = screen.getByText('Stop Early-Leave Window');
      
      await act(async () => {
        fireEvent.click(stopButton);
      });

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          '/api/sessions/session-123/stop-early-leave',
          { method: 'POST' }
        );
      });

      await waitFor(() => {
        expect(onStop).toHaveBeenCalledTimes(1);
      });
    });

    it('should disable start button while starting', async () => {
      (global.fetch as jest.Mock).mockImplementationOnce(
        () =>
          new Promise((resolve) =>
            setTimeout(
              () =>
                resolve({
                  ok: true,
                  json: async () => ({}),
                }),
              100
            )
          )
      );

      render(
        <RotatingQRDisplay
          sessionId="session-123"
          type="EARLY_LEAVE"
          isActive={false}
          showControls={true}
        />
      );

      const startButton = screen.getByText('Start Early-Leave Window');
      
      act(() => {
        fireEvent.click(startButton);
      });

      expect(screen.getByText('Starting...')).toBeInTheDocument();
      expect(startButton).toBeDisabled();
    });

    it('should disable stop button while stopping', async () => {
      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ token: mockEarlyLeaveToken, active: true }),
        })
        .mockImplementationOnce(
          () =>
            new Promise((resolve) =>
              setTimeout(
                () =>
                  resolve({
                    ok: true,
                    json: async () => ({}),
                  }),
                100
              )
            )
        );

      render(
        <RotatingQRDisplay
          sessionId="session-123"
          type="EARLY_LEAVE"
          isActive={true}
          showControls={true}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Stop Early-Leave Window')).toBeInTheDocument();
      });

      const stopButton = screen.getByText('Stop Early-Leave Window');
      
      act(() => {
        fireEvent.click(stopButton);
      });

      expect(screen.getByText('Stopping...')).toBeInTheDocument();
      expect(stopButton).toBeDisabled();
    });

    it('should handle start error gracefully', async () => {
      const onError = jest.fn();

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        statusText: 'Forbidden',
        json: async () => ({ error: { message: 'Not authorized' } }),
      });

      render(
        <RotatingQRDisplay
          sessionId="session-123"
          type="EARLY_LEAVE"
          isActive={false}
          showControls={true}
          onError={onError}
        />
      );

      const startButton = screen.getByText('Start Early-Leave Window');
      
      await act(async () => {
        fireEvent.click(startButton);
      });

      await waitFor(() => {
        expect(screen.getByText(/Not authorized/)).toBeInTheDocument();
      });

      expect(onError).toHaveBeenCalledWith('Not authorized');
    });

    it('should handle stop error gracefully', async () => {
      const onError = jest.fn();

      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ token: mockEarlyLeaveToken, active: true }),
        })
        .mockResolvedValueOnce({
          ok: false,
          statusText: 'Internal Server Error',
          json: async () => ({ error: { message: 'Server error' } }),
        });

      render(
        <RotatingQRDisplay
          sessionId="session-123"
          type="EARLY_LEAVE"
          isActive={true}
          showControls={true}
          onError={onError}
        />
      );

      await waitFor(() => {
        const button = screen.getByText('Stop Early-Leave Window');
        expect(button).toBeInTheDocument();
        expect(button).not.toBeDisabled();
      });

      const stopButton = screen.getByText('Stop Early-Leave Window');
      
      await act(async () => {
        fireEvent.click(stopButton);
      });

      await waitFor(() => {
        expect(screen.getByText(/Server error/)).toBeInTheDocument();
      });

      expect(onError).toHaveBeenCalledWith('Server error');
    });
  });

  describe('Auto-Refresh', () => {
    it('should auto-refresh token every 55 seconds when active', async () => {
      jest.useFakeTimers();
      
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({ token: mockLateEntryToken, active: true }),
      });

      render(
        <RotatingQRDisplay
          sessionId="session-123"
          type="LATE_ENTRY"
          isActive={true}
        />
      );

      // Initial fetch
      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledTimes(1);
      });

      // Advance time by 55 seconds
      act(() => {
        jest.advanceTimersByTime(55000);
      });

      // Should fetch again
      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledTimes(2);
      });

      // Advance time by another 55 seconds
      act(() => {
        jest.advanceTimersByTime(55000);
      });

      // Should fetch again
      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledTimes(3);
      });
      
      jest.useRealTimers();
    });

    it('should not auto-refresh when window is inactive', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({ token: null, active: false }),
      });

      render(
        <RotatingQRDisplay
          sessionId="session-123"
          type="LATE_ENTRY"
          isActive={false}
        />
      );

      // Should not fetch initially when inactive
      expect(global.fetch).not.toHaveBeenCalled();

      // Advance time by 55 seconds
      act(() => {
        jest.advanceTimersByTime(55000);
      });

      // Should still not fetch
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('should stop auto-refresh when component unmounts', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({ token: mockLateEntryToken, active: true }),
      });

      const { unmount } = render(
        <RotatingQRDisplay
          sessionId="session-123"
          type="LATE_ENTRY"
          isActive={true}
        />
      );

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledTimes(1);
      });

      // Unmount component
      unmount();

      // Advance time
      act(() => {
        jest.advanceTimersByTime(55000);
      });

      // Should not fetch after unmount
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    it('should fetch new token when current token expires', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({ token: mockLateEntryToken, active: true }),
      });

      render(
        <RotatingQRDisplay
          sessionId="session-123"
          type="LATE_ENTRY"
          isActive={true}
        />
      );

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledTimes(1);
      });

      // Simulate token expiration
      const expireButton = screen.getByTestId('expire-button');
      await act(async () => {
        expireButton.click();
      });

      // Should fetch new token
      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledTimes(2);
      });
    });
  });

  describe('Error Handling', () => {
    it('should display error message when fetch fails', async () => {
      const onError = jest.fn();

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        statusText: 'Not Found',
        json: async () => ({ error: { message: 'Session not found' } }),
      });

      render(
        <RotatingQRDisplay
          sessionId="session-123"
          type="LATE_ENTRY"
          isActive={true}
          onError={onError}
        />
      );

      await waitFor(() => {
        expect(screen.getByText(/Session not found/)).toBeInTheDocument();
      });

      expect(onError).toHaveBeenCalledWith('Session not found');
    });

    it('should allow retry after error', async () => {
      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: false,
          statusText: 'Server Error',
          json: async () => ({}),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ token: mockLateEntryToken, active: true }),
        });

      render(
        <RotatingQRDisplay
          sessionId="session-123"
          type="LATE_ENTRY"
          isActive={true}
        />
      );

      await waitFor(() => {
        expect(screen.getByText(/Failed to fetch token/)).toBeInTheDocument();
      });

      const retryButton = screen.getByText('Retry');
      
      await act(async () => {
        fireEvent.click(retryButton);
      });

      await waitFor(() => {
        expect(screen.getByTestId('qr-display')).toBeInTheDocument();
      });
    });

    it('should handle network errors gracefully', async () => {
      const onError = jest.fn();

      (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'));

      render(
        <RotatingQRDisplay
          sessionId="session-123"
          type="LATE_ENTRY"
          isActive={true}
          onError={onError}
        />
      );

      await waitFor(() => {
        expect(screen.getByText(/Network error/)).toBeInTheDocument();
      });

      expect(onError).toHaveBeenCalledWith('Network error');
    });
  });

  describe('Loading States', () => {
    it('should show loading state while fetching token', async () => {
      (global.fetch as jest.Mock).mockImplementationOnce(
        () =>
          new Promise((resolve) =>
            setTimeout(
              () =>
                resolve({
                  ok: true,
                  json: async () => ({ token: mockLateEntryToken, active: true }),
                }),
              100
            )
          )
      );

      render(
        <RotatingQRDisplay
          sessionId="session-123"
          type="LATE_ENTRY"
          isActive={true}
        />
      );

      expect(screen.getByText('Loading QR code...')).toBeInTheDocument();
    });

    it('should hide loading state after token is fetched', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ token: mockLateEntryToken, active: true }),
      });

      render(
        <RotatingQRDisplay
          sessionId="session-123"
          type="LATE_ENTRY"
          isActive={true}
        />
      );

      await waitFor(() => {
        expect(screen.queryByText('Loading QR code...')).not.toBeInTheDocument();
      });
    });
  });

  describe('Custom Styling', () => {
    it('should apply custom className', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ token: mockLateEntryToken, active: true }),
      });

      const { container } = render(
        <RotatingQRDisplay
          sessionId="session-123"
          type="LATE_ENTRY"
          isActive={true}
          className="custom-class"
        />
      );

      await waitFor(() => {
        expect(container.querySelector('.rotating-qr-display.custom-class')).toBeInTheDocument();
      });
    });
  });

  describe('Refresh Info Display', () => {
    it('should show refresh info when token is displayed', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ token: mockLateEntryToken, active: true }),
      });

      render(
        <RotatingQRDisplay
          sessionId="session-123"
          type="LATE_ENTRY"
          isActive={true}
        />
      );

      await waitFor(() => {
        expect(
          screen.getByText('🔄 QR code refreshes automatically every 55 seconds')
        ).toBeInTheDocument();
      });
    });
  });
});
