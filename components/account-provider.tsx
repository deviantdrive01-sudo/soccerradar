"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toggleFavoriteCountry, toggleFavoriteLeague, toggleFavoriteMatch } from "@/app/account/favorites/actions";

export interface AccountUser {
  userId: string;
  email: string | null;
  username: string | null;
}

interface AccountState {
  loading: boolean;
  user: AccountUser | null;
  favoriteCountries: Set<string>;
  favoriteLeagueIds: Set<number>;
  favoriteMatchIds: Set<number>;
}

interface AccountContextValue extends AccountState {
  toggleCountry: (country: string) => void;
  toggleLeague: (leagueId: number) => void;
  toggleMatch: (predictionId: number) => void;
}

const EMPTY_STATE: AccountState = {
  loading: true,
  user: null,
  favoriteCountries: new Set(),
  favoriteLeagueIds: new Set(),
  favoriteMatchIds: new Set(),
};

const AccountContext = createContext<AccountContextValue>({
  ...EMPTY_STATE,
  toggleCountry: () => {},
  toggleLeague: () => {},
  toggleMatch: () => {},
});

function withToggled<T>(set: Set<T>, value: T): Set<T> {
  const next = new Set(set);
  if (next.has(value)) next.delete(value);
  else next.add(value);
  return next;
}

export function AccountProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [state, setState] = useState<AccountState>(EMPTY_STATE);

  const refresh = useCallback(() => {
    fetch("/api/account/session")
      .then((res) => res.json())
      .then((data) =>
        setState({
          loading: false,
          user: data.user,
          favoriteCountries: new Set(data.favorites.countries),
          favoriteLeagueIds: new Set(data.favorites.leagueIds),
          favoriteMatchIds: new Set(data.favorites.matchIds),
        }),
      )
      .catch(() => setState((s) => ({ ...s, loading: false })));
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const toggleCountry = useCallback(
    (country: string) => {
      if (!state.user) {
        router.push("/login");
        return;
      }
      setState((s) => ({ ...s, favoriteCountries: withToggled(s.favoriteCountries, country) }));
      toggleFavoriteCountry(country).catch(() => {
        setState((s) => ({ ...s, favoriteCountries: withToggled(s.favoriteCountries, country) }));
      });
    },
    [state.user, router],
  );

  const toggleLeague = useCallback(
    (leagueId: number) => {
      if (!state.user) {
        router.push("/login");
        return;
      }
      setState((s) => ({ ...s, favoriteLeagueIds: withToggled(s.favoriteLeagueIds, leagueId) }));
      toggleFavoriteLeague(leagueId).catch(() => {
        setState((s) => ({ ...s, favoriteLeagueIds: withToggled(s.favoriteLeagueIds, leagueId) }));
      });
    },
    [state.user, router],
  );

  const toggleMatch = useCallback(
    (predictionId: number) => {
      if (!state.user) {
        router.push("/login");
        return;
      }
      setState((s) => ({ ...s, favoriteMatchIds: withToggled(s.favoriteMatchIds, predictionId) }));
      toggleFavoriteMatch(predictionId).catch(() => {
        setState((s) => ({ ...s, favoriteMatchIds: withToggled(s.favoriteMatchIds, predictionId) }));
      });
    },
    [state.user, router],
  );

  return (
    <AccountContext.Provider value={{ ...state, toggleCountry, toggleLeague, toggleMatch }}>
      {children}
    </AccountContext.Provider>
  );
}

export function useAccount(): AccountContextValue {
  return useContext(AccountContext);
}
