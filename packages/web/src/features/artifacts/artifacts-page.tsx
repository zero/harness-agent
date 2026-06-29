import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArtifactPreview } from "./artifact-preview";
import { ArtifactCard } from "./artifact-card";

export function ArtifactsPage() {
  const artifact = {
    id: "artifact-1",
    kind: "pdf" as const,
    title: "report.pdf",
    mimeType: "application/pdf",
    downloadUrl: "/api/artifacts/artifact-1",
    content: "PDF preview"
  };

  return (
    <section className="flex flex-col gap-4">
      <h2 className="text-xl font-semibold">Artifacts</h2>
      <ArtifactCard artifact={artifact} />
      <Card>
        <CardHeader>
          <CardTitle>Preview</CardTitle>
        </CardHeader>
        <CardContent>
          <ArtifactPreview artifact={artifact} />
        </CardContent>
      </Card>
    </section>
  );
}
