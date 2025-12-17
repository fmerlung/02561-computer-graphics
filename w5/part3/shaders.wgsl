struct Uniforms {
    mvp : mat4x4f,
    model : mat4x4f,
    normalMatrix : mat4x4f, // Needed to transform normals correctly
};

@group(0) @binding(0) var<uniform> uniforms : Uniforms;

struct VSIn {
    @location(0) position : vec4f, // XYZW from OBJParser
    @location(1) normal : vec4f,   // XYZW from OBJParser
    @location(2) color : vec4f,    // RGBA from OBJParser
};

struct VSOut {
    @builtin(position) position : vec4f,
    @location(0) color : vec4f,
};

@vertex
fn main_vs(input : VSIn) -> VSOut {
    var output : VSOut;
    
    output.position = uniforms.mvp * input.position;
    
    var N = normalize((uniforms.normalMatrix * input.normal).xyz);
    var L = vec3f(0.0, 0.0, 1.0); 
    
    var diff = max(dot(N, L), 0.0);
    var ambient = 0.3;
    var lighting = min(ambient + diff, 1.0);
    
    output.color = vec4f(input.color.rgb * lighting, input.color.a);
    
    return output;
}

@fragment
fn main_fs(input : VSOut) -> @location(0) vec4f {
    return input.color;
}