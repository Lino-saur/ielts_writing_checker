import { describe, expect, it } from "vitest";
import {
  normalizeHistoricalPracticeFilters,
  mapHistoricalPracticeRow
} from "../lib/historical-practice";
import {
  normalizeAdminHistoricalQuestionFilters,
  validateHistoricalQuestionInput
} from "../lib/admin/historical-practice";

describe("historical practice data", () => {
  it("maps database rows to the public question shape", () => {
    expect(
      mapHistoricalPracticeRow({
        id: "q20250101_1",
        year: 2025,
        exam_date: new Date("2025-01-01T00:00:00.000Z"),
        task_type: "task2",
        category: "教育",
        question_type: "观点类",
        prompt: "Sample prompt",
        image_object_key: null,
        image_name: null,
        image_mime_type: null,
        image_size_bytes: null
      })
    ).toEqual({
      id: "q20250101_1",
      year: 2025,
      date: "2025-01-01",
      taskType: "task2",
      category: "教育",
      type: "观点类",
      prompt: "Sample prompt",
      imageObjectKey: null,
      imageName: null,
      imageMimeType: null,
      imageSizeBytes: null
    });
  });

  it("validates admin edits and derives the year from the date", () => {
    expect(
      validateHistoricalQuestionInput({
        date: "2026-06-21",
        category: " 社会 ",
        type: "讨论类",
        prompt: " Discuss both views and give your own opinion. "
      })
    ).toEqual({
      year: 2026,
      date: "2026-06-21",
      taskType: "task2",
      category: "社会",
      type: "讨论类",
      prompt: "Discuss both views and give your own opinion."
    });

    expect(() =>
      validateHistoricalQuestionInput({
        date: "2026-02-31",
        category: "社会",
        type: "讨论类",
        prompt: "Discuss both views and give your own opinion."
      })
    ).toThrow("INVALID_DATE");
  });

  it("normalizes admin list filters", () => {
    expect(
      normalizeAdminHistoricalQuestionFilters({
        q: " education ",
        year: "2025",
        type: "观点类",
        page: "2"
      })
    ).toMatchObject({
      q: "education",
      year: 2025,
      type: "观点类",
      page: 2,
      pageSize: 30
    });
  });

  it("normalizes public pagination and filters", () => {
    expect(
      normalizeHistoricalPracticeFilters({
        taskType: "task1",
        year: "2026",
        category: " 表格 ",
        type: "not-a-type",
        page: "3"
      })
    ).toEqual({
      taskType: "task1",
      year: 2026,
      category: "表格",
      type: null,
      page: 3,
      pageSize: 24
    });

    expect(
      normalizeHistoricalPracticeFilters({
        taskType: "other",
        year: "1999",
        page: "-1"
      })
    ).toMatchObject({
      taskType: null,
      year: null,
      page: 1
    });
  });
});
