import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/admin/auth";
import {
  createAdminWritingAssignment,
  deleteAdminWritingAssignment,
  duplicateAdminWritingAssignment,
  listAdminWritingAssignments,
  updateAdminWritingAssignment,
  updateAdminWritingAssignmentStatus
} from "@/lib/writing-assignments";

export async function GET() {
  try {
    const { adminUser } = await requireAdminSession();
    const items = await listAdminWritingAssignments(adminUser.id);

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
    const result = await createAdminWritingAssignment({
      teacherAdminUserId: adminUser.id,
      title: body.title,
      taskType: body.taskType,
      prompt: body.prompt,
      instructions: body.instructions,
      dueAt: body.dueAt,
      lateDueAt: body.lateDueAt,
      allowLateSubmission: body.allowLateSubmission,
      allowResubmission: body.allowResubmission,
      studentIds: body.studentIds,
      taskImageObjectKey: body.taskImageObjectKey,
      taskImageName: body.taskImageName,
      taskImageMimeType: body.taskImageMimeType,
      taskImageSizeBytes: body.taskImageSizeBytes
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

export async function PATCH(request: Request) {
  try {
    const { adminUser } = await requireAdminSession();
    const body = (await request.json()) as Record<string, unknown>;
    const action = body.action;

    if (action === "set_status") {
      const result = await updateAdminWritingAssignmentStatus({
        adminUserId: adminUser.id,
        assignmentId: body.assignmentId,
        status: body.status
      });
      return NextResponse.json(result);
    }

    if (action === "update") {
      const result = await updateAdminWritingAssignment({
        adminUserId: adminUser.id,
        assignmentId: body.assignmentId,
        title: body.title,
        taskType: body.taskType,
        prompt: body.prompt,
        instructions: body.instructions,
        dueAt: body.dueAt,
        lateDueAt: body.lateDueAt,
        allowLateSubmission: body.allowLateSubmission,
        allowResubmission: body.allowResubmission,
        taskImageObjectKey: body.taskImageObjectKey,
        taskImageName: body.taskImageName,
        taskImageMimeType: body.taskImageMimeType,
        taskImageSizeBytes: body.taskImageSizeBytes
      });
      return NextResponse.json(result);
    }

    if (action === "duplicate") {
      const result = await duplicateAdminWritingAssignment({
        adminUserId: adminUser.id,
        assignmentId: body.assignmentId
      });
      return NextResponse.json(result);
    }

    if (action === "delete") {
      const result = await deleteAdminWritingAssignment({
        adminUserId: adminUser.id,
        assignmentId: body.assignmentId
      });
      return NextResponse.json(result);
    }

    return NextResponse.json({ error: "INVALID_ACTION" }, { status: 400 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error.";
    const status =
      message === "UNAUTHORIZED"
        ? 401
        : message === "FORBIDDEN"
          ? 403
          : message === "ASSIGNMENT_NOT_FOUND"
            ? 404
            : message === "ASSIGNMENT_NOT_DELETABLE"
              ? 409
            : message.startsWith("INVALID_")
              ? 400
              : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
