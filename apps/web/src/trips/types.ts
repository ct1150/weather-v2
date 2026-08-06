export type ActivityFlexibility = "fixed" | "movable" | "fallback";

export type WeatherProfile =
  | "transit"
  | "sunset"
  | "mountain"
  | "indoor"
  | "desert"
  | "salt_lake"
  | "lake"
  | "city_night";

export type TripRiskLevel = "low" | "medium" | "high";

export interface TripPlace {
  readonly id: string;
  readonly name: string;
  readonly latitude: number;
  readonly longitude: number;
  readonly timezone: string;
}

export interface WeatherWindowSnapshot {
  readonly source: "open-meteo" | "snapshot";
  readonly updatedAt: string;
  readonly condition: string;
  readonly temperatureMinC: number | null;
  readonly temperatureMaxC: number | null;
  readonly rainProbability: number | null;
  readonly precipitationMm: number | null;
  readonly windSpeedKph: number | null;
  readonly windGustKph: number | null;
  readonly cloudCover: number | null;
  readonly visibilityM: number | null;
  readonly uvIndex: number | null;
  readonly sunrise: string | null;
  readonly sunset: string | null;
}

export interface TripWeatherAssessment {
  readonly score: number;
  readonly riskLevel: TripRiskLevel;
  readonly summary: string;
  readonly reasons: ReadonlyArray<string>;
}

export interface TripActivity {
  readonly id: string;
  readonly startTime: string;
  readonly endTime?: string;
  readonly name: string;
  readonly description?: string;
  readonly place?: TripPlace;
  readonly flexibility: ActivityFlexibility;
  readonly weatherProfile: WeatherProfile;
  readonly latestDeparture?: string;
  readonly bookingStatus?: "booked" | "pending" | "not_required";
  readonly fallback?: string;
  readonly fallbackSnapshot?: WeatherWindowSnapshot;
}

export interface TripRestaurant {
  readonly name: string;
  readonly meal: "breakfast" | "lunch" | "dinner" | "snack";
  readonly recommendedDishes: ReadonlyArray<string>;
  readonly note: string;
  readonly priority: "primary" | "backup";
}

export interface TripHotel {
  readonly name: string;
  readonly location: string;
  readonly priceCny: number;
  readonly note?: string;
}

export interface TripDay {
  readonly dayNumber: number;
  readonly date: string;
  readonly weekday: string;
  readonly title: string;
  readonly route: ReadonlyArray<string>;
  readonly transport: string;
  readonly drivingKm: number;
  readonly intensity: "easy" | "moderate" | "high";
  readonly activities: ReadonlyArray<TripActivity>;
  readonly restaurants: ReadonlyArray<TripRestaurant>;
  readonly hotel?: TripHotel;
  readonly planB: string;
  readonly executionNotes: ReadonlyArray<string>;
}

export interface TripPlan {
  readonly id: string;
  readonly slug: string;
  readonly title: string;
  readonly subtitle: string;
  readonly startDate: string;
  readonly endDate: string;
  readonly travelers: {
    readonly adults: number;
    readonly seniors: number;
    readonly children: number;
  };
  readonly transportSummary: string;
  readonly vehicleSummary: string;
  readonly days: ReadonlyArray<TripDay>;
}

export interface ResolvedTripActivity extends TripActivity {
  readonly weather: WeatherWindowSnapshot | null;
  readonly assessment: TripWeatherAssessment;
}

export interface ResolvedTripDay extends Omit<TripDay, "activities"> {
  readonly activities: ReadonlyArray<ResolvedTripActivity>;
  readonly weatherScore: number;
  readonly riskLevel: TripRiskLevel;
  readonly primaryWeatherSummary: string;
}

export interface ResolvedTripPlan extends Omit<TripPlan, "days"> {
  readonly days: ReadonlyArray<ResolvedTripDay>;
  readonly weatherUpdatedAt: string;
  readonly liveWeatherEnabled: boolean;
}
