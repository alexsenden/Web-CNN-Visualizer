// Query params: header=true shows title on input screen
const urlParams = new URLSearchParams(window.location.search);
const showHeader = urlParams.get('header') === 'true';
const HEADER_OFFSET = showHeader ? 40 : 0;

// Global variables
let gl;
let renderer;
let camera;
let conv1, conv2, conv3, conv4;
let mlp1, mlp2;
let inputTensor;
let tv1, tv2, tv3, tv4, tv5, tv6, tv7, tv8;
let cv1, cv2, cv3, cv4;
let rv;
let mv1, mv2;

let convBoxSize, mlpBoxSize;

// Drawing variables
let drawCanvas;
let drawCtx;
let prevMouseX = -1;
let prevMouseY = -1;
let canvasX, canvasY, canvasW, canvasH;
let canvasLeft, canvasRight, canvasTop, canvasBottom;

let visualizing = false;
let frameCount = 0;
let digitLabelsVisible = false;
let digitLabelsCompleteTime = 0;

// Animation speed multiplier (1.0 = normal speed, 2.0 = 2x faster, 0.5 = 2x slower)
// Change this value to adjust the overall animation speed
// Make it accessible globally so Box.js can use it
window.ANIMATION_SPEED_MULTIPLIER = 4.0;
const ANIMATION_SPEED_MULTIPLIER = window.ANIMATION_SPEED_MULTIPLIER; // Also available as const

// Debug flag: set to true to enable activation value logging in console
const DEBUG_ACTIVATIONS = false;

// Set to false to disable mouse camera controls (orbit, pan, zoom)
const MOUSE_CONTROLS_ENABLED = true;
// Set to false to disable keyboard camera controls (arrow keys, W/S, C, P)
const KEYBOARD_CONTROLS_ENABLED = false;

// Camera presets: index 0 = initial position when visualization starts;
// 1 = after Conv1, 2 = after Conv2, 3 = after Conv3, 4 = after Conv4, 5 = after Reshape, 6 = after MLP1, 7 = after MLP2.
// Use null to leave camera unchanged for that step. Press P during visualization to print current camera state, then paste here.
let CAMERA_PRESETS = [
    { distance: 2500, rotationX: -0.6, rotationY: -0.2, translation: { x: 520, y: 150, z: -1900 } },
    { distance: 2500, rotationX: -0.6, rotationY: -0.2, translation: { x: 500, y: 150, z: -1450 } },
    { distance: 2500, rotationX: -0.6, rotationY: -0.2, translation: { x: 500, y: 150, z: -1000 } },
    { distance: 2500, rotationX: -0.5, rotationY: -0.2, translation: { x: 100, y: 150, z: -200 } },
    { distance: 2500, rotationX: 0, rotationY: -0.3, translation: { x: 0, y: 150, z: 400 } },
    { distance: 2500, rotationX: 0, rotationY: -0.3, translation: { x: 0, y: 150, z: 400 } },
    { distance: 2500, rotationX: 0, rotationY: -0.3, translation: { x: 0, y: 150, z: 400 } },
    { distance: 2500, rotationX: 0, rotationY: -0.3, translation: { x: 0, y: 150, z: 400 } },
];

// Orbit center presets: center point for mouse rotation at each layer.
// Index 0 = when visualization starts; 1 = after Conv1, 2 = after Conv2, ... 7 = after MLP2.
// Use null to leave center unchanged for that step. Press P during visualization to also print current orbit center.
let ORBIT_CENTER_PRESETS = [
    { x: -400, y: -100, z: 100 },   // initial (e.g. midpoint of pipeline)
    { x: -400, y: -100, z: 300 },  // after Conv1
    { x: -400, y: -100, z: 500 },  // after Conv2
    { x: 0, y: -100, z: 700 },  // after Conv3
    { x: 0, y: -100, z: 900 },   // after Conv4
    { x: 0, y: -100, z: 900 },  // after Reshape
    { x: 0, y: -100, z: 900 }, // after MLP1
    { x: 0, y: -100, z: 900 }, // after MLP2
];

// Mobile camera presets (used when viewport is small: width <= 420 or height <= 700).
// Same indices as CAMERA_PRESETS. Set to null to use desktop CAMERA_PRESETS for that index.
let MOBILE_CAMERA_PRESETS = [
    { distance: 2500, rotationX: -0.6, rotationY: -0.2, translation: { x: 450, y: 150, z: -1400 } },
    { distance: 2500, rotationX: -0.6, rotationY: -0.2, translation: { x: 450, y: 150, z: -900 } },
    { distance: 2500, rotationX: -0.4, rotationY: -0.2, translation: { x: 400, y: 150, z: -400 } },
    { distance: 2500, rotationX: -0.2, rotationY: -0.2, translation: { x: 100, y: 150, z: 0 } },
    { distance: 2500, rotationX: 0, rotationY: -0.3, translation: { x: 0, y: 150, z: 1100 } },
    { distance: 2500, rotationX: 0, rotationY: -0.3, translation: { x: 0, y: 150, z: 1100 } },
    { distance: 2500, rotationX: 0, rotationY: -0.3, translation: { x: 0, y: 150, z: 1100 } },
    { distance: 2500, rotationX: 0, rotationY: -0.3, translation: { x: 0, y: 150, z: 1100 } },
];

// Mobile orbit center presets. Same indices as ORBIT_CENTER_PRESETS. Set to null to use desktop presets.
let MOBILE_ORBIT_CENTER_PRESETS = [
    { x: -400, y: -100, z: 100 },
    { x: -400, y: -100, z: 300 },
    { x: -400, y: -100, z: 500 },
    { x: 0, y: -100, z: 700 },
    { x: 0, y: -100, z: 900 },
    { x: 0, y: -100, z: 900 },
    { x: 0, y: -100, z: 900 },
    { x: 0, y: -100, z: 900 },
];

// True when viewport is mobile-sized AND portrait; only then use MOBILE_* presets. Landscape uses CAMERA_PRESETS.
function isMobilePortraitView() {
    const small = window.innerWidth <= 420 || window.innerHeight <= 700;
    const portrait = window.innerWidth <= window.innerHeight;
    return small && portrait;
}

function getCameraPresets() {
    return isMobilePortraitView() ? MOBILE_CAMERA_PRESETS : CAMERA_PRESETS;
}

function getOrbitCenterPresets() {
    return isMobilePortraitView() ? MOBILE_ORBIT_CENTER_PRESETS : ORBIT_CENTER_PRESETS;
}

// Camera transition: speed of smooth move between presets (higher = faster). ~2 = ~1s to settle.
const CAMERA_TRANSITION_SPEED = 2.0;

// Digit label fade-in duration (ms) after final MLP completes
const DIGIT_LABEL_FADE_MS = 500;

// Framerate tracking
let lastFpsTime = performance.now();
let lastFrameTime = performance.now();
let fpsFrameCount = 0;
const FPS_UPDATE_INTERVAL = 1000; // Update FPS every second

// Data files
let randomTensorData;
let conv1WeightData, conv1BiasData;
let conv2WeightData, conv2BiasData;
let conv3WeightData, conv3BiasData;
let conv4WeightData, conv4BiasData;
let mlp1WeightData, mlp1BiasData;
let mlp2WeightData, mlp2BiasData;

let dataLoaded = false;

// Cache for neural network results
let cachedResults = null;
let lastInputTensorHash = null;

// Load data files
async function loadData() {
    try {
        const files = [
            'data/randomTensor.txt',
            'data/conv1Weight.txt', 'data/conv1Bias.txt',
            'data/conv2Weight.txt', 'data/conv2Bias.txt',
            'data/conv3Weight.txt', 'data/conv3Bias.txt',
            'data/conv4Weight.txt', 'data/conv4Bias.txt',
            'data/mlp1Weight.txt', 'data/mlp1Bias.txt',
            'data/mlp2Weight.txt', 'data/mlp2Bias.txt'
        ];

        const responses = await Promise.all(files.map(file => fetch(file)));
        const texts = await Promise.all(responses.map(r => r.text()));

        // Filter out empty lines from data
        randomTensorData = texts[0].trim().split('\n').filter(line => line.trim().length > 0);
        conv1WeightData = texts[1].trim().split('\n').filter(line => line.trim().length > 0);
        conv1BiasData = texts[2].trim().split('\n').filter(line => line.trim().length > 0);
        conv2WeightData = texts[3].trim().split('\n').filter(line => line.trim().length > 0);
        conv2BiasData = texts[4].trim().split('\n').filter(line => line.trim().length > 0);
        conv3WeightData = texts[5].trim().split('\n').filter(line => line.trim().length > 0);
        conv3BiasData = texts[6].trim().split('\n').filter(line => line.trim().length > 0);
        conv4WeightData = texts[7].trim().split('\n').filter(line => line.trim().length > 0);
        conv4BiasData = texts[8].trim().split('\n').filter(line => line.trim().length > 0);
        mlp1WeightData = texts[9].trim().split('\n').filter(line => line.trim().length > 0);
        mlp1BiasData = texts[10].trim().split('\n').filter(line => line.trim().length > 0);
        mlp2WeightData = texts[11].trim().split('\n').filter(line => line.trim().length > 0);
        mlp2BiasData = texts[12].trim().split('\n').filter(line => line.trim().length > 0);

        dataLoaded = true;
        setupVisualizer();
    } catch (error) {
        console.error('Error loading data:', error);
    }
}

function initWebGL() {
    const canvas = document.getElementById('glCanvas');
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    gl = canvas.getContext('webgl');
    if (!gl) {
        console.error('WebGL not supported');
        return;
    }

    renderer = new WebGLRenderer(gl);

    // Enable depth testing for proper 3D rendering
    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.LESS);
    gl.disable(gl.CULL_FACE);

    // Set viewport
    gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);

    // Clear to black
    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    // Initialize camera - orbital camera to see the scene (objects at z from -1500 to 1700)
    camera = new Camera();
    camera.transitionSpeed = CAMERA_TRANSITION_SPEED;

    convBoxSize = new Vec3(12, 12, 12);
    mlpBoxSize = new Vec3(4, 12, 12);

    setupInputPage();
    loadData();
}

function setupVisualizer() {
    if (!dataLoaded) return;

    inputTensor = parseConvWeightsToTensor(randomTensorData);

    conv1 = new Conv2D("conv1Weight.txt", "conv1Bias.txt", conv1WeightData, conv1BiasData);
    conv2 = new Conv2D("conv2Weight.txt", "conv2Bias.txt", conv2WeightData, conv2BiasData);
    conv3 = new Conv2D("conv3Weight.txt", "conv3Bias.txt", conv3WeightData, conv3BiasData);
    conv4 = new Conv2D("conv4Weight.txt", "conv4Bias.txt", conv4WeightData, conv4BiasData);
    mlp1 = new MLP("mlp1Weight.txt", "mlp1Bias.txt", true, mlp1WeightData, mlp1BiasData);
    mlp2 = new MLP("mlp2Weight.txt", "mlp2Bias.txt", false, mlp2WeightData, mlp2BiasData);

    const conv1Result = conv1.forward(inputTensor);
    const conv2Result = conv2.forward(conv1Result);
    const conv3Result = conv3.forward(conv2Result);
    const conv4Result = conv4.forward(conv3Result);
    const flattened = conv4Result.clone();
    flattened._reshape(flattened.getShape().getTotalSize(), 1);

    const mlp1Result = mlp1.forward(flattened);
    const mlp2Result = mlp2.forward(mlp1Result);
    const result = softmax(mlp2Result);

    tv1 = new TensorVisualizer(inputTensor, new Vec3(0, 0, -1500), 20, convBoxSize);
    tv1.setVisible(true);
    tv2 = new TensorVisualizer(conv1Result, new Vec3(0, 0, -1100), 20, convBoxSize);
    tv3 = new TensorVisualizer(conv2Result, new Vec3(0, 0, -500), 20, convBoxSize);
    tv4 = new TensorVisualizer(conv3Result, new Vec3(0, 0, 250), 20, convBoxSize);
    tv5 = new TensorVisualizer(conv4Result, new Vec3(0, 0, 1000), 20, convBoxSize);
    tv6 = new TensorVisualizer(flattened, new Vec3(0, 0, 1500), 6, mlpBoxSize);
    tv7 = new TensorVisualizer(mlp1Result, new Vec3(0, 0, 1600), 6, mlpBoxSize);
    tv8 = new TensorVisualizer(result, new Vec3(0, 0, 1700), 80, mlpBoxSize);

    mv2 = new MLPVisualizer(mlp2, tv7, tv8, mlpBoxSize);
    mv1 = new MLPVisualizer(mlp1, tv6, tv7, mlpBoxSize);
    mv1.setNextAnimation(mv2);

    rv = new ReshapeVisualizer(tv5, tv6, mlpBoxSize);
    rv.setNextAnimation(mv1);

    cv4 = new Conv2DVisualizer(conv4, tv4, tv5, 1, convBoxSize);
    cv4.setNextAnimation(rv);
    cv3 = new Conv2DVisualizer(conv3, tv3, tv4, 2, convBoxSize);
    cv3.setNextAnimation(cv4);
    cv2 = new Conv2DVisualizer(conv2, tv2, tv3, 2, convBoxSize);
    cv2.setNextAnimation(cv3);
    cv1 = new Conv2DVisualizer(conv1, tv1, tv2, 16, convBoxSize);
    cv1.setNextAnimation(cv2);

    // When a layer completes, move camera to its preset (if defined) and set orbit center from ORBIT_CENTER_PRESETS
    const layerOrder = [cv1, cv2, cv3, cv4, rv, mv1, mv2];

    window.onLayerComplete = (completedAnimation) => {
        const idx = layerOrder.indexOf(completedAnimation) + 1; // preset 1..7 = after each layer
        if (idx >= 1 && getCameraPresets()[idx]) {
            camera.setState(getCameraPresets()[idx]);
        }
        // Set orbit center from manual preset for this layer (if defined)
        if (getOrbitCenterPresets()[idx] != null) {
            const c = getOrbitCenterPresets()[idx];
            camera.center.x = c.x;
            camera.center.y = c.y;
            camera.center.z = c.z;
        }
        if (completedAnimation === mv2) {
            digitLabelsVisible = true;
            digitLabelsCompleteTime = performance.now();
            document.getElementById('returnToInputButton').classList.remove('hidden');
        }
    };
}

function setupInputPage() {
    drawCanvas = document.getElementById('drawCanvas');
    drawCtx = drawCanvas.getContext('2d');
    drawCtx.fillStyle = 'black';
    drawCtx.fillRect(0, 0, 32, 32);
    drawCtx.strokeStyle = 'white';
    drawCtx.lineWidth = 2.4;
    drawCtx.shadowColor = 'white';
    drawCtx.shadowBlur = 0;

    if (showHeader) {
        document.getElementById('ui').classList.add('has-header');
        document.getElementById('inputHeader').classList.add('visible');
    }

    const landscape = isLandscapeInput();
    const ui = document.getElementById('ui');
    if (landscape) {
        ui.classList.add('landscape-input');
    } else {
        ui.classList.remove('landscape-input');
    }

    const size = getInputCanvasSize();
    canvasW = size.w;
    canvasH = size.h;
    const isSmallScreen = window.innerHeight <= 700 || window.innerWidth <= 420;
    const canvasContainer = document.getElementById('canvas-container');
    canvasContainer.style.width = canvasW + 'px';
    canvasContainer.style.height = canvasH + 'px';

    if (landscape) {
        canvasContainer.style.left = '';
        canvasContainer.style.right = '';
        canvasContainer.style.top = '50%';
        canvasContainer.style.transform = 'translateY(-50%)';
        const rect = canvasContainer.getBoundingClientRect();
        canvasLeft = rect.left;
        canvasRight = rect.right;
        canvasTop = rect.top;
        canvasBottom = rect.bottom;
        canvasX = (rect.left + rect.right) / 2;
        canvasY = (rect.top + rect.bottom) / 2;
        // Align Predict button bottom with canvas bottom in landscape
        document.getElementById('button').style.bottom = (window.innerHeight - rect.bottom) + 'px';
    } else {
        document.getElementById('button').style.bottom = '';
        canvasContainer.style.right = '';
        canvasContainer.style.transform = '';
        canvasX = window.innerWidth / 2;
        const canvasOffsetY = isSmallScreen ? 20 : -30;
        canvasY = window.innerHeight / 2 + canvasOffsetY + HEADER_OFFSET;
        canvasLeft = canvasX - canvasW / 2;
        canvasRight = canvasX + canvasW / 2;
        canvasTop = canvasY - canvasH / 2;
        canvasBottom = canvasY + canvasH / 2;
        canvasContainer.style.left = canvasLeft + 'px';
        canvasContainer.style.top = canvasTop + 'px';
    }

    document.getElementById('ui').style.visibility = 'visible';

    drawCanvas.style.width = canvasW + 'px';
    drawCanvas.style.height = canvasH + 'px';
    drawCanvas.style.imageRendering = 'pixelated';
}

// True when viewport is phone landscape (input page uses side-by-side layout)
function isLandscapeInput() {
    return window.innerWidth > window.innerHeight && window.innerHeight <= 500;
}

// Input canvas size: smaller on narrow viewports (e.g. mobile) so sides aren't cut off
function getInputCanvasSize() {
    const landscape = isLandscapeInput();
    const isSmallScreen = window.innerHeight <= 700 || window.innerWidth <= 420;
    const maxSize = isSmallScreen ? 280 : 400;
    const padding = isSmallScreen ? 24 : 40;
    let availableW, availableH;
    if (landscape) {
        // Canvas lives in right column (54%–94% of width); size to fit with margin
        const rightColumnWidth = window.innerWidth * 0.4 - padding;
        availableW = rightColumnWidth;
        availableH = window.innerHeight - padding;
    } else {
        const topBottomReserve = isSmallScreen ? 260 : 220;
        availableW = window.innerWidth - padding;
        availableH = window.innerHeight - topBottomReserve;
    }
    const size = Math.min(maxSize, availableW, Math.max(200, availableH));
    return { w: size, h: size };
}

function tensorHash(tensor) {
    let hash = 0;
    for (let i = 0; i < Math.min(tensor.data.length, 100); i++) {
        hash = ((hash << 5) - hash) + tensor.data[i];
        hash = hash & hash;
    }
    return hash;
}

// Debug function to log activation values
function logActivations(results) {
    if (!DEBUG_ACTIVATIONS) return;

    console.log('=== Activation Values ===');

    const layers = [
        { name: 'Input', tensor: inputTensor },
        { name: 'Conv1 Output', tensor: results.conv1Result },
        { name: 'Conv2 Output', tensor: results.conv2Result },
        { name: 'Conv3 Output', tensor: results.conv3Result },
        { name: 'Conv4 Output', tensor: results.conv4Result },
        { name: 'Flattened', tensor: results.flattened },
        { name: 'MLP1 Output', tensor: results.mlp1Result },
        { name: 'MLP2 Output', tensor: results.mlp2Result },
        { name: 'Final (Softmax)', tensor: results.result }
    ];

    layers.forEach(layer => {
        const data = layer.tensor.data;
        const shape = layer.tensor.shape.toString();
        const min = Math.min(...data);
        const max = Math.max(...data);
        const sum = data.reduce((a, b) => a + b, 0);
        const mean = sum / data.length;
        const variance = data.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / data.length;
        const stdDev = Math.sqrt(variance);

        // Sample first 10 values
        const sample = data.slice(0, Math.min(10, data.length));

        console.log(`\n${layer.name}:`);
        console.log(`  Shape: ${shape}`);
        console.log(`  Size: ${data.length}`);
        console.log(`  Min: ${min.toFixed(6)}`);
        console.log(`  Max: ${max.toFixed(6)}`);
        console.log(`  Mean: ${mean.toFixed(6)}`);
        console.log(`  Std Dev: ${stdDev.toFixed(6)}`);
        console.log(`  Sample (first 10): [${sample.map(v => v.toFixed(4)).join(', ')}]`);

        // For final softmax output, also show the predicted class
        if (layer.name === 'Final (Softmax)') {
            const maxIndex = data.indexOf(max);
            console.log(`  Predicted Class: ${maxIndex} (confidence: ${(max * 100).toFixed(2)}%)`);
            console.log(`  All Class Probabilities: [${data.map(v => (v * 100).toFixed(2)).join('%, ')}%]`);
        }
    });

    console.log('========================\n');
}

function drawVisualization() {
    // Hide UI elements
    document.getElementById('ui').style.display = 'none';

    // Ensure viewport is set
    gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);

    // Cache neural network results
    const currentHash = tensorHash(inputTensor);
    if (!cachedResults || lastInputTensorHash !== currentHash) {
        const conv1Result = conv1.forward(inputTensor);
        const conv2Result = conv2.forward(conv1Result);
        const conv3Result = conv3.forward(conv2Result);
        const conv4Result = conv4.forward(conv3Result);
        const flattened = conv4Result.clone();
        flattened._reshape(flattened.getShape().getTotalSize(), 1);

        const mlp1Result = mlp1.forward(flattened);
        const mlp2Result = mlp2.forward(mlp1Result);
        const result = softmax(mlp2Result);

        cachedResults = {
            conv1Result,
            conv2Result,
            conv3Result,
            conv4Result,
            flattened,
            mlp1Result,
            mlp2Result,
            result
        };
        lastInputTensorHash = currentHash;

        // Log activation values if debugging is enabled
        logActivations(cachedResults);
    }

    tv1.setTensor(inputTensor);
    tv2.setTensor(cachedResults.conv1Result);
    tv3.setTensor(cachedResults.conv2Result);
    tv4.setTensor(cachedResults.conv3Result);
    tv5.setTensor(cachedResults.conv4Result);
    tv6.setTensor(cachedResults.flattened);
    tv7.setTensor(cachedResults.mlp1Result);
    tv8.setTensor(cachedResults.result);

    // Clear canvas
    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    // Set up projection and view matrices
    const aspect = gl.canvas.width / gl.canvas.height;
    const fov = Math.PI / 4; // 45 degrees
    const near = 10;
    const far = 5000;
    const projectionMatrix = WebGLUtils.createPerspective(fov, aspect, near, far);

    // Orbit center is only updated when each layer completes (see onLayerComplete); not updated every frame here.

    const viewMatrix = camera.getViewMatrix();
    const xFlipScale = WebGLUtils.createScale(-1, 1, 1);
    const mvpMatrix = WebGLUtils.multiplyMatrices(projectionMatrix, WebGLUtils.multiplyMatrices(xFlipScale, viewMatrix));
    const projXFlipMatrix = WebGLUtils.multiplyMatrices(projectionMatrix, xFlipScale);

    // Collect all visible boxes
    const allBoxes = [];
    allBoxes.push(...tv1.getVisibleBoxes());
    allBoxes.push(...tv2.getVisibleBoxes());
    allBoxes.push(...tv3.getVisibleBoxes());
    allBoxes.push(...tv4.getVisibleBoxes());
    allBoxes.push(...tv5.getVisibleBoxes());
    allBoxes.push(...tv6.getVisibleBoxes());
    allBoxes.push(...tv7.getVisibleBoxes());
    allBoxes.push(...tv8.getVisibleBoxes());
    allBoxes.push(...cv1.getVisibleBoxes());
    allBoxes.push(...cv2.getVisibleBoxes());
    allBoxes.push(...cv3.getVisibleBoxes());
    allBoxes.push(...cv4.getVisibleBoxes());
    allBoxes.push(...rv.getVisibleBoxes());
    allBoxes.push(...mv1.getVisibleBoxes());
    allBoxes.push(...mv2.getVisibleBoxes());

    // Render all boxes
    if (allBoxes.length > 0) {
        renderer.renderBoxes(allBoxes, mvpMatrix);
    }

    // Render white digit labels (0-9) under each final MLP output in 3D (only when last MLP is done, with fade-in)
    if (digitLabelsVisible && tv8 && tv8.boxes && tv8.boxes.length >= 10) {
        const labelPositions = [];
        for (let i = 0; i < 10; i++) {
            const pos = tv8.boxes[i].getCurPos();
            labelPositions.push({
                x: pos.x,
                y: pos.y + WebGLRenderer.DIGIT_LABEL_OFFSET_Y,
                z: pos.z
            });
        }
        const elapsed = performance.now() - digitLabelsCompleteTime;
        const fadeAlpha = Math.min(1, elapsed / DIGIT_LABEL_FADE_MS);
        renderer.renderDigitLabels(labelPositions, viewMatrix, projXFlipMatrix, fadeAlpha);
    }

    // Get current time for time-based animations
    const currentTime = performance.now();

    // Update all visualizers with current time
    if (tv1) {
        tv1.update(currentTime);
        tv2.update(currentTime);
        tv3.update(currentTime);
        tv4.update(currentTime);
        tv5.update(currentTime);
        tv6.update(currentTime);
        tv7.update(currentTime);
        tv8.update(currentTime);
        cv1.update(currentTime);
        cv2.update(currentTime);
        cv3.update(currentTime);
        cv4.update(currentTime);
        rv.update(currentTime);
        mv1.update(currentTime);
        mv2.update(currentTime);
    }
}

function drawInputPage() {
    // Clear WebGL canvas
    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    // Show UI elements, hide "Return to input" button
    document.getElementById('ui').style.display = 'block';
    document.getElementById('returnToInputButton').classList.add('hidden');
}

function reset() {
    if (!tv1) return; // Not initialized yet

    if (getCameraPresets()[0]) {
        camera.setState(getCameraPresets()[0]);
    }

    document.getElementById('returnToInputButton').classList.add('hidden');
    digitLabelsVisible = false;
    tv2.setVisible(false);
    tv3.setVisible(false);
    tv4.setVisible(false);
    tv5.setVisible(false);
    tv6.setVisible(false);
    tv7.setVisible(false);
    tv8.setVisible(false);

    cv1.reset();
    cv2.reset();
    cv3.reset();
    cv4.reset();

    rv.reset();

    mv1.reset();
    mv2.reset();

    cv1.start();
}

function startVisualization() {
    visualizing = true;

    // Convert canvas pixels to tensor
    const imageData = drawCtx.getImageData(0, 0, 32, 32);
    const pixels = imageData.data;

    // Create input tensor from pixels
    inputTensor = new Tensor(1, 1, 32, 32);
    for (let i = 0; i < pixels.length; i += 4) {
        const pixelIndex = i / 4;
        const row = Math.floor(pixelIndex / 32);
        const col = pixelIndex % 32;
        const val = pixels[i] / 255.0; // Use red channel
        inputTensor.set(val, 0, 0, row, col);
    }

    // Clear canvas
    drawCtx.fillStyle = 'black';
    drawCtx.fillRect(0, 0, 32, 32);

    // Invalidate cache
    cachedResults = null;
    lastInputTensorHash = null;

    // Apply initial camera preset (index 0) if set
    if (getCameraPresets()[0]) {
        camera.setState(getCameraPresets()[0]);
    }

    // Set initial orbit center from presets (if defined)
    if (getOrbitCenterPresets()[0] != null) {
        const c = getOrbitCenterPresets()[0];
        camera.center.x = c.x;
        camera.center.y = c.y;
        camera.center.z = c.z;
    }

    document.getElementById('returnToInputButton').classList.add('hidden');
    reset();
}

// Event handlers
let isDrawing = false;

document.getElementById('drawCanvas').addEventListener('mousedown', (e) => {
    if (!visualizing) {
        isDrawing = true;
        const rect = drawCanvas.getBoundingClientRect();
        const x = (e.clientX - rect.left) * (32 / rect.width);
        const y = (e.clientY - rect.top) * (32 / rect.height);
        prevMouseX = x;
        prevMouseY = y;
    }
});

document.getElementById('drawCanvas').addEventListener('mousemove', (e) => {
    if (isDrawing && !visualizing) {
        const rect = drawCanvas.getBoundingClientRect();
        const x = (e.clientX - rect.left) * (32 / rect.width);
        const y = (e.clientY - rect.top) * (32 / rect.height);

        drawCtx.beginPath();
        drawCtx.moveTo(prevMouseX, prevMouseY);
        drawCtx.lineTo(x, y);
        drawCtx.stroke();

        prevMouseX = x;
        prevMouseY = y;
    }
});

document.getElementById('drawCanvas').addEventListener('mouseup', () => {
    isDrawing = false;
});

document.getElementById('drawCanvas').addEventListener('mouseleave', () => {
    isDrawing = false;
});

// Touch support for drawing on mobile (finger drag)
function getDrawCanvasCoords(clientX, clientY) {
    const rect = drawCanvas.getBoundingClientRect();
    return {
        x: (clientX - rect.left) * (32 / rect.width),
        y: (clientY - rect.top) * (32 / rect.height)
    };
}

function drawCanvasTouchStart(e) {
    if (visualizing) return;
    if (e.touches.length !== 1) return;
    e.preventDefault();
    isDrawing = true;
    const { x, y } = getDrawCanvasCoords(e.touches[0].clientX, e.touches[0].clientY);
    prevMouseX = x;
    prevMouseY = y;
}

function drawCanvasTouchMove(e) {
    if (!isDrawing || visualizing || e.touches.length !== 1) return;
    e.preventDefault();
    const { x, y } = getDrawCanvasCoords(e.touches[0].clientX, e.touches[0].clientY);
    drawCtx.beginPath();
    drawCtx.moveTo(prevMouseX, prevMouseY);
    drawCtx.lineTo(x, y);
    drawCtx.stroke();
    prevMouseX = x;
    prevMouseY = y;
}

function drawCanvasTouchEnd(e) {
    if (e.touches.length === 0) isDrawing = false;
}

document.getElementById('drawCanvas').addEventListener('touchstart', drawCanvasTouchStart, { passive: false });
document.getElementById('drawCanvas').addEventListener('touchmove', drawCanvasTouchMove, { passive: false });
document.getElementById('drawCanvas').addEventListener('touchend', drawCanvasTouchEnd);
document.getElementById('drawCanvas').addEventListener('touchcancel', drawCanvasTouchEnd);

document.getElementById('button').addEventListener('click', () => {
    if (!visualizing) {
        startVisualization();
    }
});

document.getElementById('returnToInputButton').addEventListener('click', () => {
    visualizing = false;
    document.getElementById('returnToInputButton').classList.add('hidden');
});

// Faint shimmer when mouse is near restyled elements
const SHIMMER_NEAR_PX = 100;
const shimmerEls = ['canvas-container', 'button', 'returnToInputButton'];

function distPointToRect(px, py, rect) {
    const dx = Math.max(rect.left - px, 0, px - rect.right);
    const dy = Math.max(rect.top - py, 0, py - rect.bottom);
    return Math.sqrt(dx * dx + dy * dy);
}

document.addEventListener('mousemove', (e) => {
    const x = e.clientX;
    const y = e.clientY;
    shimmerEls.forEach((id) => {
        const el = document.getElementById(id);
        if (!el || (id === 'returnToInputButton' && el.classList.contains('hidden'))) return;
        const rect = el.getBoundingClientRect();
        const dist = distPointToRect(x, y, rect);
        if (dist < SHIMMER_NEAR_PX) {
            const cx = Math.max(rect.left, Math.min(rect.right, x));
            const cy = Math.max(rect.top, Math.min(rect.bottom, y));
            const pctX = ((cx - rect.left) / rect.width) * 100;
            const pctY = ((cy - rect.top) / rect.height) * 100;
            el.classList.add('mouse-near');
            el.style.setProperty('--mouse-x', pctX + '%');
            el.style.setProperty('--mouse-y', pctY + '%');
        } else {
            el.classList.remove('mouse-near');
        }
    });
});

document.addEventListener('mouseout', (e) => {
    if (!e.relatedTarget || !document.contains(e.relatedTarget)) {
        shimmerEls.forEach((id) => {
            const el = document.getElementById(id);
            if (el) el.classList.remove('mouse-near');
        });
    }
});

// Mouse controls for camera
const glCanvas = document.getElementById('glCanvas');

glCanvas.addEventListener('mousedown', (e) => {
    if (visualizing && MOUSE_CONTROLS_ENABLED) {
        camera.handleMouseDown(e.clientX, e.clientY);
        glCanvas.style.cursor = 'grabbing';
    }
});

glCanvas.addEventListener('mousemove', (e) => {
    if (visualizing && MOUSE_CONTROLS_ENABLED) {
        camera.handleMouseMove(e.clientX, e.clientY);
    }
});

glCanvas.addEventListener('mouseup', () => {
    if (visualizing && MOUSE_CONTROLS_ENABLED) {
        camera.handleMouseUp();
        glCanvas.style.cursor = 'default';
    }
});

glCanvas.addEventListener('mouseleave', () => {
    if (visualizing && MOUSE_CONTROLS_ENABLED) {
        camera.handleMouseUp();
        glCanvas.style.cursor = 'default';
    }
});

glCanvas.addEventListener('wheel', (e) => {
    if (visualizing && MOUSE_CONTROLS_ENABLED) {
        e.preventDefault();
        camera.handleWheel(e.deltaY);
    }
});

// Touch controls for camera on mobile (one-finger orbit, two-finger pinch zoom)
let lastPinchDistance = 0;
const PINCH_ZOOM_SCALE = 0.5;

function touchDistance(t1, t2) {
    return Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
}

glCanvas.addEventListener('touchstart', (e) => {
    if (!visualizing || !MOUSE_CONTROLS_ENABLED) return;
    if (e.touches.length === 1) {
        camera.handleMouseDown(e.touches[0].clientX, e.touches[0].clientY);
        lastPinchDistance = 0;
    } else if (e.touches.length === 2) {
        camera.handleMouseUp();
        lastPinchDistance = touchDistance(e.touches[0], e.touches[1]);
    }
}, { passive: true });

glCanvas.addEventListener('touchmove', (e) => {
    if (!visualizing || !MOUSE_CONTROLS_ENABLED) return;
    if (e.touches.length === 1) {
        e.preventDefault();
        camera.handleMouseMove(e.touches[0].clientX, e.touches[0].clientY);
    } else if (e.touches.length === 2 && lastPinchDistance > 0) {
        e.preventDefault();
        const dist = touchDistance(e.touches[0], e.touches[1]);
        const delta = (dist - lastPinchDistance) * PINCH_ZOOM_SCALE;
        camera.handleWheel(-delta);
        lastPinchDistance = dist;
    }
}, { passive: false });

glCanvas.addEventListener('touchend', (e) => {
    if (!visualizing || !MOUSE_CONTROLS_ENABLED) return;
    if (e.touches.length === 0) {
        camera.handleMouseUp();
        lastPinchDistance = 0;
    } else if (e.touches.length === 1) {
        lastPinchDistance = 0;
        // Allow remaining finger to orbit (treat as new drag)
        camera.handleMouseDown(e.touches[0].clientX, e.touches[0].clientY);
    } else if (e.touches.length === 2) {
        lastPinchDistance = touchDistance(e.touches[0], e.touches[1]);
    }
});

glCanvas.addEventListener('touchcancel', (e) => {
    if (e.touches.length === 0) {
        camera.handleMouseUp();
        lastPinchDistance = 0;
    }
});

// Keyboard controls
document.addEventListener('keydown', (e) => {
    if (visualizing && KEYBOARD_CONTROLS_ENABLED) {
        // Prevent default behavior for arrow keys and W/S to avoid page scrolling
        if (e.key === 'ArrowLeft' || e.key === 'ArrowRight' ||
            e.key === 'ArrowUp' || e.key === 'ArrowDown' ||
            e.key === 'w' || e.key === 'W' || e.key === 's' || e.key === 'S') {
            e.preventDefault();
        }
        camera.setKey(e.key, true);
        if (e.key === 'c' || e.key === 'C') {
            reset();
        }
        // P: print current camera state for pasting into CAMERA_PRESETS or MOBILE_CAMERA_PRESETS
        if (e.key === 'p' || e.key === 'P') {
            const code = camera.getStateAsCodeString();
            const dest = isMobilePortraitView() ? 'MOBILE_CAMERA_PRESETS' : 'CAMERA_PRESETS';
            console.log(`Camera state (paste into ${dest}):`);
            console.log(code);
            const orbitDest = isMobilePortraitView() ? 'MOBILE_ORBIT_CENTER_PRESETS' : 'ORBIT_CENTER_PRESETS';
            console.log(`Orbit center (paste into ${orbitDest}):`);
            console.log(`{ x: ${camera.center.x}, y: ${camera.center.y}, z: ${camera.center.z} },`);
        }
    }
});

document.addEventListener('keyup', (e) => {
    if (visualizing && KEYBOARD_CONTROLS_ENABLED) {
        camera.setKey(e.key, false);
    }
});

// Animation loop
function animate() {
    frameCount++;
    fpsFrameCount++;

    // Calculate and print FPS occasionally
    const currentTime = performance.now();
    const elapsed = currentTime - lastFpsTime;
    if (elapsed >= FPS_UPDATE_INTERVAL) {
        const fps = Math.round((fpsFrameCount / elapsed) * 1000);
        console.log(`FPS: ${fps}`);
        fpsFrameCount = 0;
        lastFpsTime = currentTime;
    }

    if (visualizing) {
        const deltaTimeSec = (currentTime - lastFrameTime) / 1000;
        lastFrameTime = currentTime;
        camera.update(deltaTimeSec);
        drawVisualization();
    } else {
        lastFrameTime = currentTime;
        drawInputPage();
    }

    requestAnimationFrame(animate);
}

// Initialize on load
window.addEventListener('load', () => {
    initWebGL();
    animate();
});

window.addEventListener('resize', () => {
    if (gl) {
        gl.canvas.width = window.innerWidth;
        gl.canvas.height = window.innerHeight;
        gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);

        // Update input canvas size and position (responsive for mobile + landscape)
        const landscape = isLandscapeInput();
        const ui = document.getElementById('ui');
        if (landscape) {
            ui.classList.add('landscape-input');
        } else {
            ui.classList.remove('landscape-input');
        }

        const size = getInputCanvasSize();
        canvasW = size.w;
        canvasH = size.h;
        const canvasContainer = document.getElementById('canvas-container');
        canvasContainer.style.width = canvasW + 'px';
        canvasContainer.style.height = canvasH + 'px';

        if (landscape) {
            canvasContainer.style.left = '';
            canvasContainer.style.right = '';
            canvasContainer.style.top = '50%';
            canvasContainer.style.transform = 'translateY(-50%)';
            const rect = canvasContainer.getBoundingClientRect();
            canvasLeft = rect.left;
            canvasRight = rect.right;
            canvasTop = rect.top;
            canvasBottom = rect.bottom;
            canvasX = (rect.left + rect.right) / 2;
            canvasY = (rect.top + rect.bottom) / 2;
            document.getElementById('button').style.bottom = (window.innerHeight - rect.bottom) + 'px';
        } else {
            document.getElementById('button').style.bottom = '';
            canvasContainer.style.right = '';
            canvasContainer.style.transform = '';
            const isSmallScreen = window.innerHeight <= 700 || window.innerWidth <= 420;
            const canvasOffsetY = isSmallScreen ? 20 : -30;
            canvasX = window.innerWidth / 2;
            canvasY = window.innerHeight / 2 + canvasOffsetY + HEADER_OFFSET;
            canvasLeft = canvasX - canvasW / 2;
            canvasRight = canvasX + canvasW / 2;
            canvasTop = canvasY - canvasH / 2;
            canvasBottom = canvasY + canvasH / 2;
            canvasContainer.style.left = canvasLeft + 'px';
            canvasContainer.style.top = canvasTop + 'px';
        }

        if (drawCanvas) {
            drawCanvas.style.width = canvasW + 'px';
            drawCanvas.style.height = canvasH + 'px';
        }
    }
});
