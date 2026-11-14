import { CakeFlavor } from './types';

export const CAKE_FLAVORS: CakeFlavor[] = [
  {
    id: 'pure-gold',
    name: '24K 足金條',
    sponge: '#F4C430',
    spongeShade: '#C68B12',
    filling: '#FCE38A',
    frosting: '#FFE97F',
    frostingHighlight: '#FFFBEB',
    accent: '#9A630A',
    dripCountSeed: 1,
  },
  {
    id: 'champagne-gold',
    name: '香檳金條',
    sponge: '#EBC86E',
    spongeShade: '#B68E35',
    filling: '#F8E3A3',
    frosting: '#FAECBC',
    frostingHighlight: '#FFFFFF',
    accent: '#8C681B',
    dripCountSeed: 2,
  },
  {
    id: 'rose-gold',
    name: '18K 玫瑰金條',
    sponge: '#E6A387',
    spongeShade: '#B26B50',
    filling: '#F6CBB8',
    frosting: '#FAD8C9',
    frostingHighlight: '#FFF5F0',
    accent: '#884730',
    dripCountSeed: 3,
  },
  {
    id: 'imperial-gold',
    name: '古法鍛金條',
    sponge: '#E5A922',
    spongeShade: '#A96B08',
    filling: '#F7CE5B',
    frosting: '#FCD975',
    frostingHighlight: '#FEF9C3',
    accent: '#784605',
    dripCountSeed: 4,
  },
  {
    id: 'white-gold',
    name: '鉑金紀念條',
    sponge: '#DCE2EA',
    spongeShade: '#98A4B3',
    filling: '#F1F5F9',
    frosting: '#F8FAFC',
    frostingHighlight: '#FFFFFF',
    accent: '#64748B',
    dripCountSeed: 5,
  },
];

export function getFlavorForTier(tierIndex: number): CakeFlavor {
  return CAKE_FLAVORS[tierIndex % CAKE_FLAVORS.length];
}

interface SkyStop {
  layers: number;
  top: [number, number, number];
  bottom: [number, number, number];
}

const SKY_STOPS: SkyStop[] = [
  // Clean warm gallery stone / sunlit bullion room
  { layers: 0, top: [228, 232, 238], bottom: [246, 244, 240] },
  // Warm golden dusk
  { layers: 12, top: [215, 206, 200], bottom: [243, 232, 214] },
  // Amber twilight
  { layers: 24, top: [130, 128, 152], bottom: [226, 189, 154] },
  // Deep vault sapphire
  { layers: 38, top: [39, 48, 79], bottom: [108, 102, 136] },
  // Midnight starry treasury sky
  { layers: 54, top: [15, 23, 42], bottom: [42, 52, 84] },
];

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function getSkyGradientColors(layers: number): {
  top: string;
  bottom: string;
  nightFactor: number;
} {
  let prev = SKY_STOPS[0];
  let next = SKY_STOPS[SKY_STOPS.length - 1];

  for (let i = 0; i < SKY_STOPS.length - 1; i++) {
    if (layers >= SKY_STOPS[i].layers && layers <= SKY_STOPS[i + 1].layers) {
      prev = SKY_STOPS[i];
      next = SKY_STOPS[i + 1];
      break;
    }
    if (layers > SKY_STOPS[SKY_STOPS.length - 1].layers) {
      prev = SKY_STOPS[SKY_STOPS.length - 1];
      next = SKY_STOPS[SKY_STOPS.length - 1];
    }
  }

  const span = Math.max(1, next.layers - prev.layers);
  const t = Math.min(1, Math.max(0, (layers - prev.layers) / span));

  const topR = Math.round(lerp(prev.top[0], next.top[0], t));
  const topG = Math.round(lerp(prev.top[1], next.top[1], t));
  const topB = Math.round(lerp(prev.top[2], next.top[2], t));

  const botR = Math.round(lerp(prev.bottom[0], next.bottom[0], t));
  const botG = Math.round(lerp(prev.bottom[1], next.bottom[1], t));
  const botB = Math.round(lerp(prev.bottom[2], next.bottom[2], t));

  const nightFactor = Math.min(1, Math.max(0, (layers - 20) / 22));

  return {
    top: `rgb(${topR}, ${topG}, ${topB})`,
    bottom: `rgb(${botR}, ${botG}, ${botB})`,
    nightFactor,
  };
}
