import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "list_attendance",
  title: "List attendance records",
  description:
    "List class attendance records visible to the signed-in user, newest first. Optionally filter by student id.",
  inputSchema: {
    student_id: z.string().uuid().optional().describe("Only return attendance for this student id."),
    limit: z.number().int().min(1).max(200).optional().describe("Maximum rows to return (default 50)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ student_id, limit }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    }
    const supabase = supabaseForUser(ctx);
    let query = supabase
      .from("attendance")
      .select("id, student_id, status, created_at, sessions(session_date, class_name, is_trial)")
      .order("created_at", { ascending: false })
      .limit(limit ?? 50);
    if (student_id) query = query.eq("student_id", student_id);

    const { data, error } = await query;
    if (error) {
      return { content: [{ type: "text", text: error.message }], isError: true };
    }
    return {
      content: [{ type: "text", text: JSON.stringify(data ?? []) }],
      structuredContent: { attendance: data ?? [] },
    };
  },
});
