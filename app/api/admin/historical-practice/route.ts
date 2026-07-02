import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/admin/auth";
import {
  createAdminHistoricalQuestion,
  listAdminHistoricalQuestions,
  normalizeAdminHistoricalQuestionFilters,
  updateAdminHistoricalQuestion,
  type HistoricalQuestionInput
} from "@/lib/admin/historical-practice";
import { apiErrorResponse, readJsonBody } from "@/lib/api-security";

type MutationBody = HistoricalQuestionInput & {
  id?: unknown;
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
    const filters = normalizeAdminHistoricalQuestionFilters({
      q: searchParams.get("q"),
      year: searchParams.get("year"),
      type: searchParams.get("type"),
      page: searchParams.get("page")
    });
    return NextResponse.json(await listAdminHistoricalQuestions(filters));
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    await requireAdminSession();
    const body = await readJsonBody<MutationBody>(request, 16 * 1024);
    const question = await createAdminHistoricalQuestion(body);
    return NextResponse.json({ question }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PATCH(request: Request) {
  try {
    await requireAdminSession();
    const body = await readJsonBody<MutationBody>(request, 16 * 1024);
    const question = await updateAdminHistoricalQuestion(body.id, body);
    return NextResponse.json({ question });
  } catch (error) {
    return errorResponse(error);
  }
}
