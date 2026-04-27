import { z } from "zod";

export const ImportRowSchema = z.object({
  name: z.string().min(1, "name is required"),
  url: z.string().url("url must be a valid URL"),
});

export type ImportRow = z.infer<typeof ImportRowSchema>;
