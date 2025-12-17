"use strict";
window.onload = function () {
    main();
};

async function main() {
    /** @type {HTMLCanvasElement} */
    const canvas = document.getElementById("canvas");
    const msaaCount = 4;

    if (!navigator.gpu) {
        throw new Error("WebGPU not supported on this browser.");
    }

    const adapter = await navigator.gpu.requestAdapter();
    if (!adapter) {
        throw new Error("No appropriate GPUAdapter found.");
    }

    const device = await adapter.requestDevice();
    const context = canvas.getContext("webgpu");
    const canvasFormat = navigator.gpu.getPreferredCanvasFormat();
    context.configure({
        device: device,
        format: canvasFormat,
    });

    const response = await fetch("./shaders.wgsl");
    const data = await response.text();

    const wgsl = device.createShaderModule({
        label: "Main shader module",
        code: data,
    });

    const drawingInfo = await readOBJFile("./suzanne.obj", 1.0, true);

    if (!drawingInfo) {
        console.error("Failed to load OBJ file");
        return;
    }

    
    const obj = {};

    obj.vPositionBuffer = device.createBuffer({
        size: drawingInfo.vertices.byteLength,
        usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
    });
    device.queue.writeBuffer(obj.vPositionBuffer, 0, drawingInfo.vertices);

    obj.vNormalBuffer = device.createBuffer({
        size: drawingInfo.normals.byteLength,
        usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
    });
    device.queue.writeBuffer(obj.vNormalBuffer, 0, drawingInfo.normals);

    obj.vColorBuffer = device.createBuffer({
        size: drawingInfo.colors.byteLength,
        usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
    });
    device.queue.writeBuffer(obj.vColorBuffer, 0, drawingInfo.colors);

    obj.indicesBuffer = device.createBuffer({
        size: drawingInfo.indices.byteLength,
        usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST,
    });
    device.queue.writeBuffer(obj.indicesBuffer, 0, drawingInfo.indices);

    const uniformBufferSize = 192;
    const uniformBuffer = device.createBuffer({
        size: uniformBufferSize,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });

    const depthTexture = device.createTexture({
        size: { width: canvas.width, height: canvas.height },
        format: "depth24plus",
        usage: GPUTextureUsage.RENDER_ATTACHMENT,
        sampleCount: msaaCount,
    });

    const pipeline = device.createRenderPipeline({
        label: "Main render pipeline",
        layout: "auto",
        vertex: {
            module: wgsl,
            entryPoint: "main_vs",
            buffers: [
                {
                    arrayStride: 16, // 4 floats * 4 bytes
                    stepMode: "vertex",
                    attributes: [{ format: "float32x4", offset: 0, shaderLocation: 0 }],
                },
                {
                    arrayStride: 16,
                    stepMode: "vertex",
                    attributes: [{ format: "float32x4", offset: 0, shaderLocation: 1 }],
                },
                {
                    arrayStride: 16,
                    stepMode: "vertex",
                    attributes: [{ format: "float32x4", offset: 0, shaderLocation: 2 }],
                }
            ],
        },
        fragment: {
            module: wgsl,
            entryPoint: "main_fs",
            targets: [{ format: canvasFormat }],
        },
        primitive: {
            topology: "triangle-list",
            cullMode: "back",
        },
        depthStencil: {
            depthWriteEnabled: true,
            depthCompare: "less",
            format: "depth24plus",
        },
        multisample: {
            count: msaaCount,
        },
    });

    const bindGroup = device.createBindGroup({
        layout: pipeline.getBindGroupLayout(0),
        entries: [{ binding: 0, resource: { buffer: uniformBuffer } }],
    });

    const msaaTexture = device.createTexture({
        size: { width: canvas.width, height: canvas.height },
        format: canvasFormat,
        sampleCount: msaaCount,
        usage: GPUTextureUsage.RENDER_ATTACHMENT,
    });

    const projection = perspective(45, canvas.width / canvas.height, 0.1, 100);

    requestAnimationFrame(frame);

    function frame() {
        var time = Date.now() / 1000;
        var radius = 4.0;
        
        var eye = vec3(radius * Math.sin(time * 0.5), 2.0, radius * Math.cos(time * 0.5));
        var at = vec3(0.0, 0.0, 0.0);
        var up = vec3(0.0, 1.0, 0.0);
        
        var view = lookAt(eye, at, up);

        var model = mat4();

        var normalMatrix = model; 

        var mvp = mult(projection, mult(view, model));

        device.queue.writeBuffer(uniformBuffer, 0, flatten(mvp));
        device.queue.writeBuffer(uniformBuffer, 64, flatten(model));
        device.queue.writeBuffer(uniformBuffer, 128, flatten(normalMatrix));

        const encoder = device.createCommandEncoder();
        const pass = encoder.beginRenderPass({
            colorAttachments: [
                {
                    view: msaaTexture.createView(),
                    resolveTarget: context.getCurrentTexture().createView(),
                    loadOp: "clear",
                    clearValue: { r: 0.39, g: 0.58, b: 0.93, a: 1.0 }, // Cornflower blue
                    storeOp: "store",
                },
            ],
            depthStencilAttachment: {
                view: depthTexture.createView(),
                depthLoadOp: "clear",
                depthClearValue: 1.0,
                depthStoreOp: "store",
            },
        });
        
        pass.setPipeline(pipeline);
        
        pass.setVertexBuffer(0, obj.vPositionBuffer);
        pass.setVertexBuffer(1, obj.vNormalBuffer);
        pass.setVertexBuffer(2, obj.vColorBuffer);
        
        pass.setIndexBuffer(obj.indicesBuffer, "uint32");
        pass.setBindGroup(0, bindGroup);
        
        pass.drawIndexed(drawingInfo.indices.length, 1); 
        
        pass.end();
        device.queue.submit([encoder.finish()]);
        
        requestAnimationFrame(frame);
    }
}