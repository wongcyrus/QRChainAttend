/**
 * Configuration Management Tests
 * Feature: qr-chain-attendance
 * Requirements: 18.1, 18.2, 18.3, 18.4, 18.5, 18.6, 18.7, 18.8
 */

import { loadConfig, resetConfig, getConfig } from "./index";

describe("Configuration Management", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    // Reset environment before each test
    jest.resetModules();
    process.env = { ...originalEnv };
    resetConfig();
  });

  afterAll(() => {
    // Restore original environment
    process.env = originalEnv;
  });

  describe("Required Configuration", () => {
    test("should throw error when STORAGE_ACCOUNT_NAME is missing", () => {
      // Requirement 18.1
      delete process.env.STORAGE_ACCOUNT_NAME;
      process.env.STORAGE_ACCOUNT_URI = "https://test.table.core.windows.net";
      process.env.SIGNALR_CONNECTION_STRING = "Endpoint=https://test.service.signalr.net";

      expect(() => loadConfig()).toThrow(
        "Required environment variable STORAGE_ACCOUNT_NAME is not set"
      );
    });

    test("should throw error when STORAGE_ACCOUNT_URI is missing", () => {
      // Requirement 18.1
      process.env.STORAGE_ACCOUNT_NAME = "teststorage";
      delete process.env.STORAGE_ACCOUNT_URI;
      process.env.SIGNALR_CONNECTION_STRING = "Endpoint=https://test.service.signalr.net";

      expect(() => loadConfig()).toThrow(
        "Required environment variable STORAGE_ACCOUNT_URI is not set"
      );
    });

    test("should throw error when SIGNALR_CONNECTION_STRING is missing", () => {
      // Requirement 18.2
      process.env.STORAGE_ACCOUNT_NAME = "teststorage";
      process.env.STORAGE_ACCOUNT_URI = "https://test.table.core.windows.net";
      delete process.env.SIGNALR_CONNECTION_STRING;

      expect(() => loadConfig()).toThrow(
        "Required environment variable SIGNALR_CONNECTION_STRING is not set"
      );
    });

    test("should load required configuration when all variables are set", () => {
      // Requirements 18.1, 18.2
      process.env.STORAGE_ACCOUNT_NAME = "teststorage";
      process.env.STORAGE_ACCOUNT_URI = "https://test.table.core.windows.net";
      process.env.SIGNALR_CONNECTION_STRING = "Endpoint=https://test.service.signalr.net";

      const config = loadConfig();

      expect(config.storageAccountName).toBe("teststorage");
      expect(config.storageAccountUri).toBe("https://test.table.core.windows.net");
      expect(config.signalRConnectionString).toBe("Endpoint=https://test.service.signalr.net");
    });
  });

  describe("Default Values", () => {
    beforeEach(() => {
      // Set required variables
      process.env.STORAGE_ACCOUNT_NAME = "teststorage";
      process.env.STORAGE_ACCOUNT_URI = "https://test.table.core.windows.net";
      process.env.SIGNALR_CONNECTION_STRING = "Endpoint=https://test.service.signalr.net";
    });

    test("should use default value 60 for LATE_ROTATION_SECONDS", () => {
      // Requirement 18.3
      delete process.env.LATE_ROTATION_SECONDS;

      const config = loadConfig();

      expect(config.lateRotationSeconds).toBe(60);
    });

    test("should use default value 60 for EARLY_LEAVE_ROTATION_SECONDS", () => {
      // Requirement 18.4
      delete process.env.EARLY_LEAVE_ROTATION_SECONDS;

      const config = loadConfig();

      expect(config.earlyLeaveRotationSeconds).toBe(60);
    });

    test("should use default value 20 for CHAIN_TOKEN_TTL_SECONDS", () => {
      // Requirement 18.5
      delete process.env.CHAIN_TOKEN_TTL_SECONDS;

      const config = loadConfig();

      expect(config.chainTokenTtlSeconds).toBe(20);
    });

    test("should use default value true for OWNER_TRANSFER", () => {
      // Requirement 18.6
      delete process.env.OWNER_TRANSFER;

      const config = loadConfig();

      expect(config.ownerTransfer).toBe(true);
    });

    test("should use empty array as default for WIFI_SSID_ALLOWLIST", () => {
      // Requirement 18.7
      delete process.env.WIFI_SSID_ALLOWLIST;

      const config = loadConfig();

      expect(config.wifiSsidAllowlist).toEqual([]);
    });
  });

  describe("Custom Values", () => {
    beforeEach(() => {
      // Set required variables
      process.env.STORAGE_ACCOUNT_NAME = "teststorage";
      process.env.STORAGE_ACCOUNT_URI = "https://test.table.core.windows.net";
      process.env.SIGNALR_CONNECTION_STRING = "Endpoint=https://test.service.signalr.net";
    });

    test("should parse custom LATE_ROTATION_SECONDS", () => {
      // Requirement 18.3
      process.env.LATE_ROTATION_SECONDS = "90";

      const config = loadConfig();

      expect(config.lateRotationSeconds).toBe(90);
    });

    test("should parse custom EARLY_LEAVE_ROTATION_SECONDS", () => {
      // Requirement 18.4
      process.env.EARLY_LEAVE_ROTATION_SECONDS = "45";

      const config = loadConfig();

      expect(config.earlyLeaveRotationSeconds).toBe(45);
    });

    test("should parse custom CHAIN_TOKEN_TTL_SECONDS", () => {
      // Requirement 18.5
      process.env.CHAIN_TOKEN_TTL_SECONDS = "30";

      const config = loadConfig();

      expect(config.chainTokenTtlSeconds).toBe(30);
    });

    test("should parse OWNER_TRANSFER as true", () => {
      // Requirement 18.6
      process.env.OWNER_TRANSFER = "true";

      const config = loadConfig();

      expect(config.ownerTransfer).toBe(true);
    });

    test("should parse OWNER_TRANSFER as false", () => {
      // Requirement 18.6
      process.env.OWNER_TRANSFER = "false";

      const config = loadConfig();

      expect(config.ownerTransfer).toBe(false);
    });

    test("should parse OWNER_TRANSFER case-insensitively", () => {
      // Requirement 18.6
      process.env.OWNER_TRANSFER = "TRUE";

      const config = loadConfig();

      expect(config.ownerTransfer).toBe(true);
    });

    test("should parse WIFI_SSID_ALLOWLIST as comma-separated array", () => {
      // Requirement 18.7
      process.env.WIFI_SSID_ALLOWLIST = "ClassroomWiFi,SchoolNetwork,LabWiFi";

      const config = loadConfig();

      expect(config.wifiSsidAllowlist).toEqual(["ClassroomWiFi", "SchoolNetwork", "LabWiFi"]);
    });

    test("should trim whitespace from WIFI_SSID_ALLOWLIST entries", () => {
      // Requirement 18.7
      process.env.WIFI_SSID_ALLOWLIST = " ClassroomWiFi , SchoolNetwork , LabWiFi ";

      const config = loadConfig();

      expect(config.wifiSsidAllowlist).toEqual(["ClassroomWiFi", "SchoolNetwork", "LabWiFi"]);
    });

    test("should filter empty entries from WIFI_SSID_ALLOWLIST", () => {
      // Requirement 18.7
      process.env.WIFI_SSID_ALLOWLIST = "ClassroomWiFi,,SchoolNetwork,";

      const config = loadConfig();

      expect(config.wifiSsidAllowlist).toEqual(["ClassroomWiFi", "SchoolNetwork"]);
    });

    test("should handle empty WIFI_SSID_ALLOWLIST string", () => {
      // Requirement 18.7
      process.env.WIFI_SSID_ALLOWLIST = "";

      const config = loadConfig();

      expect(config.wifiSsidAllowlist).toEqual([]);
    });

    test("should handle whitespace-only WIFI_SSID_ALLOWLIST", () => {
      // Requirement 18.7
      process.env.WIFI_SSID_ALLOWLIST = "   ";

      const config = loadConfig();

      expect(config.wifiSsidAllowlist).toEqual([]);
    });
  });

  describe("Azure OpenAI Configuration", () => {
    beforeEach(() => {
      // Set required variables
      process.env.STORAGE_ACCOUNT_NAME = "teststorage";
      process.env.STORAGE_ACCOUNT_URI = "https://test.table.core.windows.net";
      process.env.SIGNALR_CONNECTION_STRING = "Endpoint=https://test.service.signalr.net";
    });

    test("should load AOAI configuration when all variables are set", () => {
      // Requirement 18.8
      process.env.AOAI_ENDPOINT = "https://test.openai.azure.com";
      process.env.AOAI_KEY = "test-key-12345";
      process.env.AOAI_DEPLOYMENT = "gpt-4";

      const config = loadConfig();

      expect(config.aoaiEndpoint).toBe("https://test.openai.azure.com");
      expect(config.aoaiKey).toBe("test-key-12345");
      expect(config.aoaiDeployment).toBe("gpt-4");
    });

    test("should have undefined AOAI values when not configured", () => {
      // Requirement 18.8
      delete process.env.AOAI_ENDPOINT;
      delete process.env.AOAI_KEY;
      delete process.env.AOAI_DEPLOYMENT;

      const config = loadConfig();

      expect(config.aoaiEndpoint).toBeUndefined();
      expect(config.aoaiKey).toBeUndefined();
      expect(config.aoaiDeployment).toBeUndefined();
    });

    test("should allow partial AOAI configuration", () => {
      // Requirement 18.8 - Optional configuration
      process.env.AOAI_ENDPOINT = "https://test.openai.azure.com";
      delete process.env.AOAI_KEY;
      delete process.env.AOAI_DEPLOYMENT;

      const config = loadConfig();

      expect(config.aoaiEndpoint).toBe("https://test.openai.azure.com");
      expect(config.aoaiKey).toBeUndefined();
      expect(config.aoaiDeployment).toBeUndefined();
    });
  });

  describe("Error Handling", () => {
    beforeEach(() => {
      // Set required variables
      process.env.STORAGE_ACCOUNT_NAME = "teststorage";
      process.env.STORAGE_ACCOUNT_URI = "https://test.table.core.windows.net";
      process.env.SIGNALR_CONNECTION_STRING = "Endpoint=https://test.service.signalr.net";
    });

    test("should throw error for invalid LATE_ROTATION_SECONDS", () => {
      process.env.LATE_ROTATION_SECONDS = "not-a-number";

      expect(() => loadConfig()).toThrow(
        "Environment variable LATE_ROTATION_SECONDS must be a number"
      );
    });

    test("should throw error for invalid EARLY_LEAVE_ROTATION_SECONDS", () => {
      process.env.EARLY_LEAVE_ROTATION_SECONDS = "invalid";

      expect(() => loadConfig()).toThrow(
        "Environment variable EARLY_LEAVE_ROTATION_SECONDS must be a number"
      );
    });

    test("should throw error for invalid CHAIN_TOKEN_TTL_SECONDS", () => {
      process.env.CHAIN_TOKEN_TTL_SECONDS = "abc";

      expect(() => loadConfig()).toThrow(
        "Environment variable CHAIN_TOKEN_TTL_SECONDS must be a number"
      );
    });
  });

  describe("Singleton Pattern", () => {
    beforeEach(() => {
      // Set required variables
      process.env.STORAGE_ACCOUNT_NAME = "teststorage";
      process.env.STORAGE_ACCOUNT_URI = "https://test.table.core.windows.net";
      process.env.SIGNALR_CONNECTION_STRING = "Endpoint=https://test.service.signalr.net";
    });

    test("should return same instance on multiple calls to getConfig", () => {
      const config1 = getConfig();
      const config2 = getConfig();

      expect(config1).toBe(config2);
    });

    test("should reload config after resetConfig", () => {
      const config1 = getConfig();
      
      resetConfig();
      process.env.STORAGE_ACCOUNT_NAME = "newstorage";
      
      const config2 = getConfig();

      expect(config1).not.toBe(config2);
      expect(config2.storageAccountName).toBe("newstorage");
    });
  });

  describe("Integration Scenarios", () => {
    test("should load complete production-like configuration", () => {
      // Requirements 18.1-18.8
      process.env.STORAGE_ACCOUNT_NAME = "qrattendancestorage";
      process.env.STORAGE_ACCOUNT_URI = "https://qrattendancestorage.table.core.windows.net";
      process.env.SIGNALR_CONNECTION_STRING = "Endpoint=https://qrattendance.service.signalr.net;AccessKey=abc123";
      process.env.LATE_ROTATION_SECONDS = "60";
      process.env.EARLY_LEAVE_ROTATION_SECONDS = "60";
      process.env.CHAIN_TOKEN_TTL_SECONDS = "20";
      process.env.OWNER_TRANSFER = "true";
      process.env.WIFI_SSID_ALLOWLIST = "ClassroomWiFi,SchoolNetwork";
      process.env.AOAI_ENDPOINT = "https://qrattendance.openai.azure.com";
      process.env.AOAI_KEY = "sk-test-key";
      process.env.AOAI_DEPLOYMENT = "gpt-4";

      const config = loadConfig();

      expect(config).toEqual({
        storageAccountName: "qrattendancestorage",
        storageAccountUri: "https://qrattendancestorage.table.core.windows.net",
        signalRConnectionString: "Endpoint=https://qrattendance.service.signalr.net;AccessKey=abc123",
        lateRotationSeconds: 60,
        earlyLeaveRotationSeconds: 60,
        chainTokenTtlSeconds: 20,
        ownerTransfer: true,
        wifiSsidAllowlist: ["ClassroomWiFi", "SchoolNetwork"],
        aoaiEndpoint: "https://qrattendance.openai.azure.com",
        aoaiKey: "sk-test-key",
        aoaiDeployment: "gpt-4",
      });
    });

    test("should load minimal configuration with defaults", () => {
      // Requirements 18.1-18.6 (with defaults)
      process.env.STORAGE_ACCOUNT_NAME = "qrattendancestorage";
      process.env.STORAGE_ACCOUNT_URI = "https://qrattendancestorage.table.core.windows.net";
      process.env.SIGNALR_CONNECTION_STRING = "Endpoint=https://qrattendance.service.signalr.net";

      const config = loadConfig();

      expect(config).toEqual({
        storageAccountName: "qrattendancestorage",
        storageAccountUri: "https://qrattendancestorage.table.core.windows.net",
        signalRConnectionString: "Endpoint=https://qrattendance.service.signalr.net",
        lateRotationSeconds: 60,
        earlyLeaveRotationSeconds: 60,
        chainTokenTtlSeconds: 20,
        ownerTransfer: true,
        wifiSsidAllowlist: [],
        aoaiEndpoint: undefined,
        aoaiKey: undefined,
        aoaiDeployment: undefined,
      });
    });
  });
});
