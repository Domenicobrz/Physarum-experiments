(function fluidsimstarter() {

let config = {
    SIM_RESOLUTION: 256,
    DYE_RESOLUTION: 1024,
    CAPTURE_RESOLUTION: 512,
    DENSITY_DISSIPATION: 0.6, // 1,
    VELOCITY_DISSIPATION: 0.2,
    PRESSURE: 1,
    PRESSURE_ITERATIONS: 30,
    CURL: 25,
    SPLAT_RADIUS: 0.25,
    SPLAT_FORCE: 6000,
    SHADING: false,
    COLORFUL: true,
    COLOR_UPDATE_SPEED: 10,
    PAUSED: false,
    BACK_COLOR: { r: 0, g: 0, b: 0 },
    TRANSPARENT: false,
}

function pointerPrototype () {
    this.id = -1;
    this.texcoordX = 0;
    this.texcoordY = 0;
    this.prevTexcoordX = 0;
    this.prevTexcoordY = 0;
    this.deltaX = 0;
    this.deltaY = 0;
    this.down = false;
    this.moved = false;
    // not restricted to [0, 255]
    this.color = [300, 200, 200];
}

let pointers = [];
let splatStack = [];
pointers.push(new pointerPrototype());

let canvas;
let scene;
let camera;
let capturer;

window.initFluid = function() {
    // const params = { alpha: true, depth: false, stencil: false, antialias: false, preserveDrawingBuffer: false };

    // renderer = new THREE.WebGLRenderer( params );
    // renderer.setPixelRatio( window.devicePixelRatio );
    // renderer.setSize( innerWidth, innerHeight );
    // document.body.appendChild(renderer.domElement);
    // renderer.domElement.style.position = "absolute";
    // renderer.domElement.style.top = "0";
    // renderer.domElement.style.opacity = "0.1";
    // renderer.domElement.style.left = "0";
    canvas = renderer.domElement;

    scene = new THREE.Scene();

    camera = new THREE.PerspectiveCamera(45, canvas.width / canvas.height, 0.1, 10);

    initFramebuffers();
    initMaterials();
    initMouseCommands();



    // window.recorder = new CanvasRecorder(canvas, 250000000);
    // recorder.start();

    // setTimeout(() => {
    //     recorder.stop();
    //     recorder.save('busy_motion.webm');
    // }, 6000);

    window.addEventListener("keypress", (e) => {
        if(e.key == "k") {
            multipleSplats(5);
        }
    });

    // setTimeout(() => {
    //     multipleSplats(15);
    // }, 500);

    animate();
    // debug();
}


function debug() {
    multipleSplats(5);
    debugTexture(dye.read.texture);
}

function debugTexture(texture) {
    quadPlaneMesh.material = copyProgram;
    copyProgram.uniforms.uTexture.value = texture;
    renderer.setRenderTarget(null);
    renderer.render(scene, camera);
}

function getResolution (resolution) {
    let aspectRatio = canvas.width / canvas.height;
    if (aspectRatio < 1)
        aspectRatio = 1.0 / aspectRatio;

    let min = Math.round(resolution);
    let max = Math.round(resolution * aspectRatio);

    if (canvas.width > canvas.height)
        return { width: max, height: min };
    else
        return { width: min, height: max };
}

let dye;
let velocity;
let divergence;
let curl;
let pressure;
function initFramebuffers () {
    let simRes = getResolution(config.SIM_RESOLUTION);
    let dyeRes = getResolution(config.DYE_RESOLUTION);

    if (dye == null)
        dye = createDoubleFBO(dyeRes.width, dyeRes.height, THREE.LinearFilter);
    else
        // dye = resizeDoubleFBO(dye, dyeRes.width, dyeRes.height, rgba.internalFormat, rgba.format, texType, filtering);
        throw new Error("not implemented");

    if (velocity == null)
        velocity = createDoubleFBO(simRes.width, simRes.height, THREE.LinearFilter);
    else
        // velocity = resizeDoubleFBO(velocity, simRes.width, simRes.height, rg.internalFormat, rg.format, texType, filtering);
        throw new Error("not implemented");

    divergence = createFBO      (simRes.width, simRes.height, THREE.NearestFilter);
    curl       = createFBO      (simRes.width, simRes.height, THREE.NearestFilter);
    pressure   = createDoubleFBO(simRes.width, simRes.height, THREE.NearestFilter);

    window.fluidSimVelocityFBO = velocity; 
    window.fluidSimDyeFBO      = dye; 
}
function createFBO (w, h, filtering) {
    let rt = new THREE.WebGLRenderTarget(w, h, {
        type: THREE.FloatType,
        minFilter: filtering,
        magFilter: filtering,
        format: THREE.RGBAFormat,
        depthBuffer: false,
        stencilBuffer: false,
        anisotropy: 1,
    });

    let texelSizeX = 1.0 / w;
    let texelSizeY = 1.0 / h;

    return {
        texture    : rt.texture,
        fbo        : rt,
        width      : w,
        height     : h,
        texelSizeX : texelSizeX,
        texelSizeY : texelSizeY,
    };
}
function createDoubleFBO (w, h, filtering) {
    let fbo1 = createFBO(w, h, filtering);
    let fbo2 = createFBO(w, h, filtering);

    return {
        width: w,
        height: h,
        texelSizeX: fbo1.texelSizeX,
        texelSizeY: fbo1.texelSizeY,

        get read () {
            return fbo1;
        },
        set read (value) {
            fbo1 = value;
        },
        get write () {
            return fbo2;
        },
        set write (value) {
            fbo2 = value;
        },

        swap () {
            let temp = fbo1;
            fbo1 = fbo2;
            fbo2 = temp;
        }
    }
}


let copyProgram;
let splatProgram;
let curlProgram;
let vorticityProgram;
let divergenceProgram;
let clearProgram;
let pressureProgram;
let gradienSubtractProgram;
let advectionProgram;
let displayMaterial;
let quadPlaneMesh;
function initMaterials() {
    
    copyProgram = new THREE.ShaderMaterial( {
        uniforms: {
            uTexture: { type: "t", value: velocity.read.texture },
        },
        vertexShader: baseVertexShader, fragmentShader: copyShader,
    });

    splatProgram = new THREE.ShaderMaterial( {
        uniforms: {
            uTarget: { type: "t", value: velocity.read.texture },
            aspectRatio: { value: canvas.width / canvas.height },
            point: { value: new THREE.Vector2(0, 0) },
            color: { value: new THREE.Vector3(0, 0, 0) },
            radius: { value: correctRadius(config.SPLAT_RADIUS / 100.0) },
        },
        vertexShader: baseVertexShader, fragmentShader: splatShader,
    });

    curlProgram = new THREE.ShaderMaterial( {
        uniforms: {
            texelSize: { value: new THREE.Vector2(velocity.texelSizeX, velocity.texelSizeY) },
            uVelocity: { type: "t", value: velocity.read.texture },
        },
        vertexShader: baseVertexShader, fragmentShader: curlShader,
    });

    vorticityProgram = new THREE.ShaderMaterial( {
        uniforms: {
            texelSize: { value: new THREE.Vector2(velocity.texelSizeX, velocity.texelSizeY) },
            uVelocity: { type: "t", value: velocity.read.texture },
            uCurl: { type: "t", value: curl.texture },
            curl: { value: config.CURL },
            dt: { value: 0.0 },
        },
        vertexShader: baseVertexShader, fragmentShader: vorticityShader,
    });

    divergenceProgram = new THREE.ShaderMaterial( {
        uniforms: {
            texelSize: { value: new THREE.Vector2(velocity.texelSizeX, velocity.texelSizeY) },
            uVelocity: { type: "t", value: velocity.read.texture },
        },
        vertexShader: baseVertexShader, fragmentShader: divergenceShader,
    });

    clearProgram = new THREE.ShaderMaterial( {
        uniforms: {
            uTexture: { type: "t", value: pressure.read.texture },
            value: { value: config.PRESSURE },
        },
        vertexShader: baseVertexShader, fragmentShader: clearShader,
    });

    pressureProgram = new THREE.ShaderMaterial( {
        uniforms: {
            texelSize: { value: new THREE.Vector2(velocity.texelSizeX, velocity.texelSizeY) },
            uDivergence: { type: "t", value: divergence.texture },
            uPressure: { type: "t", value: pressure.read.texture },
        },
        vertexShader: baseVertexShader, fragmentShader: pressureShader,
    });

    gradienSubtractProgram = new THREE.ShaderMaterial( {
        uniforms: {
            texelSize: { value: new THREE.Vector2(velocity.texelSizeX, velocity.texelSizeY) },
            uPressure: { type: "t", value: pressure.read.texture },
            uVelocity: { type: "t", value: velocity.read.texture },
        },
        vertexShader: baseVertexShader, fragmentShader: gradientSubtractShader,
    });

    advectionProgram = new THREE.ShaderMaterial( {
        uniforms: {
            texelSize: { value: new THREE.Vector2(velocity.texelSizeX, velocity.texelSizeY) },
            uVelocity: { type: "t", value: velocity.read.texture },
            uSource: { type: "t", value: velocity.read.texture },
            dt: { value: 0.0 },
            dissipation: { value: config.VELOCITY_DISSIPATION },
        },
        vertexShader: baseVertexShader, fragmentShader: advectionShader,
    });

    displayMaterial = new THREE.ShaderMaterial( {
        uniforms: {
            texelSize: { value: new THREE.Vector2(velocity.texelSizeX, velocity.texelSizeY) },
            uVelocity: { type: "t", value: velocity.read.texture },
            uTexture: { type: "t", value: dye.read.texture },
            uPressure: { type: "t", value: pressure.read.texture },
            uCurl: { type: "t", value: curl.texture },
        },
        vertexShader: baseVertexShader, fragmentShader: displayShaderSource,
    });

    quadPlane = new THREE.PlaneBufferGeometry(2, 2);
    quadPlaneMesh = new THREE.Mesh(quadPlane, curlProgram);
    scene.add(quadPlaneMesh);
}

function animate() {
    const dt = calcDeltaTime();
    // if (resizeCanvas())
    //     initFramebuffers();

    updateColors(dt);
    applyInputs();
    // if (!config.PAUSED)
        step(dt);
    render();


    requestAnimationFrame(animate);
}

let lastUpdateTime = Date.now();
function calcDeltaTime () {
    let now = Date.now();
    let dt = (now - lastUpdateTime) / 1000;
    dt = Math.min(dt, 0.016666);
    lastUpdateTime = now;
    return dt;
}
function step(dt) {
    // we'll change quadPlaneMesh.material as needed
    quadPlaneMesh.material = curlProgram;
    curlProgram.uniforms.uVelocity.value = velocity.read.texture;
    renderer.setRenderTarget(curl.fbo);
    renderer.render(scene, camera);


    quadPlaneMesh.material = vorticityProgram;
    vorticityProgram.uniforms.uVelocity.value = velocity.read.texture;
    vorticityProgram.uniforms.uCurl.value = curl.texture;
    vorticityProgram.uniforms.curl.value = config.CURL;
    vorticityProgram.uniforms.dt.value = dt;
    renderer.setRenderTarget(velocity.write.fbo);
    renderer.render(scene, camera);
    velocity.swap();


    quadPlaneMesh.material = divergenceProgram;
    divergenceProgram.uniforms.uVelocity.value = velocity.read.texture;
    renderer.setRenderTarget(divergence.fbo);
    renderer.render(scene, camera);


    quadPlaneMesh.material = clearProgram;
    clearProgram.uniforms.uTexture.value = pressure.read.texture;
    clearProgram.uniforms.value.value = config.PRESSURE;
    renderer.setRenderTarget(pressure.write.fbo);
    renderer.render(scene, camera);


    quadPlaneMesh.material = pressureProgram;
    pressureProgram.uniforms.uDivergence.value = divergence.texture;
    for (let i = 0; i < config.PRESSURE_ITERATIONS; i++) {
        pressureProgram.uniforms.uPressure.value = pressure.read.texture;
        renderer.setRenderTarget(pressure.write.fbo);
        renderer.render(scene, camera);
        pressure.swap();
    }


    quadPlaneMesh.material = gradienSubtractProgram;
    gradienSubtractProgram.uniforms.uPressure.value = pressure.read.texture;
    gradienSubtractProgram.uniforms.uVelocity.value = velocity.read.texture;
    renderer.setRenderTarget(velocity.write.fbo);
    renderer.render(scene, camera);
    velocity.swap();




    quadPlaneMesh.material = advectionProgram;
    advectionProgram.uniforms.uVelocity.value = velocity.read.texture;
    advectionProgram.uniforms.uSource.value   = velocity.read.texture;
    advectionProgram.uniforms.dt.value        = dt;
    advectionProgram.uniforms.dissipation.value = config.VELOCITY_DISSIPATION;
    renderer.setRenderTarget(velocity.write.fbo);
    renderer.render(scene, camera);
    velocity.swap();



    quadPlaneMesh.material = advectionProgram;
    advectionProgram.uniforms.uVelocity.value = velocity.read.texture;
    advectionProgram.uniforms.uSource.value   = dye.read.texture;
    advectionProgram.uniforms.dt.value        = dt;
    advectionProgram.uniforms.dissipation.value = config.DENSITY_DISSIPATION;
    renderer.setRenderTarget(dye.write.fbo);
    renderer.render(scene, camera);
    dye.swap();
}
function render() {
    drawDisplay(innerWidth, innerHeight);
}
function drawDisplay(width, height) {
    renderer.setRenderTarget(null);
    quadPlaneMesh.material = displayMaterial;
    displayMaterial.uniforms.uTexture.value = dye.read.texture;
    displayMaterial.uniforms.uVelocity.value = velocity.read.texture;
    displayMaterial.uniforms.uPressure.value = pressure.read.texture;
    displayMaterial.uniforms.uCurl.value = curl.texture;
    renderer.render(scene, camera);
}
function splat(x, y, dx, dy, color, pointer, colorMultiplier) {
    if(!colorMultiplier) colorMultiplier = 1;

    quadPlaneMesh.material = splatProgram;
    splatProgram.uniforms.uTarget.value = velocity.read.texture;
    splatProgram.uniforms.aspectRatio.value = canvas.width / canvas.height;
    splatProgram.uniforms.point.value = new THREE.Vector2(x,y);
    splatProgram.uniforms.color.value = new THREE.Vector3(dx, dy, 0);
    splatProgram.uniforms.radius.value = correctRadius(config.SPLAT_RADIUS / 100.0);
    renderer.setRenderTarget(velocity.write.fbo);
    renderer.render(scene, camera);
    velocity.swap();


    let colorIntensity = 0.2 * colorMultiplier;
    let c = { r: 1, g: 0.8, b: 0.5 };
    if(pointer.downRight) {
        c = { r: -1, g: -1, b: -1 }
        colorIntensity = 0.08;
    }

    if(!pointer.downMiddle) {
        splatProgram.uniforms.uTarget.value = dye.read.texture;
        splatProgram.uniforms.color.value = new THREE.Vector3(
            /* color.r */  c.r, 
            /* color.g */  c.g, 
            /* color.b */  c.b).normalize().multiplyScalar(colorIntensity);
    
        renderer.setRenderTarget(dye.write.fbo);
        renderer.render(scene, camera);
        dye.swap();
    }
}
function correctRadius (radius) {
    let aspectRatio = canvas.width / canvas.height;
    if (aspectRatio > 1)
        radius *= aspectRatio;
    return radius;
}
function r() {
    return Math.random();
}

function applyInputs () {
    pointers.forEach(p => {
        if (p.moved) {
            p.moved = false;
            splatPointer(p);
        }
    });
}
function multipleSplats (amount) {
    for (let i = 0; i < amount; i++) {
        // color = new THREE.Vector3(r(), r(), r()).normalize().multiplyScalar(1.5);
        // color.r = color.x;
        // color.g = color.y;
        // color.b = color.z;

        // const color = generateColor();
        // color.r *= 10.0;
        // color.g *= 10.0;
        // color.b *= 10.0;

        let color = { r: 100, g: 100, b: 100 };

        const x = Math.random();
        const y = Math.random();
        const dx = 2700 * (Math.random() - 0.5);
        const dy = 2700 * (Math.random() - 0.5);
        splat(x, y, dx, dy, color, { downRight: Math.random() > 0.5 }, 10);
    }
}


function initMouseCommands() {
    window.addEventListener('mousedown', e => {
        let posX = scaleByPixelRatio(e.clientX);
        let posY = scaleByPixelRatio(e.clientY);
        let pointer = pointers.find(p => p.id == -1);
        if (pointer == null)
            pointer = new pointerPrototype();
        updatePointerDownData(pointer, -1, posX, posY, e.which == 3, e.which == 2);
    });

    window.addEventListener('touchstart', e => {
        let posX = scaleByPixelRatio(e.touches[0].clientX);
        let posY = scaleByPixelRatio(e.touches[0].clientY);
        let pointer = pointers.find(p => p.id == -1);
        if (pointer == null)
            pointer = new pointerPrototype();
        updatePointerDownData(pointer, -1, posX, posY, e.which == 3, e.which == 2);
    });
    
    window.addEventListener('mousemove', e => {
        let pointer = pointers[0];
        if (!pointer.down) return;
        let posX = scaleByPixelRatio(e.clientX);
        let posY = scaleByPixelRatio(e.clientY);
        updatePointerMoveData(pointer, posX, posY);
    });

    window.addEventListener('touchmove', e => {
        let pointer = pointers[0];
        if (!pointer.down) return;
        let posX = scaleByPixelRatio(e.touches[0].clientX);
        let posY = scaleByPixelRatio(e.touches[0].clientY);
        updatePointerMoveData(pointer, posX, posY);
    });
    
    window.addEventListener('mouseup', () => {
        updatePointerUpData(pointers[0]);
    });
}
function splatPointer (pointer) {
    let dx = pointer.deltaX * config.SPLAT_FORCE;
    let dy = pointer.deltaY * config.SPLAT_FORCE;

    splat(pointer.texcoordX, pointer.texcoordY, dx, dy, pointer.color, pointer);
}

function scaleByPixelRatio (input) {
    let pixelRatio = window.devicePixelRatio || 1;
    return Math.floor(input * pixelRatio);
}
function updatePointerDownData (pointer, id, posX, posY, rightKey, middleKey) {
    pointer.id = id;
    pointer.down = true;
    pointer.downRight = rightKey;
    pointer.downMiddle = middleKey;
    pointer.moved = false;
    pointer.texcoordX = posX / canvas.width;
    pointer.texcoordY = 1.0 - posY / canvas.height;
    pointer.prevTexcoordX = pointer.texcoordX;
    pointer.prevTexcoordY = pointer.texcoordY;
    pointer.deltaX = 0;
    pointer.deltaY = 0;
    pointer.color = generateColor(ciclingHue);
}

function updatePointerMoveData (pointer, posX, posY) {
    pointer.prevTexcoordX = pointer.texcoordX;
    pointer.prevTexcoordY = pointer.texcoordY;
    pointer.texcoordX = posX / canvas.width;
    pointer.texcoordY = 1.0 - posY / canvas.height;
    pointer.deltaX = correctDeltaX(pointer.texcoordX - pointer.prevTexcoordX);
    pointer.deltaY = correctDeltaY(pointer.texcoordY - pointer.prevTexcoordY);
    pointer.moved = Math.abs(pointer.deltaX) > 0 || Math.abs(pointer.deltaY) > 0;
}

function updatePointerUpData (pointer) {
    pointer.down = false;
}

let colorUpdateTimer = 0;
let ciclingHue = 0;
function updateColors (dt) {
    if (!config.COLORFUL) return;

    ciclingHue += dt * config.COLOR_UPDATE_SPEED * 0.03;
    ciclingHue = ciclingHue % 360;
    colorUpdateTimer += dt * config.COLOR_UPDATE_SPEED;
    // if (colorUpdateTimer >= 1) {
        colorUpdateTimer = wrap(colorUpdateTimer, 0, 1);
        pointers.forEach(p => {
            p.color = generateColor(ciclingHue);
        });
    // }
}
function wrap (value, min, max) {
    let range = max - min;
    if (range == 0) return min;
    return (value - min) % range + min;
}

function correctDeltaX (delta) {
    let aspectRatio = canvas.width / canvas.height;
    if (aspectRatio < 1) delta *= aspectRatio;
    return delta;
}

function correctDeltaY (delta) {
    let aspectRatio = canvas.width / canvas.height;
    if (aspectRatio > 1) delta /= aspectRatio;
    return delta;
}

function generateColor (hue) {
    let c = HSVtoRGB(hue || Math.random(), 1.0, 1.0);
    c.r *= 0.15;
    c.g *= 0.15;
    c.b *= 0.15;
    return c;
}

function HSVtoRGB (h, s, v) {
    let r, g, b, i, f, p, q, t;
    i = Math.floor(h * 6);
    f = h * 6 - i;
    p = v * (1 - s);
    q = v * (1 - f * s);
    t = v * (1 - (1 - f) * s);

    switch (i % 6) {
        case 0: r = v, g = t, b = p; break;
        case 1: r = q, g = v, b = p; break;
        case 2: r = p, g = v, b = t; break;
        case 3: r = p, g = q, b = v; break;
        case 4: r = t, g = p, b = v; break;
        case 5: r = v, g = p, b = q; break;
    }

    return {
        r,
        g,
        b
    };
}

})();