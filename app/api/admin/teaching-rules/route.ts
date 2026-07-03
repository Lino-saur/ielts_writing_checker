import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/admin/auth";
import {
  archiveTeachingRule,
  createTeachingRule,
  listTeachingRules,
  normalizeTeachingRuleFilters,
  publishTeachingRule,
  updateTeachingRule,
  type TeachingRuleInput
} from "@/lib/admin/teaching-rules";
import { apiErrorResponse, readJsonBody } from "@/lib/api-security";

type MutationBody = TeachingRuleInput & {
  id?: unknown;
  action?: unknown;
};

function errorResponse(error: unknown) {
  if (error instanceof Error && error.message === "FORBIDDEN") {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }
  const apiError = apiErrorResponse(error);
  return NextResponse.json({ error: apiError.message }, { status: apiError.status });
}

export async function GET(request: Request) {
  try {
    await requireAdminSession();
    const { searchParams } = new URL(request.url);
    return NextResponse.json(
      await listTeachingRules(
        normalizeTeachingRuleFilters({
          q: searchParams.get("q"),
          taskType: searchParams.get("taskType"),
          origin: searchParams.get("origin"),
          category: searchParams.get("category"),
          status: searchParams.get("status"),
          page: searchParams.get("page")
        })
      )
    );
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    await requireAdminSession();
    const body = await readJsonBody<MutationBody>(request, 64 * 1024);
    return NextResponse.json({ rule: await createTeachingRule(body) }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PATCH(request: Request) {
  try {
    await requireAdminSession();
    const body = await readJsonBody<MutationBody>(request, 64 * 1024);
    if (body.action === "publish") {
      return NextResponse.json({ rule: await publishTeachingRule(body.id) });
    }
    if (body.action === "archive") {
      return NextResponse.json({ rule: await archiveTeachingRule(body.id) });
    }
    return NextResponse.json({ rule: await updateTeachingRule(body.id, body) });
  } catch (error) {
    return errorResponse(error);
  }
}
