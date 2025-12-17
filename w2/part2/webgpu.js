"use strict";
window.onload = function () {
    main();
};
async function main() {
    /** @type {HTMLCanvasElement} */
    const canvas = document.getElementById("canvas");
    const clearMenu = document.getElementById("clearMenu");
    const clearButton = document.getElementById("clearButton");
    const colorMenu = document.getElementById("colorMenu");
    var max_verts = 600;
    var colors = [
        vec4(0.0, 0.0, 0.0, 1.0),         // black
        vec4(1.0, 0.0, 0.0, 1.0),         // red
        vec4(1.0, 1.0, 0.0, 1.0),         // yellow
        vec4(0.0, 1.0, 0.0, 1.0),         // green
        vec4(0.0, 0.0, 1.0, 1.0),         // blue
        vec4(1.0, 0.0, 1.0, 1.0),         // magenta
        vec4(0.0, 1.0, 1.0, 1.0),         // cyan
        vec4(0.3921, 0.5843, 0.9294, 1.0) // cornflower
    ];
    var bgcolor = colors[clearMenu.selectedIndex];
    clearButton.addEventListener("mousedown", function (e) {
        bgcolor = colors[clearMenu.selectedIndex];
        vertices = [];
        vertexColors = [];
    });


    var mousePos = vec2(0.0, 0.0);
    canvas.addEventListener("mousedown", function (e) {
        var bbox = e.target.getBoundingClientRect();
        mousePos = vec2(
            (2 * (e.clientX - bbox.left)) / canvas.width - 1,
            (2 * (canvas.height - e.clientY + bbox.top - 1)) / canvas.height - 1
        );
        if (vertices.length < max_verts) {
            add_point(vertices, new Float32Array(mousePos), point_size);
            for (var i = 0; i < 6; i++)
            {
                vertexColors.push(colors[colorMenu.selectedIndex]);
            }

            device.queue.writeBuffer(
                vertexBuffer,
                /*bufferOffset=*/ 0,
                flatten(vertices)
            );
            device.queue.writeBuffer(
                vertexColorBuffer,
                /*bufferOffset=*/ 0,
                flatten(vertexColors)
            );
        }
    });

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

    // load script from file
    const response = await fetch("./shaders.wgsl");
    const data = await response.text();

    const wgsl = device.createShaderModule({
        label: "Main shader module",
        code: data,
    });

    // creating buffer and connecting it to location 0 for vertex shader
    const point_size = 10 * (2 / canvas.height);
    var vertices = [];

    const vertexBuffer = device.createBuffer({
        label: "vertexBuffer",
        size: max_verts * sizeof["vec2"],
        usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
    });

    device.queue.writeBuffer(
        vertexBuffer,
        /*bufferOffset=*/ 0,
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
            },
        ],
    };

     // creating color buffer and connecting it to location 1 for shader
    var vertexColors = [];

    const vertexColorBuffer = device.createBuffer({
        label: "vertexColorBuffer",
        size: max_verts * sizeof["vec4"],
        usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
    });

    device.queue.writeBuffer(
        vertexColorBuffer,
        /*bufferOffset=*/  0,
        flatten(vertexColors)
    );

    const vertexColorBufferLayout = {
        arrayStride: 4 * 4,
        attributes: [
            {
                format:"float32x4",
                offset: 0,
                shaderLocation: 1,
            }
        ]
    };


    // setup renderpipeline
    const pipeline = device.createRenderPipeline({
        label: "Main render pipeline",
        layout: "auto",
        vertex: {
            module: wgsl,
            entryPoint: "main_vs",
            buffers: [vertexBufferLayout, vertexColorBufferLayout],
        },
        fragment: {
            module: wgsl,
            entryPoint: "main_fs",
            targets: [{ format: canvasFormat }],
        },
    });

    // Create a render pass in a command buffer and submit it
    function animate() {
        const encoder = device.createCommandEncoder();
        const pass = encoder.beginRenderPass({
            colorAttachments: [
                {
                    view: context.getCurrentTexture().createView(),
                    loadOp: "clear",
                    clearValue: bgcolor,
                    storeOp: "store",
                },
            ],
        });
        if (vertices.length > 0) {
            pass.setVertexBuffer(0, vertexBuffer);
            pass.setVertexBuffer(1, vertexColorBuffer);
            pass.setPipeline(pipeline);
            pass.draw(vertices.length);
        }
        pass.end();
        device.queue.submit([encoder.finish()]);
        requestAnimationFrame(animate);
    }
    requestAnimationFrame(animate);
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
