let particlesVert = `

attribute vec2 aDataPos;

uniform sampler2D uParticlesPosDir;
uniform float uTexelSize;

varying vec2 vUv;
varying vec2 vDirection;
varying vec2 vPosition;
varying vec2 vParticleIndex;

void main() {
    vec2 uv = aDataPos * uTexelSize + uTexelSize * 0.5;

    vParticleIndex = aDataPos;

    vPosition  = texture2D(uParticlesPosDir, uv).xy;
    vDirection = texture2D(uParticlesPosDir, uv).zw;

    gl_PointSize = 1.0;
    gl_Position = vec4(uv * 2.0 - 1.0, 0.0, 1.0);
}
`;


let particlesFrag = `

uniform sampler2D uTrailMap;
uniform sampler2D uFluidVelocity;
uniform float uTexelSize;
uniform float uTime;
uniform vec2 uScreenSize;

varying vec2 vDirection;
varying vec2 vPosition;
varying vec2 vParticleIndex;



vec2 rotate(vec2 v, float a) {
	float s = sin(a);
	float c = cos(a);
    mat2 m = mat2(c, -s, s, c);
    
	return m * v;
}

vec2 clampSensorPosition(vec2 sensor) {
    float limit = 0.0;
    float limit2 = limit * 2.0;

    if(sensor.x < limit)         
        sensor.x += uScreenSize.x - limit2;
        
    if(sensor.x > (uScreenSize.x - limit))
        sensor.x -= uScreenSize.x - limit2;

    if(sensor.y < limit)           
        sensor.y += uScreenSize.y - limit2;

    if(sensor.y > (uScreenSize.y - limit)) 
        sensor.y -= uScreenSize.y - limit2;

    return sensor;
}

void main() {

    float senseLength = 3.2 + sin(vParticleIndex.x * 0.757) * 2.35;
    float senseAngle  = 0.785398 * 0.65;  // radians
    if(mod((sin(vParticleIndex.x) * 0.5 + 0.5) * 2.0, 2.0) > 0.5) {
        senseAngle += sin(uTime * 0.37)  * 3.0;
        senseLength += cos(uTime * 0.37) * 4.0;
    }



    // float senseLength = 3.2 + sin(vParticleIndex.x * 0.757) * 2.35;
    // float senseAngle  = 0.785398 * 0.35;  // radians
    // if(mod(vParticleIndex.x, 2.0) > 0.5) {
    //     senseAngle += sin(uTime * 0.27)  * 3.0;
    //     senseLength += cos(uTime * 0.27) * 4.0;
    // }




    // float senseLength = 3.2 + sin(vParticleIndex.x * 0.757) * 2.35;
    // float senseAngle  = 0.785398 * 0.26;  // radians

    // if(mod(vParticleIndex.x, 2.0) > 0.5) {
    //     senseAngle   = sin(uTime * 0.09) * (max(vParticleIndex.x * 0.01, 10.0));
    //     senseLength += cos(uTime * 0.17) * (max(vParticleIndex.y * 0.0015, 10.0));
    // }








    vec2 cDir = normalize(  vDirection  );
    vec2 lDir = normalize(  rotate(cDir, +senseAngle)  );
    vec2 rDir = normalize(  rotate(cDir, -senseAngle)  );

    vec2 centralSensorPosition = clampSensorPosition(vPosition + cDir * senseLength);
    vec2 leftSensorPosition    = clampSensorPosition(vPosition + lDir * senseLength);
    vec2 rightSensorPosition   = clampSensorPosition(vPosition + rDir * senseLength);


    vec2 invScreenSize = 1.0 / uScreenSize;
    float cTrailValue = texture2D(uTrailMap, centralSensorPosition.xy * invScreenSize).x;   
    float lTrailValue = texture2D(uTrailMap, leftSensorPosition.xy    * invScreenSize).x;   
    float rTrailValue = texture2D(uTrailMap, rightSensorPosition.xy   * invScreenSize).x;   




    // ********* finding the new direction & position *********
    float highestValue = cTrailValue;
    vec2 newDir = cDir;

    if(lTrailValue > cTrailValue) {
        newDir = lDir;
        highestValue = lTrailValue;
    }
    if(rTrailValue > highestValue) {
        newDir = rDir;
    }

    if(rTrailValue == lTrailValue && (rTrailValue > cTrailValue || lTrailValue > cTrailValue)) {
        if(fract(vParticleIndex.x * 0.3242 + uTime) > 0.5) {
            newDir = rDir;
        } else {
            newDir = lDir;
        }
    }


    float moveStep = 1.0 + sin(vParticleIndex.x * 0.333) * 0.35;  
    // the higher the density found, the faster it goes!
    moveStep += (highestValue * 0.15);
    // moveStep += sin(highestValue * 0.5 + cos(uTime)*5.0) * highestValue * 0.1;
    moveStep *= 1.3;

    // ********* finding the new direction & position - END *********

    vec2 fluidVel = texture2D(uFluidVelocity, vPosition.xy * invScreenSize).xy;

    // ******** fluid motion displacement
    // newDir *= sin(0.5 + vParticleIndex.x) * 0.20 + texture2D(uFluidVelocity, vPosition.xy * invScreenSize).xy * 0.01;
    // newDir = rotate(newDir, sin(uTime + vParticleIndex.x) * 0.2);
    newDir = rotate(newDir, sin(uTime + vParticleIndex.x ) * 0.2);
    // newDir += fluidVel * 0.0088;
    newDir += fluidVel * 0.0088;
    // moveStep *= 1.0 + sin(length(fluidVel * 0.1)) * 0.5 + 0.5; 
    // ******** fluid motion displacement - END


    vec2 newPos = clampSensorPosition(vPosition + newDir * moveStep);




    gl_FragColor = vec4(newPos, newDir);
}
`;


