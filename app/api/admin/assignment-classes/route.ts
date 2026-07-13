import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/admin/auth";
import { createWritingClass, listWritingClasses } from "@/lib/writing-assignments";

export async function GET() {
  try {
    const { adminUser } = await requireAdminSession();
    const items = await listWritingClasses(adminUser.id);

    return NextResponse.json({ items });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error.";
    const status = message === "UNAUTHORIZED" ? 401 : message === "FORBIDDEN" ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function POST(request: Request) {
  try {
    const { adminUser } = await requireAdminSession();
    const body = (await request.json()) as Record<string, unknown>;
    const result = await createWritingClass({
      teacherAdminUserId: adminUser.id,
      name: body.name,
      studentIds: body.studentIds
    });

    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error.";
    const status =
      message === "UNAUTHORIZED"
        ? 401
        : message === "FORBIDDEN"
          ? 403
          : message.startsWith("INVALID_")
            ? 400
            : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
