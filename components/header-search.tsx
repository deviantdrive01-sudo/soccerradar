"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Search, X } from "lucide-react";
import { SearchDropdown } from "@/components/search-dropdown";

export function HeaderSearch() {
  const [query, setQuery] = useState("");
  const router = useRouter();

  function goToResults() {
    const trimmed = query.trim();
    if (!trimmed) return;
    router.push(`/search?q=${encodeURIComponent(trimmed)}`);
    setQuery("");
  }

  return (
    <form
      className="relative w-full"
      data-tour="search"
      onSubmit={(e) => {
        e.preventDefault();
        goToResults();
      }}
    >
      <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search teams or leagues…"
        className="h-9 w-full rounded-md border border-border/60 bg-background pl-8 pr-8 text-sm outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
      />
      {query && (
        <button
          type="button"
          onClick={() => setQuery("")}
          aria-label="Clear search"
          className="absolute right-2 top-1/2 flex size-4 -translate-y-1/2 items-center justify-center text-muted-foreground hover:text-foreground"
        >
          <X className="size-3.5" />
        </button>
      )}
      <SearchDropdown query={query} onSeeAllResults={goToResults} onResultClick={() => setQuery("")} />
    </form>
  );
}
