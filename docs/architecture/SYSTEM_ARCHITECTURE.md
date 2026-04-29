# System Architecture

**Last Updated**: April 28, 2026  
**Version**: 4.0

---

## Overview

ProvePresent is a real-time attendance verification system built on Azure services with a focus on security, scalability, and user experience. Infrastructure is managed via Azure Bicep (IaC) with automated deployment scripts.

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                         Frontend                             │
│  Next.js 15 + React 18 + TypeScript (Azure Static Web Apps) │
│  - Organizer Dashboard (Tabbed real-time monitoring)         │
│  - Attendee View (QR scanning & display)                     │
│  - Session Management (CRUD with recurring)                  │
│  - Live Quiz (AI-powered question generation)                │
│  - Image Capture & Seating Analysis                          │
│  - Attendee List Management                                  │
└─────────────────┬───────────────────────────────────────────┘
                  │
                  │ HTTPS + JWT (Email OTP auth)
                  │
┌─────────────────▼───────────────────────────────────────────┐
│                    Backend API                               │
│  Azure Functions v4 (Node.js 22 + TypeScript)               │
│  - 75 HTTP/Durable-triggered functions                       │
│  - Managed Identity authentication                           │
│  - Durable Functions for capture timeout orchestration        │
│  - Business Logic + AI Integration                           │
└─────────────────┬───────────────────────────────────────────┘
                  │
        ┌─────────┼─────────┬─────────────┐
        │         │         │             │
        ▼         ▼         ▼             ▼
┌───────────┐ ┌──────────┐ ┌─────────┐ ┌─────────────┐
│  Azure    │ │  Azure   │ │ Azure   │ │   Email OTP │
│  Table    │ │  SignalR │ │ OpenAI  │ │   + JWT     │
│  Storage  │ │  Service │ │ + Foundry│ │   (Auth)    │
│(20 tables)│ │(Real-time)│ │ (AI)    │ │             │
└───────────┘ └──────────┘ └─────────┘ └─────────────┘
```

---

## Core Components

### 1. Frontend (Next.js)

**Technology Stack**:
- Next.js 15.1.6 (Static Site Generation)
- React 18.3.1 with TypeScript
- SignalR Client (@microsoft/signalr 8.0) for real-time updates
- QR Code generation/scanning libraries

**Key Features**:
- Progressive Web App (PWA) support
- Offline functionality with service workers and offline queue
- Mobile-first responsive design
- Real-time dashboard updates
- Live Quiz with AI-generated questions
- Image capture and seating grid visualization
- Attendee list management with session linking

**Pages**:
- `/` - Home page with role selection
- `/login` - Email OTP login flow
- `/organizer` - Organizer dashboard
- `/attendee` - Attendee view
- `/dev-config` - Development configuration

**Components** (35+ plus 5 tab components):
- `OrganizerDashboardWithTabs` / `OrganizerDashboardTabs` - Tabbed organizer interface
- `OrganizerHeader` - Dashboard header
- `SimpleAttendeeView` - Attendee interface
- `SessionCreationForm` / `SessionsList` / `SessionEnrollment` - Session management
- `SessionEndAndExportControls` - Session end and export
- `QRDisplay` / `RotatingQRDisplay` / `QRScanner` / `QRCodeModal` - QR code handling
- `ChainManagementControls` / `ChainVisualization` / `ChainTraceViewer` - Chain management
- `SnapshotManager` - Snapshot management
- `QuizManagement` / `QuizModal` - Quiz interface
- `AttendeeCaptureUI` / `OrganizerCaptureControl` / `CaptureHistory` / `BatchImageAnalysisModal` - Image capture
- `SeatingGridVisualization` - Seating position display
- `AttendeeListManager` / `AttendeeListSelector` / `SessionAttendeeListEditor` - Attendee lists
- `CoOrganizerManagement` - Co-organizer management
- `DeleteConfirmModal` - Confirmation dialogs
- `OfflineIndicator` / `BuildInfo` - UI utilities

**Tab Components** (`components/tabs/`):
- `MonitorTab` - Attendance monitoring
- `ChainsTab` - Chain management
- `QuizTab` - Quiz management
- `CaptureTab` - Image capture
- `SessionTab` - Session settings

### 2. Backend (Azure Functions)

**Technology Stack**:
- Azure Functions v4 (4.11.1)
- Node.js 22 runtime
- TypeScript
- HTTP triggers (anonymous auth level)
- Durable Functions (3.3.0) for capture timeout orchestration
- Managed Identity for Azure service access
- Nodemailer for SMTP email delivery
- OpenTelemetry for tracing and custom metrics

**Function Categories** (75 total):

**Authentication & OTP** (7):
- `requestOtp` - Send OTP code to email via SMTP
- `verifyOtp` - Verify OTP and issue JWT token
- `onOtpSendEmail` - Webhook for External ID OTP email delivery
- `authMe` - Get current user info from JWT
- `authLogout` - Clear auth session
- `getRoles` - Get user roles from email domain
- `getUserRoles` - Get specific user roles

**Session Management** (7):
- `createSession` - Create single/recurring sessions (with optional attendee list linking)
- `getSession` - Get session details with attendance
- `getOrganizerSessions` - List organizer's sessions
- `deleteSession` - Delete session with cascade
- `endSession` - End active session
- `checkSession` - Verify session status
- `updateSession` - Update session details

**QR Code Generation** (4):
- `getEntryQR` - Generate entry QR code
- `getExitQR` - Generate exit QR code
- `getLateQR` - Generate late entry QR code
- `getEarlyLeaveQR` - Generate early leave QR code

**Chain Management** (9):
- `seedEntry` - Seed initial entry chains
- `reseedEntry` - Reseed entry chains
- `startExitChain` - Start exit chains
- `reseedExit` - Reseed exit chains
- `scanChain` - Scan and pass chain token
- `closeChain` - Close chain and mark final holder
- `setChainHolder` - Manually set chain holder
- `startEarlyLeave` - Start early leave chain
- `stopEarlyLeave` - Stop early leave chain

**Attendance** (6):
- `getAttendance` - Get attendance records
- `joinSession` - Attendee joins session
- `markExit` - Mark attendee exit via direct QR
- `markAttendeeExit` - Mark specific attendee exit
- `getAttendeeToken` - Get attendee's current token (creates on-demand if expired)
- `clearSession` - Clear session data

**Snapshots** (5):
- `takeSnapshot` - Create on-demand snapshot
- `listSnapshots` - List session snapshots
- `getSnapshotTrace` - Get chain transfer trace
- `getChainHistory` - Get chain history
- `compareSnapshots` - Compare two snapshots
- `deleteSnapshot` - Delete a snapshot

**SignalR** (3):
- `negotiateDashboard` - Organizer dashboard connection
- `attendeeNegotiate` - Attendee view connection
- `attendeeOnline` - Report attendee online status

**Quiz** (8):
- `analyzeSlide` - AI slide analysis with GPT Vision
- `generateQuestions` - Generate quiz questions with GPT
- `sendQuizQuestion` - Send question to all present students
- `getAttendeeQuestions` - Get pending questions for attendee
- `submitQuizAnswer` - Submit and evaluate answer
- `getQuizQuestions` - Get all quiz questions for a session
- `getQuizResponses` - Get quiz responses
- `deleteQuizQuestion` - Delete a quiz question
- `deleteQuizConversation` - Delete quiz conversation
- `cleanupQuizConversations` - Clean up old quiz conversations

**Image Capture** (6):
- `initiateImageCapture` - Start capture request (starts Durable orchestrator)
- `notifyImageUpload` - Handle image upload notification (raises Durable event for early termination)
- `analyzeCaptureImages` - Analyze captured images
- `getCaptureHistory` - Get capture history
- `getCaptureResults` - Get capture analysis results
- `deleteCaptureRequest` - Delete a capture request

**Durable Functions** (2):
- `captureTimeoutOrchestrator` - Orchestrator for capture timeout lifecycle
- `processCaptureTimeoutActivity` - Activity function for processing expired/completed captures

**Co-Organizer Management** (3):
- `shareSession` - Share session with co-organizer
- `getCoOrganizers` - Get co-organizers for a session
- `removeCoOrganizer` - Remove a co-organizer

**External Organizer Management** (1):
- `manageExternalOrganizers` - CRUD for external organizer entries

**Attendee List Management** (8):
- `createAttendeeList` - Create a named attendee list
- `getAttendeeList` - Get a specific attendee list
- `getAttendeeLists` - Get all attendee lists for an organizer
- `updateAttendeeList` - Update attendee list entries
- `deleteAttendeeList` - Delete an attendee list
- `getSessionAttendeeList` - Get attendee list linked to a session
- `linkAttendeeListToSession` - Link an attendee list to a session
- `unlinkSessionAttendeeList` - Unlink attendee list from session
- `updateSessionAttendeeList` - Update session-specific attendee list

**Attendance Management** (2):
- `deleteAttendance` - Delete individual attendance record
- `bulkDeleteAttendance` - Bulk delete attendance records

**Utilities** (integrated in functions):
- Geolocation validation (Haversine formula)
- GPT-based seating position estimation
- SignalR broadcasting (JWT token generation)
- Token encryption/decryption
- Custom metrics tracking (Application Insights)
- OpenTelemetry tracing

**Note**: `rotateTokens` function has been removed — tokens are now created on-demand by `getAttendeeToken` when clients poll.

### 3. Database (Azure Table Storage)

**20 Tables** (defined in `backend/src/utils/database.ts` TableNames):

1. **Sessions** - Session metadata
2. **Attendance** - Attendee attendance records
3. **Chains** - QR chain state
4. **Tokens** - Chain tokens (25s TTL for chains, 10s for snapshots)
5. **UserSessions** - User-session mapping
6. **AttendanceSnapshots** - Snapshot metadata
7. **ChainHistory** - Chain transfer audit
8. **ScanLogs** - QR scan audit (legacy/optional)
9. **DeletionLog** - Deletion audit trail
10. **QuizQuestions** - AI-generated quiz questions
11. **QuizResponses** - Attendee quiz answers
12. **QuizMetrics** - Quiz performance metrics
13. **QuizConversations** - Quiz AI conversation threads
14. **CaptureRequests** - Image capture requests
15. **CaptureUploads** - Image uploads
16. **CaptureResults** - Capture analysis results
17. **ExternalOrganizers** - External organizer entries
18. **OtpCodes** - OTP verification codes
19. **AttendeeListEntries** - Attendee list entries
20. **SessionAttendeeEntries** - Session-specific attendee list snapshots

**Note**: `scripts/tables-config.sh` lists only the original 12 core tables. The authoritative source is `TableNames` in `backend/src/utils/database.ts`.

**Blob Containers**:
- `quiz-slides` - Slide images for quiz generation
- `student-captures` - Student image captures

See [DATABASE_TABLES.md](DATABASE_TABLES.md) for detailed schemas.

### 4. Real-time Communication (Azure SignalR)

**Configuration**: 
- Production: Standard S1 tier (1000 concurrent connections)
- Development: Free tier (20 connections)

**Connections**:
- Organizer Dashboard (`negotiateDashboard`): Real-time attendance updates
- Attendee View (`attendeeNegotiate`): Real-time token updates and quiz questions

**Events**:
- `attendanceUpdate` - Attendee attendance changed
- `chainUpdate` - Chain state changed
- `stallAlert` - Chain stalled warning
- `quizQuestion` - New quiz question for attendee
- `quizResult` - Quiz answer evaluation result
- `captureExpired` - Capture request expired/completed
- `captureResults` - Capture analysis results available
- `uploadComplete` - Image upload completed

**Fallback Behavior**:
- Quiz polling: 5 seconds (when SignalR unavailable)
- Status polling: 15 seconds (when not holder and SignalR unavailable)
- Auth header caching: 30 minutes

### 5. AI Services (Azure OpenAI + Foundry)

**Configuration**:
- Azure AI Services account (AIServices kind)
- Foundry Project for Agent Service
- Keyless authentication (managed identity)
- OpenTelemetry tracing for AI operations

**Default Model**: `gpt-5.4` (configurable via environment variables)

**Environment Variables**:
| Variable | Purpose |
|----------|---------|
| `AZURE_OPENAI_DEPLOYMENT` | Primary model deployment name (default: `gpt-5.4`) |
| `AZURE_OPENAI_VISION_DEPLOYMENT` | Vision model deployment name (falls back to primary) |
| `AZURE_OPENAI_ENDPOINT` | Azure OpenAI endpoint URL |

**Agents** (via Foundry Agent Service):
- Quiz Question Generator - Creates questions from slides
- Seating Position Analyzer - Analyzes venue photos for GPT-based position estimation

### 6. Authentication (Email OTP + JWT)

**Provider**: Self-managed JWT with Email OTP verification via SMTP

**Authentication Flow**:
1. User enters email address on `/login` page
2. `requestOtp` sends 6-digit OTP via SMTP (nodemailer)
3. User enters OTP code
4. `verifyOtp` validates OTP and issues JWT token
5. JWT stored in HTTP-only cookie
6. Role assigned based on email domain or ExternalOrganizers table lookup

**Role Assignment**:
- Configurable domain-based automatic role assignment via environment variables
- `ORGANIZER_DOMAIN` - Email domain for organizer role (e.g., `vtc.edu.hk`)
- `ATTENDEE_DOMAIN` - Optional restriction for attendee role
- `ALLOWED_EMAIL_DOMAINS` - Optional comma-separated list to restrict authentication
- External organizers can be added via ExternalOrganizers table

**Security**:
- JWT tokens with configurable expiration
- HTTP-only cookies prevent XSS
- Rate limiting on OTP requests
- OTP expires after 5 minutes
- Maximum 3 verification attempts per OTP
- OTP codes stored in OtpCodes table with TTL

**Note**: MSAL (`@azure/msal-browser`, `@azure/msal-react`) is listed in frontend `package.json` but is not currently imported or used in any frontend code. Authentication is handled entirely via the custom OTP + JWT flow.

---

## Data Flow

### Session Creation Flow

```
Teacher → Frontend → Backend (createSession)
                        ↓
                   Validate auth & role
                        ↓
                   Create session record
                        ↓
                   If recurring: Generate instances
                        ↓
                   If attendeeListId: Snapshot-copy list entries
                        ↓
                   Return session IDs
                        ↓
Frontend ← Backend ← Success response
```

### Entry Chain Flow

```
1. Teacher seeds entry chains
   → Backend creates N chains
   → Selects random students as initial holders
   → Creates tokens with 25s expiry
   → Broadcasts updates via SignalR

2. Attendee A (holder) displays QR code
   → QR contains: sessionId, chainId, tokenId

3. Attendee B scans Attendee A's QR
   → Backend validates token
   → Checks if Attendee B was already a holder in this chain
   → If already holder: Returns error "Already been a holder in this chain"
   → If not: Marks Attendee A as present (entryMethod: 'CHAIN')
   → Creates new token for Attendee B (25s TTL)
   → Attendee B becomes new holder
   → Records transfer in ChainHistory
   → Broadcasts updates

4. Chain continues until teacher closes it
   → Final holder marked as present
   → Chain state set to COMPLETED
```

### Exit Verification Flow

**Method 1: Direct QR Code**
```
Student scans teacher's exit QR
   → Backend validates session
   → Marks student as exited (exitMethod: 'DIRECT_QR')
   → Sets exitedAt timestamp
   → Broadcasts update
```

**Method 2: Exit Chain**
```
Similar to entry chain but:
   → Only selects students who completed entry
   → Sets exitMethod: 'CHAIN'
   → Marks exitVerified: true
```

### Snapshot Flow

```
Teacher clicks "Take Snapshot"
   → Backend gets all online students
   → Creates N chains (SNAPSHOT phase)
   → Selects random holders
   → Creates snapshot record
   → Creates tokens with 10s TTL (shorter than regular chains)
   → Broadcasts updates
   → Students see QR codes
   → Chains run normally
   → Records who was present at that moment
```

### Image Capture Flow (Durable Functions)

```
1. Organizer initiates capture
   → initiateImageCapture creates CaptureRequest
   → Starts captureTimeoutOrchestrator (Durable)
   → Broadcasts capture request to attendees

2. Attendees upload images
   → notifyImageUpload records each upload
   → If all students uploaded: raises external event for early termination

3. Timeout or early termination
   → captureTimeoutOrchestrator waits for timer OR external event
   → Calls processCaptureTimeoutActivity
   → Activity analyzes images via GPT position estimation
   → Broadcasts captureExpired and captureResults events
```

### Chain Holder Prevention

**Purpose**: Prevent students from becoming chain holders multiple times in the same chain

**Implementation**:
```
When student scans a QR code:
1. Query ChainHistory table for current chainId
2. Check if scannerId appears as 'toHolder' in any record
3. If found: Return error "Already been a holder in this chain"
4. If not found: Allow student to become new holder
```

**Behavior**:
- ✅ Student can be holder once per chain
- ✅ Student can be holder in entry chain AND exit chain AND snapshot chains
- ❌ Attendee CANNOT be holder multiple times in the SAME chain
- ✅ Ensures fair distribution within each chain
- ✅ Prevents manipulation by becoming holder repeatedly

**Error Response**:
```json
{
  "error": {
    "code": "ALREADY_HOLDER",
    "message": "You have already been a holder in this chain",
    "timestamp": 1234567890
  }
}
```

---

## Key Design Decisions

### 1. Timestamps in Seconds

**Decision**: Use Unix timestamps in seconds (10 digits) throughout backend

**Rationale**:
- Consistent with Unix standard
- Smaller numbers, easier to read
- Less confusion than milliseconds
- Frontend converts to milliseconds when needed

**Implementation**:
- All `*At` fields use seconds
- `Math.floor(Date.now() / 1000)` for current time
- Frontend: `timestamp * 1000` for display

### 2. Entry/Exit Method Tracking

**Decision**: Track how attendance was verified with separate fields

**Fields**:
- `entryMethod`: "DIRECT_QR" | "CHAIN"
- `exitMethod`: "DIRECT_QR" | "CHAIN"

**Rationale**:
- Distinguish between verification methods
- Audit trail for attendance
- Analytics on method effectiveness
- UI can show badges (🔗 Chain vs 📱 QR)

### 3. Simplified Snapshots

**Decision**: Snapshots are just on-demand chains with shorter token TTL (10s)

**Rationale**:
- Core purpose: Record who's present at a moment
- Chains already provide the mechanism
- Simpler UI, easier to understand

**Implementation**:
- SNAPSHOT phase in chains
- Creates chains for online students
- Records metadata in AttendanceSnapshots
- 10-second token TTL (vs 25s for regular chains)

### 4. Token TTL

**Decision**: Chain tokens expire after 25 seconds; snapshot tokens after 10 seconds

**Rationale**:
- Fast rotation prevents cheating
- Forces attendees to be physically present
- Short enough to prevent sharing
- Long enough for legitimate scans
- Snapshots use shorter TTL for faster completion

**Configuration**: `CHAIN_TOKEN_TTL_SECONDS=25` (snapshots hardcoded to 10s)

### 5. Default Geofence: 1000 Meters

**Decision**: Default geofence radius is 1km

**Rationale**:
- Large campus coverage
- Reduces false positives
- Can be adjusted per session
- Warning mode vs enforce mode

### 6. SignalR for Real-time Updates

**Decision**: Use Azure SignalR Service for push updates

**Rationale**:
- Real-time dashboard updates
- Better UX than polling
- Scalable (Azure managed)
- Automatic reconnection

**Events**:
- Attendance changes
- Chain updates
- Token updates
- Stall alerts
- Capture events (expired, results, upload complete)

### 7. Client-Driven Token Refresh

**Decision**: Tokens are created on-demand by client requests, not by server timer

**Rationale**:
- Eliminates redundant server-side polling
- Reduces Azure Function execution costs
- Tokens created only when needed
- Simpler architecture

**Implementation**:
- Client polls `getAttendeeToken` every 3-5 seconds
- If token expired, `getAttendeeToken` creates new one on-demand
- No background timer needed
- `rotateTokens` function removed (file deleted)

### 8. Durable Functions for Capture Timeout

**Decision**: Use Azure Durable Functions for image capture timeout orchestration

**Rationale**:
- Reliable timer-based expiration
- Support for early termination via external events
- Automatic retry on activity failures
- State persistence across function restarts

**Implementation**:
- `captureTimeoutOrchestrator` uses `Task.any()` to race timer vs external event
- `processCaptureTimeoutActivity` handles analysis and broadcasting
- Custom metrics tracked via Application Insights

### 9. Centralized Table Configuration

**Decision**: Single source of truth for table names in code

**File**: `backend/src/utils/database.ts` (authoritative, 20 tables)  
**Legacy**: `scripts/tables-config.sh` (12 core tables only, used by shell scripts)

---

## Performance & Polling

### Polling Intervals

**Quiz Questions** (when SignalR unavailable):
- Interval: 5 seconds
- Endpoint: `GET /api/sessions/{sessionId}/attendee-questions`
- Purpose: Check for new quiz questions
- Only active when SignalR disconnected

**Status Updates** (when not holder and SignalR unavailable):
- Interval: 15 seconds
- Endpoint: `GET /api/sessions/{sessionId}`
- Purpose: Check attendance status changes
- Only active when not a chain holder

**Token Refresh** (when holder):
- Interval: 5 seconds
- Endpoint: `GET /api/sessions/{sessionId}/tokens/{attendeeId}`
- Purpose: Get fresh QR token
- Active only for chain holders

**Auth Header Caching**:
- Duration: 30 minutes
- Reduces API calls
- Improves performance
- Implemented in `frontend/src/utils/authHeaders.ts`

### SignalR vs Polling

**With SignalR** (Production - Standard S1):
- Quiz delivery: <1 second latency
- Status updates: <1 second latency
- Concurrent students: Up to 1,000
- API calls: ~12/attendee/hour

**Fallback Mode** (When SignalR unavailable):
- Quiz delivery: 0-5 seconds (avg 2.5s)
- Status updates: 0-15 seconds (avg 7.5s)
- Concurrent students: Unlimited
- API calls: ~360/attendee/hour

**Automatic Detection**:
- Frontend detects SignalR availability
- Automatically enables/disables polling
- Seamless fallback behavior
- No manual configuration needed

---

## Security

### Authentication
- Email OTP with JWT tokens
- SMTP-based OTP delivery (nodemailer)
- Email domain-based role assignment
- No passwords stored

### Authorization
- Role-based access control (RBAC)
- Organizer vs Attendee permissions
- Session ownership validation
- Co-organizer access via session sharing

### Data Protection
- Encrypted QR tokens
- Token expiration (25s chains, 10s snapshots)
- Geolocation validation
- Audit trails (ScanLogs, ChainHistory, DeletionLog)

### CORS Configuration
- Specific origins (no wildcard with credentials)
- Credentials support enabled
- Production + local dev origins

---

## Performance

### Backend
- Function cold start: ~2-3s
- Warm function: ~50-200ms
- Token generation: ~1ms (encryption only)
- Database queries: ~10-50ms

### Frontend
- Static site (pre-rendered)
- CDN delivery
- Service worker caching
- Lazy loading components

### Database
- Azure Table Storage (NoSQL)
- Partition key optimization
- Query filtering
- Batch operations where possible

---

## Scalability

### Horizontal Scaling
- Azure Functions auto-scale
- Static Web Apps CDN
- SignalR Service managed scaling

### Database
- Table Storage: 20,000 ops/sec per partition
- Partition by sessionId for isolation
- No cross-partition queries

### Cost Optimization
- Consumption plan for Functions
- Free tier for Static Web Apps
- Table Storage: ~$1/month for typical usage

---

## Monitoring & Observability

### Application Insights
- Function execution logs
- Performance metrics
- Error tracking
- Custom events

### Custom Metrics (OpenTelemetry)
- `CaptureOrchestrator.Duration` - Orchestrator execution time
- `CaptureOrchestrator.EarlyTermination` - Early termination events
- `CaptureOrchestrator.Success` - Orchestrator success/failure
- `CaptureTimeout.Success` - Activity function success/failure
- `CaptureTimeout.UploadCount` - Upload counts per capture

### OpenTelemetry Tracing
- Azure Monitor Trace Exporter
- Agent service operation tracing
- Configured in `backend/src/utils/agentService.ts`

### Audit Trails
- ScanLogs: All QR scans (legacy/optional)
- ChainHistory: All chain transfers
- DeletionLog: All deletions

---

## Deployment

### Infrastructure as Code (Bicep)

All Azure resources are defined in Bicep templates:

```
infrastructure/
├── main.bicep              # Orchestrator
├── modules/
│   ├── storage.bicep       # Table + Blob storage
│   ├── signalr.bicep       # Real-time messaging
│   ├── functions.bicep     # Backend API
│   ├── appinsights.bicep   # Monitoring
│   ├── openai.bicep        # AI services + Foundry
│   └── rbac.bicep          # Role assignments
├── parameters/
│   ├── dev.bicepparam      # Development config
│   ├── staging.bicepparam  # Staging config
│   └── prod.bicepparam     # Production config
├── deploy.sh               # Deployment script (bash)
├── deploy.ps1              # Deployment script (PowerShell)
├── validate.sh             # Validation script
└── README.md               # Infrastructure docs
```

### Deployment Scripts

- `deploy-full-production.sh` - Complete production deployment (fail-fast)
- `deploy-full-development.sh` - Development deployment (with retries)

### Environments
- **Local**: Azurite + localhost
- **Development**: Azure resources (dev parameters)
- **Staging**: Azure resources (staging parameters)
- **Production**: Azure resources (prod parameters)

See [INFRASTRUCTURE_BICEP.md](INFRASTRUCTURE_BICEP.md) and [DEPLOYMENT_SCRIPTS.md](DEPLOYMENT_SCRIPTS.md) for details.

---

## Future Enhancements

### Planned Features
- GitHub Actions CI/CD
- Admin dashboard
- Analytics and reporting
- Mobile app (React Native)

### Technical Debt
- Remove unused MSAL dependencies from frontend package.json
- Sync `scripts/tables-config.sh` with actual 20 tables in `database.ts`
- Add comprehensive error handling
- Implement retry logic
- Add request validation middleware
- Optimize database queries
- Add caching layer

---

## References

- [README.md](../../README.md) - Project overview
- [DATABASE_TABLES.md](DATABASE_TABLES.md) - Database schemas
- [INFRASTRUCTURE_BICEP.md](INFRASTRUCTURE_BICEP.md) - Bicep module details
- [DEPLOYMENT_SCRIPTS.md](DEPLOYMENT_SCRIPTS.md) - Deployment script architecture
- [ENTRY_CHAIN_DUPLICATE_PREVENTION.md](ENTRY_CHAIN_DUPLICATE_PREVENTION.md) - Chain holder prevention
- [../deployment/DEPLOYMENT_GUIDE.md](../deployment/DEPLOYMENT_GUIDE.md) - Deployment instructions
- [GETTING_STARTED.md](../../GETTING_STARTED.md) - Setup guide

---

**Last Updated**: April 28, 2026
