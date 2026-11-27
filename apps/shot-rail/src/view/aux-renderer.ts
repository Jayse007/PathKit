// The shared auxiliary renderer (design: Rendering layer). One WebGL context that the Stage_Overview,
// and later the Coverage_Grid tiles and the Shot_Strip, use in turn. Each user must copy its image into
// its own 2D canvas with drawImage right after its render, before the next user renders. Loads Three.js,
// so no test imports this file.

import { WebGLRenderer } from 'three';

/**
 * Creates the shared auxiliary renderer. Its pixel ratio is 1: each user sets the size in device pixels
 * with setSize(width, height, false). It is never added to the page.
 * When WebGL cannot start, `renderer` is null and `reason` holds the error text.
 */
export function createAuxRenderer(): { renderer: WebGLRenderer | null; reason: string } {
  try {
    const renderer = new WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(1);
    return { renderer, reason: '' };
  } catch (e) {
    return { renderer: null, reason: e instanceof Error ? e.message : String(e) };
  }
}
