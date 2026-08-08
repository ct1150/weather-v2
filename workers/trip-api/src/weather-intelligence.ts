export type TripPartyProfile = "adults" | "family" | "senior";
export type TripDayTheme = "city" | "beach" | "outdoor" | "indoor";
export type WeatherInsightSeverity = "none" | "watch" | "action";
export type WeatherRecommendationKind = "keep_plan" | "adjust_timing" | "activate_plan_b";

export interface TripWeatherObservation {
  readonly snapshotId: string;
  readonly cityId: string;
  readonly date: string;
  readonly observedAt: string;
  readonly rainProbability: number | null;
  readonly precipitationMm: number | null;
  readonly temperatureMinC: number | null;
  readonly temperatureMaxC: number | null;
  readonly windSpeedKph: number | null;
  readonly windGustKph: number | null;
  readonly uvIndex: number | null;
}

export type WeatherInsightReasonCode =
  | "RAIN_PROBABILITY_JUMP"
  | "HEAVY_RAIN_THRESHOLD"
  | "PRECIPITATION_VOLUME_JUMP"
  | "WIND_THRESHOLD"
  | "GUST_THRESHOLD"
  | "HEAT_THRESHOLD"
  | "COLD_THRESHOLD"
  | "UV_THRESHOLD";

export interface WeatherInsightAssessment {
  readonly severity: WeatherInsightSeverity;
  readonly recommendation: WeatherRecommendationKind;
  readonly impactScore: number;
  readonly reasonCodes: ReadonlyArray<WeatherInsightReasonCode>;
}

function finite(value: number | null): number | null {
  return value !== null && Number.isFinite(value) ? value : null;
}

function increase(previous: number | null, current: number | null): number {
  const before = finite(previous);
  const after = finite(current);
  return before === null || after === null ? 0 : Math.max(0, after - before);
}

function crossed(previous: number | null, current: number | null, threshold: number): boolean {
  const before = finite(previous);
  const after = finite(current);
  return before !== null && after !== null && before < threshold && after >= threshold;
}

function themeWeight(theme: TripDayTheme): number {
  switch (theme) {
    case "beach":
      return 1.35;
    case "outdoor":
      return 1.25;
    case "city":
      return 1;
    case "indoor":
      return 0.45;
  }
}

function partyWeight(profile: TripPartyProfile): number {
  switch (profile) {
    case "senior":
      return 1.25;
    case "family":
      return 1.15;
    case "adults":
      return 1;
  }
}

function heatThreshold(profile: TripPartyProfile): number {
  return profile === "adults" ? 35 : 33;
}

function coldThreshold(profile: TripPartyProfile): number {
  return profile === "adults" ? 8 : 10;
}

function clampImpact(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

/**
 * Compares two persisted forecasts for the same trip day.
 * The engine only scores deterioration. Improvements and small forecast noise stay silent.
 */
export function assessWeatherChange(input: {
  readonly previous: TripWeatherObservation;
  readonly current: TripWeatherObservation;
  readonly theme: TripDayTheme;
  readonly partyProfile: TripPartyProfile;
}): WeatherInsightAssessment {
  const { previous, current, theme, partyProfile } = input;
  const reasons: WeatherInsightReasonCode[] = [];
  let rawImpact = 0;

  const rainJump = increase(previous.rainProbability, current.rainProbability);
  if (rainJump >= 30) {
    reasons.push("RAIN_PROBABILITY_JUMP");
    rawImpact += Math.min(28, rainJump * 0.55);
  }
  if (crossed(previous.rainProbability, current.rainProbability, 70)) {
    reasons.push("HEAVY_RAIN_THRESHOLD");
    rawImpact += 24;
  }

  const precipitationJump = increase(previous.precipitationMm, current.precipitationMm);
  if (precipitationJump >= 5) {
    reasons.push("PRECIPITATION_VOLUME_JUMP");
    rawImpact += Math.min(22, precipitationJump * 1.6);
  }

  const windThreshold = theme === "beach" || theme === "outdoor" ? 28 : 36;
  if (
    crossed(previous.windSpeedKph, current.windSpeedKph, windThreshold) ||
    increase(previous.windSpeedKph, current.windSpeedKph) >= 12
  ) {
    reasons.push("WIND_THRESHOLD");
    rawImpact += theme === "indoor" ? 6 : 18;
  }

  const gustThreshold = theme === "beach" || theme === "outdoor" ? 42 : 52;
  if (
    crossed(previous.windGustKph, current.windGustKph, gustThreshold) ||
    increase(previous.windGustKph, current.windGustKph) >= 18
  ) {
    reasons.push("GUST_THRESHOLD");
    rawImpact += theme === "indoor" ? 6 : 20;
  }

  if (crossed(previous.temperatureMaxC, current.temperatureMaxC, heatThreshold(partyProfile))) {
    reasons.push("HEAT_THRESHOLD");
    rawImpact += theme === "indoor" ? 8 : 18;
  }

  const previousMin = finite(previous.temperatureMinC);
  const currentMin = finite(current.temperatureMinC);
  if (
    previousMin !== null &&
    currentMin !== null &&
    previousMin > coldThreshold(partyProfile) &&
    currentMin <= coldThreshold(partyProfile)
  ) {
    reasons.push("COLD_THRESHOLD");
    rawImpact += theme === "indoor" ? 6 : 14;
  }

  if ((theme === "beach" || theme === "outdoor") && crossed(previous.uvIndex, current.uvIndex, 9)) {
    reasons.push("UV_THRESHOLD");
    rawImpact += 12;
  }

  const impactScore = clampImpact(rawImpact * themeWeight(theme) * partyWeight(partyProfile));
  const severity: WeatherInsightSeverity =
    reasons.length === 0 || impactScore < 20 ? "none" : impactScore >= 55 ? "action" : "watch";
  const recommendation: WeatherRecommendationKind =
    severity === "action"
      ? "activate_plan_b"
      : severity === "watch"
        ? "adjust_timing"
        : "keep_plan";

  return { severity, recommendation, impactScore, reasonCodes: reasons };
}
