import { 
    CODE_RANGE, LEAF_TRIANGLE_COUNT, NODE_FLOAT_COUNT, TRIANGLE_BYTE_SIZE } from "../config";

export interface BVH {
    nodes    : Float32Array<ArrayBuffer>;
    triangles: Float32Array<ArrayBuffer>;
}

interface Node {
    minX: number; minY: number; minZ: number;
    maxX: number; maxY: number; maxZ: number;
    leftOrFirst: number;
    triCount: number;
}

export function buildBVH(triangles: Float32Array): BVH {
    const triCount = triangles.length / TRIANGLE_BYTE_SIZE;
    if (triCount === 0) {
        return {
            nodes: new Float32Array(NODE_FLOAT_COUNT),
            triangles: new Float32Array(0)
        };
    }

    const [triMin, triMax, triCen] = minMaxCenter(triCount, triangles);
    const centerBounds = centerAabb(triCen, triCount);
    const mortonCodes = new Uint32Array(triCount);
    for (let i = 0; i < triCount; i++) {
        mortonCodes[i] = mortonCodeForCenter(triCen, i, centerBounds);
    }

    const idx = new Uint32Array(triCount);
    for (let i = 0; i < triCount; i++) idx[i] = i;
    idx.sort((a, b) => mortonCodes[a] - mortonCodes[b]);

    const nodes = [emptyNode()];
    build(0, 0, triCount);
    const reordered = new Float32Array(triangles.length);
    for (let i = 0; i < triCount; i++) {
        const cur = idx[i] * TRIANGLE_BYTE_SIZE;
        reordered.set(triangles.subarray(cur, cur + TRIANGLE_BYTE_SIZE), i * TRIANGLE_BYTE_SIZE);
    }

    const flat = new Float32Array(nodes.length * NODE_FLOAT_COUNT);
    const flatU32 = new Uint32Array(flat.buffer);
    for (let i = 0; i < nodes.length; i++) {
        const n = nodes[i];
        const o = i * NODE_FLOAT_COUNT;
        flat[o + 0] = n.minX; 
        flat[o + 1] = n.minY; 
        flat[o + 2] = n.minZ;
        flatU32[o + 3] = n.leftOrFirst;

        flat[o + 4] = n.maxX; 
        flat[o + 5] = n.maxY; 
        flat[o + 6] = n.maxZ;
        flatU32[o + 7] = n.triCount;
    }

    return { nodes: flat, triangles: reordered };

    // ===== Inner Functions =====
    function build(nodeIdx: number, start: number, count: number) {
        const node = nodes[nodeIdx];
        calcAabb(node, start, count)

        if (count <= LEAF_TRIANGLE_COUNT) {
            node.leftOrFirst = start;
            node.triCount = count;
            return;
        }

        const leftCount = mortonSplit(idx, mortonCodes, start, count);
        const leftIdx = nodes.length;;
        nodes.push(emptyNode(), emptyNode());
        node.leftOrFirst = leftIdx;
        node.triCount = 0;

        build(leftIdx, start, leftCount);
        build(leftIdx + 1, start + leftCount, count - leftCount);
    }

    function calcAabb(node: Node, start: number, count: number) {
        let minX = Infinity, minY = Infinity, minZ = Infinity;
        let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;

        for (let i = 0; i < count; i++) {
            const offset = idx[start + i] * 3;
            minX = Math.min(minX, triMin[offset]);
            maxX = Math.max(maxX, triMax[offset]);
            minY = Math.min(minY, triMin[offset + 1]);
            maxY = Math.max(maxY, triMax[offset + 1]);
            minZ = Math.min(minZ, triMin[offset + 2]);
            maxZ = Math.max(maxZ, triMax[offset + 2]);
        }

        node.minX = minX;
        node.minY = minY;
        node.minZ = minZ;
        node.maxX = maxX;
        node.maxY = maxY;
        node.maxZ = maxZ;
    }
}

function mortonSplit(idx: Uint32Array, codes: Uint32Array, start: number, count: number): number {
    const firstCode = codes[idx[start]];
    const lastCode = codes[idx[start + count - 1]];
    if (firstCode === lastCode) return Math.floor(count / 2);

    const commonPrefix = Math.clz32(firstCode ^ lastCode);
    let low = start;
    let high = start + count - 1;

    while (low + 1 < high) {
        const mid = Math.floor((low + high) / 2);
        const midPrefix = Math.clz32(firstCode ^ codes[idx[mid]]);

        if (midPrefix > commonPrefix) {
            low = mid;
        } else {
            high = mid;
        }
    }

    return low - start + 1;
}

function mortonCodeForCenter(centers: Float32Array, triIdx: number, bounds: Node): number {
    const o = triIdx * 3;
    const x = normalizeCenter(centers[o + 0], bounds.minX, bounds.maxX);
    const y = normalizeCenter(centers[o + 1], bounds.minY, bounds.maxY);
    const z = normalizeCenter(centers[o + 2], bounds.minZ, bounds.maxZ);
    return morton3D(x, y, z);
}

function centerAabb(centers: Float32Array, triCount: number): Node {
    const bounds = infNode();

    for (let i = 0; i < triCount; i++) {
        const o = i * 3;
        const x = centers[o + 0];
        const y = centers[o + 1];
        const z = centers[o + 2];

        bounds.minX = Math.min(bounds.minX, x);
        bounds.maxX = Math.max(bounds.maxX, x);
        bounds.minY = Math.min(bounds.minY, y);
        bounds.maxY = Math.max(bounds.maxY, y);
        bounds.minZ = Math.min(bounds.minZ, z);
        bounds.maxZ = Math.max(bounds.maxZ, z);
    }

    return bounds;
}

// ===== Helpers' Helper Functions =====
function morton3D(x: number, y: number, z: number): number {
    return ((expandBits(x) << 2) | (expandBits(y) << 1) | expandBits(z)) >>> 0;
}

function expandBits(v: number): number {
    let x = v & 0x3ff;
    x = (x | (x << 16)) & 0x030000ff;
    x = (x | (x << 8))  & 0x0300f00f;
    x = (x | (x << 4))  & 0x030c30c3;
    x = (x | (x << 2))  & 0x09249249;
    return x;
}

function normalizeCenter(value: number, min: number, max: number): number {
    const range = max - min;
    if (range <= 0) return 0;
    
    const ratio = (value - min) / range;
    const result = Math.floor(ratio * CODE_RANGE);
    return Math.max(0, Math.min(CODE_RANGE, result));
}

function minMaxCenter(count: number, triangles: Float32Array) {
    const min = new Float32Array(count * 3);
    const max = new Float32Array(count * 3);
    const cen = new Float32Array(count * 3);

    for (let i = 0; i < count; i++) {
        const offset = i * TRIANGLE_BYTE_SIZE;
        const v0x = triangles[offset + 0];
        const v0y = triangles[offset + 1];
        const v0z = triangles[offset + 2];
        const v1x = triangles[offset + 4];
        const v1y = triangles[offset + 5];
        const v1z = triangles[offset + 6];
        const v2x = triangles[offset + 8];
        const v2y = triangles[offset + 9];
        const v2z = triangles[offset + 10];

        const minX = Math.min(v0x, v1x, v2x);
        const minY = Math.min(v0y, v1y, v2y);
        const minZ = Math.min(v0z, v1z, v2z);
        const maxX = Math.max(v0x, v1x, v2x);
        const maxY = Math.max(v0y, v1y, v2y);
        const maxZ = Math.max(v0z, v1z, v2z);

        min[i * 3 + 0] = minX;
        min[i * 3 + 1] = minY;
        min[i * 3 + 2] = minZ;
        max[i * 3 + 0] = maxX;
        max[i * 3 + 1] = maxY;
        max[i * 3 + 2] = maxZ;
        cen[i * 3 + 0] = (minX + maxX) * 0.5;
        cen[i * 3 + 1] = (minY + maxY) * 0.5;
        cen[i * 3 + 2] = (minZ + maxZ) * 0.5;
    }

    return [min, max, cen];
}

function infNode(): Node {
    return {
        minX: Infinity, minY: Infinity, minZ: Infinity,
        maxX: -Infinity, maxY: -Infinity, maxZ: -Infinity,
        leftOrFirst: 0, triCount: 0
    };
}

function emptyNode(): Node {
    return {
        minX: 0, minY: 0, minZ: 0,
        maxX: 0, maxY: 0, maxZ: 0,
        leftOrFirst: 0, triCount: 0
    };
}
