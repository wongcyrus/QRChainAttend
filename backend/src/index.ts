/**
 * Main entry point for Azure Functions
 * Imports all function definitions to register them with the runtime
 */

// Import all functions to register them
export * from './functions/createSession';
export * from './functions/endSession';
export * from './functions/getAttendance';
export * from './functions/getEarlyQR';
export * from './functions/getLateQR';
export * from './functions/getSession';
export * from './functions/getUserRoles';
export * from './functions/joinSession';
export * from './functions/negotiate';
export * from './functions/reseedEntry';
export * from './functions/reseedExit';
export * from './functions/rotateTokens';
export * from './functions/scanChain';
export * from './functions/scanEarlyLeave';
export * from './functions/scanExitChain';
export * from './functions/scanLateEntry';
export * from './functions/seedEntry';
export * from './functions/startEarlyLeave';
export * from './functions/startExitChain';
export * from './functions/stopEarlyLeave';
