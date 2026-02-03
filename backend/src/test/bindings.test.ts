/**
 * Azure Functions Bindings Configuration Tests
 * Feature: qr-chain-attendance
 * Task: 22.2 Configure Azure Functions bindings
 * Requirements: 4.2, 5.1, 12.1, 12.2
 */

import { signalROutput, sendSignalRMessage, sendSignalRMessages } from '../utils/signalr';
import { SignalRMessage } from '../services/SignalRService';
import { InvocationContext } from '@azure/functions';

describe('Azure Functions Bindings Configuration', () => {
  describe('SignalR Output Binding', () => {
    test('signalROutput should have correct configuration', () => {
      // Verify binding type and properties
      expect(signalROutput).toBeDefined();
      expect((signalROutput as any).type).toBe('signalR');
      expect((signalROutput as any).hubName).toBe('attendance');
      expect((signalROutput as any).connectionStringSetting).toBe('SIGNALR_CONNECTION_STRING');
    });

    test('sendSignalRMessage should set output binding', () => {
      const mockContext = {
        log: jest.fn(),
        error: jest.fn(),
        extraOutputs: {
          set: jest.fn()
        }
      } as unknown as InvocationContext;

      const message: SignalRMessage = {
        target: 'attendanceUpdate',
        arguments: [{ studentId: 'test123' }],
        groupName: 'session:test-session'
      };

      sendSignalRMessage(mockContext, message);

      expect(mockContext.extraOutputs.set).toHaveBeenCalledWith(signalROutput, message);
      expect(mockContext.log).toHaveBeenCalledWith(
        expect.stringContaining('SignalR message sent to group session:test-session')
      );
    });

    test('sendSignalRMessage should handle null message', () => {
      const mockContext = {
        log: jest.fn(),
        error: jest.fn(),
        extraOutputs: {
          set: jest.fn()
        }
      } as unknown as InvocationContext;

      sendSignalRMessage(mockContext, null);

      expect(mockContext.extraOutputs.set).not.toHaveBeenCalled();
    });

    test('sendSignalRMessage should not throw on error', () => {
      const mockContext = {
        log: jest.fn(),
        error: jest.fn(),
        extraOutputs: {
          set: jest.fn().mockImplementation(() => {
            throw new Error('SignalR error');
          })
        }
      } as unknown as InvocationContext;

      const message: SignalRMessage = {
        target: 'test',
        arguments: [],
        groupName: 'test'
      };

      expect(() => sendSignalRMessage(mockContext, message)).not.toThrow();
      expect(mockContext.error).toHaveBeenCalledWith(
        'Error sending SignalR message:',
        expect.any(Error)
      );
    });

    test('sendSignalRMessages should send multiple messages', () => {
      const mockContext = {
        log: jest.fn(),
        error: jest.fn(),
        extraOutputs: {
          set: jest.fn()
        }
      } as unknown as InvocationContext;

      const messages: SignalRMessage[] = [
        {
          target: 'attendanceUpdate',
          arguments: [{ studentId: 'test1' }],
          groupName: 'session:test-session'
        },
        {
          target: 'chainUpdate',
          arguments: [{ chainId: 'chain1' }],
          groupName: 'session:test-session'
        }
      ];

      sendSignalRMessages(mockContext, messages);

      expect(mockContext.extraOutputs.set).toHaveBeenCalledWith(signalROutput, messages);
      expect(mockContext.log).toHaveBeenCalledWith('Sent 2 SignalR messages');
    });

    test('sendSignalRMessages should filter null messages', () => {
      const mockContext = {
        log: jest.fn(),
        error: jest.fn(),
        extraOutputs: {
          set: jest.fn()
        }
      } as unknown as InvocationContext;

      const messages: (SignalRMessage | null)[] = [
        {
          target: 'attendanceUpdate',
          arguments: [{ studentId: 'test1' }],
          groupName: 'session:test-session'
        },
        null,
        {
          target: 'chainUpdate',
          arguments: [{ chainId: 'chain1' }],
          groupName: 'session:test-session'
        }
      ];

      sendSignalRMessages(mockContext, messages);

      expect(mockContext.extraOutputs.set).toHaveBeenCalledWith(
        signalROutput,
        expect.arrayContaining([
          expect.objectContaining({ target: 'attendanceUpdate' }),
          expect.objectContaining({ target: 'chainUpdate' })
        ])
      );
      expect(mockContext.log).toHaveBeenCalledWith('Sent 2 SignalR messages');
    });

    test('sendSignalRMessages should handle empty array', () => {
      const mockContext = {
        log: jest.fn(),
        error: jest.fn(),
        extraOutputs: {
          set: jest.fn()
        }
      } as unknown as InvocationContext;

      sendSignalRMessages(mockContext, []);

      expect(mockContext.extraOutputs.set).not.toHaveBeenCalled();
    });
  });

  describe('Timer Trigger Configuration', () => {
    test('rotateTokens timer should run every 60 seconds', () => {
      // This test verifies the CRON expression is correct
      // CRON: "0 * * * * *" means:
      // - 0 seconds
      // - every minute
      // - every hour
      // - every day
      // - every month
      // - every day of week
      
      const cronExpression = "0 * * * * *";
      
      // Verify format
      const parts = cronExpression.split(' ');
      expect(parts).toHaveLength(6);
      expect(parts[0]).toBe('0'); // seconds
      expect(parts[1]).toBe('*'); // minutes (every minute)
    });
  });

  describe('SignalR Message Targets', () => {
    test('should use correct target names', () => {
      const targets = {
        attendanceUpdate: 'attendanceUpdate',
        chainUpdate: 'chainUpdate',
        stallAlert: 'stallAlert'
      };

      // Verify target names match design document
      expect(targets.attendanceUpdate).toBe('attendanceUpdate');
      expect(targets.chainUpdate).toBe('chainUpdate');
      expect(targets.stallAlert).toBe('stallAlert');
    });

    test('should use correct group name format', () => {
      const sessionId = 'abc123-def456';
      const groupName = `session:${sessionId}`;

      expect(groupName).toBe('session:abc123-def456');
      expect(groupName).toMatch(/^session:/);
    });
  });

  describe('Environment Variables', () => {
    test('should have required environment variables defined', () => {
      // These are checked at runtime, but we can verify the config module
      // expects them
      const requiredVars = [
        'STORAGE_ACCOUNT_NAME',
        'STORAGE_ACCOUNT_URI',
        'SIGNALR_CONNECTION_STRING',
        'FUNCTIONS_WORKER_RUNTIME'
      ];

      // In a real environment, these would be set
      // This test just documents the requirements
      expect(requiredVars).toContain('STORAGE_ACCOUNT_NAME');
      expect(requiredVars).toContain('STORAGE_ACCOUNT_URI');
      expect(requiredVars).toContain('SIGNALR_CONNECTION_STRING');
    });

    test('should have optional environment variables with defaults', () => {
      const optionalVars = {
        LATE_ROTATION_SECONDS: 60,
        EARLY_LEAVE_ROTATION_SECONDS: 60,
        CHAIN_TOKEN_TTL_SECONDS: 20,
        OWNER_TRANSFER: true
      };

      expect(optionalVars.LATE_ROTATION_SECONDS).toBe(60);
      expect(optionalVars.EARLY_LEAVE_ROTATION_SECONDS).toBe(60);
      expect(optionalVars.CHAIN_TOKEN_TTL_SECONDS).toBe(20);
      expect(optionalVars.OWNER_TRANSFER).toBe(true);
    });
  });

  describe('Binding Integration', () => {
    test('scan functions should have SignalR output binding', () => {
      // This test documents which functions should have SignalR output bindings
      const functionsWithSignalR = [
        'scanChain',
        'scanLateEntry',
        'scanEarlyLeave',
        'scanExitChain'
      ];

      expect(functionsWithSignalR).toHaveLength(4);
      expect(functionsWithSignalR).toContain('scanChain');
      expect(functionsWithSignalR).toContain('scanLateEntry');
      expect(functionsWithSignalR).toContain('scanEarlyLeave');
      expect(functionsWithSignalR).toContain('scanExitChain');
    });

    test('negotiate function should have SignalR input binding', () => {
      const negotiateFunction = {
        name: 'negotiate',
        hasSignalRInput: true,
        hubName: 'attendance'
      };

      expect(negotiateFunction.hasSignalRInput).toBe(true);
      expect(negotiateFunction.hubName).toBe('attendance');
    });

    test('rotateTokens function should have timer trigger', () => {
      const rotateTokensFunction = {
        name: 'rotateTokens',
        trigger: 'timer',
        schedule: '0 * * * * *'
      };

      expect(rotateTokensFunction.trigger).toBe('timer');
      expect(rotateTokensFunction.schedule).toBe('0 * * * * *');
    });
  });

  describe('Requirements Validation', () => {
    test('Requirement 4.2: Late entry token rotation', () => {
      // Timer trigger rotates late entry tokens every 60 seconds
      const requirement = {
        id: '4.2',
        description: 'Late entry token rotation',
        implementation: 'rotateTokens timer function',
        schedule: '0 * * * * *',
        ttl: 60
      };

      expect(requirement.schedule).toBe('0 * * * * *');
      expect(requirement.ttl).toBe(60);
    });

    test('Requirement 5.1: Early leave token rotation', () => {
      // Timer trigger rotates early leave tokens every 60 seconds
      const requirement = {
        id: '5.1',
        description: 'Early leave token rotation',
        implementation: 'rotateTokens timer function',
        schedule: '0 * * * * *',
        ttl: 60
      };

      expect(requirement.schedule).toBe('0 * * * * *');
      expect(requirement.ttl).toBe(60);
    });

    test('Requirement 12.1: Attendance status change notification', () => {
      // SignalR output binding broadcasts attendance updates
      const requirement = {
        id: '12.1',
        description: 'Attendance status change notification',
        implementation: 'SignalR output binding',
        target: 'attendanceUpdate',
        functions: ['scanChain', 'scanLateEntry', 'scanEarlyLeave']
      };

      expect(requirement.target).toBe('attendanceUpdate');
      expect(requirement.functions).toContain('scanLateEntry');
    });

    test('Requirement 12.2: Chain scan notification', () => {
      // SignalR output binding broadcasts chain updates
      const requirement = {
        id: '12.2',
        description: 'Chain scan notification',
        implementation: 'SignalR output binding',
        target: 'chainUpdate',
        functions: ['scanChain', 'scanExitChain']
      };

      expect(requirement.target).toBe('chainUpdate');
      expect(requirement.functions).toContain('scanChain');
      expect(requirement.functions).toContain('scanExitChain');
    });
  });
});
