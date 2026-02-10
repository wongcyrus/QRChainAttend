# System Architecture

**Last Updated**: February 10, 2026  
**Version**: 2.0

---

## Overview

The QR Chain Attendance System is a real-time attendance tracking application built on Azure services with a focus on security, scalability, and user experience.

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                         Frontend                             │
│  Next.js + React + TypeScript (Azure Static Web Apps)       │
│  - Teacher Dashboard (Real-time monitoring)                  │
│  - Student View (QR scanning & display)                      │
│  - Session Management (CRUD with recurring)                  │
└─────────────────┬───────────────────────────────────────────┘
                  │
                  │ HTTPS + Auth Headers
                  │
┌─────────────────▼───────────────────────────────────────────┐
│                    Backend API                               │
│  Azure Functions (Node.js 20 + TypeScript)                  │
│  - 36 HTTP-triggered functions                               │
│  - Authentication & Authorization                            │
│  - Business Logic                                            │
└─────────────────┬───────────────────────────────────────────┘
                  │
        ┌─────────┼─────────┐
        │         │         │
        ▼         ▼         ▼
┌───────────┐ ┌──────────┐ ┌─────────────┐
│  Azure    │ │  Azure   │ │   Azure     │
│  Table    │ │  SignalR │ │   AD        │
│  Storage  │ │  Service │ │   (Auth)    │
│  (9 tables)│ │ (Real-time)│ │           │
└───────────┘ └──────────┘ └─────────────┘
```

---

## Core Components

### 1. Frontend (Next.js)

**Technology Stack**:
- Next.js 14 (Static Site Generation)
- React 18 with TypeScript
- SignalR Client for real-time updates
- QR Code generation/scanning libraries

**Key Features**:
- Progressive Web App (PWA) support
- Offline functionality with service workers
- Mobile-first responsive design
- Real-time dashboard updates

**Pages**:
- `/` - Home page with role selection
- `/teacher` - Teacher dashboard
- `/student` - Student view
- `/session/[id]` - Session details

**Components** (22+):
- Session management (create, edit, list)
- QR code display and scanning
- Real-time attendance monitoring
- Snapshot management
- Export controls

### 2. Backend (Azure Functions)

**Technology Stack**:
- Azure Functions v4
- Node.js 20 runtime
- TypeScript
- HTTP triggers (anonymous auth level)

**Function Categories** (35 total):

**Authentication** (2):
- `getRoles` - Get user roles
- `getUserRoles` - Get specific user roles

**Session Management** (8):
- `createSession` - Create single/recurring sessions
- `getSession` - Get session details with attendance
- `getTeacherSessions` - List teacher's sessions
- `deleteSession` - Delete session with cascade
- `endSession` - End active session
- `checkSession` - Verify session status
- `registerSession` - Register student to session
- `clearSession` - Clear session data

**QR Code Generation** (4):
- `getEntryQR` - Generate entry QR code
- `getExitQR` - Generate exit QR code
- `getLateQR` - Generate late entry QR code
- `getEarlyLeaveQR` - Generate early leave QR code

**Chain Management** (6):
- `seedEntry` - Seed initial entry chains
- `startExitChain` - Start exit chains
- `scanChain` - Scan and pass chain token
- `closeChain` - Close chain and mark final holder
- `setChainHolder` - Manually set chain holder
- `rotateTokens` - Rotate expired tokens

**Attendance** (4):
- `getAttendance` - Get attendance records
- `markExit` - Mark student exit via direct QR
- `getStudentToken` - Get student's current token
- `compareSnapshots` - Compare two snapshots

**Snapshots** (4):
- `takeSnapshot` - Create on-demand snapshot
- `getSnapshots` - List session snapshots
- `getSnapshotTrace` - Get chain transfer trace
- `getChainHistory` - Get chain history

**SignalR** (4):
- `negotiate` - SignalR connection negotiation
- `dashboardNegotiate` - Teacher dashboard connection
- `studentNegotiate` - Student view connection
- `broadcastUpdate` - Broadcast updates

**Utilities** (3):
- `healthCheck` - API health check
- `validateGeolocation` - Validate student location
- `encryptToken` / `decryptToken` - Token encryption/decryption

**Note**: `rotateTokens` function has been removed - tokens are now created on-demand by `getStudentToken` when clients poll.

### 3. Database (Azure Table Storage)

**9 Tables**:

1. **Sessions** - Session metadata
2. **Attendance** - Student attendance records
3. **Chains** - QR chain state
4. **Tokens** - Chain tokens (10s TTL)
5. **UserSessions** - User-session mapping
6. **AttendanceSnapshots** - Snapshot metadata
7. **ChainHistory** - Chain transfer audit
8. **ScanLogs** - QR scan audit
9. **DeletionLog** - Deletion audit trail

See [DATABASE_TABLES.md](DATABASE_TABLES.md) for detailed schemas.

### 4. Real-time Communication (Azure SignalR)

**Connections**:
- Teacher Dashboard: Real-time attendance updates
- Student View: Real-time token updates

**Events**:
- `attendanceUpdate` - Student attendance changed
- `chainUpdate` - Chain state changed
- `stallAlert` - Chain stalled warning
- `tokenUpdate` - Student token updated

### 5. Authentication (Azure AD)

**Provider**: Azure Active Directory via Static Web Apps

**Role Assignment**:
- Email domain-based automatic role assignment
- `@vtc.edu.hk` (excluding `@stu.vtc.edu.hk`) → Teacher
- `@stu.vtc.edu.hk` → Student

**Authentication Flow**:
1. User clicks "Login"
2. Redirected to Azure AD
3. Authenticates with Microsoft account
4. Redirected back with auth token
5. Frontend reads `/.auth/me` endpoint
6. Backend validates `x-ms-client-principal` header

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
                   Return session IDs
                        ↓
Frontend ← Backend ← Success response
```

### Entry Chain Flow

```
1. Teacher seeds entry chains
   → Backend creates N chains
   → Selects random students as initial holders
   → Creates tokens with 10s expiry
   → Broadcasts updates via SignalR

2. Student A (holder) displays QR code
   → QR contains: sessionId, chainId, tokenId

3. Student B scans Student A's QR
   → Backend validates token
   → Marks Student A as present (entryMethod: 'CHAIN')
   → Creates new token for Student B
   → Student B becomes new holder
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
   → Broadcasts updates
   → Students see QR codes
   → Chains run normally
   → Records who was present at that moment
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

**Decision**: Snapshots are just on-demand chains

**Rationale**:
- Original design was too complex (trace viewing, comparison)
- Core purpose: Record who's present at a moment
- Chains already provide the mechanism
- Simpler UI, easier to understand

**Implementation**:
- SNAPSHOT phase in chains
- Creates chains for online students
- Records metadata in AttendanceSnapshots
- No special trace/comparison features

### 4. Token TTL: 10 Seconds

**Decision**: Chain tokens expire after 10 seconds

**Rationale**:
- Fast rotation prevents cheating
- Forces students to be physically present
- Short enough to prevent sharing
- Long enough for legitimate scans

**Configuration**: `CHAIN_TOKEN_TTL_SECONDS=10`

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

### 7. Client-Driven Token Refresh

**Decision**: Tokens are created on-demand by client requests, not by server timer

**Rationale**:
- Eliminates redundant server-side polling
- Reduces Azure Function execution costs
- Tokens created only when needed
- Simpler architecture

**Implementation**:
- Client polls `getStudentToken` every 3-5 seconds
- If token expired, `getStudentToken` creates new one on-demand
- No background timer needed
- `rotateTokens` function removed (file deleted)

**Benefits**:
- Lower costs (no timer executions)
- Better resource utilization
- Tokens only created for active students
- Simpler debugging

### 8. Centralized Table Configuration

**Decision**: Single source of truth for table names

**File**: `scripts/tables-config.sh`

**Rationale**:
- Consistency across scripts
- Easy to update table names
- Prevents typos
- Single place to maintain

---

## Security

### Authentication
- Azure AD integration
- Email domain-based role assignment
- No passwords stored

### Authorization
- Role-based access control (RBAC)
- Teacher vs Student permissions
- Session ownership validation

### Data Protection
- Encrypted QR tokens
- Token expiration (10s)
- Geolocation validation
- Audit trails (ScanLogs, DeletionLog)

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

### Health Checks
- `/api/healthCheck` endpoint
- Database connectivity
- SignalR connectivity

### Audit Trails
- ScanLogs: All QR scans
- ChainHistory: All chain transfers
- DeletionLog: All deletions

---

## Deployment

### CI/CD
- GitHub Actions (planned)
- Manual deployment scripts (current)

### Environments
- **Local**: Azurite + localhost
- **Production**: Azure resources

### Deployment Scripts
- `deploy-production.sh` - Full deployment
- `deploy-frontend-only.sh` - Frontend only
- `deploy-backend-only.sh` - Backend only
- `quick-deploy.sh` - Fast deployment

See [DEPLOYMENT_GUIDE.md](DEPLOYMENT_GUIDE.md) for details.

---

## Future Enhancements

### Planned Features
- Automated testing (unit + integration)
- GitHub Actions CI/CD
- Admin dashboard
- Analytics and reporting
- Mobile app (React Native)

### Technical Debt
- Add comprehensive error handling
- Implement retry logic
- Add request validation middleware
- Optimize database queries
- Add caching layer

---

## References

- [README.md](README.md) - Project overview
- [DATABASE_TABLES.md](DATABASE_TABLES.md) - Database schemas
- [ENTRY_EXIT_METHODS.md](ENTRY_EXIT_METHODS.md) - Method tracking
- [DEPLOYMENT_GUIDE.md](DEPLOYMENT_GUIDE.md) - Deployment instructions
- [GETTING_STARTED.md](GETTING_STARTED.md) - Setup guide

---

**Last Updated**: February 10, 2026
