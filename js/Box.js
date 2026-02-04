// NOTE: To adjust animation speed, change ANIMATION_SPEED_MULTIPLIER in main.js
// Higher values = faster animations (e.g., 2.0 = 2x faster, 0.5 = 2x slower)

class Box {
    constructor(indices, tensor, startPos, endPos, startSize, endSize) {
        this.indices = indices;
        this.tensor = tensor;
        this.orgPos = startPos.copy();
        this.curPos = startPos.copy();
        this.trgPos = endPos.copy();
        this.orgSize = startSize.copy();
        this.curSize = startSize.copy();
        this.trgSize = endSize.copy();
        this.orgVal = new Vec3(0, 0, 0);
        // Initialize curVal to the actual tensor value to prevent color flicker
        const initialVal = this.getVal();
        this.curVal = new Vec3(initialVal, initialVal, initialVal);

        this.isVisible = false;
        this.damping = 0.2;
        this.eps = 5.0;
        this.trgBox = null;

        this.timeStart = performance.now();
        this.timeDuration = 2000; // Duration in milliseconds (default 2 seconds)
    }

    copy() {
        const copiedBox = new Box(
            [...this.indices],
            this.tensor,
            this.orgPos.copy(),
            this.trgPos.copy(),
            this.orgSize.copy(),
            this.trgSize.copy()
        );

        copiedBox.curPos = this.curPos.copy();
        copiedBox.curSize = this.curSize.copy();
        copiedBox.orgVal = this.orgVal.copy();
        copiedBox.curVal = this.curVal.copy();
        copiedBox.isVisible = this.isVisible;
        copiedBox.damping = this.damping;
        copiedBox.eps = this.eps;
        copiedBox.timeStart = this.timeStart;
        copiedBox.timeDuration = this.timeDuration;
        copiedBox.trgBox = this.trgBox ? this.trgBox.copy() : null;

        return copiedBox;
    }

    getOrgPos() {
        return this.orgPos;
    }

    setOrgPos(pos) {
        this.orgPos = pos.copy();
    }

    getCurPos() {
        return this.curPos;
    }

    setCurPos(pos) {
        this.curPos = pos.copy();
    }

    getTrgPos() {
        return this.trgPos;
    }

    setTrgPos(pos) {
        this.trgPos = pos.copy();
    }

    getOrgSize() {
        return this.orgSize;
    }

    setOrgSize(size) {
        this.orgSize = size.copy();
    }

    getCurSize() {
        return this.curSize;
    }

    setCurSize(size) {
        this.curSize = size.copy();
    }

    getTrgSize() {
        return this.trgSize;
    }

    setTrgSize(size) {
        this.trgSize = size.copy();
    }

    setTrgBox(box) {
        this.trgBox = box;
    }

    setCurVal(val) {
        this.curVal.set(val, val, val);
    }

    getVal() {
        return this.tensor.get(...this.indices);
    }

    setAnimationDuration(duration) {
        // Duration is now in milliseconds
        // If duration is less than 100, assume it's in frames and convert (assuming 25fps, the original framerate)
        let timeDuration;
        if (duration < 100) {
            timeDuration = (duration / 25) * 1000; // Convert frames to milliseconds at 25fps
        } else {
            timeDuration = duration; // Already in milliseconds
        }

        // Apply global animation speed multiplier (if defined)
        // Check both window.ANIMATION_SPEED_MULTIPLIER and global ANIMATION_SPEED_MULTIPLIER
        const speedMultiplier = (typeof window !== 'undefined' && window.ANIMATION_SPEED_MULTIPLIER) ||
            (typeof ANIMATION_SPEED_MULTIPLIER !== 'undefined' ? ANIMATION_SPEED_MULTIPLIER : 1.0);
        this.timeDuration = timeDuration / speedMultiplier;
    }

    update(currentTime) {
        // Use provided time or get current time
        if (currentTime === undefined) {
            currentTime = performance.now();
        }
        const elapsed = currentTime - this.timeStart;
        const progress = constrain(elapsed / this.timeDuration, 0, 1);

        // If animation time has elapsed, ensure we're at the target (framerate-independent)
        if (progress >= 1.0) {
            this.curPos = this.trgPos.copy();
            this.curSize = this.trgSize.copy();
        } else {
            const easing = easeInOutCirc(progress);
            this.curPos = Vec3.lerp(this.orgPos, this.trgPos, easing);
            this.curSize = Vec3.lerp(this.orgSize, this.trgSize, easing);
        }

        // Update curVal based on whether we're transitioning to a different value or just animating position
        if (this.trgBox !== null) {
            // We're transitioning to a different tensor value - use damping for smooth color transition
            const targetVal = this.trgBox.getVal();
            const targetValVec = new Vec3(targetVal, targetVal, targetVal);
            const valDiff = new Vec3(
                targetValVec.x - this.curVal.x,
                targetValVec.y - this.curVal.y,
                targetValVec.z - this.curVal.z
            );
            valDiff.mult(this.damping);
            this.curVal.add(valDiff);
        } else {
            // Just animating position/size - keep curVal at the current tensor value (no color change)
            const currentVal = this.getVal();
            this.curVal.set(currentVal, currentVal, currentVal);
        }
    }

    setVisible(visibility) {
        this.isVisible = visibility;
    }

    isCloseEnough() {
        const isClose = this.curPos.dist(this.trgPos) < this.eps;
        if (isClose && this.trgBox !== null) {
            this.trgBox.setVisible(true);
        }
        return isClose;
    }

    // Check if animation has completed based on elapsed time (framerate-independent)
    isAnimationTimeComplete(currentTime) {
        if (currentTime === undefined) {
            currentTime = performance.now();
        }
        const elapsed = currentTime - this.timeStart;
        return elapsed >= this.timeDuration;
    }

    // Get visible boxes for WebGL rendering
    getVisibleBoxes() {
        if (this.isVisible) {
            return [this];
        }
        return [];
    }
}
