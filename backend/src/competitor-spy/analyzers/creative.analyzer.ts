import { RawAd, CreativeType, AdFormat, FatigueLevel } from '../dto/spy-result.dto';

const CREATIVE_PATTERNS: Record<CreativeType, string[]> = {
  ugc: ['yo', 'me ', 'probé', 'compré', 'mi experiencia', 'lo uso', 'me encanta', 'honestamente', 'te cuento', 'descubrí'],
  problem_solution: ['¿sufres', 'cansad', 'ya no más', 'deja de', 'solución', 'problema', '¿te pasa', '¿tienes', 'funciona para'],
  lifestyle: ['rutina', 'estilo', 'vida', 'lifestyle', 'imprescindible', 'amamos', 'perfecta para', 'cada día'],
  offer: ['oferta', 'descuento', 'gratis', '% off', '2x1', 'aprovecha', 'precio especial', 'hoy solo', 'envío gratis'],
  demo: ['así funciona', 'mira cómo', 'paso a paso', 'demo', 'resultado en', 'efectos en'],
  before_after: ['antes', 'después', 'transformación', 'resultados reales', 'cambio en', 'diferencia'],
  unknown: [],
};

export function detectCreativeType(adCopy: string): CreativeType {
  const lower = adCopy.toLowerCase();
  let best: CreativeType = 'unknown';
  let bestScore = 0;

  for (const [type, keywords] of Object.entries(CREATIVE_PATTERNS) as [CreativeType, string[]][]) {
    if (type === 'unknown') continue;
    const score = keywords.filter(kw => lower.includes(kw)).length;
    if (score > bestScore) {
      bestScore = score;
      best = type;
    }
  }
  return best;
}

const CREATIVE_LABELS: Record<CreativeType, { label: string; emoji: string }> = {
  ugc: { label: 'UGC (experiencia personal)', emoji: '🎤' },
  problem_solution: { label: 'Problema / Solución', emoji: '💡' },
  lifestyle: { label: 'Lifestyle', emoji: '✨' },
  offer: { label: 'Oferta agresiva', emoji: '🏷️' },
  demo: { label: 'Demostración de producto', emoji: '🎯' },
  before_after: { label: 'Antes / Después', emoji: '🔄' },
  unknown: { label: 'Sin patrón dominante', emoji: '❓' },
};

export interface DominantCreativeResult {
  type: CreativeType;
  label: string;
  emoji: string;
  percentage: number;
}

export function detectDominantCreativeType(ads: RawAd[]): DominantCreativeResult {
  if (ads.length === 0) return { type: 'unknown', label: 'Sin patrón dominante', emoji: '❓', percentage: 0 };

  const counts: Record<string, number> = {};
  for (const ad of ads) {
    const type = detectCreativeType(ad.adCopy);
    counts[type] = (counts[type] ?? 0) + 1;
  }

  const dominant = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
  const type = dominant[0] as CreativeType;
  const { label, emoji } = CREATIVE_LABELS[type];
  const percentage = Math.round((dominant[1] / ads.length) * 100);

  return { type, label, emoji, percentage };
}

export interface FormatResult {
  format: AdFormat;
  videoCount: number;
  imageCount: number;
  percentage: number;
  label: string;
  emoji: string;
}

export function detectFormatWinner(ads: RawAd[]): FormatResult {
  const videoCount = ads.filter(a => a.format === 'video').length;
  const imageCount = ads.filter(a => a.format === 'image' || a.format === 'carousel').length;
  const total = Math.max(ads.length, 1);

  const isVideo = videoCount >= imageCount;
  const winnerCount = isVideo ? videoCount : imageCount;

  return {
    format: isVideo ? 'video' : 'image',
    videoCount,
    imageCount,
    percentage: Math.round((winnerCount / total) * 100),
    label: isVideo ? 'Convierte mejor en videos' : 'Convierte mejor en imágenes',
    emoji: isVideo ? '🎥' : '🖼️',
  };
}

export interface FatigueResult {
  level: FatigueLevel;
  label: string;
  emoji: string;
}

export function detectCreativeFatigue(ads: RawAd[]): FatigueResult {
  if (ads.length === 0) return { level: 'low', label: 'Creatividad poco explotada', emoji: '🟢' };

  // Fatigue: check if many ads use same format + same creative type
  const videoRatio = ads.filter(a => a.format === 'video').length / ads.length;
  const imageRatio = 1 - videoRatio;
  const dominantFormatRatio = Math.max(videoRatio, imageRatio);

  const types = ads.map(a => detectCreativeType(a.adCopy));
  const typeCounts: Record<string, number> = {};
  for (const t of types) typeCounts[t] = (typeCounts[t] ?? 0) + 1;
  const dominantTypeCount = Math.max(...Object.values(typeCounts));
  const dominantTypeRatio = dominantTypeCount / ads.length;

  const fatigueScore = (dominantFormatRatio * 0.4 + dominantTypeRatio * 0.6) * 100;

  if (fatigueScore >= 75) return { level: 'high', label: 'Alta fatiga creativa detectada', emoji: '⚠️' };
  if (fatigueScore >= 50) return { level: 'medium', label: 'Fatiga creativa moderada', emoji: '🟡' };
  return { level: 'low', label: 'Creatividad poco explotada', emoji: '🟢' };
}
