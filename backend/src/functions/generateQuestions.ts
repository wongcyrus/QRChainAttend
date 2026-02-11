/**
 * Generate Questions API Endpoint
 * Uses Azure OpenAI to generate quiz questions from slide analysis
 */

import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { TableClient } from '@azure/data-tables';
import { randomUUID } from 'crypto';

function parseUserPrincipal(header: string): any {
  try {
    const decoded = Buffer.from(header, 'base64').toString('utf-8');
    return JSON.parse(decoded);
  } catch {
    throw new Error('Invalid authentication header');
  }
}

function hasRole(principal: any, role: string): boolean {
  const email = principal.userDetails || '';
  const emailLower = email.toLowerCase();
  
  if (role.toLowerCase() === 'teacher' && emailLower.endsWith('@vtc.edu.hk') && !emailLower.endsWith('@stu.vtc.edu.hk')) {
    return true;
  }
  
  const roles = principal.userRoles || [];
  return roles.some((r: string) => r.toLowerCase() === role.toLowerCase());
}

function getTableClient(tableName: string): TableClient {
  const connectionString = process.env.AzureWebJobsStorage;
  if (!connectionString) {
    throw new Error('AzureWebJobsStorage not configured');
  }
  const isLocal = connectionString.includes("127.0.0.1") || connectionString.includes("localhost");
  return TableClient.fromConnectionString(connectionString, tableName, { allowInsecureConnection: isLocal });
}

export async function generateQuestions(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  context.log('Processing POST /api/sessions/{sessionId}/quiz/generate-questions request');

  try {
    // Parse authentication
    const principalHeader = request.headers.get('x-ms-client-principal');
    if (!principalHeader) {
      return {
        status: 401,
        jsonBody: { error: { code: 'UNAUTHORIZED', message: 'Missing authentication header', timestamp: Date.now() } }
      };
    }

    const principal = parseUserPrincipal(principalHeader);
    
    // Require Teacher role
    if (!hasRole(principal, 'Teacher') && !hasRole(principal, 'teacher')) {
      return {
        status: 403,
        jsonBody: { error: { code: 'FORBIDDEN', message: 'Teacher role required', timestamp: Date.now() } }
      };
    }

    const sessionId = request.params.sessionId;
    const body = await request.json() as any;
    const { slideId, analysis, difficulty, count = 3 } = body;
    
    if (!sessionId || !analysis) {
      return {
        status: 400,
        jsonBody: { error: { code: 'INVALID_REQUEST', message: 'Missing sessionId or analysis', timestamp: Date.now() } }
      };
    }

    // Call Azure OpenAI to generate questions
    const openaiEndpoint = process.env.AZURE_OPENAI_ENDPOINT;
    const openaiKey = process.env.AZURE_OPENAI_KEY;
    const openaiDeployment = process.env.AZURE_OPENAI_DEPLOYMENT || 'gpt-4';

    if (!openaiEndpoint || !openaiKey) {
      throw new Error('Azure OpenAI not configured');
    }

    const slideContent = `
Topic: ${analysis.topic}
Title: ${analysis.title || 'N/A'}
Key Points: ${analysis.keyPoints?.join(', ') || 'N/A'}
Code Examples: ${analysis.codeExamples?.join('\n') || 'N/A'}
Formulas: ${analysis.formulas?.join(', ') || 'N/A'}
Summary: ${analysis.summary || 'N/A'}
`;

    const difficultyFilter = difficulty || analysis.difficulty || 'MEDIUM';

    const apiUrl = `${openaiEndpoint}/openai/deployments/${openaiDeployment}/chat/completions?api-version=2024-02-15-preview`;

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-key': openaiKey
      },
      body: JSON.stringify({
        messages: [
          {
            role: 'system',
            content: `You are a university professor creating quiz questions to test student attention and understanding.
Generate questions that:
- Test comprehension, not just memorization
- Are clear and concise
- Match the specified difficulty level
- Can be answered based on the slide content
- Help identify if students are paying attention

For multiple choice questions, create 4 options with only 1 correct answer.
For short answer questions, provide a concise correct answer (1-2 sentences).`
          },
          {
            role: 'user',
            content: `Based on this slide content:
${slideContent}

Generate ${count} quiz questions at ${difficultyFilter} difficulty level.

Return ONLY valid JSON in this exact format (no markdown, no code blocks):
{
  "questions": [
    {
      "text": "Question text here?",
      "type": "MULTIPLE_CHOICE" or "SHORT_ANSWER",
      "difficulty": "EASY" or "MEDIUM" or "HARD",
      "options": ["Option A", "Option B", "Option C", "Option D"] (only for MULTIPLE_CHOICE),
      "correctAnswer": "Correct answer text",
      "explanation": "Why this is the correct answer"
    }
  ]
}`
          }
        ],
        max_tokens: 2000,
        temperature: 0.7,
        response_format: { type: "json_object" }
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      context.error('OpenAI API error:', errorText);
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const aiResponse = await response.json();
    const content = aiResponse.choices[0]?.message?.content;

    if (!content) {
      throw new Error('No content in OpenAI response');
    }

    const questionsData = JSON.parse(content);
    const questions = questionsData.questions || [];

    // Store questions in database
    const questionsTable = getTableClient('QuizQuestions');
    const now = Math.floor(Date.now() / 1000);

    const storedQuestions = [];

    for (const q of questions) {
      const questionId = randomUUID();
      
      await questionsTable.createEntity({
        partitionKey: sessionId,
        rowKey: questionId,
        slideId: slideId || '',
        slideContent: JSON.stringify(analysis),
        question: q.text,
        questionType: q.type,
        options: q.options ? JSON.stringify(q.options) : '',
        correctAnswer: q.correctAnswer,
        explanation: q.explanation || '',
        difficulty: q.difficulty,
        timeLimit: 60, // Default 60 seconds
        createdAt: now,
        createdBy: principal.userDetails
      });

      storedQuestions.push({
        questionId,
        text: q.text,
        type: q.type,
        difficulty: q.difficulty,
        options: q.options || null,
        correctAnswer: q.correctAnswer,
        explanation: q.explanation
      });
    }

    context.log(`Generated ${storedQuestions.length} questions for session ${sessionId}`);

    return {
      status: 200,
      jsonBody: {
        questions: storedQuestions
      }
    };

  } catch (error: any) {
    context.error('Error generating questions:', error);
    
    return {
      status: 500,
      jsonBody: {
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to generate questions',
          details: error.message,
          timestamp: Date.now()
        }
      }
    };
  }
}

app.http('generateQuestions', {
  methods: ['POST'],
  route: 'sessions/{sessionId}/quiz/generate-questions',
  authLevel: 'anonymous',
  handler: generateQuestions
});
