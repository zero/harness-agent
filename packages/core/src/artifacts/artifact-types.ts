export type ArtifactKind =
  | "markdown"
  | "html"
  | "csv"
  | "xlsx"
  | "docx"
  | "pptx"
  | "pdf"
  | "json"
  | "text"
  | "image";

export interface ArtifactPreview {
  kind: "text" | "html" | "table" | "binary" | "image" | "pdf";
  title?: string;
  content?: string;
  rows?: Record<string, unknown>[];
  metadata?: Record<string, unknown>;
}

export interface Artifact {
  id: string;
  sessionId: string;
  projectId: string;
  kind: ArtifactKind;
  title: string;
  relativePath: string;
  mimeType: string;
  sizeBytes: number;
  preview?: ArtifactPreview;
  createdAt: string;
}
