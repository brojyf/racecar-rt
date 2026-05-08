export interface CanvasSetup {
    canvas  : HTMLCanvasElement;
    context : GPUCanvasContext;
    format  : GPUTextureFormat;
}

export function setupCanvas(device: GPUDevice): CanvasSetup {
    const canvas = document.querySelector<HTMLCanvasElement>("#canvas");
    if (!canvas) throw new Error("CANVAS_NOT_FOUND");
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const context = canvas.getContext("webgpu");
    if (!context) throw new Error("CANVAS_CTX_NOT_FOUND");
    
    const format = navigator.gpu.getPreferredCanvasFormat();

    context.configure({
        device    : device, 
        format    : format, 
        alphaMode : "opaque"
    })

    return { canvas, context, format }
}