import shaderCode from "./raytracer.wgsl?raw"
import { CAMERA_BUFFER_SIZE } from "../config";

export interface RTPipeline {
    renderPipeline: GPURenderPipeline;
    bindGroup     : GPUBindGroup;
    cameraBuffer  : GPUBuffer;
    sceneBuffer   : GPUBuffer;
    bvhBuffer     : GPUBuffer;
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
    const cameraBuffer = createCameraBuffer(device);
    const sceneBuffer = createStorageBuffer(device, 12 * 4);
    const bvhBuffer = createStorageBuffer(device, 8 * 4);  
    const bindGroup = createBindGroup(
        device,
        renderPipeline,
        cameraBuffer,
        sceneBuffer,
        bvhBuffer
    );

    return {
        renderPipeline: renderPipeline,
        bindGroup     : bindGroup,
        cameraBuffer  : cameraBuffer,
        sceneBuffer   : sceneBuffer,
        bvhBuffer     : bvhBuffer,
        width         : width,
        height        : height
    };
}

export function reload(
    device    : GPUDevice,
    ppl       : RTPipeline,
    sceneArray: Float32Array<ArrayBuffer>,
    bvhArray  : Float32Array<ArrayBuffer>
) {
    ppl.sceneBuffer.destroy();
    ppl.bvhBuffer.destroy();

    ppl.sceneBuffer = createStorageBuffer(device, sceneArray.byteLength);
    ppl.bvhBuffer = createStorageBuffer(device, bvhArray.byteLength);

    device.queue.writeBuffer(ppl.sceneBuffer, 0, sceneArray);
    device.queue.writeBuffer(ppl.bvhBuffer, 0, bvhArray);

    ppl.bindGroup = createBindGroup(
        device,
        ppl.renderPipeline,
        ppl.cameraBuffer,
        ppl.sceneBuffer,
        ppl.bvhBuffer
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

// ===== helper function =====
function createBindGroup(
    device: GPUDevice,
    ppl   : GPURenderPipeline, 
    camera: GPUBuffer,
    scene : GPUBuffer,
    bvh   : GPUBuffer
): GPUBindGroup {
    return device.createBindGroup({
        layout: ppl.getBindGroupLayout(0),
        entries: [
            {
                binding: 0,
                resource: { buffer: camera }
            },
            {
                binding: 1,
                resource: { buffer: scene }
            },
            {
                binding: 2,
                resource: { buffer: bvh }
            }
        ]
    });
}

function createStorageBuffer(device: GPUDevice, byteLength: number): GPUBuffer {
    return device.createBuffer({
        size : byteLength,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST
    });
}

function createCameraBuffer(device: GPUDevice): GPUBuffer {
    return device.createBuffer({
        size : CAMERA_BUFFER_SIZE,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
    });
}

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
