// struct VertexOutput 
// {
//     @builtin(position) position: vec4f,
// };

struct Uniforms {
    mvps: array<mat4x4<f32>, 3>,
};

@group(0) @binding(0)
var<uniform> uniforms: Uniforms;

@vertex
fn main_vs(@location(0) position: vec4f, @builtin(instance_index) instance: u32) -> @builtin(position) vec4f
{ 
    return uniforms.mvps[instance] * position; 
} 

@fragment 
fn main_fs() -> @location(0) vec4f
{ 
    return vec4f(1.0, 1.0, 1.0, 1.0); 
}