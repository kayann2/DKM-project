/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useCallback, useMemo, useRef } from 'react';
import { ArrowDown } from 'lucide-react';
import { DkmCubeCanvas } from './components/DkmCubeCanvas';
import { WhatsAppQuoteForm } from './components/WhatsAppQuoteForm';
import {
  CubeScrollState,
  STORY_CHAPTERS_META,
  computeWordFragmentTransform,
} from './utils/scrollPhysics';

interface ChapterTokenized {
  id: string;
  index: number;
  kicker: string;
  headlineWords: string[];
  subheadlineWords: string[];
  metricValue: string;
  metricLabel: string;
  align: 'left' | 'right' | 'center';
  totalTokens: number;
}

export default function App() {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const introPromptRef = useRef<HTMLDivElement | null>(null);
  const ambientScrollHintRef = useRef<HTMLDivElement | null>(null);
  const formSectionRef = useRef<HTMLElement | null>(null);
  const formWrapperRef = useRef<HTMLDivElement | null>(null);

  // Refs for direct 60 FPS DOM manipulation (Zero React re-renders during scroll)
  const chapterSectionRefs = useRef<(HTMLElement | null)[]>([]);
  const chapterContainerRefs = useRef<(HTMLDivElement | null)[]>([]);
  const chapterWordRefs = useRef<Map<string, HTMLSpanElement>>(new Map());
  const chapterEmberRefs = useRef<Map<string, HTMLSpanElement>>(new Map());
  const lastChapterSigRef = useRef<string[]>(['', '', '']);

  const tokenizedChapters = useMemo<ChapterTokenized[]>(() => {
    return STORY_CHAPTERS_META.map((meta, index) => {
      const headlineWords = meta.headline.split(' ');
      const subheadlineWords = meta.subheadline.split(' ');
      // 1 token for kicker + headlineWords + subheadlineWords + 1 token for metric/CTA
      const totalTokens = 1 + headlineWords.length + subheadlineWords.length + 1;
      return {
        id: meta.id,
        index,
        kicker: meta.kicker,
        headlineWords,
        subheadlineWords,
        metricValue: meta.metricValue,
        metricLabel: meta.metricLabel,
        align: meta.align,
        totalTokens,
      };
    });
  }, []);

  const scrollToFraction = useCallback((fraction: number) => {
    const maxScroll = Math.max(
      1,
      document.documentElement.scrollHeight - window.innerHeight
    );
    window.scrollTo({
      top: maxScroll * fraction,
      behavior: 'smooth',
    });
  }, []);

  const setWordRef = useCallback(
    (key: string) => (el: HTMLSpanElement | null) => {
      if (el) {
        chapterWordRefs.current.set(key, el);
      } else {
        chapterWordRefs.current.delete(key);
      }
    },
    []
  );

  const setEmberRef = useCallback(
    (key: string) => (el: HTMLSpanElement | null) => {
      if (el) {
        chapterEmberRefs.current.set(key, el);
      } else {
        chapterEmberRefs.current.delete(key);
      }
    },
    []
  );

  /**
   * Direct DOM frame controller invoked from DkmCubeCanvas's requestAnimationFrame loop.
   * Updates only active elements via GPU-composited transform & opacity without React re-renders.
   */
  const handleFrameStateChange = useCallback(
    (state: CubeScrollState) => {
      if (rootRef.current) {
        rootRef.current.dataset.act = String(state.activeAct);
        rootRef.current.dataset.landed =
          state.landingFactor > 0.9 ? 'true' : 'false';
      }

      // 1. Update initial "Scroll Down" prompt at p=0 (when no story text is on screen)
      if (introPromptRef.current) {
        const op = state.introPromptOpacity;
        introPromptRef.current.style.opacity = String(op);
        introPromptRef.current.style.transform = `translate3d(-50%, ${(1 - op) * 18}px, 0)`;
        introPromptRef.current.style.pointerEvents = op > 0.2 ? 'auto' : 'none';
        introPromptRef.current.style.visibility =
          op > 0.01 ? 'visible' : 'hidden';
      }

      // 2. Subtle bottom scroll progress hint during Acts 1..3
      if (ambientScrollHintRef.current) {
        const showHint =
          state.scrollProgress > 0.06 && state.formOpacity < 0.25 ? 1 : 0;
        ambientScrollHintRef.current.style.opacity = String(showHint * 0.75);
      }

      // 3. Update Disintegrating Floating Chapters (only touches DOM when chapter state changes)
      for (let cIdx = 0; cIdx < state.chapters.length; cIdx++) {
        const ch = state.chapters[cIdx];
        const sig = `${ch.opacity}:${ch.assembleProgress}:${ch.disintegrateProgress}`;
        if (lastChapterSigRef.current[cIdx] === sig) continue;
        lastChapterSigRef.current[cIdx] = sig;

        const secEl = chapterSectionRefs.current[cIdx];
        const innerEl = chapterContainerRefs.current[cIdx];
        if (!secEl || !innerEl) continue;

        if (ch.opacity <= 0.005) {
          secEl.style.opacity = '0';
          secEl.style.visibility = 'hidden';
          secEl.setAttribute('aria-hidden', 'true');
          innerEl.style.pointerEvents = 'none';
          continue;
        }

        secEl.style.visibility = 'visible';
        secEl.style.opacity = '1';
        secEl.setAttribute('aria-hidden', 'false');
        innerEl.style.pointerEvents = ch.opacity > 0.35 ? 'auto' : 'none';

        const meta = tokenizedChapters[cIdx];
        const total = meta.totalTokens;

        for (let wIdx = 0; wIdx < total; wIdx++) {
          const key = `${ch.id}-w-${wIdx}`;
          const wordEl = chapterWordRefs.current.get(key);
          if (!wordEl) continue;

          const frag = computeWordFragmentTransform(
            wIdx,
            total,
            ch.assembleProgress,
            ch.disintegrateProgress
          );
          wordEl.style.opacity = String(frag.opacity);
          wordEl.style.transform =
            frag.tx === 0 && frag.ty === 0 && frag.rotDeg === 0 && frag.scale === 1
              ? 'none'
              : `translate3d(${frag.tx}px, ${frag.ty}px, 0) rotate(${frag.rotDeg}deg) scale(${frag.scale})`;

          const emberEl = chapterEmberRefs.current.get(key);
          if (emberEl) {
            emberEl.style.opacity = String(frag.emberOpacity);
            if (frag.emberOpacity > 0.02) {
              emberEl.style.transform = `translate3d(${(frag.tx * 1.35).toFixed(1)}px, ${(frag.ty * 1.45 - 8).toFixed(1)}px, 0) scale(${(0.6 + frag.emberOpacity * 0.8).toFixed(2)})`;
            }
          }
        }
      }

      // 4. Update Final WhatsApp Form Stage
      if (formSectionRef.current && formWrapperRef.current) {
        formSectionRef.current.style.opacity = String(state.formOpacity);
        formSectionRef.current.style.transform = `translate3d(0, ${state.formTranslateY}px, 0)`;
        formWrapperRef.current.style.pointerEvents =
          state.formOpacity > 0.2 ? 'auto' : 'none';
      }
    },
    [tokenizedChapters]
  );

  return (
    <div
      ref={rootRef}
      data-act="0"
      data-landed="false"
      className="relative min-h-[440vh] studio-vignette text-[#F8FAFC] selection:bg-[#0066FF] selection:text-white"
    >
      {/* 1. Fixed 3D Instanced Prismatic Glass Rubik's Cube + GPU Fireflies */}
      <DkmCubeCanvas onFrameStateChange={handleFrameStateChange} />

      {/* 2. Minimalist Top Bar Contract: Strictly 3 Zones separated by gap-8 */}
      <header className="fixed top-0 left-0 right-0 z-30 flex items-center justify-between gap-8 px-6 sm:px-12 py-5 bg-gradient-to-b from-[#020408]/90 via-[#020408]/45 to-transparent">
        {/* Zone 1: Single text element wordmark */}
        <a
          href="#inicio"
          onClick={(e) => {
            e.preventDefault();
            scrollToFraction(0);
          }}
          className="text-xl font-extrabold tracking-tight text-white font-display whitespace-nowrap shrink-0"
        >
          DKM
        </a>

        {/* Zone 2: Concise single-line navigation links */}
        <nav
          aria-label="Navegação da história"
          className="hidden md:flex items-center gap-8 text-sm font-medium text-slate-300"
        >
          <button
            type="button"
            onClick={() => scrollToFraction(0.19)}
            className="hover:text-white hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            Estúdio
          </button>
          <button
            type="button"
            onClick={() => scrollToFraction(0.45)}
            className="hover:text-white hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            Engenharia
          </button>
          <button
            type="button"
            onClick={() => scrollToFraction(0.68)}
            className="hover:text-white hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            Conversão
          </button>
          <button
            type="button"
            onClick={() => scrollToFraction(1.0)}
            className="hover:text-white hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            Cotação
          </button>
        </nav>

        {/* Zone 3: 1 primary action */}
        <div className="flex items-center shrink-0">
          <button
            type="button"
            onClick={() => scrollToFraction(1.0)}
            className="px-4 py-2 text-xs font-bold text-white bg-[#0066FF] hover:bg-[#0052CC] rounded-lg transition-transform active:scale-95 whitespace-nowrap shrink-0 cursor-pointer"
          >
            Solicitar Cotação
          </button>
        </div>
      </header>

      {/* 3. Fixed Scrollytelling Overlay: Starts with ZERO text at p=0, then Disintegrating Typography */}
      <main className="fixed inset-0 z-10 pointer-events-none flex flex-col justify-center">
        <div className="relative w-full max-w-[1380px] mx-auto px-6 sm:px-12 h-full flex items-center">
          {tokenizedChapters.map((chapter, cIdx) => {
            const isRight = chapter.align === 'right';
            let tokenCursor = 0;
            const kickerTokenIdx = tokenCursor++;
            const headlineStartIdx = tokenCursor;
            tokenCursor += chapter.headlineWords.length;
            const subStartIdx = tokenCursor;
            tokenCursor += chapter.subheadlineWords.length;
            const footerTokenIdx = tokenCursor;

            return (
              <section
                key={chapter.id}
                ref={(el) => {
                  chapterSectionRefs.current[cIdx] = el;
                }}
                aria-hidden="true"
                style={{ opacity: 0, visibility: 'hidden' }}
                className={`absolute inset-x-6 sm:inset-x-12 bottom-16 sm:bottom-auto sm:top-1/2 sm:-translate-y-1/2 flex flex-col ${
                  isRight
                    ? 'items-start lg:items-end lg:text-right'
                    : 'items-start text-left'
                }`}
              >
                <div
                  ref={(el) => {
                    chapterContainerRefs.current[cIdx] = el;
                  }}
                  className="max-w-[440px] floating-text-glow pointer-events-none"
                >
                  {/* Kicker Fragment */}
                  <div className="text-xs font-mono tracking-widest text-sky-400 uppercase mb-3">
                    <span
                      ref={setWordRef(`${chapter.id}-w-${kickerTokenIdx}`)}
                      className="word-fragment"
                    >
                      {chapter.kicker}
                    </span>
                  </div>

                  {/* Headline with Per-Word Disintegration & Glowing Ember Shards */}
                  <h1
                    className={`font-display font-extrabold tracking-tight text-white leading-[1.08] flex flex-wrap gap-x-[0.28em] gap-y-1 ${
                      isRight ? 'lg:justify-end' : 'justify-start'
                    }`}
                    style={{
                      fontSize: 'clamp(2.05rem, 3.5vw, 3.4rem)',
                    }}
                  >
                    {chapter.headlineWords.map((word, wOffset) => {
                      const tIdx = headlineStartIdx + wOffset;
                      const key = `${chapter.id}-w-${tIdx}`;
                      return (
                        <span key={key} className="relative inline-block">
                          <span ref={setWordRef(key)} className="word-fragment">
                            {word}
                          </span>
                          {/* Luminous disintegration spark particle */}
                          <span
                            ref={setEmberRef(key)}
                            aria-hidden="true"
                            style={{ opacity: 0 }}
                            className="pointer-events-none absolute -top-1 right-0 w-1.5 h-1.5 rounded-full bg-cyan-400 shadow-[0_0_8px_#00f0ff]"
                          />
                        </span>
                      );
                    })}
                  </h1>

                  {/* Subheadline with Per-Word Disintegration */}
                  <p
                    className={`mt-4 text-sm sm:text-base text-slate-300 leading-relaxed font-normal flex flex-wrap gap-x-[0.26em] gap-y-0.5 ${
                      isRight ? 'lg:justify-end' : 'justify-start'
                    }`}
                  >
                    {chapter.subheadlineWords.map((word, sOffset) => {
                      const tIdx = subStartIdx + sOffset;
                      const key = `${chapter.id}-w-${tIdx}`;
                      return (
                        <span
                          key={key}
                          ref={setWordRef(key)}
                          className="word-fragment"
                        >
                          {word}
                        </span>
                      );
                    })}
                  </p>

                  {/* Metric + Primary Action Fragment */}
                  <div
                    ref={setWordRef(`${chapter.id}-w-${footerTokenIdx}`)}
                    className="word-fragment mt-6 w-full"
                  >
                    <div
                      className={`flex items-baseline gap-3 ${
                        isRight ? 'lg:justify-end' : 'justify-start'
                      }`}
                    >
                      <span className="text-2xl sm:text-3xl font-extrabold font-mono text-white tabular-nums">
                        {chapter.metricValue}
                      </span>
                      <span className="text-xs text-slate-400">
                        · {chapter.metricLabel}
                      </span>
                    </div>

                    {chapter.index === 0 && (
                      <div className="mt-6">
                        <button
                          type="button"
                          onClick={() => scrollToFraction(1.0)}
                          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-bold text-white bg-[#0066FF] hover:bg-[#0052CC] transition-transform active:scale-95 cursor-pointer whitespace-nowrap shrink-0"
                        >
                          <span>Iniciar Projeto</span>
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </section>
            );
          })}
        </div>

        {/* Initial Stage (p=0): Clean Text-Free Screen with Prominent Scroll Down Indicator */}
        <div
          ref={introPromptRef}
          data-testid="intro-scroll-indicator"
          className="fixed bottom-9 left-1/2 -translate-x-1/2 flex flex-col items-center gap-3 pointer-events-auto"
        >
          <button
            type="button"
            onClick={() => scrollToFraction(0.19)}
            aria-label="Rolar para baixo e iniciar animação"
            className="group flex flex-col items-center gap-2.5 cursor-pointer focus:outline-none"
          >
            {/* Animated Mouse / Scroll Capsule */}
            <div className="w-6 h-10 rounded-full border border-sky-400/50 bg-[#040914]/80 flex items-start justify-center p-1.5 group-hover:border-sky-400 transition-colors">
              <span className="w-1.5 h-2 rounded-full bg-sky-400 scroll-wheel-dot" />
            </div>
            <span className="text-xs font-mono tracking-[0.22em] text-slate-300 group-hover:text-white uppercase transition-colors">
              Role para baixo
            </span>
          </button>
        </div>

        {/* Subtle Scroll Indicator during Acts 1..3 */}
        <div
          ref={ambientScrollHintRef}
          style={{ opacity: 0 }}
          className="fixed bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-2 pointer-events-none transition-opacity duration-200"
        >
          <span className="text-[11px] font-mono tracking-widest text-slate-400 uppercase">
            Continue rolando
          </span>
          <ArrowDown className="w-3.5 h-3.5 text-sky-400/80" />
        </div>
      </main>

      {/* 4. Final Stage: When the Glass Cube Finishes Solving & Stops Above, the Quote Form Appears */}
      <div className="relative z-20 pointer-events-none">
        {/* Scroll Track Spacer for the Intro + 3 Disintegrating Typography Acts */}
        <div id="inicio" className="h-[340vh] w-full" aria-hidden="true" />

        {/* Final Landing & Direct WhatsApp Conversion Stage */}
        <section
          id="cotacao"
          ref={formSectionRef}
          style={{
            opacity: 0,
            transform: 'translate3d(0, 32px, 0)',
          }}
          className="min-h-screen w-full max-w-[1380px] mx-auto px-6 sm:px-12 pt-16 pb-10 flex flex-col justify-end items-center"
        >
          {/* Upper clearance kept open so the solved Prismatic Glass Cube floats visibly ABOVE the form title */}
          <div className="w-full h-[210px] sm:h-[250px]" aria-hidden="true" />

          <div
            ref={formWrapperRef}
            className="w-full pointer-events-none"
          >
            <WhatsAppQuoteForm />
          </div>

          <footer className="w-full max-w-2xl mx-auto mt-8 pt-4 border-t border-slate-900/80 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500 pointer-events-auto">
            <span className="font-display font-bold text-slate-300">
              DKM — Desenvolvimento de Sites Independentes
            </span>
            <button
              type="button"
              onClick={() => scrollToFraction(0)}
              className="hover:text-white transition-colors cursor-pointer"
            >
              Voltar ao topo
            </button>
          </footer>
        </section>
      </div>
    </div>
  );
}
