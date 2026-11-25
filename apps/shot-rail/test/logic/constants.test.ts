import { describe, expect, it } from 'vitest';
import {
  ANGLE_HIGH_MIN_DEG,
  ANGLE_LOW_MAX_DEG,
  ANGLE_OVERHEAD_MIN_DEG,
  BAKE_FPS,
  BAKED_LAP_FRAMES,
  CAMERA_FORWARD_AXIS,
  CAMERA_HEIGHT_MAX,
  CAMERA_HEIGHT_MIN,
  CAMERA_IDS,
  CAMERA_RADIUS_MAX,
  CAMERA_RADIUS_MIN,
  CAMERA_UP_AXIS,
  CAR_FORWARD_AXIS,
  CAR_UP_AXIS,
  DEFAULT_ROAD_POINT_COUNT,
  FILL_CLOSEUP_MIN_PERCENT,
  FILL_WIDE_MAX_PERCENT,
  FRAME_INTERVAL_MS,
  LAP_SECONDS,
  MAX_CAMERAS,
  ROAD_POINTS_MAX,
  ROAD_POINTS_MIN,
  SENSOR_HEIGHT_MM,
  SHOT_LENGTH_DEFAULT,
  SHOT_LENGTH_MAX,
  SHOT_LENGTH_MIN,
} from '../../src/logic/constants.js';

describe('constants: derived values', () => {
  it('BAKE_FPS is 240', () => {
    expect(BAKE_FPS).toBe(240);
  });
  it('BAKED_LAP_FRAMES is 1920', () => {
    expect(BAKED_LAP_FRAMES).toBe(1920);
  });
  it('LAP_SECONDS is 8', () => {
    expect(LAP_SECONDS).toBe(8);
  });
  it('SENSOR_HEIGHT_MM is 20.25', () => {
    expect(SENSOR_HEIGHT_MM).toBe(20.25);
  });
  it('FRAME_INTERVAL_MS is 1000/30', () => {
    expect(FRAME_INTERVAL_MS).toBeCloseTo(33.3333333333, 9);
  });
});

describe('constants: thresholds and ranges', () => {
  it('angle thresholds are ordered', () => {
    expect(ANGLE_LOW_MAX_DEG).toBeLessThan(ANGLE_HIGH_MIN_DEG);
    expect(ANGLE_HIGH_MIN_DEG).toBeLessThan(ANGLE_OVERHEAD_MIN_DEG);
  });
  it('fill thresholds are ordered', () => {
    expect(FILL_WIDE_MAX_PERCENT).toBeLessThan(FILL_CLOSEUP_MIN_PERCENT);
  });
  it('shot length min < default < max', () => {
    expect(SHOT_LENGTH_MIN).toBeLessThan(SHOT_LENGTH_DEFAULT);
    expect(SHOT_LENGTH_DEFAULT).toBeLessThan(SHOT_LENGTH_MAX);
  });
  it('camera radius min < max', () => {
    expect(CAMERA_RADIUS_MIN).toBeLessThan(CAMERA_RADIUS_MAX);
  });
  it('camera height min < max', () => {
    expect(CAMERA_HEIGHT_MIN).toBeLessThan(CAMERA_HEIGHT_MAX);
  });
  it('road points min < default < max', () => {
    expect(ROAD_POINTS_MIN).toBeLessThan(DEFAULT_ROAD_POINT_COUNT);
    expect(DEFAULT_ROAD_POINT_COUNT).toBeLessThan(ROAD_POINTS_MAX);
  });
  it('CAMERA_IDS has MAX_CAMERAS entries', () => {
    expect(CAMERA_IDS.length).toBe(MAX_CAMERAS);
  });
  it('CAMERA_IDS are exactly cam-1 to cam-6, in order', () => {
    expect([...CAMERA_IDS]).toEqual(['cam-1', 'cam-2', 'cam-3', 'cam-4', 'cam-5', 'cam-6']);
  });
});

describe('constants: entity axes', () => {
  it('camera forward and up lie on different axes', () => {
    expect(CAMERA_FORWARD_AXIS.charAt(1)).not.toBe(CAMERA_UP_AXIS.charAt(1));
  });
  it('car forward and up lie on different axes', () => {
    expect(CAR_FORWARD_AXIS.charAt(1)).not.toBe(CAR_UP_AXIS.charAt(1));
  });
});
