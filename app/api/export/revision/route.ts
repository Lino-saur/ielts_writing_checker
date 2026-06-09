import { NextResponse } from "next/server";
import { AlignmentType, Document, HeadingLevel, Packer, Paragraph, TextRun } from "docx";
import { requireSession } from "@/lib/auth-session";
import type { CorrectionNote, Locale, WritingCheckResult } from "@/lib/types";

type ExportRevisionBody = {
  prompt?: string;
  essay?: string;
  locale?: Locale;
  result?: WritingCheckResult;
};

type RevisionEdit = {
  id: string;
  original: string;
  corrected: string;
  note?: CorrectionNote;
  index: number;
};

type RevisionPart =
  | { type: "plain"; text: string }
  | { type: "edit"; edit: RevisionEdit };

function parseAnnotatedEssay(text: string, correctionNotes: CorrectionNote[]) {
  const notesById = new Map(correctionNotes.map((note) => [note.id, note]));
  const parts: RevisionPart[] = [];
  const edits: RevisionEdit[] = [];
  const pairPattern = /\[del#([A-Za-z0-9_-]+)\]([\s\S]*?)\[\/del#\1\]\[add#\1\]([\s\S]*?)\[\/add#\1\]/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let editIndex = 0;

  while ((match = pairPattern.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push({ type: "plain", text: text.slice(lastIndex, match.index) });
    }

    const edit = {
      id: match[1],
      original: match[2],
      corrected: match[3],
      note: notesById.get(match[1]),
      index: editIndex
    };

    parts.push({ type: "edit", edit });
    edits.push(edit);
    editIndex += 1;
    lastIndex = pairPattern.lastIndex;
  }

  if (lastIndex < text.length) {
    parts.push({ type: "plain", text: text.slice(lastIndex) });
  }

  return { parts, edits };
}

function normalizeTextLines(text: string) {
  return text.split("\n").map((line) => line.replace(/\r/g, ""));
}

function buildAnnotatedParagraphs(parts: RevisionPart[]) {
  const paragraphs: Paragraph[] = [];
  let runs: TextRun[] = [];

  function flushParagraph() {
    paragraphs.push(
      new Paragraph({
        children: runs.length ? runs : [new TextRun("")],
        spacing: {
          after: 160
        }
      })
    );
    runs = [];
  }

  for (const part of parts) {
    if (part.type === "plain") {
      const lines = normalizeTextLines(part.text);
      lines.forEach((line, index) => {
        if (line) {
          runs.push(new TextRun(line));
        }
        if (index < lines.length - 1) {
          flushParagraph();
        }
      });
      continue;
    }

    runs.push(
      new TextRun({
        text: part.edit.original || " ",
        bold: true,
        highlight: "yellow"
      })
    );
    runs.push(
      new TextRun({
        text: `[${part.edit.index + 1}]`,
        superScript: true
      })
    );
  }

  flushParagraph();
  return paragraphs;
}

function buildRevisionDoc(input: { prompt: string; essay: string; locale: Locale; result: WritingCheckResult }) {
  const isZh = input.locale === "zh-CN";
  const { parts, edits } = parseAnnotatedEssay(input.result.annotatedEssay, input.result.correctionNotes);
  const title = isZh ? "IELTS 写作修改导出" : "IELTS Writing Revision Export";
  const promptLabel = isZh ? "题目" : "Prompt";
  const essayLabel = isZh ? "原文" : "Original Essay";
  const annotatedLabel = isZh ? "带修改点的原文" : "Original Essay With Marked Revision Points";
  const changeListLabel = isZh ? "修改点清单" : "Revision Change List";
  const revisedLabel = isZh ? "建议修改后" : "Suggested Revision";
  const reasonLabel = isZh ? "修改原因" : "Reason";
  const bandLabel = isZh ? "预估分数" : "Estimated Band";

  return new Document({
    sections: [
      {
        properties: {},
        children: [
          new Paragraph({
            text: title,
            heading: HeadingLevel.TITLE,
            alignment: AlignmentType.CENTER,
            spacing: { after: 280 }
          }),
          new Paragraph({
            children: [
              new TextRun({ text: `${bandLabel}: `, bold: true }),
              new TextRun(input.result.estimatedBand.toFixed(1))
            ],
            spacing: { after: 240 }
          }),
          new Paragraph({
            text: promptLabel,
            heading: HeadingLevel.HEADING_1
          }),
          ...normalizeTextLines(input.prompt).map(
            (line) =>
              new Paragraph({
                text: line || "",
                spacing: { after: 120 }
              })
          ),
          new Paragraph({
            text: essayLabel,
            heading: HeadingLevel.HEADING_1,
            spacing: { before: 240 }
          }),
          ...normalizeTextLines(input.essay).map(
            (line) =>
              new Paragraph({
                text: line || "",
                spacing: { after: 120 }
              })
          ),
          new Paragraph({
            text: annotatedLabel,
            heading: HeadingLevel.HEADING_1,
            spacing: { before: 240 }
          }),
          ...buildAnnotatedParagraphs(parts),
          new Paragraph({
            text: changeListLabel,
            heading: HeadingLevel.HEADING_1,
            spacing: { before: 240 }
          }),
          ...edits.flatMap((edit) => [
            new Paragraph({
              children: [new TextRun({ text: `[${edit.index + 1}] ${edit.original}`, bold: true })],
              spacing: { after: 100 }
            }),
            new Paragraph({
              children: [new TextRun({ text: `${revisedLabel}: `, bold: true }), new TextRun(edit.corrected)],
              spacing: { after: 100 }
            }),
            new Paragraph({
              children: [new TextRun({ text: `${reasonLabel}: `, bold: true }), new TextRun(edit.note?.reason || "")],
              spacing: { after: 200 }
            })
          ])
        ]
      }
    ]
  });
}

function buildFilename(locale: Locale) {
  const prefix = locale === "zh-CN" ? "ielts-writing-revision" : "ielts-writing-revision";
  const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
  return `${prefix}-${stamp}.docx`;
}

export async function POST(request: Request) {
  try {
    await requireSession();

    const body = (await request.json()) as ExportRevisionBody;

    if (!body.result || !body.prompt || !body.essay) {
      return NextResponse.json({ error: "INVALID_EXPORT_PAYLOAD" }, { status: 400 });
    }

    const locale = body.locale === "zh-CN" ? "zh-CN" : "en";
    const doc = buildRevisionDoc({
      prompt: body.prompt,
      essay: body.essay,
      locale,
      result: body.result
    });
    const buffer = await Packer.toBuffer(doc);

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": `attachment; filename="${buildFilename(locale)}"`
      }
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error.";
    const status = message === "UNAUTHORIZED" ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
