const MLP_COMPLETION_DELAY_MS = 0;

class MLPVisualizer extends Animation {
    constructor(mlp, srcVis, trgVis, boxSize) {
        super();
        this.weights = mlp.weights;
        this.srcVis = srcVis;
        this.trgVis = trgVis;
        this.weightsNum = this.weights.getShape().get(0);
        this.weightsVisualizerList = [];
        this.iterations = 1;
        this.trgIdx = 0;
        this.doCreateFilters = false;
        this.boxSize = boxSize;
    }

    startAnimation() {
        this.isComplete = false;
        this.doCreateFilters = true;
    }

    resetAnimation() {
        this.isComplete = true;
        this.doCreateFilters = false;
        this.trgIdx = 0;
        this.weightsVisualizerList = [];
        this.lastCreateTime = null;
    }

    update(currentTime) {
        if (!this.isComplete) {
            // Use time-based throttling instead of frame-based
            // Base delay: create a new filter every 100ms (faster than before)
            // This is affected by the animation speed multiplier
            const baseCreateDelay = 100; // milliseconds
            const speedMultiplier = (typeof window !== 'undefined' && window.ANIMATION_SPEED_MULTIPLIER) ||
                (typeof ANIMATION_SPEED_MULTIPLIER !== 'undefined' ? ANIMATION_SPEED_MULTIPLIER : 1.0);
            const createDelay = baseCreateDelay / speedMultiplier;

            if (!this.lastCreateTime) {
                this.lastCreateTime = currentTime || performance.now();
            }
            const timeSinceLastCreate = (currentTime || performance.now()) - this.lastCreateTime;

            if (timeSinceLastCreate >= createDelay) {
                this.lastCreateTime = currentTime || performance.now();
                for (let iter = 0; iter < this.iterations; iter++) {
                    if (this.doCreateFilters) {
                        const weightSlice = this.weights.slice(
                            [this.trgIdx, 0],
                            [this.trgIdx + 1, this.weights.getShape().get(1)]
                        );
                        const centerPos = this.srcVis.centerPos.copy();
                        const tv = new TensorVisualizer(weightSlice, centerPos, this.srcVis.spacing, new Vec3(0, 0, 0), this.boxSize);
                        tv.setAnimationDuration(70);
                        tv.setCurPosOffset(new Vec3(0, -50, 0));
                        tv.setTrgPos(this.srcVis);
                        tv.setVisible(true);
                        tv.setIdxFlat(this.trgIdx, this.trgIdx);
                        this.weightsVisualizerList.push(tv);
                    }
                }

                this.trgIdx++;
                if (this.trgIdx >= this.trgVis.tensor.getShape().get(0)) {
                    this.trgIdx = 0;
                    this.doCreateFilters = false;
                }
            }

            if (!this.doCreateFilters && this.weightsVisualizerList.length === 0) {
                this.endAnimation();
            }

            for (let i = this.weightsVisualizerList.length - 1; i >= 0; i--) {
                const tvTemp = this.weightsVisualizerList[i];
                tvTemp.update(currentTime);
                if (tvTemp.isAnimationComplete(currentTime)) {
                    if (tvTemp.getAnimationStage() < 1) {
                        tvTemp.setAnimationDuration(70);
                        tvTemp.setTrgPos(this.trgVis.boxes[tvTemp.idxFlatTrg]);
                        tvTemp.setAnimationStage(tvTemp.getAnimationStage() + 1);
                    } else if (tvTemp.getAnimationStage() < 2) {
                        tvTemp.disposeBuffers();
                        this.weightsVisualizerList.splice(i, 1);
                    }
                }
            }
        }
    }

    getVisibleBoxes() {
        const boxes = [];
        for (let tv of this.weightsVisualizerList) {
            boxes.push(...tv.getVisibleBoxes());
        }
        return boxes;
    }

    getCompletionDelayMs() {
        return MLP_COMPLETION_DELAY_MS;
    }
}
