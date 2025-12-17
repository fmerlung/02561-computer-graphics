"use strict";
window.onload = function () {
    main();
};
async function main() {
    /** @type {HTMLCanvasElement} */
    const canvas = document.querySelector("canvas");

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

    // load shader script from file
    const response = await fetch("./shaders.wgsl");
    const data = await response.text();

    const wgsl = device.createShaderModule({
        label: "Main shader module",
        code: data,
    });

    // creating buffer and connecting it to location 0 for vertex shader
    const point_size = 10 * (2 / canvas.height);
    var vertices = [];
    // bottom right
    vertices.push(vec2(-0.5, -0.5));
    vertices.push(vec2(0.5, -0.5));
    vertices.push(vec2(0.5, 0.5));
    // top left
    vertices.push(vec2(-0.5, -0.5));
    vertices.push(vec2(-0.5, 0.5));
    vertices.push(vec2(0.5, 0.5));

    for (var i = 0; i < vertices.length; i++) {
        vertices[i] = rotate_vertix(vertices[i], 45);
    }

    const vertexBuffer = device.createBuffer({
        label: "vertexBuffer",
        size: flatten(vertices).byteLength,
        usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
    });

    device.queue.writeBuffer(
        vertexBuffer,
        /*bufferOffset=*/  0,
        flatten(vertices)
    );

    // layout for pipeline
    const vertexBufferLayout = {
        arrayStride: 4 * 2, // 2 floats for position (vec2f) + 3 floats for color (vec3f) = 5 floats * 4 bytes
        attributes: [
            {
                format: "float32x2", // Position: vec2f
                offset: 0, // Position starts at the beginning of the buffer
                shaderLocation: 0, // Corresponds to @location(0) inPos
            }
        ],
    };

    // setup renderpipeline
    const pipeline = device.createRenderPipeline({
        label: "Main render pipeline",
        layout: "auto",
        vertex: {
            module: wgsl,
            entryPoint: "main_vs",
            buffers: [vertexBufferLayout],
        },
        fragment: {
            module: wgsl,
            entryPoint: "main_fs",
            targets: [{ format: canvasFormat }],
        },
    });

    var fps = 60;
    function frame() {
        // Create a rotation matrix that rotates over time
        for (var i = 0; i < vertices.length; i++) {
            vertices[i] = rotate_vertix(vertices[i], 1);
        }

        device.queue.writeBuffer(vertexBuffer, 0, flatten(vertices));

        // Create a command encoder and render pass
        const encoder = device.createCommandEncoder();
        const pass = encoder.beginRenderPass({
            colorAttachments: [
                {
                    view: context.getCurrentTexture().createView(),
                    loadOp: "clear",
                    clearValue: { r: 0.3921, g: 0.5843, b: 0.9294, a: 1.0 },
                    storeOp: "store",
                },
            ],
        });

        pass.setPipeline(pipeline);
        pass.setVertexBuffer(0, vertexBuffer);
        pass.draw(vertices.length);
        pass.end();

        device.queue.submit([encoder.finish()]);

        // Set a timeout to limit framerate
        setTimeout(function() { requestAnimationFrame(frame); }, 1000 / fps);
    }

    // Start the animation loop
    frame();
}

function add_point(array, point, size) {
    const offset = size / 2;
    var point_coords = [
        vec2(point[0] - offset, point[1] - offset),
        vec2(point[0] + offset, point[1] - offset),
        vec2(point[0] - offset, point[1] + offset),
        vec2(point[0] - offset, point[1] + offset),
        vec2(point[0] + offset, point[1] - offset),
        vec2(point[0] + offset, point[1] + offset),
    ];
    array.push.apply(array, point_coords);
}

function rotate_vertix(vertix, degrees) {
    var angle = radians(degrees);
    var rotatedPosition = vec2(
        vertix[0] * Math.cos(angle) + vertix[1] * -Math.sin(angle),
        vertix[0] * Math.sin(angle) + vertix[1] * Math.cos(angle)
    );
    return rotatedPosition;
}