import { Download, Eye, FileText } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { ArtifactViewModel } from "./artifact-types";

export function ArtifactCard({ artifact }: { artifact: ArtifactViewModel }) {
  return (
    <Card>
      <CardContent className="flex items-center justify-between gap-3 p-3">
        <div className="flex min-w-0 items-center gap-2">
          <FileText data-icon="inline-start" />
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{artifact.title}</p>
            <p className="text-xs text-muted-foreground">{artifact.kind}</p>
          </div>
        </div>
        <div className="flex gap-1">
          <Button variant="outline" size="sm">
            <Eye data-icon="inline-start" />
            Preview
          </Button>
          <Button variant="ghost" size="icon" aria-label={`Download ${artifact.title}`}>
            <Download />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
