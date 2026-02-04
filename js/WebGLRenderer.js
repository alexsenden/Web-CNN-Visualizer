// WebGL Renderer for boxes
class WebGLRenderer {
    // Toggle for white edges (lines between faces)
    static ENABLE_EDGES = false;
    // When true, uses plasma colormap; when false, uses grayscale
    static PLASMA_COLOR_MAP = true;
    // When true, outlines are white; when false, outlines are deep gray
    static WHITE_OUTLINES = true;

    // Label under each final MLP output: offset in world Y (positive = below) and quad size
    static DIGIT_LABEL_OFFSET_Y = 60;
    static DIGIT_LABEL_SCALE = 24;

    // Create texture atlas with digits 0-9 (white on transparent)
    static createDigitTexture(gl) {
        const cellCount = 10;
        const cellW = 64;
        const cellH = 64;
        const width = cellW * cellCount;
        const height = cellH;
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, width, height);
        ctx.fillStyle = 'white';
        ctx.font = `bold ${cellH * 0.7}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        for (let i = 0; i < cellCount; i++) {
            const x = i * cellW + cellW / 2;
            const y = cellH / 2;
            ctx.fillText(String(i), x, y);
        }
        const tex = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, tex);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, canvas);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.bindTexture(gl.TEXTURE_2D, null);
        return tex;
    }

    // Plasma colormap: maps value [0,1] to RGB [0,1]
    static plasmaColorMap(value) {
        // Handle invalid values
        if (value === undefined || value === null || isNaN(value)) {
            value = 0;
        }

        // Clamp value to [0, 1]
        value = Math.max(0, Math.min(1, value));

        // Key colors in Plasma colormap (approximated)
        let colors
        if (WebGLRenderer.PLASMA_COLOR_MAP) {
            colors = [
                [0.050383, 0.029803, 0.527975],  // 0.0: dark purple
                [0.363536, 0.017502, 0.550349],  // 0.25: purple
                [0.988362, 0.0, 0.644924],       // 0.5: magenta/pink
                [0.940015, 0.5, 0.131326],       // 0.75: orange
                [0.940015, 0.975158, 0.131326]   // 1.0: yellow
            ];
        } else {
            colors = [
                [0.0, 0.0, 0.0],  // 0.0: black
                [1.0, 1.0, 1.0],  // 1.0: white
            ];
        }

        // Handle edge case: value is exactly 1.0
        if (value >= 1.0) {
            const lastColor = colors[colors.length - 1];
            return { r: lastColor[0], g: lastColor[1], b: lastColor[2] };
        }

        // Find which segment we're in
        const segment = value * 4; // 0-4
        const index = Math.floor(segment);
        const t = segment - index;

        // Ensure indices are valid
        const i1 = Math.min(index, colors.length - 1);
        const i2 = Math.min(index + 1, colors.length - 1);

        // Safety check
        if (i1 < 0 || i1 >= colors.length || i2 < 0 || i2 >= colors.length) {
            // Fallback to first color
            return { r: colors[0][0], g: colors[0][1], b: colors[0][2] };
        }

        // Interpolate between colors
        const r = colors[i1][0] + (colors[i2][0] - colors[i1][0]) * t;
        const g = colors[i1][1] + (colors[i2][1] - colors[i1][1]) * t;
        const b = colors[i1][2] + (colors[i2][2] - colors[i1][2]) * t;

        return { r, g, b };
    }

    constructor(gl) {
        this.gl = gl;
        this.program = null;

        // Box geometry (unit cube)
        this.boxVertices = new Float32Array([
            // Front face
            -0.5, -0.5, 0.5, 0.5, -0.5, 0.5, 0.5, 0.5, 0.5, -0.5, 0.5, 0.5,
            // Back face
            -0.5, -0.5, -0.5, -0.5, 0.5, -0.5, 0.5, 0.5, -0.5, 0.5, -0.5, -0.5,
            // Top face
            -0.5, 0.5, -0.5, -0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, -0.5,
            // Bottom face
            -0.5, -0.5, -0.5, 0.5, -0.5, -0.5, 0.5, -0.5, 0.5, -0.5, -0.5, 0.5,
            // Right face
            0.5, -0.5, -0.5, 0.5, 0.5, -0.5, 0.5, 0.5, 0.5, 0.5, -0.5, 0.5,
            // Left face
            -0.5, -0.5, -0.5, -0.5, -0.5, 0.5, -0.5, 0.5, 0.5, -0.5, 0.5, -0.5,
        ]);

        this.boxIndices = new Uint16Array([
            0, 1, 2, 0, 2, 3,    // front
            4, 5, 6, 4, 6, 7,    // back
            8, 9, 10, 8, 10, 11,   // top
            12, 13, 14, 12, 14, 15,   // bottom
            16, 17, 18, 16, 18, 19,   // right
            20, 21, 22, 20, 22, 23,   // left
        ]);

        // Edge indices for drawing white edges (12 unique edges of a cube, each edge has 2 vertices)
        // Using vertices from front/back faces and connecting edges
        // Front face: 0(-0.5,-0.5,0.5), 1(0.5,-0.5,0.5), 2(0.5,0.5,0.5), 3(-0.5,0.5,0.5)
        // Back face: 4(-0.5,-0.5,-0.5), 5(-0.5,0.5,-0.5), 6(0.5,0.5,-0.5), 7(0.5,-0.5,-0.5)
        this.edgeIndices = new Uint16Array([
            // Front face edges
            0, 1,   // front bottom
            1, 2,   // front right
            2, 3,   // front top
            3, 0,   // front left
            // Back face edges
            4, 7,   // back bottom
            7, 6,   // back right
            6, 5,   // back top
            5, 4,   // back left
            // Connecting edges (front to back)
            0, 4,   // bottom left
            1, 7,   // bottom right
            2, 6,   // top right
            3, 5    // top left
        ]);

        this.init();
        this.initDigitLabels();
    }

    initDigitLabels() {
        const gl = this.gl;
        this.digitTexture = WebGLRenderer.createDigitTexture(gl);

        const digitVertexSource = `
            attribute vec2 a_position;
            attribute vec2 a_uv;
            uniform mat4 u_view;
            uniform mat4 u_projXFlip;
            uniform vec3 u_worldPos;
            uniform float u_scale;
            varying vec2 v_uv;
            void main() {
                vec4 viewPos = u_view * vec4(u_worldPos, 1.0);
                vec4 quadPos = viewPos + vec4(a_position.x * u_scale, a_position.y * u_scale, 0.0, 0.0);
                gl_Position = u_projXFlip * quadPos;
                v_uv = a_uv;
            }
        `;
        const digitFragmentSource = `
            precision mediump float;
            varying vec2 v_uv;
            uniform sampler2D u_tex;
            uniform vec2 u_uvOffset;
            uniform vec2 u_uvScale;
            uniform float u_opacity;
            void main() {
                vec2 uv = u_uvOffset + vec2((1.0 - v_uv.x) * u_uvScale.x, (1.0 - v_uv.y) * u_uvScale.y);
                vec4 texColor = texture2D(u_tex, uv);
                gl_FragColor = vec4(1.0, 1.0, 1.0, texColor.a * u_opacity);
            }
        `;
        const vs = WebGLUtils.createShader(gl, gl.VERTEX_SHADER, digitVertexSource);
        const fs = WebGLUtils.createShader(gl, gl.FRAGMENT_SHADER, digitFragmentSource);
        this.digitProgram = WebGLUtils.createProgram(gl, vs, fs);
        if (!this.digitProgram) return;

        // Quad: 4 vertices, position (-1,-1) to (1,1), uv (0,0) to (1,1)
        this.digitQuadPos = new Float32Array([-1, -1, 1, -1, 1, 1, -1, 1]);
        this.digitQuadUV = new Float32Array([0, 0, 1, 0, 1, 1, 0, 1]);
        this.digitQuadIndices = new Uint16Array([0, 1, 2, 0, 2, 3]);

        this.digitPosBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, this.digitPosBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, this.digitQuadPos, gl.STATIC_DRAW);
        this.digitUVBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, this.digitUVBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, this.digitQuadUV, gl.STATIC_DRAW);
        this.digitIndexBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.digitIndexBuffer);
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, this.digitQuadIndices, gl.STATIC_DRAW);

        this.digitPosLoc = gl.getAttribLocation(this.digitProgram, 'a_position');
        this.digitUVLoc = gl.getAttribLocation(this.digitProgram, 'a_uv');
        this.digitViewLoc = gl.getUniformLocation(this.digitProgram, 'u_view');
        this.digitProjXFlipLoc = gl.getUniformLocation(this.digitProgram, 'u_projXFlip');
        this.digitWorldPosLoc = gl.getUniformLocation(this.digitProgram, 'u_worldPos');
        this.digitScaleLoc = gl.getUniformLocation(this.digitProgram, 'u_scale');
        this.digitTexLoc = gl.getUniformLocation(this.digitProgram, 'u_tex');
        this.digitUVOffsetLoc = gl.getUniformLocation(this.digitProgram, 'u_uvOffset');
        this.digitUVScaleLoc = gl.getUniformLocation(this.digitProgram, 'u_uvScale');
        this.digitOpacityLoc = gl.getUniformLocation(this.digitProgram, 'u_opacity');
    }

    init() {
        const vertexShaderSource = `
            attribute vec3 a_position;
            attribute vec3 a_color;
            
            uniform mat4 u_mvpMatrix;
            uniform mat4 u_modelMatrix;
            
            varying vec3 v_color;
            
            void main() {
                gl_Position = u_mvpMatrix * vec4(a_position, 1.0);
                v_color = a_color;
            }
        `;

        const fragmentShaderSource = `
            precision mediump float;
            
            varying vec3 v_color;
            
            void main() {
                gl_FragColor = vec4(v_color, 1.0);
            }
        `;

        const vertexShader = WebGLUtils.createShader(this.gl, this.gl.VERTEX_SHADER, vertexShaderSource);
        const fragmentShader = WebGLUtils.createShader(this.gl, this.gl.FRAGMENT_SHADER, fragmentShaderSource);

        if (!vertexShader || !fragmentShader) {
            return;
        }

        this.program = WebGLUtils.createProgram(this.gl, vertexShader, fragmentShader);

        if (!this.program) {
            return;
        }

        // Create buffers
        this.positionBuffer = this.gl.createBuffer();
        this.indexBuffer = this.gl.createBuffer();
        this.edgeIndexBuffer = this.gl.createBuffer();
        this.colorBuffer = this.gl.createBuffer();

        // Upload box geometry
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.positionBuffer);
        this.gl.bufferData(this.gl.ARRAY_BUFFER, this.boxVertices, this.gl.STATIC_DRAW);

        this.gl.bindBuffer(this.gl.ELEMENT_ARRAY_BUFFER, this.indexBuffer);
        this.gl.bufferData(this.gl.ELEMENT_ARRAY_BUFFER, this.boxIndices, this.gl.STATIC_DRAW);

        this.gl.bindBuffer(this.gl.ELEMENT_ARRAY_BUFFER, this.edgeIndexBuffer);
        this.gl.bufferData(this.gl.ELEMENT_ARRAY_BUFFER, this.edgeIndices, this.gl.STATIC_DRAW);

        // Cache attribute/uniform locations (don't query every frame)
        this.positionLocation = this.gl.getAttribLocation(this.program, 'a_position');
        this.colorLocation = this.gl.getAttribLocation(this.program, 'a_color');
        this.mvpMatrixLocation = this.gl.getUniformLocation(this.program, 'u_mvpMatrix');

        // Pre-allocate reusable color array (24 vertices * 3 components = 72 floats)
        this.reusableColorArray = new Float32Array(72);
        this.reusableEdgeColorArray = new Float32Array(72);
        // Pre-fill edge color array based on WHITE_OUTLINES constant
        const outlineVal = WebGLRenderer.WHITE_OUTLINES ? 1.0 : 0.0;
        for (let i = 0; i < 24; i++) {
            this.reusableEdgeColorArray[i * 3 + 0] = outlineVal;
            this.reusableEdgeColorArray[i * 3 + 1] = outlineVal;
            this.reusableEdgeColorArray[i * 3 + 2] = outlineVal;
        }
    }

    renderBoxes(boxes, mvpMatrix) {
        if (!this.program || boxes.length === 0) {
            return;
        }

        this.gl.useProgram(this.program);

        // Bind index buffer once (it's shared across all boxes)
        this.gl.bindBuffer(this.gl.ELEMENT_ARRAY_BUFFER, this.indexBuffer);

        // Set up position attribute once (it's the same for all boxes)
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.positionBuffer);
        this.gl.enableVertexAttribArray(this.positionLocation);
        this.gl.vertexAttribPointer(this.positionLocation, 3, this.gl.FLOAT, false, 0, 0);

        const numVertices = 24;

        // Render edges first (if enabled), then main boxes
        if (WebGLRenderer.ENABLE_EDGES) {
            // Set line width for edges (may not be supported on all systems, but try anyway)
            this.gl.lineWidth(2);

            // Bind edge color buffer (white)
            this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.colorBuffer);
            this.gl.bufferData(this.gl.ARRAY_BUFFER, this.reusableEdgeColorArray, this.gl.DYNAMIC_DRAW);
            this.gl.enableVertexAttribArray(this.colorLocation);
            this.gl.vertexAttribPointer(this.colorLocation, 3, this.gl.FLOAT, false, 0, 0);

            // Bind edge index buffer
            this.gl.bindBuffer(this.gl.ELEMENT_ARRAY_BUFFER, this.edgeIndexBuffer);

            // Render all edges
            for (let box of boxes) {
                if (!box.isVisible) continue;

                const scaleMatrix = WebGLUtils.createScale(box.curSize.x, box.curSize.y, box.curSize.z);
                const translateMatrix = WebGLUtils.createTranslation(box.curPos.x, box.curPos.y, box.curPos.z);
                const modelMatrix = WebGLUtils.multiplyMatrices(translateMatrix, scaleMatrix);
                const boxMvpMatrix = WebGLUtils.multiplyMatrices(mvpMatrix, modelMatrix);

                this.gl.uniformMatrix4fv(this.mvpMatrixLocation, false, boxMvpMatrix);
                // Draw edges as lines
                this.gl.drawElements(this.gl.LINES, this.edgeIndices.length, this.gl.UNSIGNED_SHORT, 0);
            }
        }

        // Render main boxes
        // Bind face index buffer (for triangles)
        this.gl.bindBuffer(this.gl.ELEMENT_ARRAY_BUFFER, this.indexBuffer);

        // Bind color buffer (will be updated per box)
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.colorBuffer);
        this.gl.enableVertexAttribArray(this.colorLocation);
        this.gl.vertexAttribPointer(this.colorLocation, 3, this.gl.FLOAT, false, 0, 0);

        for (let box of boxes) {
            if (!box.isVisible) continue;

            // Create model matrix (scale and translate)
            const scaleMatrix = WebGLUtils.createScale(box.curSize.x, box.curSize.y, box.curSize.z);
            const translateMatrix = WebGLUtils.createTranslation(box.curPos.x, box.curPos.y, box.curPos.z);
            const modelMatrix = WebGLUtils.multiplyMatrices(translateMatrix, scaleMatrix);
            const boxMvpMatrix = WebGLUtils.multiplyMatrices(mvpMatrix, modelMatrix);

            this.gl.uniformMatrix4fv(this.mvpMatrixLocation, false, boxMvpMatrix);

            // Get value from box and calculate color
            let value = 0;
            if (box.curVal && typeof box.curVal.x === 'number' && !isNaN(box.curVal.x)) {
                value = Math.max(0, Math.min(1, box.curVal.x));
            }

            // Map value to Plasma colormap
            const plasmaColor = WebGLRenderer.plasmaColorMap(value);
            const r = plasmaColor.r;
            const g = plasmaColor.g;
            const b = plasmaColor.b;

            // Reuse pre-allocated array instead of creating new one
            for (let i = 0; i < numVertices; i++) {
                this.reusableColorArray[i * 3 + 0] = r;
                this.reusableColorArray[i * 3 + 1] = g;
                this.reusableColorArray[i * 3 + 2] = b;
            }

            // Upload color data
            this.gl.bufferData(this.gl.ARRAY_BUFFER, this.reusableColorArray, this.gl.DYNAMIC_DRAW);

            // Draw main box
            this.gl.drawElements(this.gl.TRIANGLES, this.boxIndices.length, this.gl.UNSIGNED_SHORT, 0);
        }
    }

    // Render white digit labels (0-9) in 3D under each final MLP output.
    // worldPositions: array of 10 Vec3 (or {x,y,z}) for label centers.
    // viewMatrix, projXFlipMatrix: view and (projection * xFlipScale) for billboard.
    // opacity: 0-1 for fade-in effect.
    renderDigitLabels(worldPositions, viewMatrix, projXFlipMatrix, opacity = 1.0) {
        if (!this.digitProgram || !worldPositions || worldPositions.length < 10) return;
        const gl = this.gl;
        gl.enable(gl.BLEND);
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
        gl.depthMask(false);
        gl.useProgram(this.digitProgram);
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, this.digitTexture);
        gl.uniform1i(this.digitTexLoc, 0);
        gl.uniformMatrix4fv(this.digitViewLoc, false, viewMatrix);
        gl.uniformMatrix4fv(this.digitProjXFlipLoc, false, projXFlipMatrix);
        gl.uniform1f(this.digitScaleLoc, WebGLRenderer.DIGIT_LABEL_SCALE);
        gl.uniform2f(this.digitUVScaleLoc, 0.1, 1.0);
        gl.uniform1f(this.digitOpacityLoc, opacity);
        gl.bindBuffer(gl.ARRAY_BUFFER, this.digitPosBuffer);
        gl.enableVertexAttribArray(this.digitPosLoc);
        gl.vertexAttribPointer(this.digitPosLoc, 2, gl.FLOAT, false, 0, 0);
        gl.bindBuffer(gl.ARRAY_BUFFER, this.digitUVBuffer);
        gl.enableVertexAttribArray(this.digitUVLoc);
        gl.vertexAttribPointer(this.digitUVLoc, 2, gl.FLOAT, false, 0, 0);
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.digitIndexBuffer);
        for (let i = 0; i < 10; i++) {
            const p = worldPositions[i];
            gl.uniform3f(this.digitWorldPosLoc, p.x, p.y, p.z);
            gl.uniform2f(this.digitUVOffsetLoc, i * 0.1, 0.0);
            gl.drawElements(gl.TRIANGLES, 6, gl.UNSIGNED_SHORT, 0);
        }
        gl.depthMask(true);
        gl.disable(gl.BLEND);
    }
}
