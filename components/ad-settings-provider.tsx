"use client";

import { createContext, useContext } from "react";

export interface AdSettingsValue {
  houseWeight: number;
  googleEnabled: boolean;
  houseVideoPath: string;
  houseClickUrl: string;
}

const DEFAULT_SETTINGS: AdSettingsValue = {
  houseWeight: 50,
  googleEnabled: true,
  houseVideoPath: "/ads/placeholder-ad.mp4",
  houseClickUrl: "https://getordara.com",
};

const AdSettingsContext = createContext<AdSettingsValue>(DEFAULT_SETTINGS);

/** Settings are fetched once server-side and don't change within a session, so a plain context is enough. */
export function AdSettingsProvider({
  settings,
  children,
}: {
  settings: AdSettingsValue | null;
  children: React.ReactNode;
}) {
  return (
    <AdSettingsContext.Provider value={settings ?? DEFAULT_SETTINGS}>{children}</AdSettingsContext.Provider>
  );
}

export function useAdSettings(): AdSettingsValue {
  return useContext(AdSettingsContext);
}
