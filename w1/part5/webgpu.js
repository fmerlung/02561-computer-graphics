// triangle-strip does not work as seen, because the center isn't 
// continually used throughout when the generating triangles. 
// The proper solution is probably to just do triangle-list, but that wasn't the assignment.
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
    // const shader = await fetch("./shaders.wgsl").then(res => res.text());

    const wgsl = device.createShaderModule({
        label: "Main shader module",
        code: `
struct VertexOutput {
    @builtin(position) position: vec4f,
};

@vertex
fn main_vs(@location(0) position: vec4f) -> VertexOutput
{ 
    var output : VertexOutput;
    output.position = position;
    return output;
} 

@fragment 
fn main_fs(fragData: VertexOutput) -> @location(0) vec4f
{ 
    return vec4f(1.0, 1.0, 1.0, 1); 
}
`,
    });

    // creating buffer and connecting it to location 0 for vertex shader
    const point_size = 10 * (2 / canvas.height);
    var vertices = generate_circle_vertices(20, 0.5);
    console.log(vertices);



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
        primitive: {
            topology: "triangle-strip",
        }
    });

    console.log(vertices[vertices.length / 2])
    var fps = 60;
    var direction = "up";
    function frame() {
        if (vertices[Math.floor(vertices.length * 3/4)][1] >= 1)
        {
            direction = "down";
        }
        else if (vertices[Math.floor(vertices.length / 4)][1] <= -1) {
            direction = "up"
        }

        if (direction == "up") {
            for (var i = 0; i < vertices.length; i++) {
                vertices[i] = translate_vertix(vertices[i], 0, 0.01);
            }
        }
        else {
            for (var i = 0; i < vertices.length; i++) {
                vertices[i] = translate_vertix(vertices[i], 0, -0.01);
            }
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

function translate_vertix(vertix2D, distance_x, distance_y) {
    var vertix = vertix2D;
    vertix[0] += distance_x;
    vertix[1] += distance_y;
    return vertix;
}

function generate_circle_vertices(numVertices, radius) {
    var vertices = [];
    var angle = 0;
    for (var i = numVertices; i > 0; i--) {
        angle = 2 * Math.PI * i / numVertices;
        vertices.push(vec2(radius * Math.cos(angle), radius * Math.sin(angle)));
    }
    vertices.push(vec2(vertices[0][0], vertices[0][1]));
    return vertices;
}