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
    @location(0) color : vec4f,
};

@vertex
fn main_vs(@location(0) position : vec4f) -> VSOut {
    var output : VSOut;
    
    output.position = uniforms.mvp * position;
    
    let kd = uniforms.params.x;
    let ks = uniforms.params.y;
    let s = uniforms.params.z;
    let Le_intensity = uniforms.params.w;
    let La_intensity = uniforms.params2.x;
    
    let P_world = uniforms.model * position;
    let N = normalize((uniforms.model * vec4f(position.xyz, 0.0)).xyz);
    let V = normalize(uniforms.cameraPos.xyz - P_world.xyz);
    
    let L = vec3f(0.0, 0.0, 1.0); 
    
    let R = reflect(-L, N);
    
    let diffuseColor = position.xyz * 0.5 + 0.5;
    let specularColor = vec3f(1.0, 1.0, 1.0);
    let lightColor = vec3f(1.0, 1.0, 1.0);
    
    let ambient = kd * La_intensity * diffuseColor;
    
    let diffFactor = max(dot(N, L), 0.0);
    let diffuse = kd * Le_intensity * diffFactor * diffuseColor * lightColor;
    
    let specAngle = max(dot(R, V), 0.0);
    let specFactor = pow(specAngle, s);
    var specular = vec3f(0.0);
    if (diffFactor > 0.0) {
        specular = ks * Le_intensity * specFactor * specularColor * lightColor;
    }
    
    output.color = vec4f(ambient + diffuse + specular, 1.0);
    
    return output;
}

@fragment
fn main_fs(input : VSOut) -> @location(0) vec4f {
    return input.color;
}