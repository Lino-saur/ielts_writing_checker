import { NextResponse } from "next/server";
import { findAdminUserBySessionIdentity } from "@/lib/admin/users";
import { requireSession } from "@/lib/auth-session";
import { getAssignmentImageForUser } from "@/lib/writing-assignments";

type RouteContext = {
  params: Promise<{
    assignmentId: string;
  }>;
};

export async function GET(_: Request, context: RouteContext) {
  try {
    const session = await requireSession();
    const { assignmentId } = await context.params;
    const adminUser = await findAdminUserBySessionIdentity({
      authUserId: session.user.id,
      email: session.user.email
    });
    const image = await getAssignmentImageForUser({
      userId: session.user.id,
      assignmentId,
      allowAdmin: adminUser?.status === "active"
    });

    if (!image) {
      return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
    }

    return new NextResponse(image.response.body, {
      status: 200,
      headers: {
        "Content-Type": image.mimeType,
        "Cache-Control": "private, max-age=300"
      }
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error.";
    const status = message === "UNAUTHORIZED" ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
