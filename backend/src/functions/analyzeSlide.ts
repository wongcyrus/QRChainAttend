/**
 * Analyze Slide API Endpoint
 * Uses QuizQuestionGenerator agent to analyze presentation slides
 */

import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { parseAuthFromRequest, hasRole } from '../utils/auth';
import { BlobServiceClient } from '@azure/storage-blob';
import { getAgentClient } from '../utils/agentService';
import { randomUUID } from 'crypto';

export async function analyzeSlide(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  context.log('Processing POST /api/sessions/{sessionId}/quiz/analyze-slide request');

  try {
    // Parse authentication
    const principal = parseAuthFromRequest(request);
    if (!principal) {
      return {
        status: 401,
        jsonBody: { error: { code: 'UNAUTHORIZED', message: 'Missing authentication header', timestamp: Date.now() } }
      };
    }    
    // Require Organizer role
    if (!hasRole(principal, 'Organizer') && !hasRole(principal, 'organizer')) {
      return {
        status: 403,
        jsonBody: { error: { code: 'FORBIDDEN', message: 'Organizer role required', timestamp: Date.now() } }
      };
    }

    const sessionId = request.params.sessionId;
    const body = await request.json() as any;
    const { image, imageUrl } = body;
    
    if (!sessionId) {
      return {
        status: 400,
        jsonBody: { error: { code: 'INVALID_REQUEST', message: 'Missing sessionId', timestamp: Date.now() } }
      };
    }

    if (!image && !imageUrl) {
      return {
        status: 400,
        jsonBody: { error: { code: 'INVALID_REQUEST', message: 'Missing image or imageUrl', timestamp: Date.now() } }
      };
    }

    const slideId = randomUUID();
    
    // Upload image to blob storage for future review
    const connectionString = process.env.AzureWebJobsStorage;
    if (!connectionString) {
      throw new Error('AzureWebJobsStorage not configured');
    }

    const blobServiceClient = BlobServiceClient.fromConnectionString(connectionString);
    const containerName = 'quiz-slides';
    const containerClient = blobServiceClient.getContainerClient(containerName);
    
    // Create container if it doesn't exist (with retry for Azurite compatibility)
    try {
      await containerClient.createIfNotExists({ access: 'blob' });
    } catch (error: any) {
      // If container already exists or Azurite version issue, continue
      if (!error.message?.includes('ContainerAlreadyExists')) {
        context.warn('Container creation warning:', error.message);
      }
    }

    const blobName = `${sessionId}/${slideId}.jpg`;
    const blockBlobClient = containerClient.getBlockBlobClient(blobName);

    let blobUrl: string;
    let imageDataForAI: string;

    if (image) {
      // Upload base64 image to blob storage
      const imageBuffer = Buffer.from(image.replace(/^data:image\/\w+;base64,/, ''), 'base64');
      try {
        await blockBlobClient.upload(imageBuffer, imageBuffer.length, {
          blobHTTPHeaders: { blobContentType: 'image/jpeg' }
        });
        blobUrl = blockBlobClient.url;
      } catch (error: any) {
        // If upload fails (Azurite version issue), use placeholder
        context.warn('Blob upload warning:', error.message);
        blobUrl = `local-${slideId}`;
      }
      imageDataForAI = image; // Use base64 for OpenAI
    } else {
      // Use provided URL
      blobUrl = imageUrl;
      imageDataForAI = imageUrl;
    }

    // Use QuizQuestionGenerator agent to analyze slide
    const agentClient = getAgentClient();
    
    const prompt = `Analyze this presentation slide image and extract the following information in JSON format:
{
  "topic": "Main topic or concept (1-2 words)",
  "title": "Slide title if visible",
  "keyPoints": ["Key point 1", "Key point 2", ...],
  "codeExamples": ["Code snippet 1", ...] or [],
  "formulas": ["Formula 1", ...] or [],
  "difficulty": "BEGINNER" | "INTERMEDIATE" | "ADVANCED",
  "subject": "Subject area (e.g., Database, Programming, Math, etc.)",
  "summary": "Brief 1-2 sentence summary of the slide content"
}

Image: ${imageDataForAI}

Return ONLY valid JSON (no markdown, no code blocks).`;

    context.log('Calling QuizQuestionGenerator agent to analyze slide...');
    
    const response = await agentClient.runSingleInteraction({
      agentName: 'QuizQuestionGenerator',
      userMessage: prompt
    });

    if (!response.content) {
      throw new Error('No content in agent response');
    }

    // Parse JSON from response
    let analysis;
    try {
      const cleanContent = response.content.replace(/```json\n?/gi, '').replace(/```\n?/g, '').trim();
      const firstBrace = cleanContent.indexOf('{');
      const lastBrace = cleanContent.lastIndexOf('}');
      const jsonStr = (firstBrace !== -1 && lastBrace !== -1) 
        ? cleanContent.substring(firstBrace, lastBrace + 1)
        : cleanContent;
      analysis = JSON.parse(jsonStr);
    } catch (parseError) {
      context.error('Failed to parse agent response:', response.content);
      throw new Error('Failed to parse AI analysis');
    }

    context.log(`Slide analyzed: ${analysis.topic}`);

    return {
      status: 200,
      jsonBody: {
        slideId,
        imageUrl: blobUrl,
        analysis: {
          topic: analysis.topic || 'Unknown',
          title: analysis.title || '',
          keyPoints: analysis.keyPoints || [],
          codeExamples: analysis.codeExamples || [],
          formulas: analysis.formulas || [],
          difficulty: analysis.difficulty || 'INTERMEDIATE',
          subject: analysis.subject || 'General',
          summary: analysis.summary || ''
        }
      }
    };

  } catch (error: any) {
    context.error('Error analyzing slide:', error);
    
    return {
      status: 500,
      jsonBody: {
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to analyze slide',
          details: error.message,
          timestamp: Date.now()
        }
      }
    };
  }
}

app.http('analyzeSlide', {
  methods: ['POST'],
  route: 'sessions/{sessionId}/quiz/analyze-slide',
  authLevel: 'anonymous',
  handler: analyzeSlide
});
