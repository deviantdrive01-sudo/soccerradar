export interface TourStep {
  /** Matches a `data-tour` attribute value in the DOM. */
  target: string;
  title: string;
  body: string;
}

export const TOUR_STEPS: TourStep[] = [
  {
    target: "search",
    title: "Search anything",
    body: "Find a team, league, or country from anywhere on the site.",
  },
  {
    target: "bottom-nav",
    title: "Get around in one tap",
    body: "Today's Pick opens quick-filter shortcuts, and Top Mixes and Collections are one tap away — More holds My Mixes, Track Record, and the tour.",
  },
  {
    target: "league-sidebar",
    title: "Browse by league",
    body: "Filter to one league, or click a country to see every match in it. On phone, tap the floating badge to open this list — press and drag it anywhere if it's sitting on top of a match.",
  },
  {
    target: "favorite-button",
    title: "Favorite a league or country",
    body: "Click the star to pin a league or country to the top of the list, so it's always the first thing you see.",
  },
  {
    target: "todays-pick",
    title: "Todays Pick",
    body: "Shareable collections like \"Over 2.5 Goals\" or \"Corners Over 7.5\" — one click shows every match with that prediction today.",
  },
  {
    target: "view-toggle",
    title: "Cards, tables, and markets",
    body: "Switch between card and table view, and filter down to a specific market like goals or corners.",
  },
  {
    target: "match-list",
    title: "Match predictions",
    body: "Each match shows our AI's confidence score and key markets. Click one for full analysis.",
  },
  {
    target: "collection-button",
    title: "Save to a Collection",
    body: "Bookmark a match into a named, shareable collection — great for grouping the matches you're following.",
  },
  {
    target: "booking-button",
    title: "Add to a Mix",
    body: "Pick a specific market from this match (like \"Over 1.5\") and add just that pick to a Mix — a custom list that combines picks from different matches.",
  },
  {
    target: "track-record",
    title: "Our track record",
    body: "See how accurate these predictions have actually been, broken down by market and league.",
  },
  {
    target: "account",
    title: "Make it yours",
    body: "Sign up to save favorite teams and build shareable Collections and Mixes.",
  },
];
