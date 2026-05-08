import { vec3 } from "gl-matrix";
import { meshToBuffer, type Mesh } from "./mesh";
import { PADDED_COMPOENENTS } from "../config";

const RADIUS_SCALE = 1.5;

export interface Scene {
    meshes: Mesh[];
}

export interface BoundingSphere {
    center: vec3;
    radius: number;
}

export function flattenScene(scene: Scene): Float32Array<ArrayBuffer> {
    const parts = scene.meshes.map(meshToBuffer);
    const length = parts.reduce((sum, part) => sum + part.length, 0);
    const out = new Float32Array(length);

    let offset = 0;
    for (const part of parts) {
        out.set(part, offset);
        offset += part.length;
    }
    
    return out;
}

export function computeBoundingSphere(sceneArr: Float32Array): BoundingSphere {
    let minX = Infinity;
    let minY = Infinity;
    let minZ = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    let maxZ = -Infinity;

    for (let i = 0; i < sceneArr.length; i += PADDED_COMPOENENTS) {
        const x = sceneArr[i];
        const y = sceneArr[i + 1];
        const z = sceneArr[i + 2];

        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        minZ = Math.min(minZ, z);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
        maxZ = Math.max(maxZ, z);
    }

    const center = vec3.fromValues(
        (minX + maxX) / 2,
        (minY + maxY) / 2,
        (minZ + maxZ) / 2
    );
    const radius = Math.max(
        maxX - minX,
        maxY - minY,
        maxZ - minZ
    ) * RADIUS_SCALE;

    return { center, radius };
}
