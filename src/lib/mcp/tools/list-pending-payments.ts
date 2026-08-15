import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "list_pending_payments",
  title: "List pending payment requests",
  description:
    "List payment requests (debts and payments awaiting admin approval) visible to the signed-in user. Optionally filter by status.",
  inputSchema: {
    status: z
      .enum(["pending", "approved", "rejected"])
      .optional()
      .describe("Only return requests with this status."),
    limit: z.number().int().min(1).max(200).optional().describe("Maximum rows to return (default 50)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ status, limit }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    }
    const supabase = supabaseForUser(ctx);
    let query = supabase
      .from("pending_payments")
      .select(
        "id, student_id, payment_type, payment_method, amount, status, subscription_frequency, created_at, resolved_at",
      )
      .order("created_at", { ascending: false })
      .limit(limit ?? 50);
    if (status) query = query.eq("status", status);

    const { data, error } = await query;
    if (error) {
      return { content: [{ type: "text", text: error.message }], isError: true };
    }
    return {
      content: [{ type: "text", text: JSON.stringify(data ?? []) }],
      structuredContent: { pending_payments: data ?? [] },
    };
  },
});
