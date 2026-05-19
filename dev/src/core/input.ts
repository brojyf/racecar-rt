import { vec3 } from "gl-matrix";
import type { Camera } from "../raytracer/camera";
import {
    DEFAULT_THETA,
    DEFAULT_PHI,
    SENSITIVITY,
    MIN_PHI,
    MAX_DISTANCE_SCALE,
    MIN_DISTANCE_SCALE,
    ZOOM_SPEED,
    TRACKPAD_ROTATE_SPEED
} from "../config";

const WORLD_UP = vec3.fromValues(0, 1, 0);

export function setupMouseLook(
    canvas: HTMLCanvasElement,
    camera: Camera,
    target: vec3,
    radius: number,
    floorY: number
) {
    let isDragging = false;
    let lastX = 0;
    let lastY = 0;
    let theta = DEFAULT_THETA;
    let phi = DEFAULT_PHI;
    let distance = radius;
    const minDistance = radius * MIN_DISTANCE_SCALE;
    const maxDistance = radius * MAX_DISTANCE_SCALE;
    const floorMargin = 0.01;
    update(camera, theta, clampPhi(phi, distance), target, distance);

    function clampPhi(value: number, d: number): number {
        const cosLimit = (floorY + floorMargin - target[1]) / d;
        const upper = cosLimit <= -1 ? Math.PI - MIN_PHI : Math.min(Math.PI - MIN_PHI, Math.acos(cosLimit));
        return Math.min(Math.max(value, MIN_PHI), upper);
    }
    
    canvas.addEventListener("pointerdown", (e) => {
        isDragging = true;
        lastX = e.clientX;
        lastY = e.clientY;
    });

    canvas.addEventListener("pointerup", () => {
        isDragging = false;
    });
    
    canvas.addEventListener("pointerleave", () => {
        isDragging = false;
    });

    canvas.addEventListener("pointermove", (e) => {
        if (!isDragging) return;

        const dx = (e.clientX - lastX) * SENSITIVITY;
        const dy = (e.clientY - lastY) * SENSITIVITY;
        lastX = e.clientX;
        lastY = e.clientY;

        theta += dx;
        phi = clampPhi(phi - dy, distance);

        update(camera, theta, phi, target, distance);
    });

    canvas.addEventListener("wheel", (e) => {
        e.preventDefault();

        if (e.ctrlKey) {
            distance *= 1 + e.deltaY * ZOOM_SPEED;
            distance = Math.min(Math.max(distance, minDistance), maxDistance);
        } else {
            theta -= e.deltaX * TRACKPAD_ROTATE_SPEED;
            phi += e.deltaY * TRACKPAD_ROTATE_SPEED;
        }
        phi = clampPhi(phi, distance);
        update(camera, theta, phi, target, distance);
    }, { passive: false });
}

function update(c: Camera, theta: number, phi: number, target: vec3, radius: number) {
    c.position[0] = target[0] + radius * Math.sin(phi) * Math.cos(theta);
    c.position[1] = target[1] + radius * Math.cos(phi);
    c.position[2] = target[2] + radius * Math.sin(phi) * Math.sin(theta);

    vec3.sub(c.forward, target, c.position);
    vec3.normalize(c.forward, c.forward);

    vec3.cross(c.right, c.forward, WORLD_UP);

    if (vec3.length(c.right) < 0.0001) {
        vec3.set(c.right, 1, 0, 0);
    } else {
        vec3.normalize(c.right, c.right);
    }

    vec3.cross(c.up, c.right, c.forward);
    vec3.normalize(c.up, c.up);
}
