# Geolocation Feature

## Overview

The QR Chain Attendance system now supports **geolocation-based attendance tracking** with two configurable modes:

- **Warning Mode**: Students outside the geofence can join/scan, but are flagged for teacher review
- **Enforce Mode**: Students outside the geofence are blocked from joining/scanning

## Key Features

### Always-On Location Capture
- Location data is **always collected** when students join a session or scan chains
- Location information is stored even when geofencing is disabled
- Supports graceful degradation if user denies location permission

### Two Enforcement Modes

#### Warning Mode (Default)
- Students outside the geofence can still join and scan
- Out-of-bounds scans are **flagged** with a warning icon (⚠️) in teacher dashboard
- Students see a warning message but can continue
- Useful for monitoring classroom attendance without blocking legitimate edge cases

#### Enforce Mode
- Students outside the geofence are **blocked** from joining or scanning
- Returns HTTP 403 error with `GEOFENCE_VIOLATION` code
- Students see error message with distance from classroom
- Useful for strict attendance policies requiring physical presence

## Configuration

### Creating a Session with Geofence

Teachers can configure geolocation when creating a session:

1. **Enable Geofence** checkbox
2. Click **"Use Current Location"** to auto-fill coordinates
3. Set **Radius (meters)** - e.g., 100m for classroom boundaries
4. Toggle **"Enforce Geofence"** checkbox:
   - ✅ Checked = **Enforce Mode** (block access)
   - ⬜ Unchecked = **Warning Mode** (allow with flag)

### Session Data Model

```typescript
interface Session {
  // ... existing fields
  location?: {
    latitude: number;
    longitude: number;
  };
  geofenceRadius?: number; // in meters
  enforceGeofence?: boolean; // true = block, false = warning
}
```

## Backend Implementation

### Geolocation Validation

The `validateGeolocation()` function in `backend/src/utils/geolocation.ts`:

- Uses **Haversine formula** to calculate distance between two GPS coordinates
- Returns validation result with:
  - `withinGeofence`: boolean indicating if student is within bounds
  - `distance`: calculated distance in meters
  - `warning`: human-readable message (e.g., "150m from classroom (limit: 100m)")
  - `shouldBlock`: whether to deny access (based on `enforceGeofence` setting)

### Join Session Flow

When a student joins a session (`joinSession.ts`):

1. Parse student location from request body
2. Retrieve session's geofence settings
3. Validate location using `validateGeolocation()`
4. If `shouldBlock = true`: Return 403 error
5. If out of bounds but not blocked: Save `locationWarning` to Attendance record
6. Always save `joinLocation` for audit trail

### Chain Scan Flow

When a student scans another student's QR (`scanChain.ts`):

1. Parse scanner location from request body
2. Validate location against session geofence
3. If blocked: Return 403 error
4. Save `scanLocation` and `locationWarning` to attendance record
5. Include `locationWarning` in response for frontend display

## Frontend Implementation

### Location Capture

The `getCurrentLocation()` utility in `frontend/src/utils/geolocation.ts`:

- Uses browser's `navigator.geolocation` API
- Returns `{latitude, longitude, accuracy}` or `undefined` if unavailable
- Gracefully handles permission denied (doesn't throw error)
- Settings:
  - `enableHighAccuracy: true` for best GPS precision
  - `timeout: 10000ms` (10 seconds)
  - `maximumAge: 60000ms` (cache for 1 minute)

### Session Enrollment

When joining via QR code (`SessionEnrollment.tsx`):

```typescript
const location = await getCurrentLocation();
const response = await fetch(`/api/sessions/${sessionId}/join`, {
  method: 'POST',
  body: JSON.stringify({ location }),
});
const data = await response.json();
if (data.locationWarning) {
  // Show warning to student
}
```

### Chain Scanning

When scanning peer QR codes (`SimpleStudentView.tsx`):

```typescript
const location = await getCurrentLocation();
const response = await fetch(`/api/sessions/${sessionId}/chains/${chainId}/scan`, {
  method: 'POST',
  body: JSON.stringify({ tokenId, location }),
});
const data = await response.json();
if (data.locationWarning) {
  setScanMessage(`✓ Scan successful!\n⚠️ ${data.locationWarning}`);
}
```

## Teacher Dashboard

### Location Warning Display

The teacher dashboard shows location warnings in the **Student Attendance** table:

| Student ID | Status | **Location** | Entry Time |
|------------|--------|--------------|------------|
| student1@... | ✓ PRESENT | ✓ | 09:00 AM |
| student2@... | ✓ LATE | ⚠️ Out of bounds | 09:20 AM |

- **✓** (green checkmark) = Within geofence
- **⚠️ Out of bounds** (yellow badge) = Outside geofence
- Hover over warning badge to see full message (e.g., "150m from classroom (limit: 100m)")

### Real-Time Updates

The dashboard receives location warnings via SignalR:

```typescript
interface AttendanceUpdate {
  studentId: string;
  entryStatus?: string;
  locationWarning?: string;
}
```

## Database Schema

### Attendance Records

Location data is stored in the **Attendance** table:

| Field | Type | Description |
|-------|------|-------------|
| `joinLocation` | JSON | Student's GPS coordinates when joining |
| `scanLocation` | JSON | Student's GPS coordinates when scanning |
| `locationWarning` | string | Warning message if out of bounds |
| `locationDistance` | number | Distance from classroom (meters) |

Example:
```json
{
  "partitionKey": "session-123",
  "rowKey": "student1@stu.vtc.edu.hk",
  "joinLocation": "{\"latitude\":22.3964,\"longitude\":114.1095,\"accuracy\":15}",
  "locationWarning": "150m from classroom (limit: 100m)",
  "locationDistance": 150
}
```

## Error Handling

### GEOFENCE_VIOLATION Error

When enforce mode is enabled and student is out of bounds:

```json
{
  "error": {
    "code": "GEOFENCE_VIOLATION",
    "message": "You are outside the allowed area for this class",
    "details": "Distance: 150m",
    "timestamp": 1234567890
  }
}
```

HTTP Status: **403 Forbidden**

### Location Permission Denied

If user denies location permission:

- **Warning Mode**: Attendance is recorded with warning "Location not provided"
- **Enforce Mode**: Access is blocked with "Location permission required" error

## Testing

### Local Development

1. Create a session with geofence enabled
2. Use browser DevTools → Sensors → Geolocation to override coordinates
3. Test different scenarios:
   - Within radius (should allow)
   - Outside radius with enforce=false (should warn)
   - Outside radius with enforce=true (should block)
   - Permission denied (test error handling)

### Mock Data

For testing without actual GPS:

```javascript
// Override getCurrentLocation for testing
const mockLocation = {
  latitude: 22.3964,
  longitude: 114.1095,
  accuracy: 15
};
```

## Best Practices

### Recommended Settings

- **Classroom**: 100-200m radius
  - Warning mode for flexible attendance
  - Enforce mode for strict policies
  
- **Outdoor venue**: 500m radius
  - Warning mode recommended (GPS accuracy varies)

- **Remote class**: Disable geofence entirely

### Privacy Considerations

- Location data is only collected during session activities
- Stored in secure Azure Table Storage
- Only visible to teachers of the session
- Students are informed when location is required

## Troubleshooting

### Students Can't Join (403 Error)

1. Check if `enforceGeofence = true`
2. Verify student is within `geofenceRadius`
3. Confirm student granted location permission
4. Check GPS accuracy (might be inaccurate indoors)

### Location Shows as "Out of bounds" Incorrectly

1. Increase `geofenceRadius` (GPS accuracy ±10-50m)
2. Use warning mode instead of enforce mode
3. Consider environmental factors (buildings, weather affect GPS)

### Location Not Being Saved

1. Verify `navigator.geolocation` is available
2. Check browser console for permission errors
3. Ensure HTTPS connection (geolocation requires secure context)
4. Confirm student granted location permission

## API Reference

### POST /api/sessions/{sessionId}/join

Request:
```json
{
  "token": "encrypted-token",
  "location": {
    "latitude": 22.3964,
    "longitude": 114.1095,
    "accuracy": 15
  }
}
```

Response (success with warning):
```json
{
  "success": true,
  "sessionId": "abc-123",
  "studentId": "student1@stu.vtc.edu.hk",
  "message": "Successfully enrolled in session",
  "locationWarning": "150m from classroom (limit: 100m)"
}
```

### POST /api/sessions/{sessionId}/chains/{chainId}/scan

Request:
```json
{
  "tokenId": "token-456",
  "location": {
    "latitude": 22.3964,
    "longitude": 114.1095,
    "accuracy": 15
  }
}
```

Response:
```json
{
  "success": true,
  "newHolder": "student2@stu.vtc.edu.hk",
  "seq": 3,
  "locationWarning": "200m from classroom (limit: 100m)"
}
```

## Future Enhancements

Potential improvements for future versions:

- [ ] Map visualization of student locations (anonymized)
- [ ] Geofence history tracking (student movement patterns)
- [ ] Multiple geofence zones (different classrooms)
- [ ] Time-based geofence rules (stricter at start, relaxed later)
- [ ] Wi-Fi SSID validation as secondary check
- [ ] Export location data for audit reports
