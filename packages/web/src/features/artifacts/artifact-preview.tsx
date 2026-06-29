import type { ArtifactViewModel } from "./artifact-types";
import { MarkdownRenderer } from "@/features/markdown/markdown-renderer";

function TablePreview({ rows }: { rows: Record<string, unknown>[] }) {
  const headers = [...new Set(rows.flatMap((row) => Object.keys(row)))];
  return (
    <table className="w-full border-collapse text-sm">
      <thead>
        <tr>
          {headers.map((header) => (
            <th key={header} className="border px-2 py-1 text-left">
              {header}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, index) => (
          <tr key={index}>
            {headers.map((header) => (
              <td key={header} className="border px-2 py-1">
                {String(row[header] ?? "")}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function ArtifactPreview({ artifact }: { artifact: ArtifactViewModel }) {
  if (artifact.kind === "markdown") {
    return <MarkdownRenderer content={artifact.content ?? ""} />;
  }
  if (artifact.kind === "html") {
    return (
      <iframe
        title={artifact.title}
        sandbox=""
        srcDoc={artifact.content ?? ""}
        className="h-96 w-full rounded-md border bg-card"
      />
    );
  }
  if (artifact.kind === "csv" || artifact.kind === "xlsx") {
    return <TablePreview rows={artifact.rows ?? []} />;
  }
  if (artifact.kind === "docx") {
    return <pre className="whitespace-pre-wrap text-sm">Document preview{"\n"}{artifact.content}</pre>;
  }
  if (artifact.kind === "pptx") {
    return <pre className="whitespace-pre-wrap text-sm">Slide preview{"\n"}{artifact.content}</pre>;
  }
  if (artifact.kind === "pdf") {
    return <embed src={artifact.downloadUrl} type="application/pdf" className="h-96 w-full rounded-md border" />;
  }
  if (artifact.kind === "json") {
    return <pre className="overflow-auto rounded-md bg-muted p-3 text-sm">{artifact.content}</pre>;
  }
  if (artifact.kind === "image") {
    return <img src={artifact.downloadUrl} alt={artifact.title} className="max-h-96 rounded-md border" />;
  }
  return <pre className="whitespace-pre-wrap text-sm">{artifact.content}</pre>;
}
