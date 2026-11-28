// Samples menu rules (task 40.1): pure functions for loading a sample shot. No DOM, no Three.js, no I/O, so a
// test may import this file (task 40.2).
//
// A sample is one main camera. Loading it replaces ALL settings at once: the settings are built new from the
// sample, never by changing the settings that were showing. No camera keeps a remembered rail shot.
// The Road and the subject are not part of a sample, so the caller passes the ones in use.

import { CAMERA_IDS } from '../logic/constants.js';
import type { Vec3 } from '../logic/pathkit.js';
import type { SampleShot } from '../logic/samples.js';
import type { RigSettings, SubjectKind } from './camera-rig.js';

/** The sample that loads when the app starts (Requirement 10.1: the first sample). */
export const STARTUP_SAMPLE_INDEX = 0;

/** The id of the one camera a sample defines. It is the main camera. */
export const SAMPLE_CAMERA_ID: string = CAMERA_IDS[0];

/**
 * New RigSettings for a sample: one camera, which is the main camera, with the sample's shot type, placement,
 * lens and shot length. The road points are copied, so the result shares nothing with the arguments, and the
 * camera has no `railShotWhenMain` key.
 */
export function sampleToSettings(
  sample: SampleShot,
  roadPoints: readonly Vec3[],
  subjectKind: SubjectKind,
): RigSettings {
  return {
    shotLengthFrames: sample.shotLengthFrames,
    mainCameraId: SAMPLE_CAMERA_ID,
    cameras: [
      {
        id: SAMPLE_CAMERA_ID,
        shotType: sample.shotType,
        bearingDeg: sample.placement.bearingDeg,
        heightM: sample.placement.heightM,
        horizontalDistanceM: sample.placement.horizontalDistanceM,
        lensMm: sample.placement.lensMm,
      },
    ],
    road: { points: roadPoints.map((p) => ({ x: p.x, y: p.y, z: p.z })), closed: true },
    subjectKind,
  };
}

/** The status line after a sample loaded. */
export function sampleLoadedMessage(sample: SampleShot): string {
  return `Loaded the sample shot "${sample.name}". The timeline is paused at frame 0.`;
}
