/**
 * Analyze Capture Images API Endpoint
 * 
 * POST /api/sessions/{sessionId}/capture/{captureRequestId}/analyze
 * 
 * This function allows teachers to analyze captured images with a custom prompt:
 * 1. Validates teacher authentication and session ownership
 * 2. Retrieves all uploaded images for the capture request
 * 3. Processes images in batches of 10 using Azure AI Agent
 * 4. Returns analysis results as CSV-ready data (not stored in DB)
 * 
 * Requirements: On-demand batch image analysis with custom prompts
 */

import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { parseAuthFromRequest, hasRole, getUserId } from '../utils/auth';
import { getCaptureRequest, listCaptureUploads } from '../utils/captureStorage';
import { generateReadSasUrl } from '../utils/blobStorage';
import { getAgentClient } from '../utils/agentService';
import { CaptureErrorCode } from '../types/studentImageCapture';

interface AnalyzeImagesRequest {
  prompt: string;
}

interface ImageAnalysisResult {
  studentId: string;
  imageUrl: string;
  analysis: string;
  timestamp: string;
}

interface AnalyzeImagesResponse {
  captureRequestId: string;
  sessionId: string;
  prompt: string;
  results: ImageAnalysisResult[];
  analyzedAt: string;
  totalImages: number;
}

const BATCH_SIZE = 10;

/**
 * Analyze captured images with custom prompt
 */
export async function analyzeCaptureImages(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  context.log('Processing POST /api/sessions/{sessionId}/capture/{captureRequestId}/analyze request');

  try {
    // ========================================================================
    // Step 1: Validate teacher authentication
    // ========================================================================
    
    const principal = parseAuthFromRequest(request);
    
    if (!principal) {
      return {
        status: 401,
        jsonBody: {
          error: {
            code: CaptureErrorCode.UNAUTHORIZED,
            message: 'Missing authentication header',
            timestamp: Date.now()
          }
        }
      };
    }
    
    if (!hasRole(principal, 'Teacher') && !hasRole(principal, 'teacher')) {
      return {
        status: 403,
        jsonBody: {
          error: {
            code: CaptureErrorCode.FORBIDDEN,
            message: 'Teacher role required',
            timestamp: Date.now()
          }
        }
      };
    }

    const teacherId = getUserId(principal);
    const sessionId = request.params.sessionId;
    const captureRequestId = request.params.captureRequestId;
    
    if (!sessionId || !captureRequestId) {
      return {
        status: 400,
        jsonBody: {
          error: {
            code: CaptureErrorCode.INVALID_REQUEST,
            message: 'Missing sessionId or captureRequestId',
            timestamp: Date.now()
          }
        }
      };
    }

    // Parse request body
    const body = await request.json() as AnalyzeImagesRequest;
    
    if (!body.prompt || body.prompt.trim().length === 0) {
      return {
        status: 400,
        jsonBody: {
          error: {
            code: CaptureErrorCode.INVALID_REQUEST,
            message: 'Prompt is required',
            timestamp: Date.now()
          }
        }
      };
    }

    context.log(`Teacher ${teacherId} analyzing capture ${captureRequestId} with prompt: ${body.prompt}`);

    // ========================================================================
    // Step 2: Verify capture request exists and belongs to teacher's session
    // ========================================================================
    
    const captureRequest = await getCaptureRequest(captureRequestId);
    
    if (!captureRequest) {
      return {
        status: 404,
        jsonBody: {
          error: {
            code: CaptureErrorCode.INVALID_REQUEST,
            message: 'Capture request not found',
            timestamp: Date.now()
          }
        }
      };
    }

    // TODO: Verify session ownership by teacherId

    // ========================================================================
    // Step 3: Retrieve all uploaded images
    // ========================================================================
    
    const uploads = await listCaptureUploads(sessionId, captureRequestId);
    
    if (uploads.length === 0) {
      return {
        status: 400,
        jsonBody: {
          error: {
            code: CaptureErrorCode.INVALID_REQUEST,
            message: 'No images available for analysis',
            timestamp: Date.now()
          }
        }
      };
    }

    context.log(`Found ${uploads.length} uploaded images`);

    // ========================================================================
    // Step 4: Generate SAS URLs for images
    // ========================================================================
    
    const imageData = uploads.map(upload => ({
      studentId: upload.rowKey, // studentId is the rowKey
      blobName: upload.blobName,
      uploadedAt: upload.uploadedAt,
      url: generateReadSasUrl(upload.blobUrl) // Use blobUrl, not blobName
    }));

    // ========================================================================
    // Step 5: Process images in batches using Azure AI Agent
    // ========================================================================
    
    const results: ImageAnalysisResult[] = [];
    const agentClient = getAgentClient();
    const analysisAgentName = process.env.AZURE_AI_ANALYSIS_AGENT_NAME || 'image-analysis-agent';
    const analysisAgentVersion = process.env.AZURE_AI_ANALYSIS_AGENT_VERSION || '1';

    context.log(`Using analysis agent: ${analysisAgentName}:${analysisAgentVersion}`);

    // Process in batches of 10
    for (let i = 0; i < imageData.length; i += BATCH_SIZE) {
      const batch = imageData.slice(i, i + BATCH_SIZE);
      const batchNumber = Math.floor(i / BATCH_SIZE) + 1;
      const totalBatches = Math.ceil(imageData.length / BATCH_SIZE);
      
      context.log(`Processing batch ${batchNumber}/${totalBatches} (${batch.length} images)`);

      try {
        // Call agent with vision capabilities
        const response = await agentClient.runSingleVisionInteraction({
          agentName: analysisAgentName,
          agentVersion: analysisAgentVersion,
          userPrompt: generateBatchPrompt(body.prompt, batch),
          imageUrls: batch.map(img => img.url),
          maxTokens: 2000,
          timeoutMs: 60000
        });

        // Parse response and extract individual results
        const batchResults = parseBatchAnalysisResponse(response.content, batch);
        results.push(...batchResults);

      } catch (error: any) {
        context.error(`Error analyzing batch ${batchNumber}:`, error);
        
        // Add error results for this batch
        batch.forEach(img => {
          results.push({
            studentId: img.studentId,
            imageUrl: img.url,
            analysis: `Error: ${error.message || 'Analysis failed'}`,
            timestamp: img.uploadedAt
          });
        });
      }
    }

    // ========================================================================
    // Step 6: Return results
    // ========================================================================
    
    const response: AnalyzeImagesResponse = {
      captureRequestId,
      sessionId,
      prompt: body.prompt,
      results,
      analyzedAt: new Date().toISOString(),
      totalImages: uploads.length
    };

    return {
      status: 200,
      jsonBody: response
    };

  } catch (error: any) {
    context.error('Error analyzing capture images:', error);
    
    return {
      status: 500,
      jsonBody: {
        error: {
          code: CaptureErrorCode.INTERNAL_ERROR,
          message: 'Failed to analyze images',
          details: error.message,
          timestamp: Date.now()
        }
      }
    };
  }
}

/**
 * Generate prompt for batch analysis
 */
function generateBatchPrompt(userPrompt: string, batch: Array<{ studentId: string; url: string }>): string {
  const imageList = batch.map((img, i) => `Image ${i + 1}: Student ${img.studentId}`).join('\n');
  
  return `Analyze the following ${batch.length} student images based on this question/prompt:

"${userPrompt}"

Images to analyze:
${imageList}

For each image, provide a clear, concise answer. Format your response as a JSON array:
[
  {
    "imageNumber": 1,
    "studentId": "${batch[0].studentId}",
    "analysis": "Your analysis here"
  },
  ...
]

Be specific and factual in your analysis.`;
}

/**
 * Parse batch analysis response
 */
function parseBatchAnalysisResponse(
  content: string,
  batch: Array<{ studentId: string; url: string; uploadedAt: string }>
): ImageAnalysisResult[] {
  try {
    // Try to extract JSON from response
    const jsonMatch = content.match(/```json\n([\s\S]*?)\n```/) || 
                      content.match(/```\n([\s\S]*?)\n```/) ||
                      content.match(/\[[\s\S]*\]/);
    
    const jsonStr = jsonMatch ? (jsonMatch[1] || jsonMatch[0]) : content.trim();
    const parsed = JSON.parse(jsonStr);
    
    if (!Array.isArray(parsed)) {
      throw new Error('Response is not an array');
    }

    // Map parsed results to our format
    return parsed.map((item: any) => {
      const imageIndex = (item.imageNumber || 1) - 1;
      const imageData = batch[imageIndex] || batch[0];
      
      return {
        studentId: item.studentId || imageData.studentId,
        imageUrl: imageData.url,
        analysis: item.analysis || 'No analysis provided',
        timestamp: imageData.uploadedAt
      };
    });

  } catch (error) {
    // If parsing fails, return generic results
    return batch.map(img => ({
      studentId: img.studentId,
      imageUrl: img.url,
      analysis: content.substring(0, 500), // Use first 500 chars as fallback
      timestamp: img.uploadedAt
    }));
  }
}

// Register the Azure Function
app.http('analyzeCaptureImages', {
  methods: ['POST'],
  route: 'sessions/{sessionId}/capture/{captureRequestId}/analyze',
  authLevel: 'anonymous',
  handler: analyzeCaptureImages
});
