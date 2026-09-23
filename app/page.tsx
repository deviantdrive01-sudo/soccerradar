import { LiveFixturesHub } from "@/components/sports/live-fixtures-hub";

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-4 py-6">
      <p className="text-sm text-muted-foreground">
        Live scores and fixtures for football and basketball, updated as they happen.
      </p>
      <LiveFixturesHub />
    </main>
  );
}
