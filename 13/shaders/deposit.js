let depositVert = `

attribute vec2 aDataPos;

uniform sampler2D uParticlesPosDir;
uniform float uTexelSize;
uniform vec2 uScreenSize;

void main() {
    vec2 uv = aDataPos * uTexelSize + uTexelSize * 0.5;

    vec2 position  = texture2D(uParticlesPosDir, uv).xy;
    // vec2 vDirection = texture2D(uParticlesPosDir, uv).zw;

    vec2 invScreenSize = 1.0 / uScreenSize;
    vec2 trailMapUv = position * invScreenSize;

    gl_PointSize = 1.0;
    gl_Position = vec4(trailMapUv * 2.0 - 1.0, 0.0, 1.0);
}
`;

let depositFrag = `
void main() {
    gl_FragColor = vec4(vec3(1.0), 1.0);
}
`;


