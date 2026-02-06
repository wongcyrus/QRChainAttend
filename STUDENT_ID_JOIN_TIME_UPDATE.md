# Student ID and Join Time Update

**Date**: February 6, 2026

## Changes Made

### 1. Student ID Display Format

**Change**: Remove `@stu.vtc.edu.hk` domain from student IDs in all displays and exports.

**Affected Components**:
- **TeacherDashboard.tsx**: Added `formatStudentId()` helper function
- **SessionEndAndExportControls.tsx**: Format student IDs in table and CSV export

**Before**: `t-cywong@stu.vtc.edu.hk`
**After**: `t-cywong`

### 2. Join Time Tracking

**Change**: Track when students join a session (not just when they scan entry QR).

**Implementation**:

#### Backend Changes

**joinSession.ts**:
- Added `joinedAt` timestamp when creating attendance record
- Timestamp is Unix epoch in seconds: `Math.floor(Date.now() / 1000)`

**getAttendance.ts**:
- Added `joinedAt` field to returned attendance records
- Fallback to Azure Table Storage `Timestamp` for existing records without `joinedAt`

**getSession.ts**:
- Added `joinedAt` field to attendance records in dashboard data
- Fallback to `Timestamp` for backward compatibility

#### Frontend Changes

**TeacherDashboard.tsx**:
- Added `joinedAt?: number` to `AttendanceRecord` interface
- Added "Join Time" column to student attendance table
- Displays formatted join timestamp

**SessionEndAndExportControls.tsx**:
- Added `joinedAt?: number` to `AttendanceRecord` interface
- Added "Join Time" column to detailed attendance table
- Added "Join Time" to CSV export (second column)

### 3. Timestamp Fallback Logic

For **existing records** that don't have `joinedAt`:
- Use Azure Table Storage's `Timestamp` field
- `Timestamp` represents the last modified time of the entity
- Convert to Unix epoch: `Math.floor(new Date(entity.timestamp).getTime() / 1000)`

For **new records** (created after this update):
- `joinedAt` is explicitly set when student joins session
- More accurate than `Timestamp` which can change on updates

## Data Structure

### Attendance Record (Updated)

```typescript
interface AttendanceRecord {
  sessionId: string;
  studentId: string;
  joinedAt?: number;        // NEW: When student joined session
  entryStatus?: EntryStatus;
  entryAt?: number;         // When student scanned entry QR
  exitVerified: boolean;
  exitVerifiedAt?: number;
  earlyLeaveAt?: number;
  finalStatus?: FinalStatus;
}
```

## CSV Export Format (Updated)

```csv
Student ID,Join Time,Entry Status,Entry Time,Exit Verified,Exit Time,Early Leave Time,Final Status
t-cywong,2/6/2026 1:30:00 PM,PRESENT_ENTRY,2/6/2026 1:35:00 PM,Yes,2/6/2026 3:00:00 PM,,PRESENT
```

## Display Changes

### Teacher Dashboard - Student Attendance Table

**Columns** (in order):
1. Student ID (formatted, no domain)
2. **Join Time** (NEW)
3. Online Status
4. Chain Holder
5. Status
6. Entry Time
7. Exit Verified
8. Exit Time
9. Early Leave

### Session End Controls - Detailed Attendance Table

**Columns** (in order):
1. Student ID (formatted, no domain)
2. **Join Time** (NEW)
3. Final Status
4. Entry Status
5. Entry Time
6. Exit Verified
7. Exit Time
8. Early Leave Time

## Timeline Explanation

For a typical student flow:

1. **Join Time** (`joinedAt`): Student clicks "Join Session" button
   - Recorded immediately when joining
   - Example: 1:30 PM

2. **Entry Time** (`entryAt`): Student scans entry QR code
   - Recorded when they scan the QR chain for entry
   - Example: 1:35 PM (5 minutes after joining)

3. **Exit Time** (`exitVerifiedAt`): Student scans exit QR code
   - Recorded when they scan the QR chain for exit
   - Example: 3:00 PM

## Backward Compatibility

- Existing attendance records without `joinedAt` will show the `Timestamp` value
- `Timestamp` is the last modified time, so it may not be the exact join time
- New records will have accurate `joinedAt` timestamps
- No data migration needed - fallback handles old records automatically

## Testing

To test the changes:

1. **Create a new session** as a teacher
2. **Join the session** as a student
3. **Check the dashboard** - Join Time should appear immediately
4. **Scan entry QR** - Entry Time should appear (different from Join Time)
5. **Export CSV** - Verify Student ID is formatted and Join Time is included

## Files Modified

### Backend
- `backend/src/functions/joinSession.ts`
- `backend/src/functions/getAttendance.ts`
- `backend/src/functions/getSession.ts`

### Frontend
- `frontend/src/components/TeacherDashboard.tsx`
- `frontend/src/components/SessionEndAndExportControls.tsx`

## Deployment

✅ Deployed to production: February 6, 2026
- Backend: All 29 functions deployed
- Frontend: Static Web App updated
- Production URL: https://red-grass-0f8bc910f.4.azurestaticapps.net

---

**Summary**: Student IDs now display without the email domain, and join time is tracked separately from entry time, providing better visibility into when students actually joined the session versus when they scanned the entry QR code.
