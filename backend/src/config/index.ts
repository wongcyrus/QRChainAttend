/**
 * Configuration Management
 * Feature: qr-chain-attendance
 * Requirements: 18.1, 18.2, 18.3, 18.4, 18.5, 18.6, 18.7, 18.8
 */

export interface AppConfig {
  // Azure Storage Configuration
  storageAccountName: string;
  storageAccountUri: string;

  // Azure SignalR Configuration
  signalRConnectionString: string;

  // Token Configuration
  lateRotationSeconds: number;
  earlyLeaveRotationSeconds: number;
  chainTokenTtlSeconds: number;
  ownerTransfer: boolean;

  // Anti-Cheat Configuration
  wifiSsidAllowlist: string[];

  // Azure OpenAI Configuration (Optional)
  aoaiEndpoint?: string;
  aoaiKey?: string;
  aoaiDeployment?: string;
}

/**
 * Load configuration from environment variables
 * Validates required fields and provides defaults for optional fields
 */
export function loadConfig(): AppConfig {
  const config: AppConfig = {
    // Required: Azure Storage
    storageAccountName: getEnvVar("STORAGE_ACCOUNT_NAME"),
    storageAccountUri: getEnvVar("STORAGE_ACCOUNT_URI"),

    // Required: Azure SignalR
    signalRConnectionString: getEnvVar("SIGNALR_CONNECTION_STRING"),

    // Optional: Token Configuration with defaults
    lateRotationSeconds: getEnvVarAsNumber("LATE_ROTATION_SECONDS", 60),
    earlyLeaveRotationSeconds: getEnvVarAsNumber("EARLY_LEAVE_ROTATION_SECONDS", 60),
    chainTokenTtlSeconds: getEnvVarAsNumber("CHAIN_TOKEN_TTL_SECONDS", 20),
    ownerTransfer: getEnvVarAsBoolean("OWNER_TRANSFER", true),

    // Optional: Wi-Fi Allowlist
    wifiSsidAllowlist: getEnvVarAsArray("WIFI_SSID_ALLOWLIST", []),

    // Optional: Azure OpenAI
    aoaiEndpoint: process.env.AOAI_ENDPOINT,
    aoaiKey: process.env.AOAI_KEY,
    aoaiDeployment: process.env.AOAI_DEPLOYMENT,
  };

  return config;
}

/**
 * Get required environment variable
 * Throws error if not found
 */
function getEnvVar(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Required environment variable ${name} is not set`);
  }
  return value;
}

/**
 * Get environment variable as number with optional default
 */
function getEnvVarAsNumber(name: string, defaultValue: number): number {
  const value = process.env[name];
  if (!value) {
    return defaultValue;
  }
  const parsed = parseInt(value, 10);
  if (isNaN(parsed)) {
    throw new Error(`Environment variable ${name} must be a number, got: ${value}`);
  }
  return parsed;
}

/**
 * Get environment variable as boolean with optional default
 */
function getEnvVarAsBoolean(name: string, defaultValue: boolean): boolean {
  const value = process.env[name];
  if (!value) {
    return defaultValue;
  }
  return value.toLowerCase() === "true";
}

/**
 * Get environment variable as array (comma-separated) with optional default
 */
function getEnvVarAsArray(name: string, defaultValue: string[]): string[] {
  const value = process.env[name];
  if (!value || value.trim() === "") {
    return defaultValue;
  }
  return value.split(",").map((s) => s.trim()).filter((s) => s.length > 0);
}

// Export singleton instance
let configInstance: AppConfig | null = null;

export function getConfig(): AppConfig {
  if (!configInstance) {
    configInstance = loadConfig();
  }
  return configInstance;
}

// For testing: reset config
export function resetConfig(): void {
  configInstance = null;
}
