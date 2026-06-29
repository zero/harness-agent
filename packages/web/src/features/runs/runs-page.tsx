import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function RunsPage() {
  return (
    <section className="flex flex-col gap-4">
      <h2 className="text-xl font-semibold">Runs</h2>
      <Card>
        <CardHeader>
          <CardTitle>Inspect workspace</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">completed</CardContent>
      </Card>
    </section>
  );
}
