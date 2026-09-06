export const ALL_LEAGUES = "all";
const COUNTRY_PREFIX = "country:";

export function countryFilterValue(country: string): string {
  return `${COUNTRY_PREFIX}${country}`;
}

export function isCountryFilterValue(value: string): boolean {
  return value.startsWith(COUNTRY_PREFIX);
}

export function countryFromFilterValue(value: string): string {
  return value.slice(COUNTRY_PREFIX.length);
}
