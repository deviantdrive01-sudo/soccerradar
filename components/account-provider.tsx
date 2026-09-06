"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toggleFavoriteCountry, toggleFavoriteLeague, toggleFavoriteMatch } from "@/app/account/favorites/actions";
import { createCollection as createCollectionAction, toggleCollectionItem as toggleCollectionItemAction } from "@/app/account/collections/actions";

export interface AccountUser {
  userId: string;
  email: string | null;
  username: string | null;
  isAdmin: boolean;
}

export interface AccountCollection {
  id: number;
  title: string;
  predictionIds: Set<number>;
}

interface AccountState {
  loading: boolean;
  user: AccountUser | null;
  favoriteCountries: Set<string>;
  favoriteLeagueIds: Set<number>;
  favoriteMatchIds: Set<number>;
  collections: AccountCollection[];
}

interface AccountContextValue extends AccountState {
  toggleCountry: (country: string) => void;
  toggleLeague: (leagueId: number) => void;
  toggleMatch: (predictionId: number) => void;
  toggleCollectionItem: (collectionId: number, predictionId: number) => void;
  createCollection: (title: string) => Promise<number | null>;
  refresh: () => void;
}

const EMPTY_STATE: AccountState = {
  loading: true,
  user: null,
  favoriteCountries: new Set(),
  favoriteLeagueIds: new Set(),
  favoriteMatchIds: new Set(),
  collections: [],
};

const AccountContext = createContext<AccountContextValue>({
  ...EMPTY_STATE,
  toggleCountry: () => {},
  toggleLeague: () => {},
  toggleMatch: () => {},
  toggleCollectionItem: () => {},
  createCollection: async () => null,
  refresh: () => {},
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
          collections: (data.collections ?? []).map((c: { id: number; title: string; predictionIds: number[] }) => ({
            id: c.id,
            title: c.title,
            predictionIds: new Set(c.predictionIds),
          })),
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

  const toggleCollectionItem = useCallback(
    (collectionId: number, predictionId: number) => {
      if (!state.user) {
        router.push("/login");
        return;
      }
      const applyToggle = (collections: AccountCollection[]) =>
        collections.map((c) => (c.id === collectionId ? { ...c, predictionIds: withToggled(c.predictionIds, predictionId) } : c));

      setState((s) => ({ ...s, collections: applyToggle(s.collections) }));
      toggleCollectionItemAction(collectionId, predictionId).catch(() => {
        setState((s) => ({ ...s, collections: applyToggle(s.collections) }));
      });
    },
    [state.user, router],
  );

  const createCollection = useCallback(
    async (title: string): Promise<number | null> => {
      if (!state.user) {
        router.push("/login");
        return null;
      }
      try {
        const { id } = await createCollectionAction(title);
        setState((s) => ({ ...s, collections: [{ id, title: title.trim(), predictionIds: new Set() }, ...s.collections] }));
        return id;
      } catch {
        return null;
      }
    },
    [state.user, router],
  );

  return (
    <AccountContext.Provider
      value={{ ...state, toggleCountry, toggleLeague, toggleMatch, toggleCollectionItem, createCollection, refresh }}
    >
      {children}
    </AccountContext.Provider>
  );
}

export function useAccount(): AccountContextValue {
  return useContext(AccountContext);
}
