# SessionCreationForm Component

## Overview

The `SessionCreationForm` component provides a comprehensive form for teachers to create new attendance sessions. It handles all required and optional session parameters, validates inputs, calls the session creation API, and displays the generated Session QR code for students to scan.

## Requirements

- **2.1**: Session creation requires classId, startAt, endAt, and lateCutoffMinutes
- **2.2**: New sessions initialize with status "ACTIVE"
- **2.5**: Session creation generates a unique Session_QR code

## Features

### Required Fields
- **Class ID**: Unique identifier for the class (e.g., "CS101-A")
- **Start Time**: When the session begins (datetime-local input)
- **End Time**: When the session ends (datetime-local input)
- **Late Cutoff Minutes**: How many minutes after start time students can arrive before being marked late

### Optional Settings
- **Exit Window**: Duration before session end when exit chains can be started

### Location Constraints (Optional)
- **Geofence**: GPS-based location constraint
  - Latitude and longitude coordinates
  - Radius in meters
  - "Use Current Location" button for convenience
- **Wi-Fi Allowlist**: Comma-separated list of allowed Wi-Fi network SSIDs

## Usage

### Basic Usage

```tsx
import { SessionCreationForm } from './SessionCreationForm';

function TeacherDashboard() {
  return (
    <div>
      <h1>Create New Session</h1>
      <SessionCreationForm />
    </div>
  );
}
```

### With Callback

```tsx
import { SessionCreationForm } from './SessionCreationForm';
import { useRouter } from 'next/router';

function CreateSessionPage() {
  const router = useRouter();
  
  const handleSessionCreated = (sessionId: string) => {
    console.log('Session created:', sessionId);
    // Navigate to session dashboard
    router.push(`/sessions/${sessionId}/dashboard`);
  };
  
  return (
    <SessionCreationForm onSessionCreated={handleSessionCreated} />
  );
}
```

## Props

```typescript
interface SessionCreationFormProps {
  onSessionCreated?: (sessionId: string) => void;
}
```

- **onSessionCreated** (optional): Callback function called when a session is successfully created, receives the new session ID

## API Integration

The component calls `POST /api/sessions` with the following request structure:

```typescript
interface CreateSessionRequest {
  classId: string;
  startAt: string;  // ISO 8601 format
  endAt: string;    // ISO 8601 format
  lateCutoffMinutes: number;
  exitWindowMinutes?: number;
  constraints?: {
    geofence?: {
      latitude: number;
      longitude: number;
      radiusMeters: number;
    };
    wifiAllowlist?: string[];
  };
}
```

Expected response:

```typescript
interface CreateSessionResponse {
  sessionId: string;
  sessionQR: string;  // Base64 encoded QR data
}
```

## Validation

The form performs client-side validation before submission:

1. **Required Fields**: All required fields must be filled
2. **Time Validation**: End time must be after start time
3. **Numeric Validation**: Late cutoff minutes must be non-negative
4. **Geofence Validation**: Radius must be positive when geofence is enabled
5. **Wi-Fi Validation**: At least one SSID required when Wi-Fi allowlist is enabled

## States

### Form State
- Initial state shows the form with all fields
- Loading state disables all inputs and shows "Creating Session..." on submit button
- Error state displays error message above the form

### Success State
After successful creation, the component displays:
- Success message with session ID
- QR code for students to scan (using QRDisplay component)
- "Create Another Session" button to reset the form

## Error Handling

The component handles various error scenarios:

1. **Validation Errors**: Displayed immediately when form is submitted
2. **API Errors**: Extracted from response and displayed to user
3. **Network Errors**: Generic error message displayed

Error messages are displayed in an alert role div for accessibility.

## Accessibility

- All form fields have proper labels with `htmlFor` attributes
- Required fields are marked with asterisks
- Error messages use `role="alert"` for screen readers
- Form can be submitted with Enter key
- All interactive elements are keyboard accessible

## Geolocation

The component uses the browser's Geolocation API to help teachers set geofence coordinates:

```typescript
navigator.geolocation.getCurrentPosition(
  (position) => {
    // Set latitude and longitude from position
  },
  (error) => {
    // Display error message
  }
);
```

Users must grant location permission for this feature to work.

## Styling

The component uses semantic class names for styling:

- `.session-creation-form`: Main form container
- `.form-section`: Groups related fields
- `.form-field`: Individual field container
- `.nested-field`: Fields shown conditionally
- `.error-message`: Error alert display
- `.session-creation-success`: Success state container
- `.session-qr-display`: QR code display area

## Testing

Comprehensive tests cover:

- Form rendering with all fields
- Validation for all required and optional fields
- Successful session creation with various configurations
- Error handling for API failures
- Callback invocation
- Form reset functionality

Run tests with:

```bash
npm test SessionCreationForm.test.tsx
```

## Dependencies

- React
- QRDisplay component (for displaying the Session QR code)
- Browser Geolocation API (optional, for geofence feature)

## Example Scenarios

### Scenario 1: Basic Session
Teacher creates a simple session with only required fields:
- Class ID: "CS101-A"
- Start: 2024-01-15 10:00
- End: 2024-01-15 11:30
- Late Cutoff: 15 minutes

### Scenario 2: Session with Geofence
Teacher creates a session with location constraint:
- Basic fields as above
- Geofence enabled
- Latitude: 22.3193, Longitude: 114.1694
- Radius: 100 meters

### Scenario 3: Session with Wi-Fi Constraint
Teacher creates a session requiring specific Wi-Fi:
- Basic fields as above
- Wi-Fi allowlist: "ClassroomWiFi, SchoolNet"

### Scenario 4: Full Configuration
Teacher creates a session with all options:
- All required fields
- Exit window: 10 minutes
- Geofence enabled
- Wi-Fi allowlist enabled

## Future Enhancements

Potential improvements:
1. Save draft sessions to local storage
2. Template system for recurring classes
3. Bulk session creation for multiple class periods
4. Calendar integration for scheduling
5. Preview mode before final creation
6. Copy session settings from previous sessions
