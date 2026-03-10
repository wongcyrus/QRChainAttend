# Delete Functions UI Implementation

## Summary

Added missing delete buttons in the UI to match the backend delete APIs that were implemented in the previous session.

## Backend Delete APIs (Already Implemented)

1. ✅ `DELETE /api/sessions/{sessionId}` - Delete entire session
2. ✅ `DELETE /api/sessions/{sessionId}/attendance/{attendeeId}` - Delete single attendance
3. ✅ `DELETE /api/sessions/{sessionId}/attendance?all=true` - Bulk delete attendance
4. ✅ `DELETE /api/sessions/{sessionId}/quiz/questions/{questionId}` - Delete quiz question
5. ✅ `DELETE /api/sessions/{sessionId}/snapshots/{snapshotId}` - Delete snapshot
6. ✅ `DELETE /api/sessions/{sessionId}/captures/{captureRequestId}` - Delete capture

## UI Changes Made

### 1. MonitorTab - Attendance Management
**File**: `frontend/src/components/tabs/MonitorTab.tsx`

**Added:**
- Delete button for each individual attendance record
- "Delete All" button to bulk delete all attendance records
- `handleDeleteAttendance(attendeeId)` - Deletes single attendance record
- `handleBulkDeleteAttendance()` - Deletes all attendance records with confirmation
- New "Actions" column in attendance table
- Props: `sessionId` and `onRefresh` callback

**UI Location:**
- Individual delete: Each row in the attendance table has a 🗑️ Delete button
- Bulk delete: "🗑️ Delete All" button in the table header (next to GPS filter)

### 2. QuizManagement - Quiz Questions
**File**: `frontend/src/components/QuizManagement.tsx`

**Added:**
- Delete button for each quiz question
- `handleDeleteQuestion(questionId)` - Deletes question and all responses
- Button positioned in question header (before difficulty badge)

**UI Location:**
- Each quiz question card has a 🗑️ Delete button in the header

### 3. Parent Component Update
**File**: `frontend/src/components/OrganizerDashboardWithTabs.tsx`

**Updated:**
- Pass `sessionId` and `onRefresh={fetchSessionData}` to MonitorTab

## Already Existing Delete UIs

These were already implemented:
- ✅ Session deletion (SessionsList component)
- ✅ Snapshot deletion (SnapshotManager component)
- ✅ Capture request deletion (CaptureHistory component)

## User Flow

### Delete Individual Attendance
1. Go to Monitor tab
2. Find the attendee in the table
3. Click 🗑️ Delete button in the Actions column
4. Confirm deletion
5. Record is deleted and view refreshes

### Delete All Attendance
1. Go to Monitor tab
2. Click "🗑️ Delete All" button in table header
3. Confirm deletion of all records
4. All attendance records deleted and view refreshes

### Delete Quiz Question
1. Go to Quiz tab
2. Find the question
3. Click 🗑️ Delete button in question header
4. Confirm deletion
5. Question and all responses deleted, view refreshes

## Security

All delete operations:
- Require Organizer role authentication
- Show confirmation dialogs
- Display error messages on failure
- Refresh data after successful deletion
- Cannot be undone (as warned in confirmations)

## Build Status

✅ Frontend builds successfully with no errors
