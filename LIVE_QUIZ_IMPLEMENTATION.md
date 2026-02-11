# Live Quiz Implementation Summary

Complete implementation of automated screen capture and AI-powered quiz system.

---

## Implementation Overview

The Live Quiz feature now works with **continuous screen capture** instead of manual slide upload:

1. Teacher clicks "Start Screen Share"
2. Browser captures screen at configurable intervals (15s - 5min)
3. AI automatically analyzes each capture
4. AI generates and sends questions to students
5. No manual intervention needed

---

## Key Changes

### Frontend (TeacherDashboard.tsx)

**New State Variables**:
```typescript
const [quizActive, setQuizActive] = useState(false);
const [screenStream, setScreenStream] = useState<MediaStream | null>(null);
const [captureInterval, setCaptureInterval] = useState(30); // seconds
const [lastCaptureTime, setLastCaptureTime] = useState<number>(0);
const [quizStats, setQuizStats] = useState({
  capturesCount: 0,
  questionsGenerated: 0,
  questionsSent: 0
});
```

**New Functions**:
1. `startScreenShare()` - Request screen sharing permission
2. `stopScreenShare()` - Stop screen sharing
3. `captureAndAnalyze()` - Capture screenshot and send to AI
4. `generateAndSendQuestion()` - Generate and send question automatically

**Continuous Capture Loop**:
```typescript
useEffect(() => {
  if (!quizActive || !screenStream) return;
  
  const interval = setInterval(() => {
    const now = Date.now();
    const elapsed = (now - lastCaptureTime) / 1000;
    
    if (elapsed >= captureInterval) {
      setLastCaptureTime(now);
      captureAndAnalyze(screenStream);
    }
  }, 1000);
  
  return () => clearInterval(interval);
}, [quizActive, screenStream, lastCaptureTime, captureInterval]);
```

### UI Components

**Before Starting**:
- Capture frequency selector (15s, 30s, 60s, 2min, 5min)
- "Start Screen Share" button

**While Active**:
- Real-time stats dashboard:
  - Captures count
  - Questions generated
  - Questions sent
  - Next capture countdown
- "Stop Screen Share" button
- Active indicator badge

---

## Technical Flow

### 1. Screen Capture

```javascript
// Request permission
const stream = await navigator.mediaDevices.getDisplayMedia({
  video: true
});

// Create video element
const video = document.createElement('video');
video.srcObject = stream;
video.play();

// Capture frame to canvas
const canvas = document.createElement('canvas');
canvas.width = video.videoWidth;
canvas.height = video.videoHeight;
const ctx = canvas.getContext('2d');
ctx.drawImage(video, 0, 0);

// Convert to base64
const base64Image = canvas.toDataURL('image/jpeg', 0.8);
```

### 2. AI Analysis

```javascript
POST /api/sessions/{sessionId}/quiz/analyze-slide
Body: { image: "data:image/jpeg;base64,..." }

Response: {
  slideId: "uuid",
  imageUrl: "blob-url",
  analysis: {
    topic: "Database Normalization",
    title: "3NF Example",
    keyPoints: ["1NF", "2NF", "3NF"],
    difficulty: "MEDIUM",
    subject: "Database"
  }
}
```

### 3. Question Generation

```javascript
POST /api/sessions/{sessionId}/quiz/generate-questions
Body: {
  slideId: "uuid",
  analysis: { ... },
  difficulty: "MEDIUM",
  count: 1
}

Response: {
  questions: [{
    questionId: "uuid",
    text: "What is 3NF?",
    type: "MULTIPLE_CHOICE",
    difficulty: "MEDIUM",
    options: ["A", "B", "C", "D"],
    correctAnswer: "A"
  }]
}
```

### 4. Send to Student

```javascript
POST /api/sessions/{sessionId}/quiz/send-question
Body: {
  questionId: "uuid",
  timeLimit: 60
}

Response: {
  responseId: "uuid",
  studentId: "student@stu.vtc.edu.hk",
  sentAt: 1707654321,
  expiresAt: 1707654381
}
```

---

## Backend Functions (Already Implemented)

All backend functions are complete and working:

1. **analyzeSlide.ts** - Azure OpenAI Vision integration
2. **generateQuestions.ts** - GPT-4o question generation
3. **sendQuizQuestion.ts** - Fair student selection + SignalR broadcast
4. **submitQuizAnswer.ts** - Answer evaluation (student UI pending)

---

## Configuration

### Capture Intervals

| Interval | Questions/Min | Use Case |
|----------|--------------|----------|
| 15s | 4 | Fast-paced lecture |
| 30s | 2 | Balanced (recommended) |
| 60s | 1 | Moderate pace |
| 2min | 0.5 | Detailed explanations |
| 5min | 0.2 | Slow, theory-heavy |

### Azure OpenAI Settings

Required in `backend/local.settings.json`:
```json
{
  "AZURE_OPENAI_ENDPOINT": "https://openai-qrattendance-prod.openai.azure.com/",
  "AZURE_OPENAI_KEY": "your-key",
  "AZURE_OPENAI_DEPLOYMENT": "gpt-4o",
  "AZURE_OPENAI_VISION_DEPLOYMENT": "gpt-4o-vision"
}
```

---

## Testing

### Local Testing

1. Start local environment:
   ```bash
   ./start-local-with-openai.sh
   ```

2. Login as teacher

3. Create active session

4. Click "Start Screen Share"

5. Select screen to share

6. Watch automated process:
   - Countdown timer
   - Stats incrementing
   - Console logs showing captures

### Expected Behavior

**Every N seconds**:
1. Screenshot captured
2. Sent to Azure OpenAI Vision
3. Analysis returned (2-3s)
4. Question generated
5. Student selected fairly
6. Question sent via SignalR
7. Stats updated

**Console Output**:
```
Capture 1: Analyzing...
Analysis: Database Normalization
Generating question...
Question sent to student1@stu.vtc.edu.hk
```

---

## Browser Compatibility

### Screen Capture API Support

✅ Chrome 72+
✅ Edge 79+
✅ Firefox 66+
✅ Safari 13+
✅ Opera 60+

### Required Permissions

- Screen sharing permission (browser prompt)
- HTTPS required (or localhost for dev)

---

## Performance Considerations

### Image Size

- Canvas captures at screen resolution
- JPEG compression at 0.8 quality
- Typical size: 100-500KB per capture

### API Costs

**Per Capture**:
- Vision API: ~$0.01
- GPT-4o: ~$0.005
- Total: ~$0.015 per capture

**Example Session** (1 hour, 30s interval):
- Captures: 120
- Cost: ~$1.80

### Network Usage

**Per Capture**:
- Upload: 100-500KB (image)
- Download: 1-5KB (response)
- Total: ~101-505KB per capture

**Example Session** (1 hour, 30s interval):
- Total: ~12-60MB

---

## Error Handling

### Screen Share Denied

```javascript
try {
  const stream = await navigator.mediaDevices.getDisplayMedia({
    video: true
  });
} catch (error) {
  setError('Failed to start screen sharing: ' + error.message);
}
```

### Capture Failed

```javascript
try {
  await captureAndAnalyze(stream);
} catch (error) {
  console.error('Capture error:', error);
  // Continue with next capture
}
```

### AI Analysis Failed

```javascript
if (!response.ok) {
  throw new Error('Failed to analyze slide');
}
// Skip this capture, continue with next
```

---

## Next Steps

### Student UI (Pending)

1. Create `QuizModal.tsx` component
2. Listen for `quizQuestion` SignalR event
3. Display question with countdown
4. Submit answer
5. Show result

### Enhancements

1. **Manual capture button** - Capture on-demand
2. **Question preview** - Show generated questions before sending
3. **Batch questions** - Generate multiple, send one at a time
4. **Question history** - View all questions sent
5. **Student metrics** - Detailed engagement dashboard

---

## Files Modified

1. `frontend/src/components/TeacherDashboard.tsx` - Complete rewrite of Live Quiz UI
2. `LIVE_QUIZ.md` - Updated documentation
3. `LIVE_QUIZ_TESTING.md` - Updated testing guide
4. `PROJECT_STATUS.md` - Updated status

---

## Success Criteria

✅ Teacher can start screen sharing
✅ System captures screen at intervals
✅ AI analyzes each capture
✅ AI generates questions
✅ Questions sent to students automatically
✅ Stats displayed in real-time
✅ Teacher can stop anytime
⏳ Student receives questions (UI pending)
⏳ Student submits answers (UI pending)
⏳ Metrics tracked (backend ready)

---

**Status**: Teacher-side implementation complete. Student-side UI pending.
