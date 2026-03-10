# Name Mismatch Fixes Summary

## Issues Found and Fixed

### 1. ✅ Blob Container: `student-captures`
**Problem**: Backend used `attendee-captures`, infrastructure created `student-captures`

**Impact**: Students uploading images got "container not found" error

**Fix Applied**:
- File: `backend/src/utils/blobStorage.ts`
- Changed: `STUDENT_CAPTURES_CONTAINER = 'attendee-captures'` → `'student-captures'`

### 2. ✅ Table: `ExternalOrganizers`
**Problem**: Backend used `ExternalOrganizers`, infrastructure created `ExternalTeachers`

**Impact**: External organizer management API would fail with table not found

**Fix Applied**:
- File: `infrastructure/modules/storage.bicep`
- Changed: `name: 'ExternalTeachers'` → `'ExternalOrganizers'`

## All Names Now Match

### Blob Containers (2)
- ✅ `quiz-slides`
- ✅ `student-captures`

### Tables (18)
- ✅ `Sessions`
- ✅ `Attendance`
- ✅ `Tokens`
- ✅ `Chains`
- ✅ `ScanLogs`
- ✅ `UserSessions`
- ✅ `AttendanceSnapshots`
- ✅ `ChainHistory`
- ✅ `DeletionLog`
- ✅ `QuizQuestions`
- ✅ `QuizResponses`
- ✅ `QuizMetrics`
- ✅ `QuizConversations`
- ✅ `CaptureRequests`
- ✅ `CaptureUploads`
- ✅ `CaptureResults`
- ✅ `ExternalOrganizers`
- ✅ `OtpCodes`

## Next Steps

1. Redeploy infrastructure: `./deploy-full-production.sh`
2. Backend will automatically use correct names
3. Test student image upload
4. Test external organizer management
