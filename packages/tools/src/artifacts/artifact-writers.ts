import { mkdirSync, statSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

import {
  resolveProjectPath,
  type Artifact,
  type ArtifactKind,
  type Project
} from "@harness-agent/core";
import { Document, Packer, Paragraph } from "docx";
import { PDFDocument, StandardFonts } from "pdf-lib";
import PptxGenJS from "pptxgenjs";
import * as XLSX from "xlsx";

export interface WriteArtifactInput {
  project: Project;
  sessionId: string;
  kind: ArtifactKind;
  title: string;
  content?: string;
  rows?: Record<string, unknown>[];
}

const extensions: Record<ArtifactKind, string> = {
  markdown: "md",
  html: "html",
  csv: "csv",
  xlsx: "xlsx",
  docx: "docx",
  pptx: "pptx",
  pdf: "pdf",
  json: "json",
  text: "txt",
  image: "png"
};

const mimeTypes: Record<ArtifactKind, string> = {
  markdown: "text/markdown",
  html: "text/html",
  csv: "text/csv",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  pdf: "application/pdf",
  json: "application/json",
  text: "text/plain",
  image: "image/png"
};

function slugify(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 64);
}

function rowsToCsv(rows: Record<string, unknown>[]): string {
  const headers = [...new Set(rows.flatMap((row) => Object.keys(row)))];
  const escape = (value: unknown) => {
    const text = String(value ?? "");
    return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };

  return [headers.join(","), ...rows.map((row) => headers.map((key) => escape(row[key])).join(","))]
    .filter(Boolean)
    .join("\n");
}

async function writeDocx(path: string, title: string, content: string): Promise<void> {
  const document = new Document({
    sections: [
      {
        children: [new Paragraph({ text: title, heading: "Heading1" }), new Paragraph(content)]
      }
    ]
  });
  writeFileSync(path, await Packer.toBuffer(document));
}

async function writePptx(path: string, title: string, content: string): Promise<void> {
  type PptxConstructor = new () => {
    addSlide: () => {
      addText: (text: string, options: Record<string, unknown>) => void;
    };
    write: (options: { outputType: "nodebuffer" }) => Promise<unknown>;
  };
  const candidate = PptxGenJS as unknown as
    | PptxConstructor
    | { default?: PptxConstructor };
  const PptxConstructor = typeof candidate === "function" ? candidate : candidate.default;
  if (!PptxConstructor) {
    throw new Error("Unable to load pptxgenjs constructor");
  }
  const deck = new PptxConstructor();
  const slide = deck.addSlide();
  slide.addText(title, { x: 0.5, y: 0.4, w: 9, h: 0.5, fontSize: 28, bold: true });
  slide.addText(content, { x: 0.5, y: 1.2, w: 9, h: 4, fontSize: 16 });
  const buffer = (await deck.write({ outputType: "nodebuffer" })) as Buffer;
  writeFileSync(path, buffer);
}

async function writePdf(path: string, title: string, content: string): Promise<void> {
  const document = await PDFDocument.create();
  const page = document.addPage([595, 842]);
  const font = await document.embedFont(StandardFonts.Helvetica);
  page.drawText(title, { x: 48, y: 780, size: 22, font });
  page.drawText(content, { x: 48, y: 740, size: 12, font, maxWidth: 500, lineHeight: 16 });
  writeFileSync(path, await document.save());
}

export async function writeArtifact(input: WriteArtifactInput): Promise<Artifact> {
  const extension = extensions[input.kind];
  const relativePath = `.harness-agent/artifacts/${input.sessionId}/${slugify(
    input.title
  )}.${extension}`;
  const absolutePath = resolveProjectPath(input.project, relativePath);
  mkdirSync(dirname(absolutePath), { recursive: true });
  const content = input.content ?? "";
  const rows = input.rows ?? [];

  if (input.kind === "markdown") {
    writeFileSync(absolutePath, `# ${input.title}\n\n${content}`);
  } else if (input.kind === "html") {
    writeFileSync(absolutePath, `<!doctype html><title>${input.title}</title><main>${content}</main>`);
  } else if (input.kind === "csv") {
    writeFileSync(absolutePath, rowsToCsv(rows));
  } else if (input.kind === "xlsx") {
    const workbook = XLSX.utils.book_new();
    const sheet = XLSX.utils.json_to_sheet(rows);
    XLSX.utils.book_append_sheet(workbook, sheet, "Sheet1");
    XLSX.writeFile(workbook, absolutePath);
  } else if (input.kind === "docx") {
    await writeDocx(absolutePath, input.title, content);
  } else if (input.kind === "pptx") {
    await writePptx(absolutePath, input.title, content);
  } else if (input.kind === "pdf") {
    await writePdf(absolutePath, input.title, content);
  } else if (input.kind === "json") {
    writeFileSync(absolutePath, JSON.stringify({ title: input.title, content, rows }, null, 2));
  } else if (input.kind === "text") {
    writeFileSync(absolutePath, content);
  } else {
    writeFileSync(absolutePath, "");
  }

  return {
    id: `artifact-${input.sessionId}-${slugify(input.title)}`,
    sessionId: input.sessionId,
    projectId: input.project.id,
    kind: input.kind,
    title: input.title,
    relativePath,
    mimeType: mimeTypes[input.kind],
    sizeBytes: statSync(absolutePath).size,
    createdAt: new Date().toISOString()
  };
}
