import { SaturationLevel } from '../dto/spy-result.dto';

export function calculateOpportunityScore(
  saturationScore: number,
  competitorCount: number,
  avgDaysActive: number,
): number {
  // Base: invert saturation (high saturation = low opportunity)
  let score = 100 - saturationScore;

  // Penalize heavily populated markets
  if (competitorCount > 30) score -= 15;
  else if (competitorCount > 15) score -= 8;
  else if (competitorCount < 5) score += 10; // few competitors = opportunity

  // Very long-running ads = established product = harder to enter
  if (avgDaysActive > 90) score -= 10;
  else if (avgDaysActive > 60) score -= 5;
  // Short-running ads = product might not be validated yet — neutral

  return Math.max(5, Math.min(99, Math.round(score)));
}

export function getOpportunityLabel(score: number): { emoji: string; label: string } {
  if (score >= 80) return { emoji: '🔥', label: 'Oportunidad excepcional' };
  if (score >= 65) return { emoji: '✅', label: 'Buena oportunidad' };
  if (score >= 45) return { emoji: '⚡', label: 'Oportunidad moderada' };
  if (score >= 25) return { emoji: '⚠️', label: 'Mercado competitivo' };
  return { emoji: '🔴', label: 'Mercado muy saturado' };
}
