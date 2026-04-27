import { updateLeadSourcingStatus } from "@/lib/queries/manufacturers";
import { z } from "zod";
import { logger } from "@/lib/logger";

const statusSchema = z.object({
  status: z.enum(["Unqualified", "Approved", "Rejected", "Flagged"]),
});

export async function PUT(
  request: Request,
  { params }: { params: { leadId: string } }
) {
  try {
    const leadId = parseInt(params.leadId);
    if (isNaN(leadId)) {
      return Response.json({ error: "Invalid lead ID" }, { status: 400 });
    }

    const body = await request.json();
    const result = statusSchema.safeParse(body);

    if (!result.success) {
      return Response.json(
        { error: "Invalid status", details: result.error.format() },
        { status: 400 }
      );
    }

    await updateLeadSourcingStatus(leadId, result.data.status);

    return Response.json({ success: true });
  } catch (error) {
    logger.error({ 
      stage: "api-update-sourcing-status", 
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
