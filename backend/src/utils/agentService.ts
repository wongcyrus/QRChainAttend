/**
 * Azure AI Foundry Agent Service Utility
 * Provides agent-based AI interactions using Microsoft Foundry Agent Service
 * Uses persistent agents created as infrastructure
 */

import { AgentsClient, isOutputOfType } from '@azure/ai-agents';
import { AIProjectClient } from '@azure/ai-projects';
import { DefaultAzureCredential } from '@azure/identity';

interface AgentResponse {
  content: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

/**
 * Agent Service Client for interacting with Azure AI Foundry Agents
 */
export class AgentServiceClient {
  private projectEndpoint: string;
  private client: AgentsClient;
  private projectClient: AIProjectClient;

  constructor() {
    this.projectEndpoint = process.env.AZURE_AI_PROJECT_ENDPOINT || '';
    
    if (!this.projectEndpoint) {
      throw new Error('AZURE_AI_PROJECT_ENDPOINT environment variable is required');
    }

    const credential = new DefaultAzureCredential();
    this.client = new AgentsClient(this.projectEndpoint, credential);
    this.projectClient = new AIProjectClient(this.projectEndpoint, credential);
  }

  /**
   * Create an agent with specific instructions and configuration
   */
  async createAgent(config: {
    name: string;
    instructions: string;
    model?: string;
    temperature?: number;
  }): Promise<string> {
    const model = config.model || process.env.AZURE_OPENAI_DEPLOYMENT || 'gpt-4.1';

    const agent = await this.client.createAgent(model, {
      name: config.name,
      instructions: config.instructions
    });

    return agent.id;
  }

  /**
   * Create a thread for conversation
   */
  async createThread(): Promise<string> {
    const thread = await this.client.threads.create();
    return thread.id;
  }

  /**
   * Add a message to a thread
   */
  async addMessage(threadId: string, content: string, role: 'user' | 'assistant' = 'user'): Promise<void> {
    await this.client.messages.create(threadId, role, content);
  }

  /**
   * Run the agent on a thread
   */
  async runAgent(threadId: string, agentId: string): Promise<string> {
    const run = await this.client.runs.create(threadId, agentId);
    return run.id;
  }

  /**
   * Wait for run to complete and get the result
   */
  async waitForRunCompletion(threadId: string, runId: string, maxWaitSeconds: number = 60): Promise<string> {
    const startTime = Date.now();

    while (true) {
      const run = await this.client.runs.get(threadId, runId);

      if (run.status === 'completed') {
        // Run can become completed before assistant message is visible in thread list.
        // Retry briefly until assistant response appears or overall timeout is reached.
        while (true) {
          const assistantContent = await this.tryGetLatestAssistantMessage(threadId);
          if (assistantContent) {
            return assistantContent;
          }

          if ((Date.now() - startTime) / 1000 > maxWaitSeconds) {
            throw new Error(`Agent run completed but no assistant message appeared within ${maxWaitSeconds}s`);
          }

          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      } else if (run.status === 'failed' || run.status === 'cancelled' || run.status === 'expired') {
        throw new Error(`Agent run ${run.status}: ${run.lastError?.message || 'Unknown error'}`);
      } else if (run.status === 'requires_action') {
        // Agent needs tool execution - not supported in this implementation
        throw new Error('Agent requires action (tool execution) which is not supported');
      }

      // Check timeout
      if ((Date.now() - startTime) / 1000 > maxWaitSeconds) {
        throw new Error(`Agent run timeout after ${maxWaitSeconds}s. Last status: ${run.status}`);
      }

      // Wait before polling again
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  /**
   * Get the latest message from a thread
   */
  async getLatestMessage(threadId: string): Promise<string> {
    const content = await this.tryGetLatestAssistantMessage(threadId);
    if (content) {
      return content;
    }

    const messages: any[] = [];
    const iterator = this.client.messages.list(threadId);

    for await (const message of iterator) {
      messages.push(message);
      if (messages.length >= 20) {
        break;
      }
    }

    if (messages.length === 0) {
      throw new Error('No messages found in thread');
    }

    const messageRoles = messages.map((m: any) => `${m.role} (${m.createdAt})`).join(', ');
    throw new Error(`No assistant message found in thread. Messages: ${messageRoles}`);
  }

  private async tryGetLatestAssistantMessage(threadId: string): Promise<string | null> {
    const messages: any[] = [];
    const iterator = this.client.messages.list(threadId);

    for await (const message of iterator) {
      messages.push(message);
      if (messages.length >= 20) {
        break;
      }
    }
    
    if (messages.length === 0) {
      return null;
    }

    // Find the first assistant message (most recent)
    const assistantMessage = messages.find((m: any) => m.role === 'assistant');
    
    if (!assistantMessage) {
      return null;
    }

    const textContent = assistantMessage.content.find((c: any) => isOutputOfType(c, 'text'));
    
    if (!textContent) {
      return null;
    }

    const value = textContent?.text?.value;
    if (typeof value === 'string' && value.trim().length > 0) {
      return value;
    }

    return null;
  }

  /**
   * Delete an agent
   */
  async deleteAgent(agentId: string): Promise<void> {
    try {
      await this.client.deleteAgent(agentId);
    } catch (error: any) {
      const status = error?.statusCode || error?.status;
      if (status !== 404) {
        throw error;
      }
    }
  }

  /**
   * Delete a thread
   */
  async deleteThread(threadId: string): Promise<void> {
    try {
      await this.client.threads.delete(threadId);
    } catch (error: any) {
      const status = error?.statusCode || error?.status;
      if (status !== 404) {
        throw error;
      }
    }
  }

  /**
   * High-level method: Run a single agent interaction using persistent agent
   */
  async runSingleInteraction(config: {
    agentName?: string;
    instructions?: string;
    userMessage: string;
    model?: string;
  }): Promise<AgentResponse> {
    const apiVersion = process.env.AZURE_OPENAI_API_VERSION || '2025-04-01-preview';

    console.log('[AgentService] Starting runSingleInteraction');
    console.log('[AgentService] Project endpoint:', this.projectEndpoint);
    console.log('[AgentService] API version:', apiVersion);

    const openAIClient = await this.projectClient.getAzureOpenAIClient({
      apiVersion
    });
    console.log('[AgentService] OpenAI client created');

    const agentReferenceName = config.agentName || process.env.AZURE_AI_AGENT_NAME;
    const agentReferenceVersion = process.env.AZURE_AI_AGENT_VERSION;

    console.log('[AgentService] Agent name:', agentReferenceName);
    console.log('[AgentService] Agent version:', agentReferenceVersion);
    console.log('[AgentService] User message length:', config.userMessage?.length || 0);

    if (!agentReferenceName || !agentReferenceVersion) {
      throw new Error('AZURE_AI_AGENT_NAME and AZURE_AI_AGENT_VERSION environment variables are required');
    }

    let response: any;
    try {
      console.log('[AgentService] Calling openAIClient.responses.create with agent reference...');
      const startTime = Date.now();
      
      response = await openAIClient.responses.create(
        {
          input: [
            {
              role: 'user',
              content: config.userMessage
            }
          ]
        },
        {
          body: {
            agent: {
              name: agentReferenceName,
              version: agentReferenceVersion,
              type: 'agent_reference'
            }
          }
        }
      );
      
      const duration = Date.now() - startTime;
      console.log(`[AgentService] Agent response received in ${duration}ms`);
      console.log('[AgentService] Response keys:', Object.keys(response || {}));
    } catch (error: any) {
      console.error('[AgentService] Agent call failed:', error.message);
      console.error('[AgentService] Error details:', JSON.stringify(error, null, 2));
      
      const errorMessage = String(error?.message || '');
      if (!errorMessage.includes('Missed model deployment')) {
        throw error;
      }

      console.log('[AgentService] Falling back to direct model call...');
      const fallbackModel =
        config.model ||
        process.env.AZURE_OPENAI_DEPLOYMENT ||
        'gpt-4.1';

      console.log('[AgentService] Fallback model:', fallbackModel);
      
      response = await openAIClient.responses.create({
        model: fallbackModel,
        input: [
          {
            role: 'user',
            content: config.userMessage
          }
        ]
      });
      console.log('[AgentService] Fallback response received');
    }

    console.log('[AgentService] Parsing response...');
    console.log('[AgentService] output_text exists:', !!(response as any).output_text);
    console.log('[AgentService] output array exists:', Array.isArray((response as any).output));

    const outputText = (response as any).output_text;
    if (typeof outputText === 'string' && outputText.trim().length > 0) {
      console.log('[AgentService] Using output_text, length:', outputText.length);
      return {
        content: outputText
      };
    }

    const outputItems = (response as any).output;
    if (Array.isArray(outputItems)) {
      console.log('[AgentService] Processing output array, items:', outputItems.length);
      const textChunks: string[] = [];
      for (const item of outputItems) {
        console.log('[AgentService] Output item type:', item?.type);
        if (item?.type === 'message' && Array.isArray(item.content)) {
          console.log('[AgentService] Message content items:', item.content.length);
          for (const content of item.content) {
            console.log('[AgentService] Content type:', content?.type);
            if ((content?.type === 'output_text' || content?.type === 'text') && typeof content?.text === 'string') {
              textChunks.push(content.text);
            } else if (
              (content?.type === 'output_text' || content?.type === 'text') &&
              typeof content?.text?.value === 'string'
            ) {
              textChunks.push(content.text.value);
            }
          }
        }
      }

      if (textChunks.length > 0) {
        console.log('[AgentService] Extracted text chunks:', textChunks.length);
        return {
          content: textChunks.join('\n').trim()
        };
      }
    }

    console.error('[AgentService] No text output found in response');
    console.error('[AgentService] Full response:', JSON.stringify(response, null, 2).substring(0, 2000));
    throw new Error('Agent response contained no text output');
  }

  async runSingleVisionInteraction(config: {
    userMessage: string;
    imageUrls: string[];
    agentName: string;
    agentVersion: string;
    model?: string;
  }): Promise<AgentResponse> {
    const apiVersion = process.env.AZURE_OPENAI_API_VERSION || '2025-04-01-preview';

    const openAIClient = await this.projectClient.getAzureOpenAIClient({
      apiVersion
    });

    const inputContent: any[] = [
      {
        type: 'input_text',
        text: config.userMessage
      }
    ];

    for (const imageUrl of config.imageUrls) {
      inputContent.push({
        type: 'input_image',
        image_url: imageUrl
      });
    }

    let response: any;
    try {
      response = await openAIClient.responses.create(
        {
          input: [
            {
              role: 'user',
              content: inputContent
            }
          ]
        },
        {
          body: {
            agent: {
              name: config.agentName,
              version: config.agentVersion,
              type: 'agent_reference'
            }
          }
        }
      );
    } catch (error: any) {
      const errorMessage = String(error?.message || '');
      if (!errorMessage.includes('Missed model deployment')) {
        throw error;
      }

      const fallbackModel = config.model || process.env.AZURE_OPENAI_VISION_DEPLOYMENT || process.env.AZURE_OPENAI_DEPLOYMENT || 'gpt-4.1';

      response = await openAIClient.responses.create({
        model: fallbackModel,
        input: [
          {
            role: 'user',
            content: inputContent
          }
        ]
      });
    }

    const outputText = (response as any).output_text;
    if (typeof outputText === 'string' && outputText.trim().length > 0) {
      return {
        content: outputText
      };
    }

    const outputItems = (response as any).output;
    if (Array.isArray(outputItems)) {
      const textChunks: string[] = [];
      for (const item of outputItems) {
        if (item?.type === 'message' && Array.isArray(item.content)) {
          for (const content of item.content) {
            if ((content?.type === 'output_text' || content?.type === 'text') && typeof content?.text === 'string') {
              textChunks.push(content.text);
            } else if (
              (content?.type === 'output_text' || content?.type === 'text') &&
              typeof content?.text?.value === 'string'
            ) {
              textChunks.push(content.text.value);
            }
          }
        }
      }

      if (textChunks.length > 0) {
        return {
          content: textChunks.join('\n').trim()
        };
      }
    }

    throw new Error('Agent response contained no text output');
  }

}

/**
 * Singleton instance for reuse
 */
let agentClientInstance: AgentServiceClient | null = null;

/**
 * Get or create the agent service client
 */
export function getAgentClient(): AgentServiceClient {
  if (!agentClientInstance) {
    agentClientInstance = new AgentServiceClient();
  }
  return agentClientInstance;
}
