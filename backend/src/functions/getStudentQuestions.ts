/**
 * Get Student Questions
 * Returns pending quiz questions for a student
 */

import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { TableClient } from '@azure/data-tables';

function parseUserPrincipal(header: string): any {
  try {
    const decoded = Buffer.from(header, 'base64').toString('utf-8');
    return JSON.parse(decoded);
  } catch {
    throw new Error('Invalid authentication header');
  }
}

function getUserId(principal: any): string {
  return principal.userDetails || principal.userId;
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

export async function getStudentQuestions(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  context.log('Processing GET /api/sessions/{sessionId}/student-questions request');

  try {
    const principalHeader = request.headers.get('x-ms-client-principal');
    if (!principalHeader) {
      return {
        status: 401,
        jsonBody: { error: { code: 'UNAUTHORIZED', message: 'Missing authentication header' } }
      };
    }

    const principal = parseUserPrincipal(principalHeader);
    
    if (!hasRole(principal, 'Student')) {
      return {
        status: 403,
        jsonBody: { error: { code: 'FORBIDDEN', message: 'Student role required' } }
      };
    }

    const sessionId = request.params.sessionId;
    const studentId = getUserId(principal);

    if (!sessionId) {
      return {
        status: 400,
        jsonBody: { error: { code: 'INVALID_REQUEST', message: 'Missing sessionId' } }
      };
    }

    const questionsTable = getTableClient('QuizQuestions');
    const responsesTable = getTableClient('QuizResponses');
    const now = Math.floor(Date.now() / 1000);

    // Get all pending responses for this student
    const responses = responsesTable.listEntities({
      queryOptions: { filter: `PartitionKey eq '${sessionId}' and studentId eq '${studentId}' and status eq 'PENDING'` }
    });

    const pendingQuestions = [];
    const expiredResponses = [];
    
    for await (const response of responses) {
      // Skip expired questions
      if ((response.expiresAt as number) <= now) {
        context.log(`Question ${response.questionId} expired, will mark as EXPIRED`);
        expiredResponses.push(response.rowKey as string);
        continue;
      }
      
      // Get the question details
      try {
        const question = await questionsTable.getEntity(sessionId, response.questionId as string);
        
        pendingQuestions.push({
          questionId: response.questionId,
          responseId: response.rowKey,
          question: question.question,
          options: JSON.parse(question.options as string),
          slideUrl: question.slideImageUrl,
          sentAt: response.sentAt,
          expiresAt: response.expiresAt
        });
      } catch (error: any) {
        context.warn(`Question ${response.questionId} not found`);
      }
    }

    // Mark all expired responses as EXPIRED (do this after the loop)
    for (const responseId of expiredResponses) {
      try {
        await responsesTable.updateEntity({
          partitionKey: sessionId,
          rowKey: responseId,
          status: 'EXPIRED'
        }, 'Merge');
        context.log(`Marked response ${responseId} as EXPIRED`);
      } catch (error: any) {
        context.warn(`Failed to mark response ${responseId} as expired:`, error.message);
      }
    }

    return {
      status: 200,
      jsonBody: {
        questions: pendingQuestions
      }
    };

  } catch (error: any) {
    context.error('Error getting student questions:', error);
    
    return {
      status: 500,
      jsonBody: {
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to get questions',
          details: error.message
        }
      }
    };
  }
}

app.http('getStudentQuestions', {
  methods: ['GET'],
  route: 'sessions/{sessionId}/student-questions',
  authLevel: 'anonymous',
  handler: getStudentQuestions
});
