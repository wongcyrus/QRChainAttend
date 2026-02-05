/**
 * startEarlyLeave - STUB (Not Yet Implemented)
 * This function deploys successfully but returns a placeholder response
 */
import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';

export async function startEarlyLeave(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  context.log('startEarlyLeave called - not yet implemented');
  
  return {
    status: 501,
    jsonBody: {
      error: {
        code: 'NOT_IMPLEMENTED',
        message: 'This function is not yet implemented',
        function: 'startEarlyLeave',
        timestamp: Date.now()
      }
    }
  };
}

app.http('startEarlyLeave', {
  methods: ['GET', 'POST'],
  route: 'startEarlyLeave',
  authLevel: 'anonymous',
  handler: startEarlyLeave
});
