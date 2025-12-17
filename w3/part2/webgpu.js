"use strict";
window.onload = function () {
    main();
};

async function main() {
    /** @type {HTMLCanvasElement} */
    const canvas = document.getElementById("canvas");
    var colors = {
        black: vec4(0.0, 0.0, 0.0, 1.0), // black
        red: vec4(1.0, 0.0, 0.0, 1.0), // red
        yellow: vec4(1.0, 1.0, 0.0, 1.0), // yellow
        green: vec4(0.0, 1.0, 0.0, 1.0), // green
        blue: vec4(0.0, 0.0, 1.0, 1.0), // blue
        magenta: vec4(1.0, 0.0, 1.0, 1.0), // magenta
        cyan: vec4(0.0, 1.0, 1.0, 1.0), // cyan
        cornflower: vec4(0.3921, 0.5843, 0.9294, 1.0), // cornflower
    };
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

    // load script from file
    const response = await fetch("./shaders.wgsl");
    const data = await response.text();

    const wgsl = device.createShaderModule({
        label: "Main shader module",
        code: data,
    });


    // NDC coordinates in WebGPU are in [-1,1]x[-1,1]x[0,1]
    const projection = perspective(45, canvas.width / canvas.height, 0, 10); 


    // Create a cube
    //    v5----- v6
    //   /|      /|
    //  v1------v2|
    //  | |     | |
    //  | |v4---  |-|v7
    //  |/      |/
    //  v0------v3

    var vertices = [
        vec3(0.0, 0.0, 1.0),
        vec3(0.0, 1.0, 1.0),
        vec3(1.0, 1.0, 1.0),
        vec3(1.0, 0.0, 1.0),
        vec3(0.0, 0.0, 0.0),
        vec3(0.0, 1.0, 0.0),
        vec3(1.0, 1.0, 0.0),
        vec3(1.0, 0.0, 0.0),
    ];

    // var centerTranslation = translate(-0.5, -0.5, -0.5);

    // vertices = vertices.map(v => {
    //     let v4 = mult(centerTranslation, vec4(v[0], v[1], v[2], 1.0));
    //     return vec3(v4[0], v4[1], v4[2]);
    // });

    function getView(eye, at)
    {
        var vpn = subtract(at, eye);
        var n = normalize(vpn);
        var v_up = vec3(0.0, 1.0, 0.0);
        var u = normalize(cross(v_up, n));
        var v = normalize(cross(n, u));
        return lookAt(eye, at, v);
    }

    const eye = vec3(0.0, 0.0, 5.0);

    var model = mat4();
    model = mult(translate(-0.5, -0.5, -0.5), model);

    var at = vec3(1.0, -1.0, 0.0);
    var view = getView(eye, at);
    var mvp = mult(projection, mult(view, model));

    var model2 = mat4();
    model2 = mult(translate(-0.5, -0.5, -0.5), model2);
    model2 = mult(rotateY(45), model2);
    var at2 = vec3(-1.0, -1.0, 0.0);
    var view2 = getView(eye, at2);
    var mvp2 = mult(projection, mult(view2, model2));

    var model3 = mat4();
    model3 = mult(translate(-0.5, -0.5, -0.5), model3);
    model3 = mult(rotateY(25), model3);
    model3 = mult(rotateX(-25), model3);
    var at3 = vec3(0.0, 1.0, 0.0);
    var view3 = getView(eye, at3);
    var mvp3 = mult(projection, mult(view3, model3));

    var modelMatrices = [mvp, mvp2, mvp3];

    // triangle mesh indices
    var indices = new Uint32Array([
        1, 0, 3, 3, 2, 1, // front
        2, 3, 7, 7, 6, 2, // right
        3, 0, 4, 4, 7, 3, // down
        6, 5, 1, 1, 2, 6, // up
        4, 5, 6, 6, 7, 4, // back
        5, 4, 0, 0, 1, 5, // left
    ]);

    // Wireframe indices
    var wire_indices = new Uint32Array([
        0, 1, 1, 2, 2, 3, 3, 0, // front
        2, 3, 3, 7, 7, 6, 6, 2, // right
        0, 3, 3, 7, 7, 4, 4, 0, // down
        1, 2, 2, 6, 6, 5, 5, 1, // up
        4, 5, 5, 6, 6, 7, 7, 4, // back
        0, 1, 1, 5, 5, 4, 4, 0, // left
    ]);

    var obj = new Object();

    obj.vPositionBuffer = device.createBuffer({
        size: flatten(vertices).byteLength,
        usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
    });
    device.queue.writeBuffer(obj.vPositionBuffer, 0, flatten(vertices));

    obj.vPositionBufferLayout = {
        arrayStride: sizeof["vec3"],
        attributes: [
            {
                format: "float32x3",
                offset: 0,
                shaderLocation: 0,
            },
        ],
    };

    obj.indicesBuffer = device.createBuffer({
        size: wire_indices.byteLength,
        usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST,
    });
    device.queue.writeBuffer(obj.indicesBuffer, 0, wire_indices);

    const uniformBuffer = device.createBuffer({
        size: sizeof["mat4"] * modelMatrices.length,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });
    var sum = [];
    for (var i = 0; i < modelMatrices.length; i++)
    {
        var flat = flatten(modelMatrices[i])
        for (var j = 0; j < 16; j++)
        {
            sum.push(flat[j]);
        }
    }
    var result = new Float32Array(sum);
    console.log(result);
    device.queue.writeBuffer(uniformBuffer, 0, result);

    const msaaTexture = device.createTexture({
        size: { width: canvas.width, height: canvas.height },
        format: canvasFormat,
        sampleCount: msaaCount,
        usage: GPUTextureUsage.RENDER_ATTACHMENT,
    });

    // setup renderpipeline
    const pipeline = device.createRenderPipeline({
        label: "Main render pipeline",
        layout: "auto",
        vertex: {
            module: wgsl,
            entryPoint: "main_vs",
            buffers: [obj.vPositionBufferLayout],
        },
        fragment: {
            module: wgsl,
            entryPoint: "main_fs",
            targets: [{ format: canvasFormat }],
        },
        primitive: {
            topology: "line-list",
            // GPUPrimitiveTopology { "point-list", "line-list", "line-strip", "triangle-list", "triangle-strip" };
        },
        multisample: {
            count: msaaCount,
        },
    });


    const bindGroup = device.createBindGroup({
        layout: pipeline.getBindGroupLayout(0),
        entries: [{ binding: 0, resource: { buffer: uniformBuffer } }],
    });

    // function renderFrame() {
    //     requestAnimationFrame(function () {
    //         render(device, context, vertices, colors, vertexBuffer, pipeline);
    //     });
    // }
    // setInterval(renderFrame, 16.666);
    render();

    function render() {
        const encoder = device.createCommandEncoder();
        const pass = encoder.beginRenderPass({
            colorAttachments: [
                {
                    view: msaaTexture.createView(),
                    resolveTarget: context.getCurrentTexture().createView(),
                    loadOp: "clear",
                    clearValue: colors.cornflower,
                    storeOp: "store",
                },
            ],
        });
        pass.setPipeline(pipeline);
        pass.setVertexBuffer(0, obj.vPositionBuffer);
        pass.setIndexBuffer(obj.indicesBuffer, "uint32");
        pass.setBindGroup(0, bindGroup);
        pass.drawIndexed(wire_indices.length, modelMatrices.length);
        pass.end();
        device.queue.submit([encoder.finish()]);
    }
}