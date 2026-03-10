# Auto-Stop Quiz Capture Implementation

## Problem
Users might forget to stop screen sharing for quiz capture, leading to infinite capturing and wasted resources.

## Solution
Implemented automatic stop mechanism with configurable limits.

---

## Features

### 1. ✅ Auto-Stop Timer
- Automatically stops screen capture after N captures
- Default: 20 captures
- Configurable: 10, 20, 30, 50, or 100 captures

### 2. ✅ Time Estimation
- Shows estimated duration based on capture frequency
- Example: 20 captures × 30 seconds = ~10 minutes
- Updates dynamically when frequency changes

### 3. ✅ Warning System
- Alert when 5 captures remaining
- Final alert when auto-stop triggers
- Clear notification to user

### 4. ✅ Manual Override
- User can still stop manually anytime
- Auto-stop timer cleared on manual stop
- No interference with normal operation

---

## UI Changes

### Configuration Section (Before Start)
```
Capture Frequency: [Dropdown]
Auto-stop after: [Dropdown with time estimate]

ℹ️ Quiz will automatically stop after 20 captures (~10 minutes)
```

### Options Available
**Capture Frequency:**
- Every 15 seconds
- Every 30 seconds (default)
- Every 60 seconds
- Every 2 minutes
- Every 5 minutes

**Auto-stop after:**
- 10 captures (~5-50 min depending on frequency)
- 20 captures (default)
- 30 captures
- 50 captures
- 100 captures

---

## Technical Implementation

### Timer Logic
```typescript
// Start auto-stop timer
const autoStopDuration = maxCaptures * captureInterval * 1000;
autoStopTimerRef.current = setTimeout(() => {
  alert(`Auto-stopped after ${maxCaptures} captures`);
  stopScreenShare();
}, autoStopDuration);
```

### Warning Logic
```typescript
// Warn when 5 captures remaining
if (capturesCount === maxCaptures - 5) {
  alert('⚠️ Warning: Only 5 more captures remaining');
}
```

### Cleanup
```typescript
// Clear timer on manual stop
if (autoStopTimerRef.current) {
  clearTimeout(autoStopTimerRef.current);
}
```

---

## Benefits

1. **Prevents Resource Waste**: No infinite capturing
2. **User-Friendly**: Clear warnings and notifications
3. **Flexible**: Configurable limits for different use cases
4. **Safe**: Doesn't interfere with manual control

---

## Example Scenarios

### Short Lecture (30 min)
- Frequency: 30 seconds
- Auto-stop: 20 captures
- Duration: ~10 minutes of active slides

### Long Lecture (90 min)
- Frequency: 60 seconds
- Auto-stop: 50 captures
- Duration: ~50 minutes of active slides

### Workshop (3 hours)
- Frequency: 120 seconds
- Auto-stop: 100 captures
- Duration: ~200 minutes (3.3 hours)

---

**Status**: ✅ Complete
**Created**: March 9, 2026
