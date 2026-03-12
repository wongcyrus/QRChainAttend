import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { InvocationContext } from '@azure/functions';

jest.mock('../../utils/captureStorage');
jest.mock('../../utils/blobStorage');
jest.mock('../../utils/signalrBroadcast');
jest.mock('../../utils/errorLogging');
jest.mock('../../utils/auth', () => ({
  parseAuthFromRequest: jest.fn(),
  hasRole: jest.fn(),
  getUserId: jest.fn()
}));

import { notifyImageUpload } from '../../functions/notifyImageUpload';
import { getCaptureRequest, updateCaptureRequest, createCaptureUpload } from '../../utils/captureStorage';
import { verifyBlobExists } from '../../utils/blobStorage';
import { broadcastToHub } from '../../utils/signalrBroadcast';
import { parseAuthFromRequest, hasRole, getUserId } from '../../utils/auth';

function createMockContext(): InvocationContext {
  const logs: string[] = [];
  return {
    log: (...args: any[]) => logs.push(args.join(' ')),
    error: (...args: any[]) => logs.push(`ERROR: ${args.join(' ')}`),
    warn: (...args: any[]) => logs.push(`WARN: ${args.join(' ')}`),
    info: (...args: any[]) => logs.push(`INFO: ${args.join(' ')}`),
    debug: (...args: any[]) => logs.push(`DEBUG: ${args.join(' ')}`),
    trace: (...args: any[]) => logs.push(`TRACE: ${args.join(' ')}`),
    invocationId: 'test-invocation-id',
    functionName: 'notifyImageUpload',
    extraInputs: { get: () => undefined },
    extraOutputs: { set: () => {} },
    retryContext: null,
    traceContext: null,
    triggerMetadata: {}
  } as any;
}

function createMockRequest(
  params: Record<string, string>,
  body: unknown,
  headers?: Record<string, string>
) {
  return {
    method: 'POST',
    url: 'http://localhost/api/test',
    params,
    headers: headers || {},
    query: new URLSearchParams(),
    json: async () => body,
    text: async () => JSON.stringify(body)
  } as any;
}

describe('notifyImageUpload', () => {
  const sessionId = 'session-123';
  const captureRequestId = 'capture-456';

  beforeEach(() => {
    jest.clearAllMocks();

    (parseAuthFromRequest as any).mockReturnValue({ userDetails: 'Student1@Test.com', userId: 'Student1@Test.com' });
    (hasRole as any).mockReturnValue(true);
    (getUserId as any).mockReturnValue('Student1@Test.com');
    (getCaptureRequest as any).mockResolvedValue({
      sessionId,
      expiresAt: new Date(Date.now() + 60000).toISOString(),
      uploadedCount: 0,
      onlineStudentCount: 2
    });
    (verifyBlobExists as any).mockResolvedValue(true);
    (createCaptureUpload as any).mockResolvedValue(undefined);
    (updateCaptureRequest as any).mockResolvedValue({
      uploadedCount: 1,
      onlineStudentCount: 2
    });
    (broadcastToHub as any).mockResolvedValue(undefined);
  });

  it('stores the upload under the attendee ID from blobName', async () => {
    const blobName = `${sessionId}/${captureRequestId}/student1@test.com.jpg`;
    const request = createMockRequest(
      { sessionId, captureRequestId },
      { blobName }
    );

    const response = await notifyImageUpload(request, createMockContext());

    expect(response.status).toBe(200);
    expect(createCaptureUpload).toHaveBeenCalledWith(
      expect.objectContaining({
        partitionKey: captureRequestId,
        rowKey: 'student1@test.com',
        blobName
      })
    );
    expect(broadcastToHub).toHaveBeenCalledWith(
      sessionId,
      'uploadComplete',
      expect.objectContaining({ attendeeId: 'student1@test.com' }),
      expect.anything()
    );
  });

  it('rejects uploads when blob attendee does not match authenticated attendee', async () => {
    const request = createMockRequest(
      { sessionId, captureRequestId },
      { blobName: `${sessionId}/${captureRequestId}/student2@test.com.jpg` }
    );

    const response = await notifyImageUpload(request, createMockContext());

    expect(response.status).toBe(403);
    expect(createCaptureUpload).not.toHaveBeenCalled();
  });
});