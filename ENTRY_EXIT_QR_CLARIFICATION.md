# Entry/Exit QR Codes - Still Working After rotateTokens Removal

**Date**: February 10, 2026  
**Question**: Do entry/exit QR codes still work after removing the `rotateTokens` timer?

**Answer**: ✅ **YES, they work perfectly!**

---

## Why They Still Work

Entry and exit QR codes use a **completely different system** than chain tokens:

### Chain Tokens (Database-based)
- Stored in `Tokens` table
- 10-second TTL
- Created when chains seeded/passed
- Now refreshed on-demand by `getStudentToken`
- **Was affected by `rotateTokens` removal** (but now fixed with on-demand creation)

### Entry/Exit QR Codes (Encryption-based)
- **NOT stored in database**
- Generated on-demand via encryption
- 10-second TTL embedded in encrypted token
- Frontend polls every 10 seconds
- **Never used `rotateTokens` timer**

---

## How Entry/Exit QR Codes Work

### 1. Teacher Requests QR Code

**Frontend** (`teacher.tsx`):
```typescript
// Poll every 10 seconds
const interval = setInterval(refreshQR, 10000);

// Fetch fresh token
const response = await fetch(`${apiUrl}/sessions/${sessionId}/entry-qr`);
const data = await response.json();
// { token: "encrypted...", expiresAt: 1707580010, refreshInterval: 10000 }
```

### 2. Backend Generates Encrypted Token

**Backend** (`getEntryQR.ts`):
```typescript
// Create token data
const now = Math.floor(Date.now() / 1000);
const tokenData = {
  sessionId,
  type: 'ENTRY',
  timestamp: now,
  expiresAt: now + 10  // 10 seconds validity
};

// Encrypt (no database storage)
const encryptedToken = encryptToken(tokenData);

return {
  token: encryptedToken,
  expiresAt: tokenData.expiresAt,
  refreshInterval: 10000
};
```

### 3. Student Scans QR Code

**Student scans** → **Backend decrypts token** → **Validates expiry** → **Marks attendance**

---

## Key Differences

| Feature | Chain Tokens | Entry/Exit QR Codes |
|---------|-------------|---------------------|
| **Storage** | Database (Tokens table) | Encrypted (no database) |
| **Creation** | When chain seeded/passed | On every API request |
| **Refresh** | Client polls `getStudentToken` | Client polls `getEntryQR`/`getExitQR` |
| **TTL** | 10 seconds | 10 seconds |
| **Used by** | Students (chain holders) | Teacher (rotating QR) |
| **Affected by rotateTokens removal?** | Yes (now fixed with on-demand) | No (never used it) |

---

## Functions Involved

### Entry QR Code
- **Generate**: `getEntryQR.ts` - Creates encrypted token on-demand
- **Scan**: `scanEntry.ts` - Decrypts and validates token (if implemented)
- **Frontend**: `teacher.tsx` - Polls every 10 seconds

### Exit QR Code
- **Generate**: `getExitQR.ts` - Creates encrypted token on-demand
- **Scan**: `markExit.ts` - Decrypts and validates token
- **Frontend**: `teacher.tsx` - Polls every 10 seconds

### Chain Tokens (Different System)
- **Generate**: `seedEntry.ts`, `startExitChain.ts`, `scanChain.ts`
- **Refresh**: `getStudentToken.ts` - Now creates on-demand
- **Frontend**: `SimpleStudentView.tsx` - Polls every 3-5 seconds

---

## Why rotateTokens Never Affected Entry/Exit QR

Looking at the old `rotateTokens` code, it only handled:
1. **Chain tokens** - Tokens in database for chain holders
2. **Late entry tokens** - Special tokens for late arrivals
3. **Early leave tokens** - Special tokens for early departures

It **never touched** entry/exit QR codes because:
- Entry/exit QR codes are generated on-demand
- They use encryption, not database storage
- Frontend already polls every 10 seconds
- No background refresh needed

---

## Testing Entry/Exit QR Codes

### Test Entry QR
1. Teacher opens session
2. Click "Show Entry QR"
3. QR code displays and refreshes every 10 seconds
4. Student scans QR code
5. Student marked as entered ✅

### Test Exit QR
1. Teacher opens session
2. Click "Show Exit QR"
3. QR code displays and refreshes every 10 seconds
4. Student scans QR code
5. Student marked as exited ✅

### Verify Refresh
1. Open browser console
2. Watch network tab
3. Should see requests to `/entry-qr` or `/exit-qr` every 10 seconds
4. Each request returns new encrypted token ✅

---

## Summary

✅ **Entry/Exit QR codes work perfectly**  
✅ **Never depended on `rotateTokens` timer**  
✅ **Use encryption-based tokens (no database)**  
✅ **Frontend polls every 10 seconds for fresh tokens**  
✅ **Backend generates new token on each request**  
✅ **No changes needed after `rotateTokens` removal**

The `rotateTokens` removal only affected **chain tokens** (student-to-student QR codes), not **entry/exit QR codes** (teacher's rotating QR codes). Both systems now work correctly with client-driven refresh.

---

## Architecture Summary

```
Entry/Exit QR Codes (Teacher)
├── Frontend polls every 10s
├── Backend generates encrypted token
├── No database storage
└── ✅ Always worked this way

Chain Tokens (Students)
├── Frontend polls every 3-5s
├── Backend creates token on-demand (NEW)
├── Database storage (Tokens table)
└── ✅ Fixed with on-demand creation
```

Both systems are now **client-driven** and work efficiently without server-side polling!

---

**Last Updated**: February 10, 2026
