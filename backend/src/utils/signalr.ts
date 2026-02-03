/**
 * SignalR Output Binding Utilities
 * Feature: qr-chain-attendance
 * Requirements: 12.1, 12.2, 12.3
 * 
 * Utilities for working with Azure Functions SignalR output bindings
 */

import { output, InvocationContext } from "@azure/functions";
import { SignalRMessage } from "../services/SignalRService";

/**
 * SignalR output binding definition
 * 
 * This binding allows Azure Functions to send messages to SignalR Service
 * without managing connections directly.
 */
export const signalROutput = output.generic({
  type: 'signalR',
  name: 'signalRMessages',
  hubName: 'attendance',
  connectionStringSetting: 'SIGNALR_CONNECTION_STRING'
});

/**
 * Send a SignalR message through the output binding
 * 
 * @param context - Azure Functions invocation context
 * @param message - SignalR message to send
 */
export function sendSignalRMessage(
  context: InvocationContext,
  message: SignalRMessage | null
): void {
  if (!message) {
    return;
  }

  try {
    // Set the output binding value
    context.extraOutputs.set(signalROutput, message);
    context.log(`SignalR message sent to group ${message.groupName}: ${message.target}`);
  } catch (error: any) {
    context.error('Error sending SignalR message:', error);
    // Don't throw - SignalR failures shouldn't break the main operation
  }
}

/**
 * Send multiple SignalR messages through the output binding
 * 
 * @param context - Azure Functions invocation context
 * @param messages - Array of SignalR messages to send
 */
export function sendSignalRMessages(
  context: InvocationContext,
  messages: (SignalRMessage | null)[]
): void {
  const validMessages = messages.filter(m => m !== null) as SignalRMessage[];
  
  if (validMessages.length === 0) {
    return;
  }

  try {
    // SignalR output binding can accept an array of messages
    context.extraOutputs.set(signalROutput, validMessages);
    context.log(`Sent ${validMessages.length} SignalR messages`);
  } catch (error: any) {
    context.error('Error sending SignalR messages:', error);
    // Don't throw - SignalR failures shouldn't break the main operation
  }
}
