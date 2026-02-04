/**
 * Main entry point for Azure Functions
 * All function registrations must be in this file for Azure Functions v4
 */

import { app } from '@azure/functions';

// Import function handlers
import { createSession } from './functions/createSession';
import { endSession } from './functions/endSession';
import { getAttendance } from './functions/getAttendance';
import { getEarlyQR } from './functions/getEarlyQR';
import { getLateQR } from './functions/getLateQR';
import { getSession } from './functions/getSession';
import { getUserRoles } from './functions/getUserRoles';
import { joinSessionHandler } from './functions/joinSession';
import { negotiate } from './functions/negotiate';
import { reseedEntry } from './functions/reseedEntry';
import { reseedExit } from './functions/reseedExit';
import { rotateTokens } from './functions/rotateTokens';
import { scanChain } from './functions/scanChain';
import { scanEarlyLeave } from './functions/scanEarlyLeave';
import { scanExitChain } from './functions/scanExitChain';
import { scanLateEntry } from './functions/scanLateEntry';
import { seedEntry } from './functions/seedEntry';
import { startEarlyLeave } from './functions/startEarlyLeave';
import { startExitChain } from './functions/startExitChain';
import { stopEarlyLeave } from './functions/stopEarlyLeave';

// Register HTTP triggers
app.http('createSession', {
  methods: ['POST'],
  route: 'sessions',
  authLevel: 'anonymous',
  handler: createSession
});

app.http('endSession', {
  methods: ['POST'],
  route: 'sessions/{sessionId}/end',
  authLevel: 'anonymous',
  handler: endSession
});

app.http('getAttendance', {
  methods: ['GET'],
  route: 'sessions/{sessionId}/attendance',
  authLevel: 'anonymous',
  handler: getAttendance
});

app.http('getEarlyQR', {
  methods: ['GET'],
  route: 'sessions/{sessionId}/early-qr',
  authLevel: 'anonymous',
  handler: getEarlyQR
});

app.http('getLateQR', {
  methods: ['GET'],
  route: 'sessions/{sessionId}/late-qr',
  authLevel: 'anonymous',
  handler: getLateQR
});

app.http('getSession', {
  methods: ['GET'],
  route: 'sessions/{sessionId}',
  authLevel: 'anonymous',
  handler: getSession
});

app.http('getUserRoles', {
  methods: ['GET'],
  route: 'auth/me',
  authLevel: 'anonymous',
  handler: getUserRoles
});

app.http('joinSession', {
  methods: ['POST'],
  route: 'sessions/{sessionId}/join',
  authLevel: 'anonymous',
  handler: joinSessionHandler
});

app.http('negotiate', {
  methods: ['POST'],
  route: 'sessions/{sessionId}/dashboard/negotiate',
  authLevel: 'anonymous',
  handler: negotiate
});

app.http('reseedEntry', {
  methods: ['POST'],
  route: 'sessions/{sessionId}/reseed-entry',
  authLevel: 'anonymous',
  handler: reseedEntry
});

app.http('reseedExit', {
  methods: ['POST'],
  route: 'sessions/{sessionId}/reseed-exit',
  authLevel: 'anonymous',
  handler: reseedExit
});

app.http('scanChain', {
  methods: ['POST'],
  route: 'scan/chain',
  authLevel: 'anonymous',
  handler: scanChain
});

app.http('scanEarlyLeave', {
  methods: ['POST'],
  route: 'scan/early-leave',
  authLevel: 'anonymous',
  handler: scanEarlyLeave
});

app.http('scanExitChain', {
  methods: ['POST'],
  route: 'scan/exit-chain',
  authLevel: 'anonymous',
  handler: scanExitChain
});

app.http('scanLateEntry', {
  methods: ['POST'],
  route: 'scan/late-entry',
  authLevel: 'anonymous',
  handler: scanLateEntry
});

app.http('seedEntry', {
  methods: ['POST'],
  route: 'sessions/{sessionId}/seed-entry',
  authLevel: 'anonymous',
  handler: seedEntry
});

app.http('startEarlyLeave', {
  methods: ['POST'],
  route: 'sessions/{sessionId}/start-early-leave',
  authLevel: 'anonymous',
  handler: startEarlyLeave
});

app.http('startExitChain', {
  methods: ['POST'],
  route: 'sessions/{sessionId}/start-exit-chain',
  authLevel: 'anonymous',
  handler: startExitChain
});

app.http('stopEarlyLeave', {
  methods: ['POST'],
  route: 'sessions/{sessionId}/stop-early-leave',
  authLevel: 'anonymous',
  handler: stopEarlyLeave
});

// Register timer trigger
app.timer('rotateTokens', {
  schedule: '0 * * * * *', // Every minute
  handler: rotateTokens
});
