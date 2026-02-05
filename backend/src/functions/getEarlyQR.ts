/**
 * getEarlyQR - STUB (Not Yet Implemented)
 * This function deploys successfully but returns a placeholder response
 */
import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';

export async function getEarlyQR(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  context.log('getEarlyQR called - not yet implemented');
  
  return {
    status: 501,
    jsonBody: {
      error: {
        code: 'NOT_IMPLEMENTED',
        message: 'This function is not yet implemented',
        function: 'getEarlyQR',
        timestamp: Date.now()
      }
    }
  };
}

app.http('getEarlyQR', {
  methods: ['GET', 'POST'],
  route: 'getEarlyQR',
  authLevel: 'anonymous',
  handler: getEarlyQR
});
