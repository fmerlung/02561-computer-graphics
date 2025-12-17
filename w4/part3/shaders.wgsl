struct Uniforms {
    mvp : mat4x4f,
    lightDir : vec4f, 
};

@group(0) @binding(0) var<uniform> uniforms : Uniforms;

struct VSOut {
    @builtin(position) position : vec4f,
    @location(0) color : vec4f,
};

@vertex
fn main_vs(@location(0) position : vec4f) -> VSOut {
    var output : VSOut;
    output.position = uniforms.mvp * position;

    var N = normalize(position.xyz);
    var L = normalize(uniforms.lightDir.xyz);

    var kd = position.xyz * 0.5 + 0.5;
    var Le = vec3f(1.0, 1.0, 1.0);
    
    var diffuse = max(dot(N, L), 0.0);
    
    output.color = vec4f(kd * Le * diffuse, 1.0);
    return output;
}

@fragment
fn main_fs(input : VSOut) -> @location(0) vec4f {
    return input.color;
}