let splatDyeTextureVert = `
varying vec2 vUv;

void main() {
    vUv = position.xy * 0.5 + 0.5;
    gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;


let splatDyeTextureFrag = `
uniform sampler2D uTexture;
varying vec2 vUv;

void main() {
    gl_FragColor = texture2D(uTexture, vUv) * 0.0035;
}
`;


