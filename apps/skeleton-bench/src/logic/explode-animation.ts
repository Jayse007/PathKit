/**
 * Explode toggle animation (key E). Pure: no clock, no state. App code, not PathKit.
 * The caller passes the elapsed time; the amount moves in a straight line over the duration.
 * Explode_Easing (smoothstep) is applied later, when the amount becomes a Part-scene frame.
 */

function requireFinite(value: number, fn: string, name: string): void {
  if (!Number.isFinite(value)) {
    throw new Error(`${fn}: ${name} must be a finite number, got ${String(value)}`);
  }
}

/** Explode_Amount in percent after `elapsedMs` of an animation from `from` to `to` lasting `durationMs`. */
export function explodeAnimationAmount(from: number, to: number, elapsedMs: number, durationMs: number): number {
  requireFinite(from, 'explodeAnimationAmount', 'start amount');
  requireFinite(to, 'explodeAnimationAmount', 'end amount');
  requireFinite(elapsedMs, 'explodeAnimationAmount', 'elapsed time');
  requireFinite(durationMs, 'explodeAnimationAmount', 'duration');
  if (durationMs <= 0) return to;
  const t = Math.min(1, Math.max(0, elapsedMs / durationMs));
  return from + (to - from) * t;
}

/** Where key E sends the amount: 0 when the current target is 50 or more, otherwise 100. */
export function explodeToggleTarget(currentTarget: number): 0 | 100 {
  requireFinite(currentTarget, 'explodeToggleTarget', 'target');
  return currentTarget >= 50 ? 0 : 100;
}
