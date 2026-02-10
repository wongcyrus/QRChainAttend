# Token Expiry Bug Fix

**Date**: February 10, 2026  
**Issue**: Tokens not expiring correctly when chains are passed between students

---

## Problem

When a student scanned another student's QR code to pass the chain, the new token was created with an incorrect expiry time:

```typescript
// WRONG - in scanChain.ts
const tokenTTL = parseInt(process.env.CHAIN_TOKEN_TTL_SECONDS || '20');
const newExpiresAt = now + (tokenTTL * 1000);  // ❌ Multiplying by 1000!
```

**Result**: Tokens expired in 10,000 seconds (2.7 hours) instead of 10 seconds

**Impact**:
- Students could keep showing the same QR code for hours
- Defeats the purpose of short-lived tokens
- Security risk (token sharing possible)
- Chain rotation didn't work as intended

---

## Root Cause

**Timestamp inconsistency**: 
- `now` is in **seconds** (Unix timestamp)
- `tokenTTL` is in **seconds** (from env var)
- Multiplying by 1000 converts to **milliseconds**
- But `now` is already in seconds, so result is wrong

**Example**:
```typescript
now = 1707580000 (seconds)
tokenTTL = 10 (seconds)
newExpiresAt = 1707580000 + (10 * 1000) = 1707590000
// This is 10,000 seconds in the future, not 10!
```

---

## Fix

**File**: `backend/src/functions/scanChain.ts`

**Before**:
```typescript
const tokenTTL = parseInt(process.env.CHAIN_TOKEN_TTL_SECONDS || '20');
const newExpiresAt = now + (tokenTTL * 1000);
```

**After**:
```typescript
const tokenTTL = parseInt(process.env.CHAIN_TOKEN_TTL_SECONDS || '10');
const newExpiresAt = now + tokenTTL; // now is already in seconds
```

**Changes**:
1. Removed `* 1000` multiplication
2. Updated default from 20 to 10 seconds (consistent with other functions)
3. Added comment explaining `now` is in seconds

---

## Verification

### Other Functions Checked ✅

**seedEntry.ts** - ✅ Correct
```typescript
const expiresAt = now + 10; // 10 seconds
```

**startExitChain.ts** - ✅ Correct
```typescript
const expiresAt = now + 10; // 10 seconds
```

**takeSnapshot.ts** - ✅ Correct
```typescript
const tokenTTL = 10; // 10 seconds
const expiresAt = now + tokenTTL;
```

**getStudentToken.ts** - ✅ Correct (on-demand creation)
```typescript
const tokenTTL = parseInt(process.env.CHAIN_TOKEN_TTL_SECONDS || '10');
const newExpiresAt = now + tokenTTL;
```

**Only `scanChain.ts` had the bug!**

---

## Testing

### Test Scenario 1: Initial Holder
1. Teacher seeds entry chains
2. Student A becomes holder
3. Check token expiry: `expiresAt - now` should be ~10 seconds ✅

### Test Scenario 2: Chain Passing
1. Student A is holder
2. Student B scans Student A's QR code
3. Student B becomes new holder
4. Check token expiry: `expiresAt - now` should be ~10 seconds ✅ (FIXED)

### Test Scenario 3: Token Refresh
1. Student is holder
2. Wait 10 seconds for token to expire
3. Student polls `getStudentToken`
4. New token created on-demand
5. Check token expiry: `expiresAt - now` should be ~10 seconds ✅

---

## Impact Analysis

### Before Fix
- Initial tokens: 10 seconds ✅
- Passed tokens: 10,000 seconds ❌
- On-demand tokens: 10 seconds ✅

### After Fix
- Initial tokens: 10 seconds ✅
- Passed tokens: 10 seconds ✅
- On-demand tokens: 10 seconds ✅

**All tokens now expire correctly!**

---

## Related Changes

This fix complements the **Token Refresh Optimization** (see TOKEN_REFRESH_OPTIMIZATION.md):

1. **Disabled server-side timer** - No more background polling
2. **Client-driven refresh** - Tokens created on-demand
3. **Fixed expiry calculation** - Tokens now expire correctly

Together, these changes ensure:
- Tokens expire in 10 seconds as intended
- New tokens created automatically when needed
- No redundant server-side processing
- Lower costs and better performance

---

## Deployment Notes

### No Breaking Changes
- API unchanged
- Client code unchanged
- Database schema unchanged
- Backward compatible

### Deployment Steps
1. Deploy fixed `scanChain.ts` function
2. Test chain passing between students
3. Verify tokens expire in 10 seconds
4. Monitor logs for correct behavior

### Verification Commands
```bash
# Check token expiry in database
az storage entity query \
  --table-name Tokens \
  --filter "PartitionKey eq 'session-id'" \
  --select expiresAt,createdAt \
  --output table

# Calculate TTL: expiresAt - createdAt should be 10
```

---

## Summary

✅ **Fixed token expiry bug in scanChain.ts**  
✅ **Tokens now expire in 10 seconds (not 10,000)**  
✅ **Consistent with all other token creation functions**  
✅ **Security improved (short-lived tokens work correctly)**  
✅ **No breaking changes or migration needed**

The bug was a simple timestamp unit mismatch - multiplying seconds by 1000 when `now` was already in seconds. Now all tokens expire correctly after 10 seconds.

---

**Last Updated**: February 10, 2026
