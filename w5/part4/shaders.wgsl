struct Uniforms {
    mvp : mat4x4f,
    model : mat4x4f,
    normalMatrix : mat4x4f,
    lightPos : vec4f,      
    cameraPos : vec4f,     
    params : vec4f,        
};

@group(0) @binding(0) var<uniform> uniforms : Uniforms;

struct VSIn {
    @location(0) position : vec4f,
    @location(1) normal : vec4f,
    @location(2) color : vec4f,
};

struct VSOut {
    @builtin(position) position : vec4f,
    @location(0) worldPos : vec3f,
    @location(1) normal : vec3f,
    @location(2) color : vec4f,
};

@vertex
fn main_vs(input : VSIn) -> VSOut {
    var output : VSOut;
    
    output.position = uniforms.mvp * input.position;
    output.worldPos = (uniforms.model * input.position).xyz;
    output.normal = (uniforms.normalMatrix * input.normal).xyz;
    output.color = input.color;
    
    return output;
}

@fragment
fn main_fs(input : VSOut) -> @location(0) vec4f {
    let N = normalize(input.normal);
    let V = normalize(uniforms.cameraPos.xyz - input.worldPos);
    let L = normalize(uniforms.lightPos.xyz - input.worldPos);
    
    let Le = uniforms.params.x; 
    let La = uniforms.params.y; 
    let ks = uniforms.params.z; 
    let shininess = uniforms.params.w;

    let ambient = input.color.rgb * La;
    
    let diffFactor = max(dot(N, L), 0.0);
    let diffuse = input.color.rgb * diffFactor * Le;
    
    var specular = vec3f(0.0);
    if (diffFactor > 0.0) {
        let R = reflect(-L, N); 
        let specAngle = max(dot(R, V), 0.0);
        let specFactor = pow(specAngle, shininess);
        specular = vec3f(1.0, 1.0, 1.0) * specFactor * ks * Le;
    }
    
    let finalColor = ambient + diffuse + specular;
    
    return vec4f(finalColor, input.color.a);
}