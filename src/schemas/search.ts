import { z } from "zod";

export const manufacturerSearchSchema = z.object({
  q: z.string().optional(),
  industry: z.array(z.string()).optional(),
  status: z.array(z.string()).optional(),
  location: z.array(z.string()).optional(),
  capacity: z.array(z.string()).optional(),
  page: z.number().int().min(1).default(1),
  limit: z.number().int().min(1).max(100).default(50),
});

export type ManufacturerSearchParams = z.infer<typeof manufacturerSearchSchema>;
