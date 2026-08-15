import { defineTool } from "@lovable.dev/mcp-js";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "list_students",
  title: "List students",
  description:
    "List the drama-school students visible to the signed-in user (all students for an admin, own children for a parent), sorted by first name.",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async (_input, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    }
    const supabase = supabaseForUser(ctx);
    const { data, error } = await supabase
      .from("students")
      .select("id, name, last_name, class_name, status, is_sibling, parent_name, parent_phone")
      .order("name", { ascending: true });

    if (error) {
      return { content: [{ type: "text", text: error.message }], isError: true };
    }
    return {
      content: [{ type: "text", text: JSON.stringify(data ?? []) }],
      structuredContent: { students: data ?? [] },
    };
  },
});
