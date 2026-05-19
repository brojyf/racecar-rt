import { vec3 } from "gl-matrix";
import {
    DEFAULT_LIGHT_POSITION,
    DEFAULT_LIGHT_COLOR,
    DEFAULT_LIGHT_INTENSITY,
} from "../config";

const LIGHT_BUFFER_SIZE = 32;

export interface Light {
    position : vec3
    color    : vec3
    intensity: number
}

export function defaultLight(): Light {
    return {
        position : vec3.clone(DEFAULT_LIGHT_POSITION),
        color    : vec3.clone(DEFAULT_LIGHT_COLOR),
        intensity: DEFAULT_LIGHT_INTENSITY
    }
}

export function flattenLight(light: Light) : Float32Array<ArrayBuffer> {
    const out = new Float32Array(LIGHT_BUFFER_SIZE / 4);
    
    out[0] = light.position[0];
    out[1] = light.position[1];
    out[2] = light.position[2];
    out[3] = 0;

    out[4] = light.color[0];
    out[5] = light.color[1];
    out[6] = light.color[2];
    out[7] = light.intensity;

    return out;
}
