import { doublePrecision, integer, pgEnum, pgTable, serial, text, timestamp, unique } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const leadStatusEnum = pgEnum("lead_status", [
  "New",
  "Processing",
  "Crawled",
  "Extracted",   // Phase 4 — AI extraction complete
  "Errored",
]);

export const sourcingStatusEnum = pgEnum("sourcing_status", [
  "Unqualified",
  "Approved",
  "Rejected",
  "Flagged",
]);

export const leads = pgTable("leads", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  url: text("url").notNull().unique(),
  status: leadStatusEnum("status").notNull().default("New"),
  sourcingStatus: sourcingStatusEnum("sourcing_status").notNull().default("Unqualified"),
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
// LeadStatus = "New" | "Processing" | "Crawled" | "Extracted" | "Errored"

// Phase 3: manufacturer_pages table (D-08)
// page_type enum — values per Claude's discretion (CONTEXT.md)
export const pageTypeEnum = pgEnum("page_type", [
  "homepage",
  "products",
  "about",
  "other",
]);

export const manufacturerPages = pgTable("manufacturer_pages", {
  id: serial("id").primaryKey(),
  leadId: integer("lead_id")
    .notNull()
    .references(() => leads.id),
  url: text("url").notNull(),
  pageType: pageTypeEnum("page_type").notNull(),
  markdownContent: text("markdown_content").notNull(),
  crawledAt: timestamp("crawled_at").notNull().defaultNow(),
}, (t) => [unique().on(t.leadId, t.url)]);

export type ManufacturerPage = typeof manufacturerPages.$inferSelect;
export type NewManufacturerPage = typeof manufacturerPages.$inferInsert;
export type PageType = (typeof pageTypeEnum.enumValues)[number];
// PageType = "homepage" | "products" | "about" | "other"

// Phase 4: AI extraction profile tables
// manufacturer_profiles: one row per manufacturer (keyed by lead_id, unique constraint)
export const manufacturerProfiles = pgTable("manufacturer_profiles", {
  id: serial("id").primaryKey(),
  leadId: integer("lead_id").notNull().unique().references(() => leads.id),
  industriesServed: text("industries_served").array().notNull().default(sql`'{}'::text[]`),
  capacityMtPerYear: doublePrecision("capacity_mt_per_year"),
  capacityRawText: text("capacity_raw_text"),
  extractedAt: timestamp("extracted_at").notNull().defaultNow(),
});

// products: one row per chemical product extracted for a manufacturer
export const products = pgTable("products", {
  id: serial("id").primaryKey(),
  profileId: integer("profile_id").notNull().references(() => manufacturerProfiles.id),
  name: text("name").notNull(),
  casNumber: text("cas_number"), // CAS format: \d{2,7}-\d{2}-\d — validated at Zod layer
  grade: text("grade"),
});

// contacts: one row per contact detail (email, phone, whatsapp) extracted for a manufacturer
export const contacts = pgTable("contacts", {
  id: serial("id").primaryKey(),
  profileId: integer("profile_id").notNull().references(() => manufacturerProfiles.id),
  type: text("type").notNull(), // "email" | "phone" | "whatsapp"
  value: text("value").notNull(),
});

// locations: one row per plant/office location extracted for a manufacturer
export const locations = pgTable("locations", {
  id: serial("id").primaryKey(),
  profileId: integer("profile_id").notNull().references(() => manufacturerProfiles.id),
  address: text("address"),
  city: text("city"),
  state: text("state"),
  country: text("country").notNull().default("India"),
});

export type ManufacturerProfile = typeof manufacturerProfiles.$inferSelect;
export type NewManufacturerProfile = typeof manufacturerProfiles.$inferInsert;
export type Product = typeof products.$inferSelect;
export type NewProduct = typeof products.$inferInsert;
export type Contact = typeof contacts.$inferSelect;
export type NewContact = typeof contacts.$inferInsert;
export type Location = typeof locations.$inferSelect;
export type NewLocation = typeof locations.$inferInsert;

// Phase 6: Sourcing notes
export const leadNotes = pgTable("lead_notes", {
  id: serial("id").primaryKey(),
  leadId: integer("lead_id")
    .notNull()
    .references(() => leads.id),
  content: text("content").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type LeadNote = typeof leadNotes.$inferSelect;
export type NewLeadNote = typeof leadNotes.$inferInsert;

// Relations
import { relations } from "drizzle-orm";

export const leadsRelations = relations(leads, ({ one, many }) => ({
  manufacturerProfiles: one(manufacturerProfiles, {
    fields: [leads.id],
    references: [manufacturerProfiles.leadId],
  }),
  manufacturerPages: many(manufacturerPages),
  notes: many(leadNotes),
}));

export const leadNotesRelations = relations(leadNotes, ({ one }) => ({
  lead: one(leads, {
    fields: [leadNotes.leadId],
    references: [leads.id],
  }),
}));

export const manufacturerProfilesRelations = relations(manufacturerProfiles, ({ one, many }) => ({
  lead: one(leads, {
    fields: [manufacturerProfiles.leadId],
    references: [leads.id],
  }),
  products: many(products),
  contacts: many(contacts),
  locations: many(locations),
}));

export const productsRelations = relations(products, ({ one }) => ({
  profile: one(manufacturerProfiles, {
    fields: [products.profileId],
    references: [manufacturerProfiles.id],
  }),
}));

export const contactsRelations = relations(contacts, ({ one }) => ({
  profile: one(manufacturerProfiles, {
    fields: [contacts.profileId],
    references: [manufacturerProfiles.id],
  }),
}));

export const locationsRelations = relations(locations, ({ one }) => ({
  profile: one(manufacturerProfiles, {
    fields: [locations.profileId],
    references: [manufacturerProfiles.id],
  }),
}));

export const manufacturerPagesRelations = relations(manufacturerPages, ({ one }) => ({
  lead: one(leads, {
    fields: [manufacturerPages.leadId],
    references: [leads.id],
  }),
}));
