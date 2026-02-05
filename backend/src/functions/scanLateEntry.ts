/**
 * scanLateEntry - STUB (Not Yet Implemented)
 * This function deploys successfully but returns a placeholder response
 */
import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';

export async function scanLateEntry(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  context.log('scanLateEntry called - not yet implemented');
  
  return {
    status: 501,
    jsonBody: {
      error: {
        code: 'NOT_IMPLEMENTED',
        message: 'This function is not yet implemented',
        function: 'scanLateEntry',
        timestamp: Date.now()
      }
    }
  };
}

app.http('scanLateEntry', {
  methods: ['GET', 'POST'],
  route: 'scanLateEntry',
  authLevel: 'anonymous',
  handler: scanLateEntry
});
