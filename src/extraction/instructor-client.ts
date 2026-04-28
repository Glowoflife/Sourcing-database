import Instructor from "@instructor-ai/instructor";
import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";

const openaiApiKey = process.env.OPENAI_API_KEY;
const anthropicApiKey = process.env.ANTHROPIC_API_KEY;
const deepseekApiKey = process.env.DEEPSEEK_API_KEY;
const deepseekBaseUrl = process.env.DEEPSEEK_BASE_URL ?? "https://api.deepseek.com";
if (!openaiApiKey && !anthropicApiKey && !deepseekApiKey) {
  throw new Error(
    "One of OPENAI_API_KEY, ANTHROPIC_API_KEY, or DEEPSEEK_API_KEY environment variables must be set",
  );
}

// OpenAI instructor — optional fallback when Anthropic is unavailable.
export const openAIInstructor = openaiApiKey
  ? Instructor({
      client: new OpenAI({ apiKey: openaiApiKey }),
      mode: "TOOLS",
    })
  : null;

// Native Anthropic client — Phase 4 uses direct tool calls plus local Zod validation
// to avoid instructor's retry/validation bug on the full extraction schema.
export const anthropicClient = anthropicApiKey
  ? new Anthropic({ apiKey: anthropicApiKey })
  : null;

// DeepSeek raw OpenAI client (NOT instructor-wrapped).
// DeepSeek's strict JSON-Schema validator rejected instructor's auto-converted schema
// (`type: null` for nullable fields). Phase 4 calls DeepSeek with direct tool calls
// and re-validates the response with Zod locally — same pattern used for Anthropic.
export const deepSeekClient = deepseekApiKey
  ? new OpenAI({ apiKey: deepseekApiKey, baseURL: deepseekBaseUrl })
  : null;
