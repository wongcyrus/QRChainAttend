/**
 * Session Management Service
 * Feature: qr-chain-attendance
 * Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 16.1
 */

import { randomUUID } from 'crypto';
import { getTableClient, TableName } from '../storage';
import {
  Session,
  SessionEntity,
  SessionStatus,
  CreateSessionRequest,
  AttendanceRecord,
  AttendanceEntity,
  SessionQRData
} from '../types';
import { Cache, createCache } from '../utils/cache';

/**
 * SessionService handles session lifecycle management with caching
 * 
 * Caching Strategy:
 * - Session configuration cached for 60 seconds to reduce Table Storage queries
 * - Cache invalidated on updates (end session, late entry status, early leave status)
 * - Improves p95 latency for frequently accessed sessions (Requirement 16.1)
 */
export class SessionService {
  private sessionsTable = getTableClient(TableName.SESSIONS);
  private attendanceTable = getTableClient(TableName.ATTENDANCE);
  
  // Cache for session configuration (60 second TTL)
  private sessionCache: Cache<Session> = createCache<Session>({ defaultTTL: 60000 });

  /**
   * Create a new session
   * Requirements: 2.1, 2.2, 2.5
   * 
   * @param teacherId - ID of the teacher creating the session
   * @param request - Session creation parameters
   * @returns Created session with unique ID and QR code
   */
  async createSession(
    teacherId: string,
    request: CreateSessionRequest
  ): Promise<{ session: Session; sessionQR: string }> {
    // Validate required fields (Requirement 2.1)
    if (!request.classId || !request.startAt || !request.endAt || request.lateCutoffMinutes === undefined) {
      throw new Error('Missing required fields: classId, startAt, endAt, lateCutoffMinutes');
    }

    // Generate unique session ID
    const sessionId = randomUUID();

    // Initialize session with ACTIVE status (Requirement 2.2)
    const now = new Date().toISOString();
    const entity: SessionEntity = {
      partitionKey: 'SESSION',
      rowKey: sessionId,
      classId: request.classId,
      teacherId,
      startAt: request.startAt,
      endAt: request.endAt,
      lateCutoffMinutes: request.lateCutoffMinutes,
      exitWindowMinutes: request.exitWindowMinutes ?? 10,
      status: SessionStatus.ACTIVE,
      ownerTransfer: true, // Default to true
      constraints: request.constraints ? JSON.stringify(request.constraints) : undefined,
      lateEntryActive: false,
      earlyLeaveActive: false,
      createdAt: now
    };

    // Store session in Azure Table Storage
    await this.sessionsTable.createEntity(entity);

    // Generate Session QR code data (Requirement 2.5)
    const qrData: SessionQRData = {
      type: 'SESSION',
      sessionId,
      classId: request.classId
    };
    const sessionQR = Buffer.from(JSON.stringify(qrData)).toString('base64');

    // Convert entity to Session object
    const session = this.entityToSession(entity);

    return { session, sessionQR };
  }

  /**
   * Get session by ID with caching
   * 
   * Cache Strategy:
   * - Check cache first (60 second TTL)
   * - On cache miss, fetch from Table Storage and cache result
   * - Reduces Table Storage queries for frequently accessed sessions
   * 
   * @param sessionId - Session ID
   * @returns Session object or null if not found
   */
  async getSession(sessionId: string): Promise<Session | null> {
    // Check cache first
    const cached = this.sessionCache.get(sessionId);
    if (cached) {
      return cached;
    }
    
    // Cache miss - fetch from storage
    try {
      const entity = await this.sessionsTable.getEntity<SessionEntity>('SESSION', sessionId);
      const session = this.entityToSession(entity);
      
      // Cache the result
      this.sessionCache.set(sessionId, session);
      
      return session;
    } catch (error: any) {
      if (error.statusCode === 404) {
        return null;
      }
      throw error;
    }
  }

  /**
   * End a session and compute final attendance
   * Requirements: 2.3
   * 
   * Cache Strategy:
   * - Invalidate session cache on update
   * 
   * @param sessionId - Session ID
   * @param teacherId - ID of the teacher ending the session (for authorization)
   * @returns Final attendance records
   */
  async endSession(sessionId: string, teacherId: string): Promise<AttendanceRecord[]> {
    // Get session
    const session = await this.getSession(sessionId);
    if (!session) {
      throw new Error('Session not found');
    }

    // Verify teacher owns this session
    if (session.teacherId !== teacherId) {
      throw new Error('Unauthorized: You do not own this session');
    }

    // Verify session is not already ended
    if (session.status === SessionStatus.ENDED) {
      throw new Error('Session is already ended');
    }

    // Update session status to ENDED (Requirement 2.3)
    const now = new Date().toISOString();
    const entity: SessionEntity = {
      partitionKey: 'SESSION',
      rowKey: sessionId,
      classId: session.classId,
      teacherId: session.teacherId,
      startAt: session.startAt,
      endAt: session.endAt,
      lateCutoffMinutes: session.lateCutoffMinutes,
      exitWindowMinutes: session.exitWindowMinutes,
      status: SessionStatus.ENDED,
      ownerTransfer: session.ownerTransfer,
      constraints: session.constraints ? JSON.stringify(session.constraints) : undefined,
      lateEntryActive: false,
      earlyLeaveActive: false,
      createdAt: session.createdAt,
      endedAt: now
    };

    await this.sessionsTable.updateEntity(entity, 'Replace');
    
    // Invalidate cache
    this.sessionCache.delete(sessionId);

    // Get all attendance records for this session
    const attendanceEntities = this.attendanceTable.listEntities<AttendanceEntity>({
      queryOptions: { filter: `PartitionKey eq '${sessionId}'` }
    });

    const finalAttendance: AttendanceRecord[] = [];
    for await (const entity of attendanceEntities) {
      const record = this.entityToAttendanceRecord(entity);
      finalAttendance.push(record);
    }

    return finalAttendance;
  }

  /**
   * Update session to set late entry active flag and token
   * 
   * Cache Strategy:
   * - Invalidate session cache on update
   * 
   * @param sessionId - Session ID
   * @param active - Whether late entry is active
   * @param tokenId - Current late entry token ID (if active)
   */
  async updateLateEntryStatus(sessionId: string, active: boolean, tokenId?: string): Promise<void> {
    const session = await this.getSession(sessionId);
    if (!session) {
      throw new Error('Session not found');
    }

    const entity: SessionEntity = {
      partitionKey: 'SESSION',
      rowKey: sessionId,
      classId: session.classId,
      teacherId: session.teacherId,
      startAt: session.startAt,
      endAt: session.endAt,
      lateCutoffMinutes: session.lateCutoffMinutes,
      exitWindowMinutes: session.exitWindowMinutes,
      status: session.status,
      ownerTransfer: session.ownerTransfer,
      constraints: session.constraints ? JSON.stringify(session.constraints) : undefined,
      lateEntryActive: active,
      currentLateTokenId: tokenId,
      earlyLeaveActive: session.earlyLeaveActive,
      currentEarlyTokenId: session.currentEarlyTokenId,
      createdAt: session.createdAt,
      endedAt: session.endedAt
    };

    await this.sessionsTable.updateEntity(entity, 'Replace');
    
    // Invalidate cache
    this.sessionCache.delete(sessionId);
  }

  /**
   * Update session to set early leave active flag and token
   * 
   * Cache Strategy:
   * - Invalidate session cache on update
   * 
   * @param sessionId - Session ID
   * @param active - Whether early leave is active
   * @param tokenId - Current early leave token ID (if active)
   */
  async updateEarlyLeaveStatus(sessionId: string, active: boolean, tokenId?: string): Promise<void> {
    const session = await this.getSession(sessionId);
    if (!session) {
      throw new Error('Session not found');
    }

    const entity: SessionEntity = {
      partitionKey: 'SESSION',
      rowKey: sessionId,
      classId: session.classId,
      teacherId: session.teacherId,
      startAt: session.startAt,
      endAt: session.endAt,
      lateCutoffMinutes: session.lateCutoffMinutes,
      exitWindowMinutes: session.exitWindowMinutes,
      status: session.status,
      ownerTransfer: session.ownerTransfer,
      constraints: session.constraints ? JSON.stringify(session.constraints) : undefined,
      lateEntryActive: session.lateEntryActive,
      currentLateTokenId: session.currentLateTokenId,
      earlyLeaveActive: active,
      currentEarlyTokenId: tokenId,
      createdAt: session.createdAt,
      endedAt: session.endedAt
    };

    await this.sessionsTable.updateEntity(entity, 'Replace');
    
    // Invalidate cache
    this.sessionCache.delete(sessionId);
  }

  /**
   * Convert SessionEntity to Session object
   */
  private entityToSession(entity: SessionEntity): Session {
    return {
      sessionId: entity.rowKey,
      classId: entity.classId,
      teacherId: entity.teacherId,
      startAt: entity.startAt,
      endAt: entity.endAt,
      lateCutoffMinutes: entity.lateCutoffMinutes,
      exitWindowMinutes: entity.exitWindowMinutes,
      status: entity.status,
      ownerTransfer: entity.ownerTransfer,
      constraints: entity.constraints ? JSON.parse(entity.constraints) : undefined,
      lateEntryActive: entity.lateEntryActive,
      currentLateTokenId: entity.currentLateTokenId,
      earlyLeaveActive: entity.earlyLeaveActive,
      currentEarlyTokenId: entity.currentEarlyTokenId,
      createdAt: entity.createdAt,
      endedAt: entity.endedAt
    };
  }

  /**
   * Convert AttendanceEntity to AttendanceRecord object
   */
  private entityToAttendanceRecord(entity: AttendanceEntity): AttendanceRecord {
    return {
      sessionId: entity.partitionKey,
      studentId: entity.rowKey,
      entryStatus: entity.entryStatus,
      entryAt: entity.entryAt,
      exitVerified: entity.exitVerified,
      exitVerifiedAt: entity.exitVerifiedAt,
      earlyLeaveAt: entity.earlyLeaveAt,
      finalStatus: entity.finalStatus
    };
  }
}

// Export singleton instance
export const sessionService = new SessionService();
