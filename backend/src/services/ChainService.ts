/**
 * Chain Orchestration Service
 * Feature: qr-chain-attendance
 * Requirements: 3.1, 3.3, 3.4, 3.6, 6.1, 6.2, 6.3, 6.4, 11.1, 11.2, 11.3, 11.5, 12.2, 12.3
 * 
 * Manages entry and exit chain state, holder selection, and baton transfers
 */

import { randomBytes } from "crypto";
import { getTableClient, TableName } from "../storage";
import { tokenService } from "./TokenService";
import { attendanceService } from "./AttendanceService";
import { signalRService, SignalRMessage } from "./SignalRService";
import {
  ChainPhase,
  ChainState,
  TokenType,
  EntryStatus,
  Chain,
  ChainEntity,
  ChainScanParams,
  ChainScanResult
} from "../types";

/**
 * ChainService class
 * Provides operations for chain lifecycle management
 */
export class ChainService {
  private tableClient = getTableClient(TableName.CHAINS);

  /**
   * Seed initial chains by selecting random students
   * Requirements: 3.1, 6.1, 6.2
   * 
   * For ENTRY phase: Selects from all joined students
   * For EXIT phase: Selects only students with PRESENT_ENTRY or LATE_ENTRY who didn't early-leave
   * 
   * @param sessionId - Session identifier
   * @param phase - Chain phase (ENTRY or EXIT)
   * @param count - Number of chains to create
   * @returns Array of created chains
   */
  async seedChains(
    sessionId: string,
    phase: ChainPhase,
    count: number
  ): Promise<Chain[]> {
    // Get eligible students
    const eligibleStudents = await this.getEligibleStudents(sessionId, phase);
    
    if (eligibleStudents.length < count) {
      throw new Error(
        `Insufficient eligible students: requested ${count}, available ${eligibleStudents.length}`
      );
    }
    
    // Randomly select K students
    const selectedStudents = this.randomSelect(eligibleStudents, count);
    
    // Create chains
    const chains: Chain[] = [];
    const now = Math.floor(Date.now() / 1000);
    
    for (const studentId of selectedStudents) {
      const chainId = this.generateChainId();
      
      // Create chain record
      const chain: Chain = {
        sessionId,
        phase,
        chainId,
        index: 0,
        state: ChainState.ACTIVE,
        lastHolder: studentId,
        lastSeq: 0,
        lastAt: now
      };
      
      // Store chain in table
      const entity: ChainEntity = {
        partitionKey: sessionId,
        rowKey: chainId,
        phase,
        index: 0,
        state: ChainState.ACTIVE,
        lastHolder: studentId,
        lastSeq: 0,
        lastAt: now,
        createdAt: now
      };
      
      await this.tableClient.createEntity(entity);
      
      // Issue chain token to student
      const tokenType = phase === ChainPhase.ENTRY ? TokenType.CHAIN : TokenType.EXIT_CHAIN;
      await tokenService.createToken({
        sessionId,
        type: tokenType,
        chainId,
        issuedTo: studentId,
        seq: 0,
        ttlSeconds: 20, // Chain tokens expire in 20 seconds
        singleUse: true
      });
      
      chains.push(chain);
    }
    
    return chains;
  }

  /**
   * Process a chain scan (validate, mark holder, transfer baton)
   * Requirements: 3.3, 3.4, 3.6, 6.3, 6.4, 12.1, 12.2
   * 
   * Steps:
   * 1. Consume token via TokenService (atomic ETag check)
   * 2. If successful, mark holder with attendance status
   * 3. If ownerTransfer=true, create new token for scanner with seq+1
   * 4. Update Chain record with new lastHolder, lastSeq, lastAt
   * 5. Broadcast SignalR updates for attendance and chain status
   * 
   * @param params - Chain scan parameters
   * @returns Chain scan result with SignalR messages
   */
  async processChainScan(params: ChainScanParams): Promise<ChainScanResult> {
    // Step 1: Consume token (atomic ETag check)
    const consumeResult = await tokenService.consumeToken(
      params.tokenId,
      params.sessionId,
      params.etag
    );
    
    if (!consumeResult.success) {
      return {
        success: false,
        error: consumeResult.error
      };
    }
    
    const token = consumeResult.token!;
    
    // Validate token has required fields
    if (!token.chainId || !token.issuedTo) {
      return {
        success: false,
        error: "INVALID_TOKEN"
      };
    }
    
    const holderId = token.issuedTo;
    const chainId = token.chainId;
    const currentSeq = token.seq || 0;
    
    // Array to collect SignalR messages
    const signalRMessages: SignalRMessage[] = [];
    
    // Step 2: Mark holder with attendance status
    if (token.type === TokenType.CHAIN) {
      // Entry chain: mark holder as PRESENT_ENTRY
      const result = await attendanceService.markEntry(
        params.sessionId,
        holderId,
        EntryStatus.PRESENT_ENTRY
      );
      signalRMessages.push(result.signalRMessage);
    } else if (token.type === TokenType.EXIT_CHAIN) {
      // Exit chain: mark holder as exit verified
      const result = await attendanceService.markExitVerified(
        params.sessionId,
        holderId
      );
      signalRMessages.push(result.signalRMessage);
    }
    
    // Step 3: Transfer baton to scanner (if ownerTransfer enabled)
    // For now, we'll always transfer (ownerTransfer=true is default)
    const newSeq = currentSeq + 1;
    const now = Math.floor(Date.now() / 1000);
    
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const newToken = await tokenService.createToken({
      sessionId: params.sessionId,
      type: token.type,
      chainId,
      issuedTo: params.scannerId,
      seq: newSeq,
      ttlSeconds: 20,
      singleUse: true
    });
    
    // Step 4: Update Chain record
    try {
      const chainEntity = await this.tableClient.getEntity<ChainEntity>(
        params.sessionId,
        chainId
      );
      
      const updatedChain: ChainEntity = {
        ...chainEntity,
        lastHolder: params.scannerId,
        lastSeq: newSeq,
        lastAt: now
      };
      
      await this.tableClient.updateEntity(updatedChain, "Merge");
      
      // Step 5: Broadcast chain update
      const chainPhase = token.type === TokenType.CHAIN ? ChainPhase.ENTRY : ChainPhase.EXIT;
      const chainUpdateMessage = signalRService.broadcastChainUpdate(params.sessionId, {
        chainId,
        phase: chainPhase,
        lastHolder: params.scannerId,
        lastSeq: newSeq,
        state: ChainState.ACTIVE
      });
      signalRMessages.push(chainUpdateMessage);
    } catch (error: any) {
      // If chain doesn't exist, log error but don't fail the scan
      console.error(`Chain ${chainId} not found, but scan succeeded`);
    }
    
    return {
      success: true,
      holderMarked: holderId,
      newHolder: params.scannerId,
      signalRMessages
    };
  }

  /**
   * Detect stalled chains (idle > 90 seconds)
   * Requirements: 11.1, 11.2, 12.3
   * 
   * @param sessionId - Session identifier
   * @param phase - Chain phase to check
   * @returns Object with stalled chains and SignalR message
   */
  async detectStalledChains(
    sessionId: string,
    phase: ChainPhase
  ): Promise<{ chains: Chain[]; signalRMessage?: SignalRMessage }> {
    const now = Math.floor(Date.now() / 1000);
    const stallThreshold = 90; // seconds
    
    // Query all active chains for the session and phase
    const entities = this.tableClient.listEntities<ChainEntity>({
      queryOptions: {
        filter: `PartitionKey eq '${sessionId}'`
      }
    });
    
    const stalledChains: Chain[] = [];
    
    for await (const entity of entities) {
      // Filter by phase and state
      if (entity.phase !== phase || entity.state !== ChainState.ACTIVE) {
        continue;
      }
      
      // Check if stalled (idle > 90s)
      if (entity.lastAt && (now - entity.lastAt) > stallThreshold) {
        // Mark as stalled
        const updatedEntity: ChainEntity = {
          ...entity,
          state: ChainState.STALLED
        };
        
        await this.tableClient.updateEntity(updatedEntity, "Merge");
        
        stalledChains.push(this.entityToChain(updatedEntity));
      }
    }
    
    // If stalled chains were detected, create SignalR message
    let signalRMessage: SignalRMessage | undefined;
    if (stalledChains.length > 0) {
      const chainIds = stalledChains.map(c => c.chainId);
      signalRMessage = signalRService.broadcastStallAlert(sessionId, chainIds);
    }
    
    return { chains: stalledChains, signalRMessage };
  }

  /**
   * Reseed stalled chains with new holders
   * Requirements: 11.3, 11.5
   * 
   * Creates new chains with incremented index
   * 
   * @param sessionId - Session identifier
   * @param phase - Chain phase
   * @param count - Number of chains to reseed
   * @returns Array of reseeded chains
   */
  async reseedChains(
    sessionId: string,
    phase: ChainPhase,
    count: number
  ): Promise<Chain[]> {
    // Get eligible students
    const eligibleStudents = await this.getEligibleStudents(sessionId, phase);
    
    if (eligibleStudents.length < count) {
      throw new Error(
        `Insufficient eligible students: requested ${count}, available ${eligibleStudents.length}`
      );
    }
    
    // Get current max index for this phase
    const maxIndex = await this.getMaxChainIndex(sessionId, phase);
    const newIndex = maxIndex + 1;
    
    // Randomly select K students
    const selectedStudents = this.randomSelect(eligibleStudents, count);
    
    // Create new chains
    const chains: Chain[] = [];
    const now = Math.floor(Date.now() / 1000);
    
    for (const studentId of selectedStudents) {
      const chainId = this.generateChainId();
      
      // Create chain record with incremented index
      const chain: Chain = {
        sessionId,
        phase,
        chainId,
        index: newIndex,
        state: ChainState.ACTIVE,
        lastHolder: studentId,
        lastSeq: 0,
        lastAt: now
      };
      
      // Store chain in table
      const entity: ChainEntity = {
        partitionKey: sessionId,
        rowKey: chainId,
        phase,
        index: newIndex,
        state: ChainState.ACTIVE,
        lastHolder: studentId,
        lastSeq: 0,
        lastAt: now,
        createdAt: now
      };
      
      await this.tableClient.createEntity(entity);
      
      // Issue chain token to student
      const tokenType = phase === ChainPhase.ENTRY ? TokenType.CHAIN : TokenType.EXIT_CHAIN;
      await tokenService.createToken({
        sessionId,
        type: tokenType,
        chainId,
        issuedTo: studentId,
        seq: 0,
        ttlSeconds: 20,
        singleUse: true
      });
      
      chains.push(chain);
    }
    
    return chains;
  }

  /**
   * Get all chains for a session
   * 
   * @param sessionId - Session identifier
   * @returns Array of chains
   */
  async getChains(sessionId: string): Promise<Chain[]> {
    const entities = this.tableClient.listEntities<ChainEntity>({
      queryOptions: {
        filter: `PartitionKey eq '${sessionId}'`
      }
    });
    
    const chains: Chain[] = [];
    
    for await (const entity of entities) {
      chains.push(this.entityToChain(entity));
    }
    
    return chains;
  }

  /**
   * Get eligible students for chain seeding
   * 
   * For ENTRY phase: All students who have joined (have attendance record)
   * For EXIT phase: Students with PRESENT_ENTRY or LATE_ENTRY who didn't early-leave
   * 
   * @param sessionId - Session identifier
   * @param phase - Chain phase
   * @returns Array of eligible student IDs
   */
  private async getEligibleStudents(
    sessionId: string,
    phase: ChainPhase
  ): Promise<string[]> {
    const attendanceRecords = await attendanceService.getAllAttendance(sessionId);
    
    if (phase === ChainPhase.ENTRY) {
      // For entry chains: all joined students
      return attendanceRecords.map(record => record.studentId);
    } else {
      // For exit chains: only students with entry status who didn't early-leave
      return attendanceRecords
        .filter(record => {
          const hasEntryStatus = 
            record.entryStatus === EntryStatus.PRESENT_ENTRY ||
            record.entryStatus === EntryStatus.LATE_ENTRY;
          const didNotEarlyLeave = !record.earlyLeaveAt;
          return hasEntryStatus && didNotEarlyLeave;
        })
        .map(record => record.studentId);
    }
  }

  /**
   * Randomly select K items from an array
   * Uses Fisher-Yates shuffle for unbiased selection
   * 
   * @param items - Array of items
   * @param count - Number of items to select
   * @returns Array of selected items
   */
  private randomSelect<T>(items: T[], count: number): T[] {
    const shuffled = [...items];
    
    // Fisher-Yates shuffle
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    
    return shuffled.slice(0, count);
  }

  /**
   * Get maximum chain index for a session and phase
   * 
   * @param sessionId - Session identifier
   * @param phase - Chain phase
   * @returns Maximum index (0 if no chains exist)
   */
  private async getMaxChainIndex(
    sessionId: string,
    phase: ChainPhase
  ): Promise<number> {
    const entities = this.tableClient.listEntities<ChainEntity>({
      queryOptions: {
        filter: `PartitionKey eq '${sessionId}'`
      }
    });
    
    let maxIndex = 0;
    
    for await (const entity of entities) {
      if (entity.phase === phase && entity.index > maxIndex) {
        maxIndex = entity.index;
      }
    }
    
    return maxIndex;
  }

  /**
   * Generate cryptographically random chainId
   * 
   * @returns Random chain identifier
   */
  private generateChainId(): string {
    // Generate 16 random bytes
    const bytes = randomBytes(16);
    
    // Encode as base64url (URL-safe, no padding)
    return bytes
      .toString("base64")
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=/g, "");
  }

  /**
   * Convert ChainEntity to Chain
   * 
   * @param entity - Chain entity from storage
   * @returns Chain object
   */
  private entityToChain(entity: ChainEntity): Chain {
    return {
      sessionId: entity.partitionKey,
      chainId: entity.rowKey,
      phase: entity.phase,
      index: entity.index,
      state: entity.state,
      lastHolder: entity.lastHolder,
      lastSeq: entity.lastSeq,
      lastAt: entity.lastAt
    };
  }
}

// Lazy-initialized singleton instance
let _chainService: ChainService | null = null;

export function getChainService(): ChainService {
  if (!_chainService) {
    _chainService = new ChainService();
  }
  return _chainService;
}

// For backward compatibility
export const chainService = new Proxy({} as ChainService, {
  get(target, prop) {
    return getChainService()[prop as keyof ChainService];
  }
});
