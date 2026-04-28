import type { ManufacturerPage } from "@/db/schema";
import { buildPrompt } from "@/extraction/build-prompt";
import { anthropicClient, deepSeekClient, openAIInstructor } from "@/extraction/instructor-client";
import { logger } from "@/lib/logger";
import {
  ManufacturerExtractionSchema,
  type ManufacturerExtraction,
} from "@/schemas/extraction";
import type { Message, MessageCreateParamsNonStreaming, Tool } from "@anthropic-ai/sdk/resources/messages/messages";
import { z } from "zod";

// System prompt instructs the model on role, output format, and unit normalization.
// Unit normalization rules are repeated in the schema .describe() fields for redundancy.
const EXTRACTION_SYSTEM_PROMPT = `You are a chemical industry data extraction specialist. Your task is to extract structured technical information from manufacturer website content.

Extract ALL of the following from the provided website pages:
1. Products: Every chemical product, product line, or chemical name mentioned. Include CAS Registry Numbers when present (format: XXXXXXX-XX-X). If CAS number is not found for a product, set cas_number to null.
2. Contacts: All email addresses, phone numbers, and WhatsApp numbers found across ALL pages.
3. Locations: All manufacturing plant addresses, factory locations, and office addresses.
4. Production Capacity: Normalize to Metric Tons per year (MT/year) using these exact conversions:
   - MT/month × 12 = MT/year
   - KG/year ÷ 1000 = MT/year
   - Ton/year = MT/year (metric ton = tonne)
   - 1 lakh = 100,000 (Indian numeric system)
   - 1 crore = 10,000,000 (Indian numeric system)
   - For KL/year or other volumetric units without density data: set value_mt_per_year to null, preserve raw_text
   - If no capacity information found: set both fields to null
5. Industries Served: Map the manufacturer's industry focus to the standardized taxonomy provided. Use ONLY tags from the schema. Map similar terms (e.g., "pharmaceutical" -> "Pharma", "pesticides" -> "Agrochemicals", "plastics" -> "Polymers & Plastics"). If an industry does not match any tag, use "Other".

Rules:
- Extract from ALL provided pages, not just the first
- Return empty arrays [] for products, contacts, locations, or industries_served if genuinely none found
- Never fabricate data - only extract what is explicitly present in the content
- Preserve raw contact values exactly as found on the page`;

export { EXTRACTION_SYSTEM_PROMPT };

const OPENAI_MODEL = "gpt-4o-mini";
const DEEPSEEK_MODEL = process.env.DEEPSEEK_MODEL ?? "deepseek-v4-flash";
const ANTHROPIC_HAIKU_MODEL = "claude-haiku-4-5-20251001";
const ANTHROPIC_MAX_TOKENS = 4096;
const ANTHROPIC_MAX_ATTEMPTS = 3;
const DEEPSEEK_MAX_ATTEMPTS = 3;
const TOOL_NAME = "submit_manufacturer_profile";
const TOOL_DESCRIPTION = "Submit the extracted manufacturer profile as structured data.";
const ANTHROPIC_TOOL_SCHEMA = z.toJSONSchema(ManufacturerExtractionSchema) as Tool.InputSchema;
// JSON Schema for OpenAI-compatible function tools (DeepSeek + OpenAI).
// `as Record<string, unknown>` keeps it loose — the SDK's `parameters` field accepts any JSON Schema.
const OPENAI_TOOL_SCHEMA = z.toJSONSchema(ManufacturerExtractionSchema) as Record<string, unknown>;

function summarizeZodIssues(error: z.ZodError): string {
  return error.issues
    .slice(0, 8)
    .map((issue) => {
      const path = issue.path.length > 0 ? issue.path.join(".") : "root";
      return `${path}: ${issue.message}`;
    })
    .join("; ");
}

function getAnthropicToolInput(
  response: Message,
): unknown | null {
  for (const block of response.content) {
    if (block.type === "tool_use") {
      return block.input;
    }
  }
  return null;
}

function getAnthropicText(
  response: Message,
): string {
  return response.content.reduce(
    (text, block) => (block.type === "text" ? `${text}${block.text}` : text),
    "",
  ).trim();
}

async function extractWithAnthropic(content: string, leadId: number): Promise<ManufacturerExtraction> {
  if (!anthropicClient) {
    throw new Error("Anthropic client is not configured");
  }

  let validationFeedback: string | null = null;
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= ANTHROPIC_MAX_ATTEMPTS; attempt += 1) {
    const request: MessageCreateParamsNonStreaming = {
      model: ANTHROPIC_HAIKU_MODEL,
      max_tokens: ANTHROPIC_MAX_TOKENS,
      temperature: 0,
      system: `${EXTRACTION_SYSTEM_PROMPT}

Return the final result by calling the ${TOOL_NAME} tool exactly once.
Do not reply with prose, markdown, or partial JSON outside the tool call.`,
      messages: [
        {
          role: "user",
          content: validationFeedback
            ? `${content}

Previous attempt failed schema validation with these errors:
${validationFeedback}

Correct the payload and call the tool again.`
            : content,
        },
      ],
      tools: [
        {
          name: TOOL_NAME,
          description: TOOL_DESCRIPTION,
          input_schema: ANTHROPIC_TOOL_SCHEMA,
        },
      ],
      tool_choice: {
        type: "tool",
        name: TOOL_NAME,
      },
    };

    const response = await anthropicClient.messages.create(request);

    const toolInput = getAnthropicToolInput(response);
    if (toolInput === null) {
      const text = getAnthropicText(response);
      lastError = new Error(
        text.length > 0
          ? `Anthropic response did not include ${TOOL_NAME}: ${text.slice(0, 500)}`
          : `Anthropic response did not include ${TOOL_NAME}`,
      );
      continue;
    }

    const parsed = ManufacturerExtractionSchema.safeParse(toolInput);
    if (parsed.success) {
      return parsed.data;
    }

    validationFeedback = summarizeZodIssues(parsed.error);
    lastError = new Error(
      `Anthropic extraction payload failed validation on attempt ${attempt}: ${validationFeedback}`,
    );
    logger.warn({
      stage: "extract",
      status: "fail",
      leadId,
      message: lastError.message,
    });
  }

  throw lastError ?? new Error("Anthropic extraction failed without a response");
}

async function extractWithDeepSeek(content: string, leadId: number): Promise<ManufacturerExtraction> {
  if (!deepSeekClient) {
    throw new Error("DeepSeek client is not configured");
  }

  let validationFeedback: string | null = null;
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= DEEPSEEK_MAX_ATTEMPTS; attempt += 1) {
    const userMessage = validationFeedback
      ? `${content}

Previous attempt failed schema validation with these errors:
${validationFeedback}

Correct the payload and call the tool again.`
      : content;

    const response = await deepSeekClient.chat.completions.create({
      model: DEEPSEEK_MODEL,
      temperature: 0,
      messages: [
        {
          role: "system",
          content: `${EXTRACTION_SYSTEM_PROMPT}

Return the final result by calling the ${TOOL_NAME} tool exactly once.
Do not reply with prose, markdown, or partial JSON outside the tool call.`,
        },
        { role: "user", content: userMessage },
      ],
      tools: [
        {
          type: "function",
          function: {
            name: TOOL_NAME,
            description: TOOL_DESCRIPTION,
            parameters: OPENAI_TOOL_SCHEMA,
          },
        },
      ],
      // "auto" works across DeepSeek's full lineup (chat, reasoner, v4-*).
      // Forced tool_choice is rejected by deepseek-reasoner.
      // The system prompt and retry loop ensure we still get a tool call.
      tool_choice: "auto",
    });

    const toolCall = response.choices[0]?.message?.tool_calls?.[0];
    if (!toolCall || toolCall.type !== "function") {
      const text = response.choices[0]?.message?.content?.trim() ?? "";
      lastError = new Error(
        text.length > 0
          ? `DeepSeek response did not include ${TOOL_NAME}: ${text.slice(0, 500)}`
          : `DeepSeek response did not include ${TOOL_NAME}`,
      );
      continue;
    }

    let toolInput: unknown;
    try {
      toolInput = JSON.parse(toolCall.function.arguments);
    } catch (parseErr) {
      lastError = new Error(
        `DeepSeek returned non-JSON tool arguments: ${String(parseErr)}`,
      );
      continue;
    }

    const parsed = ManufacturerExtractionSchema.safeParse(toolInput);
    if (parsed.success) {
      return parsed.data;
    }

    validationFeedback = summarizeZodIssues(parsed.error);
    lastError = new Error(
      `DeepSeek extraction payload failed validation on attempt ${attempt}: ${validationFeedback}`,
    );
    logger.warn({
      stage: "extract",
      status: "fail",
      leadId,
      message: lastError.message,
    });
  }

  throw lastError ?? new Error("DeepSeek extraction failed without a response");
}

export async function extractProfile(
  leadId: number,
  pages: ManufacturerPage[],
): Promise<ManufacturerExtraction> {
  const { content, droppedChars } = buildPrompt(pages);

  if (droppedChars > 0) {
    logger.warn({
      stage: "extract",
      status: "skip",
      leadId,
      message: `Truncated ${droppedChars} chars to fit context window (${pages.length} pages)`,
    });
  }

  try {
    // Provider order: DeepSeek (primary) → Anthropic → OpenAI.
    // Each independently configurable via env vars; the first available wins.
    if (deepSeekClient) {
      return await extractWithDeepSeek(content, leadId);
    }

    if (anthropicClient) {
      return await extractWithAnthropic(content, leadId);
    }

    if (!openAIInstructor) {
      throw new Error("No configured extraction provider is available");
    }

    return await openAIInstructor.chat.completions.create({
      model: OPENAI_MODEL,
      messages: [
        { role: "system", content: EXTRACTION_SYSTEM_PROMPT },
        { role: "user", content },
      ],
      response_model: {
        schema: ManufacturerExtractionSchema,
        name: "ManufacturerProfile",
      },
      max_retries: 2,
      temperature: 0,
    });
  } catch (err) {
    // instructor-js throws ZodError[] (a plain array, not an Error subclass) when max_retries are
    // exhausted and the response still fails Zod validation.
    // Re-throw as a plain Error so callers (and BullMQ) get a proper .message string.
    const message = Array.isArray(err)
      ? (err as { message: string }[]).map((e) => e.message).join("; ")
      : String(err);
    throw new Error(`LLM extraction failed for leadId=${leadId}: ${message}`);
  }
}
