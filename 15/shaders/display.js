let displayVert = `
varying vec2 vUv;

void main() {
    vUv = position.xy * 0.5 + 0.5;
    gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;


let displayFrag = `
uniform sampler2D uTrailMap;
uniform sampler2D uFluidVelocity;
uniform sampler2D uFluidDye;
varying vec2 vUv;


vec3 aces(vec3 x) {
    const float a = 2.51;
    const float b = 0.03;
    const float c = 2.43;
    const float d = 0.59;
    const float e = 30.84;
    return clamp((x * (a * x + b)) / (x * (c * x + d) + e), 0.0, 1.0);
}


void main() {

    // Exposure tone mapping
    // float exposure = 0.19;       // works best on fullscreen
    float exposure = 0.15;       // works best on quad-screen
    vec3 val = texture2D(uTrailMap, vUv).xxx;
    vec3 mapped = vec3(1.0) - exp(-val * exposure);
    // vec3 mapped = aces(val);

    vec3 fluidVel = vec3(texture2D(uFluidVelocity, vUv).rg * 0.007 + 3.0, 3.0);
    vec3 fluidMapped = vec3(1.0) - exp(-fluidVel * exposure);


    gl_FragColor = vec4( clamp(vec3(0.0), vec3(1.0), mapped * 2.6 * fluidMapped) , 1.0);
    // gl_FragColor.rgb = texture2D(uFluidDye, vUv).rgb;
}
`;


