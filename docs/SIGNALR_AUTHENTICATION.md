# SignalR Authentication in QR Chain Attendance System

## Overview

SignalR authentication in this system uses **JWT (JSON Web Token)** based authentication. The backend generates short-lived access tokens that clients use to connect to Azure SignalR Service.

## Authentication Flow

```
┌─────────┐                ┌──────────────┐                ┌─────────────────┐
│ Client  │                │   Backend    │                │ Azure SignalR   │
│(Browser)│                │  (Function)  │                │    Service      │
└────┬────┘                └──────┬───────┘                └────────┬────────┘
     │                            │                                 │
     │ 1. Request negotiate       │                                 │
     │ (with user auth header)    │                                 │
     ├───────────────────────────>│                                 │
     │                            │                                 │
     │                            │ 2. Validate user auth           │
     │                            │    (x-ms-client-principal)      │
     │                            │                                 │
     │                            │ 3. Generate JWT token           │
     │                            │    - Sign with SignalR key      │
     │                            │    - Include user ID            │
     │                            │    - Set expiry (1 hour)        │
     │                            │                                 │
     │ 4. Return connection info  │                                 │
     │    {url, accessToken}      │                                 │
     │<───────────────────────────┤                                 │
     │                            │                                 │
     │ 5. Connect to SignalR      │                                 │
     │    with access token       │                                 │
     ├────────────────────────────┼────────────────────────────────>│
     │                            │                                 │
     │                            │                                 │ 6. Validate JWT
     │                            │                                 │    - Verify signature
     │                            │                                 │    - Check expiry
     │                            │                                 │
     │ 7. Connection established  │                                 │
     │<────────────────────────────────────────────────────────────┤
     │                            │                                 │
```

## How It Works

### 1. User Authentication (Azure AD)

First, users authenticate with Azure AD through Static Web Apps:
- User logs in via `/.auth/login/aad`
- Azure AD validates credentials
- Static Web Apps injects `x-ms-client-principal` header into all API requests

### 2. Negotiate Endpoint

When a client wants to connect to SignalR, it calls a "negotiate" endpoint:

**For Teachers (Dashboard):**
```
POST /api/sessions/{sessionId}/dashboard/negotiate
```

**For Students:**
```
POST /api/sessions/{sessionId}/negotiate
```

**For General:**
```
POST /api/negotiate
```

### 3. JWT Token Generation

The negotiate function:

1. **Extracts user identity** from `x-ms-client-principal` header
2. **Validates user role** (Teacher/Student)
3. **Generates a JWT token** with:
   - **Audience (`aud`)**: SignalR hub URL
   - **Issued At (`iat`)**: Current timestamp
   - **Expiry (`exp`)**: 1 hour from now
   - **User ID (`nameid` or `userId`)**: User's email or ID
   - **Custom claims**: Role, sessionId, etc.

4. **Signs the token** using HMAC-SHA256 with SignalR's access key

### 4. Token Structure

```javascript
// Header
{
  "typ": "JWT",
  "alg": "HS256"
}

// Payload
{
  "aud": "https://signalr-qrattendance-dev.service.signalr.net/client/?hub=dashboard",
  "iat": 1707148800,
  "exp": 1707152400,
  "nameid": "teacher@vtc.edu.hk",
  "userId": "teacher@vtc.edu.hk",
  "role": "teacher",
  "sessionId": "abc-123"
}

// Signature
HMACSHA256(
  base64UrlEncode(header) + "." + base64UrlEncode(payload),
  SignalR_AccessKey
)
```

### 5. Client Connection

The client receives:
```json
{
  "url": "https://signalr-qrattendance-dev.service.signalr.net/client/?hub=dashboard",
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

Then connects using SignalR client library:
```typescript
const connection = new signalR.HubConnectionBuilder()
  .withUrl(connectionInfo.url, {
    accessTokenFactory: () => connectionInfo.accessToken
  })
  .build();

await connection.start();
```

## Security Features

### 1. Token Expiry
- Tokens expire after **1 hour**
- SignalR automatically reconnects with a new token
- Prevents token reuse after logout

### 2. User Identity Binding
- Each token is bound to a specific user ID
- Azure SignalR validates the user ID in the token
- Prevents token sharing between users

### 3. Hub Isolation
- Different hubs for different purposes:
  - `dashboard{sessionId}` - Teacher dashboard for specific session
  - `sessionhub` - Student session updates
  - `attendance` - General attendance updates
- Users can only connect to hubs they're authorized for

### 4. Role-Based Access
- Negotiate endpoints validate user roles:
  ```typescript
  if (!hasRole(principal, 'Teacher')) {
    return { status: 403, jsonBody: { error: 'Forbidden' } };
  }
  ```

### 5. Session Scoping
- Tokens include `sessionId` in payload
- Backend can validate user has access to that session
- Prevents cross-session data leakage

## Code Implementation

### Backend: Negotiate Function

```typescript
export async function negotiateDashboard(request: HttpRequest, context: InvocationContext) {
  // 1. Extract user from Azure AD header
  const principalHeader = request.headers.get('x-ms-client-principal');
  const principal = parseUserPrincipal(principalHeader);
  
  // 2. Validate role
  if (!hasRole(principal, 'Teacher')) {
    return { status: 403, jsonBody: { error: 'Forbidden' } };
  }
  
  // 3. Get SignalR connection string
  const connectionString = process.env.SIGNALR_CONNECTION_STRING;
  const endpoint = extractEndpoint(connectionString);
  const accessKey = extractAccessKey(connectionString);
  
  // 4. Generate JWT
  const userId = getUserId(principal);
  const hubName = `dashboard${sessionId}`;
  
  const payload = {
    aud: `${endpoint}/client/?hub=${hubName}`,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 3600,
    nameid: userId,
    role: 'teacher',
    sessionId: sessionId
  };
  
  const token = createJWT(payload, accessKey);
  
  // 5. Return connection info
  return {
    status: 200,
    jsonBody: {
      url: `${endpoint}/client/?hub=${hubName}`,
      accessToken: token
    }
  };
}
```

### Frontend: SignalR Connection

```typescript
// 1. Call negotiate endpoint
const response = await fetch(`${apiUrl}/sessions/${sessionId}/dashboard/negotiate`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
    // x-ms-client-principal is automatically added by Static Web Apps
  }
});

const connectionInfo = await response.json();

// 2. Create SignalR connection
const connection = new signalR.HubConnectionBuilder()
  .withUrl(connectionInfo.url, {
    accessTokenFactory: () => connectionInfo.accessToken
  })
  .withAutomaticReconnect()
  .build();

// 3. Register event handlers
connection.on('attendanceUpdate', (data) => {
  console.log('Attendance updated:', data);
});

// 4. Start connection
await connection.start();
```

## Local Development

In local development, SignalR authentication is **disabled** to avoid connection limits:

```json
// backend/local.settings.json
{
  "Values": {
    "SIGNALR_CONNECTION_STRING": "dummy"
  }
}
```

When the negotiate function detects `"dummy"`, it returns:
```json
{
  "url": null,
  "accessToken": null
}
```

The frontend then falls back to **polling** (refreshing data every 5 seconds).

## Production Configuration

### 1. SignalR Connection String

Set in Azure Function App settings:
```
SIGNALR_CONNECTION_STRING=Endpoint=https://signalr-qrattendance-dev.service.signalr.net;AccessKey=xxxxx;Version=1.0;
```

### 2. Azure AD Configuration

Ensure Static Web App has Azure AD authentication configured:
- Client ID
- Tenant ID
- Client Secret
- Redirect URIs

### 3. CORS Settings

SignalR Service must allow connections from your frontend:
- Go to Azure Portal > SignalR Service > Settings > CORS
- Add your Static Web App URL

## Troubleshooting

### Issue: "Connection count reaches limit"

**Cause**: SignalR Free tier has 20 concurrent connections

**Solutions**:
1. Use polling fallback (already implemented)
2. Upgrade to Standard tier
3. Implement connection pooling
4. Close connections when not needed

### Issue: "Failed to negotiate"

**Causes**:
- Invalid SignalR connection string
- Missing Azure AD authentication
- CORS not configured

**Debug**:
```typescript
// Check negotiate response
const response = await fetch('/api/negotiate');
const data = await response.json();
console.log('Negotiate response:', data);
```

### Issue: "Token expired"

**Cause**: JWT token expired after 1 hour

**Solution**: SignalR automatically reconnects with `withAutomaticReconnect()`:
```typescript
connection.onreconnecting(() => {
  console.log('Reconnecting...');
});

connection.onreconnected(() => {
  console.log('Reconnected!');
  // Refresh data
});
```

## Best Practices

### 1. Always Use Automatic Reconnect
```typescript
.withAutomaticReconnect({
  nextRetryDelayInMilliseconds: (retryContext) => {
    if (retryContext.previousRetryCount === 0) return 0;
    if (retryContext.previousRetryCount === 1) return 2000;
    if (retryContext.previousRetryCount === 2) return 10000;
    return 30000;
  }
})
```

### 2. Handle Connection State
```typescript
connection.onclose(() => {
  console.log('Connection closed');
  // Fall back to polling
});
```

### 3. Clean Up Connections
```typescript
useEffect(() => {
  // Setup connection
  const connection = setupSignalR();
  
  return () => {
    // Clean up on unmount
    connection.stop();
  };
}, []);
```

### 4. Implement Polling Fallback
```typescript
if (!connectionInfo.url) {
  // SignalR not available, use polling
  const interval = setInterval(() => {
    fetchData();
  }, 5000);
  
  return () => clearInterval(interval);
}
```

## Security Checklist

- [x] JWT tokens signed with strong key (HMAC-SHA256)
- [x] Tokens expire after 1 hour
- [x] User identity validated before token generation
- [x] Role-based access control enforced
- [x] Session scoping implemented
- [x] CORS properly configured
- [x] Connection string stored securely (not in code)
- [x] Automatic reconnection with new tokens
- [ ] Token refresh before expiry (optional enhancement)
- [ ] Rate limiting on negotiate endpoint (optional)

## References

- [Azure SignalR Service Authentication](https://learn.microsoft.com/en-us/azure/azure-signalr/signalr-concept-authenticate-oauth)
- [JWT.io - Token Debugger](https://jwt.io/)
- [SignalR JavaScript Client](https://learn.microsoft.com/en-us/aspnet/core/signalr/javascript-client)

---

**Summary**: SignalR authentication uses JWT tokens generated by backend negotiate endpoints. The tokens are signed with SignalR's access key and include user identity and role information. Azure SignalR Service validates these tokens on connection, ensuring only authenticated and authorized users can connect.
