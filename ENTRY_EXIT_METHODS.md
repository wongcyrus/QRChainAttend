# Entry and Exit Methods - Database Schema

## Overview

The system tracks 4 different methods for marking attendance:
1. **Entry Code** - Student scans teacher's rotating entry QR
2. **Entry Chain** - Student completes entry chain verification
3. **Exit Code** - Student scans teacher's rotating exit QR  
4. **Exit Chain** - Student completes exit chain verification

## Database Schema

### Attendance Table Fields

| Field | Type | Description |
|-------|------|-------------|
| `entryStatus` | String | "PRESENT_ENTRY" or "LATE_ENTRY" |
| `entryMethod` | String | "DIRECT_QR" or "CHAIN" |
| `entryAt` | Int32 | Unix timestamp (seconds) when entry was verified |
| `exitVerified` | Boolean | Whether student has exited |
| `exitMethod` | String | "DIRECT_QR" or "CHAIN" |
| `exitedAt` | Int32 | Unix timestamp (seconds) when exit was verified |

## Method Mapping

### Entry Code (Direct QR)
**Currently Not Implemented** - Students join session but entry is only marked via chains

### Entry Chain
**Function**: `scanChain.ts` and `closeChain.ts`
**Sets**:
- `entryStatus` = "PRESENT_ENTRY" or "LATE_ENTRY"
- `entryMethod` = "CHAIN"
- `entryAt` = timestamp

### Exit Code (Direct QR)
**Function**: `markExit.ts`
**Sets**:
- `exitVerified` = true
- `exitMethod` = "DIRECT_QR"
- `exitedAt` = timestamp

### Exit Chain
**Function**: `closeChain.ts`
**Sets**:
- `exitVerified` = true
- `exitMethod` = "CHAIN"
- `exitedAt` = timestamp

## UI Display

### Teacher Dashboard Table

| Column | Shows | Example |
|--------|-------|---------|
| Entry Time | `entryAt` timestamp | 3:16:23 PM |
| Entry Method | `entryMethod` | 🔗 Chain or 📱 QR |
| Exit Time | `exitedAt` timestamp | 3:49:29 PM |
| Exit Method | `exitMethod` | 🔗 Chain or 📱 QR |

### CSV Export

Columns:
- Student ID
- Join Time
- Entry Status
- Entry Time
- **Entry Method** (Chain / QR Code)
- Exit Time
- **Exit Method** (Chain / QR Code)
- Early Leave Time
- Final Status
- Location Warning
- Location Distance (m)

## Backend Functions Updated

1. ✅ `markExit.ts` - Sets `exitMethod: 'DIRECT_QR'`
2. ✅ `closeChain.ts` - Sets `entryMethod: 'CHAIN'` or `exitMethod: 'CHAIN'`
3. ✅ `scanChain.ts` - Sets `entryMethod: 'CHAIN'`
4. ✅ `getSession.ts` - Returns `entryMethod` and `exitMethod`
5. ✅ `getAttendance.ts` - Returns `entryMethod` and `exitMethod`

## Frontend Components Updated

1. ✅ `TeacherDashboard.tsx` - Displays method badges
2. ✅ `SessionEndAndExportControls.tsx` - Exports methods in CSV

## Visual Indicators

**Entry Method Badges:**
- 🔗 Chain - Blue background (#e0f2fe)
- 📱 QR - Yellow background (#fef3c7)

**Exit Method Badges:**
- 🔗 Chain - Blue background (#e0f2fe)
- 📱 QR - Yellow background (#fef3c7)

## Migration Notes

- Old records without `entryMethod` or `exitMethod` will show "—" in the UI
- New records will always have the method field populated
- The `exitVerified` boolean is kept for backward compatibility
- Removed old fields: `exitVerifiedAt` (replaced by `exitedAt` + `exitMethod`)
