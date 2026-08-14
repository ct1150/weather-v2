"use client";

import { useEffect, useState, type ReactElement } from "react";

function setNetworkState(online: boolean): void {
  document.documentElement.dataset.networkState = online ? "online" : "offline";
}

function offlineCopy(pathname: string): string {
  if (pathname.startsWith("/zh-hant/")) return "離線模式 · 使用已儲存的行程資料";
  if (pathname.startsWith("/zh-cn/")) return "离线模式 · 使用已保存的行程数据";
  return "Offline · using saved trip data";
}

export function PwaBootstrap(): ReactElement | null {
  const [offline, setOffline] = useState(false);
  const [message, setMessage] = useState("Offline · using saved trip data");

  useEffect(() => {
    const update = (): void => {
      const online = navigator.onLine;
      setOffline(!online);
      setNetworkState(online);
      setMessage(offlineCopy(window.location.pathname));
    };
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);

    if (process.env.NODE_ENV === "production" && "serviceWorker" in navigator) {
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
      {message}
    </div>
  );
}
