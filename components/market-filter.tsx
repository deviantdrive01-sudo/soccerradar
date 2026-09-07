"use client";

import { Button } from "@/components/ui/button";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { cn } from "cn";

export type MarketFilter =
  | "all"
  | "ftDraw"
  | "highestHalf"
  | "winEitherHalf"
  | "drawOrOver"
  | "goals"
  | "corners";

const OPTIONS: { value: MarketFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "ftDraw", label: "FT Draw" },
  { value: "highestHalf", label: "Highest Half" },
  { value: "winEitherHalf", label: "Win Either Half" },
  { value: "drawOrOver", label: "Draw/O2.5" },
  { value: "goals", label: "Goals" },
  { value: "corners", label: "Corners" },
];

export function MarketFilterToggle({
  value,
  onChange,
}: {
  value: MarketFilter;
  onChange: (value: MarketFilter) => void;
}) {
  return (
    <ScrollArea className="min-w-0 flex-1">
      <div className="flex gap-0.5 rounded-md border border-border/60 p-0.5">
        {OPTIONS.map((option) => (
          <Button
            key={option.value}
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => onChange(option.value)}
            className={cn(
              "h-7 shrink-0 whitespace-nowrap px-3",
              value === option.value && "bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground",
            )}
          >
            {option.label}
          </Button>
        ))}
      </div>
      <ScrollBar orientation="horizontal" />
    </ScrollArea>
  );
}
