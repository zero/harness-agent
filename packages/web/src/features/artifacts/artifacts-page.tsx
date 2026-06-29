import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArtifactPreview } from "./artifact-preview";
import { ArtifactCard } from "./artifact-card";
import type { ArtifactViewModel } from "./artifact-types";

export interface ArtifactsPageProps {
  artifacts?: ArtifactViewModel[];
  selectedArtifactId?: string;
  onSelectArtifact?: (artifactId: string) => void;
}

export function ArtifactsPage({
  artifacts = [],
  selectedArtifactId,
  onSelectArtifact
}: ArtifactsPageProps) {
  const selectedArtifact =
    artifacts.find((artifact) => artifact.id === selectedArtifactId) ?? artifacts[0];

  return (
    <section className="flex flex-col gap-4">
      <h2 className="text-xl font-semibold">Artifacts</h2>
      {artifacts.length === 0 ? (
        <Card>
          <CardContent className="p-4 text-sm text-muted-foreground">
            Generated artifacts will appear here after a local run.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[360px_minmax(0,1fr)]">
          <div className="flex flex-col gap-3">
            {artifacts.map((artifact) => (
              <ArtifactCard
                key={artifact.id}
                artifact={artifact}
                onPreview={onSelectArtifact}
              />
            ))}
          </div>
          <Card>
            <CardHeader>
              <CardTitle>Preview</CardTitle>
            </CardHeader>
            <CardContent>
              {selectedArtifact ? <ArtifactPreview artifact={selectedArtifact} /> : null}
            </CardContent>
          </Card>
        </div>
      )}
    </section>
  );
}
