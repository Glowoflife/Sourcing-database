import { createLeadNote } from "@/lib/queries/manufacturers";
import { z } from "zod";
import { logger } from "@/lib/logger";

const noteSchema = z.object({
  content: z.string().min(1, "Note content cannot be empty"),
});

export async function POST(
  request: Request,
  { params }: { params: { leadId: string } }
) {
  try {
    const leadId = parseInt(params.leadId);
    if (isNaN(leadId)) {
      return Response.json({ error: "Invalid lead ID" }, { status: 400 });
    }

    const body = await request.json();
    const result = noteSchema.safeParse(body);

    if (!result.success) {
      return Response.json(
        { error: "Invalid note content", details: result.error.format() },
        { status: 400 }
      );
    }

    const [newNote] = await createLeadNote(leadId, result.data.content);

    return Response.json(newNote, { status: 201 });
  } catch (error) {
    logger.error({ 
      stage: "api-create-note", 
      status: "fail", 
      leadId: params.leadId,
      message: String(error) 
    });
    return Response.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
