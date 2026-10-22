import test from 'node:test';
import assert from 'node:assert/strict';
import {
  clamp01,
  smoothstep,
  computeFloatingWindow,
  computeWordFragmentTransform,
  computeCubeScrollState,
} from './scrollPhysics';
import {
  validateQuoteForm,
  formatPhoneDisplay,
  buildWhatsAppMessage,
  buildWhatsAppUrl,
} from './whatsappForm';

test('clamp01 and smoothstep bound values accurately', () => {
  assert.equal(clamp01(-0.5), 0);
  assert.equal(clamp01(1.8), 1);
  assert.equal(clamp01(0.4), 0.4);
  assert.equal(smoothstep(0.2, 0.8, 0.1), 0);
  assert.equal(smoothstep(0.2, 0.8, 0.9), 1);
  assert.ok(Math.abs(smoothstep(0.2, 0.8, 0.5) - 0.5) < 1e-12);
});

test('computeFloatingWindow and computeWordFragmentTransform handle assembly, hold, and disintegration', () => {
  const before = computeFloatingWindow(0.02, 0.07, 0.13, 0.25, 0.32);
  assert.equal(before.opacity, 0);
  assert.equal(before.assembleProgress, 0);
  assert.equal(before.disintegrateProgress, 0);
  assert.equal(before.active, false);

  const peak = computeFloatingWindow(0.18, 0.07, 0.13, 0.25, 0.32);
  assert.equal(peak.opacity, 1);
  assert.equal(peak.assembleProgress, 1);
  assert.equal(peak.disintegrateProgress, 0);
  assert.equal(peak.active, true);

  const holdWord = computeWordFragmentTransform(2, 8, 1, 0);
  assert.equal(holdWord.tx, 0);
  assert.equal(holdWord.ty, 0);
  assert.equal(holdWord.opacity, 1);

  const disintegratingWord = computeWordFragmentTransform(0, 8, 1, 0.55);
  assert.ok(disintegratingWord.ty < -10);
  assert.ok(disintegratingWord.opacity < 1 && disintegratingWord.opacity > 0);
  assert.ok(disintegratingWord.emberOpacity > 0.2);
});

test('computeCubeScrollState starts with zero text at p=0 and animates cube and chapters on scroll', () => {
  // At p=0: No story text is visible, only the cube and scroll down prompt
  const introState = computeCubeScrollState(0, 1.0);
  assert.equal(introState.activeAct, 0);
  assert.equal(introState.introPromptOpacity, 1);
  assert.equal(introState.chapters[0].opacity, 0);
  assert.equal(introState.chapters[1].opacity, 0);
  assert.equal(introState.chapters[2].opacity, 0);
  assert.equal(introState.formOpacity, 0);
  assert.equal(introState.cubeX, 0);
  assert.equal(introState.activeSliceMove.angleRad, 0);

  // Act 1: Chapter 1 is assembled and cube shifts right (+0.68) while rotating top slice
  const act1State = computeCubeScrollState(0.18, 2.0);
  assert.equal(act1State.activeAct, 1);
  assert.equal(act1State.introPromptOpacity, 0);
  assert.equal(act1State.chapters[0].opacity, 1);
  assert.equal(act1State.cubeX, 0.68);
  assert.equal(act1State.activeSliceMove.axis, 'y');
  assert.ok(act1State.activeSliceMove.angleRad > 0.8);

  // Act 2: Chapter 2 is assembled and cube shifts left (-0.68) while rotating right slice
  const act2State = computeCubeScrollState(0.44, 3.0);
  assert.equal(act2State.activeAct, 2);
  assert.equal(act2State.chapters[0].opacity, 0);
  assert.equal(act2State.chapters[1].opacity, 1);
  assert.equal(act2State.cubeX, -0.68);
  assert.equal(act2State.activeSliceMove.axis, 'x');
  assert.ok(Math.abs(act2State.activeSliceMove.angleRad) > 0.8);

  // Final Landing (p=1.0): Cube lands centered above the form
  const landedState = computeCubeScrollState(1.0, 5.0);
  assert.equal(landedState.activeAct, 4);
  assert.equal(landedState.landingFactor, 1);
  assert.equal(landedState.formOpacity, 1);
  assert.equal(landedState.cubeX, 0);
  assert.equal(landedState.cubeY, 1.22);
  assert.equal(landedState.activeSliceMove.angleRad, 0);
});

test('validateQuoteForm and buildWhatsAppUrl work accurately', () => {
  const invalid = validateQuoteForm({
    name: '',
    email: 'bad',
    phone: '12',
    projectType: '',
    summary: 'curto',
  });
  assert.equal(invalid.valid, false);

  const sample = {
    name: 'Mariana Costa',
    email: 'mariana@empresa.com.br',
    phone: formatPhoneDisplay('11988887777'),
    projectType: 'site-sob-medida',
    summary: 'Buscamos desenvolver um site independente de alta conversão.',
  };
  assert.equal(validateQuoteForm(sample).valid, true);

  const msg = buildWhatsAppMessage(sample);
  assert.ok(msg.includes('Site Independente Sob Medida'));
  const url = buildWhatsAppUrl(sample, '5511999999999');
  assert.ok(url.startsWith('https://wa.me/5511999999999?text='));
});
