"use client";

import { useEffect, useState, type MouseEvent, type ReactElement, type ReactNode } from "react";
import type { Window } from "../api/v1/schemas";

export interface WindowPanel {
  readonly window: Window;
  readonly panel: ReactNode;
}

export interface WindowExperienceProps {
  readonly initialWindow: Window;
  readonly panels: ReadonlyArray<WindowPanel>;
}

const VALID_WINDOWS: ReadonlyArray<Window> = ["today", "tomorrow", "weekend", "next_week"];

function windowFromLocation(): Window | null {
  const value = new URLSearchParams(window.location.search).get("window");
  return VALID_WINDOWS.includes(value as Window) ? (value as Window) : null;
}

export function WindowExperience({ initialWindow, panels }: WindowExperienceProps): ReactElement {
  const [activeWindow, setActiveWindow] = useState<Window>(initialWindow);

  useEffect(() => {
    const requested = windowFromLocation();
    if (requested !== null && panels.some((item) => item.window === requested)) {
      setActiveWindow(requested);
    }

    const onPopState = (): void => {
      const next = windowFromLocation() ?? initialWindow;
      if (panels.some((item) => item.window === next)) setActiveWindow(next);
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [initialWindow, panels]);

  function handleClick(event: MouseEvent<HTMLDivElement>): void {
    const element = event.target as Element;
    const link = element.closest<HTMLAnchorElement>("a[data-window]");
    const requested = link?.dataset.window as Window | undefined;
    if (link === null || requested === undefined || !VALID_WINDOWS.includes(requested)) return;
    if (!panels.some((item) => item.window === requested)) return;
    event.preventDefault();
    setActiveWindow(requested);
    window.history.pushState({}, "", link.href);
  }

  const active = panels.find((item) => item.window === activeWindow) ?? panels[0];

  return (
    <div onClick={handleClick}>
      <p className="sr-only" role="status" aria-live="polite">
        Showing recommendations for {activeWindow.replace("_", " ")}.
      </p>
      {active?.panel}
    </div>
  );
}
