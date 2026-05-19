import  { vec3 } from "gl-matrix";

// camera
export const DEFAULT_CAMERA_POSITION = vec3.fromValues(0, 0, 2.5);
export const DEFAULT_CAMERA_FORWARD  = vec3.fromValues(0, 0, -1);
export const DEFAULT_CAMERA_RIGHT    = vec3.fromValues(1, 0, 0);
export const DEFAULT_CAMERA_UP       = vec3.fromValues(0, 1, 0);
export const DEFAULT_CAMERA_FOV      = 60;

// input
export const SENSITIVITY           = 0.003;
export const TRACKPAD_ROTATE_SPEED = 0.004;
export const DEFAULT_THETA         = Math.PI / 4;
export const DEFAULT_PHI           = Math.PI / 3;
export const MIN_PHI               = 0.1;
export const ZOOM_SPEED            = 0.01;
export const MIN_DISTANCE_SCALE    = 0.01;
export const MAX_DISTANCE_SCALE    = 5;

// light
export const DEFAULT_LIGHT_POSITION  = vec3.fromValues(20.0, 20.0, 20.0);
export const DEFAULT_LIGHT_COLOR     = vec3.fromValues(1, 1, 1);
export const DEFAULT_LIGHT_INTENSITY = 1;
