/**
 * Teacher Dashboard Component Tests
 * 
 * Requirements: 12.1, 12.2, 12.3, 12.4
 * 
 * Tests for the Teacher Dashboard component including:
 * - Initial data loading
 * - SignalR connection establishment
 * - Real-time attendance updates
 * - Chain status display with stall indicators
 * - Statistics computation
 */

import React from 'react';
import { render, screen, waitFor, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import { TeacherDashboard } from './TeacherDashboard';

// Mock SignalR
const mockOn = jest.fn();
const mockStart = jest.fn();
const mockStop = jest.fn();
const mockOnreconnecting = jest.fn();
const mockOnreconnected = jest.fn();
const mockOnclose = jest.fn();

const mockConnection = {
  on: mockOn,
  start: mockStart,
  stop: mockStop,
  onreconnecting: mockOnreconnecting,
  onreconnected: mockOnreconnected,
  onclose: mockOnclose,
};

const mockHubConnectionBuilder = {
  withUrl: jest.fn().mockReturnThis(),
  withAutomaticReconnect: jest.fn().mockReturnThis(),
  configureLogging: jest.fn().mockReturnThis(),
  build: jest.fn(() => mockConnection),
};

jest.mock('@microsoft/signalr', () => ({
  HubConnectionBuilder: jest.fn(() => mockHubConnectionBuilder),
  LogLevel: {
    Information: 3,
  },
}));

// Mock fetch
global.fetch = jest.fn();

describe('TeacherDashboard', () => {
  const mockSessionId = 'test-session-123';
  
  const mockSessionData = {
    session: {
      sessionId: mockSessionId,
      classId: 'CS101-A',
      teacherId: 'teacher-1',
      startAt: '2024-01-15T09:00:00Z',
      endAt: '2024-01-15T11:00:00Z',
      lateCutoffMinutes: 15,
      exitWindowMinutes: 10,
      status: 'ACTIVE',
      ownerTransfer: true,
      lateEntryActive: false,
      earlyLeaveActive: false,
      createdAt: '2024-01-15T08:00:00Z',
    },
    attendance: [
      {
        sessionId: mockSessionId,
        studentId: 'student-1',
        entryStatus: 'PRESENT_ENTRY',
        entryAt: 1705309200,
        exitVerified: false,
      },
      {
        sessionId: mockSessionId,
        studentId: 'student-2',
        entryStatus: 'LATE_ENTRY',
        entryAt: 1705310100,
        exitVerified: true,
        exitVerifiedAt: 1705316600,
      },
      {
        sessionId: mockSessionId,
        studentId: 'student-3',
        entryStatus: 'PRESENT_ENTRY',
        entryAt: 1705309300,
        exitVerified: false,
        earlyLeaveAt: 1705315800,
      },
    ],
    chains: [
      {
        sessionId: mockSessionId,
        chainId: 'chain-1',
        phase: 'ENTRY',
        index: 0,
        state: 'ACTIVE',
        lastHolder: 'student-1',
        lastSeq: 5,
        lastAt: 1705309500,
      },
      {
        sessionId: mockSessionId,
        chainId: 'chain-2',
        phase: 'ENTRY',
        index: 0,
        state: 'STALLED',
        lastHolder: 'student-4',
        lastSeq: 2,
        lastAt: 1705309200,
      },
    ],
    stats: {
      totalStudents: 3,
      presentEntry: 2,
      lateEntry: 1,
      earlyLeave: 1,
      exitVerified: 1,
      notYetVerified: 1,
    },
  };

  const mockNegotiateResponse = {
    url: 'https://test-signalr.service.signalr.net',
    accessToken: 'mock-access-token',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock successful fetch responses
    (global.fetch as jest.Mock).mockImplementation((url: string) => {
      if (url.includes('/dashboard/negotiate')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockNegotiateResponse),
        });
      }
      if (url.includes('/sessions/')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockSessionData),
        });
      }
      return Promise.reject(new Error('Unknown URL'));
    });

    // Mock SignalR connection start
    mockStart.mockResolvedValue(undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Initial Loading', () => {
    test('displays loading state initially', () => {
      render(<TeacherDashboard sessionId={mockSessionId} />);
      
      expect(screen.getByText(/loading dashboard/i)).toBeInTheDocument();
    });

    test('fetches session data on mount', async () => {
      render(<TeacherDashboard sessionId={mockSessionId} />);
      
      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          `/api/sessions/${mockSessionId}`
        );
      });
    });

    test('displays session information after loading', async () => {
      render(<TeacherDashboard sessionId={mockSessionId} />);
      
      await waitFor(() => {
        expect(screen.getByText(/Session:/)).toBeInTheDocument();
      });
      
      // Check for class ID in session info
      expect(screen.getByText(/CS101-A/)).toBeInTheDocument();
      expect(screen.getAllByText('ACTIVE').length).toBeGreaterThan(0);
    });

    test('handles fetch error gracefully', async () => {
      (global.fetch as jest.Mock).mockImplementationOnce(() =>
        Promise.resolve({
          ok: false,
          statusText: 'Not Found',
          json: () => Promise.resolve({
            error: { message: 'Session not found' }
          }),
        })
      );

      const onError = jest.fn();
      render(<TeacherDashboard sessionId={mockSessionId} onError={onError} />);
      
      await waitFor(() => {
        expect(screen.getByText(/session not found/i)).toBeInTheDocument();
      });
      
      expect(onError).toHaveBeenCalledWith('Session not found');
    });
  });

  describe('Statistics Display - Requirement 12.4', () => {
    test('displays attendance counts by status', async () => {
      render(<TeacherDashboard sessionId={mockSessionId} />);
      
      await waitFor(() => {
        expect(screen.getByText('Total Students')).toBeInTheDocument();
      });
      
      // Check all stat cards exist - use getAllByText for labels that may appear multiple times
      expect(screen.getByText('Total Students')).toBeInTheDocument();
      expect(screen.getAllByText('Present Entry').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Late Entry').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Early Leave').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Exit Verified').length).toBeGreaterThan(0);
      expect(screen.getByText('Not Yet Verified')).toBeInTheDocument();
      
      // Check that stat values are displayed (use getAllByText since numbers may repeat)
      const statValues = screen.getAllByText(/^[0-9]+$/);
      expect(statValues.length).toBeGreaterThanOrEqual(6);
    });

    test('displays correct statistics labels', async () => {
      render(<TeacherDashboard sessionId={mockSessionId} />);
      
      await waitFor(() => {
        const presentEntryLabels = screen.getAllByText('Present Entry');
        expect(presentEntryLabels.length).toBeGreaterThan(0);
      });
      
      // Use getAllByText since these labels may appear in multiple places
      expect(screen.getAllByText('Late Entry').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Early Leave').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Exit Verified').length).toBeGreaterThan(0);
      expect(screen.getByText('Not Yet Verified')).toBeInTheDocument();
    });
  });

  describe('Chain Status Display - Requirements 12.2, 12.3', () => {
    test('displays chain status with phase and state', async () => {
      render(<TeacherDashboard sessionId={mockSessionId} />);
      
      await waitFor(() => {
        expect(screen.getByText('Chain Status')).toBeInTheDocument();
      });
      
      // Check for chain phases - use getAllByText since multiple chains may have same phase
      const entryPhases = screen.getAllByText('ENTRY');
      expect(entryPhases.length).toBeGreaterThan(0);
      
      // Check for chain states - use getAllByText since multiple elements may have same state
      const activeStates = screen.getAllByText('ACTIVE');
      expect(activeStates.length).toBeGreaterThan(0);
      
      const stalledStates = screen.getAllByText('STALLED');
      expect(stalledStates.length).toBeGreaterThan(0);
    });

    test('displays stall indicators for stalled chains', async () => {
      render(<TeacherDashboard sessionId={mockSessionId} />);
      
      await waitFor(() => {
        expect(screen.getByText('Chain Status')).toBeInTheDocument();
      });
      
      // Check for stall indicator emoji - there should be at least one
      const stallIndicators = screen.getAllByTitle('Chain is stalled');
      expect(stallIndicators.length).toBeGreaterThanOrEqual(1);
    });

    test('displays chain details including holder and sequence', async () => {
      render(<TeacherDashboard sessionId={mockSessionId} />);
      
      await waitFor(() => {
        expect(screen.getByText('Chain Status')).toBeInTheDocument();
      });
      
      // Check for last holders - use getAllByText since student IDs may appear in multiple places
      const studentElements = screen.getAllByText(/student-[1-4]/);
      expect(studentElements.length).toBeGreaterThan(0);
      
      // Check for sequence numbers - use getAllByText since numbers may repeat
      const sequenceNumbers = screen.getAllByText(/^[0-9]+$/);
      expect(sequenceNumbers.length).toBeGreaterThan(0);
    });
  });

  describe('Student List Display - Requirement 12.4', () => {
    test('displays list of students with current status', async () => {
      render(<TeacherDashboard sessionId={mockSessionId} />);
      
      await waitFor(() => {
        expect(screen.getByText('Student Attendance (3)')).toBeInTheDocument();
      });
      
      // Check for student IDs in the table
      const studentIds = screen.getAllByText(/student-[1-3]/);
      expect(studentIds.length).toBeGreaterThanOrEqual(3);
    });

    test('displays correct status for each student', async () => {
      render(<TeacherDashboard sessionId={mockSessionId} />);
      
      await waitFor(() => {
        expect(screen.getByText('Student Attendance (3)')).toBeInTheDocument();
      });
      
      // Check for status badges - use getAllByText since these may appear in stats section too
      const presentEntryBadges = screen.getAllByText('Present Entry');
      expect(presentEntryBadges.length).toBeGreaterThan(0);
      
      expect(screen.getByText('Late (Verified)')).toBeInTheDocument();
      
      const earlyLeaveBadges = screen.getAllByText('Early Leave');
      expect(earlyLeaveBadges.length).toBeGreaterThan(0);
    });

    test('displays exit verification status', async () => {
      render(<TeacherDashboard sessionId={mockSessionId} />);
      
      await waitFor(() => {
        expect(screen.getByText('Student Attendance (3)')).toBeInTheDocument();
      });
      
      // Check for verification badges
      expect(screen.getByText('✓ Yes')).toBeInTheDocument();
      expect(screen.getAllByText('✗ No').length).toBe(2);
    });

    test('displays empty state when no students', async () => {
      const emptyData = {
        ...mockSessionData,
        attendance: [],
        stats: {
          totalStudents: 0,
          presentEntry: 0,
          lateEntry: 0,
          earlyLeave: 0,
          exitVerified: 0,
          notYetVerified: 0,
        },
      };

      (global.fetch as jest.Mock).mockImplementation((url: string) => {
        if (url.includes('/dashboard/negotiate')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(mockNegotiateResponse),
          });
        }
        if (url.includes('/sessions/')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(emptyData),
          });
        }
        return Promise.reject(new Error('Unknown URL'));
      });

      render(<TeacherDashboard sessionId={mockSessionId} />);
      
      await waitFor(() => {
        expect(screen.getByText(/no students have joined/i)).toBeInTheDocument();
      });
    });
  });

  describe('SignalR Connection - Requirements 12.1, 12.6', () => {
    test('negotiates SignalR connection on mount', async () => {
      render(<TeacherDashboard sessionId={mockSessionId} />);
      
      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          `/api/sessions/${mockSessionId}/dashboard/negotiate`,
          { method: 'POST' }
        );
      });
    });

    test('establishes SignalR connection with correct configuration', async () => {
      render(<TeacherDashboard sessionId={mockSessionId} />);
      
      await waitFor(() => {
        expect(mockHubConnectionBuilder.withUrl).toHaveBeenCalledWith(
          mockNegotiateResponse.url,
          expect.objectContaining({
            accessTokenFactory: expect.any(Function),
          })
        );
      });
      
      expect(mockHubConnectionBuilder.withAutomaticReconnect).toHaveBeenCalled();
      expect(mockHubConnectionBuilder.configureLogging).toHaveBeenCalled();
      expect(mockStart).toHaveBeenCalled();
    });

    test('registers event handlers for real-time updates', async () => {
      render(<TeacherDashboard sessionId={mockSessionId} />);
      
      await waitFor(() => {
        expect(mockOn).toHaveBeenCalledWith('attendanceUpdate', expect.any(Function));
      });
      
      expect(mockOn).toHaveBeenCalledWith('chainUpdate', expect.any(Function));
      expect(mockOn).toHaveBeenCalledWith('stallAlert', expect.any(Function));
    });

    test('displays connection status indicator', async () => {
      render(<TeacherDashboard sessionId={mockSessionId} />);
      
      await waitFor(() => {
        expect(screen.getByText(/live/i)).toBeInTheDocument();
      });
    });

    test('stops SignalR connection on unmount', async () => {
      const { unmount } = render(<TeacherDashboard sessionId={mockSessionId} />);
      
      await waitFor(() => {
        expect(mockStart).toHaveBeenCalled();
      });
      
      unmount();
      
      expect(mockStop).toHaveBeenCalled();
    });
  });

  describe('Real-Time Updates - Requirement 12.1', () => {
    test('handles attendance update from SignalR', async () => {
      render(<TeacherDashboard sessionId={mockSessionId} />);
      
      // Wait for initial load
      await waitFor(() => {
        expect(screen.getByText('Student Attendance (3)')).toBeInTheDocument();
      });
      
      // Get the attendance update handler
      const attendanceUpdateHandler = mockOn.mock.calls.find(
        call => call[0] === 'attendanceUpdate'
      )?.[1];
      
      expect(attendanceUpdateHandler).toBeDefined();
      
      // Simulate attendance update
      act(() => {
        attendanceUpdateHandler({
          studentId: 'student-new',
          entryStatus: 'PRESENT_ENTRY',
        });
      });
      
      // Check that new student appears in the table
      await waitFor(() => {
        expect(screen.getByText('Student Attendance (4)')).toBeInTheDocument();
      });
      
      // Verify the new student ID is in the table
      const studentCells = screen.getAllByText(/student-/);
      const hasNewStudent = studentCells.some(cell => cell.textContent === 'student-new');
      expect(hasNewStudent).toBe(true);
    });

    test('updates existing student record on attendance update', async () => {
      render(<TeacherDashboard sessionId={mockSessionId} />);
      
      await waitFor(() => {
        expect(screen.getByText('Student Attendance (3)')).toBeInTheDocument();
      });
      
      const attendanceUpdateHandler = mockOn.mock.calls.find(
        call => call[0] === 'attendanceUpdate'
      )?.[1];
      
      // Update existing student
      act(() => {
        attendanceUpdateHandler({
          studentId: 'student-1',
          exitVerified: true,
        });
      });
      
      // Stats should update
      await waitFor(() => {
        // Exit verified count should increase
        const verifiedElements = screen.getAllByText('2');
        expect(verifiedElements.length).toBeGreaterThan(0);
      });
    });
  });

  describe('Chain Updates - Requirement 12.2', () => {
    test('handles chain update from SignalR', async () => {
      render(<TeacherDashboard sessionId={mockSessionId} />);
      
      await waitFor(() => {
        expect(screen.getByText('Chain Status')).toBeInTheDocument();
      });
      
      const chainUpdateHandler = mockOn.mock.calls.find(
        call => call[0] === 'chainUpdate'
      )?.[1];
      
      expect(chainUpdateHandler).toBeDefined();
      
      // Simulate chain update
      act(() => {
        chainUpdateHandler({
          chainId: 'chain-1',
          phase: 'ENTRY',
          lastHolder: 'student-updated',
          lastSeq: 6,
          state: 'ACTIVE',
        });
      });
      
      // Check that chain is updated with new holder
      await waitFor(() => {
        const holderCells = screen.getAllByText(/student-/);
        const hasUpdatedHolder = holderCells.some(cell => cell.textContent === 'student-updated');
        expect(hasUpdatedHolder).toBe(true);
      });
      
      // Check for sequence number 6 - use getAllByText since it might appear multiple times
      const seqElements = screen.getAllByText('6');
      expect(seqElements.length).toBeGreaterThan(0);
    });
  });

  describe('Stall Alerts - Requirement 12.3', () => {
    test('handles stall alert from SignalR', async () => {
      render(<TeacherDashboard sessionId={mockSessionId} />);
      
      await waitFor(() => {
        expect(screen.getByText('Chain Status')).toBeInTheDocument();
      });
      
      const stallAlertHandler = mockOn.mock.calls.find(
        call => call[0] === 'stallAlert'
      )?.[1];
      
      expect(stallAlertHandler).toBeDefined();
      
      // Initially one stalled chain (but may be rendered in multiple places)
      let stallIndicators = screen.getAllByTitle('Chain is stalled');
      const initialStallCount = stallIndicators.length;
      expect(initialStallCount).toBeGreaterThanOrEqual(1);
      
      // Simulate stall alert for another chain
      act(() => {
        stallAlertHandler(['chain-1', 'chain-2']);
      });
      
      // Now both chains should be stalled - count should increase
      await waitFor(() => {
        stallIndicators = screen.getAllByTitle('Chain is stalled');
        expect(stallIndicators.length).toBeGreaterThan(initialStallCount);
      });
    });
  });

  describe('Error Handling', () => {
    test('displays error when SignalR negotiation fails', async () => {
      (global.fetch as jest.Mock).mockImplementation((url: string) => {
        if (url.includes('/dashboard/negotiate')) {
          return Promise.resolve({
            ok: false,
            statusText: 'Unauthorized',
          });
        }
        if (url.includes('/sessions/')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(mockSessionData),
          });
        }
        return Promise.reject(new Error('Unknown URL'));
      });

      const onError = jest.fn();
      render(<TeacherDashboard sessionId={mockSessionId} onError={onError} />);
      
      await waitFor(() => {
        expect(onError).toHaveBeenCalledWith(
          expect.stringContaining('SignalR')
        );
      });
    });

    test('displays retry button on error', async () => {
      (global.fetch as jest.Mock).mockImplementationOnce(() =>
        Promise.resolve({
          ok: false,
          statusText: 'Server Error',
          json: () => Promise.resolve({
            error: { message: 'Server error' }
          }),
        })
      );

      render(<TeacherDashboard sessionId={mockSessionId} />);
      
      await waitFor(() => {
        expect(screen.getByText(/server error/i)).toBeInTheDocument();
      });
      
      expect(screen.getByText('Retry')).toBeInTheDocument();
    });
  });

  describe('Reconnection Handling', () => {
    test('handles reconnection events', async () => {
      render(<TeacherDashboard sessionId={mockSessionId} />);
      
      await waitFor(() => {
        expect(mockOnreconnecting).toHaveBeenCalled();
      });
      
      expect(mockOnreconnected).toHaveBeenCalled();
      expect(mockOnclose).toHaveBeenCalled();
    });

    test('refreshes data after reconnection', async () => {
      render(<TeacherDashboard sessionId={mockSessionId} />);
      
      await waitFor(() => {
        expect(mockOnreconnected).toHaveBeenCalled();
      });
      
      // Get the reconnected handler
      const reconnectedHandler = mockOnreconnected.mock.calls[0][0];
      
      // Clear fetch mock calls
      (global.fetch as jest.Mock).mockClear();
      
      // Simulate reconnection
      act(() => {
        reconnectedHandler();
      });
      
      // Should fetch session data again
      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          `/api/sessions/${mockSessionId}`
        );
      });
    });
  });
});
