/**
 * Send Quiz Question API Endpoint
 * Selects a student fairly and sends them a quiz question
 */

import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { TableClient } from '@azure/data-tables';
import { randomUUID } from 'crypto';
import { broadcastQuizQuestion } from '../utils/signalrBroadcast';

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

// Fair student selection algorithm
async function selectStudentFairly(
  sessionId: string,
  attendees: string[],
  metricsTable: TableClient,
  context: InvocationContext
): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const recentThreshold = 300; // 5 minutes

  // Get metrics for all attendees
  const metricsMap = new Map<string, any>();
  
  for (const studentId of attendees) {
    try {
      const metric = await metricsTable.getEntity(sessionId, studentId);
      metricsMap.set(studentId, metric);
    } catch {
      // No metrics yet for this student
      metricsMap.set(studentId, {
        questionCount: 0,
        lastQuestionAt: 0,
        engagementScore: 50
      });
    }
  }

  // Calculate average question count
  const totalQuestions = Array.from(metricsMap.values())
    .reduce((sum, m) => sum + (m.questionCount || 0), 0);
  const avgQuestions = attendees.length > 0 ? totalQuestions / attendees.length : 0;

  // Score each student
  const scores = attendees.map(studentId => {
    const metric = metricsMap.get(studentId) || {
      questionCount: 0,
      lastQuestionAt: 0,
      engagementScore: 50
    };
    
    let score = 100;
    
    // Penalty for recent questions (higher = more recent)
    const timeSinceLastQuestion = now - (metric.lastQuestionAt || 0);
    if (timeSinceLastQuestion < recentThreshold) {
      score -= ((recentThreshold - timeSinceLastQuestion) / recentThreshold) * 50;
    }
    
    // Penalty for high question count (normalize to average)
    const questionDiff = (metric.questionCount || 0) - avgQuestions;
    score -= questionDiff * 10;
    
    // Bonus for low engagement (need more attention)
    const engagementScore = metric.engagementScore || 50;
    if (engagementScore < 50) {
      score += (50 - engagementScore) * 0.5;
    }
    
    return { studentId, score: Math.max(0, score) };
  });

  context.log('Student selection scores:', scores);

  // Weighted random selection
  const totalScore = scores.reduce((sum, s) => sum + s.score, 0);
  
  if (totalScore === 0) {
    // All scores are 0, truly random
    return attendees[Math.floor(Math.random() * attendees.length)];
  }

  let random = Math.random() * totalScore;
  
  for (const { studentId, score } of scores) {
    random -= score;
    if (random <= 0) {
      return studentId;
    }
  }
  
  // Fallback: truly random
  return attendees[Math.floor(Math.random() * attendees.length)];
}

export async function sendQuizQuestion(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  context.log('Processing POST /api/sessions/{sessionId}/quiz/send-question request');

  try {
    // Parse authentication
    const principalHeader = request.headers.get('x-ms-client-principal');
    if (!principalHeader) {
      context.log('Missing authentication header');
      return {
        status: 401,
        jsonBody: { error: { code: 'UNAUTHORIZED', message: 'Missing authentication header', timestamp: Date.now() } }
      };
    }

    const principal = parseUserPrincipal(principalHeader);
    context.log('User:', principal.userDetails);
    
    // Require Teacher role
    if (!hasRole(principal, 'Teacher') && !hasRole(principal, 'teacher')) {
      context.log('User does not have Teacher role');
      return {
        status: 403,
        jsonBody: { error: { code: 'FORBIDDEN', message: 'Teacher role required', timestamp: Date.now() } }
      };
    }

    const sessionId = request.params.sessionId;
    const body = await request.json() as any;
    const { questionId, studentId, timeLimit = 60 } = body;
    
    context.log('Request body:', { questionId, studentId, timeLimit });
    
    if (!sessionId || !questionId) {
      context.log('Missing sessionId or questionId');
      return {
        status: 400,
        jsonBody: { error: { code: 'INVALID_REQUEST', message: 'Missing sessionId or questionId', timestamp: Date.now() } }
      };
    }

    const now = Math.floor(Date.now() / 1000);
    const questionsTable = getTableClient('QuizQuestions');
    const responsesTable = getTableClient('QuizResponses');
    const metricsTable = getTableClient('QuizMetrics');
    const attendanceTable = getTableClient('Attendance');

    // Get question details
    context.log('Fetching question:', questionId);
    const question = await questionsTable.getEntity(sessionId, questionId);
    context.log('Question found:', question.question);

    // Determine target student
    let targetStudent: string;

    if (studentId) {
      // Teacher specified a student
      targetStudent = studentId;
      context.log('Using specified student:', targetStudent);
    } else {
      // Select student fairly
      context.log('Selecting student fairly...');
      
      // First, let's see ALL attendance records for debugging
      context.log('Checking ALL attendance records for session:', sessionId);
      const allRecords = attendanceTable.listEntities({
        queryOptions: { filter: `PartitionKey eq '${sessionId}'` }
      });
      
      let recordCount = 0;
      for await (const record of allRecords) {
        recordCount++;
        context.log(`Attendance record ${recordCount}:`, { 
          studentId: record.rowKey, 
          entryStatus: record.entryStatus,
          joinedAt: record.joinedAt,
          isOnline: record.isOnline,
          exitVerified: record.exitVerified,
          lastSeen: record.lastSeen
        });
      }
      context.log(`Total attendance records found: ${recordCount}`);
      
      // Get all present students (those who have joined)
      const attendees = [];
      const attendanceRecords = attendanceTable.listEntities({
        queryOptions: { filter: `PartitionKey eq '${sessionId}'` }
      });

      for await (const record of attendanceRecords) {
        // Filter in code: check if joinedAt exists and is not null/undefined
        if (record.joinedAt != null && record.joinedAt !== undefined) {
          attendees.push(record.rowKey as string);
        }
      }

      context.log('Found attendees with joinedAt:', attendees);

      if (attendees.length === 0) {
        context.log('No students present - silently skipping question send');
        // Don't return error, just skip silently
        return {
          status: 200,
          jsonBody: { 
            skipped: true,
            reason: 'No students present',
            timestamp: now 
          }
        };
      }

      targetStudent = await selectStudentFairly(sessionId, attendees, metricsTable, context);
      context.log('Selected student:', targetStudent);
    }

    // Create response record
    const responseId = randomUUID();
    const expiresAt = now + timeLimit;

    context.log('Creating quiz response:', {
      responseId,
      now,
      timeLimit,
      expiresAt,
      nowDate: new Date(now * 1000).toISOString(),
      expiresAtDate: new Date(expiresAt * 1000).toISOString()
    });

    await responsesTable.createEntity({
      partitionKey: sessionId,
      rowKey: responseId,
      questionId,
      studentId: targetStudent,
      answer: '',
      isCorrect: false,
      responseTime: 0,
      submittedAt: 0,
      sentAt: now,
      expiresAt,
      status: 'PENDING'
    });

    // Update metrics
    try {
      const metric = await metricsTable.getEntity(sessionId, targetStudent);
      await metricsTable.updateEntity({
        partitionKey: sessionId,
        rowKey: targetStudent,
        questionCount: (metric.questionCount as number || 0) + 1,
        lastQuestionAt: now
      }, 'Merge');
    } catch {
      // Create new metric
      await metricsTable.createEntity({
        partitionKey: sessionId,
        rowKey: targetStudent,
        totalQuestions: 1,
        correctAnswers: 0,
        questionCount: 1,
        averageResponseTime: 0,
        engagementScore: 50,
        lastQuestionAt: now
      });
    }

    // Broadcast question to student via SignalR
    await broadcastQuizQuestion(sessionId, {
      responseId,
      questionId,
      studentId: targetStudent,
      question: question.question as string,
      questionType: question.questionType as string,
      options: question.options ? JSON.parse(question.options as string) : null,
      timeLimit,
      expiresAt
    }, context);

    context.log(`Sent question ${questionId} to student ${targetStudent}`);

    return {
      status: 200,
      jsonBody: {
        responseId,
        studentId: targetStudent,
        sentAt: now,
        expiresAt
      }
    };

  } catch (error: any) {
    context.error('Error sending quiz question:', error);
    
    return {
      status: 500,
      jsonBody: {
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to send quiz question',
          details: error.message,
          timestamp: Date.now()
        }
      }
    };
  }
}

app.http('sendQuizQuestion', {
  methods: ['POST'],
  route: 'sessions/{sessionId}/quiz/send-question',
  authLevel: 'anonymous',
  handler: sendQuizQuestion
});
