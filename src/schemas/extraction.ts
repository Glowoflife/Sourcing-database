import { z } from "zod";

// BullMQ job payload — mirrors AcquisitionJobSchema in src/acquisition/types.ts
export const ExtractionJobSchema = z.object({
  leadId: z.number().int().positive(),
});

export type ExtractionJob = z.infer<typeof ExtractionJobSchema>;

// CAS Registry Number format: 2-7 digits, hyphen, 2 digits, hyphen, 1 check digit
// Source: https://www.cas.org/training/documentation/chemical-substances/checkdig
const CAS_REGEX = /^\d{2,7}-\d{2}-\d$/;

// Industries Served taxonomy — 14 tags covering Indian chemical industry segments
// "Other" is a required catch-all to prevent the LLM from inventing tags outside the set.
export const INDUSTRY_TAGS = [
  "Pharma",
  "Agrochemicals",
  "Polymers & Plastics",
  "Specialty Chemicals",
  "Dyes & Pigments",
  "Petrochemicals",
  "Paints & Coatings",
  "Food & Feed Additives",
  "Water Treatment",
  "Textile Chemicals",
  "Rubber & Elastomers",
  "Construction Chemicals",
  "Electronics & Semiconductors",
  "Other",
] as const;

export const ProductSchema = z.object({
  name: z.string().describe("Chemical or product name as listed on the manufacturer's site"),
  cas_number: z
    .string()
    .regex(CAS_REGEX)
    .nullable()
    .describe("CAS Registry Number in format XXXXXXX-XX-X. Return null if not found."),
  grade: z.string().nullable().describe("Product grade or purity specification, or null"),
});

export const ContactSchema = z.object({
  type: z.enum(["email", "phone", "whatsapp"]),
  value: z.string().describe("Raw contact value as found on the page"),
});

export const LocationSchema = z.object({
  address: z.string().nullable().describe("Full street address, or null if not found"),
  city: z.string().nullable(),
  state: z.string().nullable().describe("Indian state name"),
  country: z.string().default("India"),
});

export const CapacitySchema = z.object({
  value_mt_per_year: z
    .number()
    .nullable()
    .describe(
      "Production capacity normalized to Metric Tons per year. Apply these conversions: MT/month × 12 = MT/year; KG/year ÷ 1000 = MT/year; Ton/year = MT/year; 1 lakh = 100,000; 1 crore = 10,000,000. For KL/year or volumetric units without density, return null. Return null if not found.",
    ),
  raw_text: z
    .string()
    .nullable()
    .describe(
      "Original capacity text exactly as found on the page, e.g. '500 MT/month' or '1000 KL/year'. Return null if no capacity information found.",
    ),
});

export const ManufacturerExtractionSchema = z.object({
  products: z
    .array(ProductSchema)
    .describe("List of all chemical products and product lines found across all pages"),
  contacts: z
    .array(ContactSchema)
    .describe("All contact details found across all pages (emails, phones, WhatsApp numbers)"),
  locations: z
    .array(LocationSchema)
    .describe("All manufacturing plant or office locations found across all pages"),
  capacity: CapacitySchema.describe(
    "Production capacity information — normalize to MT/year using the conversion rules in value_mt_per_year description",
  ),
  industries_served: z
    .array(z.enum(INDUSTRY_TAGS))
    .describe(
      "Industries this manufacturer serves. Use ONLY tags from the provided list. Map similar terms (e.g. 'pharmaceutical' → 'Pharma', 'pesticides' → 'Agrochemicals'). If the industry does not fit any tag, use 'Other'.",
    ),
});

export type ManufacturerExtraction = z.infer<typeof ManufacturerExtractionSchema>;
