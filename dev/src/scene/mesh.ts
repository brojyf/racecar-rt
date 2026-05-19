import { vec3 } from "gl-matrix";

export interface Mesh {
    positions    : Float32Array;
    normals      : Float32Array;
    texcoords    : Float32Array;
    indices      : Uint32Array;
    materialIndex: number;
}

export interface TextureAtlas {
    source: HTMLCanvasElement;
}

export function meshToBuffer(mesh: Mesh): Float32Array<ArrayBuffer> {
    const triCount = mesh.indices.length / 3;
    const out = new Float32Array(triCount * 32);

    for (let tri = 0; tri < triCount; tri++) {
        const writeStart = tri * 32;
        const i0 = mesh.indices[tri * 3 + 0];
        const i1 = mesh.indices[tri * 3 + 1];
        const i2 = mesh.indices[tri * 3 + 2];
        const triangle = vec3.fromValues(i0, i1, i2);
        const fallbackNormal = faceNormal(mesh.positions, triangle);

        writePosition(out, writeStart + 0, mesh.positions, i0, mesh.materialIndex);
        writePosition(out, writeStart + 4, mesh.positions, i1, 0);
        writePosition(out, writeStart + 8, mesh.positions, i2, 0);

        writeNormal(out, writeStart + 12, mesh.normals, i0, fallbackNormal);
        writeNormal(out, writeStart + 16, mesh.normals, i1, fallbackNormal);
        writeNormal(out, writeStart + 20, mesh.normals, i2, fallbackNormal);

        writeUv(out, writeStart + 24, mesh.texcoords, i0);
        writeUv(out, writeStart + 26, mesh.texcoords, i1);
        writeUv(out, writeStart + 28, mesh.texcoords, i2);
    }

    return out;
}

function writePosition(
    out          : Float32Array,
    writeStart   : number,
    positions    : Float32Array,
    index        : number,
    materialIndex: number
) {
    const vertexStart = index * 3;
    out[writeStart + 0] = positions[vertexStart + 0];
    out[writeStart + 1] = positions[vertexStart + 1];
    out[writeStart + 2] = positions[vertexStart + 2];
    out[writeStart + 3] = materialIndex;
}

function writeNormal(
    out       : Float32Array,
    writeStart: number,
    normals   : Float32Array,
    index     : number,
    fallback  : vec3
) {
    const normalStart = index * 3;
    if (normals.length > normalStart + 2) {
        out[writeStart + 0] = normals[normalStart + 0];
        out[writeStart + 1] = normals[normalStart + 1];
        out[writeStart + 2] = normals[normalStart + 2];
    } else {
        out[writeStart + 0] = fallback[0];
        out[writeStart + 1] = fallback[1];
        out[writeStart + 2] = fallback[2];
    }
    out[writeStart + 3] = 0;
}

function writeUv(
    out       : Float32Array,
    writeStart: number,
    texcoords : Float32Array,
    index     : number
) {
    const uvStart = index * 2;
    if (texcoords.length > uvStart + 1) {
        out[writeStart + 0] = texcoords[uvStart + 0];
        out[writeStart + 1] = texcoords[uvStart + 1];
    } else {
        out[writeStart + 0] = 0;
        out[writeStart + 1] = 0;
    }
}

function faceNormal(
    positions: Float32Array,
    triangle : vec3
): vec3 {
    const a = vertexOffset(triangle[0]);
    const b = vertexOffset(triangle[1]);
    const c = vertexOffset(triangle[2]);

    const ab = vec3.fromValues(
        positions[b + 0] - positions[a + 0],
        positions[b + 1] - positions[a + 1],
        positions[b + 2] - positions[a + 2]
    );
    const ac = vec3.fromValues(
        positions[c + 0] - positions[a + 0],
        positions[c + 1] - positions[a + 1],
        positions[c + 2] - positions[a + 2]
    );
    const normal = vec3.create();
    vec3.cross(normal, ab, ac);

    if (vec3.length(normal) <= 0) return vec3.fromValues(0, 1, 0);

    return vec3.normalize(normal, normal);
}

function vertexOffset(index: number): number {
    return index * 3;
}
