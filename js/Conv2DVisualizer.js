class Conv2DVisualizer extends Animation {
    constructor(conv2D, srcVis, trgVis, iterations, boxSize) {
        super();
        this.conv2D = conv2D;
        this.weights = conv2D.weights;
        this.srcVis = srcVis;
        this.trgVis = trgVis;
        this.iterations = iterations;
        this.boxSize = boxSize;

        this.weightsVisualizerList = [];
        this.srcIdxX = 0;
        this.srcIdxY = 0;
        this.srcIdxZ = 0;
        this.trgIdx = 0;
        this.doCreateFilters = false;
    }

    startAnimation() {
        this.isComplete = false;
        this.doCreateFilters = true;
    }

    resetAnimation() {
        this.isComplete = true;
        this.doCreateFilters = false;
        this.srcIdxX = 0;
        this.srcIdxY = 0;
        this.srcIdxZ = 0;
        this.trgIdx = 0;
        this.weightsVisualizerList = [];
    }

    update(currentTime) {
        if (!this.isComplete) {
            for (let iter = 0; iter < this.iterations; iter++) {
                if (this.doCreateFilters) {
                    let srcIdx;
                    if (this.srcVis.tensor.getShape().getNumDimensions() <= 2) {
                        srcIdx = [this.srcIdxY, this.srcIdxX];
                    } else {
                        srcIdx = [this.srcIdxZ, this.srcIdxY, this.srcIdxX];
                    }
                    const idx_flat_src = getIndex(this.srcVis.tensor.getShape(), ...srcIdx);

                    const idx_3d_trg = index1DTo3D(this.trgIdx, this.trgVis.tensor.getShape());
                    const idx_flat_trg = getIndex(this.trgVis.tensor.getShape(), ...idx_3d_trg);
                    const weightSlice = this.weights.slice(
                        [idx_3d_trg[0], 0, 0, 0],
                        [idx_3d_trg[0] + 1, this.weights.getShape().get(1), 3, 3]
                    );
                    const centerPos = this.srcVis.boxes[idx_flat_src].getTrgPos().copy();
                    centerPos.z = this.srcVis.centerPos.z;
                    const tv = new TensorVisualizer(weightSlice, centerPos, this.srcVis.spacing, this.boxSize);
                    tv.setAnimationDuration(40);
                    tv.setCurPosOffset(new Vec3(0, 0, 30));
                    tv.setIdxFlat(idx_flat_src, idx_flat_trg);
                    tv.setVisible(true);
                    this.weightsVisualizerList.push(tv);

                    if (this.srcVis.tensor.getShape().getNumDimensions() <= 2) {
                        this.srcIdxX += 2;
                        if (this.srcIdxX >= this.srcVis.tensor.getShape().get(1)) {
                            this.srcIdxX = 0;
                            this.srcIdxY += 2;
                            if (this.srcIdxY >= this.srcVis.tensor.getShape().get(0)) {
                                this.srcIdxY = 0;
                                this.srcIdxX = 0;
                            }
                        }
                    } else {
                        this.srcIdxX += 2;
                        if (this.srcIdxX >= this.srcVis.tensor.getShape().get(2)) {
                            this.srcIdxX = 0;
                            this.srcIdxY += 2;
                            if (this.srcIdxY >= this.srcVis.tensor.getShape().get(1)) {
                                this.srcIdxY = 0;
                                this.srcIdxZ++;
                                if (this.srcIdxZ >= this.srcVis.tensor.getShape().get(0)) {
                                    this.srcIdxX = 0;
                                    this.srcIdxY = 0;
                                    this.srcIdxZ = 0;
                                }
                            }
                        }
                    }
                    this.trgIdx++;
                    if (this.trgIdx >= this.trgVis.tensor.data.length) {
                        this.doCreateFilters = false;
                    }
                }

                if (this.weightsVisualizerList.length === 0) {
                    this.endAnimation();
                }

                for (let i = this.weightsVisualizerList.length - 1; i >= 0; i--) {
                    const tvTemp = this.weightsVisualizerList[i];
                    tvTemp.update(currentTime);
                    if (tvTemp.isAnimationComplete(currentTime)) {
                        if (tvTemp.getAnimationStage() < 1) {
                            tvTemp.setAnimationDuration(40);
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
    }

    getVisibleBoxes() {
        const boxes = [];
        for (let tv of this.weightsVisualizerList) {
            boxes.push(...tv.getVisibleBoxes());
        }
        return boxes;
    }
}
