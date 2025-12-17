"use strict";
window.onload = function () {
    main();
};
async function main() {
    const canvas = document.getElementById("canvas");

    if (!navigator.gpu) {
        throw new Error("WebGPU not supported on this browser.");
    }

    const adapter = await navigator.gpu.requestAdapter();
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

    const vertices = new Float32Array([
        -4, -1, -1, 1,
        4, -1, -1, 1,
        4, -1, -21, 1,
        -4, -1, -21, 1,
    ]);

    const uvs = new Float32Array([
        -1.5, 0.0, 
        2.5, 0.0, 
        2.5, 10.0, 
        -1.5, 10.0
    ]);

    const indices = new Uint32Array([0, 1, 2, 0, 2, 3]);

    const obj = {};

    obj.vPositionBuffer = device.createBuffer({
        size: vertices.byteLength,
        usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
    });
    device.queue.writeBuffer(obj.vPositionBuffer, 0, vertices);

    obj.vUVBuffer = device.createBuffer({
        size: uvs.byteLength,
        usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
    });
    device.queue.writeBuffer(obj.vUVBuffer, 0, uvs);

    obj.indicesBuffer = device.createBuffer({
        size: indices.byteLength,
        usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST,
    });
    device.queue.writeBuffer(obj.indicesBuffer, 0, indices);

    const texSize = 64;
    const texData = new Uint8Array(texSize * texSize * 4);

    for (let i = 0; i < texSize; ++i) {
        // y
        for (let j = 0; j < texSize; ++j) {
            // x
            const blockX = Math.floor(j / 8);
            const blockY = Math.floor(i / 8);

            const isWhite = (blockX + blockY) % 2 === 0;
            const color = isWhite ? 255 : 0;

            const idx = (i * texSize + j) * 4;
            texData[idx] = color;
            texData[idx + 1] = color; 
            texData[idx + 2] = color; 
            texData[idx + 3] = 255; 
        }
    }

    const texture = device.createTexture({
        size: [texSize, texSize, 1],
        format: "rgba8unorm",
        usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST,
    });

    device.queue.writeTexture(
        { texture: texture },
        texData,
        { bytesPerRow: texSize * 4 },
        [texSize, texSize]
    );

    const sampler = device.createSampler({
        addressModeU: "repeat",
        addressModeV: "repeat",
        magFilter: "nearest",
        minFilter: "nearest",
    });

    const uniformBuffer = device.createBuffer({
        size: 64,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });

    const pipeline = device.createRenderPipeline({
        label: "Texture pipeline",
        layout: "auto",
        vertex: {
            module: wgsl,
            entryPoint: "main_vs",
            buffers: [
                {
                    arrayStride: 16,
                    stepMode: "vertex",
                    attributes: [
                        { format: "float32x4", offset: 0, shaderLocation: 0 },
                    ],
                },
                {
                    arrayStride: 8,
                    stepMode: "vertex",
                    attributes: [
                        { format: "float32x2", offset: 0, shaderLocation: 1 },
                    ],
                },
            ],
        },
        fragment: {
            module: wgsl,
            entryPoint: "main_fs",
            targets: [{ format: canvasFormat }],
        },
        primitive: {
            topology: "triangle-list",
        },
    });

    const bindGroup = device.createBindGroup({
        layout: pipeline.getBindGroupLayout(0),
        entries: [
            { binding: 0, resource: { buffer: uniformBuffer } },
            { binding: 1, resource: sampler },
            { binding: 2, resource: texture.createView() },
        ],
    });

    const projection = perspective(90, canvas.width / canvas.height, 0.1, 100);
    const mvp = projection;

    device.queue.writeBuffer(uniformBuffer, 0, flatten(mvp));

    requestAnimationFrame(frame);

    function frame() {
        const encoder = device.createCommandEncoder();
        const pass = encoder.beginRenderPass({
            colorAttachments: [
                {
                    view: context.getCurrentTexture().createView(),
                    loadOp: "clear",
                    clearValue: { r: 0.0, g: 0.0, b: 1.0, a: 1.0 },
                    storeOp: "store",
                },
            ],
        });

        pass.setPipeline(pipeline);
        pass.setVertexBuffer(0, obj.vPositionBuffer);
        pass.setVertexBuffer(1, obj.vUVBuffer);
        pass.setIndexBuffer(obj.indicesBuffer, "uint32");
        pass.setBindGroup(0, bindGroup);
        pass.drawIndexed(indices.length);
        pass.end();

        device.queue.submit([encoder.finish()]);
        requestAnimationFrame(frame);
    }
}
