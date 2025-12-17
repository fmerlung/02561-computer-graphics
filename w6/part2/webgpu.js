"use strict";
window.onload = function () {
    main();
};

async function main() {
const canvas = document.getElementById("canvas");
if (!navigator.gpu) return;
const adapter = await navigator.gpu.requestAdapter();
const device = await adapter.requestDevice();
const context = canvas.getContext("webgpu");
const canvasFormat = navigator.gpu.getPreferredCanvasFormat();
context.configure({ device, format: canvasFormat });

const shaderRes = await fetch("./shaders.wgsl");
const shaderCode = await shaderRes.text();
const wgsl = device.createShaderModule({ code: shaderCode });

const vertices = new Float32Array([-4,-1,-1,1, 4,-1,-1,1, 4,-1,-21,1, -4,-1,-21,1]);
const uvs = new Float32Array([-1.5,0.0, 2.5,0.0, 2.5,10.0, -1.5,10.0]);
const indices = new Uint32Array([0, 1, 2, 0, 2, 3]);

const vBuf = device.createBuffer({ size: vertices.byteLength, usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST });
device.queue.writeBuffer(vBuf, 0, vertices);
const uvBuf = device.createBuffer({ size: uvs.byteLength, usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST });
device.queue.writeBuffer(uvBuf, 0, uvs);
const iBuf = device.createBuffer({ size: indices.byteLength, usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST });
device.queue.writeBuffer(iBuf, 0, indices);

const texSize = 64;
const mips = numMipLevels(texSize, texSize);
const texture = device.createTexture({
    size: [texSize, texSize, 1],
    format: 'rgba8unorm',
    mipLevelCount: mips,
    usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.RENDER_ATTACHMENT,
});

const texData = new Uint8Array(texSize * texSize * 4);
for (let i = 0; i < texSize; i++) {
    for (let j = 0; j < texSize; j++) {
        const c = (Math.floor(i/8) + Math.floor(j/8)) % 2 === 0 ? 255 : 0;
        const idx = (i * texSize + j) * 4;
        texData.set([c, c, c, 255], idx);
    }
}
device.queue.writeTexture({ texture }, texData, { bytesPerRow: texSize * 4 }, [texSize, texSize]);

generateMipmap(device, texture);

const uBuf = device.createBuffer({ size: 64, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
const pipeline = device.createRenderPipeline({
    layout: 'auto',
    vertex: {
        module: wgsl, entryPoint: "main_vs",
        buffers: [
            { arrayStride: 16, attributes: [{ format: "float32x4", offset: 0, shaderLocation: 0 }] },
            { arrayStride: 8, attributes: [{ format: "float32x2", offset: 0, shaderLocation: 1 }] }
        ],
    },
    fragment: { module: wgsl, entryPoint: "main_fs", targets: [{ format: canvasFormat }] },
    primitive: { topology: "triangle-list" },
});

const projection = perspective(90, canvas.width / canvas.height, 0.1, 100);
device.queue.writeBuffer(uBuf, 0, flatten(projection));

function render() {
    const addr = document.getElementById("addressMode").value;
    const mag = document.getElementById("magFilter").value;
    const min = document.getElementById("minFilter").value;
    const mip = document.getElementById("mipmapFilter").value;
    const enableMip = document.getElementById("useMipmaps").value === "true";

    const samplerDescriptor = {
        addressModeU: addr,
        addressModeV: addr,
        magFilter: mag,
        minFilter: min,
    };
    if (enableMip) {
        samplerDescriptor.mipmapFilter = mip;
    }

    const sampler = device.createSampler(samplerDescriptor);

    const bindGroup = device.createBindGroup({
        layout: pipeline.getBindGroupLayout(0),
        entries: [
            { binding: 0, resource: { buffer: uBuf } },
            { binding: 1, resource: sampler },
            { binding: 2, resource: texture.createView() }
        ],
    });

    const encoder = device.createCommandEncoder();
    const pass = encoder.beginRenderPass({
        colorAttachments: [{
            view: context.getCurrentTexture().createView(),
            loadOp: "clear",
            clearValue: { r: 0.0, g: 0.0, b: 1.0, a: 1.0 },
            storeOp: "store",
        }],
    });
    pass.setPipeline(pipeline);
    pass.setVertexBuffer(0, vBuf);
    pass.setVertexBuffer(1, uvBuf);
    pass.setIndexBuffer(iBuf, "uint32");
    pass.setBindGroup(0, bindGroup);
    pass.drawIndexed(indices.length);
    pass.end();
    device.queue.submit([encoder.finish()]);

    requestAnimationFrame(render);
}

render();

}
