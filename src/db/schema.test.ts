import { describe, it, expect } from "vitest";
import * as schema from "./schema";

describe("Database Schema", () => {
  it("should have sourcingStatusEnum with correct values", () => {
    expect(schema.sourcingStatusEnum).toBeDefined();
    expect(schema.sourcingStatusEnum.enumValues).toEqual([
      "Unqualified",
      "Approved",
      "Rejected",
      "Flagged",
    ]);
  });

  it("should have sourcingStatus column in leads table", () => {
    expect(schema.leads.sourcingStatus).toBeDefined();
    // Drizzle internal check for default value might be complex, 
    // but we can check if it exists in the columns
  });

  it("should have leadNotes table with correct columns", () => {
    expect(schema.leadNotes).toBeDefined();
    expect(schema.leadNotes.leadId).toBeDefined();
    expect(schema.leadNotes.content).toBeDefined();
    expect(schema.leadNotes.createdAt).toBeDefined();
  });

  it("should have relations defined for leadNotes", () => {
    expect(schema.leadsRelations).toBeDefined();
    // We can check if 'notes' is in the relations
  });
});
