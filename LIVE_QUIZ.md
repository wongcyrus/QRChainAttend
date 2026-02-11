# Live Quiz - AI-Powered Attention Tracking

Interactive quiz system using AI to analyze lecture slides and quiz students in real-time.

---

## Quick Start (Teachers)

### 5-Minute Setup

1. **Open Session Dashboard** → Look for "Live Quiz" panel
2. **Capture Slide** → Click "📸 Capture Slide" or upload image
3. **Generate Questions** → AI creates 3 questions automatically
4. **Send to Student** → Set time limit, AI selects student fairly
5. **View Result** → See answer, AI evaluation, and engagement metrics

---

## Overview

Teachers can share their screen or upload slides during a session. AI analyzes the content and generates relevant questions. Students are randomly (but fairly) selected to answer within a time limit, helping track engagement and attention.

---

## Features

### For Teachers
- 📸 Capture or upload lecture slides
- 🤖 AI analyzes content and generates questions
- 👥 Fair student selection algorithm
- ⏱️ Configurable time limits (15s-90s)
- 📊 Real-time engagement tracking
- 💯 AI-powered answer evaluation

### For Students
- 🔔 Real-time question notifications
- 🖼️ Slide context shown with question
- ⏰ Countdown timer
- ✅ Immediate feedback
- 📈 Personal engagement score

---

## How It Works

### Teacher Flow

1. **Start Session** - Open session dashboard
2. **Capture Slide** - Upload image or capture screen
3. **AI Analysis** - AI analyzes slide (2-3 seconds)
4. **Generate Questions** - AI creates 3-5 question options
5. **Select Question** - Pick a question or edit it
6. **Set Parameters** - Time limit, difficulty, question type
7. **Send to Student** - AI selects student fairly
8. **Monitor Response** - See countdown and student answer
9. **Review Answer** - AI evaluates answer quality
10. **Track Metrics** - View engagement scores

### Student Flow

1. **In Session** - Viewing session dashboard
2. **Receive Question** - Pop-up notification
3. **Read Question** - See slide context
4. **Answer** - Type answer or select option
5. **Submit** - Before timer expires
6. **See Result** - Immediate feedback with score
7. **View Stats** - Personal engagement score

---

## Fair Selection Algorithm

**How AI Selects Students**:
- ✅ Prioritizes students who haven't been asked recently
- ✅ Balances question count across all students
- ✅ Gives more chances to students with low engagement
- ✅ Never picks the same student twice in a row

**Example**:
```
Session with 30 students, 10 questions:
- Each student gets ~0-1 questions
- Students who answered incorrectly get more chances
- Students who haven't been asked get priority
```

---

## Engagement Scoring

**Score Calculation** (0-100):
- **Accuracy**: 50% weight (correct answers)
- **Speed**: 30% weight (response time)
- **Participation**: 20% weight (questions answered)

**Score Ranges**:
- 80-100: Highly engaged
- 60-79: Engaged
- 40-59: Moderately engaged
- 0-39: Low engagement

---

## Setup (Azure OpenAI Required)

### Prerequisites

1. Azure OpenAI Service
2. Azure Blob Storage (already configured)
3. Azure SignalR Service (already configured)
4. Azure Table Storage (already configured)

### Azure OpenAI Configuration

**Required Models**:
1. **GPT-4o** - Question generation and answer evaluation
2. **GPT-4o Vision** - Slide analysis

**Environment Variables**:
```bash
AZURE_OPENAI_ENDPOINT=https://your-openai.openai.azure.com/
AZURE_OPENAI_KEY=your-api-key
AZURE_OPENAI_DEPLOYMENT=gpt-4o
AZURE_OPENAI_VISION_DEPLOYMENT=gpt-4o-vision
```

### Quick Setup

```bash
# Create Azure OpenAI resource
az cognitiveservices account create \
  --name qr-attendance-openai \
  --resource-group rg-qr-attendance-prod \
  --kind OpenAI \
  --sku S0 \
  --location eastus

# Deploy GPT-4o
az cognitiveservices account deployment create \
  --name qr-attendance-openai \
  --resource-group rg-qr-attendance-prod \
  --deployment-name gpt-4o \
  --model-name gpt-4o \
  --model-version "2024-08-06" \
  --sku-capacity 10

# Deploy GPT-4o Vision
az cognitiveservices account deployment create \
  --name qr-attendance-openai \
  --resource-group rg-qr-attendance-prod \
  --deployment-name gpt-4o-vision \
  --model-name gpt-4o \
  --model-version "2024-08-06" \
  --sku-capacity 10

# Get credentials
az cognitiveservices account show \
  --name qr-attendance-openai \
  --resource-group rg-qr-attendance-prod \
  --query "properties.endpoint" -o tsv

az cognitiveservices account keys list \
  --name qr-attendance-openai \
  --resource-group rg-qr-attendance-prod \
  --query "key1" -o tsv
```

---

## Technical Architecture

### Backend Functions

**New Functions** (4):
1. `analyzeSlide.ts` - Azure OpenAI Vision API integration
2. `generateQuestions.ts` - Question generation logic
3. `sendQuizQuestion.ts` - Distribute question to student
4. `submitQuizAnswer.ts` - Process and evaluate answer

### Database Tables

**QuizQuestions**:
```
PartitionKey: sessionId
RowKey: questionId
Fields: slideImageUrl, slideContent, question, questionType,
        options, correctAnswer, difficulty, timeLimit, createdAt
```

**QuizResponses**:
```
PartitionKey: sessionId
RowKey: responseId
Fields: questionId, studentId, answer, isCorrect, responseTime,
        submittedAt, aiEvaluation, score
```

**QuizMetrics**:
```
PartitionKey: sessionId
RowKey: studentId
Fields: totalQuestions, correctAnswers, averageResponseTime,
        engagementScore, lastAskedAt
```

### Real-time Updates

**SignalR Events**:
- `quizQuestionSent` - Question sent to student
- `quizAnswerReceived` - Answer submitted
- `quizResultAvailable` - Evaluation complete
- `engagementUpdated` - Metrics updated

---

## API Endpoints

### Teacher Endpoints

```bash
# Analyze slide
POST /api/analyzeSlide
Body: { sessionId, imageData }

# Generate questions
POST /api/generateQuestions
Body: { sessionId, slideContent, difficulty }

# Send question to student
POST /api/sendQuizQuestion
Body: { sessionId, questionId, timeLimit }
```

### Student Endpoints

```bash
# Submit answer
POST /api/submitQuizAnswer
Body: { sessionId, questionId, answer }

# Get metrics
GET /api/getQuizMetrics?sessionId={id}&studentId={email}
```

---

## Usage Tips

### Best Practices

**For Teachers**:
- Use clear, readable slides
- Ask 1-2 questions per 10 minutes
- Mix difficulty levels
- Review engagement metrics regularly
- Provide encouragement for all answers

**For Students**:
- Stay attentive during lecture
- Read questions carefully
- Answer within time limit
- Learn from feedback

### Question Types

**Multiple Choice**:
- Best for factual recall
- Quick to answer
- Easy to evaluate

**Short Answer**:
- Tests understanding
- Requires critical thinking
- AI evaluates quality

---

## Troubleshooting

### AI Not Generating Questions

**Check**:
1. Azure OpenAI endpoint configured
2. API key is valid
3. Models deployed (gpt-4o, gpt-4o-vision)
4. Slide image is clear and readable

### Student Not Receiving Question

**Check**:
1. Student is in active session
2. SignalR connection established
3. Student browser tab is active
4. No network issues

### Answer Evaluation Issues

**Check**:
1. GPT-4o deployment is active
2. API quota not exceeded
3. Answer format is correct
4. Network connectivity

---

## Monitoring

### Check Azure OpenAI Usage

```bash
# View deployments
az cognitiveservices account deployment list \
  --name qr-attendance-openai \
  --resource-group rg-qr-attendance-prod

# Check quota
az cognitiveservices account show \
  --name qr-attendance-openai \
  --resource-group rg-qr-attendance-prod \
  --query "properties.quotaLimit"
```

### View Metrics

```bash
# Get quiz metrics for session
curl https://your-function-app.azurewebsites.net/api/getQuizMetrics?sessionId={id}

# View engagement scores
# Check QuizMetrics table in Azure Storage Explorer
```

---

## Cost Estimation

### Azure OpenAI Costs

**Per Question** (approximate):
- Slide analysis (Vision): $0.01
- Question generation: $0.005
- Answer evaluation: $0.005
- **Total**: ~$0.02 per question

**Monthly** (example):
- 10 sessions/week
- 10 questions/session
- 4 weeks/month
- **Total**: ~$8/month

---

## Related Documentation

- **DEPLOYMENT.md** - Deploy live quiz feature
- **DATABASE_TABLES.md** - Database schema
- **AZURE_ENVIRONMENT.md** - Azure resources
- **DEV_TOOLS.md** - Development commands

---

## Quick Reference

```bash
# Test slide analysis
curl -X POST https://your-app.azurewebsites.net/api/analyzeSlide \
  -H "Content-Type: application/json" \
  -d '{"sessionId":"test","imageData":"base64..."}'

# Test question generation
curl -X POST https://your-app.azurewebsites.net/api/generateQuestions \
  -H "Content-Type: application/json" \
  -d '{"sessionId":"test","slideContent":"..."}'

# View metrics
curl https://your-app.azurewebsites.net/api/getQuizMetrics?sessionId=test
```

---

**Ready to engage your students!** 🚀
