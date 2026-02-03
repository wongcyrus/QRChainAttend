/**
 * Real-Time Notification Service
 * Feature: qr-chain-attendance
 * Requirements: 12.1, 12.2, 12.3, 12.6
 * 
 * Manages real-time push notifications to teacher dashboards via Azure SignalR Service
 */

import { getConfig } from "../config";
import {
  EntryStatus,
  ChainUpdate,
  ChainPhase,
  ChainState
} from "../types";

/**
 * Attendance Update for SignalR notifications
 * Requirements: 12.1
 */
export interface AttendanceUpdate {
  studentId: string;
  entryStatus?: EntryStatus;
  exitVerified?: boolean;
  earlyLeaveAt?: number;
}

/**
 * SignalRService class
 * Provides operations for broadcasting real-time updates to teacher dashboards
 * 
 * Note: This is a service class that prepares SignalR messages.
 * The actual SignalR output binding is configured in Azure Functions.
 */
export class SignalRService {
  private config = getConfig();

  /**
   * Broadcast attendance update to session dashboard
   * Requirements: 12.1
   * 
   * Sends a real-time update when a student's attendance status changes.
   * The message is sent to the SignalR group for the specific session.
   * 
   * @param sessionId - Session identifier
   * @param update - Attendance update data
   * @returns SignalR message object for Azure Functions output binding
   */
  broadcastAttendanceUpdate(
    sessionId: string,
    update: AttendanceUpdate
  ): SignalRMessage {
    return {
      target: "attendanceUpdate",
      arguments: [update],
      groupName: `session:${sessionId}`
    };
  }

  /**
   * Broadcast chain status update
   * Requirements: 12.2
   * 
   * Sends a real-time update when a chain scan occurs, showing the new holder
   * and current sequence number.
   * 
   * @param sessionId - Session identifier
   * @param update - Chain update data
   * @returns SignalR message object for Azure Functions output binding
   */
  broadcastChainUpdate(
    sessionId: string,
    update: ChainUpdate
  ): SignalRMessage {
    return {
      target: "chainUpdate",
      arguments: [update],
      groupName: `session:${sessionId}`
    };
  }

  /**
   * Broadcast stall alert
   * Requirements: 12.3
   * 
   * Sends a real-time alert when chains become stalled (idle > 90 seconds).
   * Teachers can use this to decide when to reseed chains.
   * 
   * @param sessionId - Session identifier
   * @param chainIds - Array of stalled chain identifiers
   * @returns SignalR message object for Azure Functions output binding
   */
  broadcastStallAlert(
    sessionId: string,
    chainIds: string[]
  ): SignalRMessage {
    return {
      target: "stallAlert",
      arguments: [{ chainIds }],
      groupName: `session:${sessionId}`
    };
  }

  /**
   * Get SignalR connection info for client negotiation
   * Requirements: 12.6
   * 
   * This method prepares the connection info request.
   * The actual negotiation is handled by Azure Functions SignalR input binding.
   * 
   * @param userId - User identifier (from Entra ID token)
   * @param sessionId - Session identifier (for group assignment)
   * @returns Connection info request object
   */
  getConnectionInfo(userId: string, sessionId: string): SignalRConnectionInfoRequest {
    return {
      userId,
      groupName: `session:${sessionId}`
    };
  }
}

/**
 * SignalR Message structure for Azure Functions output binding
 * 
 * This structure is used by Azure Functions to send messages via SignalR Service.
 * The output binding automatically handles the connection to SignalR.
 */
export interface SignalRMessage {
  target: string;           // SignalR method name on client
  arguments: any[];         // Arguments to pass to client method
  groupName: string;        // SignalR group to send message to
}

/**
 * SignalR Connection Info Request
 * 
 * Used for client negotiation with Azure SignalR Service.
 * The Azure Functions SignalR input binding uses this to generate connection info.
 */
export interface SignalRConnectionInfoRequest {
  userId: string;           // User identifier for connection
  groupName: string;        // Group to add user to
}

// Export singleton instance
export const signalRService = new SignalRService();
