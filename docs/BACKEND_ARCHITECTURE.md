# Backend Architecture

## Overview

The backend is built on Azure Functions with TypeScript, providing a serverless API for the QR Chain Attendance system.

## Azure Functions Configuration

### Bindings
- HTTP triggers for REST endpoints
- Timer triggers for token rotation
- SignalR output bindings for real-time updates
- Table Storage bindings for data persistence

See `backend/host.json` for runtime configuration.

## Core Services

### AuthService
Handles authentication and authorization logic for teachers and students.

### TokenService
Manages QR token generation, validation, and rotation with caching support.

### ChainService
Implements the blockchain-like chain validation for attendance tracking.

### SessionService
Manages session lifecycle (create, start, end) with caching.

### AttendanceService
Tracks and retrieves attendance records.

### SignalRService
Handles real-time communication with clients via Azure SignalR Service.

### ValidationService
Provides input validation and sanitization.

## Caching Strategy

Redis-compatible caching for:
- Active sessions (5-minute TTL)
- QR tokens (30-second TTL)
- Attendance records (session duration)

See `backend/src/utils/cache.ts` for implementation.

## Error Handling

Centralized error handling middleware with:
- Custom error types (ValidationError, AuthenticationError, etc.)
- Structured error responses
- Logging integration

See `backend/src/middleware/errors.ts` for details.

## Retry Logic

Automatic retry with exponential backoff for:
- Table Storage operations
- SignalR message delivery
- External API calls

Configuration in `backend/src/utils/retry.ts`.

## SignalR Integration

Real-time updates for:
- Token rotation events
- Attendance updates
- Session state changes

Negotiate endpoint: `/api/negotiate`

## Configuration

Environment-based configuration via:
- `local.settings.json` (local development)
- Azure App Settings (production)

Required settings:
- `AzureWebJobsStorage`
- `SignalRConnectionString`
- `AZURE_OPENAI_ENDPOINT`
- `AZURE_OPENAI_API_KEY`

## Security

- Managed Identity for Azure service authentication
- RBAC for resource access
- Token-based authentication for API endpoints
- Input validation on all endpoints
