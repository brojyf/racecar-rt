import shaderCode from "./raytracer.wgsl?raw"
import type { TextureAtlas } from "../scene/mesh";

const MATERIAL_FLOAT_COUNT = 20;
const LIGHT_BUFFER_SIZE    = 32;
const CAMERA_BUFFER_SIZE   = 80;

export interface RTPipeline {
    renderPipeline: GPURenderPipeline;
    bindGroup     : GPUBindGroup;
    cameraBuffer  : GPUBuffer;
    sceneBuffer   : GPUBuffer;
    bvhBuffer     : GPUBuffer;
    materialBuffer: GPUBuffer;
    lightBuffer   : GPUBuffer;
    atlasTexture  : GPUTexture;
    atlasSampler  : GPUSampler;
    width         : number;
    height        : number;
}

export function createRTPipeline(
    device: GPUDevice,
    format: GPUTextureFormat,
    width : number,
    height: number
): RTPipeline {
    const renderPipeline = createRenderPipeline(device, format);
    const cameraBuffer = createUniformBuffer(device, CAMERA_BUFFER_SIZE);
    const sceneBuffer = createStorageBuffer(device, 12 * 4);
    const bvhBuffer = createStorageBuffer(device, 8 * 4);  
    const materialBuffer = createStorageBuffer(device, MATERIAL_FLOAT_COUNT * 4);
    const lightBuffer = createUniformBuffer(device, LIGHT_BUFFER_SIZE);
    const atlasTexture = createWhiteTexture(device);
    const atlasSampler = device.createSampler({
        magFilter: "linear",
        minFilter: "linear",
        addressModeU: "clamp-to-edge",
        addressModeV: "clamp-to-edge"
    });
    const bindGroup = createBindGroup(
        device,
        renderPipeline,
        cameraBuffer,
        sceneBuffer,
        bvhBuffer,
        lightBuffer,
        materialBuffer,
        atlasTexture,
        atlasSampler
    );

    return {
        renderPipeline: renderPipeline,
        bindGroup     : bindGroup,
        cameraBuffer  : cameraBuffer,
        sceneBuffer   : sceneBuffer,
        bvhBuffer     : bvhBuffer,
        materialBuffer: materialBuffer,
        lightBuffer   : lightBuffer,
        atlasTexture  : atlasTexture,
        atlasSampler  : atlasSampler,
        width         : width,
        height        : height
    };
}

export function reload(
    device       : GPUDevice,
    ppl          : RTPipeline,
    sceneArray   : Float32Array<ArrayBuffer>,
    bvhArray     : Float32Array<ArrayBuffer>,
    materialArray: Float32Array<ArrayBuffer>,
    atlas        : TextureAtlas
) {
    ppl.sceneBuffer.destroy();
    ppl.bvhBuffer.destroy();
    ppl.materialBuffer.destroy();
    ppl.atlasTexture.destroy();

    ppl.sceneBuffer = createStorageBuffer(device, sceneArray.byteLength);
    ppl.bvhBuffer = createStorageBuffer(device, bvhArray.byteLength);
    ppl.materialBuffer = createStorageBuffer(device, materialArray.byteLength);
    ppl.atlasTexture = createTextureFromAtlas(device, atlas);

    device.queue.writeBuffer(ppl.sceneBuffer, 0, sceneArray);
    device.queue.writeBuffer(ppl.bvhBuffer, 0, bvhArray);
    device.queue.writeBuffer(ppl.materialBuffer, 0, materialArray);

    ppl.bindGroup = createBindGroup(
        device,
        ppl.renderPipeline,
        ppl.cameraBuffer,
        ppl.sceneBuffer,
        ppl.bvhBuffer,
        ppl.lightBuffer,
        ppl.materialBuffer,
        ppl.atlasTexture,
        ppl.atlasSampler
    );
}

export function resize(
    ppl   : RTPipeline,
    width : number,
    height: number
) {
    if (ppl.width === width && ppl.height === height) { return; }
    ppl.width  = width;
    ppl.height = height;
}

// ===== bind group =====
function createBindGroup(
    device   : GPUDevice,
    ppl      : GPURenderPipeline, 
    camera   : GPUBuffer,
    scene    : GPUBuffer,
    bvh      : GPUBuffer,
    light    : GPUBuffer,
    material : GPUBuffer,
    atlas    : GPUTexture,
    sampler  : GPUSampler
): GPUBindGroup {
    return device.createBindGroup({
        layout: ppl.getBindGroupLayout(0),
        entries: [
            { binding: 0, resource: { buffer: camera } },
            { binding: 1, resource: { buffer: scene } },
            { binding: 2, resource: { buffer: bvh } },
            { binding: 3, resource: { buffer: light } },
            { binding: 4, resource: { buffer: material } },
            { binding: 5, resource: atlas.createView() },
            { binding: 6, resource: sampler }
        ]
    });
}

// ===== buffers =====
function createStorageBuffer(device: GPUDevice, byteLength: number): GPUBuffer {
    return device.createBuffer({
        size : byteLength,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST
    });
}

function createUniformBuffer(device: GPUDevice, byteLength: number): GPUBuffer {
    return device.createBuffer({
        size : byteLength,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
    });
}

// ===== texture =====
function createWhiteTexture(device: GPUDevice): GPUTexture {
    const texture = device.createTexture({
        size: [1, 1],
        format: "rgba8unorm",
        usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST
    });

    device.queue.writeTexture(
        { texture },
        new Uint8Array([255, 255, 255, 255]),
        { bytesPerRow: 4 },
        [1, 1]
    );

    return texture;
}

function createTextureFromAtlas(device: GPUDevice, atlas: TextureAtlas): GPUTexture {
    const texture = device.createTexture({
        size: [atlas.source.width, atlas.source.height],
        format: "rgba8unorm",
        usage: GPUTextureUsage.TEXTURE_BINDING
            | GPUTextureUsage.COPY_DST
            | GPUTextureUsage.RENDER_ATTACHMENT
    });

    device.queue.copyExternalImageToTexture(
        { source: atlas.source },
        { texture },
        [atlas.source.width, atlas.source.height]
    );

    return texture;
}

// ===== render pipeline =====
function createRenderPipeline(
    device: GPUDevice,
    format: GPUTextureFormat
): GPURenderPipeline {
    const shaderModule = device.createShaderModule({
        code: shaderCode
    });

    return device.createRenderPipeline({
        layout: "auto",
        vertex: {
            module: shaderModule,
            entryPoint: "vertMain"
        },
        fragment: {
            module: shaderModule,
            entryPoint: "fragMain",
            targets: [{ format }]
        },
        primitive: {
            topology: "triangle-list",
        }
    });
}
