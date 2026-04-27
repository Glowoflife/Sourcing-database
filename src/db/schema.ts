import { integer, pgEnum, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";

export const leadStatusEnum = pgEnum("lead_status", [
  "New",
  "Processing",
  "Crawled",
  "Errored",
]);

export const leads = pgTable("leads", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  url: text("url").unique(),
  status: leadStatusEnum("status").notNull().default("New"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow().$onUpdateFn(() => new Date()),
});

export const scraperRuns = pgTable("scraper_runs", {
  id: serial("id").primaryKey(),
  startedAt: timestamp("started_at").notNull().defaultNow(),
  finishedAt: timestamp("finished_at"),
  leadsFound: integer("leads_found").notNull().default(0),
  leadsWritten: integer("leads_written").notNull().default(0),
  leadsSkipped: integer("leads_skipped").notNull().default(0),
  leadsErrored: integer("leads_errored").notNull().default(0),
});

export type ScraperRun = typeof scraperRuns.$inferSelect;
export type NewScraperRun = typeof scraperRuns.$inferInsert;

export type Lead = typeof leads.$inferSelect;
export type NewLead = typeof leads.$inferInsert;
export type LeadStatus = (typeof leadStatusEnum.enumValues)[number];
// LeadStatus = "New" | "Processing" | "Crawled" | "Errored"
