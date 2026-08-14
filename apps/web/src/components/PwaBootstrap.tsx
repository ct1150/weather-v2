"use client";

import { useEffect, useState, type ReactElement } from "react";

function setNetworkState(online: boolean): void {
  document.documentElement.dataset.networkState = online ? "online" : "offline";
}

export function PwaBootstrap(): ReactElement | null {
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    const update = (): void => {
      const online = navigator.onLine;
      setOffline(!online);
      setNetworkState(online);
    };
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);

    if ("serviceWorker" in navigator) {
      void navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => undefined);
    }

    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);

  if (!offline) return null;
  return (
    <div
      role="status"
      className="fixed bottom-3 left-1/2 z-[1000] -translate-x-1/2 rounded-full border border-border bg-white px-4 py-2 text-xs font-semibold text-foreground shadow-lg"
      data-offline-banner="visible"
    >
      Offline · using saved trip data
    </div>
  );
}
