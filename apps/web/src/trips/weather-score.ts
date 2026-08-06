import type {
  TripRiskLevel,
  TripWeatherAssessment,
  WeatherProfile,
  WeatherWindowSnapshot,
} from "./types";

function valueOr(value: number | null, fallback: number): number {
  return value ?? fallback;
}

function clamp(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function riskLevel(score: number): TripRiskLevel {
  if (score >= 75) return "low";
  if (score >= 50) return "medium";
  return "high";
}

function weatherLabel(profile: WeatherProfile, score: number): string {
  if (score >= 85) return `${profile === "salt_lake" ? "镜面与光线" : "天气窗口"}很好，可按原计划执行`;
  if (score >= 70) return "整体可执行，建议保留少量机动时间";
  if (score >= 50) return "存在天气干扰，建议缩短停留并准备备选方案";
  return "天气风险较高，优先执行 Plan B 或调整时段";
}

export function assessActivityWeather(
  profile: WeatherProfile,
  weather: WeatherWindowSnapshot | null,
): TripWeatherAssessment {
  if (weather === null) {
    return {
      score: profile === "indoor" ? 90 : 55,
      riskLevel: profile === "indoor" ? "low" : "medium",
      summary: profile === "indoor" ? "室内活动受天气影响较小" : "天气数据暂不可用，请临近出发复核",
      reasons: ["缺少天气窗口数据"],
    };
  }

  const rain = valueOr(weather.rainProbability, 35);
  const wind = valueOr(weather.windSpeedKph, 12);
  const gust = valueOr(weather.windGustKph, wind * 1.4);
  const cloud = valueOr(weather.cloudCover, 50);
  const uv = valueOr(weather.uvIndex, 5);
  const tempMax = valueOr(weather.temperatureMaxC, 24);
  const tempMin = valueOr(weather.temperatureMinC, 14);
  const visibility = valueOr(weather.visibilityM, 12_000);

  let score = 100;
  const reasons: string[] = [];

  switch (profile) {
    case "salt_lake": {
      score -= rain * 0.42;
      score -= Math.max(0, wind - 8) * 2.3;
      score -= Math.max(0, gust - 22) * 0.7;
      score -= Math.max(0, cloud - 65) * 0.35;
      if (visibility < 10_000) score -= 12;
      if (wind <= 10) reasons.push("风速较低，湖面更容易形成倒影");
      else reasons.push("风速偏高，天空之镜效果可能下降");
      if (rain >= 45) reasons.push("降雨概率较高，建议缩短盐湖停留");
      break;
    }
    case "sunset": {
      score -= rain * 0.5;
      score -= Math.max(0, wind - 24) * 0.8;
      if (cloud < 12) score -= 8;
      if (cloud > 75) score -= (cloud - 75) * 0.7;
      if (cloud >= 20 && cloud <= 60) reasons.push("云量适中，日落层次更丰富");
      if (rain >= 40) reasons.push("降雨可能遮挡日落光线");
      break;
    }
    case "desert": {
      score -= rain * 0.25;
      score -= Math.max(0, wind - 25) * 1.5;
      score -= Math.max(0, tempMax - 34) * 3.2;
      score -= Math.max(0, uv - 8) * 2;
      if (tempMax >= 35) reasons.push("高温明显，应避开正午并增加午休");
      if (wind >= 28) reasons.push("风力偏大，骑骆驼和滑沙体验可能受影响");
      break;
    }
    case "mountain": {
      score -= rain * 0.42;
      score -= Math.max(0, wind - 22) * 1.1;
      score -= Math.max(0, 7 - tempMin) * 2;
      if (rain >= 40) reasons.push("山区降雨会增加道路与台阶湿滑风险");
      if (tempMin <= 10) reasons.push("早晨偏凉，老人儿童需要保暖层");
      break;
    }
    case "lake": {
      score -= rain * 0.4;
      score -= Math.max(0, wind - 16) * 1.4;
      score -= Math.max(0, cloud - 80) * 0.4;
      if (visibility < 10_000) score -= 12;
      if (rain >= 40) reasons.push("湖边可能有阵雨，建议优先上午游览");
      if (wind >= 20) reasons.push("湖边风大，体感温度会进一步下降");
      break;
    }
    case "city_night": {
      score -= rain * 0.35;
      score -= Math.max(0, wind - 28) * 0.7;
      score -= Math.max(0, 8 - tempMin) * 1.5;
      if (rain >= 45) reasons.push("夜景与夜市体验可能受降雨影响");
      break;
    }
    case "transit": {
      score -= rain * 0.18;
      score -= Math.max(0, wind - 35) * 0.6;
      if (rain >= 55) reasons.push("降雨可能增加道路与航班延误风险");
      break;
    }
    case "indoor": {
      score -= rain * 0.05;
      score -= Math.max(0, tempMax - 40) * 0.5;
      reasons.push("室内项目可作为恶劣天气下的稳定锚点");
      break;
    }
  }

  const normalized = clamp(score);
  if (reasons.length === 0) reasons.push("当前指标未触发明显天气风险");
  return {
    score: normalized,
    riskLevel: riskLevel(normalized),
    summary: weatherLabel(profile, normalized),
    reasons,
  };
}
