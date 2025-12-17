struct Uniforms {
    mvp : mat4x4f,
};

@group(0) @binding(0) var<uniform> uniforms : Uniforms;
@group(0) @binding(1) var mySampler : sampler;
@group(0) @binding(2) var myTexture : texture_2d<f32>;

struct VSIn {
@location(0) position : vec4f,
@location(1) uv : vec2f,
};

struct VSOut {
@builtin(position) position : vec4f,
@location(0) uv : vec2f,
};

@vertex
    fn main_vs(input : VSIn) -> VSOut {
    var output : VSOut;
    output.position = uniforms.mvp * input.position;
    output.uv = input.uv;

    return output;
}

@fragment
    fn main_fs(input : VSOut) -> @location(0) vec4f {

    return textureSample(myTexture, mySampler, input.uv);
}