# Database Tables - QR Chain Attendance System

**Date**: February 6, 2026  
**Storage**: Azure Table Storage

## Required Tables (5 Total)

### 1. Sessions
**Purpose**: Store active attendance sessions

**Schema**:
```
PartitionKey: "SESSION"
RowKey: sessionId (UUID)
Fields:
  - classId: string
  - teacherId: string (email)
  - startAt: timestamp
  - status: "ACTIVE" | "ENDED"
  - createdAt: timestamp
```

### 2. Attendance
**Purpose**: Track student attendance records

**Schema**:
```
PartitionKey: sessionId
RowKey: studentId (email)
Fields:
  - exitVerified: boolean
  - joinedAt: timestamp (Unix seconds)
  - exitedAt: timestamp (Unix seconds) [optional]
  - Timestamp: Azure auto-generated
```

### 3. Chains
**Purpose**: Store QR code chain data for entry/exit tracking

**Schema**:
```
PartitionKey: sessionId
RowKey: chainId
Fields:
  - type: "ENTRY" | "EXIT" | "LATE" | "EARLY"
  - currentToken: string
  - previousToken: string
  - rotationCount: number
  - lastRotation: timestamp
```

### 4. Tokens
**Purpose**: Store session tokens for chain validation

**Schema**:
```
PartitionKey: sessionId
RowKey: tokenId (UUID)
Fields:
  - chainId: string
  - holderId: string (email of current holder)
  - seq: number (sequence number in chain)
  - expiresAt: timestamp (token expiration, default 20s)
  - createdAt: timestamp
  
  # Challenge Code Fields (Optional - added when scanner requests challenge)
  - pendingChallenge: string (email of scanner who requested challenge)
  - challengeCode: string (SHA-256 hash of 6-digit code)
  - challengeExpiresAt: timestamp (challenge expiration, default 30s)
```

**Note**: Challenge fields are added dynamically when a scanner requests a challenge code. They are optional and not present on newly created tokens until a scan is initiated.

### 5. UserSessions
**Purpose**: Map users to their active sessions

**Schema**:
```
PartitionKey: userId (email)
RowKey: sessionId
Fields:
  - role: "teacher" | "student"
  - joinedAt: timestamp
  - status: "active" | "ended"
```

## Removed Tables

### ~~QRTokens~~ (NOT USED)

**Reason**: Switched to encryption-based approach. Tokens are now encrypted/decrypted in-memory without database storage.

**Previous Schema** (for reference):
```
PartitionKey: sessionId
RowKey: "entry-{token}" or "exit-{token}"
Fields:
  - type: "ENTRY" | "EXIT"
  - token: 64-char hex string
  - sessionId: string
  - createdAt: timestamp
  - expiresAt: timestamp
  - isActive: boolean
```

**Why Removed**:
- ❌ Database overhead for every QR generation
- ❌ Need to clean up expired tokens
- ❌ Additional storage costs
- ✅ Encryption is faster (CPU-only)
- ✅ No cleanup needed (auto-expire)
- ✅ Simpler architecture

## Table Initialization

### Local Development (Azurite)

```bash
# Start Azurite
azurite --silent --location ./azurite --debug ./azurite/debug.log

# Initialize tables
./scripts/init-tables.sh
```

### Azure Production

```bash
# Option 1: Using script
./scripts/init-tables.sh rg-qr-attendance-dev stqrattendancedev

# Option 2: Using Azure CLI directly
az storage table create --name Sessions \
  --connection-string "<connection-string>"
# Repeat for each table
```

## Table Usage

### Sessions Table
- Created when teacher starts a session
- Updated when session ends
- Queried to list active sessions

### Attendance Table
- Created when student joins session (with `joinedAt`)
- Updated when student exits (with `exitedAt`, `exitVerified`)
- Queried for attendance reports
- Exported to CSV

### Chains Table
- Created for entry/exit QR chains
- Updated every rotation (configurable seconds)
- Used for chain validation

### Tokens Table
- Created for session tokens
- Used for chain token validation
- Cleaned up when session ends

### UserSessions Table
- Created when user joins session
- Used to track active sessions per user
- Cleaned up when session ends

## Storage Costs

**Estimated costs** (Azure Table Storage):
- Storage: $0.045 per GB/month
- Transactions: $0.00036 per 10,000 transactions

**Typical usage** (100 students, 10 sessions/day):
- Storage: < 1 GB/month
- Transactions: ~50,000/day
- **Monthly cost**: < $1

## Performance

### Read Operations
- Get session: ~10ms
- Get attendance: ~10ms
- List sessions: ~50ms

### Write Operations
- Create session: ~20ms
- Update attendance: ~20ms
- Batch operations: ~50ms

### No Database for QR Tokens
- Token generation: ~1ms (encryption only)
- Token validation: ~1ms (decryption only)
- **Zero database overhead**

## Backup and Recovery

### Backup Strategy
```bash
# Export tables to JSON
az storage table export \
  --name Sessions \
  --connection-string "<connection-string>" \
  --output-file sessions-backup.json
```

### Recovery
```bash
# Import from JSON
az storage table import \
  --name Sessions \
  --connection-string "<connection-string>" \
  --input-file sessions-backup.json
```

## Monitoring

### Check Table Sizes
```bash
az storage table list \
  --connection-string "<connection-string>" \
  --query "[].{name:name}" -o table
```

### Query Table Data
```bash
# List all sessions
az storage entity query \
  --table-name Sessions \
  --connection-string "<connection-string>"

# List attendance for a session
az storage entity query \
  --table-name Attendance \
  --filter "PartitionKey eq 'session-id'" \
  --connection-string "<connection-string>"
```

## Migration Notes

### Challenge Code System (February 2026)

**No migration needed**:
- Challenge fields are optional and added dynamically
- Azure Table Storage is schema-less
- Existing tokens continue to work
- New tokens support challenge codes automatically

**What changed**:
- Added 3 optional fields to Tokens table:
  - `pendingChallenge`: Scanner's email
  - `challengeCode`: SHA-256 hash of 6-digit code
  - `challengeExpiresAt`: Challenge expiration timestamp
- Fields are added via `updateEntity` when scanner requests challenge
- Old tokens without these fields still work (just can't use challenge system)

**Backward compatibility**:
- ✅ Old tokens (before deployment): Work normally
- ✅ New tokens (after deployment): Support challenges
- ✅ Mixed environment: Both coexist without issues

### From QRTokens to Encryption

**No migration needed**:
- QRTokens table was never used in production
- Encryption-based approach is backward compatible
- Existing sessions continue to work
- No data loss

**If QRTokens table exists**:
```bash
# Optional: Delete unused table
az storage table delete \
  --name QRTokens \
  --connection-string "<connection-string>"
```

## Summary

✅ **5 tables required** (Sessions, Attendance, Chains, Tokens, UserSessions)  
❌ **QRTokens NOT needed** (encryption-based approach)  
✅ **Simple schema** (easy to understand and maintain)  
✅ **Low cost** (< $1/month for typical usage)  
✅ **Fast performance** (< 50ms for most operations)  
✅ **No cleanup needed** (tokens auto-expire)

---

**Next Step**: Run `./scripts/init-tables.sh` to create all required tables
