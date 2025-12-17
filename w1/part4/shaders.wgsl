struct VertexOutput {
    @builtin(position) position: vec4f,
};

@vertex
fn main_vs(@location(0) position: vec4f) -> VertexOutput
{ 
    var output : VertexOutput;
    output.position = position;
    return output;
} 

@fragment 
fn main_fs(fragData: VertexOutput) -> @location(0) vec4f
{ 
    return vec4f(1.0, 1.0, 1.0, 1); 
}