# Implementation Plan: QR Chain Attendance System

## Overview

This implementation plan breaks down the QR Chain Attendance System into discrete, incremental coding tasks. The system will be built using TypeScript with Azure Static Web Apps for the frontend and Azure Functions for the backend. Each task builds on previous work, with testing integrated throughout to validate correctness early.

The implementation follows a bottom-up approach: core services first, then API endpoints, then frontend components, with integration and real-time features at the end.

## Tasks

- [x] 1. Set up project structure and Azure infrastructure
  - Create Azure Static Web App project with React/Next.js
  - Set up Azure Functions project (TypeScript)
  - Configure Azure Table Storage connection
  - Set up Azure SignalR Service
  - Create TypeScript interfaces for all data models (Session, Attendance, Token, Chain, ScanLog)
  - Configure environment variables and managed identity
  - Set up testing framework (Jest + fast-check for property tests)
  - _Requirements: 18.1, 18.2, 19.1, 19.2, 19.4, 19.5_

- [x] 2. Implement Authentication Service
  - [x] 2.1 Create AuthService with user principal parsing
    - Implement parseUserPrincipal to decode x-ms-client-principal header
    - Implement role determination based on email domain (@stu.edu.hk → STUDENT, @vtc.edu.hk → TEACHER)
    - Implement requireRole validation function
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.6_
  
  - [x] 2.2 Write property tests for AuthService
    - **Property 1: Student role assignment by email domain**
    - **Property 2: Teacher role assignment by email domain**
    - **Property 3: Teacher endpoint authorization enforcement**
    - **Property 4: Student endpoint authorization enforcement**
    - **Property 5: Server-side role validation**
    - **Validates: Requirements 1.1, 1.2, 1.3, 1.4, 1.6**

- [x] 3. Implement Token Management Service
  - [x] 3.1 Create TokenService with CRUD operations
    - Implement createToken with cryptographically random tokenId generation
    - Implement validateToken to check status and expiration
    - Implement consumeToken with ETag optimistic concurrency control
    - Implement revokeToken
    - Integrate with Azure Table Storage (Tokens table)
    - _Requirements: 3.2, 3.5, 3.7, 4.1, 5.1, 6.5, 8.1, 8.2, 8.3, 8.4, 8.5_
  
  - [x] 3.2 Write property tests for TokenService
    - **Property 12: Chain token TTL is 20 seconds**
    - **Property 17: Single-use token enforcement**
    - **Property 19: Late entry token TTL is 60 seconds**
    - **Property 31: Exit token expiration**
    - **Validates: Requirements 3.2, 3.5, 3.7, 4.1, 6.5, 8.3, 8.4**
  
  - [x] 3.3 Write unit tests for TokenService edge cases
    - Test token expiration at exact timestamp
    - Test ETag conflict error handling
    - Test concurrent token consumption
    - _Requirements: 3.5, 3.7, 16.5_

- [x] 4. Implement Attendance Computation Service
  - [x] 4.1 Create AttendanceService with status management
    - Implement markEntry to set entryStatus and entryAt
    - Implement markExitVerified to set exitVerified and exitVerifiedAt
    - Implement markEarlyLeave to set earlyLeaveAt
    - Implement computeFinalStatus with decision tree logic
    - Integrate with Azure Table Storage (Attendance table)
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7_
  
  - [ ]* 4.2 Write property test for final status computation
    - **Property 32: Final status computation logic**
    - **Property 33: Final status persistence round-trip**
    - **Validates: Requirements 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7**
  
  - [ ]* 4.3 Write unit tests for each decision tree branch
    - Test EARLY_LEAVE priority
    - Test PRESENT status (entry + exit)
    - Test LEFT_EARLY status (entry, no exit)
    - Test LATE status (late entry + exit)
    - Test ABSENT status (no entry)
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6_

- [x] 5. Checkpoint - Ensure core services tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 6. Implement Anti-Cheat Validation Service
  - [x] 6.1 Create ValidationService with rate limiting and location validation
    - Implement checkRateLimit with in-memory sliding window counters (device: 10/60s, IP: 50/60s)
    - Implement validateLocation with geofence (Haversine formula) and Wi-Fi allowlist checks
    - Implement logScan to write to ScanLogs table
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 10.1, 10.2, 10.4, 10.5_
  
  - [ ]* 6.2 Write property tests for ValidationService
    - **Property 34: Wi-Fi allowlist enforcement**
    - **Property 35: Geofence enforcement**
    - **Property 36: Location validation failure logging**
    - **Property 37: Optional location validation**
    - **Property 39: Device rate limiting**
    - **Property 40: IP rate limiting**
    - **Property 42: Rate limit window reset**
    - **Validates: Requirements 9.1, 9.2, 9.3, 9.4, 10.1, 10.2, 10.5**
  
  - [ ]* 6.3 Write unit tests for edge cases
    - Test Haversine distance calculation accuracy
    - Test scans exactly at geofence boundary
    - Test rate limit counter reset after 60s
    - _Requirements: 9.2, 10.5_

- [x] 7. Implement Chain Orchestration Service
  - [x] 7.1 Create ChainService with chain lifecycle management
    - Implement seedChains to randomly select students and create chains
    - Implement processChainScan to validate, mark holder, and transfer baton
    - Implement detectStalledChains (idle > 90s)
    - Implement reseedChains with index increment
    - Integrate with TokenService and AttendanceService
    - Integrate with Azure Table Storage (Chains table)
    - _Requirements: 3.1, 3.3, 3.4, 3.6, 6.1, 6.2, 6.3, 6.4, 11.1, 11.2, 11.3, 11.5_
  
  - [ ]* 7.2 Write property tests for ChainService
    - **Property 11: Entry chain seeding creates exact count**
    - **Property 13: Chain scan marks holder as present**
    - **Property 14: Baton transfer on chain scan**
    - **Property 16: Sequence number monotonically increases**
    - **Property 27: Exit chain seeding creates exact count**
    - **Property 28: Exit chain eligibility filtering**
    - **Property 29: Exit scan marks holder verified**
    - **Property 30: Exit baton transfer**
    - **Property 43: Stall detection threshold**
    - **Property 45: Chain reseeding creates exact count**
    - **Property 46: Reseed increments chain index**
    - **Validates: Requirements 3.1, 3.3, 3.4, 3.6, 6.1, 6.2, 6.3, 6.4, 11.1, 11.3, 11.5**
  
  - [ ]* 7.3 Write unit tests for chain scenarios
    - Test chain with insufficient eligible students
    - Test baton transfer with ownerTransfer=false
    - Test stall detection at exactly 90s
    - _Requirements: 3.1, 11.1_

- [x] 8. Implement Session Management API
  - [x] 8.1 Create POST /api/sessions endpoint
    - Validate required fields (classId, startAt, endAt, lateCutoffMinutes)
    - Initialize session with status ACTIVE
    - Generate unique Session_QR code
    - Store in Sessions table
    - Require Teacher role
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_
  
  - [x] 8.2 Create POST /api/sessions/{sessionId}/seed-entry endpoint
    - Call ChainService.seedChains with ENTRY phase
    - Return created chain count and initial holders
    - Require Teacher role and session ownership
    - _Requirements: 3.1_
  
  - [x] 8.3 Create POST /api/sessions/{sessionId}/end endpoint
    - Change session status to ENDED
    - Call AttendanceService.computeFinalStatus
    - Return final attendance records
    - Require Teacher role and session ownership
    - _Requirements: 2.3, 7.1, 7.2, 7.3, 7.4, 7.5, 7.6_
  
  - [ ]* 8.4 Write property tests for session management
    - **Property 6: Session creation requires all mandatory fields**
    - **Property 7: New sessions initialize as ACTIVE**
    - **Property 8: Ending session transitions to ENDED status**
    - **Property 9: Session configuration round-trip**
    - **Property 10: Session QR uniqueness**
    - **Validates: Requirements 2.1, 2.2, 2.3, 2.4, 2.5**

- [x] 9. Implement Scan Processing API
  - [x] 9.1 Create POST /api/scan/chain endpoint
    - Extract user principal and validate Student role
    - Call ValidationService.checkRateLimit
    - Call ValidationService.validateLocation
    - Call ChainService.processChainScan
    - Call ValidationService.logScan
    - Return scan result with new token if baton transferred
    - _Requirements: 3.3, 3.4, 3.7, 3.8, 9.1, 9.2, 9.3, 10.1, 10.2_
  
  - [x] 9.2 Create POST /api/scan/late-entry endpoint
    - Extract user principal and validate Student role
    - Validate late cutoff time has passed
    - Call ValidationService for rate limit and location
    - Call TokenService.consumeToken
    - Call AttendanceService.markEntry with LATE_ENTRY
    - Call ValidationService.logScan
    - _Requirements: 4.3, 4.4, 4.5, 4.6_
  
  - [x] 9.3 Create POST /api/scan/early-leave endpoint
    - Extract user principal and validate Student role
    - Validate early-leave window is active
    - Call ValidationService for rate limit and location
    - Call TokenService.consumeToken
    - Call AttendanceService.markEarlyLeave
    - Call ValidationService.logScan
    - _Requirements: 5.3, 5.5, 5.6_
  
  - [x] 9.4 Create POST /api/scan/exit-chain endpoint
    - Extract user principal and validate Student role
    - Call ValidationService for rate limit and location
    - Call ChainService.processChainScan with EXIT phase
    - Call ValidationService.logScan
    - _Requirements: 6.3, 6.4, 6.6, 6.7_
  
  - [ ]* 9.5 Write property test for scan audit logging
    - **Property 18: Scan audit logging completeness**
    - **Property 38: Location data audit logging**
    - **Property 41: Rate limit logging**
    - **Validates: Requirements 3.8, 9.5, 10.4, 15.1, 15.2, 15.3, 15.4**

- [x] 10. Checkpoint - Ensure API tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [~] 11. Implement Rotating QR Management
  - [x] 11.1 Create Timer Function for token rotation
    - Run every 60 seconds
    - Query sessions with active late entry or early leave windows
    - Mark expired tokens as EXPIRED
    - Generate new tokens for active windows
    - Update Session records with current token IDs
    - _Requirements: 4.2, 5.1, 5.2_
  
  - [x] 11.2 Create GET /api/sessions/{sessionId}/late-qr endpoint
    - Return current active late entry token
    - Require Teacher role and session ownership
    - _Requirements: 4.1_
  
  - [x] 11.3 Create POST /api/sessions/{sessionId}/start-early-leave endpoint
    - Set earlyLeaveActive flag on session
    - Generate initial early-leave token
    - Require Teacher role and session ownership
    - _Requirements: 5.1_
  
  - [x] 11.4 Create POST /api/sessions/{sessionId}/stop-early-leave endpoint
    - Clear earlyLeaveActive flag on session
    - Require Teacher role and session ownership
    - _Requirements: 5.2_
  
  - [x] 11.5 Create GET /api/sessions/{sessionId}/early-qr endpoint
    - Return current active early-leave token
    - Require Teacher role and session ownership
    - _Requirements: 5.1_
  
  - [ ]* 11.6 Write property tests for rotating QR
    - **Property 20: Late entry token rotation**
    - **Property 23: Early leave token rotation**
    - **Property 24: Early leave window control**
    - **Validates: Requirements 4.2, 5.1, 5.2**

- [~] 12. Implement Exit Chain Management
  - [x] 12.1 Create POST /api/sessions/{sessionId}/start-exit-chain endpoint
    - Call ChainService.seedChains with EXIT phase and specified count
    - Return created chain count and initial holders
    - Require Teacher role and session ownership
    - _Requirements: 6.1, 6.2_
  
  - [x] 12.2 Create POST /api/sessions/{sessionId}/reseed-exit endpoint
    - Call ChainService.reseedChains with EXIT phase
    - Return new chain count
    - Require Teacher role and session ownership
    - _Requirements: 11.3, 11.5_

- [~] 13. Implement Real-Time Notification Service
  - [x] 13.1 Create SignalRService with Azure SignalR output binding
    - Implement broadcastAttendanceUpdate
    - Implement broadcastChainUpdate
    - Implement broadcastStallAlert
    - Configure SignalR connection with Entra ID authentication
    - _Requirements: 12.1, 12.2, 12.3, 12.6_
  
  - [x] 13.2 Integrate SignalR broadcasts into services
    - Add SignalR calls to AttendanceService.markEntry, markExitVerified, markEarlyLeave
    - Add SignalR calls to ChainService.processChainScan
    - Add SignalR calls to ChainService.detectStalledChains
    - _Requirements: 12.1, 12.2, 12.3_
  
  - [ ]* 13.3 Write property tests for real-time notifications
    - **Property 47: Attendance status change notification**
    - **Property 48: Chain scan notification**
    - **Property 49: Stall alert notification**
    - **Validates: Requirements 12.1, 12.2, 12.3**

- [~] 14. Implement Dashboard API
  - [x] 14.1 Create GET /api/sessions/{sessionId} endpoint
    - Return session details, attendance records, chains, and stats
    - Compute real-time stats (counts by status)
    - Require Teacher role and session ownership
    - _Requirements: 12.4_
  
  - [x] 14.2 Create POST /api/sessions/{sessionId}/dashboard/negotiate endpoint
    - Use Azure Functions SignalR input binding for negotiation
    - Authenticate with Entra ID token
    - Return SignalR connection info
    - _Requirements: 12.6_
  
  - [x] 14.3 Create GET /api/sessions/{sessionId}/attendance endpoint
    - Return attendance records for session
    - Include finalStatus if session ended
    - Require Teacher role and session ownership
    - _Requirements: 14.1, 14.2, 14.3, 14.4, 14.5_
  
  - [ ]* 14.4 Write property tests for dashboard and export
    - **Property 50: Dashboard count accuracy**
    - **Property 53: Export completeness for ended sessions**
    - **Property 54: Export field completeness**
    - **Property 55: Export JSON format validity**
    - **Property 56: Active session export excludes finalStatus**
    - **Property 57: Attendance query authorization**
    - **Validates: Requirements 12.4, 14.1, 14.2, 14.3, 14.4, 14.5**

- [x] 15. Checkpoint - Ensure backend integration tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [~] 16. Implement Student Frontend Components
  - [x] 16.1 Create QR Scanner Component
    - Implement camera access and QR code scanning
    - Parse QR data (type discrimination)
    - Call appropriate scan API endpoint
    - Display scan result and error messages
    - _Requirements: 13.1, 13.5_
  
  - [x] 16.2 Create QR Display Component
    - Display holder's QR code with countdown timer
    - Generate QR code from token data
    - Hide QR when token expires
    - _Requirements: 13.2, 13.3_
  
  - [x] 16.3 Create Student Session View
    - Display session information
    - Show holder status and QR when applicable
    - Provide scan button for peer QR codes
    - Handle late entry and early leave flows
    - _Requirements: 13.1, 13.2, 13.3, 13.5_
  
  - [x] 16.4 Implement session enrollment via Session QR
    - Scan Session_QR to join session
    - Store session ID in local state
    - Navigate to session view
    - _Requirements: 13.1_
  
  - [ ]* 16.5 Write property test for enrollment
    - **Property 52: Session enrollment via QR**
    - **Validates: Requirements 13.1**

- [~] 17. Implement Teacher Frontend Components
  - [x] 17.1 Create Session Creation Form
    - Input fields for classId, startAt, endAt, lateCutoffMinutes
    - Optional fields for constraints (geofence, Wi-Fi allowlist)
    - Call POST /api/sessions
    - Display generated Session_QR for students
    - _Requirements: 2.1, 2.2, 2.5_
  
  - [x] 17.2 Create Teacher Dashboard Component
    - Connect to SignalR for real-time updates
    - Display attendance counts by status
    - Display chain status with stall indicators
    - Show list of students with current status
    - _Requirements: 12.1, 12.2, 12.3, 12.4_
  
  - [x] 17.3 Create Chain Management Controls
    - Button to seed entry chains with count input
    - Button to start exit chains with count input
    - Button to reseed stalled chains
    - Display chain holders and sequence numbers
    - _Requirements: 3.1, 6.1, 11.3_
  
  - [x] 17.4 Create Rotating QR Display Component
    - Display late entry QR with auto-refresh (every 55s)
    - Display early leave QR with auto-refresh
    - Buttons to start/stop early-leave window
    - Show countdown timer for current token
    - _Requirements: 4.1, 4.2, 5.1, 5.2_
  
  - [x] 17.5 Create Session End and Export Controls
    - Button to end session
    - Display final attendance summary
    - Export attendance as JSON
    - _Requirements: 2.3, 14.1, 14.2, 14.3_

- [~] 18. Implement Optional AI Insights Feature
  - [~] 18.1 Create AI Insights API endpoints (teacher-only)
    - POST /api/ai/session-summary: Generate session summary
    - POST /api/ai/stall-advice: Suggest reseed timing
    - Integrate with Azure OpenAI using Managed Identity
    - Ensure only aggregated data used (no PII)
    - Return feature-not-available if OpenAI not configured
    - _Requirements: 17.1, 17.2, 17.3, 17.4, 17.5_
  
  - [~] 18.2 Create AI Insights Dashboard Panel
    - Display session summary statistics
    - Display stall pattern insights
    - Show reseed timing suggestions
    - Handle feature-not-available gracefully
    - _Requirements: 17.2, 17.3_
  
  - [ ]* 18.3 Write property tests for AI insights
    - **Property 59: AI insights exclude PII**
    - **Property 60: AI insights use aggregated data only**
    - **Property 61: Session statistics accuracy**
    - **Validates: Requirements 17.1, 17.3, 17.5**

- [~] 19. Implement Progressive Web App Features
  - [x] 19.1 Create PWA manifest and service worker
    - Create manifest.json with app metadata
    - Implement service worker for offline capability
    - Cache static assets
    - Enable "Add to Home Screen"
    - _Requirements: 20.1, 20.2_
  
  - [x] 19.2 Implement offline handling
    - Detect network connectivity loss
    - Display offline message for network operations
    - Queue operations for retry when connection restored (where applicable)
    - _Requirements: 20.5_

- [~] 20. Implement Error Handling and User Feedback
  - [x] 20.1 Create error handling middleware for API
    - Catch and format all error types
    - Return consistent ErrorResponse structure
    - Log errors for debugging
    - _Requirements: All error scenarios_
  
  - [x] 20.2 Implement client-side error handling
    - Display user-friendly error messages
    - Handle token expiration with retry logic
    - Handle ETag conflicts without retry
    - Display rate limit cooldown timers
    - Show location violation guidance
    - _Requirements: 3.5, 3.7, 9.3, 10.1, 10.2_
  
  - [x] 20.3 Implement retry logic with exponential backoff
    - Retry transient failures (network, storage)
    - Do not retry ETag conflicts or rate limits
    - _Requirements: Storage error handling_

- [~] 21. Checkpoint - Ensure end-to-end tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [~] 22. Integration and Final Wiring
  - [x] 22.1 Configure Azure Static Web App routing
    - Set up staticwebapp.config.json with role-based routes
    - Configure API proxy to Azure Functions
    - Set up authentication with Entra ID
    - _Requirements: 1.3, 1.4, 1.5_
  
  - [x] 22.2 Configure Azure Functions bindings
    - Set up Table Storage input/output bindings
    - Set up SignalR output bindings
    - Configure timer triggers for token rotation
    - _Requirements: 4.2, 5.1, 12.1, 12.2_
  
  - [x] 22.3 Set up environment variables and configuration
    - Configure STORAGE_ACCOUNT_NAME, STORAGE_ACCOUNT_URI
    - Configure SIGNALR_CONNECTION_STRING
    - Set default values for rotation and TTL settings
    - Configure optional WIFI_SSID_ALLOWLIST
    - Configure optional AOAI settings
    - _Requirements: 18.1, 18.2, 18.3, 18.4, 18.5, 18.6, 18.7, 18.8_
  
  - [x] 22.4 Configure Managed Identity and RBAC
    - Assign Storage Table Data Contributor to SWA identity
    - Assign SignalR Service Owner to Function App identity
    - Assign Cognitive Services OpenAI User if using AI (optional)
    - _Requirements: 19.1, 19.2, 19.3, 19.4, 19.5_
  
  - [ ]* 22.5 Write integration tests for complete flows
    - Test complete entry chain flow (seed → scan → mark)
    - Test complete late entry flow
    - Test complete early leave flow
    - Test complete exit chain flow
    - Test session end and final status computation
    - _Requirements: All requirements_

- [~] 23. Performance Optimization and Load Testing
  - [~] 23.1 Optimize Azure Table Storage queries
    - Verify PartitionKey=sessionId used for all hot paths
    - Add indexes where needed
    - Batch operations where possible
    - _Requirements: 16.3_
  
  - [x] 23.2 Implement caching for frequently accessed data
    - Cache session configuration
    - Cache current rotating tokens
    - Use in-memory cache with TTL
    - _Requirements: 16.1_
  
  - [ ]* 23.3 Run load tests
    - Simulate 500 concurrent students scanning
    - Measure p95 latency for scan operations
    - Verify rate limiting under load
    - Test concurrent token consumption
    - _Requirements: 16.1, 16.2, 16.5_

- [~] 24. Final Checkpoint - Complete system validation
  - Run all unit tests, property tests, integration tests
  - Verify all 61 correctness properties pass
  - Test complete user journeys (student and teacher)
  - Verify real-time updates work correctly
  - Test anti-cheat mechanisms (rate limiting, location validation, single-use tokens)
  - Ensure all tests pass, ask the user if questions arise.

- [~] 25. Deployment Configuration and Infrastructure
  - [x] 25.1 Create Azure resource deployment scripts
    - Create Bicep/ARM templates for Azure Static Web Apps
    - Create Bicep/ARM templates for Azure Functions
    - Create Bicep/ARM templates for Azure Table Storage
    - Create Bicep/ARM templates for Azure SignalR Service
    - Create Bicep/ARM templates for Azure OpenAI (optional)
    - Configure Managed Identity assignments
    - Configure RBAC role assignments
    - _Requirements: 19.1, 19.2, 19.3, 19.4, 19.5_
  
  - [x] 25.2 Set up CI/CD pipeline
    - Create GitHub Actions workflow for frontend build and deploy
    - Create GitHub Actions workflow for backend build and deploy
    - Configure automated testing in pipeline (unit, property, integration)
    - Set up staging and production environments
    - Configure environment-specific variables
    - _Requirements: All requirements_
  
  - [x] 25.3 Create deployment documentation
    - Document Azure resource provisioning steps
    - Document environment variable configuration
    - Document Managed Identity setup
    - Document Entra ID app registration for authentication
    - Document monitoring and logging setup
    - _Requirements: 18.1, 18.2, 18.3, 18.4, 18.5, 18.6, 18.7, 18.8_
  
  - [x] 25.4 Configure monitoring and alerting
    - Set up Application Insights for Functions
    - Configure custom metrics for scan operations
    - Set up alerts for high error rates
    - Set up alerts for high latency (p95 > 400ms)
    - Configure log retention policies
    - _Requirements: 15.6, 16.1_
  
  - [~] 25.5 Deploy to staging environment
    - Provision Azure resources in staging
    - Deploy frontend and backend code
    - Run smoke tests on staging
    - Verify all integrations work (Storage, SignalR, OpenAI)
    - _Requirements: All requirements_
  
  - [~] 25.6 Deploy to production environment
    - Provision Azure resources in production
    - Deploy frontend and backend code
    - Run smoke tests on production
    - Monitor initial usage for errors
    - _Requirements: All requirements_

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation throughout implementation
- Property tests validate universal correctness properties (minimum 100 iterations each)
- Unit tests validate specific examples and edge cases
- Integration tests validate component interactions and complete flows
- The implementation uses TypeScript for both frontend and backend
- Azure services are accessed via Managed Identity for security
- Real-time features use Azure SignalR Service for scalability
