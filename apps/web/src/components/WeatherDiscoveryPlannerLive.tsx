"use client";

import { useCallback, useRef, type ReactElement, type SyntheticEvent } from "react";
import {
  WeatherDiscoveryPlannerV2,
  type WeatherDiscoveryLocale,
} from "./WeatherDiscoveryPlannerV2";

const AUTO_APPLY_DELAY_MS = 180;

function isPreferenceSectionTarget(target: EventTarget | null): target is Element {
  return target instanceof Element && target.closest("section[aria-label]") !== null;
}

export function WeatherDiscoveryPlannerLive({
  locale,
}: {
  readonly locale: WeatherDiscoveryLocale;
}): ReactElement {
  const timerRef = useRef<number | null>(null);

  const scheduleApply = useCallback((): void => {
    if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => {
      timerRef.current = null;
      const applyButton = document.querySelector<HTMLButtonElement>(
        "section[aria-label] button.trip-primary-button",
      );
      applyButton?.click();
    }, AUTO_APPLY_DELAY_MS);
  }, []);

  const handleChangeCapture = useCallback(
    (event: SyntheticEvent): void => {
      if (isPreferenceSectionTarget(event.target)) scheduleApply();
    },
    [scheduleApply],
  );

  const handleClickCapture = useCallback(
    (event: SyntheticEvent): void => {
      if (!(event.target instanceof Element)) return;
      const button = event.target.closest("button");
      if (button === null || button.classList.contains("trip-primary-button")) return;
      if (button.closest("section[aria-label]") !== null) scheduleApply();
    },
    [scheduleApply],
  );

  return (
    <div onChangeCapture={handleChangeCapture} onClickCapture={handleClickCapture}>
      <WeatherDiscoveryPlannerV2 locale={locale} />
    </div>
  );
}
