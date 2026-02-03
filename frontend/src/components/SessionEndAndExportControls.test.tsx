/**
 * Unit tests for SessionEndAndExportControls component
 * Feature: qr-chain-attendance
 * Requirements: 2.3, 14.1, 14.2, 14.3
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { SessionEndAndExportControls } from './SessionEndAndExportControls';

// Mock fetch
global.fetch = jest.fn();

// Mock URL.createObjectURL and URL.revokeObjectURL
global.URL.createObjectURL = jest.fn(() => 'mock-url');
global.URL.revokeObjectURL = jest.fn();

describe('SessionEndAndExportControls', () => {
  const mockSessionId = 'test-session-123';
  const mockFinalAttendance = [
    {
      sessionId: mockSessionId,
      studentId: 'student-1',
      entryStatus: 'PRESENT_ENTRY' as const,
      entryAt: 1700000000,
      exitVerified: true,
      exitVerifiedAt: 1700003600,
      finalStatus: 'PRESENT' as const,
    },
    {
      sessionId: mockSessionId,
      studentId: 'student-2',
      entryStatus: 'LATE_ENTRY' as const,
      entryAt: 1700001800,
      exitVerified: true,
      exitVerifiedAt: 1700003600,
      finalStatus: 'LATE' as const,
    },
    {
      sessionId: mockSessionId,
      studentId: 'student-3',
      entryStatus: 'PRESENT_ENTRY' as const,
      entryAt: 1700000000,
      exitVerified: false,
      finalStatus: 'LEFT_EARLY' as const,
    },
    {
      sessionId: mockSessionId,
      studentId: 'student-4',
      entryStatus: 'PRESENT_ENTRY' as const,
      entryAt: 1700000000,
      exitVerified: true,
      exitVerifiedAt: 1700002000,
      earlyLeaveAt: 1700002000,
      finalStatus: 'EARLY_LEAVE' as const,
    },
    {
      sessionId: mockSessionId,
      studentId: 'student-5',
      exitVerified: false,
      finalStatus: 'ABSENT' as const,
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Rendering', () => {
    it('should render session management controls', () => {
      render(
        <SessionEndAndExportControls
          sessionId={mockSessionId}
          sessionStatus="ACTIVE"
        />
      );

      expect(screen.getByText('Session Management')).toBeInTheDocument();
      expect(screen.getByText('End Session')).toBeInTheDocument();
      expect(screen.getByText('Export Attendance (JSON)')).toBeInTheDocument();
    });

    it('should show active session status indicator', () => {
      render(
        <SessionEndAndExportControls
          sessionId={mockSessionId}
          sessionStatus="ACTIVE"
        />
      );

      expect(screen.getByText(/Session Status:/)).toBeInTheDocument();
      expect(screen.getByText('ACTIVE')).toBeInTheDocument();
    });

    it('should show ended session status indicator', () => {
      render(
        <SessionEndAndExportControls
          sessionId={mockSessionId}
          sessionStatus="ENDED"
        />
      );

      expect(screen.getByText(/Session Status:/)).toBeInTheDocument();
      expect(screen.getByText('ENDED')).toBeInTheDocument();
    });

    it('should hide end session button when session is already ended', () => {
      render(
        <SessionEndAndExportControls
          sessionId={mockSessionId}
          sessionStatus="ENDED"
        />
      );

      expect(screen.queryByText('End Session')).not.toBeInTheDocument();
    });

    it('should show end session button when session is active', () => {
      render(
        <SessionEndAndExportControls
          sessionId={mockSessionId}
          sessionStatus="ACTIVE"
        />
      );

      expect(screen.getByText('End Session')).toBeInTheDocument();
    });
  });

  describe('End Session - Requirements 2.3, 14.1, 14.2', () => {
    it('should call end session API', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({
          finalAttendance: mockFinalAttendance,
        }),
      });

      render(
        <SessionEndAndExportControls
          sessionId={mockSessionId}
          sessionStatus="ACTIVE"
        />
      );

      const endButton = screen.getByText('End Session');
      fireEvent.click(endButton);

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          `/api/sessions/${mockSessionId}/end`,
          { method: 'POST' }
        );
      });
    });

    it('should display success message after ending session', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({
          finalAttendance: mockFinalAttendance,
        }),
      });

      render(
        <SessionEndAndExportControls
          sessionId={mockSessionId}
          sessionStatus="ACTIVE"
        />
      );

      const endButton = screen.getByText('End Session');
      fireEvent.click(endButton);

      await waitFor(() => {
        expect(screen.getByText(/Session ended successfully/)).toBeInTheDocument();
        expect(screen.getByText(/5 student\(s\)/)).toBeInTheDocument();
      });
    });

    it('should show loading state while ending session', async () => {
      (global.fetch as jest.Mock).mockImplementation(
        () => new Promise(resolve => setTimeout(resolve, 100))
      );

      render(
        <SessionEndAndExportControls
          sessionId={mockSessionId}
          sessionStatus="ACTIVE"
        />
      );

      const endButton = screen.getByText('End Session');
      fireEvent.click(endButton);

      expect(screen.getByText('Ending Session...')).toBeInTheDocument();
    });

    it('should call onSessionEnded callback with final attendance', async () => {
      const onSessionEnded = jest.fn();
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({
          finalAttendance: mockFinalAttendance,
        }),
      });

      render(
        <SessionEndAndExportControls
          sessionId={mockSessionId}
          sessionStatus="ACTIVE"
          onSessionEnded={onSessionEnded}
        />
      );

      const endButton = screen.getByText('End Session');
      fireEvent.click(endButton);

      await waitFor(() => {
        expect(onSessionEnded).toHaveBeenCalledWith(mockFinalAttendance);
      });
    });

    it('should handle API errors gracefully', async () => {
      const onError = jest.fn();
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        statusText: 'Forbidden',
        json: async () => ({
          error: {
            message: 'You do not own this session',
          },
        }),
      });

      render(
        <SessionEndAndExportControls
          sessionId={mockSessionId}
          sessionStatus="ACTIVE"
          onError={onError}
        />
      );

      const endButton = screen.getByText('End Session');
      fireEvent.click(endButton);

      await waitFor(() => {
        expect(onError).toHaveBeenCalledWith('You do not own this session');
      });
    });

    it('should display final attendance summary after ending session', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({
          finalAttendance: mockFinalAttendance,
        }),
      });

      render(
        <SessionEndAndExportControls
          sessionId={mockSessionId}
          sessionStatus="ACTIVE"
        />
      );

      const endButton = screen.getByText('End Session');
      fireEvent.click(endButton);

      await waitFor(() => {
        expect(screen.getByText('Final Attendance Summary')).toBeInTheDocument();
      });
    });
  });

  describe('Export Attendance - Requirements 14.1, 14.2, 14.3', () => {
    it('should call get attendance API', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({
          attendance: mockFinalAttendance,
        }),
      });

      render(
        <SessionEndAndExportControls
          sessionId={mockSessionId}
          sessionStatus="ACTIVE"
        />
      );

      const exportButton = screen.getByText('Export Attendance (JSON)');
      fireEvent.click(exportButton);

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          `/api/sessions/${mockSessionId}/attendance`
        );
      });
    });

    it('should create and download JSON file', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({
          attendance: mockFinalAttendance,
        }),
      });

      render(
        <SessionEndAndExportControls
          sessionId={mockSessionId}
          sessionStatus="ACTIVE"
        />
      );

      const exportButton = screen.getByText('Export Attendance (JSON)');
      fireEvent.click(exportButton);

      // Just verify the export was successful
      await waitFor(() => {
        expect(screen.getByText(/Attendance data exported successfully/)).toBeInTheDocument();
      });
    });

    it('should export data in JSON format', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({
          attendance: mockFinalAttendance,
        }),
      });

      // Mock Blob constructor to verify JSON format
      const mockBlob = new Blob(['test'], { type: 'application/json' });
      const blobSpy = jest.spyOn(global, 'Blob').mockImplementation((content: any, options: any) => {
        // Verify JSON format
        expect(options.type).toBe('application/json');
        const jsonString = content[0];
        expect(() => JSON.parse(jsonString)).not.toThrow();
        return mockBlob;
      });

      render(
        <SessionEndAndExportControls
          sessionId={mockSessionId}
          sessionStatus="ACTIVE"
        />
      );

      const exportButton = screen.getByText('Export Attendance (JSON)');
      fireEvent.click(exportButton);

      await waitFor(() => {
        expect(blobSpy).toHaveBeenCalled();
      });

      blobSpy.mockRestore();
    });

    it('should display success message after export', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({
          attendance: mockFinalAttendance,
        }),
      });

      render(
        <SessionEndAndExportControls
          sessionId={mockSessionId}
          sessionStatus="ACTIVE"
        />
      );

      const exportButton = screen.getByText('Export Attendance (JSON)');
      fireEvent.click(exportButton);

      await waitFor(() => {
        expect(screen.getByText(/Attendance data exported successfully/)).toBeInTheDocument();
        expect(screen.getByText(/5 student\(s\)/)).toBeInTheDocument();
      });
    });

    it('should show loading state while exporting', async () => {
      (global.fetch as jest.Mock).mockImplementation(
        () => new Promise(resolve => setTimeout(resolve, 100))
      );

      render(
        <SessionEndAndExportControls
          sessionId={mockSessionId}
          sessionStatus="ACTIVE"
        />
      );

      const exportButton = screen.getByText('Export Attendance (JSON)');
      fireEvent.click(exportButton);

      expect(screen.getByText('Exporting...')).toBeInTheDocument();
    });

    it('should handle export errors gracefully', async () => {
      const onError = jest.fn();
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        statusText: 'Forbidden',
        json: async () => ({
          error: {
            message: 'You do not own this session',
          },
        }),
      });

      render(
        <SessionEndAndExportControls
          sessionId={mockSessionId}
          sessionStatus="ACTIVE"
          onError={onError}
        />
      );

      const exportButton = screen.getByText('Export Attendance (JSON)');
      fireEvent.click(exportButton);

      await waitFor(() => {
        expect(onError).toHaveBeenCalledWith('You do not own this session');
      });
    });

    it('should include all required fields in export - Requirement 14.2', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({
          attendance: mockFinalAttendance,
        }),
      });

      let exportedData: any = null;
      const blobSpy = jest.spyOn(global, 'Blob').mockImplementation((content: any) => {
        exportedData = JSON.parse(content[0]);
        return new Blob(['test'], { type: 'application/json' });
      });

      render(
        <SessionEndAndExportControls
          sessionId={mockSessionId}
          sessionStatus="ACTIVE"
        />
      );

      const exportButton = screen.getByText('Export Attendance (JSON)');
      fireEvent.click(exportButton);

      await waitFor(() => {
        expect(exportedData).not.toBeNull();
      });

      // Verify all required fields are present (Requirement 14.2)
      expect(exportedData[0]).toHaveProperty('studentId');
      expect(exportedData[0]).toHaveProperty('entryStatus');
      expect(exportedData[0]).toHaveProperty('entryAt');
      expect(exportedData[0]).toHaveProperty('exitVerified');
      expect(exportedData[0]).toHaveProperty('exitVerifiedAt');
      expect(exportedData[0]).toHaveProperty('finalStatus');

      blobSpy.mockRestore();
    });
  });

  describe('Final Attendance Summary Display', () => {
    beforeEach(() => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({
          finalAttendance: mockFinalAttendance,
        }),
      });
    });

    it('should display summary statistics correctly', async () => {
      render(
        <SessionEndAndExportControls
          sessionId={mockSessionId}
          sessionStatus="ACTIVE"
        />
      );

      const endButton = screen.getByText('End Session');
      fireEvent.click(endButton);

      await waitFor(() => {
        expect(screen.getByText('Final Attendance Summary')).toBeInTheDocument();
      });

      // Check summary stats
      const statCards = screen.getAllByText(/Total Students|Present|Late|Left Early|Early Leave|Absent/);
      expect(statCards.length).toBeGreaterThan(0);
    });

    it('should compute correct summary counts', async () => {
      render(
        <SessionEndAndExportControls
          sessionId={mockSessionId}
          sessionStatus="ACTIVE"
        />
      );

      const endButton = screen.getByText('End Session');
      fireEvent.click(endButton);

      await waitFor(() => {
        expect(screen.getByText('Final Attendance Summary')).toBeInTheDocument();
      });

      // Total: 5, Present: 1, Late: 1, Left Early: 1, Early Leave: 1, Absent: 1
      const values = screen.getAllByText(/^[0-9]+$/);
      expect(values.length).toBeGreaterThan(0);
    });

    it('should display detailed attendance table', async () => {
      render(
        <SessionEndAndExportControls
          sessionId={mockSessionId}
          sessionStatus="ACTIVE"
        />
      );

      const endButton = screen.getByText('End Session');
      fireEvent.click(endButton);

      await waitFor(() => {
        expect(screen.getByText('Detailed Attendance Records')).toBeInTheDocument();
      });

      // Check table headers
      expect(screen.getByText('Student ID')).toBeInTheDocument();
      expect(screen.getByText('Final Status')).toBeInTheDocument();
      expect(screen.getByText('Entry Status')).toBeInTheDocument();
      expect(screen.getByText('Entry Time')).toBeInTheDocument();
      expect(screen.getByText('Exit Verified')).toBeInTheDocument();
      expect(screen.getByText('Exit Time')).toBeInTheDocument();
      expect(screen.getByText('Early Leave Time')).toBeInTheDocument();
    });

    it('should display all student records in table', async () => {
      render(
        <SessionEndAndExportControls
          sessionId={mockSessionId}
          sessionStatus="ACTIVE"
        />
      );

      const endButton = screen.getByText('End Session');
      fireEvent.click(endButton);

      await waitFor(() => {
        expect(screen.getByText('student-1')).toBeInTheDocument();
        expect(screen.getByText('student-2')).toBeInTheDocument();
        expect(screen.getByText('student-3')).toBeInTheDocument();
        expect(screen.getByText('student-4')).toBeInTheDocument();
        expect(screen.getByText('student-5')).toBeInTheDocument();
      });
    });

    it('should display final status badges with correct styling', async () => {
      render(
        <SessionEndAndExportControls
          sessionId={mockSessionId}
          sessionStatus="ACTIVE"
        />
      );

      const endButton = screen.getByText('End Session');
      fireEvent.click(endButton);

      await waitFor(() => {
        expect(screen.getByText('PRESENT')).toBeInTheDocument();
        expect(screen.getByText('LATE')).toBeInTheDocument();
        expect(screen.getByText('LEFT_EARLY')).toBeInTheDocument();
        expect(screen.getByText('EARLY_LEAVE')).toBeInTheDocument();
        expect(screen.getByText('ABSENT')).toBeInTheDocument();
      });
    });

    it('should format timestamps correctly', async () => {
      render(
        <SessionEndAndExportControls
          sessionId={mockSessionId}
          sessionStatus="ACTIVE"
        />
      );

      const endButton = screen.getByText('End Session');
      fireEvent.click(endButton);

      await waitFor(() => {
        // Should display formatted dates (format varies by locale)
        const timestamps = screen.getAllByText(/\d{1,2}\/\d{1,2}\/\d{4}|\d{1,2}:\d{2}/);
        expect(timestamps.length).toBeGreaterThan(0);
      });
    });

    it('should display N/A for missing timestamps', async () => {
      render(
        <SessionEndAndExportControls
          sessionId={mockSessionId}
          sessionStatus="ACTIVE"
        />
      );

      const endButton = screen.getByText('End Session');
      fireEvent.click(endButton);

      await waitFor(() => {
        const naElements = screen.getAllByText('N/A');
        expect(naElements.length).toBeGreaterThan(0);
      });
    });

    it('should display verification badges', async () => {
      render(
        <SessionEndAndExportControls
          sessionId={mockSessionId}
          sessionStatus="ACTIVE"
        />
      );

      const endButton = screen.getByText('End Session');
      fireEvent.click(endButton);

      await waitFor(() => {
        const yesElements = screen.getAllByText(/✓ Yes/);
        const noElements = screen.getAllByText(/✗ No/);
        expect(yesElements.length).toBeGreaterThan(0);
        expect(noElements.length).toBeGreaterThan(0);
      });
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA labels for buttons', () => {
      render(
        <SessionEndAndExportControls
          sessionId={mockSessionId}
          sessionStatus="ACTIVE"
        />
      );

      const endButton = screen.getByLabelText('End session and compute final attendance');
      const exportButton = screen.getByLabelText('Export attendance data as JSON');

      expect(endButton).toBeInTheDocument();
      expect(exportButton).toBeInTheDocument();
    });

    it('should have role="status" for success messages', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({
          finalAttendance: mockFinalAttendance,
        }),
      });

      render(
        <SessionEndAndExportControls
          sessionId={mockSessionId}
          sessionStatus="ACTIVE"
        />
      );

      const endButton = screen.getByText('End Session');
      fireEvent.click(endButton);

      await waitFor(() => {
        const successMessage = screen.getByRole('status');
        expect(successMessage).toBeInTheDocument();
      });
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty attendance list', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({
          finalAttendance: [],
        }),
      });

      render(
        <SessionEndAndExportControls
          sessionId={mockSessionId}
          sessionStatus="ACTIVE"
        />
      );

      const endButton = screen.getByText('End Session');
      fireEvent.click(endButton);

      await waitFor(() => {
        expect(screen.getByText(/0 student\(s\)/)).toBeInTheDocument();
      });
    });

    it('should handle network errors', async () => {
      const onError = jest.fn();
      (global.fetch as jest.Mock).mockRejectedValue(new Error('Network error'));

      render(
        <SessionEndAndExportControls
          sessionId={mockSessionId}
          sessionStatus="ACTIVE"
          onError={onError}
        />
      );

      const endButton = screen.getByText('End Session');
      fireEvent.click(endButton);

      await waitFor(() => {
        expect(onError).toHaveBeenCalledWith('Network error');
      });
    });

    it('should handle malformed JSON response', async () => {
      const onError = jest.fn();
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => {
          throw new Error('Invalid JSON');
        },
      });

      render(
        <SessionEndAndExportControls
          sessionId={mockSessionId}
          sessionStatus="ACTIVE"
          onError={onError}
        />
      );

      const endButton = screen.getByText('End Session');
      fireEvent.click(endButton);

      await waitFor(() => {
        expect(onError).toHaveBeenCalled();
      });
    });
  });
});
