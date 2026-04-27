import Instructor from "@instructor-ai/instructor";
import OpenAI from "openai";
import { createLLMClient } from "llm-polyglot";

// OPENAI_API_KEY is required — extraction cannot function without it.
// Fail fast at module load time so the error is obvious (not a 401 mid-job).
const openaiApiKey = process.env.OPENAI_API_KEY;
if (!openaiApiKey) {
  throw new Error("OPENAI_API_KEY environment variable is not set");
}

// ANTHROPIC_API_KEY is optional — used only in fallback path if anthropicInstructor is non-null.
const anthropicApiKey = process.env.ANTHROPIC_API_KEY;

// OpenAI instructor — primary extraction model (GPT-4o-mini)
// mode: "TOOLS" is preferred for GPT-4o-mini; provides richer structured output than FUNCTIONS mode.
const oai = new OpenAI({ apiKey: openaiApiKey });

export const openAIInstructor = Instructor({
  client: oai,
  mode: "TOOLS",
});

// Anthropic instructor — optional fallback (Claude 3.5 Sonnet)
// llm-polyglot adapts the Anthropic SDK interface to OpenAI-compatible interface required by instructor.
// Returns null if ANTHROPIC_API_KEY is not set — callers must null-check before use.
export const anthropicInstructor = anthropicApiKey
  ? Instructor<ReturnType<typeof createLLMClient>>({
      client: createLLMClient({ provider: "anthropic", apiKey: anthropicApiKey }),
      mode: "TOOLS",
    })
  : null;
