import { NextResponse } from "next/server";
import { requireAdminRole } from "@/lib/admin/auth";
import { recordAdminAudit } from "@/lib/admin/audit";
import { readJsonBody } from "@/lib/api-security";
import { replyToSupportInboxEntry } from "@/lib/support-inbox";

export async function POST(request: Request) {
  try {
    const { adminUser } = await requireAdminRole(["support"]);
    const body = await readJsonBody<{
      entryId?: string;
      message?: string;
    }>(request, 64 * 1024);

    const entryId = body.entryId?.trim();
    const message = body.message?.trim();

    if (!entryId || !message) {
      return NextResponse.json({ error: "INVALID_INPUT" }, { status: 400 });
    }

    const result = await replyToSupportInboxEntry({
      entryId,
      adminUserId: adminUser.id,
      message
    });
    await recordAdminAudit({
      adminUserId: adminUser.id,
      action: "support.reply",
      targetType: "support_inbox_entry",
      targetId: entryId,
      detail: { messageLength: message.length }
    });

    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error.";
    const status =
      message === "UNAUTHORIZED"
        ? 401
        : message === "FORBIDDEN"
          ? 403
          : message === "INVALID_INPUT" || message === "SUPPORT_REPLY_EMPTY"
            ? 400
            : message === "SUPPORT_ENTRY_NOT_FOUND"
              ? 404
              : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
