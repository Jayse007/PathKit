import { describe, expect, it } from 'vitest';
import { validateShotLength } from '../../src/logic/shot-length.js';

// Expected values are written by hand: the range text is literal, not built from constants.
const RANGE_TEXT = '60 to 600';

function checkAccepted(value: number): void {
  const result = validateShotLength(value);
  if (!result.ok) {
    throw new Error(`accepted check: ${value} was refused with "${result.message}"`);
  }
  if (result.value !== value) {
    throw new Error(`accepted check: ${value} came back as ${result.value}`);
  }
}

function checkRefused(value: number, valueText: string): void {
  const result = validateShotLength(value);
  if (result.ok) {
    throw new Error(`refused check: ${valueText} was accepted`);
  }
  if (!result.message.includes(RANGE_TEXT)) {
    throw new Error(`refused check: message for ${valueText} lacks "${RANGE_TEXT}": "${result.message}"`);
  }
  if (!result.message.includes(valueText)) {
    throw new Error(`refused check: message for ${valueText} lacks the value: "${result.message}"`);
  }
}

describe('validateShotLength', () => {
  it('accepts 60, 240 and 600 and returns the same value', () => {
    for (const v of [60, 240, 600]) checkAccepted(v);
    const r = validateShotLength(240);
    expect(r.ok).toBe(true);
  });

  it('refuses 59 and 601, naming the range and the value', () => {
    checkRefused(59, '59');
    checkRefused(601, '601');
  });

  it('refuses non-whole numbers, including ones inside the range', () => {
    checkRefused(240.5, '240.5');
    checkRefused(59.5, '59.5');
    checkRefused(600.5, '600.5');
    checkRefused(60.25, '60.25');
  });

  it('refuses NaN, Infinity and -Infinity, naming the value', () => {
    checkRefused(NaN, 'NaN');
    checkRefused(Infinity, 'Infinity');
    checkRefused(-Infinity, '-Infinity');
  });

  it('refuses 0 and negative numbers', () => {
    checkRefused(0, '0');
    checkRefused(-1, '-1');
    checkRefused(-60, '-60');
    checkRefused(-240, '-240');
  });

  it('accepts every whole number 60 to 600 and refuses 0 to 59 and 601 to 700', () => {
    for (let v = 60; v <= 600; v++) checkAccepted(v);
    for (let v = 0; v <= 59; v++) checkRefused(v, String(v));
    for (let v = 601; v <= 700; v++) checkRefused(v, String(v));
  });
});
