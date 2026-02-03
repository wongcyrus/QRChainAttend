/**
 * QR Scanner Component Unit Tests
 * Feature: qr-chain-attendance
 * Requirements: 13.1, 13.5
 */

import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { QRScanner } from './QRScanner';
import type { SessionQRData, ChainQRData, ChainScanResponse } from '@qr-attendance/shared';

// Mock react-qr-reader
jest.mock('react-qr-reader', () => ({
  QrReader: ({ onResult }: any) => {
    // Store the callback for testing
    (global as any).mockQrReaderCallback = onResult;
    return <div data-testid="qr-reader">QR Reader Mock</div>;
  },
}));

// Mock fetch
global.fetch = jest.fn();

describe('QRScanner Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (global as any).mockQrReaderCallback = null;
    
    // Mock geolocation
    Object.defineProperty(global.navigator, 'geolocation', {
      value: {
        getCurrentPosition: jest.fn((success) =>
          success({
            coords: {
              latitude: 22.3193,
              longitude: 114.1694,
            },
          })
        ),
      },
      configurable: true,
    });
  });

  describe('Rendering', () => {
    it('should render QR reader when active', () => {
      render(<QRScanner isActive={true} />);
      expect(screen.getByTestId('qr-reader')).toBeInTheDocument();
    });

    it('should not render when inactive', () => {
      render(<QRScanner isActive={false} />);
      expect(screen.queryByTestId('qr-reader')).not.toBeInTheDocument();
    });

    it('should render with custom className', () => {
      const { container } = render(<QRScanner isActive={true} className="custom-class" />);
      expect(container.querySelector('.qr-scanner.custom-class')).toBeInTheDocument();
    });
  });

  describe('Session QR Scanning', () => {
    it('should parse and handle valid session QR code', async () => {
      const onSessionScanned = jest.fn();
      render(<QRScanner isActive={true} onSessionScanned={onSessionScanned} />);

      const sessionData: SessionQRData = {
        type: 'SESSION',
        sessionId: 'session-123',
        classId: 'class-456',
      };

      const callback = (global as any).mockQrReaderCallback;
      await callback({ text: JSON.stringify(sessionData) }, null);

      await waitFor(() => {
        expect(onSessionScanned).toHaveBeenCalledWith(sessionData);
      });
    });

    it('should reject invalid session QR code', async () => {
      const onScanError = jest.fn();
      render(<QRScanner isActive={true} onScanError={onScanError} />);

      const invalidData = {
        type: 'SESSION',
        // Missing required fields
      };

      const callback = (global as any).mockQrReaderCallback;
      await callback({ text: JSON.stringify(invalidData) }, null);

      await waitFor(() => {
        expect(onScanError).toHaveBeenCalledWith('Invalid QR code format');
      });
    });
  });

  describe('Chain QR Scanning', () => {
    it('should parse and call chain scan API for valid chain QR', async () => {
      const onScanSuccess = jest.fn();
      const mockResponse: ChainScanResponse = {
        success: true,
        holderMarked: 'student-1',
        newHolder: 'student-2',
        newToken: 'token-456',
        newTokenEtag: 'etag-456',
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      render(<QRScanner isActive={true} onScanSuccess={onScanSuccess} />);

      const chainData: ChainQRData = {
        type: 'CHAIN',
        sessionId: 'session-123',
        tokenId: 'token-123',
        etag: 'etag-123',
        holderId: 'student-1',
        exp: Math.floor(Date.now() / 1000) + 20, // 20 seconds in future
      };

      const callback = (global as any).mockQrReaderCallback;
      await callback({ text: JSON.stringify(chainData) }, null);

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          '/api/scan/chain',
          expect.objectContaining({
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
          })
        );
        expect(onScanSuccess).toHaveBeenCalledWith(mockResponse);
      });
    });

    it('should reject expired chain token', async () => {
      const onScanError = jest.fn();
      render(<QRScanner isActive={true} onScanError={onScanError} />);

      const expiredChainData: ChainQRData = {
        type: 'CHAIN',
        sessionId: 'session-123',
        tokenId: 'token-123',
        etag: 'etag-123',
        holderId: 'student-1',
        exp: Math.floor(Date.now() / 1000) - 10, // 10 seconds in past
      };

      const callback = (global as any).mockQrReaderCallback;
      await callback({ text: JSON.stringify(expiredChainData) }, null);

      await waitFor(() => {
        expect(onScanError).toHaveBeenCalledWith('This QR code has expired');
        expect(global.fetch).not.toHaveBeenCalled();
      });
    });

    it('should handle API error responses', async () => {
      const onScanError = jest.fn();
      
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        json: async () => ({
          error: {
            code: 'TOKEN_ALREADY_USED',
            message: 'Token has already been used',
            timestamp: Date.now(),
            requestId: 'req-123',
          },
        }),
      });

      render(<QRScanner isActive={true} onScanError={onScanError} />);

      const chainData: ChainQRData = {
        type: 'CHAIN',
        sessionId: 'session-123',
        tokenId: 'token-123',
        etag: 'etag-123',
        holderId: 'student-1',
        exp: Math.floor(Date.now() / 1000) + 20,
      };

      const callback = (global as any).mockQrReaderCallback;
      await callback({ text: JSON.stringify(chainData) }, null);

      await waitFor(() => {
        expect(onScanError).toHaveBeenCalledWith('This QR code has already been scanned.');
      });
    });
  });

  describe('Exit Chain QR Scanning', () => {
    it('should call exit-chain API for exit chain QR', async () => {
      const onScanSuccess = jest.fn();
      const mockResponse: ChainScanResponse = {
        success: true,
        holderMarked: 'student-1',
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      render(<QRScanner isActive={true} onScanSuccess={onScanSuccess} />);

      const exitChainData: ChainQRData = {
        type: 'EXIT_CHAIN',
        sessionId: 'session-123',
        tokenId: 'token-123',
        etag: 'etag-123',
        holderId: 'student-1',
        exp: Math.floor(Date.now() / 1000) + 20,
      };

      const callback = (global as any).mockQrReaderCallback;
      await callback({ text: JSON.stringify(exitChainData) }, null);

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          '/api/scan/exit-chain',
          expect.objectContaining({
            method: 'POST',
          })
        );
        expect(onScanSuccess).toHaveBeenCalledWith(mockResponse);
      });
    });
  });

  describe('Late Entry QR Scanning', () => {
    it('should call late-entry API for late entry QR', async () => {
      const onScanSuccess = jest.fn();
      const mockResponse: ChainScanResponse = {
        success: true,
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      render(<QRScanner isActive={true} onScanSuccess={onScanSuccess} />);

      const lateEntryData = {
        type: 'LATE_ENTRY',
        sessionId: 'session-123',
        tokenId: 'token-123',
        etag: 'etag-123',
        exp: Math.floor(Date.now() / 1000) + 60,
      };

      const callback = (global as any).mockQrReaderCallback;
      await callback({ text: JSON.stringify(lateEntryData) }, null);

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          '/api/scan/late-entry',
          expect.objectContaining({
            method: 'POST',
          })
        );
        expect(onScanSuccess).toHaveBeenCalledWith(mockResponse);
      });
    });
  });

  describe('Early Leave QR Scanning', () => {
    it('should call early-leave API for early leave QR', async () => {
      const onScanSuccess = jest.fn();
      const mockResponse: ChainScanResponse = {
        success: true,
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      render(<QRScanner isActive={true} onScanSuccess={onScanSuccess} />);

      const earlyLeaveData = {
        type: 'EARLY_LEAVE',
        sessionId: 'session-123',
        tokenId: 'token-123',
        etag: 'etag-123',
        exp: Math.floor(Date.now() / 1000) + 60,
      };

      const callback = (global as any).mockQrReaderCallback;
      await callback({ text: JSON.stringify(earlyLeaveData) }, null);

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          '/api/scan/early-leave',
          expect.objectContaining({
            method: 'POST',
          })
        );
        expect(onScanSuccess).toHaveBeenCalledWith(mockResponse);
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle camera permission denied', async () => {
      render(<QRScanner isActive={true} />);

      const error = { name: 'NotAllowedError' };
      const callback = (global as any).mockQrReaderCallback;
      await callback(null, error);

      await waitFor(() => {
        expect(screen.getByText(/Camera access denied/i)).toBeInTheDocument();
      });
    });

    it('should handle no camera found', async () => {
      render(<QRScanner isActive={true} />);

      const error = { name: 'NotFoundError' };
      const callback = (global as any).mockQrReaderCallback;
      await callback(null, error);

      await waitFor(() => {
        expect(screen.getByText(/No camera found/i)).toBeInTheDocument();
      });
    });

    it('should handle invalid JSON in QR code', async () => {
      const onScanError = jest.fn();
      render(<QRScanner isActive={true} onScanError={onScanError} />);

      const callback = (global as any).mockQrReaderCallback;
      await callback({ text: 'invalid json' }, null);

      await waitFor(() => {
        expect(onScanError).toHaveBeenCalledWith('Invalid QR code format');
      });
    });

    it('should provide user-friendly error messages', async () => {
      const onScanError = jest.fn();
      
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        json: async () => ({
          error: {
            code: 'RATE_LIMITED',
            message: 'Rate limit exceeded',
            timestamp: Date.now(),
            requestId: 'req-123',
          },
        }),
      });

      render(<QRScanner isActive={true} onScanError={onScanError} />);

      const chainData: ChainQRData = {
        type: 'CHAIN',
        sessionId: 'session-123',
        tokenId: 'token-123',
        etag: 'etag-123',
        holderId: 'student-1',
        exp: Math.floor(Date.now() / 1000) + 20,
      };

      const callback = (global as any).mockQrReaderCallback;
      await callback({ text: JSON.stringify(chainData) }, null);

      await waitFor(() => {
        expect(onScanError).toHaveBeenCalledWith(
          'Too many scan attempts. Please wait a moment and try again.'
        );
      });
    });
  });

  describe('Scan Cooldown', () => {
    it('should prevent duplicate scans within cooldown period', async () => {
      const onScanSuccess = jest.fn();
      const mockResponse: ChainScanResponse = {
        success: true,
      };

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => mockResponse,
      });

      render(<QRScanner isActive={true} onScanSuccess={onScanSuccess} />);

      const chainData: ChainQRData = {
        type: 'CHAIN',
        sessionId: 'session-123',
        tokenId: 'token-123',
        etag: 'etag-123',
        holderId: 'student-1',
        exp: Math.floor(Date.now() / 1000) + 20,
      };

      const callback = (global as any).mockQrReaderCallback;
      
      // First scan
      await callback({ text: JSON.stringify(chainData) }, null);
      
      // Wait for first scan to complete
      await waitFor(() => {
        expect(onScanSuccess).toHaveBeenCalledTimes(1);
      });

      // Immediate second scan with same data (should be ignored due to lastScannedData check)
      await callback({ text: JSON.stringify(chainData) }, null);

      // Wait a bit to ensure no second call was made
      await new Promise(resolve => setTimeout(resolve, 100));

      // Should still be only 1 call
      expect(global.fetch).toHaveBeenCalledTimes(1);
      expect(onScanSuccess).toHaveBeenCalledTimes(1);
    });
  });

  describe('Metadata Collection', () => {
    it('should include device fingerprint in scan metadata', async () => {
      const mockResponse: ChainScanResponse = {
        success: true,
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      render(<QRScanner isActive={true} />);

      const chainData: ChainQRData = {
        type: 'CHAIN',
        sessionId: 'session-123',
        tokenId: 'token-123',
        etag: 'etag-123',
        holderId: 'student-1',
        exp: Math.floor(Date.now() / 1000) + 20,
      };

      const callback = (global as any).mockQrReaderCallback;
      await callback({ text: JSON.stringify(chainData) }, null);

      await waitFor(() => {
        const fetchCall = (global.fetch as jest.Mock).mock.calls[0];
        const body = JSON.parse(fetchCall[1].body);
        
        expect(body.metadata).toBeDefined();
        expect(body.metadata.deviceFingerprint).toBeDefined();
        expect(body.metadata.deviceFingerprint).toMatch(/^fp_/);
        expect(body.metadata.userAgent).toBeDefined();
      });
    });

    it('should include GPS coordinates when available', async () => {
      const mockResponse: ChainScanResponse = {
        success: true,
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      render(<QRScanner isActive={true} />);

      const chainData: ChainQRData = {
        type: 'CHAIN',
        sessionId: 'session-123',
        tokenId: 'token-123',
        etag: 'etag-123',
        holderId: 'student-1',
        exp: Math.floor(Date.now() / 1000) + 20,
      };

      const callback = (global as any).mockQrReaderCallback;
      await callback({ text: JSON.stringify(chainData) }, null);

      await waitFor(() => {
        const fetchCall = (global.fetch as jest.Mock).mock.calls[0];
        const body = JSON.parse(fetchCall[1].body);
        
        expect(body.metadata.gps).toBeDefined();
        expect(body.metadata.gps.latitude).toBe(22.3193);
        expect(body.metadata.gps.longitude).toBe(114.1694);
      });
    });
  });
});
