/**
 * StudentSessionView Component Tests
 * Feature: qr-chain-attendance
 * Requirements: 13.1, 13.2, 13.3, 13.5
 */

import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { StudentSessionView } from './StudentSessionView';
import type { Session, ChainScanResponse } from '@qr-attendance/shared';

// Mock the child components
jest.mock('./QRScanner', () => ({
  QRScanner: ({ onScanSuccess, onScanError, isActive }: any) => (
    <div data-testid="qr-scanner" data-active={isActive}>
      <button
        data-testid="mock-scan-success"
        onClick={() =>
          onScanSuccess?.({
            success: true,
            holderMarked: 'student-1',
            newHolder: 'student-123',
            newToken: btoa(
              JSON.stringify({
                type: 'CHAIN',
                sessionId: 'session-123',
                tokenId: 'token-456',
                etag: 'etag-789',
                holderId: 'student-123',
                exp: Math.floor(Date.now() / 1000) + 20,
              })
            ),
            newTokenEtag: 'etag-789',
          })
        }
      >
        Mock Scan Success
      </button>
      <button
        data-testid="mock-scan-error"
        onClick={() => onScanError?.('Scan failed')}
      >
        Mock Scan Error
      </button>
    </div>
  ),
}));

jest.mock('./QRDisplay', () => ({
  QRDisplay: ({ qrData, onExpire }: any) => (
    <div data-testid="qr-display">
      <div data-testid="qr-data">{JSON.stringify(qrData)}</div>
      <button data-testid="mock-expire" onClick={() => onExpire?.()}>
        Mock Expire
      </button>
    </div>
  ),
}));

// Mock fetch
global.fetch = jest.fn();

const mockSession: Session = {
  sessionId: 'session-123',
  classId: 'CS101',
  teacherId: 'teacher-1',
  startAt: new Date(Date.now() + 3600000).toISOString(), // 1 hour from now
  endAt: new Date(Date.now() + 7200000).toISOString(), // 2 hours from now
  lateCutoffMinutes: 15,
  exitWindowMinutes: 10,
  status: 'ACTIVE' as const,
  ownerTransfer: true,
  lateEntryActive: false,
  earlyLeaveActive: false,
  createdAt: new Date().toISOString(),
};

const mockAttendance = {
  attendance: [
    {
      sessionId: 'session-123',
      studentId: 'student-123',
      entryStatus: 'PRESENT_ENTRY',
      entryAt: Date.now() / 1000,
      exitVerified: false,
      earlyLeaveMarked: false,
    },
  ],
};

describe('StudentSessionView', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (global.fetch as jest.Mock).mockImplementation((url: string) => {
      if (url.includes('/api/sessions/session-123')) {
        if (url.includes('/attendance')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(mockAttendance),
          });
        }
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ session: mockSession }),
        });
      }
      return Promise.reject(new Error('Not found'));
    });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('Rendering', () => {
    test('should render loading state initially', () => {
      render(
        <StudentSessionView sessionId="session-123" studentId="student-123" />
      );

      expect(screen.getByText('Loading session...')).toBeInTheDocument();
    });

    test('should render session information after loading', async () => {
      render(
        <StudentSessionView sessionId="session-123" studentId="student-123" />
      );

      await waitFor(() => {
        expect(screen.getByText('Class Session')).toBeInTheDocument();
      });

      expect(screen.getByText('CS101')).toBeInTheDocument();
      expect(screen.getByText('ACTIVE')).toBeInTheDocument();
    });

    test('should render error when session not found', async () => {
      (global.fetch as jest.Mock).mockImplementation(() =>
        Promise.reject(new Error('Failed to fetch session'))
      );

      render(
        <StudentSessionView sessionId="session-123" studentId="student-123" />
      );

      await waitFor(
        () => {
          // The component shows "Session not found" when session is null after loading
          expect(screen.getByText(/Session not found/i)).toBeInTheDocument();
        },
        { timeout: 2000 }
      );
    });

    test('should render leave session button when callback provided', async () => {
      const onLeaveSession = jest.fn();

      render(
        <StudentSessionView
          sessionId="session-123"
          studentId="student-123"
          onLeaveSession={onLeaveSession}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Leave Session')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Leave Session'));
      expect(onLeaveSession).toHaveBeenCalledTimes(1);
    });
  });

  describe('Session Status', () => {
    test('should show "session not started" message for future sessions', async () => {
      render(
        <StudentSessionView sessionId="session-123" studentId="student-123" />
      );

      await waitFor(() => {
        expect(
          screen.getByText(/Session has not started yet/i)
        ).toBeInTheDocument();
      });
    });

    test('should show "session ended" message for past sessions', async () => {
      const pastSession = {
        ...mockSession,
        startAt: new Date(Date.now() - 7200000).toISOString(),
        endAt: new Date(Date.now() - 3600000).toISOString(),
      };

      (global.fetch as jest.Mock).mockImplementation((url: string) => {
        if (url.includes('/api/sessions/session-123')) {
          if (url.includes('/attendance')) {
            return Promise.resolve({
              ok: true,
              json: () => Promise.resolve(mockAttendance),
            });
          }
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ session: pastSession }),
          });
        }
        return Promise.reject(new Error('Not found'));
      });

      render(
        <StudentSessionView sessionId="session-123" studentId="student-123" />
      );

      await waitFor(() => {
        expect(
          screen.getByText(/Session has ended/i)
        ).toBeInTheDocument();
      });
    });

    test('should display student attendance status', async () => {
      render(
        <StudentSessionView sessionId="session-123" studentId="student-123" />
      );

      await waitFor(() => {
        expect(screen.getByText('Your Status')).toBeInTheDocument();
      });

      expect(screen.getByText('Present')).toBeInTheDocument();
    });

    test('should display late entry status', async () => {
      const lateAttendance = {
        attendance: [
          {
            ...mockAttendance.attendance[0],
            entryStatus: 'LATE_ENTRY',
          },
        ],
      };

      (global.fetch as jest.Mock).mockImplementation((url: string) => {
        if (url.includes('/attendance')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(lateAttendance),
          });
        }
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ session: mockSession }),
        });
      });

      render(
        <StudentSessionView sessionId="session-123" studentId="student-123" />
      );

      await waitFor(() => {
        expect(screen.getByText('Late')).toBeInTheDocument();
      });
    });

    test('should display exit verified status', async () => {
      const verifiedAttendance = {
        attendance: [
          {
            ...mockAttendance.attendance[0],
            exitVerified: true,
          },
        ],
      };

      (global.fetch as jest.Mock).mockImplementation((url: string) => {
        if (url.includes('/attendance')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(verifiedAttendance),
          });
        }
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ session: mockSession }),
        });
      });

      render(
        <StudentSessionView sessionId="session-123" studentId="student-123" />
      );

      await waitFor(() => {
        expect(screen.getByText('Verified')).toBeInTheDocument();
      });
    });
  });

  describe('QR Scanner Integration', () => {
    test('should show scan button during active session', async () => {
      const activeSession = {
        ...mockSession,
        startAt: new Date(Date.now() - 1800000).toISOString(), // 30 min ago
      };

      (global.fetch as jest.Mock).mockImplementation((url: string) => {
        if (url.includes('/api/sessions/session-123')) {
          if (url.includes('/attendance')) {
            return Promise.resolve({
              ok: true,
              json: () => Promise.resolve(mockAttendance),
            });
          }
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ session: activeSession }),
          });
        }
        return Promise.reject(new Error('Not found'));
      });

      render(
        <StudentSessionView sessionId="session-123" studentId="student-123" />
      );

      await waitFor(() => {
        expect(screen.getByText('📷 Open Scanner')).toBeInTheDocument();
      });
    });

    test('should toggle scanner when button clicked', async () => {
      const activeSession = {
        ...mockSession,
        startAt: new Date(Date.now() - 1800000).toISOString(),
      };

      (global.fetch as jest.Mock).mockImplementation((url: string) => {
        if (url.includes('/api/sessions/session-123')) {
          if (url.includes('/attendance')) {
            return Promise.resolve({
              ok: true,
              json: () => Promise.resolve(mockAttendance),
            });
          }
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ session: activeSession }),
          });
        }
        return Promise.reject(new Error('Not found'));
      });

      render(
        <StudentSessionView sessionId="session-123" studentId="student-123" />
      );

      await waitFor(() => {
        expect(screen.getByText('📷 Open Scanner')).toBeInTheDocument();
      });

      // Open scanner
      fireEvent.click(screen.getByText('📷 Open Scanner'));

      await waitFor(() => {
        expect(screen.getByText('Close Scanner')).toBeInTheDocument();
      });

      // Close scanner
      fireEvent.click(screen.getByText('Close Scanner'));

      await waitFor(() => {
        expect(screen.getByText('📷 Open Scanner')).toBeInTheDocument();
      });
    });

    test('should handle successful scan', async () => {
      const activeSession = {
        ...mockSession,
        startAt: new Date(Date.now() - 1800000).toISOString(),
      };

      (global.fetch as jest.Mock).mockImplementation((url: string) => {
        if (url.includes('/api/sessions/session-123')) {
          if (url.includes('/attendance')) {
            return Promise.resolve({
              ok: true,
              json: () => Promise.resolve(mockAttendance),
            });
          }
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ session: activeSession }),
          });
        }
        return Promise.reject(new Error('Not found'));
      });

      render(
        <StudentSessionView sessionId="session-123" studentId="student-123" />
      );

      await waitFor(() => {
        expect(screen.getByText('📷 Open Scanner')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('📷 Open Scanner'));

      await waitFor(() => {
        expect(screen.getByText('Close Scanner')).toBeInTheDocument();
      });

      // The mock scanner button should be available
      const scanButton = screen.getByTestId('mock-scan-success');
      fireEvent.click(scanButton);

      // Wait for either success message or holder message
      await waitFor(
        () => {
          const successMsg = screen.queryByText(/Scan successful/i);
          const holderMsg = screen.queryByText(/You are now the holder/i);
          expect(successMsg || holderMsg).toBeTruthy();
        },
        { timeout: 2000 }
      );
    });

    test('should handle scan error', async () => {
      const activeSession = {
        ...mockSession,
        startAt: new Date(Date.now() - 1800000).toISOString(),
      };

      (global.fetch as jest.Mock).mockImplementation((url: string) => {
        if (url.includes('/api/sessions/session-123')) {
          if (url.includes('/attendance')) {
            return Promise.resolve({
              ok: true,
              json: () => Promise.resolve(mockAttendance),
            });
          }
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ session: activeSession }),
          });
        }
        return Promise.reject(new Error('Not found'));
      });

      render(
        <StudentSessionView sessionId="session-123" studentId="student-123" />
      );

      await waitFor(() => {
        expect(screen.getByText('📷 Open Scanner')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('📷 Open Scanner'));

      await waitFor(() => {
        expect(screen.getByTestId('mock-scan-error')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('mock-scan-error'));

      await waitFor(() => {
        expect(screen.getByText(/Scan failed/i)).toBeInTheDocument();
      });
    });
  });

  describe('QR Display Integration', () => {
    test('should display holder QR when student becomes holder', async () => {
      const activeSession = {
        ...mockSession,
        startAt: new Date(Date.now() - 1800000).toISOString(),
      };

      (global.fetch as jest.Mock).mockImplementation((url: string) => {
        if (url.includes('/api/sessions/session-123')) {
          if (url.includes('/attendance')) {
            return Promise.resolve({
              ok: true,
              json: () => Promise.resolve(mockAttendance),
            });
          }
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ session: activeSession }),
          });
        }
        return Promise.reject(new Error('Not found'));
      });

      render(
        <StudentSessionView sessionId="session-123" studentId="student-123" />
      );

      await waitFor(() => {
        expect(screen.getByText('📷 Open Scanner')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('📷 Open Scanner'));

      await waitFor(() => {
        expect(screen.getByTestId('mock-scan-success')).toBeInTheDocument();
      });

      // Simulate successful scan that makes student-123 the holder
      fireEvent.click(screen.getByTestId('mock-scan-success'));

      await waitFor(
        () => {
          expect(screen.getByText('You are the Holder!')).toBeInTheDocument();
        },
        { timeout: 3000 }
      );

      expect(screen.getByTestId('qr-display')).toBeInTheDocument();
    });

    test('should hide QR display when token expires', async () => {
      const activeSession = {
        ...mockSession,
        startAt: new Date(Date.now() - 1800000).toISOString(),
      };

      (global.fetch as jest.Mock).mockImplementation((url: string) => {
        if (url.includes('/api/sessions/session-123')) {
          if (url.includes('/attendance')) {
            return Promise.resolve({
              ok: true,
              json: () => Promise.resolve(mockAttendance),
            });
          }
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ session: activeSession }),
          });
        }
        return Promise.reject(new Error('Not found'));
      });

      render(
        <StudentSessionView sessionId="session-123" studentId="student-123" />
      );

      await waitFor(() => {
        expect(screen.getByText('📷 Open Scanner')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('📷 Open Scanner'));
      fireEvent.click(screen.getByTestId('mock-scan-success'));

      await waitFor(() => {
        expect(screen.getByTestId('qr-display')).toBeInTheDocument();
      });

      // Simulate token expiration
      fireEvent.click(screen.getByTestId('mock-expire'));

      await waitFor(() => {
        expect(screen.queryByTestId('qr-display')).not.toBeInTheDocument();
      });
    });
  });

  describe('Polling', () => {
    test('should poll for updates every 10 seconds', async () => {
      jest.useFakeTimers();

      render(
        <StudentSessionView sessionId="session-123" studentId="student-123" />
      );

      await waitFor(() => {
        expect(screen.getByText('Class Session')).toBeInTheDocument();
      });

      const initialCallCount = (global.fetch as jest.Mock).mock.calls.length;

      // Fast-forward 10 seconds
      jest.advanceTimersByTime(10000);

      await waitFor(() => {
        expect((global.fetch as jest.Mock).mock.calls.length).toBeGreaterThan(
          initialCallCount
        );
      });
    });

    test('should cleanup polling on unmount', async () => {
      jest.useFakeTimers();

      const { unmount } = render(
        <StudentSessionView sessionId="session-123" studentId="student-123" />
      );

      await waitFor(() => {
        expect(screen.getByText('Class Session')).toBeInTheDocument();
      });

      const callCountBeforeUnmount = (global.fetch as jest.Mock).mock.calls
        .length;

      unmount();

      // Fast-forward 10 seconds
      jest.advanceTimersByTime(10000);

      // Should not make additional calls after unmount
      expect((global.fetch as jest.Mock).mock.calls.length).toBe(
        callCountBeforeUnmount
      );
    });
  });

  describe('Instructions', () => {
    test('should show instructions when student has not marked entry', async () => {
      const noEntryAttendance = {
        attendance: [
          {
            sessionId: 'session-123',
            studentId: 'student-123',
            exitVerified: false,
            earlyLeaveMarked: false,
          },
        ],
      };

      const activeSession = {
        ...mockSession,
        startAt: new Date(Date.now() - 1800000).toISOString(),
      };

      (global.fetch as jest.Mock).mockImplementation((url: string) => {
        if (url.includes('/attendance')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(noEntryAttendance),
          });
        }
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ session: activeSession }),
        });
      });

      render(
        <StudentSessionView sessionId="session-123" studentId="student-123" />
      );

      await waitFor(() => {
        expect(screen.getByText('How to Mark Attendance')).toBeInTheDocument();
      });
    });

    test('should not show instructions when student has marked entry', async () => {
      const activeSession = {
        ...mockSession,
        startAt: new Date(Date.now() - 1800000).toISOString(),
      };

      (global.fetch as jest.Mock).mockImplementation((url: string) => {
        if (url.includes('/attendance')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(mockAttendance),
          });
        }
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ session: activeSession }),
        });
      });

      render(
        <StudentSessionView sessionId="session-123" studentId="student-123" />
      );

      await waitFor(() => {
        expect(screen.getByText('Class Session')).toBeInTheDocument();
      });

      expect(
        screen.queryByText('How to Mark Attendance')
      ).not.toBeInTheDocument();
    });
  });
});
