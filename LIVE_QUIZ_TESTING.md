# Live Quiz Testing Guide

Quick guide to test the Live Quiz feature implementation.

---

## Prerequisites

1. **Local environment running**:
   ```bash
   ./start-local-with-openai.sh
   ```
   This starts:
   - Azurite (local storage)
   - Backend with production OpenAI
   - Frontend on http://localhost:3000

2. **Active session**: Create a session as a teacher

3. **Azure OpenAI configured**: Check `backend/local.settings.json`
   - `AZURE_OPENAI_ENDPOINT`
   - `AZURE_OPENAI_KEY`
   - `AZURE_OPENAI_DEPLOYMENT=gpt-4o`
   - `AZURE_OPENAI_VISION_DEPLOYMENT=gpt-4o-vision`

---

## Test Flow

### 1. Access Teacher Dashboard

1. Login as teacher (email ending with `@vtc.edu.hk`, not `@stu.vtc.edu.hk`)
2. Navigate to `/teacher` page
3. Select an active session
4. Verify "Live Quiz (AI-Powered)" panel is visible

### 2. Start Screen Share

1. Click "🖥️ Start Screen Share" button
2. Browser will prompt for screen selection
3. Choose screen/window to share
4. Verify "● ACTIVE" badge appears
5. Verify stats dashboard shows (Captures: 0, Questions: 0, Sent: 0)

### 3. Configure Capture Frequency

1. Before starting, select capture interval:
   - 15 seconds (fast)
   - 30 seconds (recommended)
   - 60 seconds (moderate)
   - 2 minutes (slow)
   - 5 minutes (very slow)

### 4. Monitor Automated Process

1. Watch "Next Capture" countdown timer
2. When timer reaches 0:
   - Screenshot captured automatically
   - "Captures" count increments
   - AI analyzes slide (2-5 seconds)
   - "Questions" count increments
   - Question sent to student
   - "Sent" count increments
3. Process repeats every N seconds
4. No manual intervention needed

### 5. Stop Screen Share

1. Click "⏹️ Stop Screen Share" button
2. Verify screen sharing stops
3. Stats are preserved
4. Can restart anytime

### 6. Student Receives Question (Future)

Currently implemented on backend, student UI pending:
- Student receives SignalR notification
- Question modal appears with slide context
- Countdown timer shows remaining time
- Student submits answer
- Immediate feedback with score

---

## API Testing

### Test Analyze Slide

```bash
# Create a test base64 image (or use a real one)
BASE64_IMAGE="data:image/jpeg;base64,/9j/4AAQSkZJRg..."

curl -X POST http://localhost:7071/api/sessions/test-session/quiz/analyze-slide \
  -H "Content-Type: application/json" \
  -H "x-ms-client-principal: $(echo '{"userDetails":"teacher@vtc.edu.hk","userRoles":["Teacher"]}' | base64)" \
  -d "{\"image\":\"$BASE64_IMAGE\"}"
```

Expected response:
```json
{
  "slideId": "uuid",
  "imageUrl": "http://127.0.0.1:10000/...",
  "analysis": {
    "topic": "Database Normalization",
    "title": "3NF Example",
    "keyPoints": ["...", "..."],
    "difficulty": "INTERMEDIATE",
    "subject": "Database"
  }
}
```

### Test Generate Questions

```bash
curl -X POST http://localhost:7071/api/sessions/test-session/quiz/generate-questions \
  -H "Content-Type: application/json" \
  -H "x-ms-client-principal: $(echo '{"userDetails":"teacher@vtc.edu.hk","userRoles":["Teacher"]}' | base64)" \
  -d '{
    "slideId": "slide-123",
    "analysis": {
      "topic": "Database Normalization",
      "keyPoints": ["1NF", "2NF", "3NF"],
      "difficulty": "MEDIUM"
    },
    "difficulty": "MEDIUM",
    "count": 3
  }'
```

Expected response:
```json
{
  "questions": [
    {
      "questionId": "uuid",
      "text": "What is the main goal of 3NF?",
      "type": "MULTIPLE_CHOICE",
      "difficulty": "MEDIUM",
      "options": ["A", "B", "C", "D"],
      "correctAnswer": "A",
      "explanation": "..."
    }
  ]
}
```

### Test Send Question

```bash
curl -X POST http://localhost:7071/api/sessions/test-session/quiz/send-question \
  -H "Content-Type: application/json" \
  -H "x-ms-client-principal: $(echo '{"userDetails":"teacher@vtc.edu.hk","userRoles":["Teacher"]}' | base64)" \
  -d '{
    "questionId": "question-uuid",
    "timeLimit": 60
  }'
```

Expected response:
```json
{
  "responseId": "uuid",
  "studentId": "student1@stu.vtc.edu.hk",
  "sentAt": 1707654321,
  "expiresAt": 1707654381
}
```

---

## Troubleshooting

### Issue: "Failed to analyze slide"

**Check**:
1. Azure OpenAI endpoint is correct
2. API key is valid
3. Vision deployment exists: `gpt-4o-vision`
4. Image is valid base64 format

**Debug**:
```bash
# Check backend logs
# Look for "OpenAI API error" messages
```

### Issue: "Failed to generate questions"

**Check**:
1. GPT-4o deployment exists
2. API quota not exceeded
3. Analysis object is valid

**Debug**:
```bash
# Check backend logs
# Look for "Failed to parse AI response"
```

### Issue: "No students present in session"

**Check**:
1. At least one student has joined the session
2. Student has `entryStatus` set (PRESENT_ENTRY or LATE_ENTRY)
3. Check Attendance table in Azurite

**Debug**:
```bash
# Use Azure Storage Explorer to check Attendance table
# PartitionKey = sessionId
# Look for records with entryStatus field
```

### Issue: Live Quiz button not visible

**Check**:
1. Session status is ACTIVE (not ENDED)
2. User has Teacher role
3. Frontend compiled without errors

---

## Database Verification

### Check QuizQuestions Table

```bash
# Use Azure Storage Explorer
# Table: QuizQuestions
# PartitionKey: sessionId
# RowKey: questionId
```

Expected fields:
- slideId
- slideContent (JSON)
- question
- questionType
- options (JSON for multiple choice)
- correctAnswer
- difficulty
- timeLimit
- createdAt

### Check QuizResponses Table

```bash
# Table: QuizResponses
# PartitionKey: sessionId
# RowKey: responseId
```

Expected fields:
- questionId
- studentId
- answer
- isCorrect
- responseTime
- submittedAt
- sentAt
- expiresAt
- status (PENDING/ANSWERED/EXPIRED)

### Check QuizMetrics Table

```bash
# Table: QuizMetrics
# PartitionKey: sessionId
# RowKey: studentId
```

Expected fields:
- totalQuestions
- correctAnswers
- questionCount
- averageResponseTime
- engagementScore
- lastQuestionAt

---

## Next Steps

### Student UI Implementation

1. Create `QuizModal.tsx` component
2. Listen for `quizQuestion` SignalR event
3. Display question with countdown timer
4. Submit answer via `/api/sessions/{sessionId}/quiz/submit-answer`
5. Show result with feedback

### Teacher Metrics Dashboard

1. Add "Quiz Metrics" tab to TeacherDashboard
2. Show engagement scores per student
3. Display question history
4. Show answer statistics

### Advanced Features

1. Screen capture instead of file upload
2. Question editing before sending
3. Multiple students per question
4. Question bank/history
5. Export quiz results to CSV

---

## Success Criteria

✅ Teacher can upload slide image
✅ AI analyzes slide content
✅ AI generates 3 relevant questions
✅ Teacher can select and send question
✅ Question stored in database
✅ Student selected fairly
✅ SignalR broadcasts question (backend)
⏳ Student receives and answers (UI pending)
⏳ AI evaluates answer (backend ready)
⏳ Metrics updated (backend ready)

---

**Current Status**: Teacher UI complete, backend complete, student UI pending.
