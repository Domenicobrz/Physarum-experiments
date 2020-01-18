let blurDecayVert = `
varying vec2 vUv;

void main() {

    vUv = position.xy * 0.5 + 0.5;

    gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;


let blurDecayFrag = `
uniform sampler2D uTrailMap;
uniform vec2 uTexelSize;

varying vec2 vUv;



// clamping is necessary since WebGL doesn't support power of two textures...
// clamping is necessary since WebGL doesn't support power of two textures...
// clamping is necessary since WebGL doesn't support power of two textures...
vec2 clampuv(vec2 uv) {
    if(uv.x < 0.0) uv.x += 1.0;
    if(uv.x > 1.0) uv.x -= 1.0;
    
    if(uv.y < 0.0) uv.y += 1.0;
    if(uv.y > 1.0) uv.y -= 1.0;

    return uv;
}


void main() {
    vec2 vertTexCoord = vUv;
    vec2 texOffset = uTexelSize;

    // Grouping texcoord variables in order to make it work in the GMA 950. See post #13
    // in this thread:
    // <a href="http://www.idevgames.com/forums/thread-3467.html" target="_blank" rel="nofollow">http://www.idevgames.com/forums/thread-3467.html</a>

    vec2 tc0 = clampuv(  vertTexCoord.st + vec2(-texOffset.s, -texOffset.t)  );
    vec2 tc1 = clampuv(  vertTexCoord.st + vec2(         0.0, -texOffset.t)  );
    vec2 tc2 = clampuv(  vertTexCoord.st + vec2(+texOffset.s, -texOffset.t)  );
    vec2 tc3 = clampuv(  vertTexCoord.st + vec2(-texOffset.s,          0.0)  );
    vec2 tc4 = clampuv(  vertTexCoord.st + vec2(         0.0,          0.0)  );
    vec2 tc5 = clampuv(  vertTexCoord.st + vec2(+texOffset.s,          0.0)  );
    vec2 tc6 = clampuv(  vertTexCoord.st + vec2(-texOffset.s, +texOffset.t)  );
    vec2 tc7 = clampuv(  vertTexCoord.st + vec2(         0.0, +texOffset.t)  );
    vec2 tc8 = clampuv(  vertTexCoord.st + vec2(+texOffset.s, +texOffset.t)  );
     
    vec4 col0 = texture2D(uTrailMap, tc0);
    vec4 col1 = texture2D(uTrailMap, tc1);
    vec4 col2 = texture2D(uTrailMap, tc2);
    vec4 col3 = texture2D(uTrailMap, tc3);
    vec4 col4 = texture2D(uTrailMap, tc4);
    vec4 col5 = texture2D(uTrailMap, tc5);
    vec4 col6 = texture2D(uTrailMap, tc6);
    vec4 col7 = texture2D(uTrailMap, tc7);
    vec4 col8 = texture2D(uTrailMap, tc8);
     
    vec4 sum = (1.0 * col0 + 2.0 * col1 + 1.0 * col2 + 
                2.0 * col3 + 4.0 * col4 + 2.0 * col5 +
                1.0 * col6 + 2.0 * col7 + 1.0 * col8) / 16.0; 

    // float m = 1.0 / 9.0;
    // vec4 sum = (m * col0 + m * col1 + m * col2 + 
    //             m * col3 + m * col4 + m * col5 +
    //             m * col6 + m * col7 + m * col8) / 1.0; 


    const float decay = 0.975;
    

    gl_FragColor = vec4(sum.rgb * decay, 1.0);
}
`;


