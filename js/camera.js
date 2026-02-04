// Orbital camera controller for 3D visualization
class Camera {
    constructor() {
        // Camera distance from center
        this.distance = 2500;

        // Camera rotation (spherical coordinates)
        this.rotationX = 0.2; // Rotation around Y axis (horizontal)
        this.rotationY = 0.3; // Rotation around X axis (vertical)

        // Rotation speed
        this.rotationSpeed = 0.01;
        this.zoomSpeed = 50;
        this.keyboardMoveSpeed = 40; // Speed for keyboard translation

        // Camera translation offset (for keyboard movement)
        this.translation = new Vec3(0, 0, 0);

        // Mouse state
        this.isDragging = false;
        this.lastMouseX = 0;
        this.lastMouseY = 0;

        // Keyboard state
        this.keys = {};

        // Center point to orbit around
        this.center = new Vec3(0, 0, 0);

        // Target state for smooth interpolation (null = no active transition)
        this.targetState = null;
        // Speed of transition toward target (higher = faster). Set from main.js CAMERA_TRANSITION_SPEED.
        this.transitionSpeed = 2.0;
    }

    // Lerp helper: wrap angle difference to (-PI, PI] for shortest path
    _angleDiff(a, b) {
        let d = b - a;
        while (d > Math.PI) d -= 2 * Math.PI;
        while (d <= -Math.PI) d += 2 * Math.PI;
        return d;
    }

    // Get camera's local coordinate axes based on current rotation
    getCameraAxes() {
        // Calculate orbital camera position using spherical coordinates
        const camX = Math.sin(this.rotationX) * Math.cos(this.rotationY) * this.distance;
        const camY = Math.sin(this.rotationY) * this.distance;
        const camZ = Math.cos(this.rotationX) * Math.cos(this.rotationY) * this.distance;

        const orbitalPos = new Vec3(camX, camY, camZ);
        const eye = new Vec3(
            orbitalPos.x + this.translation.x,
            orbitalPos.y + this.translation.y,
            orbitalPos.z + this.translation.z
        );

        const center = new Vec3(
            this.center.x + this.translation.x,
            this.center.y + this.translation.y,
            this.center.z + this.translation.z
        );

        // Forward vector: from camera to center (normalized)
        const forward = new Vec3(
            center.x - eye.x,
            center.y - eye.y,
            center.z - eye.z
        );
        forward.normalize();

        // World up vector (flipped upside-down)
        const worldUp = new Vec3(0, -1, 0);

        // Right vector: cross product of world up and forward
        const right = new Vec3();
        right.cross(worldUp, forward);
        right.normalize();

        // Camera up vector: cross product of forward and right
        const up = new Vec3();
        up.cross(forward, right);
        up.normalize();

        return { forward, right, up };
    }

    // Update camera based on keyboard input and smooth interpolation toward target state.
    // deltaTime: time since last frame in seconds.
    update(deltaTime) {
        deltaTime = typeof deltaTime === 'number' && deltaTime > 0 ? deltaTime : 0.016;

        // Get camera's local coordinate axes
        const { forward, right, up } = this.getCameraAxes();

        // Handle horizontal movement (left/right arrow keys) - move along camera's right vector
        if (this.keys['ArrowLeft']) {
            this.targetState = null;
            const move = right.copy().mult(this.keyboardMoveSpeed);
            this.translation.add(move);
        }
        if (this.keys['ArrowRight']) {
            this.targetState = null;
            const move = right.copy().mult(-this.keyboardMoveSpeed);
            this.translation.add(move);
        }

        // Handle forward/backward movement (up/down arrow keys) - move along camera's forward vector
        if (this.keys['ArrowUp']) {
            this.targetState = null;
            const move = forward.copy().mult(this.keyboardMoveSpeed);
            this.translation.add(move);
        }
        if (this.keys['ArrowDown']) {
            this.targetState = null;
            const move = forward.copy().mult(-this.keyboardMoveSpeed);
            this.translation.add(move);
        }

        // Handle vertical movement (W/S keys) - move along camera's up vector
        if (this.keys['w'] || this.keys['W']) {
            this.targetState = null;
            const move = up.copy().mult(this.keyboardMoveSpeed);
            this.translation.add(move);
        }
        if (this.keys['s'] || this.keys['S']) {
            this.targetState = null;
            const move = up.copy().mult(-this.keyboardMoveSpeed);
            this.translation.add(move);
        }

        // Smooth interpolation toward target preset state
        if (this.targetState) {
            const speed = this.transitionSpeed;
            const blend = 1 - Math.exp(-speed * deltaTime);

            if (this.targetState.distance != null) {
                this.distance += (this.targetState.distance - this.distance) * blend;
            }
            if (this.targetState.rotationX != null) {
                const dx = this._angleDiff(this.rotationX, this.targetState.rotationX);
                this.rotationX += dx * blend;
            }
            if (this.targetState.rotationY != null) {
                const dy = this._angleDiff(this.rotationY, this.targetState.rotationY);
                this.rotationY += dy * blend;
            }
            if (this.targetState.translation) {
                const t = this.targetState.translation;
                this.translation.x += ((t.x ?? this.translation.x) - this.translation.x) * blend;
                this.translation.y += ((t.y ?? this.translation.y) - this.translation.y) * blend;
                this.translation.z += ((t.z ?? this.translation.z) - this.translation.z) * blend;
            }

            // Clear target when close enough
            const eps = 0.5;
            let done = true;
            if (this.targetState.distance != null && Math.abs(this.distance - this.targetState.distance) > eps) done = false;
            if (this.targetState.rotationX != null && Math.abs(this._angleDiff(this.rotationX, this.targetState.rotationX)) > 1e-4) done = false;
            if (this.targetState.rotationY != null && Math.abs(this._angleDiff(this.rotationY, this.targetState.rotationY)) > 1e-4) done = false;
            if (this.targetState.translation) {
                const t = this.targetState.translation;
                if (Math.abs(this.translation.x - (t.x ?? this.translation.x)) > eps ||
                    Math.abs(this.translation.y - (t.y ?? this.translation.y)) > eps ||
                    Math.abs(this.translation.z - (t.z ?? this.translation.z)) > eps) done = false;
            }
            if (done) this.targetState = null;
        }
    }

    // Handle mouse press
    handleMouseDown(x, y) {
        this.targetState = null;
        this.isDragging = true;
        this.lastMouseX = x;
        this.lastMouseY = y;
    }

    // Handle mouse release
    handleMouseUp() {
        this.isDragging = false;
    }

    // Handle mouse drag (rotation)
    handleMouseMove(x, y) {
        if (this.isDragging) {
            const dx = x - this.lastMouseX;
            const dy = y - this.lastMouseY;

            this.rotationX -= dx * this.rotationSpeed; // Inverted horizontal rotation
            this.rotationY -= dy * this.rotationSpeed; // Inverted vertical rotation

            // Clamp vertical rotation to prevent flipping
            this.rotationY = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, this.rotationY));

            this.lastMouseX = x;
            this.lastMouseY = y;
        }
    }

    // Handle mouse wheel (zoom)
    handleWheel(delta) {
        this.targetState = null;
        this.distance += delta > 0 ? this.zoomSpeed : -this.zoomSpeed;
        this.distance = Math.max(100, Math.min(5000, this.distance));
    }

    // Get view matrix
    getViewMatrix() {
        // Calculate orbital camera position using spherical coordinates
        const camX = Math.sin(this.rotationX) * Math.cos(this.rotationY) * this.distance;
        const camY = Math.sin(this.rotationY) * this.distance;
        const camZ = Math.cos(this.rotationX) * Math.cos(this.rotationY) * this.distance;

        // Add translation offset for keyboard movement
        const orbitalPos = new Vec3(camX, camY, camZ);
        const eye = new Vec3(
            orbitalPos.x + this.translation.x,
            orbitalPos.y + this.translation.y,
            orbitalPos.z + this.translation.z
        );

        // Center point also moves with translation
        const center = new Vec3(
            this.center.x + this.translation.x,
            this.center.y + this.translation.y,
            this.center.z + this.translation.z
        );
        const up = new Vec3(0, -1, 0); // Flipped upside-down

        return WebGLUtils.createLookAt(eye, center, up);
    }

    // Set key state for keyboard controls
    setKey(key, pressed) {
        this.keys[key] = pressed;
    }

    /**
     * Get current camera state (for saving presets or printing).
     * Returns a plain object suitable for setState() or hardcoding.
     */
    getState() {
        return {
            distance: this.distance,
            rotationX: this.rotationX,
            rotationY: this.rotationY,
            translation: { x: this.translation.x, y: this.translation.y, z: this.translation.z }
        };
    }

    /**
     * Set camera to a saved state (e.g. from a preset).
     * Smoothly interpolates toward the state; set transitionSpeed to control speed.
     * state: { distance, rotationX, rotationY, translation: { x, y, z } }
     */
    setState(state) {
        if (!state) return;
        this.targetState = {
            distance: state.distance != null ? state.distance : this.distance,
            rotationX: state.rotationX != null ? state.rotationX : this.rotationX,
            rotationY: state.rotationY != null ? state.rotationY : this.rotationY,
            translation: state.translation
                ? { x: state.translation.x ?? this.translation.x, y: state.translation.y ?? this.translation.y, z: state.translation.z ?? this.translation.z }
                : { x: this.translation.x, y: this.translation.y, z: this.translation.z }
        };
    }

    /**
     * Return current camera state as a string you can copy into CAMERA_PRESETS in main.js.
     * Call this when you've positioned the camera (e.g. press P) then paste the output.
     */
    getStateAsCodeString() {
        const s = this.getState();
        const t = s.translation;
        return `{ distance: ${s.distance}, rotationX: ${s.rotationX}, rotationY: ${s.rotationY}, translation: { x: ${t.x}, y: ${t.y}, z: ${t.z} } }`;
    }
}
