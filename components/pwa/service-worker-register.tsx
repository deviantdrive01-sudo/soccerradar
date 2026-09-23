"use client";

import { useEffect } from "react";

export function ServiceWorkerRegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    function register() {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        // Registration failures (unsupported browser, blocked storage) shouldn't break the page.
      });
    }

    // This effect runs after hydration, which is usually after the window's
    // "load" event already fired — waiting for that event here would mean
    // it never comes. Register immediately once the document is complete,
    // and only fall back to listening for "load" if we somehow got here
    // before it.
    if (document.readyState === "complete") {
      register();
      return;
    }
    window.addEventListener("load", register);
    return () => window.removeEventListener("load", register);
  }, []);

  return null;
}
