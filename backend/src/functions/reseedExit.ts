/**
 * reseedExit - STUB (Not Yet Implemented)
 * This function deploys successfully but returns a placeholder response
 */
import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';

export async function reseedExit(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  context.log('reseedExit called - not yet implemented');
  
  return {
    status: 501,
    jsonBody: {
      error: {
        code: 'NOT_IMPLEMENTED',
        message: 'This function is not yet implemented',
        function: 'reseedExit',
        timestamp: Date.now()
      }
    }
  };
}

app.http('reseedExit', {
  methods: ['GET', 'POST'],
  route: 'reseedExit',
  authLevel: 'anonymous',
  handler: reseedExit
});
