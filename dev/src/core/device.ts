export async function createDevice(): Promise<GPUDevice> {
    const adapter = await navigator.gpu.requestAdapter();
    if (!adapter) throw new Error("DEVICE_WEBGPU_NOT_AVAILABLE");
    return adapter.requestDevice();
}