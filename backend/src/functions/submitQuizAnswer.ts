/**
 * Submit Quiz Answer API Endpoint
 * Students submit answers and get AI evaluation
 */

import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { TableClient } from '@azure/data-tables';
import { broadcastQuizResult } from '../utils/signalrBroadcast';

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
  
  if (role.toLowerCase() === 'student' && emailLower.endsWith('@stu.vtc.edu.hk')) {
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

// AI answer evaluation
async function evaluateAnswer(
  question: string,
  correctAnswer: string,
  studentAnswer: string,
  questionType: string,
  context: InvocationContext
): Promise<{ isCorrect: boolean; score: number; feedback: string }> {
  
  // For multiple choice, simple exact match
  if (questionType === 'MULTIPLE_CHOICE') {
    const isCorrect = studentAnswer.trim().toLowerCase() === correctAnswer.trim().toLowerCase();
    return {
      isCorrect,
      score: isCorrect ? 100 : 0,
      feedback: isCorrect 
        ? 'Correct! Well done.' 
        : `Incorrect. The correct answer is: ${correctAnswer}`
    };
  }

  // For short answer, use AI evaluation
  const openaiEndpoint = process.env.AZURE_OPENAI_ENDPOINT;
  const openaiKey = process.env.AZURE_OPENAI_KEY;
  const openaiDeployment = process.env.AZURE_OPENAI_DEPLOYMENT || 'gpt-4';

  if (!openaiEndpoint || !openaiKey) {
    // Fallback to simple comparison
    const isCorrect = studentAnswer.toLowerCase().includes(correctAnswer.toLowerCase());
    return {
      isCorrect,
      score: isCorrect ? 80 : 20,
      feedback: 'Answer recorded. Teacher will review.'
    };
  }

  try {
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
            content: `You are evaluating student answers. Be fair and consider partial credit.
Provide constructive feedback that helps students learn.`
          },
          {
            role: 'user',
            content: `Question: ${question}

Expected Answer: ${correctAnswer}

Student Answer: ${studentAnswer}

Evaluate the student's answer and return ONLY valid JSON (no markdown):
{
  "isCorrect": true or false,
  "score": 0-100,
  "feedback": "1-2 sentences of constructive feedback"
}

Consider:
- Is the core concept correct?
- Are key points mentioned?
- Is it partially correct?
- Provide specific feedback`
          }
        ],
        max_tokens: 300,
        temperature: 0.3,
        response_format: { type: "json_object" }
      })
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const aiResponse = await response.json();
    const content = aiResponse.choices[0]?.message?.content;

    if (!content) {
      throw new Error('No content in OpenAI response');
    }

    const evaluation = JSON.parse(content);
    
    return {
      isCorrect: evaluation.isCorrect || false,
      score: evaluation.score || 0,
      feedback: evaluation.feedback || 'Answer evaluated.'
    };

  } catch (error: any) {
    context.error('AI evaluation failed:', error);
    // Fallback
    const isCorrect = studentAnswer.toLowerCase().includes(correctAnswer.toLowerCase());
    return {
      isCorrect,
      score: isCorrect ? 70 : 30,
      feedback: 'Answer recorded. Teacher will review.'
    };
  }
}

export async function submitQuizAnswer(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  context.log('Processing POST /api/sessions/{sessionId}/quiz/submit-answer request');

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
    const studentEmail = principal.userDetails;
    
    // Require Student role
    if (!hasRole(principal, 'Student') && !hasRole(principal, 'student')) {
      return {
        status: 403,
        jsonBody: { error: { code: 'FORBIDDEN', message: 'Student role required', timestamp: Date.now() } }
      };
    }

    const sessionId = request.params.sessionId;
    const body = await request.json() as any;
    const { responseId, answer } = body;
    
    if (!sessionId || !responseId || !answer) {
      return {
        status: 400,
        jsonBody: { error: { code: 'INVALID_REQUEST', message: 'Missing sessionId, responseId, or answer', timestamp: Date.now() } }
      };
    }

    const now = Math.floor(Date.now() / 1000);
    const responsesTable = getTableClient('QuizResponses');
    const questionsTable = getTableClient('QuizQuestions');
    const metricsTable = getTableClient('QuizMetrics');

    // Get response record
    const response = await responsesTable.getEntity(sessionId, responseId);

    // Verify this response belongs to the student
    if (response.studentId !== studentEmail) {
      return {
        status: 403,
        jsonBody: { error: { code: 'FORBIDDEN', message: 'This question was not assigned to you', timestamp: now } }
      };
    }

    // Check if already answered
    if (response.status === 'ANSWERED') {
      return {
        status: 400,
        jsonBody: { error: { code: 'ALREADY_ANSWERED', message: 'Question already answered', timestamp: now } }
      };
    }

    // Check if expired
    if (now > (response.expiresAt as number)) {
      await responsesTable.updateEntity({
        partitionKey: sessionId,
        rowKey: responseId,
        status: 'EXPIRED'
      }, 'Merge');

      return {
        status: 400,
        jsonBody: { error: { code: 'EXPIRED', message: 'Time limit exceeded', timestamp: now } }
      };
    }

    // Get question details
    const question = await questionsTable.getEntity(sessionId, response.questionId as string);

    // Evaluate answer
    const evaluation = await evaluateAnswer(
      question.question as string,
      question.correctAnswer as string,
      answer,
      question.questionType as string,
      context
    );

    // Calculate response time
    const responseTime = now - (response.sentAt as number);

    // Update response record
    await responsesTable.updateEntity({
      partitionKey: sessionId,
      rowKey: responseId,
      answer,
      isCorrect: evaluation.isCorrect,
      score: evaluation.score,
      aiEvaluation: evaluation.feedback,
      responseTime,
      submittedAt: now,
      status: 'ANSWERED'
    }, 'Merge');

    // Update metrics
    try {
      const metric = await metricsTable.getEntity(sessionId, studentEmail);
      
      const totalQuestions = (metric.totalQuestions as number || 0) + 1;
      const correctAnswers = (metric.correctAnswers as number || 0) + (evaluation.isCorrect ? 1 : 0);
      const prevAvgTime = metric.averageResponseTime as number || 0;
      const newAvgTime = ((prevAvgTime * (totalQuestions - 1)) + responseTime) / totalQuestions;
      
      // Calculate engagement score
      const accuracy = (correctAnswers / totalQuestions) * 50;
      const timeLimit = question.timeLimit as number || 60;
      const speedRatio = responseTime / timeLimit;
      const speed = Math.max(0, (1 - speedRatio) * 30);
      const participation = Math.min(totalQuestions * 4, 20);
      const engagementScore = Math.round(accuracy + speed + participation);

      await metricsTable.updateEntity({
        partitionKey: sessionId,
        rowKey: studentEmail,
        totalQuestions,
        correctAnswers,
        averageResponseTime: newAvgTime,
        engagementScore
      }, 'Merge');

    } catch {
      // Create new metric
      const engagementScore = evaluation.isCorrect ? 70 : 50;
      
      await metricsTable.createEntity({
        partitionKey: sessionId,
        rowKey: studentEmail,
        totalQuestions: 1,
        correctAnswers: evaluation.isCorrect ? 1 : 0,
        questionCount: 1,
        averageResponseTime: responseTime,
        engagementScore,
        lastQuestionAt: now
      });
    }

    // Broadcast result to teacher
    await broadcastQuizResult(sessionId, {
      responseId,
      studentId: studentEmail,
      isCorrect: evaluation.isCorrect,
      score: evaluation.score,
      responseTime
    }, context);

    context.log(`Student ${studentEmail} answered question: ${evaluation.isCorrect ? 'CORRECT' : 'INCORRECT'} (${evaluation.score}/100)`);

    return {
      status: 200,
      jsonBody: {
        isCorrect: evaluation.isCorrect,
        score: evaluation.score,
        feedback: evaluation.feedback,
        correctAnswer: question.correctAnswer,
        responseTime
      }
    };

  } catch (error: any) {
    context.error('Error submitting quiz answer:', error);
    
    return {
      status: 500,
      jsonBody: {
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to submit answer',
          details: error.message,
          timestamp: Date.now()
        }
      }
    };
  }
}

app.http('submitQuizAnswer', {
  methods: ['POST'],
  route: 'sessions/{sessionId}/quiz/submit-answer',
  authLevel: 'anonymous',
  handler: submitQuizAnswer
});
