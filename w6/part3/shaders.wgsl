struct Uniforms {
    mvp : mat4x4f,
    model : mat4x4f,
};

@group(0) @binding(0) var<uniform> uniforms : Uniforms;
@group(0) @binding(1) var mySampler : sampler;
@group(0) @binding(2) var myTexture : texture_2d<f32>;

struct VSIn {
@location(0) position : vec4f,
};
struct VSOut {
@builtin(position) position : vec4f,
@location(0) normal : vec3f,
};

@vertex
    fn main_vs(input : VSIn) -> VSOut {
    var output : VSOut;
    output.position = uniforms.mvp * input.position;
    output.normal = input.position.xyz;
    return output;
}

@fragment
fn main_fs(input : VSOut) -> @location(0) vec4f {
let PI = 3.14159265359;
let N = normalize(input.normal);
var u = 0.5 + atan2(N.z, N.x) / (2.0 * PI);
var v = 1.0 - (acos(N.y) / PI); 

let texColor = textureSample(myTexture, mySampler, vec2f(u, v));

let worldNormal = normalize((uniforms.model * vec4f(N, 0.0)).xyz);

let lightDir = normalize(vec3f(1.0, 1.0, 1.0)); 
let ambient = 0.2; 
let diffuse = max(dot(worldNormal, lightDir), 0.0);

let lighting = min(ambient + diffuse, 1.0);

return vec4f(texColor.rgb * lighting, texColor.a);
}