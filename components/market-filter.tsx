"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export type MarketFilter = "all" | "outcome" | "corners" | "goals";

const OPTIONS: { value: MarketFilter; label: string }[] = [
  { value: "all", label: "All Markets" },
  { value: "outcome", label: "Win / Draw / Win" },
  { value: "corners", label: "Corners" },
  { value: "goals", label: "Goals" },
];

export function MarketFilterSelect({
  value,
  onChange,
}: {
  value: MarketFilter;
  onChange: (value: MarketFilter) => void;
}) {
  return (
    <Select value={value} onValueChange={(v) => onChange(v as MarketFilter)}>
      <SelectTrigger className="w-[180px]">
        <SelectValue placeholder="Filter markets" />
      </SelectTrigger>
      <SelectContent>
        {OPTIONS.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
