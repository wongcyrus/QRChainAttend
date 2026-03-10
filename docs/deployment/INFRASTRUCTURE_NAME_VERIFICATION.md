# Infrastructure vs Backend Name Verification

## Blob Containers

| Bicep Infrastructure | Backend Code | Status |
|---------------------|--------------|--------|
| `quiz-slides` | `quiz-slides` | ✅ Match |
| `student-captures` | `student-captures` (after fix) | ✅ Match |

## Table Storage

| Bicep Infrastructure | Backend Code (TableNames) | Status |
|---------------------|---------------------------|--------|
| `Sessions` | `Sessions` | ✅ Match |
| `Attendance` | `Attendance` | ✅ Match |
| `Tokens` | `Tokens` | ✅ Match |
| `Chains` | `Chains` | ✅ Match |
| `ScanLogs` | `ScanLogs` | ✅ Match |
| `UserSessions` | `UserSessions` | ✅ Match |
| `AttendanceSnapshots` | `AttendanceSnapshots` | ✅ Match |
| `ChainHistory` | `ChainHistory` | ✅ Match |
| `DeletionLog` | `DeletionLog` | ✅ Match |
| `QuizQuestions` | `QuizQuestions` | ✅ Match |
| `QuizResponses` | `QuizResponses` | ✅ Match |
| `QuizMetrics` | `QuizMetrics` | ✅ Match |
| `QuizConversations` | `QuizConversations` | ✅ Match |
| `CaptureRequests` | `CaptureRequests` | ✅ Match |
| `CaptureUploads` | `CaptureUploads` | ✅ Match |
| `CaptureResults` | `CaptureResults` | ✅ Match |
| `ExternalTeachers` | `ExternalOrganizers` | ❌ **MISMATCH** |
| `OtpCodes` | `OtpCodes` | ✅ Match |

## Issues Found

### 1. ✅ FIXED: Blob Container Name
- **Issue**: Backend used `attendee-captures`, infrastructure created `student-captures`
- **Impact**: Students got "container not found" error when uploading images
- **Fix**: Changed `STUDENT_CAPTURES_CONTAINER` constant to `'student-captures'`
- **File**: `backend/src/utils/blobStorage.ts`

### 2. ❌ NEEDS FIX: External Organizers Table
- **Issue**: Backend uses `ExternalOrganizers`, infrastructure creates `ExternalTeachers`
- **Impact**: External organizer management will fail (table not found)
- **Backend usage**:
  - `backend/src/utils/database.ts`: `EXTERNAL_TEACHERS: 'ExternalOrganizers'`
  - `backend/src/utils/auth.ts`: Hardcoded `'ExternalOrganizers'`
  - `backend/src/functions/manageExternalOrganizers.ts`: Uses the table
- **Recommendation**: Update Bicep to use `ExternalOrganizers` (matches backend naming convention)

## Recommended Fix

Update `infrastructure/modules/storage.bicep` line 152:

```bicep
// Before
resource externalTeachersTable 'Microsoft.Storage/storageAccounts/tableServices/tables@2023-01-01' = {
  parent: tableService
  name: 'ExternalTeachers'
}

// After
resource externalTeachersTable 'Microsoft.Storage/storageAccounts/tableServices/tables@2023-01-01' = {
  parent: tableService
  name: 'ExternalOrganizers'
}
```

## Verification Commands

```bash
# Check all table names in backend
grep -r "TableNames\." backend/src --include="*.ts" | grep -v "test" | sort -u

# Check all hardcoded table names
grep -r "getTableClient\|TableClient.fromConnectionString" backend/src --include="*.ts" -A 1

# Check blob container names
grep -r "getContainerClient\|CONTAINER" backend/src --include="*.ts"
```
