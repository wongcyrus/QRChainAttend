# Snapshot Feature Deployment Guide

**Status**: Ready for deployment  
**Date**: February 8, 2026

---

## Overview

Teachers can take on-demand attendance snapshots, view QR chain transfer traces, and compare snapshots to see attendance changes.

---

## What Changed

### Backend
- `snapshotService.ts` (snapshot logic)
- `takeSnapshot.ts` (create snapshot)
- `listSnapshots.ts` (list snapshots)
- `getSnapshotTrace.ts` (chain traces)
- `compareSnapshots.ts` (compare snapshots)

### Frontend
- `SnapshotManager.tsx` (create, list, view, compare)
- `ChainTraceViewer.tsx` (trace visualization)
- `SnapshotComparison.tsx` (comparison tabs)
- Integrated into `TeacherDashboard.tsx`

### Types
- Added snapshot types in `shared.ts`

---

## Database Changes

### AttendanceSnapshots table
PartitionKey: sessionId  
RowKey: snapshotId

Fields:
- snapshotType
- snapshotIndex
- capturedAt
- chainsCreated
- studentsCaptured
- notes
- createdAt

### Chains table (optional fields)
- snapshotId
- snapshotIndex

### ScanLogs table (optional fields)
- snapshotId
- snapshotIndex
- seq

---

## Table Initialization

Local (Azurite):
```bash
./scripts/init-tables.sh
```

Azure (connection string):
```bash
AZURE_STORAGE_CONNECTION_STRING="<conn-string>" ./scripts/init-tables.sh
```

Azure (resource group):
```bash
./scripts/init-tables.sh <resource-group> [storage-account]
```

---

## Deployment

### Backend
```bash
cd backend
npm install
npm run build
func azure functionapp publish <function-app-name>
```

Local test:
```bash
npm start
```

### Frontend
```bash
cd frontend
npm install
npm run build
npm run deploy
```

---

## API Summary

- `POST /api/sessions/{sessionId}/snapshot?type=ENTRY|EXIT&count=1-20`
- `GET /api/sessions/{sessionId}/snapshots`
- `GET /api/sessions/{sessionId}/snapshots/{snapshotId}/chain-trace`
- `POST /api/sessions/{sessionId}/snapshots/compare?snap1=<id>&snap2=<id>`

All snapshot endpoints require teacher role.

---

## Teacher Usage (Quick)

1. Open TeacherDashboard.
2. Take snapshot (type + chain count).
3. View trace to see chain transfers.
4. Compare two snapshots to see attendance changes.

---

## Testing Checklist

1. Create snapshot and confirm it appears in list.
2. View chain trace for a snapshot.
3. Compare two snapshots.
4. Confirm errors are handled (invalid count, missing snapshot).

---

## Reset Behavior

- Local reset clears all Azurite data: `./scripts/reset-local-db.sh`.
- Production reset deletes and recreates tables (including AttendanceSnapshots): `./scripts/reset-production-db.sh`.

---

## Troubleshooting

### AttendanceSnapshots table not found
Run table initialization:
```bash
./scripts/init-tables.sh
```

### Chain traces empty
- Confirm ScanLogs entries have snapshotId.
- Confirm chains were created for the snapshot.
- Check function logs for errors.

### Comparison empty
- Verify both snapshots have scans in ScanLogs.
- Confirm snapshotId matches in snapshots and logs.

---

## Environment Variables

Backend:
```bash
AzureWebJobsStorage=<connection-string>
SIGNALR_CONNECTION_STRING=<connection-string>
QR_ENCRYPTION_KEY=<your-encryption-key>
CHAIN_TOKEN_TTL_SECONDS=20
```

Frontend:
```bash
NEXT_PUBLIC_API_URL=/api
NEXT_PUBLIC_ENVIRONMENT=production
```
