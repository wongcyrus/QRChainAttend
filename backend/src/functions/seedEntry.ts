/**
 * seedEntry - STUB (Not Yet Implemented)
 * This function deploys successfully but returns a placeholder response
 */
import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';

export async function seedEntry(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  context.log('seedEntry called - not yet implemented');
  
  return {
    status: 501,
    jsonBody: {
      error: {
        code: 'NOT_IMPLEMENTED',
        message: 'This function is not yet implemented',
        function: 'seedEntry',
        timestamp: Date.now()
      }
    }
  };
}

app.http('seedEntry', {
  methods: ['GET', 'POST'],
  route: 'seedEntry',
  authLevel: 'anonymous',
  handler: seedEntry
});
