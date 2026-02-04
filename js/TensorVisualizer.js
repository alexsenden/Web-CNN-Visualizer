class TensorVisualizer {
    constructor(tensor, centerPos, spacing, boxSize, boxStartSize = null) {
        this.tensor = tensor.squeeze();
        this.centerPos = centerPos.copy();
        this.spacing = spacing;
        this.boxSize = boxSize.copy();
        this.boxStartSize = boxStartSize ? boxStartSize.copy() : null;

        if (this.tensor.getShape().getNumDimensions() > 3) {
            throw new Error("Tensor must have 3 or fewer dimensions");
        }

        this.boxes = [];
        this.animationStage = 0;
        this.idxFlatSrc = 0;
        this.idxFlatTrg = 0;

        const indices = new Array(this.tensor.getShape().getNumDimensions()).fill(0);
        this.createBoxes(indices, 0, this.boxSize);
    }

    setIdxFlat(idxFlatSrc, idxFlatTrg) {
        this.idxFlatSrc = idxFlatSrc;
        this.idxFlatTrg = idxFlatTrg;
    }

    createBoxes(indices, dim, boxSize) {
        if (dim === this.tensor.getShape().getNumDimensions()) {
            const pos = new Vec3(0, 0, 0);
            const boxIndex = getIndex(this.tensor.shape, ...indices);

            if (this.tensor.getShape().getNumDimensions() === 3) {
                const halfX = Math.floor(this.tensor.getShape().get(1) / 2);
                const halfY = Math.floor(this.tensor.getShape().get(2) / 2);
                const halfZ = Math.floor(this.tensor.getShape().get(0) / 2);
                const x = map(indices[1], 0, this.tensor.getShape().get(1) - 1, -halfX * this.spacing, halfX * this.spacing);
                const y = map(indices[2], 0, this.tensor.getShape().get(2) - 1, -halfY * this.spacing, halfY * this.spacing);
                const z = map(indices[0], 0, this.tensor.getShape().get(0) - 1, -halfZ * this.spacing, halfZ * this.spacing);
                pos.set(y, x, z);
            } else if (this.tensor.getShape().getNumDimensions() === 2) {
                const halfX = Math.floor((this.tensor.getShape().get(0) - 1) / 2);
                const halfY = Math.floor((this.tensor.getShape().get(1) - 1) / 2);
                const x = map(indices[0], 0, this.tensor.getShape().get(0) - 1, -halfX * this.spacing, halfX * this.spacing);
                const y = map(indices[1], 0, this.tensor.getShape().get(1) - 1, -halfY * this.spacing, halfY * this.spacing);
                pos.set(y, x, 0);
            } else {
                const halfX = Math.floor((this.tensor.getShape().get(0) - 1) / 2);
                const x = map(indices[0], 0, this.tensor.getShape().get(0) - 1, -halfX * this.spacing, halfX * this.spacing);
                pos.set(x, 0, 0);
            }

            pos.add(this.centerPos);

            const startSize = this.boxStartSize || boxSize;
            this.boxes[boxIndex] = new Box(
                [...indices],
                this.tensor,
                pos.copy(),
                pos.copy(),
                startSize,
                boxSize
            );
            return;
        }

        for (let i = 0; i < this.tensor.getShape().get(dim); i++) {
            indices[dim] = i;
            this.createBoxes(indices, dim + 1, boxSize);
        }
    }

    setTensor(tensor) {
        if (tensor.getShape().getTotalSize() !== this.tensor.getShape().getTotalSize()) {
            throw new Error("Shape of the new tensor must match the shape of the visualizer tensor");
        }
        const squeezed = tensor.squeeze();
        this.tensor.shape = squeezed.shape;
        this.tensor.data = squeezed.data;
    }

    setTrgPos(arg) {
        const currentTime = performance.now();
        // Check if argument is a TensorVisualizer (has tensor and boxes properties)
        if (arg && arg.tensor && arg.boxes) {
            // Handle TensorVisualizer
            if (arg.tensor.data.length !== this.tensor.data.length) {
                throw new Error("Shape of the new tensor must match the shape of the visualizer tensor");
            }
            for (let i = 0; i < this.boxes.length; i++) {
                this.boxes[i].timeStart = currentTime;
                // Initialize curVal to current tensor value to prevent color flicker during animation
                const currentVal = this.boxes[i].getVal();
                this.boxes[i].setCurVal(currentVal);
                this.boxes[i].setTrgPos(arg.boxes[i].getTrgPos());
            }
        } else if (arg && typeof arg.getTrgPos === 'function') {
            // Handle Box
            for (let i = 0; i < this.boxes.length; i++) {
                this.boxes[i].timeStart = currentTime;
                // Initialize curVal to current tensor value to prevent color flicker during animation
                const currentVal = this.boxes[i].getVal();
                this.boxes[i].setCurVal(currentVal);
                this.boxes[i].setOrgSize(this.boxes[i].getTrgSize());
                this.boxes[i].setOrgPos(this.boxes[i].getTrgPos());
                this.boxes[i].setTrgPos(arg.getTrgPos());
                this.boxes[i].setTrgBox(arg);
            }
        } else {
            throw new Error("setTrgPos expects either a TensorVisualizer or a Box");
        }
    }

    setCurSize(size) {
        for (let i = 0; i < this.boxes.length; i++) {
            this.boxes[i].setCurSize(size);
        }
    }

    setTrgSize(size) {
        for (let i = 0; i < this.boxes.length; i++) {
            this.boxes[i].setTrgSize(size);
        }
    }

    setCurVal(tv) {
        if (tv.tensor.data.length !== this.tensor.data.length) {
            throw new Error("Shape of the new tensor must match the shape of the visualizer tensor");
        }
        for (let i = 0; i < this.boxes.length; i++) {
            this.boxes[i].setCurVal(tv.boxes[i].getVal());
        }
    }

    setCurPosOffset(offset) {
        for (let i = 0; i < this.boxes.length; i++) {
            this.boxes[i].curPos.add(offset);
        }
    }

    setAnimationDuration(duration) {
        for (let i = 0; i < this.boxes.length; i++) {
            this.boxes[i].setAnimationDuration(duration);
        }
    }

    setTrgPosOffset(offset) {
        for (let i = 0; i < this.boxes.length; i++) {
            this.boxes[i].trgPos.add(offset);
        }
    }

    setVisible(visibility) {
        for (let i = 0; i < this.boxes.length; i++) {
            this.boxes[i].setVisible(visibility);
        }
    }

    getAnimationStage() {
        return this.animationStage;
    }

    setAnimationStage(stage) {
        this.animationStage = stage;
    }

    isAnimationComplete(currentTime) {
        // Check time-based completion first (framerate-independent)
        // If time has elapsed, animation is complete regardless of position
        for (let box of this.boxes) {
            if (!box.isAnimationTimeComplete(currentTime)) {
                return false;
            }
        }
        // Also check position as a fallback (in case time check fails)
        for (let box of this.boxes) {
            if (!box.isCloseEnough()) {
                return false;
            }
        }
        return true;
    }

    update(currentTime) {
        for (let box of this.boxes) {
            box.update(currentTime);
        }
    }

    getVisibleBoxes() {
        const visibleBoxes = [];
        for (let box of this.boxes) {
            if (box.isVisible) {
                visibleBoxes.push(box);
            }
        }
        return visibleBoxes;
    }

    copy() {
        const copy = new TensorVisualizer(this.tensor, this.centerPos, this.spacing, this.boxSize, this.boxStartSize);
        copy.animationStage = this.animationStage;
        copy.idxFlatSrc = this.idxFlatSrc;
        copy.idxFlatTrg = this.idxFlatTrg;

        for (let i = 0; i < this.boxes.length; i++) {
            copy.boxes[i] = this.boxes[i].copy();
        }

        return copy;
    }

    disposeBuffers() {
        // No-op in WebGL version
    }
}
