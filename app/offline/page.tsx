import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "You're offline",
  robots: { index: false, follow: false },
};

export default function OfflinePage() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-2 p-8 text-center">
      <h1 className="text-lg font-semibold">You&apos;re offline</h1>
      <p className="max-w-sm text-sm text-muted-foreground">
        Live scores and fixtures need a connection to update. Reconnect and reload to keep watching.
      </p>
    </main>
  );
}
