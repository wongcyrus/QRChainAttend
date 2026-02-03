/**
 * ValidationService
 * Feature: qr-chain-attendance
 * Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 10.1, 10.2, 10.4, 10.5
 * 
 * Implements anti-cheat validation including:
 * - Rate limiting (device and IP-based)
 * - Location validation (geofence and Wi-Fi allowlist)
 * - Scan audit logging
 */

import { TableClient } from "@azure/data-tables";
import {
  RateLimitResult,
  LocationValidationResult,
  ScanLogParams,
  ScanLogEntity,
  SessionConstraints,
  GpsCoordinates,
  ScanFlow,
  ScanResult
} from "../types";

/**
 * Rate limit counter entry
 */
interface RateLimitCounter {
  count: number;
  windowStart: number; // Unix timestamp in seconds
}

/**
 * ValidationService class
 * Provides rate limiting, location validation, and audit logging
 */
export class ValidationService {
  private deviceCounters: Map<string, RateLimitCounter> = new Map();
  private ipCounters: Map<string, RateLimitCounter> = new Map();
  private scanLogsClient: TableClient;

  // Rate limit thresholds
  private readonly DEVICE_LIMIT = 10;
  private readonly IP_LIMIT = 50;
  private readonly WINDOW_SECONDS = 60;

  constructor(scanLogsClient: TableClient) {
    this.scanLogsClient = scanLogsClient;
  }

  /**
   * Check rate limits for device and IP
   * Requirements: 10.1, 10.2, 10.5
   * 
   * Uses sliding window counters:
   * - Device: max 10 scans per 60 seconds
   * - IP: max 50 scans per 60 seconds
   * 
   * @param deviceFingerprint - Unique device identifier
   * @param ip - IP address of the request
   * @returns RateLimitResult indicating if request is allowed
   */
  checkRateLimit(deviceFingerprint: string, ip: string): RateLimitResult {
    const now = Math.floor(Date.now() / 1000); // Current time in seconds

    // Check device rate limit
    const deviceResult = this.checkCounter(
      this.deviceCounters,
      deviceFingerprint,
      now,
      this.DEVICE_LIMIT
    );
    if (!deviceResult.allowed) {
      return { allowed: false, reason: "DEVICE_LIMIT" };
    }

    // Check IP rate limit
    const ipResult = this.checkCounter(
      this.ipCounters,
      ip,
      now,
      this.IP_LIMIT
    );
    if (!ipResult.allowed) {
      return { allowed: false, reason: "IP_LIMIT" };
    }

    // Both checks passed, increment counters
    this.incrementCounter(this.deviceCounters, deviceFingerprint, now);
    this.incrementCounter(this.ipCounters, ip, now);

    return { allowed: true };
  }

  /**
   * Check a single rate limit counter
   * 
   * @param counters - Map of counters
   * @param key - Counter key (device or IP)
   * @param now - Current timestamp in seconds
   * @param limit - Maximum allowed count
   * @returns Result indicating if limit is exceeded
   */
  private checkCounter(
    counters: Map<string, RateLimitCounter>,
    key: string,
    now: number,
    limit: number
  ): { allowed: boolean } {
    const counter = counters.get(key);

    if (!counter) {
      // No counter exists, allow
      return { allowed: true };
    }

    // Check if window has expired
    if (now - counter.windowStart >= this.WINDOW_SECONDS) {
      // Window expired, reset counter
      counters.delete(key);
      return { allowed: true };
    }

    // Window is active, check count
    if (counter.count >= limit) {
      return { allowed: false };
    }

    return { allowed: true };
  }

  /**
   * Increment a rate limit counter
   * 
   * @param counters - Map of counters
   * @param key - Counter key (device or IP)
   * @param now - Current timestamp in seconds
   */
  private incrementCounter(
    counters: Map<string, RateLimitCounter>,
    key: string,
    now: number
  ): void {
    const counter = counters.get(key);

    if (!counter) {
      // Create new counter
      counters.set(key, { count: 1, windowStart: now });
      return;
    }

    // Check if window has expired
    if (now - counter.windowStart >= this.WINDOW_SECONDS) {
      // Reset counter with new window
      counters.set(key, { count: 1, windowStart: now });
      return;
    }

    // Increment existing counter
    counter.count++;
  }

  /**
   * Validate location constraints (geofence and Wi-Fi)
   * Requirements: 9.1, 9.2, 9.3, 9.4
   * 
   * @param constraints - Session constraints (optional)
   * @param gps - GPS coordinates from scan metadata (optional)
   * @param bssid - Wi-Fi BSSID from scan metadata (optional)
   * @returns LocationValidationResult indicating if location is valid
   */
  validateLocation(
    constraints: SessionConstraints | undefined,
    gps: GpsCoordinates | undefined,
    bssid: string | undefined
  ): LocationValidationResult {
    // If no constraints configured, allow all scans (Requirement 9.4)
    if (!constraints) {
      return { valid: true };
    }

    // Check geofence constraint
    if (constraints.geofence) {
      if (!gps) {
        // Geofence required but no GPS provided
        return { valid: false, reason: "GEOFENCE_VIOLATION" };
      }

      const distance = this.calculateHaversineDistance(
        constraints.geofence.latitude,
        constraints.geofence.longitude,
        gps.latitude,
        gps.longitude
      );

      if (distance > constraints.geofence.radiusMeters) {
        return { valid: false, reason: "GEOFENCE_VIOLATION" };
      }
    }

    // Check Wi-Fi allowlist constraint
    if (constraints.wifiAllowlist && constraints.wifiAllowlist.length > 0) {
      if (!bssid) {
        // Wi-Fi required but no BSSID provided
        return { valid: false, reason: "WIFI_VIOLATION" };
      }

      // Note: In a real implementation, we would need a mapping from BSSID to SSID
      // For now, we'll check if the BSSID is in the allowlist directly
      // This is a simplification - in production, you'd query a BSSID->SSID mapping
      const isAllowed = constraints.wifiAllowlist.some(ssid => 
        bssid.toLowerCase().includes(ssid.toLowerCase())
      );

      if (!isAllowed) {
        return { valid: false, reason: "WIFI_VIOLATION" };
      }
    }

    return { valid: true };
  }

  /**
   * Calculate distance between two GPS coordinates using Haversine formula
   * Requirements: 9.2
   * 
   * @param lat1 - Latitude of first point (degrees)
   * @param lon1 - Longitude of first point (degrees)
   * @param lat2 - Latitude of second point (degrees)
   * @param lon2 - Longitude of second point (degrees)
   * @returns Distance in meters
   */
  private calculateHaversineDistance(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number
  ): number {
    const R = 6371000; // Earth's radius in meters
    const φ1 = (lat1 * Math.PI) / 180;
    const φ2 = (lat2 * Math.PI) / 180;
    const Δφ = ((lat2 - lat1) * Math.PI) / 180;
    const Δλ = ((lon2 - lon1) * Math.PI) / 180;

    const a =
      Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
      Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
  }

  /**
   * Log a scan attempt to the ScanLogs table
   * Requirements: 9.5, 10.4, 15.1, 15.2, 15.3, 15.4
   * 
   * @param params - Scan log parameters
   */
  async logScan(params: ScanLogParams): Promise<void> {
    const now = Math.floor(Date.now() / 1000);
    const random = Math.random().toString(36).substring(2, 15);
    
    // Create time-ordered rowKey: timestamp + random for uniqueness
    const rowKey = `${now.toString().padStart(15, '0')}_${random}`;

    const entity: ScanLogEntity = {
      partitionKey: params.sessionId,
      rowKey,
      flow: params.flow,
      tokenId: params.tokenId,
      holderId: params.holderId,
      scannerId: params.scannerId,
      deviceFingerprint: params.deviceFingerprint,
      ip: params.ip,
      bssid: params.bssid,
      gps: params.gps ? JSON.stringify(params.gps) : undefined,
      userAgent: params.userAgent,
      result: params.result,
      error: params.error,
      scannedAt: now,
    };

    await this.scanLogsClient.createEntity(entity);
  }

  /**
   * Reset rate limit counters (for testing)
   */
  resetRateLimits(): void {
    this.deviceCounters.clear();
    this.ipCounters.clear();
  }
}

// Export singleton instance
import { getTableClient, TableName } from "../storage";
export const validationService = new ValidationService(getTableClient(TableName.SCAN_LOGS));
