import type { Artifact, ArtifactKind, ArtifactPreview } from "./artifact-types";

export interface RegisterArtifactInput {
  sessionId: string;
  projectId: string;
  kind: ArtifactKind;
  title: string;
  relativePath: string;
  mimeType: string;
  sizeBytes: number;
  preview?: ArtifactPreview;
}

export class ArtifactRegistry {
  private nextId = 1;
  private readonly artifacts = new Map<string, Artifact>();

  register(input: RegisterArtifactInput): Artifact {
    const artifact: Artifact = {
      id: `artifact-${this.nextId}`,
      ...input,
      createdAt: new Date().toISOString()
    };
    this.nextId += 1;
    this.artifacts.set(artifact.id, artifact);
    return artifact;
  }

  get(id: string): Artifact | undefined {
    return this.artifacts.get(id);
  }

  listForSession(sessionId: string): Artifact[] {
    return [...this.artifacts.values()].filter(
      (artifact) => artifact.sessionId === sessionId
    );
  }
}
