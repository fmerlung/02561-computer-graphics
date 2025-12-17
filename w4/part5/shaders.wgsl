struct Uniforms {
    mvp : mat4x4f,
    model : mat4x4f,
    cameraPos : vec4f, 
    params : vec4f,    
    params2 : vec4f,   
};

@group(0) @binding(0) var<uniform> uniforms : Uniforms;

struct VSOut {
    @builtin(position) position : vec4f,
    @location(0) worldPos : vec3f,
    @location(1) normal : vec3f,
    @location(2) objectPos : vec3f,
};

@vertex
fn main_vs(@location(0) position : vec4f) -> VSOut {
    var output : VSOut;
    
    output.position = uniforms.mvp * position;
    
    output.worldPos = (uniforms.model * position).xyz;
    
    output.normal = (uniforms.model * vec4f(position.xyz, 0.0)).xyz;
    
    output.objectPos = position.xyz;
    
    return output;
}

@fragment
fn main_fs(input : VSOut) -> @location(0) vec4f {
    let kd = uniforms.params.x;
    let ks = uniforms.params.y;
    let s = uniforms.params.z;
    let Le_intensity = uniforms.params.w;
    let La_intensity = uniforms.params2.x;

    let N = normalize(input.normal);
    let V = normalize(uniforms.cameraPos.xyz - input.worldPos);
    
    let L = vec3f(0.0, 0.0, 1.0); 
    
    let R = reflect(-L, N);

    let objectColor = input.objectPos * 0.5 + 0.5;
    let white = vec3f(1.0, 1.0, 1.0);
    
    let ambient = kd * La_intensity * objectColor;
    
    let diffFactor = max(dot(N, L), 0.0);
    let diffuse = kd * Le_intensity * diffFactor * objectColor * white;
    
    var specular = vec3f(0.0);
    if (diffFactor > 0.0) {
        let specAngle = max(dot(R, V), 0.0);
        let specFactor = pow(specAngle, s);
        specular = ks * Le_intensity * specFactor * white; 
    }
    
    return vec4f(ambient + diffuse + specular, 1.0);
}