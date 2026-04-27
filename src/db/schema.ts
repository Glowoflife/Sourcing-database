import { pgEnum, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";

export const leadStatusEnum = pgEnum("lead_status", [
  "New",
  "Processing",
  "Crawled",
  "Errored",
]);

export const leads = pgTable("leads", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  url: text("url").notNull().unique(),
  status: leadStatusEnum("status").notNull().default("New"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export type Lead = typeof leads.$inferSelect;
export type NewLead = typeof leads.$inferInsert;
export type LeadStatus = (typeof leadStatusEnum.enumValues)[number];
// LeadStatus = "New" | "Processing" | "Crawled" | "Errored"
