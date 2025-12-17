// struct VertexOutput 
// {
//     @builtin(position) position: vec4f,
// };

struct Uniforms {
    mvp: mat4x4f,
};

@group(0) @binding(0)
var<uniform> uniforms: Uniforms;

@vertex
fn main_vs(@location(0) position: vec4f) -> @builtin(position) vec4f
{ 
    return uniforms.mvp * position; 
} 

@fragment 
fn main_fs() -> @location(0) vec4f
{ 
    return vec4f(1.0, 1.0, 1.0, 1.0); 
}