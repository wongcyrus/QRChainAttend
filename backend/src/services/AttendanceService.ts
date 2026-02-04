/**
 * Attendance Computation Service
 * Feature: qr-chain-attendance
 * Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7, 12.1
 * 
 * Manages attendance records and computes final status based on entry/exit verification
 */

import { getTableClient, TableName } from "../storage";
import {
  AttendanceRecord,
  AttendanceEntity,
  EntryStatus,
  FinalStatus
} from "../types";
import { signalRService, SignalRMessage } from "./SignalRService";

/**
 * Result of attendance operations that includes SignalR message
 */
export interface AttendanceOperationResult {
  record: AttendanceRecord;
  signalRMessage: SignalRMessage;
}

/**
 * AttendanceService class
 * Provides operations for marking attendance status and computing final status
 */
export class AttendanceService {
  private _tableClient: ReturnType<typeof getTableClient> | null = null;

  private get tableClient() {
    if (!this._tableClient) {
      this._tableClient = getTableClient(TableName.ATTENDANCE);
    }
    return this._tableClient;
  }

  /**
   * Mark student with entry status
   * Requirements: 3.3, 4.3, 12.1
   * 
   * @param sessionId - Session identifier
   * @param studentId - Student identifier
   * @param status - Entry status (PRESENT_ENTRY or LATE_ENTRY)
   * @returns Attendance record and SignalR message for broadcasting
   */
  async markEntry(
    sessionId: string,
    studentId: string,
    status: EntryStatus
  ): Promise<AttendanceOperationResult> {
    const now = Math.floor(Date.now() / 1000);
    
    try {
      // Try to get existing attendance record
      const existing = await this.tableClient.getEntity<AttendanceEntity>(
        sessionId,
        studentId
      );
      
      // Update existing record with entry status
      const updatedEntity: AttendanceEntity = {
        ...existing,
        entryStatus: status,
        entryAt: now
      };
      
      await this.tableClient.updateEntity(updatedEntity, "Merge");
      
      const record = this.entityToRecord(updatedEntity);
      
      // Create SignalR message for broadcasting
      const signalRMessage = signalRService.broadcastAttendanceUpdate(sessionId, {
        studentId,
        entryStatus: status
      });
      
      return { record, signalRMessage };
    } catch (error: any) {
      // If record doesn't exist, create new one
      if (error.statusCode === 404) {
        const newEntity: AttendanceEntity = {
          partitionKey: sessionId,
          rowKey: studentId,
          entryStatus: status,
          entryAt: now,
          exitVerified: false
        };
        
        await this.tableClient.createEntity(newEntity);
        
        const record = this.entityToRecord(newEntity);
        
        // Create SignalR message for broadcasting
        const signalRMessage = signalRService.broadcastAttendanceUpdate(sessionId, {
          studentId,
          entryStatus: status
        });
        
        return { record, signalRMessage };
      }
      throw error;
    }
  }

  /**
   * Mark student exit verified
   * Requirements: 6.3, 12.1
   * 
   * @param sessionId - Session identifier
   * @param studentId - Student identifier
   * @returns Attendance record and SignalR message for broadcasting
   */
  async markExitVerified(
    sessionId: string,
    studentId: string
  ): Promise<AttendanceOperationResult> {
    const now = Math.floor(Date.now() / 1000);
    
    try {
      // Get existing attendance record
      const existing = await this.tableClient.getEntity<AttendanceEntity>(
        sessionId,
        studentId
      );
      
      // Update with exit verification
      const updatedEntity: AttendanceEntity = {
        ...existing,
        exitVerified: true,
        exitVerifiedAt: now
      };
      
      await this.tableClient.updateEntity(updatedEntity, "Merge");
      
      const record = this.entityToRecord(updatedEntity);
      
      // Create SignalR message for broadcasting
      const signalRMessage = signalRService.broadcastAttendanceUpdate(sessionId, {
        studentId,
        exitVerified: true
      });
      
      return { record, signalRMessage };
    } catch (error: any) {
      // If record doesn't exist, create new one with only exit verified
      if (error.statusCode === 404) {
        const newEntity: AttendanceEntity = {
          partitionKey: sessionId,
          rowKey: studentId,
          exitVerified: true,
          exitVerifiedAt: now
        };
        
        await this.tableClient.createEntity(newEntity);
        
        const record = this.entityToRecord(newEntity);
        
        // Create SignalR message for broadcasting
        const signalRMessage = signalRService.broadcastAttendanceUpdate(sessionId, {
          studentId,
          exitVerified: true
        });
        
        return { record, signalRMessage };
      }
      throw error;
    }
  }

  /**
   * Mark student early leave
   * Requirements: 5.3, 5.4, 12.1
   * 
   * @param sessionId - Session identifier
   * @param studentId - Student identifier
   * @returns Attendance record and SignalR message for broadcasting
   */
  async markEarlyLeave(
    sessionId: string,
    studentId: string
  ): Promise<AttendanceOperationResult> {
    const now = Math.floor(Date.now() / 1000);
    
    try {
      // Get existing attendance record
      const existing = await this.tableClient.getEntity<AttendanceEntity>(
        sessionId,
        studentId
      );
      
      // Update with early leave timestamp
      const updatedEntity: AttendanceEntity = {
        ...existing,
        earlyLeaveAt: now
      };
      
      await this.tableClient.updateEntity(updatedEntity, "Merge");
      
      const record = this.entityToRecord(updatedEntity);
      
      // Create SignalR message for broadcasting
      const signalRMessage = signalRService.broadcastAttendanceUpdate(sessionId, {
        studentId,
        earlyLeaveAt: now
      });
      
      return { record, signalRMessage };
    } catch (error: any) {
      // If record doesn't exist, create new one with only early leave
      if (error.statusCode === 404) {
        const newEntity: AttendanceEntity = {
          partitionKey: sessionId,
          rowKey: studentId,
          exitVerified: false,
          earlyLeaveAt: now
        };
        
        await this.tableClient.createEntity(newEntity);
        
        const record = this.entityToRecord(newEntity);
        
        // Create SignalR message for broadcasting
        const signalRMessage = signalRService.broadcastAttendanceUpdate(sessionId, {
          studentId,
          earlyLeaveAt: now
        });
        
        return { record, signalRMessage };
      }
      throw error;
    }
  }

  /**
   * Compute final status for a single attendance record
   * Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6
   * 
   * Decision tree:
   * - If earlyLeaveAt exists → EARLY_LEAVE
   * - Else if PRESENT_ENTRY + exitVerified → PRESENT
   * - Else if PRESENT_ENTRY + !exitVerified → LEFT_EARLY
   * - Else if LATE_ENTRY + exitVerified → LATE
   * - Else if LATE_ENTRY + !exitVerified → LEFT_EARLY
   * - Else → ABSENT
   * 
   * @param record - Attendance record
   * @returns Final status
   */
  private computeFinalStatusForRecord(record: AttendanceEntity): FinalStatus {
    // Priority 1: Early leave takes precedence over everything
    if (record.earlyLeaveAt !== undefined) {
      return FinalStatus.EARLY_LEAVE;
    }
    
    // Priority 2: Check entry status and exit verification
    if (record.entryStatus === EntryStatus.PRESENT_ENTRY) {
      if (record.exitVerified) {
        return FinalStatus.PRESENT;
      } else {
        return FinalStatus.LEFT_EARLY;
      }
    }
    
    if (record.entryStatus === EntryStatus.LATE_ENTRY) {
      if (record.exitVerified) {
        return FinalStatus.LATE;
      } else {
        return FinalStatus.LEFT_EARLY;
      }
    }
    
    // No entry status → ABSENT
    return FinalStatus.ABSENT;
  }

  /**
   * Compute final status for all students in a session
   * Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7
   * 
   * This method is called when a teacher ends a session.
   * It updates all attendance records with their final status.
   * 
   * @param sessionId - Session identifier
   * @returns Array of attendance records with final status
   */
  async computeFinalStatus(sessionId: string): Promise<AttendanceRecord[]> {
    // Query all attendance records for the session
    const entities = this.tableClient.listEntities<AttendanceEntity>({
      queryOptions: {
        filter: `PartitionKey eq '${sessionId}'`
      }
    });
    
    const results: AttendanceRecord[] = [];
    
    // Process each attendance record
    for await (const entity of entities) {
      // Compute final status
      const finalStatus = this.computeFinalStatusForRecord(entity);
      
      // Update entity with final status
      const updatedEntity: AttendanceEntity = {
        ...entity,
        finalStatus
      };
      
      await this.tableClient.updateEntity(updatedEntity, "Merge");
      
      results.push(this.entityToRecord(updatedEntity));
    }
    
    return results;
  }

  /**
   * Get attendance record for a specific student
   * 
   * @param sessionId - Session identifier
   * @param studentId - Student identifier
   * @returns Attendance record or null if not found
   */
  async getAttendance(
    sessionId: string,
    studentId: string
  ): Promise<AttendanceRecord | null> {
    try {
      const entity = await this.tableClient.getEntity<AttendanceEntity>(
        sessionId,
        studentId
      );
      return this.entityToRecord(entity);
    } catch (error: any) {
      if (error.statusCode === 404) {
        return null;
      }
      throw error;
    }
  }

  /**
   * Get all attendance records for a session
   * 
   * @param sessionId - Session identifier
   * @returns Array of attendance records
   */
  async getAllAttendance(sessionId: string): Promise<AttendanceRecord[]> {
    const entities = this.tableClient.listEntities<AttendanceEntity>({
      queryOptions: {
        filter: `PartitionKey eq '${sessionId}'`
      }
    });
    
    const results: AttendanceRecord[] = [];
    
    for await (const entity of entities) {
      results.push(this.entityToRecord(entity));
    }
    
    return results;
  }

  /**
   * Convert AttendanceEntity to AttendanceRecord
   * 
   * @param entity - Attendance entity from storage
   * @returns Attendance record object
   */
  private entityToRecord(entity: AttendanceEntity): AttendanceRecord {
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
export const attendanceService = new AttendanceService();
