// Named constants for Shot Rail. Values follow the design's Named constants table.

import type { Vec3 } from './pathkit.js';

// Axis names used by entity declarations.
export type AxisName = '+X' | '-X' | '+Y' | '-Y' | '+Z' | '-Z';

// Time and frames
export const FRAME_RATE = 30; // fps, displayed
export const BAKE_OVERSAMPLE = 8;
export const BAKE_FPS = FRAME_RATE * BAKE_OVERSAMPLE; // 240
export const LAP_FRAMES = 240; // displayed frames per lap
export const BAKED_LAP_FRAMES = LAP_FRAMES * BAKE_OVERSAMPLE; // 1920
export const LAP_SECONDS = LAP_FRAMES / FRAME_RATE; // 8
export const EASE_AMPLITUDE = 0.5;
export const FRAME_INTERVAL_MS = 1000 / FRAME_RATE;

// Shot length
export const SHOT_LENGTH_MIN = 60;
export const SHOT_LENGTH_MAX = 600;
export const SHOT_LENGTH_DEFAULT = 240;

// Road
export const ROAD_POINTS_MIN = 3;
export const ROAD_POINTS_MAX = 100;
export const DEFAULT_ROAD_POINT_COUNT = 12;
export const DEFAULT_ROAD_LENGTH_M = 120;
export const SUBJECT_CENTRE_HEIGHT = 0.7;
export const ROAD_DRAW_SAMPLES = 200;

// Car (subject)
export const CAR_HALF_EXTENT_X = 0.9;
export const CAR_HALF_EXTENT_Y = 0.7;
export const CAR_HALF_EXTENT_Z = 2.2;
export const CAR_FORWARD_AXIS: AxisName = '+Z';
export const CAR_UP_AXIS: AxisName = '+Y';

// Camera entities (Three.js convention)
export const CAMERA_FORWARD_AXIS: AxisName = '-Z';
export const CAMERA_UP_AXIS: AxisName = '+Y';

// Entity ids
export const SUBJECT_ENTITY_ID = 'subject';
export const CAMERA_IDS = ['cam-1', 'cam-2', 'cam-3', 'cam-4', 'cam-5', 'cam-6'] as const;
export const MAX_CAMERAS = 6;

// Lens and sensor
export const LENS_PRESETS_MM = [24, 35, 50, 85] as const;
export const SENSOR_WIDTH_MM = 36;
export const SENSOR_HEIGHT_MM = SENSOR_WIDTH_MM * 9 / 16; // 20.25
export const ASPECT_RATIO = 16 / 9;
export const FILM_GAUGE = 36;

// Camera placement limits
export const CAMERA_RADIUS_MIN = 3; // m
export const CAMERA_RADIUS_MAX = 60; // m
export const CAMERA_HEIGHT_MIN = -0.5; // m, relative to subject centre
export const CAMERA_HEIGHT_MAX = 40; // m, relative to subject centre

// Shot shapes
export const ORBIT_SWEEP_DEG = 180;
export const PUSH_IN_END_RATIO = 0.4;
export const CRANE_RISE_M = 6;
export const PLACEHOLDER_PATH: { points: Vec3[]; closed: boolean } = {
  points: [
    { x: 0, y: 0, z: 0 },
    { x: 1, y: 0, z: 0 },
  ],
  closed: false,
};
export const NEAR_EPSILON = 1e-6; // m

// Label thresholds
export const ANGLE_LOW_MAX_DEG = -10;
export const ANGLE_HIGH_MIN_DEG = 10;
export const ANGLE_OVERHEAD_MIN_DEG = 60;
export const FILL_WIDE_MAX_PERCENT = 35;
export const FILL_CLOSEUP_MIN_PERCENT = 70;

// Playback
export const PLAYBACK_RATE_GRID = 10; // Hz
export const PLAYBACK_MAX_CATCHUP_FRAMES = 5;

// Layout and rendering
export const STRIP_PICTURE_COUNT = 6;
export const TILE_SIZE_PX = { width: 160, height: 90 } as const;
export const THUMBNAIL_SIZE_PX = { width: 96, height: 54 } as const;
export const DEVICE_PIXEL_RATIO_CAP = 2;
export const CONTRAST_MIN_RATIO = 4.5;

// Storage
export const STORAGE_KEY_PREFIX = 'shot-rail:';
export const STORAGE_KEYS = [
  'hintSeenAngle',
  'hintSeenMove',
  'thirdsGuideOn',
  'safeAreaGuideOn',
] as const;

// Spike S5
export const S5_CAMERA_COUNT = 6;
export const S5_TARGET_MS = 100; // printed, never asserted

// Build
export const VITE_BASE = '/PathKit/shot-rail/';
