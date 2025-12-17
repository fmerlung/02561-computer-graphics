"use strict";
window.onload = function () {
    main();
};

async function main() {
    /** @type {HTMLCanvasElement} */
    const canvas = document.getElementById("canvas");
    var colors = {
        cornflower: vec4(0.3921, 0.5843, 0.9294, 1.0),
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

    const response = await fetch("./shaders.wgsl");
    const data = await response.text();

    const wgsl = device.createShaderModule({
        label: "Main shader module",
        code: data,
    });

    const projection = perspective(45, canvas.width / canvas.height, 0.1, 10);

    var subdivisionLevel = 2; 
    var points = [];
    var indices = [];

    // tetrahedron vertices
    const va = vec3(0.0, 0.0, 1.0);
    const vb = vec3(0.0, 0.942809, -0.333333);
    const vc = vec3(-0.816497, -0.471405, -0.333333);
    const vd = vec3(0.816497, -0.471405, -0.333333);

    function normalizePoint(v) {
        var len = Math.sqrt(v[0]*v[0] + v[1]*v[1] + v[2]*v[2]);
        if (len === 0.0) return v;
        return vec3(v[0] / len, v[1] / len, v[2] / len);
    }

    function midpoint(a, b) {
        return vec3((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2);
    }

    function triangle(a, b, c) {
        points.push(a);
        points.push(b);
        points.push(c);
    }

    function divideTriangle(a, b, c, count) {
        if (count > 0) {
            var ab = normalizePoint(midpoint(a, b));
            var ac = normalizePoint(midpoint(a, c));
            var bc = normalizePoint(midpoint(b, c));

            divideTriangle(a, ab, ac, count - 1);
            divideTriangle(ab, b, bc, count - 1);
            divideTriangle(bc, c, ac, count - 1);
            divideTriangle(ab, bc, ac, count - 1);
        } else {
            triangle(a, b, c);
        }
    }

    function tetrahedron(a, b, c, d, n) {
        divideTriangle(a, b, c, n);
        divideTriangle(d, c, b, n);
        divideTriangle(a, d, b, n);
        divideTriangle(a, c, d, n);
    }

    function generateGeometry() {
        points = [];
        indices = [];
        tetrahedron(va, vb, vc, vd, subdivisionLevel);
        
        for (let i = 0; i < points.length; i++) {
            indices.push(i);
        }
    }

    const obj = {};

    function initBuffers() {
        obj.vPositionBuffer = device.createBuffer({
            size: flatten(points).byteLength,
            usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
        });
        device.queue.writeBuffer(obj.vPositionBuffer, 0, flatten(points));

        obj.vPositionBufferLayout = {
            arrayStride: sizeof["vec3"],
            attributes: [{ format: "float32x3", offset: 0, shaderLocation: 0 }],
        };

        var indicesArray = new Uint32Array(indices);
        obj.indicesBuffer = device.createBuffer({
            size: indicesArray.byteLength,
            usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST,
        });
        device.queue.writeBuffer(obj.indicesBuffer, 0, indicesArray);
    }

    generateGeometry();
    initBuffers();

    const uniformBuffer = device.createBuffer({
        size: sizeof["mat4"], 
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
            buffers: [obj.vPositionBufferLayout],
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

    document.getElementById("increment").onclick = function() {
        if (subdivisionLevel < 6) {
            subdivisionLevel++;
            generateGeometry();
            initBuffers();
            render();
        }
    };

    document.getElementById("decrement").onclick = function() {
        if (subdivisionLevel > 0) {
            subdivisionLevel--;
            generateGeometry();
            initBuffers();
            render();
        }
    };

    const msaaTexture = device.createTexture({
        size: { width: canvas.width, height: canvas.height },
        format: canvasFormat,
        sampleCount: msaaCount,
        usage: GPUTextureUsage.RENDER_ATTACHMENT,
    });

    render();

    function render() {
        const eye = vec3(0.0, 0.0, 4.0);
        var model = mat4();
        model = mult(rotateX(15), model);
        model = mult(rotateY(15), model);

        var at = vec3(0.0, 0.0, 0.0);
        
        var vpn = subtract(at, eye);
        var n = normalize(vpn);
        var v_up = vec3(0.0, 1.0, 0.0);
        var u = normalize(cross(v_up, n));
        var v = normalize(cross(n, u));
        var view = lookAt(eye, at, v);

        var mvp = mult(projection, mult(view, model));
        
        var sum = [];
        var flat = flatten(mvp);
        for (var j = 0; j < 16; j++) {
            sum.push(flat[j]);
        }
        var result = new Float32Array(sum);
        device.queue.writeBuffer(uniformBuffer, 0, result);

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
            
            // depth buffer
            depthStencilAttachment: {
                view: depthTexture.createView(),
                depthLoadOp: "clear",
                depthClearValue: 1.0,
                depthStoreOp: "store",
            },
        });
        pass.setPipeline(pipeline);
        pass.setVertexBuffer(0, obj.vPositionBuffer);
        pass.setIndexBuffer(obj.indicesBuffer, "uint32");
        pass.setBindGroup(0, bindGroup);
        
        pass.drawIndexed(indices.length, 1); 
        
        pass.end();
        device.queue.submit([encoder.finish()]);
    }
}