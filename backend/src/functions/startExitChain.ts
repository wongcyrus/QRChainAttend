/**
 * startExitChain - STUB (Not Yet Implemented)
 * This function deploys successfully but returns a placeholder response
 */
import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';

export async function startExitChain(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  context.log('startExitChain called - not yet implemented');
  
  return {
    status: 501,
    jsonBody: {
      error: {
        code: 'NOT_IMPLEMENTED',
        message: 'This function is not yet implemented',
        function: 'startExitChain',
        timestamp: Date.now()
      }
    }
  };
}

app.http('startExitChain', {
  methods: ['GET', 'POST'],
  route: 'startExitChain',
  authLevel: 'anonymous',
  handler: startExitChain
});
