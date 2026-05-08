import { vec3 } from "gl-matrix";

export interface Ray {
    origin   : vec3;
    direction: vec3;
}
