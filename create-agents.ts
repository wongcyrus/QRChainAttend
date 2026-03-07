#!/usr/bin/env tsx
/**
 * Create Azure AI Foundry Agents using TypeScript SDK
 * Migrated from bash scripts to use New Agents API instead of Classic Agents API
 * 
 * This script creates both quiz question generation and position estimation agents
 * using the @azure/ai-projects SDK, which creates "new agents" instead of "classic agents"
 */

import { DefaultAzureCredential } from '@azure/identity';
import { AIProjectClient } from '@azure/ai-projects';
import { writeFileSync, readFileSync, existsSync } from 'fs';
import { execSync } from 'child_process';

// ANSI color codes
const colors = {
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  blue: '\x1b[34m',
  reset: '\x1b[0m'
};

function printInfo(message: string) {
  console.log(`${colors.green}[INFO]${colors.reset} ${message}`);
}

function printWarning(message: string) {
  console.log(`${colors.yellow}[WARN]${colors.reset} ${message}`);
}

function printError(message: string) {
  console.log(`${colors.red}[ERROR]${colors.reset} ${message}`);
}

// Agent configurations
const QUIZ_AGENT_CONFIG = {
  name: 'QuizQuestionGenerator',
  instructions: `You are a quiz question generator. Your ONLY job is to return valid JSON with quiz questions.

CRITICAL RULES:
1. DO NOT repeat or echo the user's message
2. DO NOT include any explanatory text before or after the JSON
3. ONLY return the JSON object, nothing else

QUESTION REQUIREMENTS:
- Keep questions SHORT (maximum 15 words)
- Use simple, clear language
- ONLY create MULTIPLE_CHOICE questions with 4 options
- Match the specified difficulty level
- Test comprehension, not memorization

JSON FORMAT (return EXACTLY this structure):
{
  "questions": [
    {
      "text": "Short question?",
      "type": "MULTIPLE_CHOICE",
      "difficulty": "EASY" or "MEDIUM" or "HARD",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "correctAnswer": "Option A",
      "explanation": "Brief explanation"
    }
  ]
}

REMEMBER: Return ONLY the JSON object. No markdown, no code blocks, no extra text.`,
  model: 'gpt-4o'
};

const POSITION_AGENT_CONFIG = {
  name: 'PositionEstimationAgent',
  instructions: `You are a seating position estimation AI. Analyze classroom photos to estimate student seating positions.

CRITICAL RULES:
1. DO NOT repeat or echo the user's message
2. DO NOT include any explanatory text before or after the JSON
3. ONLY return the JSON object, nothing else

ANALYSIS CRITERIA:
- Projector screen visibility and angle (larger screen = closer to front)
- Projector screen size in frame (larger = lower row number)
- Classroom features in background
- Relative positions compared to other students

POSITION ASSIGNMENT:
- Row 1 = closest to projector (front)
- Higher row numbers = further back
- Column 1 = leftmost from teacher's perspective
- Higher column numbers = further right

CONFIDENCE LEVELS:
- HIGH: Clear projector visibility, distinct viewing angle
- MEDIUM: Some projector visibility or classroom features visible
- LOW: No projector visible, limited classroom context

JSON FORMAT (return EXACTLY this structure):
{
  "positions": [
    {
      "studentId": "student@email.com",
      "estimatedRow": 2,
      "estimatedColumn": 3,
      "confidence": "HIGH" | "MEDIUM" | "LOW",
      "reasoning": "Brief explanation of position estimate"
    }
  ],
  "analysisNotes": "Overall observations about classroom layout"
}

REMEMBER: Return ONLY the JSON object. No markdown, no code blocks, no extra text.`,
  model: 'gpt-4o'
};

const IMAGE_ANALYSIS_AGENT_CONFIG = {
  name: 'ImageAnalysisAgent',
  instructions: `You are an image analysis AI that answers questions about student-submitted classroom photos.

CRITICAL RULES:
1. DO NOT repeat or echo the user's message
2. DO NOT include any explanatory text before or after the JSON
3. ONLY return the JSON object, nothing else

YOUR TASK:
- Analyze each image based on the teacher's custom prompt/question
- Provide clear, concise, factual answers
- Be specific about what you observe in each image
- If you cannot determine something, say "Unable to determine" rather than guessing

JSON FORMAT (return EXACTLY this structure):
[
  {
    "imageNumber": 1,
    "studentId": "student@email.com",
    "analysis": "Your clear, concise answer to the teacher's question based on this image"
  },
  {
    "imageNumber": 2,
    "studentId": "student2@email.com",
    "analysis": "Your answer for the second image"
  }
]

REMEMBER: Return ONLY the JSON array. No markdown, no code blocks, no extra text.`,
  model: 'gpt-4o'
};

interface AgentConfig {
  name: string;
  instructions: string;
  model: string;
}

interface CreateAgentResult {
  agentId: string;
  agentVersionId: string;
  agentName: string;
  agentVersion: string;
  model: string;
}

interface ModelSelection {
  agentModel: string;
  visionDeployment: string;
  availableDeployments: string[];
}

async function getFoundryHeaders(credential: DefaultAzureCredential): Promise<Record<string, string>> {
  const token = await credential.getToken('https://ai.azure.com/.default');
  if (!token?.token) {
    throw new Error('Unable to acquire Azure AI Foundry access token');
  }

  return {
    Authorization: `Bearer ${token.token}`,
    'Content-Type': 'application/json'
  };
}

async function ensureAssistant(
  projectEndpoint: string,
  credential: DefaultAzureCredential,
  config: AgentConfig
): Promise<{ assistantId: string; assistantName: string }> {
  const headers = await getFoundryHeaders(credential);

  const listResponse = await fetch(`${projectEndpoint}/assistants?api-version=2025-05-01&limit=100&order=desc`, {
    method: 'GET',
    headers
  });

  if (!listResponse.ok) {
    const errorText = await listResponse.text();
    throw new Error(`Failed to list assistants: ${listResponse.status} - ${errorText}`);
  }

  const listPayload = await listResponse.json() as { data?: Array<{ id?: string; name?: string }> };
  const existing = listPayload.data?.find((assistant) => assistant.name === config.name && assistant.id);

  if (existing?.id) {
    return {
      assistantId: existing.id,
      assistantName: existing.name || config.name
    };
  }

  const createResponse = await fetch(`${projectEndpoint}/assistants?api-version=2025-05-01`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      name: config.name,
      model: config.model,
      instructions: config.instructions
    })
  });

  if (!createResponse.ok) {
    const errorText = await createResponse.text();
    throw new Error(`Failed to create assistant: ${createResponse.status} - ${errorText}`);
  }

  const created = await createResponse.json() as { id?: string; name?: string };
  if (!created.id) {
    throw new Error('Assistant creation did not return an ID');
  }

  return {
    assistantId: created.id,
    assistantName: created.name || config.name
  };
}

function buildProjectEndpoints(openaiResource: string, projectName: string): string[] {
  return [
    `https://${openaiResource}.services.ai.azure.com/api/projects/${projectName}`,
    `https://${openaiResource}.cognitiveservices.azure.com/api/projects/${projectName}`
  ];
}

function getProjectCandidates(resourceGroup: string, openaiResource: string, explicitProjectName?: string): string[] {
  const canonicalProjectName = `${openaiResource}-project`;
  const candidates: string[] = [];

  if (explicitProjectName) {
    candidates.push(explicitProjectName);
  }

  candidates.push(canonicalProjectName);

  try {
    const discoveredProjects = execSync(
      `az resource list --resource-group "${resourceGroup}" --resource-type "Microsoft.CognitiveServices/accounts/projects" --query "[?starts_with(name, '${openaiResource}/')].name" -o tsv`,
      { encoding: 'utf-8' }
    )
      .trim()
      .split('\n')
      .map((value) => value.trim())
      .filter((value) => value.length > 0 && value !== 'null')
      .map((value) => (value.includes('/') ? value.split('/')[1] : value))
      .filter((projectName) => projectName === canonicalProjectName);

    candidates.push(...discoveredProjects);
  } catch {
    // Ignore discovery failures and fall back to defaults
  }

  return Array.from(new Set(candidates.filter((value) => value.length > 0)));
}

function getProjectProvisioningState(resourceGroup: string, openaiResource: string, projectName: string): string {
  try {
    return execSync(
      `az resource show --ids "/subscriptions/$(az account show --query id -o tsv)/resourceGroups/${resourceGroup}/providers/Microsoft.CognitiveServices/accounts/${openaiResource}/projects/${projectName}" --query "properties.provisioningState" -o tsv 2>&1`,
      { encoding: 'utf-8' }
    ).trim();
  } catch {
    return '';
  }
}

function endpointIsReachable(projectEndpoint: string): boolean {
  try {
    const token = execSync(
      'az account get-access-token --resource https://ai.azure.com --query accessToken -o tsv',
      { encoding: 'utf-8' }
    ).trim();

    if (!token) {
      return false;
    }

    const statusCode = execSync(
      `curl -s -o /tmp/create-agents-endpoint-check.json -w "%{http_code}" -H "Authorization: Bearer ${token}" "${projectEndpoint}/agents?api-version=v1"`,
      { encoding: 'utf-8' }
    ).trim();

    return statusCode === '200';
  } catch {
    return false;
  }
}

function getOpenAIDeployments(resourceGroup: string, openaiResource: string): string[] {
  try {
    const raw = execSync(
      `az resource list --resource-group "${resourceGroup}" --resource-type "Microsoft.CognitiveServices/accounts/deployments" --query "[?starts_with(name, '${openaiResource}/')].name" -o tsv`,
      { encoding: 'utf-8' }
    )
      .trim()
      .split('\n')
      .map((value) => value.trim())
      .filter((value) => value.length > 0 && value !== 'null')
      .map((value) => (value.includes('/') ? value.split('/')[1] : value));

    return Array.from(new Set(raw));
  } catch {
    return [];
  }
}

function resolveModelSelection(resourceGroup: string, openaiResource: string): ModelSelection {
  const availableDeployments = getOpenAIDeployments(resourceGroup, openaiResource);

  const requestedModel = (process.env.AZURE_AI_AGENT_MODEL || '').trim();
  const requestedVisionDeployment = (process.env.AZURE_OPENAI_VISION_DEPLOYMENT || '').trim();

  const preferredModels = ['gpt-5.4', 'gpt-4o', 'gpt-4.1', 'gpt-5.2-chat'];
  const fallbackModel = preferredModels.find((name) => availableDeployments.includes(name))
    || availableDeployments[0]
    || 'gpt-5.4';

  const agentModel = requestedModel.length > 0
    ? requestedModel
    : fallbackModel;

  if (requestedModel.length > 0 && availableDeployments.length > 0 && !availableDeployments.includes(requestedModel)) {
    printWarning(`Requested model '${requestedModel}' is not in deployed models: ${availableDeployments.join(', ')}`);
    printWarning(`Proceeding with requested model override anyway.`);
  }

  const discoveredVisionDeployment = availableDeployments.find((name) => /vision/i.test(name));
  const visionDeployment = requestedVisionDeployment.length > 0
    ? requestedVisionDeployment
    : (discoveredVisionDeployment || agentModel);

  return {
    agentModel,
    visionDeployment,
    availableDeployments
  };
}

const projectBootstrapAttempts = new Set<string>();

function ensureProjectExists(resourceGroup: string, openaiResource: string, projectName: string): void {
  const bootstrapKey = `${resourceGroup}/${openaiResource}/${projectName}`;
  if (projectBootstrapAttempts.has(bootstrapKey)) {
    return;
  }
  projectBootstrapAttempts.add(bootstrapKey);

  try {
    const subscriptionId = execSync('az account show --query id -o tsv', { encoding: 'utf-8' }).trim();
    const resourceId = `/subscriptions/${subscriptionId}/resourceGroups/${resourceGroup}/providers/Microsoft.CognitiveServices/accounts/${openaiResource}/projects/${projectName}`;
    const state = getProjectProvisioningState(resourceGroup, openaiResource, projectName);

    if (state === 'Succeeded') {
      return;
    }

    if (state && state !== 'Succeeded') {
      printWarning(`Project ${projectName} is in state ${state}; skipping recreate and waiting for provisioning`);
      execSync('sleep 15', { stdio: 'pipe' });
      return;
    }

    printWarning(`Project not found in ARM state lookup; creating project: ${projectName}`);

    execSync(
      `az rest --method put --url "https://management.azure.com${resourceId}?api-version=2025-04-01-preview" --body '{"location":"eastus2","identity":{"type":"SystemAssigned"},"properties":{"displayName":"QR Attendance Project","description":"Project for ProvePresent application with Agent Service"}}' --output none`,
      { stdio: 'pipe' }
    );

    execSync('sleep 20', { stdio: 'pipe' });
  } catch (error) {
    printWarning(`Project ensure failed for ${projectName}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

function ensureCurrentUserProjectRole(resourceGroup: string, openaiResource: string, projectName: string): void {
  try {
    const subscriptionId = execSync('az account show --query id -o tsv', { encoding: 'utf-8' }).trim();
    const userObjectId = execSync('az ad signed-in-user show --query id -o tsv', { encoding: 'utf-8' }).trim();

    if (!subscriptionId || !userObjectId) {
      return;
    }

    const scope = `/subscriptions/${subscriptionId}/resourceGroups/${resourceGroup}/providers/Microsoft.CognitiveServices/accounts/${openaiResource}/projects/${projectName}`;

    execSync(
      `az role assignment create --assignee-object-id "${userObjectId}" --assignee-principal-type User --role "Azure AI User" --scope "${scope}" -o none`,
      { stdio: 'pipe' }
    );
    printInfo(`Ensured Azure AI User role for current user at project scope: ${projectName}`);
  } catch {
    // Ignore if role exists or if signed-in user object is unavailable
  }
}

function resolveWorkingProject(resourceGroup: string, openaiResource: string, explicitProjectName?: string): { projectName: string; projectEndpoint: string } {
  const projectName = explicitProjectName || `${openaiResource}-project`;
  const state = getProjectProvisioningState(resourceGroup, openaiResource, projectName);

  if (state !== 'Succeeded') {
    throw new Error(
      `Bicep project is not ready or not found: ${projectName} (state: ${state || 'NotFound'}). ` +
      'Deploy infrastructure first and wait until provisioningState is Succeeded.'
    );
  }

  return {
    projectName,
    projectEndpoint: buildProjectEndpoints(openaiResource, projectName)[0]
  };
}

async function createAgent(
  client: AIProjectClient,
  credential: DefaultAzureCredential,
  projectEndpoint: string,
  config: AgentConfig
): Promise<CreateAgentResult> {
  printInfo(`Creating agent: ${config.name}`);
  
  try {
    printInfo('Creating new agent version in Foundry project...');
    const agent = await client.agents.createVersion(config.name, {
      kind: 'prompt',
      model: config.model,
      instructions: config.instructions
    });

    const resolvedVersion = String(agent.version || '1');
    printInfo(`Agent version created: ${config.name}:${resolvedVersion}`);
    
    return {
      agentId: `${config.name}:${resolvedVersion}`,
      agentVersionId: agent.id,
      agentName: agent.name || config.name,
      agentVersion: resolvedVersion,
      model: config.model
    };
  } catch (error) {
    // Provide detailed error information
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : undefined;
    
    printError(`Failed to create agent ${config.name}`);
    printError(`Error: ${errorMessage}`);
    
    if (errorStack) {
      console.error('\nStack trace:');
      console.error(errorStack);
    }
    
    // Check for common issues
    if (errorMessage.includes('Project not found') || errorMessage.includes('404')) {
      printError('\nPossible causes:');
      printError('1. Project may not be fully provisioned yet (wait 5-10 minutes after Bicep deployment)');
      printError('2. Project name might be incorrect');
      printError('3. You may not have the "Azure AI User" role at the PROJECT scope');
      printError('\nTo fix:');
      printError('- Wait a few minutes and try again');
      printError('- Verify project exists in Azure Portal');
      printError('- Check RBAC permissions on the project resource');
    } else if (errorMessage.includes('401') || errorMessage.includes('Unauthorized')) {
      printError('\nAuthentication issue:');
      printError('- Run: az login');
      printError('- Ensure you have "Azure AI User" role on the project');
    } else if (errorMessage.includes('403') || errorMessage.includes('Forbidden')) {
      printError('\nPermission issue:');
      printError('- You need "Azure AI User" role assigned at PROJECT scope');
      printError('- Check RBAC in Azure Portal');
    }
    
    throw new Error(`Failed to create agent ${config.name}: ${errorMessage}`);
  }
}

async function updateFunctionAppSettings(
  resourceGroup: string,
  functionAppName: string,
  settings: Record<string, string>
): Promise<void> {
  printInfo(`Updating Function App settings: ${functionAppName}`);
  
  try {
    const settingsArgs = Object.entries(settings)
      .map(([key, value]) => `${key}="${value}"`)
      .join(' ');
    
    execSync(
      `az functionapp config appsettings set --name "${functionAppName}" --resource-group "${resourceGroup}" --settings ${settingsArgs} --output none`,
      { stdio: 'inherit' }
    );
    
    printInfo('Function App settings updated successfully!');
  } catch (error) {
    printWarning(`Failed to update Function App settings: ${error instanceof Error ? error.message : String(error)}`);
    printWarning('You can update manually later');
  }
}

async function main() {
  console.log(`${colors.blue}==========================================`);
  console.log('Azure AI Foundry Agent Creation (New Agents API)');
  console.log(`==========================================${colors.reset}\n`);
  
  // Parse command line arguments
  const args = process.argv.slice(2);
  if (args.length < 2) {
    printError('Usage: tsx create-agents.ts <resource-group> <openai-resource-name> [project-name]');
    console.log('');
    console.log('Example:');
    console.log('  tsx create-agents.ts my-rg my-openai-resource');
    process.exit(1);
  }
  
  const [resourceGroup, openaiResource, explicitProjectName] = args;

  const modelSelection = resolveModelSelection(resourceGroup, openaiResource);
  printInfo(`Available OpenAI deployments: ${modelSelection.availableDeployments.length > 0 ? modelSelection.availableDeployments.join(', ') : 'none discovered'}`);
  printInfo(`Selected agent model: ${modelSelection.agentModel}`);
  printInfo(`Selected vision deployment: ${modelSelection.visionDeployment}`);

  const quizAgentConfig: AgentConfig = {
    ...QUIZ_AGENT_CONFIG,
    model: modelSelection.agentModel
  };

  const positionAgentConfig: AgentConfig = {
    ...POSITION_AGENT_CONFIG,
    model: modelSelection.agentModel
  };

  const imageAnalysisAgentConfig: AgentConfig = {
    ...IMAGE_ANALYSIS_AGENT_CONFIG,
    model: modelSelection.agentModel
  };
  
  printInfo('Creating persistent agents using New Agents API');
  console.log('');
  
  // Resolve a working project from candidates (explicit + discovered)
  const resolvedProject = resolveWorkingProject(resourceGroup, openaiResource, explicitProjectName);
  let projectName = resolvedProject.projectName;
  let projectEndpoint = resolvedProject.projectEndpoint;

  printInfo(`Using project: ${projectName}`);

  // Ensure current user has project-scope role where possible
  ensureCurrentUserProjectRole(resourceGroup, openaiResource, projectName);
  
  printInfo(`Project Endpoint: ${projectEndpoint}`);
  console.log('');
  
  // Verify project exists before attempting to create agents
  printInfo('Verifying project exists in Azure...');
  
  try {
    const projectState = execSync(
      `az resource show --ids "/subscriptions/$(az account show --query id -o tsv)/resourceGroups/${resourceGroup}/providers/Microsoft.CognitiveServices/accounts/${openaiResource}/projects/${projectName}" --query "properties.provisioningState" -o tsv 2>&1`,
      { encoding: 'utf-8' }
    ).trim();
    
    if (projectState !== 'Succeeded') {
      printWarning(`Project provisioning state: ${projectState}`);
      printWarning('Project may not be fully ready. Waiting 30 seconds...');
      await new Promise(resolve => setTimeout(resolve, 30000));
    } else {
      printInfo(`Project verified: ${projectName} (state: ${projectState})`);
    }
  } catch (error) {
    printWarning('Could not verify project state via Azure CLI');
    printWarning('Attempting to proceed anyway...');
  }
  
  console.log('');
  
  // Validate credentials for Foundry data-plane calls
  printInfo('Initializing Azure AI Foundry authentication...');
  const credential = new DefaultAzureCredential();
  
  // Test credential before creating client
  try {
    printInfo('Testing Azure credentials...');
    const token = await credential.getToken('https://ai.azure.com/.default');
    if (!token) {
      throw new Error('Failed to obtain authentication token');
    }
    printInfo('✓ Credentials validated');
  } catch (error) {
    printError(`Credential validation failed: ${error instanceof Error ? error.message : String(error)}`);
    printError('Please ensure you are logged in with: az login');
    process.exit(1);
  }
  
  printInfo('Authentication initialized successfully');
  let client = new AIProjectClient(projectEndpoint, credential);

  const createAgentWithRecovery = async (config: AgentConfig): Promise<CreateAgentResult> => {
    try {
      return await createAgent(client, credential, projectEndpoint, config);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (message.includes('Project not found')) {
        const alternateEndpoint = buildProjectEndpoints(openaiResource, projectName)
          .find((candidateEndpoint) => candidateEndpoint !== projectEndpoint);

        if (alternateEndpoint) {
          printWarning(`Project not found on primary endpoint, trying alternate endpoint once: ${alternateEndpoint}`);
          projectEndpoint = alternateEndpoint;
          client = new AIProjectClient(projectEndpoint, credential);
          return await createAgent(client, credential, projectEndpoint, config);
        }

        throw new Error(`Project not found for Bicep-managed project ${projectName}. Verify Bicep deployment and rerun.`);
      }
      throw error;
    }
  };

  console.log('');
  
  // Create quiz question generation agent
  console.log(`${colors.blue}Creating Quiz Question Generation Agent...${colors.reset}`);
  const quizAgent = await createAgentWithRecovery(quizAgentConfig);
  
  console.log('');
  console.log('==========================================');
  console.log('Quiz Agent Details');
  console.log('==========================================');
  console.log('');
  console.log(`Agent ID: ${quizAgent.agentId}`);
  console.log(`Version ID: ${quizAgent.agentVersionId}`);
  console.log(`Version: ${quizAgent.agentVersion}`);
  console.log(`Agent Name: ${quizAgent.agentName}`);
  console.log(`Model: ${quizAgent.model}`);
  console.log('');
  console.log('==========================================');
  console.log('');
  
  // Create position estimation agent
  console.log(`${colors.blue}Creating Position Estimation Agent...${colors.reset}`);
  const positionAgent = await createAgentWithRecovery(positionAgentConfig);
  
  console.log('');
  console.log('==========================================');
  console.log('Position Agent Details');
  console.log('==========================================');
  console.log('');
  console.log(`Agent ID: ${positionAgent.agentId}`);
  console.log(`Version ID: ${positionAgent.agentVersionId}`);
  console.log(`Version: ${positionAgent.agentVersion}`);
  console.log(`Agent Name: ${positionAgent.agentName}`);
  console.log(`Model: ${positionAgent.model}`);
  console.log('');
  console.log('==========================================');
  console.log('');

  // Create image analysis agent
  console.log(`${colors.blue}Creating Image Analysis Agent...${colors.reset}`);
  const imageAnalysisAgent = await createAgentWithRecovery(imageAnalysisAgentConfig);
  
  console.log('');
  console.log('==========================================');
  console.log('Image Analysis Agent Details');
  console.log('==========================================');
  console.log('');
  console.log(`Agent ID: ${imageAnalysisAgent.agentId}`);
  console.log(`Version ID: ${imageAnalysisAgent.agentVersionId}`);
  console.log(`Version: ${imageAnalysisAgent.agentVersion}`);
  console.log(`Agent Name: ${imageAnalysisAgent.agentName}`);
  console.log(`Model: ${imageAnalysisAgent.model}`);
  console.log('');
  console.log('==========================================');
  console.log('');
  
  // Save configuration
  const outputFile = '.agent-config.env';
  printInfo(`Saving configuration to ${outputFile}`);
  
  // Get OpenAI endpoint for Function App
  const openaiEndpoint = execSync(
    `az cognitiveservices account show --name "${openaiResource}" --resource-group "${resourceGroup}" --query "properties.endpoint" -o tsv`,
    { encoding: 'utf-8' }
  ).trim();
  
  const configContent = `# Azure AI Foundry Persistent Agent Configuration
# Generated: ${new Date().toISOString()}
# Note: Uses managed identity authentication - no API keys needed
# Created with New Agents API (TypeScript SDK)

AZURE_AI_PROJECT_ENDPOINT=${projectEndpoint}
AZURE_AI_AGENT_NAME=${quizAgent.agentName}
AZURE_AI_AGENT_VERSION=${quizAgent.agentVersion}
AZURE_AI_POSITION_AGENT_NAME=${positionAgent.agentName}
AZURE_AI_POSITION_AGENT_VERSION=${positionAgent.agentVersion}
AZURE_AI_ANALYSIS_AGENT_NAME=${imageAnalysisAgent.agentName}
AZURE_AI_ANALYSIS_AGENT_VERSION=${imageAnalysisAgent.agentVersion}
AZURE_OPENAI_API_VERSION=2025-04-01-preview
AZURE_OPENAI_VISION_DEPLOYMENT=${modelSelection.visionDeployment}
AZURE_OPENAI_ENDPOINT=${openaiEndpoint}
`;
  
  writeFileSync(outputFile, configContent);
  printInfo('Configuration saved!');
  console.log('');
  
  // Ask to update Function App
  const readline = await import('readline');
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  
  const answer = await new Promise<string>((resolve) => {
    rl.question('Do you want to update the Function App with these settings? (y/n) ', resolve);
  });
  rl.close();
  
  if (answer.toLowerCase() === 'y') {
    printInfo('Finding Function App in resource group...');
    
    try {
      const functionAppName = execSync(
        `az functionapp list --resource-group "${resourceGroup}" --query "[0].name" -o tsv`,
        { encoding: 'utf-8' }
      ).trim();
      
      if (functionAppName && functionAppName !== 'null') {
        printInfo(`Found Function App: ${functionAppName}`);
        
        await updateFunctionAppSettings(resourceGroup, functionAppName, {
          AZURE_AI_PROJECT_ENDPOINT: projectEndpoint,
          AZURE_AI_AGENT_NAME: quizAgent.agentName,
          AZURE_AI_AGENT_VERSION: quizAgent.agentVersion,
          AZURE_AI_POSITION_AGENT_NAME: positionAgent.agentName,
          AZURE_AI_POSITION_AGENT_VERSION: positionAgent.agentVersion,
          AZURE_AI_ANALYSIS_AGENT_NAME: imageAnalysisAgent.agentName,
          AZURE_AI_ANALYSIS_AGENT_VERSION: imageAnalysisAgent.agentVersion,
          AZURE_OPENAI_API_VERSION: '2025-04-01-preview',
          AZURE_OPENAI_VISION_DEPLOYMENT: modelSelection.visionDeployment
        });
      } else {
        printWarning('No Function App found in resource group');
      }
    } catch (error) {
      printWarning(`Failed to find or update Function App: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  
  console.log('');
  printInfo('Next steps:');
  console.log('  1. Add agent settings to your local.settings.json');
  console.log('  2. Deploy your backend code');
  console.log('  3. Test the agent endpoints');
  console.log('');
  printInfo('Agents are now persistent and will be reused for all requests! 🎉');
  console.log('');
  printInfo('Note: These are "New Agents" (not "Classic Agents") created via TypeScript SDK');
}

// Run main function
main().catch((error) => {
  printError(`Fatal error: ${error instanceof Error ? error.message : String(error)}`);
  if (error instanceof Error && error.stack) {
    console.error(error.stack);
  }
  process.exit(1);
});
