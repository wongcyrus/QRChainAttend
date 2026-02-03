/**
 * Session Enrollment Component Tests
 * Feature: qr-chain-attendance
 * Requirements: 13.1
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { SessionEnrollment } from './SessionEnrollment';
import type { SessionQRData } from '@qr-attendance/shared';

// Mock QRScanner component
jest.mock('./QRScanner', () => ({
  QRScanner: ({ onSessionScanned, onScanError, isActive }: any) => {
    if (!isActive) return null;
    
    return (
      <div data-testid="qr-scanner">
        <button
          data-testid="mock-scan-session"
          onClick={() => {
            const sessionData: SessionQRData = {
              type: 'SESSION',
              sessionId: 'test-session-123',
              classId: 'CS101',
            };
            onSessionScanned(sessionData);
          }}
        >
          Mock Scan Session
        </button>
        <button
          data-testid="mock-scan-error"
          onClick={() => onScanError('Mock scan error')}
        >
          Mock Scan Error
        </button>
      </div>
    );
  },
}));

// Mock fetch
global.fetch = jest.fn();

describe('SessionEnrollment', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
  });

  describe('Initial Render', () => {
    it('should render the enrollment page with scan button', () => {
      render(<SessionEnrollment />);

      expect(screen.getByText('QR Chain Attendance')).toBeInTheDocument();
      expect(screen.getByText('Scan your class session QR code to get started')).toBeInTheDocument();
      expect(screen.getByText('📷 Scan Session QR Code')).toBeInTheDocument();
    });

    it('should display instructions', () => {
      render(<SessionEnrollment />);

      expect(screen.getByText('How It Works')).toBeInTheDocument();
      expect(screen.getByText(/Your teacher will display a Session QR code/)).toBeInTheDocument();
    });
  });

  describe('Scanner Interaction', () => {
    it('should show scanner when scan button is clicked', () => {
      render(<SessionEnrollment />);

      const scanButton = screen.getByText('📷 Scan Session QR Code');
      fireEvent.click(scanButton);

      expect(screen.getByTestId('qr-scanner')).toBeInTheDocument();
      expect(screen.getByText('Scan Session QR Code')).toBeInTheDocument();
    });

    it('should hide scanner when cancel button is clicked', () => {
      render(<SessionEnrollment />);

      // Open scanner
      const scanButton = screen.getByText('📷 Scan Session QR Code');
      fireEvent.click(scanButton);

      expect(screen.getByTestId('qr-scanner')).toBeInTheDocument();

      // Close scanner
      const cancelButton = screen.getByText('Cancel');
      fireEvent.click(cancelButton);

      expect(screen.queryByTestId('qr-scanner')).not.toBeInTheDocument();
    });
  });

  describe('Session Enrollment', () => {
    it('should call join session API when Session_QR is scanned', async () => {
      const mockFetch = global.fetch as jest.Mock;
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          sessionId: 'test-session-123',
          studentId: 'student-456',
          message: 'Successfully enrolled in session',
        }),
      });

      const onSessionJoined = jest.fn();
      render(<SessionEnrollment onSessionJoined={onSessionJoined} />);

      // Open scanner
      const scanButton = screen.getByText('📷 Scan Session QR Code');
      fireEvent.click(scanButton);

      // Simulate scanning a Session QR
      const mockScanButton = screen.getByTestId('mock-scan-session');
      fireEvent.click(mockScanButton);

      // Wait for API call
      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          '/api/sessions/test-session-123/join',
          expect.objectContaining({
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
          })
        );
      });

      // Check success message
      await waitFor(() => {
        expect(screen.getByText(/Successfully enrolled in session/)).toBeInTheDocument();
      });

      // Check that session ID was stored in localStorage
      expect(localStorage.getItem('currentSessionId')).toBe('test-session-123');

      // Check that callback was called after delay
      await waitFor(
        () => {
          expect(onSessionJoined).toHaveBeenCalledWith('test-session-123');
        },
        { timeout: 2000 }
      );
    });

    it('should display error when join session API fails', async () => {
      const mockFetch = global.fetch as jest.Mock;
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: async () => ({
          error: {
            code: 'NOT_FOUND',
            message: 'Session not found',
          },
        }),
      });

      render(<SessionEnrollment />);

      // Open scanner
      const scanButton = screen.getByText('📷 Scan Session QR Code');
      fireEvent.click(scanButton);

      // Simulate scanning a Session QR
      const mockScanButton = screen.getByTestId('mock-scan-session');
      fireEvent.click(mockScanButton);

      // Wait for error message
      await waitFor(() => {
        expect(screen.getByText(/Session not found/)).toBeInTheDocument();
      });
    });

    it('should handle network errors gracefully', async () => {
      const mockFetch = global.fetch as jest.Mock;
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      render(<SessionEnrollment />);

      // Open scanner
      const scanButton = screen.getByText('📷 Scan Session QR Code');
      fireEvent.click(scanButton);

      // Simulate scanning a Session QR
      const mockScanButton = screen.getByTestId('mock-scan-session');
      fireEvent.click(mockScanButton);

      // Wait for error message
      await waitFor(() => {
        expect(screen.getByText(/Network error/)).toBeInTheDocument();
      });
    });
  });

  describe('Scan Errors', () => {
    it('should display error when QR scan fails', async () => {
      render(<SessionEnrollment />);

      // Open scanner
      const scanButton = screen.getByText('📷 Scan Session QR Code');
      fireEvent.click(scanButton);

      // Simulate scan error
      const mockErrorButton = screen.getByTestId('mock-scan-error');
      fireEvent.click(mockErrorButton);

      // Check error message
      await waitFor(() => {
        expect(screen.getByText(/Mock scan error/)).toBeInTheDocument();
      });
    });
  });

  describe('Requirement 13.1: Session enrollment via QR', () => {
    it('should enroll student when scanning Session_QR code', async () => {
      const mockFetch = global.fetch as jest.Mock;
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          sessionId: 'session-789',
          studentId: 'student-123',
          message: 'Successfully enrolled in session',
        }),
      });

      const onSessionJoined = jest.fn();
      render(<SessionEnrollment onSessionJoined={onSessionJoined} />);

      // Open scanner
      fireEvent.click(screen.getByText('📷 Scan Session QR Code'));

      // Scan Session QR
      fireEvent.click(screen.getByTestId('mock-scan-session'));

      // Verify enrollment API was called
      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          '/api/sessions/test-session-123/join',
          expect.any(Object)
        );
      });

      // Verify success message is shown
      await waitFor(() => {
        expect(screen.getByText(/Successfully enrolled/)).toBeInTheDocument();
      });

      // Verify session ID is stored in local state
      expect(localStorage.getItem('currentSessionId')).toBe('test-session-123');

      // Verify navigation callback is called
      await waitFor(
        () => {
          expect(onSessionJoined).toHaveBeenCalledWith('test-session-123');
        },
        { timeout: 2000 }
      );
    });
  });
});
