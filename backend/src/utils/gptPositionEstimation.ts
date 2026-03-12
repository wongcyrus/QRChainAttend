/**
 * GPT Position Estimation Service
 * 
 * This module provides AI-powered seating position estimation using Azure AI Foundry Agent Service.
 * It analyzes attendee photos to estimate their seating positions based on:
 * - Projector screen visibility and angle
 * - Projector screen size in the frame
 * - Venue features visible in the background
 * - Relative positions compared to other students' photos
 * 
 * Uses managed identity authentication via agent service (no API keys).
 * 
 * Validates: Requirements 6.1, 6.2, 6.3, 6.4
 */

import { InvocationContext } from '@azure/functions';
import {
  PositionEstimationInput,
  PositionEstimationOutput,
  GPTAnalysisResponse,
  SeatingPosition
} from '../types/studentImageCapture';
import { generateReadSasUrl } from './blobStorage';
import { getAgentClient } from './agentService';

/**
 * Agent configuration
 * 
 * IMPORTANT: This system uses the Azure AI Foundry Agent Service with vision capabilities.
 * For classes with more than 10 students, automatic batching with overlap is implemented.
 * 
 * Overlapping Strategy:
 * - Each batch includes 3 students from the previous batch as "anchor points"
 * - These overlapping students allow us to align batches accurately
 * - Example for 25 students:
 *   - Batch 1: Students 1-10
 *   - Batch 2: Students 8-17 (overlap: 8, 9, 10)
 *   - Batch 3: Students 15-24 (overlap: 15, 16, 17)
 *   - Batch 4: Attendee 22-25 (overlap: 22, 23, 24)
 */
const AGENT_CONFIG = {
  maxTokens: 2000,
  timeoutMs: 60000, // 60 seconds
  maxRetries: 3,
  maxImagesPerRequest: 10, // Vision model limit
  batchSize: 10,
  overlapSize: 3
};

/**
 * System prompt is now stored in the agent configuration
 * This is kept here for reference only
 */
const SYSTEM_PROMPT_REFERENCE = `Position estimation agent analyzes venue photos to estimate attendee seating positions based on projector visibility, screen size, and venue features.`;

/**
 * Generate user prompt for GPT analysis
 */
function generateUserPrompt(imageCount: number, images: Array<{ attendeeId: string; url: string }>, batchInfo?: { current: number; total: number }): string {
  const imageList = images.map((img, i) => `${i + 1}. ${img.attendeeId}`).join('\n');
  const validAttendeeIds = images.map(img => img.attendeeId);
  
  let batchContext = '';
  if (batchInfo) {
    if (batchInfo.total === 1) {
      // Single batch - all students
      batchContext = `\n\nThis is the complete class of ${imageCount} students. Analyze their seating positions relative to each other.`;
    } else {
      // Multiple batches
      batchContext = `\n\nIMPORTANT CONTEXT:
- This is batch ${batchInfo.current} of ${batchInfo.total} in a larger class
- Analyze these ${imageCount} students relative to EACH OTHER within this batch
- Assign row and column numbers based on their relative positions
- Students in this batch may sit behind students in earlier batches
- Focus on the relative arrangement of these specific students`;
    }
  }
  
  return `Analyze these ${imageCount} attendee photos and estimate their seating positions.

Each image in this request is provided immediately after a text label in this exact format:
ATTENDEE_IMAGE_N: attendeeId=<ID>
Use that label-to-image pairing as the source of truth for attendee identity.

${imageList}${batchContext}

CRITICAL ID RULES (MUST FOLLOW EXACTLY):
- Use attendeeId values ONLY from this allowed list:
${validAttendeeIds.map(id => `  - ${id}`).join('\n')}
- attendeeId must match character-for-character (case-sensitive).
- Do NOT invent, shorten, normalize, or omit attendeeId values.
- Return each allowed attendeeId exactly once in positions.
- The positions array length MUST be exactly ${imageCount}.
- NEVER output "undefined", "null", or any placeholder as an attendeeId value.
- Every attendeeId in positions MUST exactly match one of the IDs in the allowed list above.

Respond in JSON format:
{
  "positions": [
    {
      "attendeeId": "attendee@email.com",
      "estimatedRow": 2,
      "estimatedColumn": 3,
      "confidence": "HIGH" | "MEDIUM" | "LOW",
      "reasoning": "Brief explanation"
    }
  ],
  "analysisNotes": "Overall observations about the venue layout"
}

Consider:
- Students with larger projector screens are likely closer to the front (lower row numbers)
- Students with similar viewing angles are likely in the same row
- Projector position and angle indicate column position
- If projector is not visible, confidence should be LOW
- Assign row numbers starting from 1 for the closest students in THIS batch`;
}

/**
 * Parse agent response to extract JSON
 */
function parseAgentResponse(content: string): GPTAnalysisResponse {
  // Check if agent refused the request
  if (content.toLowerCase().includes("i'm unable") || 
      content.toLowerCase().includes("i cannot") ||
      content.toLowerCase().includes("i can't")) {
    throw new Error(`Agent refused the request: ${content.substring(0, 200)}`);
  }
  
  // Try to extract JSON from code blocks first
  const jsonMatch = content.match(/```json\n([\s\S]*?)\n```/) || 
                    content.match(/```\n([\s\S]*?)\n```/);
  
  const jsonStr = jsonMatch ? jsonMatch[1] : content.trim();
  
  try {
    return JSON.parse(jsonStr) as GPTAnalysisResponse;
  } catch (error) {
    // Provide more context in the error
    const preview = content.substring(0, 200);
    throw new Error(`Failed to parse agent response as JSON: ${error instanceof Error ? error.message : 'Unknown error'}. Response preview: ${preview}`);
  }
}

function validatePositionsWithExpectedAttendees(
  positions: SeatingPosition[],
  expectedAttendeeIds: string[],
  batchLabel: string
): SeatingPosition[] {
  if (positions.length !== expectedAttendeeIds.length) {
    throw new Error(`${batchLabel}: Expected ${expectedAttendeeIds.length} positions but received ${positions.length}`);
  }

  const expectedSet = new Set(expectedAttendeeIds);
  const seen = new Set<string>();
  const invalidIds: string[] = [];
  const duplicateIds: string[] = [];

  for (const position of positions) {
    const attendeeId = position?.attendeeId;
    if (typeof attendeeId !== 'string' || attendeeId.length === 0) {
      invalidIds.push('(missing attendeeId)');
      continue;
    }

    if (!expectedSet.has(attendeeId)) {
      invalidIds.push(attendeeId === 'undefined' || attendeeId === 'null'
        ? '(missing attendeeId)'
        : `"${attendeeId}" (not in allowed list)`);
      continue;
    }

    if (seen.has(attendeeId)) {
      duplicateIds.push(attendeeId);
      continue;
    }

    seen.add(attendeeId);
  }

  if (invalidIds.length > 0) {
    throw new Error(`${batchLabel}: Received unexpected attendee IDs: ${invalidIds.join(', ')}`);
  }

  if (duplicateIds.length > 0) {
    throw new Error(`${batchLabel}: Received duplicate attendee IDs: ${duplicateIds.join(', ')}`);
  }

  const missingIds = expectedAttendeeIds.filter(id => !seen.has(id));
  if (missingIds.length > 0) {
    throw new Error(`${batchLabel}: Missing attendee IDs: ${missingIds.join(', ')}`);
  }

  return positions;
}

/**
 * Call Azure AI Foundry Agent Service for position estimation
 * Uses managed identity authentication (no API keys)
 */
async function callPositionEstimationAgent(
  userPrompt: string,
  imageUrls: Array<{ attendeeId: string; url: string }>,
  context: InvocationContext
): Promise<string> {
  const agentClient = getAgentClient();
  const positionAgentName = process.env.AZURE_AI_POSITION_AGENT_NAME;
  const positionAgentVersion = process.env.AZURE_AI_POSITION_AGENT_VERSION;

  if (!positionAgentName || !positionAgentVersion) {
    throw new Error('AZURE_AI_POSITION_AGENT_NAME and AZURE_AI_POSITION_AGENT_VERSION environment variables are required');
  }

  context.log(`Using position estimation agent reference: ${positionAgentName}:${positionAgentVersion}`);
  context.log(`Analyzing ${imageUrls.length} images`);

  const maxRetries = 2;
  let lastError: any;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await agentClient.runSingleVisionInteraction({
        userPrompt: userPrompt,
        imageUrls: imageUrls.map((img) => img.url),
        imageInputs: imageUrls.map((img) => ({
          attendeeId: img.attendeeId,
          imageUrl: img.url
        })),
        agentName: positionAgentName,
        agentVersion: positionAgentVersion,
        model: process.env.AZURE_OPENAI_VISION_DEPLOYMENT || process.env.AZURE_OPENAI_DEPLOYMENT || 'gpt-5.4'
      });

      context.log('Position estimation agent-reference run completed');
      return response.content;
    } catch (error: any) {
      lastError = error;
      const shouldRetry = (error.status === 429 || error.status >= 500) && attempt < maxRetries;
      
      if (shouldRetry) {
        const delay = Math.pow(2, attempt) * 1000;
        context.warn(`Attempt ${attempt + 1} failed (status=${error.status}, code=${error.code}). Retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      } else {
        context.error(`Azure OpenAI error: status=${error.status}, code=${error.code}, type=${error.type}, message=${error.message}`);
        break;
      }
    }
  }

  throw lastError;
}

/**
 * Estimate seating positions from attendee photos using a vision-capable Azure OpenAI deployment
 * 
 * This function:
 * 1. Generates read SAS URLs for each image
 * 2. Constructs GPT system and user prompts
 * 3. Calls Azure OpenAI chat completions API with multi-image analysis
 * 4. Parses the response to extract position estimates
 * 5. Returns structured position data
 * 
 * @param input - Capture request ID and array of image blob URLs
 * @param context - Azure Functions invocation context
 * @returns Position estimation output with positions and analysis notes
 * @throws Error if GPT API fails, times out, or returns invalid JSON
 * 
 * Validates: Requirements 6.1, 6.2, 6.3
 */
export async function estimateSeatingPositions(
  input: PositionEstimationInput,
  context: InvocationContext
): Promise<PositionEstimationOutput> {
  context.log(`Starting position estimation for capture request: ${input.captureRequestId}`);
  context.log(`Analyzing ${input.imageUrls.length} attendee photos`);
  
  try {
    // ========================================================================
    // Step 1: Generate read SAS URLs for GPT access
    // ========================================================================
    
    const imageUrls = input.imageUrls.map(img => {
      const sasUrl = generateReadSasUrl(img.blobUrl);
      context.log(`Generated read SAS URL for attendee: ${img.attendeeId}`);
      return {
        attendeeId: img.attendeeId,
        url: sasUrl
      };
    });
    
    // ========================================================================
    // Step 2: Check if batching is needed (more than 10 images)
    // ========================================================================
    
    const needsBatching = imageUrls.length > AGENT_CONFIG.maxImagesPerRequest;
    
    if (needsBatching) {
      context.log(`Image count (${imageUrls.length}) exceeds limit of ${AGENT_CONFIG.maxImagesPerRequest}. Using batching strategy.`);
      return await processBatchedAnalysis(imageUrls, context);
    }
    
    // ========================================================================
    // Step 3: Single batch processing (10 or fewer images)
    // ========================================================================
    
    context.log('Processing single batch (10 or fewer images)');
    return await processSingleBatch(imageUrls, context);
    
  } catch (error: any) {
    context.error('Position estimation failed:', error);
    throw error;
  }
}

/**
 * Process a single batch of images (10 or fewer)
 */
async function processSingleBatch(
  imageUrls: Array<{ attendeeId: string; url: string }>,
  context: InvocationContext
): Promise<PositionEstimationOutput> {
  const userPrompt = generateUserPrompt(imageUrls.length, imageUrls);
  
  context.log('Calling position estimation agent with images');
  
  const content = await callPositionEstimationAgent(userPrompt, imageUrls, context);
  
  context.log('Agent returned response');
  
  const analysis = parseAgentResponse(content);
  
  if (!analysis.positions || !Array.isArray(analysis.positions)) {
    throw new Error('Agent response missing positions array');
  }
  
  const validatedPositions = validatePositionsWithExpectedAttendees(
    analysis.positions,
    imageUrls.map(img => img.attendeeId),
    'Single batch'
  );

  context.log(`Successfully parsed and validated ${validatedPositions.length} position estimates`);
  
  return {
    positions: validatedPositions,
    analysisNotes: analysis.analysisNotes || 'Position analysis completed'
  };
}

/**
 * Process multiple batches of images (more than 10) with overlapping students
 * Uses overlapping students as anchor points to align batches accurately
 */
async function processBatchedAnalysis(
  imageUrls: Array<{ attendeeId: string; url: string }>,
  context: InvocationContext
): Promise<PositionEstimationOutput> {
  const batchSize = AGENT_CONFIG.batchSize;
  const overlapSize = AGENT_CONFIG.overlapSize;
  const batches: Array<Array<{ attendeeId: string; url: string }>> = [];
  
  // Split into overlapping batches
  let startIndex = 0;
  while (startIndex < imageUrls.length) {
    const endIndex = Math.min(startIndex + batchSize, imageUrls.length);
    batches.push(imageUrls.slice(startIndex, endIndex));
    
    if (endIndex === imageUrls.length) {
      break;
    }
    startIndex += (batchSize - overlapSize);
  }
  
  context.log(`Split ${imageUrls.length} images into ${batches.length} overlapping batches`);
  batches.forEach((batch, i) => {
    const studentIds = batch.map(img => img.attendeeId).join(', ');
    context.log(`Batch ${i + 1}: ${batch.length} students (${studentIds})`);
  });
  
  const batchResults: Array<{ positions: SeatingPosition[]; notes: string }> = [];
  
  // Process each batch sequentially
  for (let i = 0; i < batches.length; i++) {
    const batch = batches[i];
    const batchNum = i + 1;
    
    context.log(`Processing batch ${batchNum}/${batches.length} (${batch.length} images)`);
    
    const userPrompt = generateUserPrompt(batch.length, batch, {
      current: batchNum,
      total: batches.length
    });
    
    const content = await callPositionEstimationAgent(userPrompt, batch, context);
    
    context.log(`Batch ${batchNum} completed`);
    
    const analysis = parseAgentResponse(content);
    
    if (!analysis.positions || !Array.isArray(analysis.positions)) {
      throw new Error(`Batch ${batchNum} response missing positions array`);
    }

    const validatedPositions = validatePositionsWithExpectedAttendees(
      analysis.positions,
      batch.map(img => img.attendeeId),
      `Batch ${batchNum}`
    );
    
    batchResults.push({
      positions: validatedPositions,
      notes: analysis.analysisNotes || `Batch ${batchNum} analysis`
    });
    
    context.log(`Batch ${batchNum} parsed and validated ${validatedPositions.length} positions`);
    
    // Add delay between batches to avoid rate limiting (except for last batch)
    if (i < batches.length - 1) {
      context.log('Waiting 2 seconds before next batch...');
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }
  
  // Align batches using overlapping students
  context.log('Aligning batches using overlapping students...');
  const alignedPositions = alignBatchesUsingOverlap(batchResults, batches, context);
  
  context.log(`Batched analysis complete: ${alignedPositions.length} unique students from ${batches.length} batches`);
  
  return {
    positions: alignedPositions,
    analysisNotes: `Analyzed ${imageUrls.length} students in ${batches.length} overlapping batches. ${batchResults.map((r, i) => `Batch ${i + 1}: ${r.notes}`).join(' ')}`
  };
}

/**
 * Align batches using overlapping students as anchor points
 * 
 * Strategy:
 * 1. Keep Batch 1 positions as-is (reference frame)
 * 2. For each subsequent batch:
 *    - Find overlapping students (students that appear in both batches)
 *    - Calculate the offset by comparing their positions in both batches
 *    - Apply the offset to all non-overlapping students in the new batch
 * 3. Merge all positions, keeping only one entry per attendee
 * 
 * Example with 25 students:
 * - Batch 1: Students 1-10 → Positions as-is
 * - Batch 2: Students 8-17 → Compare positions of students 8,9,10 to calculate offset
 * - Batch 3: Students 15-24 → Compare positions of students 15,16,17 to calculate offset
 */
function alignBatchesUsingOverlap(
  batchResults: Array<{ positions: SeatingPosition[]; notes: string }>,
  batches: Array<Array<{ attendeeId: string; url: string }>>,
  context: InvocationContext
): SeatingPosition[] {
  if (batchResults.length === 1) {
    // Single batch, no alignment needed
    return batchResults[0].positions;
  }
  
  // Start with first batch as reference frame
  const alignedPositions = new Map<string, SeatingPosition>();
  
  // Add all positions from first batch
  for (const position of batchResults[0].positions) {
    alignedPositions.set(position.attendeeId, position);
  }
  
  context.log(`Batch 1: Added ${batchResults[0].positions.length} positions as reference frame`);
  
  // Process each subsequent batch
  for (let batchIndex = 1; batchIndex < batchResults.length; batchIndex++) {
    const currentBatch = batchResults[batchIndex];
    const currentBatchStudents = batches[batchIndex].map(img => img.attendeeId);
    const batchNum = batchIndex + 1;
    
    // Find overlapping students (students already in alignedPositions)
    const overlapStudents = currentBatch.positions.filter(pos => 
      alignedPositions.has(pos.attendeeId)
    );
    
    if (overlapStudents.length === 0) {
      context.warn(`Batch ${batchNum}: No overlapping students found! Using simple stacking.`);
      // Fallback: stack vertically
      const maxRow = Math.max(...Array.from(alignedPositions.values()).map(p => p.estimatedRow));
      for (const position of currentBatch.positions) {
        if (!alignedPositions.has(position.attendeeId)) {
          alignedPositions.set(position.attendeeId, {
            ...position,
            estimatedRow: position.estimatedRow + maxRow,
            reasoning: `${position.reasoning} [Batch ${batchNum}, fallback stacking]`
          });
        }
      }
      continue;
    }
    
    context.log(`Batch ${batchNum}: Found ${overlapStudents.length} overlapping students: ${overlapStudents.map(s => s.attendeeId).join(', ')}`);
    
    // Calculate offset by comparing overlapping students' positions
    let totalRowOffset = 0;
    let totalColOffset = 0;
    let validComparisons = 0;
    
    for (const overlapStudent of overlapStudents) {
      const referencePos = alignedPositions.get(overlapStudent.attendeeId)!;
      const currentPos = overlapStudent;
      
      const rowDiff = referencePos.estimatedRow - currentPos.estimatedRow;
      const colDiff = referencePos.estimatedColumn - currentPos.estimatedColumn;
      
      context.log(`  ${overlapStudent.attendeeId}: Reference (${referencePos.estimatedRow},${referencePos.estimatedColumn}) vs Current (${currentPos.estimatedRow},${currentPos.estimatedColumn}) → Offset (${rowDiff},${colDiff})`);
      
      totalRowOffset += rowDiff;
      totalColOffset += colDiff;
      validComparisons++;
    }
    
    // Calculate average offset
    const avgRowOffset = Math.round(totalRowOffset / validComparisons);
    const avgColOffset = Math.round(totalColOffset / validComparisons);
    
    context.log(`Batch ${batchNum}: Calculated offset: Row ${avgRowOffset >= 0 ? '+' : ''}${avgRowOffset}, Column ${avgColOffset >= 0 ? '+' : ''}${avgColOffset}`);
    
    // Apply offset to all non-overlapping students in this batch
    let addedCount = 0;
    for (const position of currentBatch.positions) {
      if (!alignedPositions.has(position.attendeeId)) {
        alignedPositions.set(position.attendeeId, {
          ...position,
          estimatedRow: position.estimatedRow + avgRowOffset,
          estimatedColumn: position.estimatedColumn + avgColOffset,
          reasoning: `${position.reasoning} [Batch ${batchNum}, offset (${avgRowOffset},${avgColOffset})]`
        });
        addedCount++;
      }
    }
    
    context.log(`Batch ${batchNum}: Added ${addedCount} new students (${overlapStudents.length} overlapping students skipped)`);
  }
  
  const finalPositions = Array.from(alignedPositions.values());
  
  // Validate the final seating plan
  const positionMap = new Map<string, string>();
  const conflicts: string[] = [];
  
  for (const pos of finalPositions) {
    const key = `${pos.estimatedRow},${pos.estimatedColumn}`;
    if (positionMap.has(key)) {
      conflicts.push(`Position (${pos.estimatedRow}, ${pos.estimatedColumn}) assigned to both ${positionMap.get(key)} and ${pos.attendeeId}`);
    } else {
      positionMap.set(key, pos.attendeeId);
    }
  }
  
  if (conflicts.length > 0) {
    context.warn(`Position conflicts detected after alignment:`);
    conflicts.forEach(c => context.warn(`  - ${c}`));
  } else {
    context.log(`✓ No position conflicts - all ${finalPositions.length} students have unique positions`);
  }
  
  // Log the final seating grid dimensions
  const finalMaxRow = Math.max(...finalPositions.map(p => p.estimatedRow));
  const finalMinRow = Math.min(...finalPositions.map(p => p.estimatedRow));
  const finalMaxCol = Math.max(...finalPositions.map(p => p.estimatedColumn));
  const finalMinCol = Math.min(...finalPositions.map(p => p.estimatedColumn));
  context.log(`Final seating grid: Rows ${finalMinRow}-${finalMaxRow}, Columns ${finalMinCol}-${finalMaxCol}`);
  
  return finalPositions;
}
