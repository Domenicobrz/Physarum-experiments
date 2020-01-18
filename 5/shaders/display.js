let displayVert = `
varying vec2 vUv;

void main() {
    vUv = position.xy * 0.5 + 0.5;
    gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;


let displayFrag = `
uniform sampler2D uTrailMap;
varying vec2 vUv;

void main() {

    // Exposure tone mapping
    float exposure = 0.15;
    vec3 val = texture2D(uTrailMap, vUv).xxx;
    vec3 mapped = vec3(1.0) - exp(-val * exposure);

    gl_FragColor = vec4(mapped, 1.0);
}
`;


