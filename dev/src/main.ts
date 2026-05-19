import { createDevice } from './core/device';
import { setupCanvas } from './core/canvas';
import { createRTPipeline, reload, resize } from './core/pipeline';
import { cameraUniformData, defaultCamera } from './raytracer/camera';

import { setupMouseLook } from './core/input';
import { loadPreprocessedScene } from './loader/preprocessedLoader';
import { buildBVH } from './raytracer/bvh';
import { defaultLight, flattenLight } from './scene/light';
import { vec3 } from "gl-matrix";
import { materialsToBuffer, waterMaterial } from './scene/material';
import { boundingSphereFromBounds, createWaterPlane, flattenScene, meshesBounds } from './scene/scene';

const ASSET_PATH = "models/911-reduced-processed/scene.json";

// ===== setup =====
const device = await createDevice();
const { canvas, context, format } = setupCanvas(device);
const pipeline = createRTPipeline(device, format, canvas.width, canvas.height);
const camera = defaultCamera(canvas.width, canvas.height);
const fpsCounter = document.getElementById("fps-counter");
let fpsFrameCount = 0;
let fpsLastUpdate = performance.now();

// ===== data =====
const light = defaultLight();
device.queue.writeBuffer(pipeline.lightBuffer, 0, flattenLight(light));

const { meshes, materials, atlas } = await loadPreprocessedScene(ASSET_PATH);
const carBounds = meshesBounds(meshes);
addWaterPlane(meshes, materials, carBounds);

const sceneArr = flattenScene({ meshes });
const { nodes, triangles } = buildBVH(sceneArr);
reload(device, pipeline, triangles, nodes, materialsToBuffer(materials), atlas);

// ===== input =====
const sphere = boundingSphereFromBounds(carBounds);
setupMouseLook(canvas, camera, sphere.center, sphere.radius, carBounds.min[1]);

// ===== render =====
function frame() {
    resizeIfNeeded();
    updateFPS(performance.now());

    camera.width = canvas.width;
    camera.height = canvas.height;
    device.queue.writeBuffer(pipeline.cameraBuffer, 0, cameraUniformData(camera))
    updateCameraLight();

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
function updateCameraLight() {
    vec3.copy(light.position, camera.position);
    vec3.scaleAndAdd(light.position, light.position, camera.forward, 2.0);
    vec3.scaleAndAdd(light.position, light.position, camera.right, -0.3);
    vec3.scaleAndAdd(light.position, light.position, camera.up, 1.0);

    device.queue.writeBuffer(pipeline.lightBuffer, 0, flattenLight(light));
}

function updateFPS(now: number) {
    fpsFrameCount += 1;

    const elapsedMs = now - fpsLastUpdate;
    if (elapsedMs < 500) { return; }

    const fps = Math.round((fpsFrameCount * 1000) / elapsedMs);
    if (fpsCounter) { fpsCounter.textContent = `FPS: ${fps}`};

    fpsFrameCount = 0;
    fpsLastUpdate = now;
}

function addWaterPlane(
    meshList    : typeof meshes,
    materialList: typeof materials,
    bounds      : ReturnType<typeof meshesBounds>
) {
    const center = vec3.create();
    vec3.add(center, bounds.min, bounds.max);
    vec3.scale(center, center, 0.5);

    const waterIndex = materialList.length;
    materialList.push(waterMaterial());
    meshList.push(createWaterPlane(waterIndex, bounds.min[1], center, 5000));
}

function resizeIfNeeded() {
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;

    if (canvas.width === width && canvas.height === height) { return; }
    canvas.width = width;
    canvas.height = height;

    resize(pipeline, width, height);
}
