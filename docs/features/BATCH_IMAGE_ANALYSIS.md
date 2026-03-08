# Batch Image Analysis Feature

## Overview

This feature allows organizers to analyze captured attendee images with custom prompts. The analysis is performed on-demand using Azure AI Agent Service and results are provided as downloadable CSV reports without storing them in the database.

## User Flow

1. Organizer navigates to Capture History section
2. For any capture with uploaded images, an "Analyze" button appears
3. Clicking "Analyze" opens a modal with:
   - Prompt input field
   - Example prompts for quick selection
   - Image count display
4. Organizer enters a custom prompt (e.g., "Are students wearing masks?")
5. System processes images in batches of 10 using Azure AI Agent
6. Results are displayed in a table showing:
   - Attendee ID
   - Analysis result for each image
7. Organizer can download results as CSV file

## Recent Fixes (March 7, 2026)

### Fixed Image Retrieval
- **Issue**: `listCaptureUploads` was querying with wrong partition key (sessionId instead of captureRequestId)
- **Fix**: Updated query to use captureRequestId as partition key
- **Impact**: Images can now be retrieved correctly for analysis

### Fixed SAS URL Generation
- **Issue**: `generateReadSasUrl` was receiving blob name instead of full blob URL
- **Fix**: Changed to pass `upload.blobUrl` instead of `upload.blobName`
- **Impact**: SAS URLs now generate correctly for image access

### Fixed CORS Configuration
- **Issue**: Students couldn't upload images due to CORS restrictions
- **Fix**: Updated storage.bicep to include Azure Static Web Apps pattern in CORS
- **Impact**: Image uploads now work from Static Web App

## Technical Implementation

### Backend Components

#### 1. API Endpoint: `analyzeCaptureImages.ts`
- **Route**: `POST /api/sessions/{sessionId}/capture/{captureRequestId}/analyze`
- **Authentication**: Organizer role required
- **Request Body**: `{ prompt: string }`
- **Response**: Analysis results with student IDs and analysis text

**Key Features**:
- Validates teacher authentication and session ownership
- Retrieves all uploaded images for the capture request
- Generates SAS URLs for image access
- Processes images in batches of 10 (Azure AI vision model limit)
- Returns results without storing in database

#### 2. Storage Helper: `captureStorage.ts`
- Added `listCaptureUploads()` function to retrieve all uploads for a capture request
- Queries CaptureUploads table by sessionId and captureRequestId

#### 3. Agent Service: `agentService.ts`
- Updated `runSingleVisionInteraction()` to support:
  - `userPrompt` parameter (renamed from `userMessage`)
  - `maxTokens` and `timeoutMs` configuration
  - Batch image analysis with vision capabilities

### Frontend Components

#### 1. Modal Component: `BatchImageAnalysisModal.tsx`
- Displays prompt input with example suggestions
- Shows analysis progress
- Displays results in a table
- Provides CSV download functionality

**CSV Format**:
```csv
Attendee ID,Analysis,Timestamp
student1@example.com,"Yes, wearing mask",2024-03-07 10:30:00
student2@example.com,"No mask visible",2024-03-07 10:30:05
```

#### 2. Updated Component: `CaptureHistory.tsx`
- Added "Analyze" button for captures with uploaded images
- Integrated BatchImageAnalysisModal
- Button appears next to status badge for each capture

## Environment Variables

Add to backend `.env`:

```bash
# Image Analysis Agent (optional - uses default if not set)
AZURE_AI_ANALYSIS_AGENT_NAME=image-analysis-agent
AZURE_AI_ANALYSIS_AGENT_VERSION=1
```

If not set, defaults to existing agent configuration.

## Agent Configuration

The system uses the Azure AI Foundry Agent Service with vision capabilities. You can either:

1. **Use existing position estimation agent** (default)
   - No additional configuration needed
   - Uses `AZURE_AI_POSITION_AGENT_NAME` and `AZURE_AI_POSITION_AGENT_VERSION`

2. **Create dedicated analysis agent** (recommended for production)
   - Create a new agent in Azure AI Foundry with vision capabilities
   - Set `AZURE_AI_ANALYSIS_AGENT_NAME` and `AZURE_AI_ANALYSIS_AGENT_VERSION`
   - Configure agent with instructions for general image analysis

## Batch Processing

- **Batch Size**: 10 images per request (Azure AI vision model limit)
- **Processing**: Sequential batches to avoid rate limits
- **Error Handling**: Individual batch failures don't stop entire analysis
- **Timeout**: 60 seconds per batch

## Security Considerations

1. **Authentication**: Organizer role required
2. **Session Ownership**: Validates teacher owns the session (TODO: implement)
3. **SAS URLs**: Read-only, time-limited (5 minutes)
4. **No Storage**: Results not persisted in database
5. **Prompt Validation**: Ensures prompt is not empty

## Usage Examples

### Example Prompts

1. "Are students wearing masks?"
2. "Is the projector screen visible in the image?"
3. "What objects are on the attendee's desk?"
4. "Is the attendee looking at the camera?"
5. "Describe the classroom environment visible in the image"

### API Request Example

```bash
curl -X POST \
  https://your-api.azurewebsites.net/api/sessions/{sessionId}/capture/{captureRequestId}/analyze \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer {token}" \
  -d '{"prompt": "Are students wearing masks?"}'
```

### API Response Example

```json
{
  "captureRequestId": "abc-123",
  "sessionId": "session-456",
  "prompt": "Are students wearing masks?",
  "results": [
    {
      "attendeeId": "student1@example.com",
      "imageUrl": "https://...",
      "analysis": "Yes, the attendee is wearing a blue surgical mask",
      "timestamp": "2024-03-07T10:30:00Z"
    },
    {
      "attendeeId": "student2@example.com",
      "imageUrl": "https://...",
      "analysis": "No mask is visible in the image",
      "timestamp": "2024-03-07T10:30:05Z"
    }
  ],
  "analyzedAt": "2024-03-07T10:35:00Z",
  "totalImages": 2
}
```

## Future Enhancements

1. **Parallel Batch Processing**: Process multiple batches concurrently
2. **Progress Updates**: Real-time progress via SignalR
3. **Custom Agent Selection**: Allow organizers to choose different analysis agents
4. **Result Caching**: Optional caching of analysis results
5. **Bulk Export**: Export multiple capture analyses at once
6. **Advanced Filtering**: Filter results by analysis content
7. **Visualization**: Charts and graphs for aggregate analysis

## Testing

### Manual Testing Steps

1. Create a session with students
2. Initiate image capture
3. Have students upload images
4. Navigate to Capture History
5. Click "Analyze" button on a completed capture
6. Enter a test prompt
7. Verify results display correctly
8. Download CSV and verify format

### Test Prompts

- Simple: "Is there a person in the image?"
- Complex: "Describe the lighting conditions and visible objects"
- Boolean: "Is the attendee wearing glasses?"
- Counting: "How many books are visible on the desk?"

## Troubleshooting

### Common Issues

1. **"No images available for analysis"**
   - Ensure capture has uploaded images
   - Check CaptureUploads table

2. **"Analysis failed"**
   - Verify agent configuration
   - Check Azure AI Foundry agent status
   - Review agent logs in Application Insights

3. **"Timeout"**
   - Large batches may take longer
   - Check network connectivity
   - Verify agent response time

4. **CSV Download Issues**
   - Check browser download settings
   - Verify CSV content encoding
   - Test with different browsers

## Files Modified/Created

### Backend
- ✅ `backend/src/functions/analyzeCaptureImages.ts` (new)
- ✅ `backend/src/utils/captureStorage.ts` (modified - added listCaptureUploads)
- ✅ `backend/src/utils/agentService.ts` (modified - updated runSingleVisionInteraction)

### Frontend
- ✅ `frontend/src/components/BatchImageAnalysisModal.tsx` (new)
- ✅ `frontend/src/components/CaptureHistory.tsx` (modified - added Analyze button)

### Documentation
- ✅ `docs/features/BATCH_IMAGE_ANALYSIS.md` (this file)
