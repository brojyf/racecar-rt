import { PADDED_COMPOENENTS, POSITION_COMPONENTS } from "../config";

export interface Mesh {
    positions: Float32Array;
    indices  : Uint32Array;
}

export function meshToBuffer(mesh: Mesh): Float32Array<ArrayBuffer> {
    const vertexCount = mesh.indices.length;
    const out = new Float32Array(vertexCount * PADDED_COMPOENENTS)

    for (let i = 0; i < vertexCount; i++) {
        const vertexStart = mesh.indices[i] * POSITION_COMPONENTS;
        const writeStart = i * PADDED_COMPOENENTS;

        for (let j = 0; j < 3; j++) {
            out[writeStart + j] = mesh.positions[vertexStart + j];
        }
        out[writeStart + 3] = 0
    }

    return out;
}