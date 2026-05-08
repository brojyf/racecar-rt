import { mat4, quat, vec3 } from "gl-matrix";
import type { Mesh } from "./mesh";

const FLOAT           = 5126;
const UNSIGNED_SHORT  = 5123;
const UNSIGNED_INT    = 5125;

interface GltfBuffer {  
    uri: string;
}

interface GltfBufferView {
    buffer     : number;
    byteOffset?: number;
    byteStride?: number;
}

interface GltfAccessor {
    bufferView    : number;
    byteOffset?   : number;
    componentType : number;
    count         : number;
    type          : string;
}

interface GltfPrimitive {
    attributes: {
        POSITION?: number;
    };
    indices? : number;
    mode?    : number;
}

interface GltfMesh {
    primitives: GltfPrimitive[];
}

interface GltfNode {
    mesh?        : number;
    children?    : number[];
    matrix?      : number[];
    translation? : number[];
    rotation?    : number[];
    scale?       : number[];
}

interface GltfScene {
    nodes?: number[];
}

interface Gltf {
    buffers     : GltfBuffer[];
    bufferViews : GltfBufferView[];
    accessors   : GltfAccessor[];
    meshes      : GltfMesh[];
    nodes       : GltfNode[];
    scenes      : GltfScene[];
    scene?      : number;
}

export async function loadGltf(assetPath: string): Promise<Mesh[]> {
    const url = new URL(assetPath, window.location.href);
    const gltf = await fetchJson<Gltf>(url.href);
    const buffers: ArrayBuffer[] = await Promise.all(
        gltf.buffers.map(b => fetchArrayBuffer(new URL(b.uri, url).href))
    );

    const scene: GltfScene = gltf.scenes[gltf.scene ?? 0];
    const meshes: Mesh[] = [];
    for (const nodeIndex of scene.nodes ?? []) {
        walkNode(gltf, buffers, nodeIndex, mat4.create(), meshes);
    }

    return meshes;
}

function walkNode(
    gltf: Gltf,
    buffers: ArrayBuffer[],
    nodeIndex: number,
    parentMatrix: mat4,
    out: Mesh[]
) {
    const node = gltf.nodes[nodeIndex];
    const worldMatrix = mat4.create();
    mat4.multiply(worldMatrix, parentMatrix, localMatrix(node));

    if (node.mesh !== undefined) {
        readMesh(gltf, buffers, gltf.meshes[node.mesh], worldMatrix, out);
    }

    for (const childIndex of node.children ?? []) {
        walkNode(gltf, buffers, childIndex, worldMatrix, out);
    }
}

function readMesh(
    gltf        : Gltf,
    buffers     : ArrayBuffer[],
    mesh        : GltfMesh,
    worldMatrix : mat4,
    out         : Mesh[]
) {
    for (const prim of mesh.primitives) {
        if (prim.mode !== undefined && prim.mode !== 4) {
            continue;
        }

        const posIdx = prim.attributes.POSITION;
        const idxIdx = prim.indices;
        if (posIdx === undefined || idxIdx === undefined) {
            continue;
        }

        out.push({
            positions: readAccessorF32(gltf, buffers, posIdx, worldMatrix),
            indices  : readAccessorIndices(gltf, buffers, idxIdx),
        });
    }
}

async function fetchArrayBuffer(url: string): Promise<ArrayBuffer> {
    const resp = await fetch(url);
    if (!resp.ok) {
        throw new Error("LOADER_FETCH_ARRAY_BUFFER_ERROR");
    }
    return resp.arrayBuffer();
}

async function fetchJson<T>(href: string): Promise<T> {
    const resp = await fetch(href);
    if (!resp.ok) {
        throw new Error("LOADER_FETCH_JSON_ERROR");
    }

    return (await resp.json()) as T;
}

function readAccessorIndices(
    gltf    : Gltf,
    buffers : ArrayBuffer[],
    idx     : number,
): Uint32Array {
    const acc = gltf.accessors[idx];
    const view = gltf.bufferViews[acc.bufferView];
    const byteOffset = (view.byteOffset ?? 0) + (acc.byteOffset ?? 0);
    const src = buffers[view.buffer];
    const out = new Uint32Array(acc.count);

    if (acc.componentType === UNSIGNED_SHORT) {
        const values = new Uint16Array(src, byteOffset, acc.count);
        out.set(values);
        return out;
    }

    if (acc.componentType === UNSIGNED_INT) {
        const values = new Uint32Array(src, byteOffset, acc.count);
        out.set(values);
        return out;
    }

    throw new Error("LOADER_READ_ACCESSOR_INDICES_UNSUPPORTED_TYPE");
}

function readAccessorF32(
    gltf   : Gltf,
    buffers: ArrayBuffer[],
    idx    : number,
    world  : mat4,
): Float32Array {
    const acc = gltf.accessors[idx];
    const view = gltf.bufferViews[acc.bufferView];
    if (acc.componentType !== FLOAT || acc.type !== "VEC3") {
        throw new Error("LOADER_READ_ACCESSOR_F32_UNSUPPORTED_TYPE")
    }

    const baseOffset = (view.byteOffset ?? 0) + (acc.byteOffset ?? 0);
    const stride = view.byteStride ?? 12;
    const src = buffers[view.buffer];
    const out = new Float32Array(acc.count * 3);
    const p = vec3.create();

    for (let i = 0; i < acc.count; i++) {
        const offset = baseOffset + i * stride;
        const item = new Float32Array(src, offset, 3);

        vec3.set(p, item[0], item[1], item[2]);
        vec3.transformMat4(p, p, world);

        out[i * 3]     = p[0];
        out[i * 3 + 1] = p[1];
        out[i * 3 + 2] = p[2];
    }

    return out;
}

function localMatrix(node: GltfNode): mat4 {
    const out = mat4.create();
    if (node.matrix) {
        for (let i = 0; i < 16; i++) {
            out[i] = node.matrix[i];
        }
        return out;
    }

    const translation = vec3.fromValues(
        node.translation?.[0] ?? 0,
        node.translation?.[1] ?? 0,
        node.translation?.[2] ?? 0,
    );

    const rotation = quat.fromValues(
        node.rotation?.[0] ?? 0,
        node.rotation?.[1] ?? 0,
        node.rotation?.[2] ?? 0,
        node.rotation?.[3] ?? 1,
    );

    const scale = vec3.fromValues(
        node.scale?.[0] ?? 1,
        node.scale?.[1] ?? 1,
        node.scale?.[2] ?? 1,
    );

    mat4.fromRotationTranslationScale(out, rotation, translation, scale);

    return out;
}