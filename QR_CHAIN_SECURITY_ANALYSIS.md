# QR Chain Security Analysis - Anti-Cheating Mechanisms

**Date**: February 8, 2026  
**Status**: ⚠️ VULNERABILITIES IDENTIFIED → ✅ FIXED (February 9, 2026)  
**Analysis Focus**: Student cheating vulnerabilities in QR chain attendance system

---

## ⚠️ UPDATE: Security Issues Fixed

**The vulnerabilities identified in this document have been addressed with the One-Time Challenge Code System.**

**See**: `CHALLENGE_CODE_SYSTEM.md` for the complete solution and deployment details.

**Summary of Fix**:
- ✅ One-time challenge codes prevent remote sharing
- ✅ Bidirectional verification requires physical proximity
- ✅ Chain amplification attacks blocked
- ✅ Deployed to production: February 9, 2026

---

## Original Analysis (Historical Reference)

This document contains the original security analysis that identified critical vulnerabilities in the QR chain system. These issues have been resolved.

---

## Executive Summary

The QR chain attendance system has **multiple security layers** but contains **critical vulnerabilities** that allow students to cheat. The weakest points are:

1. ⚠️ **Token expiration is too short (20s) but can be bypassed**
2. ⚠️ **No verification that students are physically present together**
3. ⚠️ **Geolocation can be spoofed easily**
4. ⚠️ **Exit chain is NOT implemented** (stub only)
5. ⚠️ **Students can share QR URLs digitally instead of showing phones**

---

## System Architecture Overview

### Actual Entry Chain Flow (Student-to-Student)
1. **Teacher creates session** → Students join via encrypted QR
2. **Teacher clicks "Seed Entry"** → Backend randomly selects 3 online students as initial holders
3. **Initial 3 holders** → Each gets a token (UUID) stored in database with 20s expiration
4. **Holders see QR on their screen** → QR contains URL: `http://domain/student?sessionId=X&chainId=Y&tokenId=Z&type=entry`
5. **Other students scan holder's QR** → Opens URL in their browser
6. **Scanner's browser calls scanChain API** → Validates token, marks previous holder present
7. **Token deleted, new token created** → Scanner becomes new holder with new 20s token
8. **Chain continues** → Each scan marks one student present and passes holder status
9. **Process repeats** until all students marked

**KEY INSIGHT**: Students scan **each other's QR codes**, not the teacher's QR. Teacher only seeds the initial 3 holders.

### Exit Chain Flow
**STATUS**: ❌ **NOT IMPLEMENTED** (returns 501 error)

---

## Security Mechanisms (What's Implemented)

### ✅ 1. Token-Based Chain System
**Location**: `backend/src/functions/scanChain.ts`, `backend/src/functions/getStudentToken.ts`

**How it works**:
- Each chain holder gets a unique token (UUID)
- Token stored in database with: `chainId`, `holderId`, `seq`, `expiresAt`
- Token embedded in QR URL: `http://domain/student?sessionId=X&chainId=Y&tokenId=Z&type=entry`
- When scanned, token is validated and deleted, new token created for scanner

**Security value**:
- ✅ Prevents token reuse (deleted after scan)
- ✅ Tracks chain sequence number
- ✅ Time-limited validity (20 seconds default)

**Weakness**:
- ⚠️ Token is in plain URL - can be copied/shared digitally
- ⚠️ No cryptographic binding to device or location

---

### ✅ 2. Self-Scan Prevention
**Location**: `backend/src/functions/scanChain.ts:157-163`

```typescript
// Cannot scan your own QR code
if (previousHolder === studentEmail) {
  return {
    status: 400,
    jsonBody: { error: { code: 'SELF_SCAN', message: 'Cannot scan your own QR code' } }
  };
}
```

**Security value**:
- ✅ Prevents students from marking themselves present without interaction

**Weakness**:
- ⚠️ Only checks email match - doesn't prevent collusion

---

### ✅ 3. Token Expiration (20 seconds)
**Location**: `backend/src/functions/scanChain.ts:237`, `backend/src/functions/seedEntry.ts:135`

```typescript
const tokenTTL = parseInt(process.env.CHAIN_TOKEN_TTL_SECONDS || '20');
const newExpiresAt = now + (tokenTTL * 1000);
```

**Security value**:
- ✅ Limits time window for token sharing
- ✅ Forces rapid chain progression
- ✅ Expired tokens rejected: `if (token.expiresAt && (token.expiresAt as number) < now)`

**Weakness**:
- ⚠️ 20 seconds is enough to screenshot and share via messaging apps
- ⚠️ Students can coordinate timing to share tokens remotely

---

### ✅ 4. Online Status Tracking
**Location**: `backend/src/functions/seedEntry.ts:115-127`

```typescript
const onlineThreshold = 30000; // 30 seconds
for await (const record of attendanceRecords) {
  const isOnline = record.isOnline === true;
  const lastSeen = record.lastSeen ? (record.lastSeen as number) : 0;
  const isRecentlyActive = (now - lastSeen) < onlineThreshold;
  
  if (!record.entryStatus && (isOnline || isRecentlyActive)) {
    students.push(record.rowKey as string);
  }
}
```

**Security value**:
- ✅ Only online students can be initial holders
- ✅ Prevents marking absent students

**Weakness**:
- ⚠️ "Online" just means browser tab is open - doesn't verify physical presence
- ⚠️ Students can leave tab open and go elsewhere

---

### ✅ 5. Geolocation Validation (Optional)
**Location**: `backend/src/utils/geolocation.ts`, `backend/src/functions/scanChain.ts:107-130`

**How it works**:
- Session can have location + geofence radius
- Student's GPS coordinates sent with scan request
- Distance calculated using Haversine formula
- Two modes: **warn** (allow but flag) or **enforce** (block if outside)

```typescript
if (geoCheck.shouldBlock) {
  return {
    status: 403,
    jsonBody: {
      error: {
        code: 'GEOFENCE_VIOLATION',
        message: geoCheck.warning || 'You are outside the allowed area'
      }
    }
  };
}
```

**Security value**:
- ✅ Can verify students are in classroom
- ✅ Calculates actual distance from session location
- ✅ Blocks scans if enforced and out of bounds

**Weakness**:
- ⚠️ **GPS spoofing is trivial** (browser dev tools, fake GPS apps)
- ⚠️ Location permission can be denied (only warns if not enforced)
- ⚠️ No verification of location accuracy
- ⚠️ Indoor GPS is often inaccurate (10-50m error)

---

### ✅ 6. Encrypted Session Join Tokens
**Location**: `backend/src/functions/getEntryQR.ts:49-60`, `backend/src/functions/joinSession.ts:53-75`

**How it works**:
- Session join QR contains encrypted token with timestamp
- AES-256-CBC encryption with random IV
- Token includes: `sessionId`, `type`, `timestamp`, `expiresAt`
- Decrypted and validated on join

**Security value**:
- ✅ Prevents tampering with session IDs
- ✅ Time-limited validity (20 seconds)
- ✅ Cannot forge join tokens without encryption key

**Weakness**:
- ⚠️ Encryption key stored in environment variable (can be leaked)
- ⚠️ Default key is weak: `'default-secret-key-change-in-production'`
- ⚠️ Once decrypted, sessionId is known and can be shared

---

### ✅ 7. Role-Based Access Control
**Location**: All functions use `hasRole()` checks

```typescript
function hasRole(principal: any, role: string): boolean {
  const email = principal.userDetails || '';
  const emailLower = email.toLowerCase();
  
  if (role.toLowerCase() === 'teacher' && emailLower.endsWith('@vtc.edu.hk') 
      && !emailLower.endsWith('@stu.vtc.edu.hk')) {
    return true;
  }
  
  if (role.toLowerCase() === 'student' && emailLower.endsWith('@stu.vtc.edu.hk')) {
    return true;
  }
  // ...
}
```

**Security value**:
- ✅ Students cannot seed chains or end sessions
- ✅ Teachers cannot scan chains (student-only)
- ✅ Domain-based role detection

**Weakness**:
- ⚠️ No protection against student collusion
- ⚠️ Students with valid credentials can help absent friends

---

## Critical Vulnerabilities (How Students Can Cheat)

### 🚨 CRITICAL DESIGN FLAW: URL-Based Chain Transfer

**The fundamental weakness**: The system was designed for physical QR scanning but implemented as URL-based, which removes the physical proximity requirement.

**Design intent**:
```
Student A (holder) → Shows QR on phone screen
Student B (scanner) → Uses camera app to scan QR from Student A's screen
Requirement: Physical proximity (camera range ~30cm)
```

**Actual implementation**:
```
Student A (holder) → QR contains URL with token
Student B (scanner) → Can open URL directly in browser OR scan with camera
Requirement: None (URL can be shared digitally)
```

**This design flaw enables ALL the vulnerabilities below.**

---

### 🚨 VULNERABILITY #1: Digital QR Sharing (Student-to-Student Chain)
**Severity**: CRITICAL  
**Exploitability**: TRIVIAL

**Attack scenario**:
1. Teacher seeds entry → Student A (in class) becomes one of 3 initial holders
2. Student B is at home (absent)
3. Student A screenshots their holder QR or copies the URL from dev tools
4. Student A sends URL to Student B via WhatsApp: `http://domain/student?sessionId=X&chainId=Y&tokenId=Z&type=entry`
5. Student B opens URL in browser within 20 seconds
6. **scanChain API executes**:
   - Validates token (exists, not expired, correct chain)
   - Marks Student A as PRESENT (previous holder)
   - Deletes old token, creates new token for Student B
   - Student B becomes new holder
7. Student B (still at home) can now pass to Student C (also absent)
8. **Result**: Multiple absent students marked present via remote token sharing

**Why it works**:
- ✅ Token is in plain URL (no device binding)
- ✅ 20 seconds is enough to share via messaging apps
- ✅ No verification that scanner is physically near holder
- ✅ Browser can open QR URL directly (no camera needed)
- ✅ **Previous holder gets marked present when ANYONE scans their token** (line 168-195 in scanChain.ts)
- ✅ Scanner doesn't need to be marked present to become holder (only previous holder gets marked)

**Critical code evidence**:
```typescript
// backend/src/functions/scanChain.ts:168-195
// Mark previous holder's attendance if not already marked
const prevAttendance = await attendanceTable.getEntity(sessionId, previousHolder);

if (!prevAttendance.entryStatus) {
  const entryStatus = now > lateCutoffTime ? 'LATE_ENTRY' : 'PRESENT_ENTRY';
  
  await attendanceTable.updateEntity({
    partitionKey: sessionId,
    rowKey: previousHolder,  // Previous holder marked present
    entryStatus,
    entryAt: now
  }, 'Merge');
}

// Delete old token, create new for scanner
await tokensTable.deleteEntity(sessionId, tokenId);
const newTokenEntity = {
  holderId: studentEmail,  // Scanner becomes new holder (no attendance check!)
  // ...
};
await tokensTable.createEntity(newTokenEntity);
```

**Fix difficulty**: HARD (requires proximity verification)

---

### 🚨 VULNERABILITY #2: GPS Spoofing
**Severity**: HIGH  
**Exploitability**: EASY

**Attack scenario**:
1. Student is at home but wants to mark attendance
2. Student uses browser dev tools or GPS spoofing app
3. Student sets fake GPS coordinates to classroom location
4. Student scans QR (shared digitally from classmate)
5. Geolocation check passes, student marked present

**Why it works**:
- ✅ Browser geolocation API can be mocked in dev tools
- ✅ Mobile apps exist specifically for GPS spoofing
- ✅ No verification of GPS authenticity
- ✅ No cross-checking with network location or cell tower data

**Evidence in code**:
```typescript
// backend/src/functions/scanChain.ts:107-130
const geoCheck = validateGeolocation(
  sessionLocation,
  geofenceRadius,
  enforceGeofence,
  scannerLocation // Trusts client-provided location
);
```

**Fix difficulty**: MEDIUM (requires server-side location verification)

---

### 🚨 VULNERABILITY #3: Token Timing Attack
**Severity**: MEDIUM  
**Exploitability**: MODERATE

**Attack scenario**:
1. Student A (in class) and Student B (at home) coordinate via call
2. Student A becomes holder, immediately shares URL
3. Student B opens URL within 20 seconds
4. Both students appear to be participating in chain
5. Repeat for multiple absent students

**Why it works**:
- ✅ 20 seconds is generous for digital sharing
- ✅ No rate limiting on scans
- ✅ No detection of suspicious scan patterns
- ✅ No verification of scan timing consistency

**Fix difficulty**: MEDIUM (requires pattern analysis)

---

### 🚨 VULNERABILITY #4: Exit Chain Not Implemented
**Severity**: HIGH  
**Exploitability**: N/A (feature missing)

**Impact**:
- ❌ Students can mark entry but leave early without detection
- ❌ No verification that students stayed for full class
- ❌ Entry-only attendance is incomplete

**Evidence in code**:
```typescript
// backend/src/functions/startExitChain.ts:7-18
export async function startExitChain(...): Promise<HttpResponseInit> {
  context.log('startExitChain called - not yet implemented');
  
  return {
    status: 501,
    jsonBody: {
      error: {
        code: 'NOT_IMPLEMENTED',
        message: 'This function is not yet implemented'
      }
    }
  };
}
```

**Fix difficulty**: MEDIUM (copy entry chain logic, adapt for exit)

---

### 🚨 VULNERABILITY #5: No Proximity Verification (Student-to-Student)
**Severity**: CRITICAL  
**Exploitability**: TRIVIAL

**Attack scenario**:
1. Teacher seeds entry chains → 3 students in class become holders
2. These 3 students coordinate with absent friends
3. Each holder shares their token URL remotely (WhatsApp, WeChat, etc.)
4. Absent students open URLs and become holders
5. Chain continues remotely among absent students
6. **All participants marked present despite being in different locations**

**Why it works**:
- ✅ System only checks token validity (exists, not expired, correct chain)
- ✅ No verification that scanner and holder are physically near each other
- ✅ GPS can be spoofed (see Vulnerability #2)
- ✅ No Bluetooth/NFC proximity verification
- ✅ No visual confirmation required
- ✅ **The chain logic assumes physical QR scanning but accepts URL opening**

**Critical insight**:
The system was **designed** for students to physically scan each other's phone screens with their camera app. But the **implementation** allows opening the QR URL directly in a browser, which bypasses the physical proximity requirement entirely.

**Design vs Implementation gap**:
```
DESIGN:  Student A shows QR → Student B scans with camera → Physical proximity required
IMPLEMENTATION: Student A's QR contains URL → Student B opens URL → No proximity check
```

**Fix difficulty**: HARD (requires new technology: BLE, NFC, or visual proof)

---

### 🚨 VULNERABILITY #6: Collusion Detection Missing (Chain Amplification)
**Severity**: HIGH  
**Exploitability**: EASY

**Attack scenario - "Chain Amplification Attack"**:
1. Teacher seeds 3 chains → Students A, B, C (in class) become initial holders
2. Each holder shares their token with multiple absent friends:
   - Student A → shares to Students D, E, F (absent)
   - Student B → shares to Students G, H, I (absent)  
   - Student C → shares to Students J, K, L (absent)
3. Within 20 seconds, all absent students open URLs and become holders
4. **Result**: 3 students in class → 12 students marked present (9 absent)
5. Absent students continue passing chains among themselves
6. **Final result**: Entire class marked present with only 3 students physically present

**Why it works**:
- ✅ No detection of suspicious patterns:
  - Same holder → multiple scanners in rapid succession
  - Scans from same IP address (one device sharing to many)
  - Geographically impossible scan sequences (holder in classroom, scanner at home)
  - Rapid sequential scans (automated/coordinated)
- ✅ No logging of scan patterns or metadata
- ✅ No analysis of chain transfer behavior
- ✅ No flagging of suspicious activity
- ✅ No IP address tracking
- ✅ **No limit on how many times a token can be shared before expiration**

**Real-world feasibility**:
- Time required: < 20 seconds per wave
- Coordination: Simple group chat
- Detection risk: Zero (no pattern analysis)
- Scale: Can mark entire class present with 3 students

**Evidence in code** (what's missing):
```typescript
// backend/src/functions/scanChain.ts
// NO checks for:
// - How many students scanned from same holder
// - Time between scans (too fast = suspicious)
// - IP address clustering
// - Location consistency
// - Scan pattern analysis
```

**Fix difficulty**: MEDIUM (requires analytics and pattern detection)

---

## Recommendations (Priority Order)

### 🔴 CRITICAL (Implement Immediately)

#### 1. **BLOCK URL-BASED CHAIN TRANSFER** (Highest Priority)
**Problem**: Students can open QR URLs directly instead of scanning with camera
**Solution**: Force actual camera-based QR scanning

**Implementation options**:

**Option A: Challenge-Response System** (Recommended)
```typescript
// When generating holder QR:
1. Generate random challenge code (6 digits)
2. Display challenge on holder's screen (not in QR)
3. QR contains: sessionId, chainId, tokenId, challengeHash
4. Scanner must scan QR AND enter challenge code manually
5. Backend validates: hash(enteredCode) === challengeHash

// This forces scanner to see holder's screen (physical proximity)
```

**Option B: Time-Based One-Time Password (TOTP)**
```typescript
// Holder's screen shows:
- QR code with tokenId
- 6-digit TOTP that changes every 5 seconds
// Scanner must:
- Scan QR with camera
- Manually enter current TOTP
// Cannot share via screenshot (TOTP expires)
```

**Option C: Visual Proof Requirement**
```typescript
// Scanner must:
1. Scan holder's QR with camera
2. Take photo of holder's screen showing the QR
3. Backend uses computer vision to verify:
   - Photo contains QR code
   - QR is displayed on phone screen (not printed)
   - Photo is not a screenshot (check EXIF, lighting)
```

**Impact**: Blocks remote token sharing entirely

---

#### 2. Add Proximity Verification (BLE Beacon)
**Problem**: No verification that students are physically near each other
**Solution**: Use Bluetooth Low Energy for proximity detection

**Implementation**:
```typescript
// Holder's device:
1. Broadcasts BLE beacon with UUID (range: 1-3 meters)
2. Beacon payload: encrypted(tokenId + timestamp)

// Scanner's device:
1. Scans for BLE beacons
2. Detects holder's beacon (proves proximity)
3. Sends beacon data + tokenId to backend
4. Backend validates: beacon matches token
```

**Advantages**: Very short range, hard to spoof, works indoors  
**Disadvantages**: Requires BLE permission, limited browser support

**Alternative**: NFC tap (even shorter range ~4cm)

---

#### 3. Implement Scan Pattern Detection (Anti-Collusion)
**Problem**: No detection of suspicious chain transfer patterns  
**Solution**: Real-time pattern analysis and flagging

**Detect suspicious patterns**:
1. Same holder → 3+ scanners within 30 seconds (AMPLIFICATION ATTACK)
2. Multiple scans from same IP address (DEVICE SHARING)
3. Scanner location > 100m from previous holder (REMOTE SHARING)
4. Scan timing < 5 seconds (TOO FAST - automated)

**Actions**: Flag for teacher review, block if confidence > 90%

---

#### 4. Implement Exit Chain
**Action**: Complete `startExitChain.ts` implementation
- Copy entry chain logic
- Reverse flow: last 3 students scan teacher's exit QR
- Verify students stayed for minimum duration

---

#### 5. Add Token Device Binding
**Action**: Bind tokens to device fingerprint

```typescript
const deviceFingerprint = crypto.createHash('sha256')
  .update(userAgent + screenResolution + timezone + language + canvas)
  .digest('hex');
```

---

### 🟡 HIGH (Implement Soon)

#### 6. Enhanced Geolocation Verification
**Actions**:
- Require minimum GPS accuracy (< 20m)
- Cross-check with IP geolocation
- Detect GPS spoofing patterns (impossible speeds, teleportation)
- Use cell tower triangulation as backup

#### 5. Scan Pattern Analysis
**Actions**:
- Log all scan events with metadata (IP, timing, location)
- Detect suspicious patterns:
  - Same holder → multiple scanners in rapid succession
  - Scans from same IP address
  - Geographically impossible sequences
- Flag for teacher review

#### 6. Reduce Token Expiration
**Action**: Reduce from 20s to 10s or less
- Makes digital sharing harder
- Forces faster chain progression
- Reduces window for coordination

---

### 🟢 MEDIUM (Nice to Have)

#### 7. Add Rate Limiting
**Action**: Limit scans per student per session
- Max 1 scan per chain (prevent retry attacks)
- Max 3 chains per student (prevent gaming system)

#### 8. Visual Confirmation
**Action**: Require scanner to take photo of holder's QR
- Store photo as proof of physical presence
- Use computer vision to verify QR is on phone screen
- Detect screenshots vs. live display

#### 9. Blockchain/Audit Trail
**Action**: Create immutable audit log
- Record all chain transfers with cryptographic signatures
- Prevent retroactive tampering
- Enable forensic analysis

---

## Detection Strategies (For Existing System)

### Analyze Existing Data for Cheating

#### Red Flags to Check:
1. **Same holder → multiple scanners**: One student passing to many others quickly
2. **Identical GPS coordinates**: Multiple students reporting exact same location
3. **Scan timing patterns**: Suspiciously regular intervals (automated)
4. **IP address clustering**: Multiple students from same IP (one device)
5. **Geolocation outliers**: Students marked present but GPS shows elsewhere

#### SQL Queries (if using SQL):
```sql
-- Find students who passed chain to many others
SELECT previousHolder, COUNT(*) as pass_count
FROM chain_scans
GROUP BY previousHolder
HAVING pass_count > 5;

-- Find scans with identical GPS
SELECT scanLocation, COUNT(*) as student_count
FROM attendance
WHERE scanLocation IS NOT NULL
GROUP BY scanLocation
HAVING student_count > 3;
```

---

## Conclusion

### Current Security Posture: ⚠️ WEAK

**Strengths**:
- ✅ Token-based chain system prevents simple replay attacks
- ✅ Self-scan prevention works
- ✅ Role-based access control is solid
- ✅ Geolocation framework exists (but bypassable)

**Critical Gaps**:
- ❌ No proximity verification (students can be anywhere)
- ❌ GPS spoofing is trivial
- ❌ Digital QR sharing is undetectable
- ❌ Exit chain not implemented
- ❌ No collusion detection

### Cheating Difficulty: 🟢 TRIVIAL

**A coordinated group of 3 students in class can mark the entire class present:**

**Step-by-step attack**:
1. Teacher seeds entry → 3 students (A, B, C) in class become holders
2. Each creates group chat with 10 absent friends
3. Each screenshots their QR or copies URL from browser
4. Each sends to their group within 5 seconds
5. All 30 absent students open URLs within 20 seconds
6. All 30 become holders and are marked present
7. Continue passing among themselves until all marked

**Time required**: < 2 minutes for entire class  
**Technical skill**: None (copy/paste URL)  
**Detection risk**: Zero (no pattern analysis)  
**Success rate**: ~100% if coordinated

**Real-world scenario**:
```
Class size: 40 students
Actually present: 3 students (7.5%)
Marked present: 40 students (100%)
Time to cheat: 90 seconds
Teacher awareness: None (system shows all present)
```

### Recommended Next Steps:
1. ✅ Implement BLE proximity verification (blocks remote scans)
2. ✅ Complete exit chain (verifies full attendance)
3. ✅ Add device fingerprinting (prevents token sharing)
4. ✅ Enable scan pattern analysis (detects collusion)
5. ✅ Reduce token expiration to 10s (limits sharing window)

**With these fixes, cheating difficulty**: 🔴 HARD


---

## UPDATED ANALYSIS SUMMARY

### The Core Problem: URL-Based Chain Transfer

The system was **designed** for physical QR scanning but **implemented** to accept URL opening, which completely bypasses physical proximity requirements.

### Most Critical Vulnerability: Chain Amplification Attack

**Scenario**: 3 students in class can mark entire class present in < 2 minutes
1. Teacher seeds 3 chains → Students A, B, C become holders
2. Each shares token URL to 10 absent friends via group chat
3. All 30 absent students open URLs within 20 seconds
4. All marked present, continue passing chains remotely
5. **Result**: 40 students marked present, only 3 actually in class

**Why it works**:
- ✅ No proximity verification (URL can be opened anywhere)
- ✅ No pattern detection (amplification not flagged)
- ✅ GPS easily spoofed
- ✅ 20 seconds is enough for coordinated sharing
- ✅ Previous holder marked present when ANYONE scans their token

### Immediate Fix Required

**Priority #1: Challenge-Response System**
- Display 6-digit code on holder's screen (NOT in QR)
- Scanner must scan QR AND manually enter code
- Forces scanner to see holder's screen (physical proximity)
- Blocks remote URL sharing (code not in screenshot)

**Implementation**:
```typescript
// Holder screen shows:
QR Code + "Challenge: 847293"

// QR contains:
{tokenId: "abc", challengeHash: hash("847293")}

// Scanner must:
1. Scan QR with camera
2. Manually type: 847293
3. Backend validates: hash(entered) === challengeHash
```

This single change blocks ALL remote sharing attacks.

### Current Security Rating: 🔴 CRITICAL

**Exploitability**: Trivial (copy/paste URL)  
**Impact**: Entire class can cheat with 3 students  
**Detection**: None (no pattern analysis)  
**Recommended action**: Implement challenge-response immediately

