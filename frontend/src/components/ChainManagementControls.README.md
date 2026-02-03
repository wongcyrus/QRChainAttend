# ChainManagementControls Component

## Overview

The `ChainManagementControls` component provides teachers with controls to manage entry and exit chains during a session. It allows seeding initial chains, starting exit chains, and reseeding stalled chains.

## Requirements

- **3.1**: Seed entry chains with count input
- **6.1**: Start exit chains with count input
- **11.3**: Reseed stalled chains

## Features

### Entry Chain Management
- **Seed Entry Chains**: Create initial entry chains by randomly selecting joined students
- **Count Input**: Specify the number of chains to create (1-50)
- **Chain Display**: View active entry chains with holder information and sequence numbers
- **Stall Detection**: Automatically detect and highlight stalled entry chains
- **Reseed**: Create new entry chains when existing ones become stalled

### Exit Chain Management
- **Start Exit Chains**: Create exit chains by randomly selecting eligible students
- **Count Input**: Specify the number of exit chains to start (1-50)
- **Chain Display**: View active exit chains with holder information and sequence numbers
- **Stall Detection**: Automatically detect and highlight stalled exit chains
- **Reseed**: Create new exit chains when existing ones become stalled

### Chain Display
- **Chain ID**: Truncated chain identifier for easy reference
- **Holder**: Current student holding the chain token
- **Sequence Number**: Number of successful scans in the chain
- **Last Activity**: Timestamp of the last chain activity
- **Stall Indicator**: Visual warning when a chain is stalled

## Props

```typescript
interface ChainManagementControlsProps {
  sessionId: string;           // Session identifier
  chains: Chain[];             // Array of active chains
  stalledChains: string[];     // Array of stalled chain IDs
  onChainsUpdated?: () => void; // Callback when chains are updated
  onError?: (error: string) => void; // Error callback
}
```

## Usage

```tsx
import { ChainManagementControls } from './ChainManagementControls';

function TeacherDashboard() {
  const [chains, setChains] = useState<Chain[]>([]);
  const [stalledChains, setStalledChains] = useState<string[]>([]);

  const handleChainsUpdated = () => {
    // Refresh session data
    fetchSessionData();
  };

  const handleError = (error: string) => {
    console.error('Chain management error:', error);
    // Display error to user
  };

  return (
    <ChainManagementControls
      sessionId="session-123"
      chains={chains}
      stalledChains={stalledChains}
      onChainsUpdated={handleChainsUpdated}
      onError={handleError}
    />
  );
}
```

## API Endpoints

### Seed Entry Chains
- **Endpoint**: `POST /api/sessions/{sessionId}/seed-entry?count=K`
- **Authorization**: Teacher role required
- **Response**: `{ chainsCreated: number, initialHolders: string[] }`

### Start Exit Chains
- **Endpoint**: `POST /api/sessions/{sessionId}/start-exit-chain?count=K`
- **Authorization**: Teacher role required
- **Response**: `{ chainsCreated: number, initialHolders: string[] }`

### Reseed Entry Chains
- **Endpoint**: `POST /api/sessions/{sessionId}/reseed-entry?count=N`
- **Authorization**: Teacher role required
- **Response**: `{ chainsCreated: number, initialHolders: string[] }`

### Reseed Exit Chains
- **Endpoint**: `POST /api/sessions/{sessionId}/reseed-exit?count=N`
- **Authorization**: Teacher role required
- **Response**: `{ chainsCreated: number, initialHolders: string[] }`

## Chain States

- **ACTIVE**: Chain is currently active and accepting scans
- **STALLED**: Chain has been idle for more than 90 seconds
- **COMPLETED**: Chain has finished its lifecycle

## Validation

- Chain count must be between 1 and 50
- Only teachers who own the session can manage chains
- Sufficient eligible students must be available for seeding

## Error Handling

The component handles the following error scenarios:

1. **Insufficient Students**: Not enough eligible students to create requested chains
2. **Network Errors**: Failed API requests
3. **Authorization Errors**: User lacks required permissions
4. **Validation Errors**: Invalid input values

## Styling

The component uses the following CSS classes:

- `.chain-management-controls`: Main container
- `.chain-control-section`: Section for entry or exit chains
- `.chain-control-row`: Row containing input and button
- `.control-group`: Input label and field group
- `.chain-count-input`: Number input for chain count
- `.chains-display`: Container for chain list
- `.chains-list`: List of chain items
- `.chain-item`: Individual chain display
- `.chain-item.stalled`: Stalled chain styling
- `.stall-badge`: Stall indicator badge
- `.reseed-section`: Section for reseed controls
- `.stall-alert`: Alert message for stalled chains
- `.success-message`: Success feedback message

## Accessibility

- All inputs have associated labels
- Buttons show loading state when operations are in progress
- Error messages are announced to screen readers via `role="alert"`
- Success messages use `role="status"` for non-intrusive announcements

## Best Practices

1. **Initial Seeding**: Seed 3-5 entry chains at the start of class
2. **Exit Chains**: Start exit chains 5-10 minutes before class ends
3. **Monitoring**: Watch for stalled chains and reseed promptly
4. **Count Selection**: Choose chain count based on class size (typically 10-20% of students)

## Integration with TeacherDashboard

The component is designed to be integrated into the TeacherDashboard:

```tsx
<TeacherDashboard sessionId={sessionId}>
  {/* Other dashboard components */}
  <ChainManagementControls
    sessionId={sessionId}
    chains={chains}
    stalledChains={stalledChains}
    onChainsUpdated={fetchSessionData}
    onError={handleError}
  />
</TeacherDashboard>
```

## Testing

The component includes comprehensive unit tests covering:

- Rendering and display
- Seed entry chains functionality
- Start exit chains functionality
- Reseed stalled chains functionality
- Chain display and formatting
- Input validation
- Error handling
- API integration

Run tests with:
```bash
npm test -- ChainManagementControls.test.tsx
```
