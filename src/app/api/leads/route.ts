import { db } from "@/db";
import { leads } from "@/db/schema";
import { desc } from "drizzle-orm";
import { logger } from "@/lib/logger";

export async function GET() {
  try {
    const rows = await db
      .select()
      .from(leads)
      .orderBy(desc(leads.createdAt));
    return Response.json(rows);
  } catch (err) {
    logger.error({ stage: "leads-list", status: "fail", message: String(err) });
    return Response.json({ error: "Failed to fetch leads." }, { status: 500 });
  }
}
