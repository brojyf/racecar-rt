import { vec3 } from "gl-matrix";
import type { Ray } from "./ray";
import { 
    CAMERA_FLOAT_COUNT, 
    DEFAULT_CAMERA_FORWARD, 
    DEFAULT_CAMERA_FOV, 
    DEFAULT_CAMERA_POSITION, 
    DEFAULT_CAMERA_RIGHT, 
    DEFAULT_CAMERA_UP 
} from "../config";

export interface Camera {
    position: vec3;
    forward : vec3;
    right   : vec3;
    up      : vec3;
    fov     : number;
    width   : number;
    height  : number;
}

export function defaultCamera(w: number, h: number): Camera {
    return {
        position: DEFAULT_CAMERA_POSITION,
        forward : DEFAULT_CAMERA_FORWARD,
        right   : DEFAULT_CAMERA_RIGHT,
        up      : DEFAULT_CAMERA_UP,
        fov     : DEFAULT_CAMERA_FOV,
        width: w,
        height: h
    }
}

export function cameraRay(camera: Camera, px: number, py: number): Ray {
    const aspect = camera.width / camera.height;
    const tanHalfFov = Math.tan(camera.fov * Math.PI / 360);

    const xRatio = (px + 0.5) / camera.width * 2 - 1;
    const yRatio = 1 - ((py + 0.5) / camera.height) * 2;
    const x = xRatio * aspect * tanHalfFov;
    const y = yRatio * tanHalfFov;

    const direction = vec3.clone(camera.forward);
    vec3.scaleAndAdd(direction, direction, camera.right, x);
    vec3.scaleAndAdd(direction, direction, camera.up, y);
    vec3.normalize(direction, direction);

    return {
        origin: vec3.clone(camera.position),
        direction: direction
    };
}

export function cameraUniformData(camera: Camera): Float32Array<ArrayBuffer> {
    const data = new Float32Array(CAMERA_FLOAT_COUNT);
    fill(0, camera.position, false);
    fill(4, camera.forward);
    fill(8, camera.right);
    fill(12, camera.up);
    fill(16, vec3.fromValues(camera.width, camera.height, camera.fov));

    return data;

    function fill(i: number, v: vec3, isVector: boolean = true) {
        data[i] = v[0];
        data[i + 1] = v[1];
        data[i + 2] = v[2];
        data[i + 3] = v[isVector ? 0 : 1];
    }
}
