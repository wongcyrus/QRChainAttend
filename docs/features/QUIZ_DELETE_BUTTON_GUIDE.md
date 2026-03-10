# Quiz Question Delete Button - Location Guide

## ✅ Delete Button Already Implemented

The delete button for quiz questions was added in the previous update and is fully functional.

## Where to Find It

### Navigation Path:
1. Login as **Organizer**
2. Go to **Organizer Dashboard**
3. Select a **Session** with quiz questions
4. Click on **Quiz** tab
5. Scroll down to **"📝 Quiz Questions & Responses"** section

### Visual Location:
```
┌─────────────────────────────────────────────────────────────┐
│ 📝 Quiz Questions & Responses          [📥 Download Report] │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│ ┌───────────────────────────────────────────────────────┐   │
│ │ Q1: What is the capital of France?                    │   │
│ │ 2026-03-09 10:30:00                                   │   │
│ │                                                        │   │
│ │              [🗑️ Delete] [Easy] [5 responses] [80%]  │◄── HERE
│ └───────────────────────────────────────────────────────┘   │
│                                                               │
│ ┌───────────────────────────────────────────────────────┐   │
│ │ Q2: What is 2+2?                                      │   │
│ │ 2026-03-09 10:32:00                                   │   │
│ │                                                        │   │
│ │              [🗑️ Delete] [Easy] [3 responses] [100%] │◄── HERE
│ └───────────────────────────────────────────────────────┘   │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

## Button Appearance

- **Color**: Light red background (#fed7d7)
- **Text**: "🗑️ Delete" in dark red
- **Position**: Top right of each question card, before difficulty badge
- **Hover**: Turns darker red (#fc8181)

## Functionality

1. **Click** the 🗑️ Delete button on any question
2. **Confirmation dialog** appears: "Delete this quiz question and all responses? This action cannot be undone."
3. **Confirm** → Question and all associated responses are deleted
4. **View refreshes** automatically to show updated list

## Implementation Details

**File**: `frontend/src/components/QuizManagement.tsx`

**Handler Function** (lines 78-96):
```typescript
const handleDeleteQuestion = async (questionId: string) => {
  if (!confirm('Delete this quiz question and all responses?\n\nThis action cannot be undone.')) {
    return;
  }

  try {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || '/api';
    const headers = await getAuthHeaders();
    const response = await fetch(`${apiUrl}/sessions/${sessionId}/quiz/questions/${questionId}`, {
      method: 'DELETE',
      credentials: 'include',
      headers
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData?.error?.message || 'Failed to delete question');
    }

    await loadQuizData();
  } catch (error: any) {
    onError?.('Error: ' + error.message);
  }
};
```

**Button Rendering** (lines 262-282):
```typescript
<button
  onClick={(e) => {
    e.stopPropagation();
    handleDeleteQuestion(question.questionId);
  }}
  style={{
    padding: '0.375rem 0.75rem',
    backgroundColor: '#fed7d7',
    color: '#742a2a',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '0.75rem',
    fontWeight: '600'
  }}
  onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#fc8181'}
  onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#fed7d7'}
>
  🗑️ Delete
</button>
```

## Backend API

**Endpoint**: `DELETE /api/sessions/{sessionId}/quiz/questions/{questionId}`

**File**: `backend/src/functions/deleteQuizQuestion.ts`

**What it deletes**:
- The quiz question record
- All attendee responses to that question
- Related metrics

## Testing

1. Create a quiz question using the Live Quiz feature
2. Navigate to Quiz tab
3. Verify delete button appears on each question
4. Click delete and confirm
5. Question should be removed from the list

## Notes

- Only **Organizers** can delete questions
- Deletion is **permanent** and cannot be undone
- All attendee responses are also deleted
- The question list refreshes automatically after deletion
