import { vec3 } from "gl-matrix";
import { meshToBuffer, type Mesh } from "./mesh";

const RADIUS_SCALE = 1.5;

export interface Bounds {
    min: vec3;
    max: vec3;
}

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

    for (let i = 0; i < sceneArr.length; i += 4) {
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

export function boundingSphereFromBounds(bounds: Bounds): BoundingSphere {
    const center = vec3.create();
    vec3.add(center, bounds.min, bounds.max);
    vec3.scale(center, center, 0.5);

    const size = vec3.create();
    vec3.sub(size, bounds.max, bounds.min);
    const radius = Math.max(size[0], size[1], size[2]) * RADIUS_SCALE;
    return { center, radius };
}

export function meshesBounds(meshes: Mesh[]): Bounds {
    const min = vec3.fromValues(Infinity, Infinity, Infinity);
    const max = vec3.fromValues(-Infinity, -Infinity, -Infinity);
    for (const mesh of meshes) {
        for (let i = 0; i < mesh.positions.length; i += 3) {
            const x = mesh.positions[i];
            const y = mesh.positions[i + 1];
            const z = mesh.positions[i + 2];

            min[0] = Math.min(min[0], x);
            min[1] = Math.min(min[1], y);
            min[2] = Math.min(min[2], z);
            max[0] = Math.max(max[0], x);
            max[1] = Math.max(max[1], y);
            max[2] = Math.max(max[2], z);
        }
    }
    return { min, max };
}

export function createWaterPlane(
    materialIndex: number,
    y            : number,
    center       : vec3,
    halfSize     : number
): Mesh {
    const cx = center[0];
    const cz = center[2];
    const x0 = cx - halfSize;
    const x1 = cx + halfSize;
    const z0 = cz - halfSize;
    const z1 = cz + halfSize;

    const positions = new Float32Array([
        x0, y, z0,
        x1, y, z0,
        x1, y, z1,
        x0, y, z1
    ]);
    const normals = new Float32Array([
        0, 1, 0,
        0, 1, 0,
        0, 1, 0,
        0, 1, 0
    ]);
    const texcoords = new Float32Array([0, 0, 1, 0, 1, 1, 0, 1]);
    const indices = new Uint32Array([0, 2, 1, 0, 3, 2]);

    return { positions, normals, texcoords, indices, materialIndex };
}
