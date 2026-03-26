# Implementation Plan: Attendee List Management

## Overview

Implement attendee email list management with master templates, per-session snapshot copies, check-in enforcement, absentee tracking, and attendance export enhancements. Tasks follow the order: database/utility changes → backend API endpoints → modifications to existing endpoints → frontend components → integration/wiring.

## Tasks

- [x] 1. Database and utility foundations
  - [x] 1.1 Add new table names and Bicep table definitions
    - Add `ATTENDEE_LIST_ENTRIES: 'AttendeeListEntries'` and `SESSION_ATTENDEE_ENTRIES: 'SessionAttendeeEntries'` to the `TableNames` constant in `backend/src/utils/database.ts`
    - Add `AttendeeListEntries` and `SessionAttendeeEntries` table resources to `infrastructure/modules/storage.bicep` following the existing pattern (e.g., `resource attendeeListEntriesTable 'Microsoft.Storage/storageAccounts/tableServices/tables@2023-01-01'` with `parent: tableService`)
    - _Requirements: 1.1, 3.1_

  - [x] 1.2 Create email validation utility at `backend/src/utils/emailValidation.ts`
    - Implement `isValidEmail(email: string): boolean` using the regex pattern from the design
    - Implement `normalizeEmail(email: string): string` that trims and lowercases
    - Implement `parseEmailInput(input: string): string[]` that splits on commas and newlines, trims, and filters empty strings
    - Implement `validateEmails(emails: string[]): { valid: string[]; invalid: string[] }` that validates and returns both sets
    - _Requirements: 1.2, 1.3, 8.4_

  - [ ]* 1.3 Write property test for email parsing (Property 16)
    - **Property 16: Email input parsing handles comma and newline separators**
    - **Validates: Requirements 8.4**

- [x] 2. Master attendee list CRUD endpoints
  - [x] 2.1 Create `backend/src/functions/createAttendeeList.ts`
    - POST `/attendee-lists` — validate organizer role, list name non-empty, emails non-empty, all emails valid format
    - Deduplicate emails, generate a `listId` UUID, store each unique email as an entry in `AttendeeListEntries` with `partitionKey=listId`, `rowKey=email(lowercased)`, denormalized `listName` and `organizerId`
    - Return 400 with `INVALID_EMAIL` code and `invalidEmails` array if any email is invalid; return 400 with `INVALID_REQUEST` if name or email list is empty
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5_

  - [ ]* 2.2 Write property test for list creation (Property 1)
    - **Property 1: List creation stores exactly the unique emails with correct ownership**
    - **Validates: Requirements 1.1, 1.2, 1.4**

  - [ ]* 2.3 Write property test for invalid input rejection (Property 2)
    - **Property 2: Invalid input rejection for list creation**
    - **Validates: Requirements 1.3, 1.5**

  - [x] 2.4 Create `backend/src/functions/getAttendeeLists.ts`
    - GET `/attendee-lists` — return all master lists owned by the authenticated organizer
    - Query `AttendeeListEntries` filtering by `organizerId`, group by `partitionKey` (listId) to return list metadata (listId, listName, email count)
    - _Requirements: 2.1_

  - [x] 2.5 Create `backend/src/functions/getAttendeeList.ts`
    - GET `/attendee-lists/{listId}` — return a single master list with all its email entries
    - Verify the organizer owns the list (check `organizerId` on entries); return 403 if not owner
    - _Requirements: 2.1, 2.5_

  - [x] 2.6 Create `backend/src/functions/updateAttendeeList.ts`
    - PATCH `/attendee-lists/{listId}` — accept `{ addEmails?: string[], removeEmails?: string[] }`
    - Verify ownership; append new unique entries, delete specified entries
    - Validate any new emails; return 400 with `INVALID_EMAIL` if invalid
    - _Requirements: 2.2, 2.3, 2.5_

  - [ ]* 2.7 Write property test for master list add/remove (Property 4)
    - **Property 4: Master list add/remove correctness**
    - **Validates: Requirements 2.2, 2.3**

  - [x] 2.8 Create `backend/src/functions/deleteAttendeeList.ts`
    - DELETE `/attendee-lists/{listId}` — verify ownership, delete all entries for the list from `AttendeeListEntries`
    - _Requirements: 2.4, 2.5_

  - [ ]* 2.9 Write property test for master list deletion (Property 5)
    - **Property 5: Master list deletion removes all entries**
    - **Validates: Requirements 2.4**

- [x] 3. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 4. Session attendee list endpoints (link, get, update, unlink)
  - [x] 4.1 Create `backend/src/functions/linkAttendeeListToSession.ts`
    - POST `/sessions/{sessionId}/attendee-list` — accept `{ listId }`, verify organizer has access to both session and list
    - Read all entries from `AttendeeListEntries` for the listId, write copies into `SessionAttendeeEntries` with `partitionKey=sessionId`, `rowKey=email`, `sourceListId`, `addedBy='SNAPSHOT'`
    - Update session entity with `attendeeListId` and `hasAttendeeList=true`
    - Return 409 `LIST_ALREADY_LINKED` if session already has a list
    - _Requirements: 3.1, 3.2, 3.4, 3.6_

  - [ ]* 4.2 Write property test for snapshot copy (Property 8)
    - **Property 8: Snapshot copies all emails and records source**
    - **Validates: Requirements 3.1, 3.2**

  - [x] 4.3 Create `backend/src/functions/getSessionAttendeeList.ts`
    - GET `/sessions/{sessionId}/attendee-list` — verify session access, return all entries from `SessionAttendeeEntries` for the session
    - _Requirements: 4.6_

  - [x] 4.4 Create `backend/src/functions/updateSessionAttendeeList.ts`
    - PATCH `/sessions/{sessionId}/attendee-list` — accept `{ addEmails?: string[], removeEmails?: string[] }`
    - Verify session access; for adds, check duplicates and return 409 `DUPLICATE_EMAIL` if email already exists; validate email format
    - For removes, delete matching entries from `SessionAttendeeEntries`
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5_

  - [ ]* 4.5 Write property test for session list add/remove with duplicate rejection (Property 11)
    - **Property 11: Session list add/remove with duplicate rejection**
    - **Validates: Requirements 4.1, 4.2, 4.3**

  - [x] 4.6 Create `backend/src/functions/unlinkSessionAttendeeList.ts`
    - DELETE `/sessions/{sessionId}/attendee-list` — verify session access, delete all `SessionAttendeeEntries` for the session, set `hasAttendeeList=false` and clear `attendeeListId` on session entity
    - _Requirements: 3.5_

  - [ ]* 4.7 Write property test for unlink (Property 9)
    - **Property 9: Unlink removes all session entries and reverts to open check-in**
    - **Validates: Requirements 3.5**

- [x] 5. Modify existing backend endpoints
  - [x] 5.1 Modify `backend/src/functions/joinSession.ts` to enforce attendee list
    - After session lookup, check `session.hasAttendeeList`; if true, query `SessionAttendeeEntries` for `partitionKey=sessionId, rowKey=attendeeEmail(lowercased)`
    - If entry not found, return 403 with error code `NOT_ON_ATTENDEE_LIST`
    - If no attendee list exists, allow check-in as before (existing behavior unchanged)
    - _Requirements: 5.1, 5.2, 5.3, 5.4_

  - [ ]* 5.2 Write property test for check-in enforcement (Property 12)
    - **Property 12: Check-in enforcement based on attendee list presence**
    - **Validates: Requirements 5.1, 5.2, 5.3, 5.4**

  - [x] 5.3 Modify `backend/src/functions/getAttendance.ts` to include absentees
    - After fetching attendance records, check if session has `hasAttendeeList=true`
    - If yes, fetch all `SessionAttendeeEntries` for the session, compute absentees (emails in session list but not in attendance), append absentee records with `finalStatus: 'ABSENT'`
    - Add a `listSummary` field: `{ totalListed, presentCount, absentCount }`
    - If no attendee list, return existing behavior unchanged
    - _Requirements: 6.1, 6.2, 7.1, 7.2, 7.3_

  - [ ]* 5.4 Write property test for absentee computation (Property 13)
    - **Property 13: Absentee computation is the set difference**
    - **Validates: Requirements 6.1, 6.2, 6.3**

  - [ ]* 5.5 Write property test for attendance export with absentees (Property 14)
    - **Property 14: Attendance export includes absentees with consistent summary**
    - **Validates: Requirements 7.1, 7.2**

  - [x] 5.6 Modify `backend/src/functions/endSession.ts` to include absentees in final attendance
    - Same absentee computation as getAttendance — fetch `SessionAttendeeEntries`, compute set difference, include absentee records with `finalStatus: 'ABSENT'` in the response
    - _Requirements: 6.3_

  - [x] 5.7 Modify `backend/src/functions/createSession.ts` to accept optional `attendeeListId`
    - Accept optional `attendeeListId` in the request body
    - If provided, after session creation, perform the snapshot copy inline (same logic as linkAttendeeListToSession)
    - Set `attendeeListId` and `hasAttendeeList=true` on the session entity
    - _Requirements: 3.3_

- [x] 6. Checkpoint - Ensure all backend tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 7. Frontend components for master attendee list management
  - [x] 7.1 Create `frontend/src/components/AttendeeListManager.tsx`
    - Full CRUD UI for master attendee lists: list all lists, create new list (name + emails textarea), view list entries, add/remove emails, delete list
    - Use inline styles matching existing dashboard patterns (gradient headers, card layouts, rounded corners)
    - Call `/attendee-lists` endpoints for all operations
    - Display validation errors (invalid emails highlighted) in the existing error banner pattern
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_

  - [x] 7.2 Create `frontend/src/components/AttendeeListSelector.tsx`
    - Dropdown/picker component for selecting an existing master list
    - Include an inline "Create New List" option that expands a form for name + emails (comma or newline separated)
    - Accept `onSelect(listId: string | null)` and `onCreateNew(listId: string)` callbacks
    - Fetch lists from GET `/attendee-lists` on mount
    - _Requirements: 8.1, 8.3, 8.4_

  - [x] 7.3 Create `frontend/src/components/SessionAttendeeListEditor.tsx`
    - View/edit the per-session attendee list: display all entries, add individual emails, remove entries
    - Show unlink button to remove the session list entirely
    - Call `/sessions/{sessionId}/attendee-list` endpoints
    - _Requirements: 4.1, 4.2, 4.3, 4.6_

- [x] 8. Modify existing frontend components
  - [x] 8.1 Modify `frontend/src/components/SessionCreationForm.tsx`
    - Add an optional `AttendeeListSelector` section below the existing form fields
    - Pass selected `attendeeListId` to the create session API request body
    - Support inline list creation flow via the selector component
    - _Requirements: 8.1, 8.2, 8.3_

  - [x] 8.2 Modify `frontend/src/components/OrganizerDashboardWithTabs.tsx`
    - Add an "Attendees" tab (icon: 📋) to the tabs array that renders `AttendeeListManager`
    - Import and wire the new component
    - _Requirements: 2.1_

  - [x] 8.3 Modify the Session tab in the organizer dashboard to include `SessionAttendeeListEditor`
    - Add a section in the SessionTab that shows the session's attendee list using `SessionAttendeeListEditor` when a session has `hasAttendeeList=true`
    - _Requirements: 4.6_

  - [x] 8.4 Modify `frontend/src/components/SessionEndAndExportControls.tsx`
    - Display absentee count in the summary stats (new "Absent" stat card, already has the card but needs data from updated API)
    - Include ABSENT records in the attendance table when present in the API response
    - Show `listSummary` (total listed, present, absent) when available
    - _Requirements: 7.1, 7.2_

- [ ] 9. Snapshot isolation and cross-session independence verification
  - [ ]* 9.1 Write property test for snapshot isolation (Property 7)
    - **Property 7: Snapshot isolation — bidirectional independence**
    - **Validates: Requirements 2.6, 3.7, 4.4**

  - [ ]* 9.2 Write property test for multiple session independence (Property 10)
    - **Property 10: Multiple sessions receive independent copies**
    - **Validates: Requirements 3.6**

  - [ ]* 9.3 Write property test for access control (Property 6)
    - **Property 6: Access control rejects non-owners**
    - **Validates: Requirements 2.5, 3.4, 4.5**

  - [ ]* 9.4 Write property test for no-list session export (Property 15)
    - **Property 15: No-list session export is unchanged**
    - **Validates: Requirements 7.3**

- [x] 10. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties using fast-check
- Unit tests validate specific examples and edge cases
- All backend endpoints follow existing patterns: Azure Functions HTTP triggers, auth via `parseAuthFromRequest`, role checks, `getTableClient` for storage
- All frontend components use inline styles matching the existing dashboard design system
