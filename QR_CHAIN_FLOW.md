# QR Chain Attendance Flow

## Overview
Students use their phone camera (external app) to scan QR codes. The web app displays status and QR codes only - no in-app scanning.

## Complete Flow

### 1. Teacher Creates Session
- Teacher logs in and creates a session
- Backend generates session QR code as URL: `http://localhost:3002/student?sessionId=xxx`
- Teacher can view QR code from session list or dashboard

### 2. Student Joins Session
**Via QR Code (Primary Method):**
1. Student uses phone camera app to scan teacher's session QR code
2. Phone opens URL in browser: `http://localhost:3002/student?sessionId=xxx`
3. If not logged in, redirects to `/dev-config` (local) or `/.auth/login/aad` (production)
4. After login, automatically joins the session
5. Shows `SimpleStudentView` with session info and status

**Via Manual Entry (Backup Method):**
1. Student navigates to `/student` page
2. Enters session ID manually
3. Clicks "Join Session"
4. Shows `SimpleStudentView`

### 3. Entry Chain Process
1. Teacher starts entry chain (seeds 3 chains)
2. First 3 students scan teacher's chain QR codes
3. Each becomes a "holder" and their QR code is displayed
4. Other students scan holder QR codes with phone camera
5. Chain passes to the scanner, previous holder is marked present
6. Process continues until all students are marked

### 4. Late Entry
1. Teacher activates late entry QR code
2. Late students scan with phone camera
3. Marked as "LATE_ENTRY" instead of "PRESENT_ENTRY"

### 5. Exit Chain Process
1. Teacher starts exit chain (similar to entry)
2. Students scan each other's exit QR codes
3. Last 3 students scan teacher's exit QR code
4. Exit verified for all participants

### 6. Early Leave
1. Teacher activates early leave QR code
2. Students leaving early scan with phone camera
3. Marked with early leave timestamp

## Key Components

### Frontend
- **`/student` page**: Join interface and session view router
- **`SimpleStudentView` component**: Displays session status and holder QR code
- **`/teacher` page**: Session management and QR code display
- **`TeacherDashboard` component**: Real-time attendance monitoring

### Backend
- **`createSession`**: Generates session with URL-based QR code
- **`joinSession`**: Enrolls student in session
- **`getSession`**: Returns session info and attendance
- **`seedEntry`**: Starts entry chain with 3 initial holders
- **`scanChain`**: Processes chain scans and transfers holder status
- **`startExitChain`**: Initiates exit verification
- **`scanExitChain`**: Processes exit chain scans

## QR Code Types

### 1. Session QR (Join)
- **Format**: URL string
- **Example**: `http://localhost:3002/student?sessionId=abc-123`
- **Scanned by**: Phone camera app
- **Opens**: Browser with auto-join

### 2. Chain Holder QR (Entry/Exit)
- **Format**: URL with chain token data
- **Example**: `http://localhost:3002/student?sessionId=abc-123&chainToken=xyz&type=entry`
- **Scanned by**: Phone camera app
- **Opens**: Browser, processes scan, transfers holder status

### 3. Late Entry QR
- **Format**: URL with late entry token
- **Example**: `http://localhost:3002/student?sessionId=abc-123&lateToken=xyz`
- **Scanned by**: Phone camera app
- **Opens**: Browser, marks late attendance

### 4. Early Leave QR
- **Format**: URL with early leave token
- **Example**: `http://localhost:3002/student?sessionId=abc-123&earlyLeaveToken=xyz`
- **Scanned by**: Phone camera app
- **Opens**: Browser, marks early departure

## Student View States

### Not Joined
- Shows join interface
- Manual session ID entry
- Instructions to scan teacher's QR code

### Joined - Not Holder
- Session information (class, time, status)
- Personal attendance status (present/late/verified)
- Instructions to scan peer QR codes
- Waiting message

### Joined - Is Holder
- Session information
- Personal attendance status
- **Large QR code display** with "You are the Chain Holder!" message
- Instructions to show QR to another student

### Session Ended
- Final attendance status
- Thank you message
- Option to leave session

## Environment Variables

### Frontend (.env.local)
```
NEXT_PUBLIC_ENVIRONMENT=local
NEXT_PUBLIC_API_URL=http://localhost:7071/api
```

### Backend (local.settings.json)
```json
{
  "Values": {
    "FRONTEND_URL": "http://localhost:3002",
    "AzureWebJobsStorage": "UseDevelopmentStorage=true"
  },
  "Host": {
    "CORS": "*"
  }
}
```

## Testing Locally

1. Start backend: `cd backend && npm start`
2. Start frontend: `cd frontend && npm run dev`
3. Login as teacher at `/dev-config`
4. Create session, view QR code
5. Open QR code URL in new browser tab (simulates phone scan)
6. Login as student at `/dev-config`
7. Verify auto-join and status display

## Next Steps

- Implement chain holder detection in `SimpleStudentView`
- Add URL parameter parsing for chain tokens
- Generate holder QR code URLs with chain data
- Test complete chain transfer flow
- Add SignalR real-time updates to student view
