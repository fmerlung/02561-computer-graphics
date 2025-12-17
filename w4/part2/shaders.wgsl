struct Uniforms {
    mvps: array<mat4x4<f32>, 1>,
};

@group(0) @binding(0) var<uniform> uniforms: Uniforms;

struct VSOut {
    @builtin(position) position: vec4f,
    @location(0) color: vec4f,
};

@vertex
fn main_vs(@location(0) position: vec4f) -> VSOut {
    var output: VSOut;
    output.position = uniforms.mvps[0] * position;
    output.color = vec4f(position.xyz * 0.5 + 0.5, 1.0);
    
    return output;
}

@fragment
fn main_fs(input: VSOut) -> @location(0) vec4f {
    return input.color;
}