# Requirements Document: QR Chain Attendance System

## Introduction

This document specifies the requirements for a full-cycle anti-cheat classroom attendance system that uses QR code chains for entry and exit verification, plus rotating QR codes for late arrivals and early departures. The system is designed to resist cheating via screenshots, remote scans, or proxy attendance while providing real-time visibility to teachers and a seamless experience for students.

## Glossary

- **System**: The QR Chain Attendance System
- **Session**: A single class period with defined start/end times and attendance tracking
- **Student**: A user authenticated with an @stu.edu.hk email address
- **Teacher**: A user authenticated with an @vtc.edu.hk email address
- **Entry_Chain**: A peer-to-peer QR scanning sequence used to verify on-time arrival
- **Exit_Chain**: A peer-to-peer QR scanning sequence used to verify end-of-class presence
- **Holder**: A student currently possessing an active chain token who displays a QR code
- **Scanner**: A student who scans another student's QR code to participate in a chain
- **Chain_Token**: A short-lived (20-second) token that enables one scan in a chain sequence
- **Rotating_QR**: A teacher-displayed QR code that changes every 60 seconds
- **Late_Entry**: Attendance status for students arriving after the cutoff time
- **Early_Leave**: Attendance status for students departing before the exit chain period
- **Session_QR**: A QR code that allows students to join a session
- **Baton_Transfer**: The process where a scanner becomes the new holder after scanning
- **ETag**: Azure Table Storage concurrency control mechanism for single-use tokens
- **Dashboard**: Real-time teacher interface showing attendance status and chain progress
- **Scan_Log**: Audit record of every QR scan attempt with metadata
- **Stalled_Chain**: A chain that has been idle for more than 60-90 seconds
- **Geofence**: GPS-based location constraint requiring students to be within a radius
- **SSID_Allowlist**: Wi-Fi network name constraint for scan validation
- **BSSID**: Wi-Fi access point MAC address for location verification
- **Device_Fingerprint**: Browser/device identifier for rate limiting and audit

## Requirements

### Requirement 1: User Authentication and Authorization

**User Story:** As a system administrator, I want users to authenticate with their institutional email addresses and be assigned appropriate roles, so that students and teachers have access to their respective features.

#### Acceptance Criteria

1. WHEN a user signs in with an @stu.edu.hk email address, THE System SHALL assign them the Student role
2. WHEN a user signs in with an @vtc.edu.hk email address, THE System SHALL assign them the Teacher role
3. WHEN a user attempts to access a teacher-only endpoint without the Teacher role, THE System SHALL return an authorization error
4. WHEN a user attempts to access a student-only endpoint without the Student role, THE System SHALL return an authorization error
5. THE System SHALL use Microsoft Entra ID for authentication
6. THE System SHALL validate user roles on the server side for all API requests

### Requirement 2: Session Management

**User Story:** As a teacher, I want to create and manage class sessions with configurable parameters, so that I can control attendance tracking for each class period.

#### Acceptance Criteria

1. WHEN a teacher creates a session, THE System SHALL require classId, startAt, endAt, and lateCutoffMinutes parameters
2. WHEN a session is created, THE System SHALL initialize it with status "ACTIVE"
3. WHEN a teacher ends a session, THE System SHALL change the status to "ENDED" and compute final attendance
4. THE System SHALL store session configuration including constraints (geofence, SSID allowlist), ownerTransfer flag, and exitWindowMinutes
5. WHEN a session is created, THE System SHALL generate a unique Session_QR code for student enrollment
6. THE System SHALL persist sessions in Azure Table Storage with PartitionKey=sessionId

### Requirement 3: Entry Chain Verification

**User Story:** As a teacher, I want to seed entry chains by selecting random joined students, so that on-time students can verify each other's attendance through peer-to-peer QR scanning.

#### Acceptance Criteria

1. WHEN a teacher seeds K entry chains, THE System SHALL randomly select K students from joined students and issue them Chain_Tokens
2. WHEN a Chain_Token is issued, THE System SHALL set its expiration to 20 seconds from creation
3. WHEN a student (holder) displays their chain QR code and another student (scanner) scans it, THE System SHALL mark the holder as PRESENT_ENTRY
4. WHEN a valid chain scan occurs, THE System SHALL transfer the chain token to the scanner (baton transfer)
5. WHEN a Chain_Token expires, THE System SHALL mark it as EXPIRED and prevent further scans
6. THE System SHALL increment the sequence number with each baton transfer
7. WHEN a chain scan is attempted with an already-used token, THE System SHALL reject the scan using ETag concurrency control
8. THE System SHALL record all chain scan attempts in Scan_Logs with holderId, scannerId, deviceFingerprint, IP, BSSID, and result

### Requirement 4: Late Entry Verification

**User Story:** As a teacher, I want to display a rotating QR code for late arrivals, so that students arriving after the cutoff can mark themselves as late without enabling screenshot sharing.

#### Acceptance Criteria

1. WHEN a teacher requests a late entry QR code, THE System SHALL generate a rotating token that expires in 60 seconds
2. WHEN a late entry token expires, THE System SHALL automatically generate a new token with a different value
3. WHEN a student scans a valid late entry QR code, THE System SHALL mark them as LATE_ENTRY
4. WHEN a student attempts to scan an already-used late entry token, THE System SHALL reject the scan using ETag concurrency control
5. THE System SHALL record all late entry scan attempts in Scan_Logs
6. WHEN the late cutoff time has not been reached, THE System SHALL reject late entry scans

### Requirement 5: Early Leave Tracking

**User Story:** As a teacher, I want to track students who leave early by displaying a rotating QR code during an early-leave window, so that I can accurately record partial attendance.

#### Acceptance Criteria

1. WHEN a teacher starts an early-leave window, THE System SHALL begin generating rotating QR codes that change every 60 seconds
2. WHEN a teacher stops an early-leave window, THE System SHALL stop generating new early-leave tokens
3. WHEN a student scans a valid early-leave QR code, THE System SHALL record earlyLeaveAt timestamp
4. WHEN a student has an earlyLeaveAt timestamp, THE System SHALL set their final status to EARLY_LEAVE regardless of other attendance states
5. WHEN a student attempts to scan an already-used early-leave token, THE System SHALL reject the scan using ETag concurrency control
6. THE System SHALL record all early-leave scan attempts in Scan_Logs

### Requirement 6: Exit Chain Verification

**User Story:** As a teacher, I want to start exit chains in the final minutes of class, so that students who attended can verify their presence at the end through peer-to-peer scanning.

#### Acceptance Criteria

1. WHEN a teacher starts exit chains with count K, THE System SHALL randomly select K eligible students and issue them exit Chain_Tokens
2. WHEN selecting students for exit chains, THE System SHALL only include students with PRESENT_ENTRY or LATE_ENTRY status who did not early-leave
3. WHEN a student (holder) displays their exit chain QR code and another student (scanner) scans it, THE System SHALL set exitVerified=true for the holder
4. WHEN a valid exit chain scan occurs, THE System SHALL transfer the exit chain token to the scanner
5. WHEN an exit Chain_Token expires after 20 seconds, THE System SHALL mark it as EXPIRED
6. THE System SHALL use ETag concurrency control to prevent duplicate exit chain scans
7. THE System SHALL record all exit chain scan attempts in Scan_Logs

### Requirement 7: Final Attendance Computation

**User Story:** As a teacher, I want the system to automatically compute final attendance status when I end a session, so that I have accurate records based on the complete entry-exit cycle.

#### Acceptance Criteria

1. WHEN a teacher ends a session and a student has earlyLeaveAt timestamp, THE System SHALL set finalStatus to EARLY_LEAVE
2. WHEN a teacher ends a session and a student has PRESENT_ENTRY and exitVerified=true, THE System SHALL set finalStatus to PRESENT
3. WHEN a teacher ends a session and a student has PRESENT_ENTRY and exitVerified=false, THE System SHALL set finalStatus to LEFT_EARLY
4. WHEN a teacher ends a session and a student has LATE_ENTRY and exitVerified=true, THE System SHALL set finalStatus to LATE
5. WHEN a teacher ends a session and a student has LATE_ENTRY and exitVerified=false, THE System SHALL set finalStatus to LEFT_EARLY
6. WHEN a teacher ends a session and a student has no entry status, THE System SHALL set finalStatus to ABSENT
7. THE System SHALL persist final attendance status in Azure Table Storage

### Requirement 8: Anti-Cheat Token Security

**User Story:** As a system administrator, I want short-lived single-use tokens with concurrency control, so that students cannot cheat by sharing screenshots or scanning remotely.

#### Acceptance Criteria

1. WHEN a Chain_Token is created, THE System SHALL set its TTL to 20 seconds
2. WHEN a rotating token (late entry or early leave) is created, THE System SHALL set its TTL to 60 seconds
3. WHEN a token is scanned, THE System SHALL use ETag optimistic concurrency control to mark it as USED
4. WHEN a token scan fails due to ETag mismatch, THE System SHALL reject the scan and return a conflict error
5. WHEN a token's expiration time is reached, THE System SHALL mark it as EXPIRED and reject any scan attempts
6. THE System SHALL store token status (ACTIVE, USED, EXPIRED, REVOKED) in Azure Table Storage

### Requirement 9: Location-Based Anti-Cheat

**User Story:** As a teacher, I want to optionally enforce Wi-Fi and GPS constraints on scans, so that students must be physically present in the classroom to mark attendance.

#### Acceptance Criteria

1. WHERE a session has SSID_Allowlist configured, WHEN a student scans a QR code, THE System SHALL validate that the reported BSSID matches an allowed network
2. WHERE a session has geofence configured, WHEN a student scans a QR code, THE System SHALL validate that the reported GPS coordinates are within the specified radius
3. WHEN location validation fails, THE System SHALL reject the scan and record the failure in Scan_Logs
4. WHERE no location constraints are configured, THE System SHALL accept scans without location validation
5. THE System SHALL record BSSID, GPS coordinates, and validation results in Scan_Logs for all scan attempts

### Requirement 10: Rate Limiting and Abuse Prevention

**User Story:** As a system administrator, I want to rate limit scan attempts per IP and device, so that automated attacks and rapid retry attempts are prevented.

#### Acceptance Criteria

1. WHEN a device attempts more than 10 scans within 60 seconds, THE System SHALL reject subsequent scans with a rate limit error
2. WHEN an IP address attempts more than 50 scans within 60 seconds, THE System SHALL reject subsequent scans with a rate limit error
3. THE System SHALL use device fingerprint (browser/device identifier) for per-device rate limiting
4. THE System SHALL record rate-limited scan attempts in Scan_Logs
5. WHEN rate limit windows expire, THE System SHALL reset the counters and allow new scan attempts

### Requirement 11: Chain Stall Detection and Recovery

**User Story:** As a teacher, I want to detect when chains become stalled and reseed them, so that attendance verification continues smoothly even when students fail to pass the baton.

#### Acceptance Criteria

1. WHEN a chain has been idle for more than 90 seconds, THE System SHALL mark it as stalled
2. WHEN a teacher requests chain status, THE System SHALL report which chains are stalled
3. WHEN a teacher reseeds chains with count N, THE System SHALL select N random eligible students and issue new Chain_Tokens
4. THE System SHALL track lastAt timestamp for each chain to enable stall detection
5. WHEN a chain is reseeded, THE System SHALL increment the chain index to maintain audit trail

### Requirement 12: Real-Time Teacher Dashboard

**User Story:** As a teacher, I want a real-time dashboard showing attendance status and chain progress, so that I can monitor the class and take corrective actions during the session.

#### Acceptance Criteria

1. WHEN a student's attendance status changes, THE System SHALL push an update to the teacher's dashboard via Azure SignalR Service
2. WHEN a chain scan occurs, THE System SHALL update the dashboard with the new holder information
3. WHEN a chain becomes stalled, THE System SHALL display a stall indicator on the dashboard
4. THE System SHALL display real-time counts of PRESENT_ENTRY, LATE_ENTRY, EARLY_LEAVE, and not-yet-verified students
5. THE System SHALL use SignalR connection negotiation endpoint for establishing real-time connections
6. THE System SHALL authenticate SignalR connections using the same Entra ID tokens as API requests

### Requirement 13: Student User Interface

**User Story:** As a student, I want a simple interface to join sessions, display my QR code when I'm a holder, and scan peer QR codes, so that I can participate in attendance verification.

#### Acceptance Criteria

1. WHEN a student scans a Session_QR code, THE System SHALL enroll them in the session
2. WHEN a student becomes a chain holder, THE System SHALL display their personal QR code with a countdown timer
3. WHEN a student's chain token expires, THE System SHALL hide the QR code and update the UI
4. WHEN a student needs to scan a peer's QR code, THE System SHALL provide a camera interface for QR scanning
5. WHEN a student successfully scans a chain QR, THE System SHALL display confirmation and show their new holder status if baton transfer occurred
6. WHEN a student needs to mark late entry or early leave, THE System SHALL provide a scan interface for the teacher's rotating QR code

### Requirement 14: Attendance Export and Reporting

**User Story:** As a teacher, I want to export attendance reports after ending a session, so that I can submit records to the institutional system.

#### Acceptance Criteria

1. WHEN a teacher requests attendance data for an ended session, THE System SHALL return all student records with finalStatus
2. THE System SHALL include studentId, entryStatus, entryAt, exitVerified, exitVerifiedAt, earlyLeaveAt, and finalStatus in attendance records
3. THE System SHALL support exporting attendance data in JSON format
4. WHEN a session is not yet ended, THE System SHALL return current attendance state without finalStatus
5. THE System SHALL allow teachers to query attendance only for sessions they created

### Requirement 15: Audit Logging

**User Story:** As a system administrator, I want comprehensive audit logs of all scan attempts with metadata, so that I can investigate suspicious activity and verify system integrity.

#### Acceptance Criteria

1. WHEN any scan attempt occurs, THE System SHALL create a Scan_Log entry
2. THE System SHALL record flow type (ENTRY_CHAIN, LATE_ENTRY, EARLY_LEAVE, EXIT_CHAIN) in Scan_Logs
3. THE System SHALL record tokenId, holderId, scannerId, deviceFingerprint, IP, BSSID, userAgent, and result in Scan_Logs
4. THE System SHALL record timestamp for all scan attempts
5. THE System SHALL persist Scan_Logs in Azure Table Storage with PartitionKey=sessionId for efficient querying
6. THE System SHALL retain Scan_Logs for at least 90 days

### Requirement 16: Performance and Scalability

**User Story:** As a system administrator, I want the system to handle large classes efficiently with low latency, so that 300-500 students can mark attendance without delays.

#### Acceptance Criteria

1. WHEN a scan operation is performed, THE System SHALL complete the request with p95 latency less than 400ms
2. THE System SHALL support concurrent sessions with up to 500 students each
3. THE System SHALL use PartitionKey=sessionId for all hot path queries to optimize Azure Table Storage performance
4. THE System SHALL use Azure Functions consumption plan for automatic scaling
5. WHEN concurrent scan requests occur for the same token, THE System SHALL handle them correctly using ETag concurrency control

### Requirement 17: Optional AI Insights

**User Story:** As a teacher, I want optional AI-generated insights about session patterns and stall predictions, so that I can improve attendance verification efficiency without exposing student PII.

#### Acceptance Criteria

1. WHERE Azure OpenAI is configured, WHEN a teacher requests insights, THE System SHALL generate aggregated analysis without including student PII
2. THE System SHALL provide insights about chain stall patterns and suggested reseed timing
3. THE System SHALL provide session summary statistics (average scan time, chain completion rate)
4. WHERE Azure OpenAI is not configured, THE System SHALL return a feature-not-available response
5. WHEN generating AI insights, THE System SHALL only use aggregated data, not individual student records

### Requirement 18: Configuration Management

**User Story:** As a system administrator, I want to configure system parameters via environment variables, so that I can adjust behavior without code changes.

#### Acceptance Criteria

1. THE System SHALL read STORAGE_ACCOUNT_NAME and STORAGE_ACCOUNT_URI from environment variables
2. THE System SHALL read SIGNALR_CONNECTION_STRING from environment variables
3. THE System SHALL read LATE_ROTATION_SECONDS with default value 60
4. THE System SHALL read EARLY_LEAVE_ROTATION_SECONDS with default value 60
5. THE System SHALL read CHAIN_TOKEN_TTL_SECONDS with default value 20
6. THE System SHALL read OWNER_TRANSFER with default value true
7. WHERE WIFI_SSID_ALLOWLIST is configured, THE System SHALL enforce Wi-Fi validation
8. WHERE AOAI_ENDPOINT, AOAI_KEY, and AOAI_DEPLOYMENT are configured, THE System SHALL enable AI insights

### Requirement 19: Azure Resource Integration

**User Story:** As a system administrator, I want the system to use Azure managed identities for secure resource access, so that credentials are not stored in code or configuration.

#### Acceptance Criteria

1. THE System SHALL use Managed Identity to authenticate to Azure Table Storage
2. THE System SHALL use Managed Identity to authenticate to Azure SignalR Service
3. WHERE Azure OpenAI is configured, THE System SHALL use Managed Identity to authenticate to Azure OpenAI
4. THE System SHALL assign Storage Table Data Contributor role to the Static Web App managed identity
5. THE System SHALL assign SignalR Service Owner role to the Function App managed identity

### Requirement 20: Progressive Web App Experience

**User Story:** As a student, I want to install the attendance app on my phone and use it offline-capable, so that I have quick access during class without opening a browser each time.

#### Acceptance Criteria

1. THE System SHALL serve a Progressive Web App with a valid manifest.json
2. THE System SHALL provide a service worker for offline capability
3. THE System SHALL enable "Add to Home Screen" functionality on mobile devices
4. THE System SHALL cache static assets for faster loading
5. WHEN network connectivity is lost, THE System SHALL display an appropriate offline message for operations requiring network access
