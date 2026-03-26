# Requirements Document

## Introduction

This feature adds attendee email list management to the attendance tracking system. Organizers can create reusable master attendee lists as templates. When a list is linked to a session, the system snapshots (copies) the email entries into the session's own storage, creating an independent per-session attendee list. This ensures that later changes to the master list do not affect sessions that already have their own copy. Organizers can also manage the per-session attendee list independently. The system restricts check-ins to listed attendees and tracks absentees based on the session's own attendee list.

## Glossary

- **Attendee_List**: A named, reusable master collection of attendee email addresses owned by an Organizer, used as a template for creating session-specific copies
- **Session_Attendee_List**: An independent copy of email entries stored per-session, created by snapshotting an Attendee_List at link time. Once created, the Session_Attendee_List is decoupled from the master Attendee_List
- **System**: The attendance tracking application (Azure Functions backend + Next.js frontend)
- **Organizer**: A user with the Organizer role who creates and manages sessions
- **Attendee**: A user with the Attendee role who checks in to sessions
- **Session**: A time-bounded attendance tracking event created by an Organizer
- **Absentee**: An Attendee whose email is on the Session_Attendee_List for a session but who has no check-in record for that session
- **AttendeeListEntries**: The Azure Table Storage table that stores individual email entries belonging to a master Attendee_List
- **SessionAttendeeEntries**: The Azure Table Storage table that stores the per-session copied email entries belonging to a Session_Attendee_List
- **Check_In**: The act of an Attendee joining a session via QR scan (joinSession endpoint)
- **Attendance_Export**: The JSON download of attendance records for a session via getAttendance endpoint

## Requirements

### Requirement 1: Create Attendee List (Master Template)

**User Story:** As an Organizer, I want to create a named attendee email list, so that I can reuse it as a template across multiple sessions.

#### Acceptance Criteria

1. WHEN an Organizer submits a list name and a set of email addresses, THE System SHALL create an Attendee_List and store each email as an entry in AttendeeListEntries.
2. WHEN an Organizer submits an Attendee_List with duplicate email addresses, THE System SHALL store only unique email addresses and discard duplicates.
3. WHEN an Organizer submits an Attendee_List containing an invalid email format, THE System SHALL reject the request and return a validation error identifying the invalid entries.
4. THE System SHALL associate each Attendee_List with the Organizer who created the Attendee_List.
5. IF the Attendee_List name is empty or the email list is empty, THEN THE System SHALL reject the request with a descriptive validation error.

### Requirement 2: Manage Attendee List (Master Template)

**User Story:** As an Organizer, I want to view, update, and delete my master attendee lists, so that I can keep my reusable templates current.

#### Acceptance Criteria

1. WHEN an Organizer requests their attendee lists, THE System SHALL return all Attendee_Lists owned by that Organizer.
2. WHEN an Organizer adds email addresses to an existing Attendee_List, THE System SHALL append the new unique entries to the AttendeeListEntries for that Attendee_List.
3. WHEN an Organizer removes email addresses from an existing Attendee_List, THE System SHALL delete the corresponding entries from AttendeeListEntries.
4. WHEN an Organizer deletes an Attendee_List, THE System SHALL remove the Attendee_List and all associated AttendeeListEntries.
5. WHEN a non-owner Organizer attempts to modify an Attendee_List, THE System SHALL reject the request with a 403 Forbidden error.
6. WHEN an Organizer modifies a master Attendee_List, THE System SHALL leave all existing Session_Attendee_Lists that were previously copied from that Attendee_List unchanged.

### Requirement 3: Link Attendee List to Session (Snapshot Copy)

**User Story:** As an Organizer, I want to connect an attendee list to a session so that the system copies the emails into the session's own storage, ensuring later changes to the master list do not affect this session.

#### Acceptance Criteria

1. WHEN an Organizer assigns an Attendee_List to a session, THE System SHALL copy all email entries from the Attendee_List into a new Session_Attendee_List stored in SessionAttendeeEntries for that session.
2. WHEN the System creates a Session_Attendee_List, THE System SHALL store the source Attendee_List identifier on the session record for traceability.
3. WHEN an Organizer creates a new session, THE System SHALL allow the Organizer to optionally select an existing Attendee_List to snapshot into the session.
4. WHEN an Organizer assigns an Attendee_List to a session, THE System SHALL verify that the Organizer has access to both the session and the Attendee_List before performing the copy.
5. WHEN an Organizer removes the Session_Attendee_List from a session, THE System SHALL delete all SessionAttendeeEntries for that session and revert to open check-in behavior.
6. THE System SHALL allow a single master Attendee_List to be snapshotted into multiple sessions, with each session receiving its own independent copy.
7. WHEN the source Attendee_List is modified after the snapshot, THE System SHALL retain the Session_Attendee_List entries unchanged for sessions that already have a copy.

### Requirement 4: Manage Per-Session Attendee List

**User Story:** As an Organizer, I want to add or remove individual email addresses from a session's own attendee list, so that I can handle session-specific adjustments without modifying the master list.

#### Acceptance Criteria

1. WHEN an Organizer adds email addresses to a Session_Attendee_List, THE System SHALL append the new unique entries to SessionAttendeeEntries for that session.
2. WHEN an Organizer adds a duplicate email address to a Session_Attendee_List, THE System SHALL reject the duplicate and return a descriptive message.
3. WHEN an Organizer removes email addresses from a Session_Attendee_List, THE System SHALL delete the corresponding entries from SessionAttendeeEntries for that session.
4. WHEN an Organizer modifies a Session_Attendee_List, THE System SHALL leave the source master Attendee_List unchanged.
5. WHEN a non-owner Organizer attempts to modify a Session_Attendee_List, THE System SHALL reject the request with a 403 Forbidden error.
6. WHEN an Organizer requests the Session_Attendee_List for a session, THE System SHALL return all email entries currently stored in SessionAttendeeEntries for that session.

### Requirement 5: Enforce Attendee List on Check-In

**User Story:** As an Organizer, I want the system to block check-ins from attendees not on the session's attendee list, so that only authorized attendees can join the session.

#### Acceptance Criteria

1. WHILE a session has a Session_Attendee_List, WHEN an Attendee attempts to check in, THE System SHALL verify that the Attendee email exists in the Session_Attendee_List before allowing the check-in.
2. WHILE a session has a Session_Attendee_List, IF an Attendee email is not found in the Session_Attendee_List, THEN THE System SHALL reject the check-in with error code NOT_ON_ATTENDEE_LIST and a descriptive message.
3. WHILE a session does not have a Session_Attendee_List, WHEN an Attendee attempts to check in, THE System SHALL allow the check-in without attendee list validation (existing behavior).
4. WHEN the System rejects a check-in due to attendee list enforcement, THE System SHALL return the rejection reason to the Attendee.

### Requirement 6: Track Absentees

**User Story:** As an Organizer, I want to see which listed attendees did not check in, so that I can follow up on absences.

#### Acceptance Criteria

1. WHEN an Organizer requests attendance data for a session with a Session_Attendee_List, THE System SHALL compute the absentee list by comparing the Session_Attendee_List entries against the Attendance records.
2. THE System SHALL identify a Session_Attendee_List entry as an absentee WHEN no Attendance record exists for that email in the session.
3. WHEN the session has ended, THE System SHALL include absentees with finalStatus ABSENT in the final attendance computation.

### Requirement 7: Include Absentees in Attendance Export

**User Story:** As an Organizer, I want the attendance export to include absentee records, so that I have a complete picture of attendance versus the expected list.

#### Acceptance Criteria

1. WHEN an Organizer exports attendance for a session with a Session_Attendee_List, THE System SHALL include one record per absentee in the export with finalStatus set to ABSENT.
2. WHEN an Organizer exports attendance for a session with a Session_Attendee_List, THE System SHALL include a summary field showing total listed count, present count, and absent count.
3. WHEN an Organizer exports attendance for a session without a Session_Attendee_List, THE System SHALL export only the existing Attendance records (current behavior unchanged).

### Requirement 8: Attendee List UI in Session Creation

**User Story:** As an Organizer, I want to manage and select attendee lists from the session creation form, so that I can set up list-based attendance easily.

#### Acceptance Criteria

1. WHEN an Organizer opens the session creation form, THE System SHALL display an optional attendee list selector showing the Organizer's existing Attendee_Lists.
2. WHEN an Organizer selects an Attendee_List in the session creation form, THE System SHALL snapshot the selected Attendee_List into the session's Session_Attendee_List upon session creation.
3. WHEN an Organizer chooses to create a new Attendee_List from the session creation form, THE System SHALL provide an inline form to enter a list name and email addresses.
4. THE System SHALL accept email addresses entered as comma-separated values or one per line in the inline creation form.
