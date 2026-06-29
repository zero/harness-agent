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

export interface ArtifactViewModel {
  id: string;
  kind: ArtifactKind;
  title: string;
  mimeType: string;
  downloadUrl: string;
  content?: string;
  rows?: Record<string, unknown>[];
  sizeBytes?: number;
}
