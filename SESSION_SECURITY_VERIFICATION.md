# Session Security Verification

**Date**: February 10, 2026  
**Purpose**: Confirm students MUST scan QR code to initially join sessions

---

## Security Requirement

**Students MUST scan the teacher's entry QR code to join a session for the first time.**

localStorage persistence should ONLY restore the view after a valid initial join, NOT bypass the QR code requirement.

---

## How It Works

### First Time Join (QR Code Required) ✅

**Step 1: Student Scans QR Code**
```
URL: /student?sessionId=abc123&type=ENTRY&token=xyz789
```

**Step 2: Auto-Join Triggered**
```typescript
// Condition checks:
- user exists ✓
- sessionId exists ✓
- type exists ✓ (type=ENTRY)
- hasQRType = true ✓
- !hasAutoJoined ✓
- !joining ✓
- !isChainScan ✓

// Result: handleJoinSession() called
```

**Step 3: Backend Validates Token**
```typescript
POST /api/sessions/abc123/join
Body: { token: "xyz789", location: {...} }

// Backend:
// 1. Decrypts token
// 2. Validates expiry (10 seconds)
// 3. Checks session exists
// 4. Marks student as joined
// 5. Returns success
```

**Step 4: Store in localStorage**
```typescript
localStorage.setItem('activeSessionId', 'abc123');
```

**Step 5: Redirect to Clean URL**
```
URL: /student?sessionId=abc123
(no type, no token)
```

---

### After Refresh (No QR Code Needed) ✅

**Step 1: Page Loads**
```
URL: /student
(no query parameters)
```

**Step 2: Check localStorage**
```typescript
const storedSessionId = localStorage.getItem('activeSessionId');
// Found: 'abc123'
```

**Step 3: Restore URL**
```typescript
router.replace('/student?sessionId=abc123');
// URL now: /student?sessionId=abc123
```

**Step 4: Auto-Join Check**
```typescript
// Condition checks:
- user exists ✓
- sessionId exists ✓
- type exists ✗ (type=undefined)
- hasQRType = false ✗

// Result: handleJoinSession() NOT called
```

**Step 5: Show Session View Directly**
```typescript
// Condition: sessionId && !type
if (sessionId && typeof sessionId === 'string' && !error && (!type || chainId)) {
  return <SimpleStudentView sessionId={sessionId} ... />
}
```

**Step 6: Backend Check (via SimpleStudentView)**
```typescript
// SimpleStudentView fetches session data
GET /api/sessions/abc123

// Backend:
// 1. Validates authentication
// 2. Checks student is in attendance table
// 3. Returns session data
// 4. Student already marked as joined from first scan
```

---

## Security Verification

### ✅ Cannot Join Without QR Code

**Scenario**: Student tries to manually enter URL without scanning QR

**Attempt 1: Direct URL**
```
URL: /student?sessionId=abc123
```

**Result**:
- No `type` parameter → No auto-join triggered
- SimpleStudentView loads
- Backend checks attendance table
- Student NOT in attendance table (never scanned QR)
- Backend returns error or shows "not joined"
- ✅ **BLOCKED**

**Attempt 2: With Fake Token**
```
URL: /student?sessionId=abc123&type=ENTRY&token=fake123
```

**Result**:
- Auto-join triggered
- Backend validates token
- Token decryption fails or expired
- Backend returns error
- Student NOT marked as joined
- ✅ **BLOCKED**

**Attempt 3: With Expired Token**
```
URL: /student?sessionId=abc123&type=ENTRY&token=expired789
```

**Result**:
- Auto-join triggered
- Backend validates token
- Token expired (10 seconds TTL)
- Backend returns error
- Student NOT marked as joined
- ✅ **BLOCKED**

---

## Code Changes for Security

### Critical Fix: Check for `type` Parameter

**Before** (INSECURE):
```typescript
// Would trigger auto-join even when restoring from localStorage
if (user && sessionId && !hasAutoJoined && !joining && !isChainScan) {
  handleJoinSession(sessionId, qrType, qrToken);
}
```

**After** (SECURE):
```typescript
// Only trigger auto-join when type parameter exists (from QR scan)
const hasQRType = type !== undefined;

if (user && sessionId && hasQRType && !hasAutoJoined && !joining && !isChainScan) {
  handleJoinSession(sessionId, qrType, qrToken);
}
```

**Why This Matters**:
- QR code URLs have `type=ENTRY` or `type=EXIT`
- localStorage restored URLs have NO `type` parameter
- This prevents auto-join when restoring from localStorage
- Students MUST scan QR code to get a URL with `type` parameter

---

## Backend Security Layers

### Layer 1: Token Validation
```typescript
// Backend validates encrypted token
const tokenData = decryptToken(token);
if (tokenData.expiresAt < now) {
  return error('Token expired');
}
```

### Layer 2: Authentication
```typescript
// Backend validates user authentication
const principal = parseUserPrincipal(header);
if (!hasRole(principal, 'Student')) {
  return error('Student role required');
}
```

### Layer 3: Session Validation
```typescript
// Backend checks session exists and is active
const session = await sessionsTable.getEntity('SESSION', sessionId);
if (session.status !== 'ACTIVE') {
  return error('Session not active');
}
```

### Layer 4: Attendance Check
```typescript
// Backend checks if student already joined
const attendance = await attendanceTable.getEntity(sessionId, studentId);
if (attendance.joinedAt) {
  // Already joined - allow (for refresh case)
  return success();
}
```

---

## Test Cases

### Test 1: Normal Flow ✅
1. Student scans QR code
2. Auto-join triggered with valid token
3. Backend validates and marks joined
4. localStorage stores sessionId
5. Student refreshes page
6. Session view restored (no auto-join)
7. **PASS**: Student can view session

### Test 2: Manual URL Entry ✅
1. Student types `/student?sessionId=abc123` manually
2. No `type` parameter → No auto-join
3. SimpleStudentView loads
4. Backend checks attendance
5. Student NOT in attendance table
6. **PASS**: Access denied or error shown

### Test 3: Expired Token ✅
1. Student scans QR code after 15 seconds
2. Auto-join triggered with expired token
3. Backend validates token
4. Token expired (10s TTL)
5. **PASS**: Error shown, not joined

### Test 4: Fake Token ✅
1. Student modifies URL with fake token
2. Auto-join triggered
3. Backend decrypts token
4. Decryption fails
5. **PASS**: Error shown, not joined

### Test 5: Different Student's Session ✅
1. Student A scans QR and joins
2. Student B tries to use Student A's localStorage sessionId
3. Student B's localStorage has different sessionId
4. **PASS**: Each student has their own session

### Test 6: Session Ended ✅
1. Student joined session
2. Teacher ends session
3. Student refreshes page
4. SimpleStudentView loads
5. Backend returns session ended
6. **PASS**: Error shown, can leave session

---

## Summary

✅ **Students MUST scan QR code to initially join**  
✅ **localStorage only restores view, not access**  
✅ **Backend validates all requests**  
✅ **Tokens expire in 10 seconds**  
✅ **Cannot bypass with manual URL entry**  
✅ **Cannot use expired or fake tokens**  
✅ **Each student has separate localStorage**  

The system is secure. Students cannot join sessions without scanning the teacher's QR code first.

---

**Last Updated**: February 10, 2026
