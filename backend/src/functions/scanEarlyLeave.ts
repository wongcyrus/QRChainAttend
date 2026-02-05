/**
 * scanEarlyLeave - STUB (Not Yet Implemented)
 * This function deploys successfully but returns a placeholder response
 */
import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';

export async function scanEarlyLeave(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  context.log('scanEarlyLeave called - not yet implemented');
  
  return {
    status: 501,
    jsonBody: {
      error: {
        code: 'NOT_IMPLEMENTED',
        message: 'This function is not yet implemented',
        function: 'scanEarlyLeave',
        timestamp: Date.now()
      }
    }
  };
}

app.http('scanEarlyLeave', {
  methods: ['GET', 'POST'],
  route: 'scanEarlyLeave',
  authLevel: 'anonymous',
  handler: scanEarlyLeave
});
