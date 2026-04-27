import { z } from "zod";

export const ExtractedMemberSchema = z.object({
  name: z.string().min(1, "name is required"),
  url: z.string().url("url must be a valid URL").nullable(),
});

export type ExtractedMember = z.infer<typeof ExtractedMemberSchema>;
