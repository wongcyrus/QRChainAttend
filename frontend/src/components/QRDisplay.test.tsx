/**
 * QR Display Component Unit Tests
 * Feature: qr-chain-attendance
 * Requirements: 13.2, 13.3
 */

import { render, screen, waitFor, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import { QRDisplay } from './QRDisplay';
import type { ChainQRData, RotatingQRData } from '@qr-attendance/shared';
import QRCode from 'qrcode';

// Mock QRCode library
jest.mock('qrcode', () => ({
  toDataURL: jest.fn(),
}));

describe('QRDisplay Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    
    // Mock QRCode.toDataURL to return a data URL
    (QRCode.toDataURL as jest.Mock).mockResolvedValue(
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='
    );
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('Rendering', () => {
    it('should not render when qrData is null', () => {
      const { container } = render(<QRDisplay qrData={null} />);
      expect(container.querySelector('.qr-display')).not.toBeInTheDocument();
    });

    it('should render QR code for valid chain token', async () => {
      const chainData: ChainQRData = {
        type: 'CHAIN',
        sessionId: 'session-123',
        tokenId: 'token-123',
        etag: 'etag-123',
        holderId: 'student-1',
        exp: Math.floor(Date.now() / 1000) + 20,
      };

      render(<QRDisplay qrData={chainData} />);

      await waitFor(() => {
        expect(QRCode.toDataURL).toHaveBeenCalledWith(
          JSON.stringify(chainData),
          expect.objectContaining({
            width: 300,
            margin: 2,
            errorCorrectionLevel: 'M',
          })
        );
      });

      await waitFor(() => {
        expect(screen.getByAltText('QR Code')).toBeInTheDocument();
      });
    });

    it('should render QR code for exit chain token', async () => {
      const exitChainData: ChainQRData = {
        type: 'EXIT_CHAIN',
        sessionId: 'session-123',
        tokenId: 'token-123',
        etag: 'etag-123',
        holderId: 'student-1',
        exp: Math.floor(Date.now() / 1000) + 20,
      };

      render(<QRDisplay qrData={exitChainData} />);

      await waitFor(() => {
        expect(screen.getByText('Exit Chain Token')).toBeInTheDocument();
      });
    });

    it('should render QR code for late entry token', async () => {
      const lateEntryData: RotatingQRData = {
        type: 'LATE_ENTRY',
        sessionId: 'session-123',
        tokenId: 'token-123',
        etag: 'etag-123',
        exp: Math.floor(Date.now() / 1000) + 60,
      };

      render(<QRDisplay qrData={lateEntryData} />);

      await waitFor(() => {
        expect(screen.getByText('Late Entry Token')).toBeInTheDocument();
      });
    });

    it('should render QR code for early leave token', async () => {
      const earlyLeaveData: RotatingQRData = {
        type: 'EARLY_LEAVE',
        sessionId: 'session-123',
        tokenId: 'token-123',
        etag: 'etag-123',
        exp: Math.floor(Date.now() / 1000) + 60,
      };

      render(<QRDisplay qrData={earlyLeaveData} />);

      await waitFor(() => {
        expect(screen.getByText('Early Leave Token')).toBeInTheDocument();
      });
    });

    it('should render with custom size', async () => {
      const chainData: ChainQRData = {
        type: 'CHAIN',
        sessionId: 'session-123',
        tokenId: 'token-123',
        etag: 'etag-123',
        holderId: 'student-1',
        exp: Math.floor(Date.now() / 1000) + 20,
      };

      render(<QRDisplay qrData={chainData} size={400} />);

      await waitFor(() => {
        expect(QRCode.toDataURL).toHaveBeenCalledWith(
          expect.any(String),
          expect.objectContaining({
            width: 400,
          })
        );
      });
    });

    it('should render with custom className', async () => {
      const chainData: ChainQRData = {
        type: 'CHAIN',
        sessionId: 'session-123',
        tokenId: 'token-123',
        etag: 'etag-123',
        holderId: 'student-1',
        exp: Math.floor(Date.now() / 1000) + 20,
      };

      const { container } = render(<QRDisplay qrData={chainData} className="custom-class" />);

      await waitFor(() => {
        expect(container.querySelector('.qr-display.custom-class')).toBeInTheDocument();
      });
    });
  });

  describe('Holder Information', () => {
    it('should show holder info for chain tokens by default', async () => {
      const chainData: ChainQRData = {
        type: 'CHAIN',
        sessionId: 'session-123',
        tokenId: 'token-123',
        etag: 'etag-123',
        holderId: 'student-1',
        exp: Math.floor(Date.now() / 1000) + 20,
      };

      render(<QRDisplay qrData={chainData} />);

      await waitFor(() => {
        expect(screen.getByText('You are the current holder')).toBeInTheDocument();
        expect(screen.getByText('Show this QR code to another student to scan')).toBeInTheDocument();
      });
    });

    it('should hide holder info when showHolderInfo is false', async () => {
      const chainData: ChainQRData = {
        type: 'CHAIN',
        sessionId: 'session-123',
        tokenId: 'token-123',
        etag: 'etag-123',
        holderId: 'student-1',
        exp: Math.floor(Date.now() / 1000) + 20,
      };

      render(<QRDisplay qrData={chainData} showHolderInfo={false} />);

      await waitFor(() => {
        expect(screen.queryByText('You are the current holder')).not.toBeInTheDocument();
      });
    });

    it('should not show holder info for rotating tokens', async () => {
      const lateEntryData: RotatingQRData = {
        type: 'LATE_ENTRY',
        sessionId: 'session-123',
        tokenId: 'token-123',
        etag: 'etag-123',
        exp: Math.floor(Date.now() / 1000) + 60,
      };

      render(<QRDisplay qrData={lateEntryData} />);

      await waitFor(() => {
        expect(screen.queryByText('You are the current holder')).not.toBeInTheDocument();
      });
    });
  });

  describe('Countdown Timer', () => {
    it('should display countdown timer with correct initial time', async () => {
      const chainData: ChainQRData = {
        type: 'CHAIN',
        sessionId: 'session-123',
        tokenId: 'token-123',
        etag: 'etag-123',
        holderId: 'student-1',
        exp: Math.floor(Date.now() / 1000) + 20,
      };

      render(<QRDisplay qrData={chainData} />);

      await waitFor(() => {
        expect(screen.getByText('Time Remaining')).toBeInTheDocument();
        expect(screen.getByText('0:20')).toBeInTheDocument();
      });
    });

    it('should update countdown timer every second', async () => {
      const chainData: ChainQRData = {
        type: 'CHAIN',
        sessionId: 'session-123',
        tokenId: 'token-123',
        etag: 'etag-123',
        holderId: 'student-1',
        exp: Math.floor(Date.now() / 1000) + 20,
      };

      render(<QRDisplay qrData={chainData} />);

      await waitFor(() => {
        expect(screen.getByText('0:20')).toBeInTheDocument();
      });

      // Advance time by 1 second
      act(() => {
        jest.advanceTimersByTime(1000);
      });

      await waitFor(() => {
        expect(screen.getByText('0:19')).toBeInTheDocument();
      });

      // Advance time by 5 more seconds
      act(() => {
        jest.advanceTimersByTime(5000);
      });

      await waitFor(() => {
        expect(screen.getByText('0:14')).toBeInTheDocument();
      });
    });

    it('should format time correctly for minutes and seconds', async () => {
      const lateEntryData: RotatingQRData = {
        type: 'LATE_ENTRY',
        sessionId: 'session-123',
        tokenId: 'token-123',
        etag: 'etag-123',
        exp: Math.floor(Date.now() / 1000) + 125, // 2:05
      };

      render(<QRDisplay qrData={lateEntryData} />);

      await waitFor(() => {
        expect(screen.getByText('2:05')).toBeInTheDocument();
      });
    });

    it('should show warning state when time is low (≤10s)', async () => {
      const chainData: ChainQRData = {
        type: 'CHAIN',
        sessionId: 'session-123',
        tokenId: 'token-123',
        etag: 'etag-123',
        holderId: 'student-1',
        exp: Math.floor(Date.now() / 1000) + 10,
      };

      const { container } = render(<QRDisplay qrData={chainData} />);

      await waitFor(() => {
        expect(container.querySelector('.countdown-timer.warning')).toBeInTheDocument();
      });
    });

    it('should show critical state when time is very low (≤5s)', async () => {
      const chainData: ChainQRData = {
        type: 'CHAIN',
        sessionId: 'session-123',
        tokenId: 'token-123',
        etag: 'etag-123',
        holderId: 'student-1',
        exp: Math.floor(Date.now() / 1000) + 5,
      };

      const { container } = render(<QRDisplay qrData={chainData} />);

      await waitFor(() => {
        expect(container.querySelector('.countdown-timer.critical')).toBeInTheDocument();
        expect(screen.getByText('⚠️ QR code expiring soon!')).toBeInTheDocument();
      });
    });

    it('should show normal state when time is sufficient (>10s)', async () => {
      const chainData: ChainQRData = {
        type: 'CHAIN',
        sessionId: 'session-123',
        tokenId: 'token-123',
        etag: 'etag-123',
        holderId: 'student-1',
        exp: Math.floor(Date.now() / 1000) + 15,
      };

      const { container } = render(<QRDisplay qrData={chainData} />);

      await waitFor(() => {
        expect(container.querySelector('.countdown-timer.normal')).toBeInTheDocument();
      });
    });
  });

  describe('Token Expiration', () => {
    it('should hide QR code when token expires', async () => {
      const chainData: ChainQRData = {
        type: 'CHAIN',
        sessionId: 'session-123',
        tokenId: 'token-123',
        etag: 'etag-123',
        holderId: 'student-1',
        exp: Math.floor(Date.now() / 1000) + 3,
      };

      const { container } = render(<QRDisplay qrData={chainData} />);

      // Initially should show QR code
      await waitFor(() => {
        expect(screen.getByAltText('QR Code')).toBeInTheDocument();
      });

      // Advance time past expiration
      act(() => {
        jest.advanceTimersByTime(4000);
      });

      // QR code should be hidden
      await waitFor(() => {
        expect(container.querySelector('.qr-display')).not.toBeInTheDocument();
      });
    });

    it('should call onExpire callback when token expires', async () => {
      const onExpire = jest.fn();
      const chainData: ChainQRData = {
        type: 'CHAIN',
        sessionId: 'session-123',
        tokenId: 'token-123',
        etag: 'etag-123',
        holderId: 'student-1',
        exp: Math.floor(Date.now() / 1000) + 2,
      };

      render(<QRDisplay qrData={chainData} onExpire={onExpire} />);

      // Wait for initial render
      await waitFor(() => {
        expect(screen.getByAltText('QR Code')).toBeInTheDocument();
      });

      // Advance time past expiration
      act(() => {
        jest.advanceTimersByTime(3000);
      });

      // onExpire should be called
      await waitFor(() => {
        expect(onExpire).toHaveBeenCalledTimes(1);
      });
    });

    it('should not render if token is already expired', async () => {
      const onExpire = jest.fn();
      const expiredChainData: ChainQRData = {
        type: 'CHAIN',
        sessionId: 'session-123',
        tokenId: 'token-123',
        etag: 'etag-123',
        holderId: 'student-1',
        exp: Math.floor(Date.now() / 1000) - 10, // Already expired
      };

      const { container } = render(<QRDisplay qrData={expiredChainData} onExpire={onExpire} />);

      // Should not render
      expect(container.querySelector('.qr-display')).not.toBeInTheDocument();

      // onExpire should be called immediately
      await waitFor(() => {
        expect(onExpire).toHaveBeenCalledTimes(1);
      });
    });

    it('should call onExpire only once', async () => {
      const onExpire = jest.fn();
      const chainData: ChainQRData = {
        type: 'CHAIN',
        sessionId: 'session-123',
        tokenId: 'token-123',
        etag: 'etag-123',
        holderId: 'student-1',
        exp: Math.floor(Date.now() / 1000) + 2,
      };

      render(<QRDisplay qrData={chainData} onExpire={onExpire} />);

      await waitFor(() => {
        expect(screen.getByAltText('QR Code')).toBeInTheDocument();
      });

      // Advance time past expiration
      act(() => {
        jest.advanceTimersByTime(3000);
      });

      // Advance more time
      act(() => {
        jest.advanceTimersByTime(5000);
      });

      // onExpire should still be called only once
      await waitFor(() => {
        expect(onExpire).toHaveBeenCalledTimes(1);
      });
    });
  });

  describe('QR Code Generation', () => {
    it('should generate QR code with correct data', async () => {
      const chainData: ChainQRData = {
        type: 'CHAIN',
        sessionId: 'session-123',
        tokenId: 'token-123',
        etag: 'etag-123',
        holderId: 'student-1',
        exp: Math.floor(Date.now() / 1000) + 20,
      };

      render(<QRDisplay qrData={chainData} />);

      await waitFor(() => {
        expect(QRCode.toDataURL).toHaveBeenCalledWith(
          JSON.stringify(chainData),
          expect.any(Object)
        );
      });
    });

    it('should handle QR code generation error gracefully', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      (QRCode.toDataURL as jest.Mock).mockRejectedValueOnce(new Error('QR generation failed'));

      const chainData: ChainQRData = {
        type: 'CHAIN',
        sessionId: 'session-123',
        tokenId: 'token-123',
        etag: 'etag-123',
        holderId: 'student-1',
        exp: Math.floor(Date.now() / 1000) + 20,
      };

      render(<QRDisplay qrData={chainData} />);

      await waitFor(() => {
        expect(consoleErrorSpy).toHaveBeenCalledWith(
          'Failed to generate QR code:',
          expect.any(Error)
        );
      });

      consoleErrorSpy.mockRestore();
    });

    it('should regenerate QR code when qrData changes', async () => {
      const chainData1: ChainQRData = {
        type: 'CHAIN',
        sessionId: 'session-123',
        tokenId: 'token-123',
        etag: 'etag-123',
        holderId: 'student-1',
        exp: Math.floor(Date.now() / 1000) + 20,
      };

      const { rerender } = render(<QRDisplay qrData={chainData1} />);

      await waitFor(() => {
        expect(QRCode.toDataURL).toHaveBeenCalledTimes(1);
      });

      const chainData2: ChainQRData = {
        type: 'CHAIN',
        sessionId: 'session-123',
        tokenId: 'token-456',
        etag: 'etag-456',
        holderId: 'student-2',
        exp: Math.floor(Date.now() / 1000) + 20,
      };

      rerender(<QRDisplay qrData={chainData2} />);

      await waitFor(() => {
        expect(QRCode.toDataURL).toHaveBeenCalledTimes(2);
        expect(QRCode.toDataURL).toHaveBeenLastCalledWith(
          JSON.stringify(chainData2),
          expect.any(Object)
        );
      });
    });
  });

  describe('Progress Bar', () => {
    it('should show full progress bar at start', async () => {
      const chainData: ChainQRData = {
        type: 'CHAIN',
        sessionId: 'session-123',
        tokenId: 'token-123',
        etag: 'etag-123',
        holderId: 'student-1',
        exp: Math.floor(Date.now() / 1000) + 20,
      };

      const { container } = render(<QRDisplay qrData={chainData} />);

      await waitFor(() => {
        const progressFill = container.querySelector('.timer-progress-fill') as HTMLElement;
        expect(progressFill).toBeInTheDocument();
        expect(progressFill.style.width).toBe('100%');
      });
    });

    it('should decrease progress bar as time passes', async () => {
      const chainData: ChainQRData = {
        type: 'CHAIN',
        sessionId: 'session-123',
        tokenId: 'token-123',
        etag: 'etag-123',
        holderId: 'student-1',
        exp: Math.floor(Date.now() / 1000) + 20,
      };

      const { container } = render(<QRDisplay qrData={chainData} />);

      await waitFor(() => {
        const progressFill = container.querySelector('.timer-progress-fill') as HTMLElement;
        expect(progressFill.style.width).toBe('100%');
      });

      // Advance time by 10 seconds (50% of 20s)
      act(() => {
        jest.advanceTimersByTime(10000);
      });

      await waitFor(() => {
        const progressFill = container.querySelector('.timer-progress-fill') as HTMLElement;
        expect(progressFill.style.width).toBe('50%');
      });
    });
  });

  describe('Cleanup', () => {
    it('should clear interval on unmount', async () => {
      const chainData: ChainQRData = {
        type: 'CHAIN',
        sessionId: 'session-123',
        tokenId: 'token-123',
        etag: 'etag-123',
        holderId: 'student-1',
        exp: Math.floor(Date.now() / 1000) + 20,
      };

      const { unmount } = render(<QRDisplay qrData={chainData} />);

      await waitFor(() => {
        expect(screen.getByAltText('QR Code')).toBeInTheDocument();
      });

      // Unmount component
      unmount();

      // Verify no errors when advancing timers after unmount
      expect(() => {
        act(() => {
          jest.advanceTimersByTime(5000);
        });
      }).not.toThrow();
    });

    it('should clear interval when qrData becomes null', async () => {
      const chainData: ChainQRData = {
        type: 'CHAIN',
        sessionId: 'session-123',
        tokenId: 'token-123',
        etag: 'etag-123',
        holderId: 'student-1',
        exp: Math.floor(Date.now() / 1000) + 20,
      };

      const { rerender } = render(<QRDisplay qrData={chainData} />);

      await waitFor(() => {
        expect(screen.getByAltText('QR Code')).toBeInTheDocument();
      });

      // Set qrData to null
      rerender(<QRDisplay qrData={null} />);

      // Verify no errors when advancing timers
      expect(() => {
        act(() => {
          jest.advanceTimersByTime(5000);
        });
      }).not.toThrow();
    });
  });
});
