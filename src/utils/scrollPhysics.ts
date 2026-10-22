export interface FloatingChapterState {
  id: string;
  index: number;
  kicker: string;
  headline: string;
  subheadline: string;
  metricLabel?: string;
  metricValue?: string;
  align: 'center' | 'left' | 'right';
  opacity: number;
  assembleProgress: number;
  disintegrateProgress: number;
  translateY: number;
  scale: number;
  active: boolean;
}

export interface WordFragmentTransform {
  tx: number;
  ty: number;
  rotDeg: number;
  scale: number;
  opacity: number;
  emberOpacity: number;
}

export interface RubikSliceMove {
  axis: 'x' | 'y' | 'z';
  layer: -1 | 0 | 1;
  angleRad: number;
}

export interface CubeScrollState {
  scrollProgress: number;
  activeAct: number;
  introPromptOpacity: number;
  landingFactor: number;
  floatAmplitude: number;
  cubeX: number;
  cubeY: number;
  targetRotX: number;
  targetRotY: number;
  targetRotZ: number;
  activeSliceMove: RubikSliceMove;
  chapters: FloatingChapterState[];
  formOpacity: number;
  formTranslateY: number;
  pedestalY: number;
  pedestalOpacity: number;
  contactShadowOpacity: number;
  contactShadowScale: number;
}

export function clamp01(value: number): number {
  if (Number.isNaN(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

export function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = clamp01((x - edge0) / (edge1 - edge0));
  return t * t * (3 - 2 * t);
}

export function dampValue(
  current: number,
  target: number,
  lambda: number,
  dt: number
): number {
  if (dt <= 0) return current;
  return current + (target - current) * (1 - Math.exp(-lambda * dt));
}

/**
 * Computes a smooth assemble / hold / disintegrate envelope for floating scrollytelling text.
 */
export function computeFloatingWindow(
  progress: number,
  start: number,
  peakIn: number,
  peakOut: number,
  end: number
): {
  opacity: number;
  assembleProgress: number;
  disintegrateProgress: number;
  translateY: number;
  scale: number;
  active: boolean;
} {
  if (progress <= start || progress >= end) {
    const isBefore = progress <= start;
    return {
      opacity: 0,
      assembleProgress: isBefore ? 0 : 1,
      disintegrateProgress: isBefore ? 0 : 1,
      translateY: isBefore ? 28 : -28,
      scale: 0.96,
      active: false,
    };
  }

  let opacity = 1;
  let assembleProgress = 1;
  let disintegrateProgress = 0;
  let translateY = 0;

  if (progress < peakIn) {
    const t = smoothstep(start, peakIn, progress);
    opacity = t;
    assembleProgress = t;
    translateY = (1 - t) * 24;
  } else if (progress > peakOut) {
    const t = smoothstep(peakOut, end, progress);
    opacity = 1 - t;
    disintegrateProgress = t;
    translateY = -t * 24;
  }

  const scale = 0.96 + 0.04 * opacity;
  return {
    opacity: Number(opacity.toFixed(4)),
    assembleProgress: Number(assembleProgress.toFixed(4)),
    disintegrateProgress: Number(disintegrateProgress.toFixed(4)),
    translateY: Number(translateY.toFixed(2)),
    scale: Number(scale.toFixed(4)),
    active: opacity > 0.01,
  };
}

/**
 * Computes per-word 3D disintegration & assembly vectors using purely GPU-compositable
 * translate3d / rotate / scale / opacity values (zero CSS blur filters).
 */
export function computeWordFragmentTransform(
  wordIndex: number,
  totalWords: number,
  assembleProgress: number,
  disintegrateProgress: number
): WordFragmentTransform {
  const count = Math.max(1, totalWords);
  const normIdx = count > 1 ? wordIndex / (count - 1) : 0;

  // Deterministic pseudo-random scatter vectors per word
  const s1 = Math.sin(wordIndex * 12.9898 + 4.1414) * 43758.5453;
  const s2 = Math.sin(wordIndex * 78.233 + 9.731) * 29183.1234;
  const randX = (s1 - Math.floor(s1)) * 2 - 1; // [-1, 1]
  const randY = (s2 - Math.floor(s2)) * 2 - 1; // [-1, 1]

  // Stagger window across words
  const stagger = normIdx * 0.42;

  // 1. Hold phase (fully assembled, not yet disintegrating)
  if (assembleProgress >= 0.999 && disintegrateProgress <= 0.001) {
    return {
      tx: 0,
      ty: 0,
      rotDeg: 0,
      scale: 1,
      opacity: 1,
      emberOpacity: 0,
    };
  }

  // 2. Disintegration phase (words break apart into floating shards upward & outward)
  if (disintegrateProgress > 0.001) {
    const rawD = clamp01((disintegrateProgress - stagger * 0.75) / (1 - stagger * 0.75));
    const wD = smoothstep(0, 1, rawD);
    const tx = (randX * 46 + 16) * wD;
    const ty = -(28 + Math.abs(randY) * 44) * wD;
    const rotDeg = randX * 15 * wD;
    const scale = 1 - 0.35 * wD;
    const opacity = clamp01(1 - wD * 1.15);
    const emberOpacity = Number((Math.sin(wD * Math.PI) * 0.95).toFixed(3));

    return {
      tx: Number(tx.toFixed(2)),
      ty: Number(ty.toFixed(2)),
      rotDeg: Number(rotDeg.toFixed(2)),
      scale: Number(scale.toFixed(3)),
      opacity: Number(opacity.toFixed(3)),
      emberOpacity,
    };
  }

  // 3. Assembly phase (words coalesce from scattered fragments)
  const rawA = clamp01((assembleProgress - stagger * 0.65) / (1 - stagger * 0.65));
  const wA = smoothstep(0, 1, rawA);
  const invA = 1 - wA;
  const tx = randX * 32 * invA;
  const ty = (24 + Math.abs(randY) * 26) * invA;
  const rotDeg = -randX * 11 * invA;
  const scale = 0.8 + 0.2 * wA;
  const opacity = wA;
  const emberOpacity = Number((Math.sin(wA * Math.PI) * 0.75).toFixed(3));

  return {
    tx: Number(tx.toFixed(2)),
    ty: Number(ty.toFixed(2)),
    rotDeg: Number(rotDeg.toFixed(2)),
    scale: Number(scale.toFixed(3)),
    opacity: Number(opacity.toFixed(3)),
    emberOpacity,
  };
}

export const STORY_CHAPTERS_META = [
  {
    id: 'ato-01',
    kicker: '01 · DKM Digital Studio',
    headline: 'Presença digital que transparece precisão.',
    subheadline:
      'Criamos sites independentes sob medida para marcas que exigem estética autoral, velocidade extrema e conversão real.',
    metricValue: 'Sob Medida',
    metricLabel: 'Arquitetura exclusiva do zero ao ar',
    align: 'left' as const,
    window: [0.07, 0.13, 0.25, 0.32] as const,
  },
  {
    id: 'ato-02',
    kicker: '02 · Engenharia & Design',
    headline: 'Cada movimento pensado para guiar seu cliente.',
    subheadline:
      'Sem blocos engessados ou templates prontos. Desenvolvemos experiências fluidas que prendem a atenção e constroem autoridade imediata.',
    metricValue: '60 FPS',
    metricLabel: 'Fluidez nativa em desktop e mobile',
    align: 'right' as const,
    window: [0.33, 0.39, 0.51, 0.58] as const,
  },
  {
    id: 'ato-03',
    kicker: '03 · Performance & Conversão',
    headline: 'Estrutura enxuta focada em fechar negócios.',
    subheadline:
      'Código limpo, carregamento instantâneo e jornada comercial desenhada para transformar visitantes em propostas no seu WhatsApp.',
    metricValue: '100%',
    metricLabel: 'Autonomia técnica para o seu negócio',
    align: 'left' as const,
    window: [0.59, 0.65, 0.75, 0.82] as const,
  },
];

/**
 * Computes the complete 1:1 Rubik's glass cube choreography and floating text transitions.
 * - At p = 0 (Initial Screen): NO floating story text is shown. Only the cube and the scroll indicator appear.
 * - As the user scrolls (p > 0.02): The cube starts its 1:1 global rotation + sequential 90-deg Rubik slice turns,
 *   while floating text chapters assemble and disintegrate around the cube's orbit.
 */
export function computeCubeScrollState(
  rawScrollProgress: number,
  timeSec: number
): CubeScrollState {
  const p = clamp01(rawScrollProgress);

  let activeAct = 0;
  if (p >= 0.81) {
    activeAct = 4;
  } else if (p >= 0.58) {
    activeAct = 3;
  } else if (p >= 0.32) {
    activeAct = 2;
  } else if (p >= 0.07) {
    activeAct = 1;
  }

  // Initial scroll indicator ("Role para baixo") is fully visible at p=0 and fades out once scrolling starts
  const introPromptOpacity = Number((1 - smoothstep(0.01, 0.08, p)).toFixed(4));

  // Landing phase starts at 0.80 and completes at 0.91
  const landingFactor = smoothstep(0.80, 0.91, p);

  // Floating oscillation decays to 0 as the cube stabilizes and lands
  const floatAmplitude = 1 - landingFactor;
  const waveOffset = Math.sin(timeSec * 1.5) * 0.075 * floatAmplitude;

  // Lateral X choreography on desktop:
  // Centered at p=0, shifts right (+0.68) when left text is active, shifts left (-0.68) when right text is active,
  // and returns to center (0) when landing above the quote form.
  const ch1 = computeFloatingWindow(p, ...STORY_CHAPTERS_META[0].window);
  const ch2 = computeFloatingWindow(p, ...STORY_CHAPTERS_META[1].window);
  const ch3 = computeFloatingWindow(p, ...STORY_CHAPTERS_META[2].window);

  const cubeX = Number(
    ((ch1.opacity * 0.68 - ch2.opacity * 0.68 + ch3.opacity * 0.68) * (1 - landingFactor)).toFixed(4)
  );

  // Vertical position: centered at y = 0.04 at intro & chapters, rises to REST_Y = 1.22 above the quote form at landing
  const REST_Y = 1.22;
  const cubeY =
    0.04 * (1 - landingFactor) + REST_Y * landingFactor + waveOffset;

  // 1:1 Global Cube Rotation driven directly by scroll (starts moving as user scrolls down)
  const baseRotX = 0.55;
  const baseRotY = -Math.PI / 4;
  const motionP = smoothstep(0.01, 0.92, p);

  const targetRotY = baseRotY + motionP * Math.PI * 2.0;
  const targetRotX =
    baseRotX + Math.sin(motionP * Math.PI * 2.0) * 0.36 * (1 - landingFactor);
  const targetRotZ =
    Math.sin(motionP * Math.PI * 2.0) * 0.20 * (1 - landingFactor);

  // Sequential 1:1 Rubik's Cube slice rotation (starts at 0 when p=0, then rotates layers as user scrolls)
  let activeSliceMove: RubikSliceMove = { axis: 'y', layer: 1, angleRad: 0 };
  if (p < 0.32) {
    const t = smoothstep(0.02, 0.30, p);
    activeSliceMove = {
      axis: 'y',
      layer: 1,
      angleRad: Math.sin(t * Math.PI) * (Math.PI / 2),
    };
  } else if (p < 0.58) {
    const t = smoothstep(0.33, 0.56, p);
    activeSliceMove = {
      axis: 'x',
      layer: 1,
      angleRad: -Math.sin(t * Math.PI) * (Math.PI / 2),
    };
  } else if (p < 0.81) {
    const t = smoothstep(0.59, 0.79, p);
    activeSliceMove = {
      axis: 'z',
      layer: 1,
      angleRad: Math.sin(t * Math.PI) * (Math.PI / 2),
    };
  } else {
    const t = smoothstep(0.81, 0.91, p);
    activeSliceMove = {
      axis: 'y',
      layer: 0,
      angleRad: (1 - t) * (Math.PI / 3),
    };
  }

  const rawWindows = [ch1, ch2, ch3];
  const chapters: FloatingChapterState[] = STORY_CHAPTERS_META.map(
    (meta, idx) => {
      const win = rawWindows[idx];
      return {
        id: meta.id,
        index: idx,
        kicker: meta.kicker,
        headline: meta.headline,
        subheadline: meta.subheadline,
        metricLabel: meta.metricLabel,
        metricValue: meta.metricValue,
        align: meta.align,
        opacity: win.opacity,
        assembleProgress: win.assembleProgress,
        disintegrateProgress: win.disintegrateProgress,
        translateY: win.translateY,
        scale: win.scale,
        active: win.active,
      };
    }
  );

  // Final WhatsApp Form Fade-In as the cube stops at the end (p: 0.81 -> 0.91)
  const formReveal = smoothstep(0.81, 0.91, p);
  const formOpacity = Number(formReveal.toFixed(4));
  const formTranslateY = Number(((1 - formReveal) * 32).toFixed(2));

  // Subtle dark glass reflection surface under the landed cube
  const pedestalReveal = smoothstep(0.79, 0.90, p);
  const pedestalY = -1.2 * (1 - pedestalReveal) + REST_Y * pedestalReveal;
  const pedestalOpacity = Number(pedestalReveal.toFixed(4));

  const heightAboveTable = Math.max(0, cubeY - pedestalY);
  const proximity = clamp01(1 - heightAboveTable / 1.0);
  const contactShadowOpacity = Number(
    (pedestalOpacity * (0.3 + 0.6 * proximity)).toFixed(4)
  );
  const contactShadowScale = Number((1.25 - 0.25 * proximity).toFixed(4));

  return {
    scrollProgress: p,
    activeAct,
    introPromptOpacity,
    landingFactor,
    floatAmplitude,
    cubeX,
    cubeY,
    targetRotX,
    targetRotY,
    targetRotZ,
    activeSliceMove,
    chapters,
    formOpacity,
    formTranslateY,
    pedestalY,
    pedestalOpacity,
    contactShadowOpacity,
    contactShadowScale,
  };
}
