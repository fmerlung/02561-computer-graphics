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
    colorMenu.selectedIndex = 0;
    const drawingMode = document.getElementById("drawingMode");
    var max_verts = 600;
    var vertexPos = [];
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

    function clearCanvas() {
        bgcolor = colors[clearMenu.selectedIndex];
        vertices = [];
        vertexColors = [];
        vertexPos = [];
    };

    drawingMode.onchange = clearCanvas;

    clearButton.addEventListener("mousedown", clearCanvas);


    var mousePos = vec2(0.0, 0.0);
    canvas.addEventListener("mousedown", function (e) {
        var bbox = e.target.getBoundingClientRect();
        mousePos = vec2(
            (2 * (e.clientX - bbox.left)) / canvas.width - 1,
            (2 * (canvas.height - e.clientY + bbox.top - 1)) / canvas.height - 1
        );
        vertexPos.push(mousePos);
        if (vertices.length < max_verts) {
            add_point(vertices, new Float32Array(mousePos), point_size);
            for (var i = 0; i < 6; i++)
            {
                vertexColors.push(colors[colorMenu.selectedIndex]);
            }
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
        primitive: {
            topology: "triangle-list"
        }
    });

    function renderFrame() {
        requestAnimationFrame( function () {
            render(device, 
            context, 
            bgcolor, 
            vertices, 
            vertexColors,
            vertexBuffer, 
            vertexColorBuffer,
            pipeline,
            drawingMode.selectedIndex,
            vertexPos)
        })
    };
    setInterval(renderFrame, 16.666);
}

function render(device, 
                context, 
                bgcolor, 
                vertices, 
                vertexColors, 
                vertexBuffer, 
                vertexColorBuffer, 
                pipeline, 
                drawingMode,
                vertexPos) {
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

    if (drawingMode == 1) {

        if (vertexPos.length == 3) {
            var currentColor = vertexColors[vertexColors.length - 1];
            for (var i = 0; i < 18; i++) {
                vertices.pop();
                vertexColors.pop();
            }

            for (var i = 0; i < 3; i++) {
                vertices.push(vertexPos[i]);
                vertexColors.push(currentColor);
            }
        }

        if (vertexPos.length > 3) {
            vertexPos[0] = vertexPos[vertexPos.length - 1];
            for (var i = 0; i < 3; i++) {
                vertexPos.pop();
                vertices.shift()
                vertexColors.shift()
            }
        }
    }
    if (drawingMode == 2 && vertexPos.length == 2) {
        var currentColor = vertexColors[vertexColors.length - 1];
        for (var i = 0; i < vertices.length; i++) {
            vertices.pop();
        }
        vertices = createCircleVertices(vertexPos[0], vertexPos[1]);
        while (vertexColors.length > 0) {
            vertexColors.pop();
        }
        for (var i = 0; i < vertices.length; i++) {
            vertexColors.push(currentColor);
        }
    }
    if (drawingMode == 2 && vertexPos.length > 2) {
        vertexPos.shift();
        vertexPos.shift();
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
    if (vertices.length > 0) {
        pass.setVertexBuffer(0, vertexBuffer);
        pass.setVertexBuffer(1, vertexColorBuffer);
        pass.setPipeline(pipeline);
        pass.draw(vertices.length);
    }
    pass.end();
    device.queue.submit([encoder.finish()]);
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

function createCircleVertices(center, point2) {
    const numSubdivisions = 32;

    // find radius
    var radius = length(vec2(point2[0] - center[0], point2[1] - center[1]));

    var vertices = [];
    var angleIncrement = (2 * Math.PI) / numSubdivisions;
    var currentAngle = 0;
    var currentPoint = 0;
    var nextIncrement = angleIncrement;
    var nextPoint = 0;
    var tmp = vec2(0.0, 0.0);

    for (let i = 0; i <= numSubdivisions; ++i) {
        vertices.push(center);
        currentPoint = vec2(Math.cos(currentAngle), Math.sin(currentAngle));
        tmp = scale(radius, currentPoint);
        tmp = add(center, tmp);
        vertices.push(tmp);
        nextPoint = vec2(Math.cos(nextIncrement), Math.sin(nextIncrement));
        tmp = scale(radius, nextPoint);
        tmp = add(center, tmp);
        vertices.push(tmp);
        currentAngle = nextIncrement;
        nextIncrement = (1 + i) * angleIncrement;
    }
    return vertices;
}