import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function ArtifactsPage() {
  return (
    <section className="flex flex-col gap-4">
      <h2 className="text-xl font-semibold">Artifacts</h2>
      <Card>
        <CardHeader>
          <CardTitle>report.pdf</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">application/pdf</CardContent>
      </Card>
    </section>
  );
}
