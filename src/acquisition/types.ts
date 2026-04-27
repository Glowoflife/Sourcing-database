import { z } from "zod";

export const AcquisitionJobSchema = z.object({
  leadId: z.number().int().positive(),
  url: z.string().url("url must be a valid URL"),
});

export type AcquisitionJob = z.infer<typeof AcquisitionJobSchema>;

export const CrawledPageSchema = z.object({
  url: z.string().url(),
  pageType: z.enum(["homepage", "products", "about", "other"]),
  markdown: z.string(),
});

export type CrawledPage = z.infer<typeof CrawledPageSchema>;
