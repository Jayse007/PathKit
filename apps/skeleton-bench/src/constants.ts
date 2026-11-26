// All named constants for Skeleton Bench (Tier A). One file; tests import from here.
// Units: metres, radians internally, degrees only where named *_DEG, time in frames unless named *_MS.

export type AxisName = '+X' | '-X' | '+Y' | '-Y' | '+Z' | '-Z';

// Fixed by the requirements
export const FPS = 30; // frames per second
export const ORBIT_LAP_FRAMES = 360; // frames
export const CLICK_THRESHOLD_PX = 5; // px
export const BENCH_MAX_FRACTION_AT_0 = 0.25; // fraction
export const BENCH_MIN_FRACTION_AT_100 = 0.1; // fraction
export const HOLD_MS = 300; // ms

// Space and camera
export const EXPLODED_BOX_HALF_X = 1.2; // m
export const EXPLODED_BOX_HALF_Y = 0.6; // m
export const EXPLODED_BOX_HALF_Z = 0.4; // m
export const EXPLODED_BOX_RADIUS = 1.4; // m. Derived: sqrt of the sum of squared half-extents.
export const MACHINE_CENTRE: readonly [number, number, number] = [0, 0, 0];
export const ORBIT_AXIS: AxisName = '+Y';
export const ORBIT_SPEED_DEG_PER_S = 30; // Derived: 360 * FPS / ORBIT_LAP_FRAMES.
export const ORBIT_START_ANGLE_DEG = 0;
export const CAMERA_FORWARD_AXIS: AxisName = '-Z';
export const CAMERA_UP_AXIS: AxisName = '+Y';
export const PART_FORWARD_AXIS: AxisName = '+Z';
export const PART_UP_AXIS: AxisName = '+Y';
export const CAMERA_ELEVATION_SIN = 5 / 13;
export const CAMERA_ELEVATION_COS = 12 / 13;
export const LAP_DISTANCES: readonly number[] = [6.5, 5.2, 3.9, 2.6]; // m. r and h are derived from these.
export const LAP_COUNT = 4;
export const CAMERA_FOV_DEG = 35; // Degrees at the Three.js boundary only.
export const CAMERA_NEAR = 0.1; // m
export const CAMERA_FAR = 100; // m
export const STAGE_GRID_Y = -0.6; // m. Equals -EXPLODED_BOX_HALF_Y.
export const STAGE_GRID_SIZE_M = 6; // m
export const STAGE_GRID_DIVISIONS = 12;
export const STAGE_GRID_COLOUR = 0x889099;
export const STAGE_GRID_OPACITY = 0.5; // faint
export const STAGE_MAX_PIXEL_RATIO = 2;
export const INITIAL_ORBIT_ANGLE_DEG = 30;
export const INITIAL_ZOOM = 0.25;
export const INITIAL_EXPLODE = 0;

// Tolerances and tests
export const BEARING_TOLERANCE_DEG = 0.001;
export const AIM_TOLERANCE_DEG = 0.001;
export const DISTANCE_TOLERANCE_M = 1e-9;
export const CAMERA_MIN_CLEARANCE_M = 1.0;
export const S2_ZOOM_GRID_STEPS = 12; // Z = k / 12, k = 0 to 12
export const END_POSITION_TOLERANCE_M = 1e-6;
export const CONTRAST_MIN = 4.5;

// Input and motion
export const ORBIT_KEY_STEP_FRAMES = 5;
export const ORBIT_DEG_PER_PIXEL = 0.5;
export const ZOOM_KEY_STEP = 0.1;
export const ZOOM_WHEEL_STEP = 0.05;
export const MOVE_KEY_STEP_FRACTION = 0.02;
export const EXPLODE_FRAMES = 60;
export const PART_PATH_BOW_FRACTION = 0.15;
export const PART_MIN_EXPLODE_M = 0.1; // m
export const PART_MIN_CLEARANCE_M = 0.08; // m. Smallest gap between two Parts of one Machine at Explode_Amount 100.
export const PART_PATH_VERTICAL_SIN = 0.1;
export const EXPLODE_TOGGLE_MS = 600;
export const IMPELLER_SPIN_RAD_PER_S = Math.PI;
export const TOUR_FRAMES_PER_PART = 90;
export const TOUR_RING_POINTS = 12;
export const TOUR_RING_RADIUS = 3.6; // m
export const TOUR_RING_HEIGHT = 1.5; // m
export const TOUR_REDUCED_MOTION_HOLD_MS = 3000;
export const SELECT_SHELL_SCALE = 1.05;
export const FOCUS_SHELL_SCALE = 1.03;
export const STORAGE_KEY_LOOK = 'skeletonBench.look';
export const STORAGE_KEY_HINT_PREFIX = 'skeletonBench.hintSeen.';
