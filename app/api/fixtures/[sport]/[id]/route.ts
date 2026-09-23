import { NextResponse } from "next/server";
import { fetchFootballFixtureDetail } from "@/lib/sports/football";
import { fetchBasketballGameDetail } from "@/lib/sports/basketball";

export async function GET(_req: Request, { params }: { params: Promise<{ sport: string; id: string }> }) {
  const { sport, id } = await params;
  const providerId = Number(id);

  if ((sport !== "football" && sport !== "basketball") || !Number.isFinite(providerId)) {
    return NextResponse.json({ error: "Invalid fixture id" }, { status: 400 });
  }

  try {
    const detail =
      sport === "football" ? await fetchFootballFixtureDetail(providerId) : await fetchBasketballGameDetail(providerId);

    if (!detail) return NextResponse.json({ error: "Fixture not found" }, { status: 404 });
    return NextResponse.json(detail);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to load fixture" },
      { status: 502 },
    );
  }
}
