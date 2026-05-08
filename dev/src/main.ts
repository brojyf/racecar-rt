import { createDevice } from './core/device';
import { setupCanvas } from './core/canvas';
import { createRTPipeline, reload, resize } from './core/pipeline';
import { cameraUniformData, defaultCamera } from './raytracer/camera';
import { computeBoundingSphere, flattenScene } from "./scene/scene";
import { setupMouseLook } from './core/input';
import { loadGltf } from './scene/gltfLoader';
import { buildBVH } from './raytracer/bvh';

const ASSET_PATH = "models/911-reduced/scene.gltf";

// ===== setup =====
const device = await createDevice();
const { canvas, context, format } = setupCanvas(device);
const pipeline = createRTPipeline(device, format, canvas.width, canvas.height);
const camera = defaultCamera(canvas.width, canvas.height);
const fpsCounter = document.getElementById("fps-counter");
let fpsFrameCount = 0;
let fpsLastUpdate = performance.now();

// ===== data =====
const meshes = await loadGltf(ASSET_PATH);
const sceneArr = flattenScene({ meshes });
const { nodes, triangles } = buildBVH(sceneArr);
reload(device, pipeline, triangles, nodes);

// ===== input =====
const sphere = computeBoundingSphere(sceneArr);
setupMouseLook(canvas, camera, sphere.center, sphere.radius);

// ===== render =====
function frame() {
    resizeIfNeeded();
    updateFPS(performance.now());

    camera.width = canvas.width;
    camera.height = canvas.height;
    device.queue.writeBuffer(pipeline.cameraBuffer, 0, cameraUniformData(camera))

    const encoder = device.createCommandEncoder();
    const view = context.getCurrentTexture().createView();
    const pass = encoder.beginRenderPass({
        colorAttachments: [{
            view, 
            loadOp: "clear",
            storeOp: "store",
            clearValue: {r: 0, g: 0, b: 0, a: 1}
        }]
    });

    pass.setPipeline(pipeline.renderPipeline);
    pass.setBindGroup(0, pipeline.bindGroup);
    pass.draw(3);
    pass.end();

    device.queue.submit([encoder.finish()]);
    requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// ===== helper function =====
function updateFPS(now: number) {
    fpsFrameCount += 1;

    const elapsedMs = now - fpsLastUpdate;
    if (elapsedMs < 500) { return; }

    const fps = Math.round((fpsFrameCount * 1000) / elapsedMs);
    if (fpsCounter) { fpsCounter.textContent = `FPS: ${fps}`};

    fpsFrameCount = 0;
    fpsLastUpdate = now;
}

function resizeIfNeeded() {
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;

    if (canvas.width === width && canvas.height === height) { return; }
    canvas.width = width;
    canvas.height = height;

    resize(pipeline, width, height);
}