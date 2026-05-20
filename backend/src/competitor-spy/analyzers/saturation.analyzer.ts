import { RawAd, SaturationLevel } from '../dto/spy-result.dto';

export interface SaturationResult {
  level: SaturationLevel;
  score: number;
  emoji: string;
  label: string;
}

export function analyzeSaturation(ads: RawAd[], competitorCount: number): SaturationResult {
  let score = 0;

  // Factor 1: total ads (0-40 pts)
  if (ads.length >= 50) score += 40;
  else if (ads.length >= 25) score += 25;
  else if (ads.length >= 10) score += 15;
  else score += ads.length * 1.5;

  // Factor 2: unique competitors (0-30 pts)
  if (competitorCount >= 20) score += 30;
  else if (competitorCount >= 10) score += 20;
  else if (competitorCount >= 5) score += 12;
  else score += competitorCount * 2;

  // Factor 3: avg days active — established market = more saturated (0-30 pts)
  const avgDays = ads.length > 0
    ? ads.reduce((s, a) => s + a.daysActive, 0) / ads.length
    : 0;
  if (avgDays >= 60) score += 30;
  else if (avgDays >= 30) score += 20;
  else if (avgDays >= 14) score += 10;
  else score += Math.floor(avgDays / 3);

  score = Math.min(100, Math.round(score));

  let level: SaturationLevel;
  let emoji: string;
  let label: string;

  if (score >= 65) {
    level = 'high';
    emoji = '🔴';
    label = 'Alta saturación';
  } else if (score >= 35) {
    level = 'medium';
    emoji = '🟡';
    label = 'Saturación media';
  } else {
    level = 'low';
    emoji = '🟢';
    label = 'Baja saturación';
  }

  return { level, score, emoji, label };
}
