import  { vec3 } from "gl-matrix";

export const PADDED_COMPOENENTS  = 4;
export const POSITION_COMPONENTS = 3

// ===== camera =====
export const CAMERA_FLOAT_COUNT      = 4 * 5;
export const CAMERA_BUFFER_SIZE      = CAMERA_FLOAT_COUNT * 4;
export const DEFAULT_CAMERA_POSITION = vec3.fromValues(0, 0, 2.5);
export const DEFAULT_CAMERA_FORWARD  = vec3.fromValues(0, 0, -1);
export const DEFAULT_CAMERA_RIGHT    = vec3.fromValues(1, 0, 0);
export const DEFAULT_CAMERA_UP       = vec3.fromValues(0, 1, 0);
export const DEFAULT_CAMERA_FOV      = 60;

// scene
export const RADIUS_SCALE = 1.5;

// input
export const SENSITIVITY           = 0.003;
export const TRACKPAD_ROTATE_SPEED = 0.004;
export const DEFAULT_THETA         = Math.PI / 4;
export const DEFAULT_PHI           = Math.PI / 3;
export const MIN_PHI               = 0.1;
export const ZOOM_SPEED            = 0.01;
export const MIN_DISTANCE_SCALE    = 0.01;
export const MAX_DISTANCE_SCALE    = 5;

// bvh
export const CODE_RANGE = 1023;
export const LEAF_TRIANGLE_COUNT = 4;
export const TRIANGLE_BYTE_SIZE = 12;
export const NODE_FLOAT_COUNT = 8;
