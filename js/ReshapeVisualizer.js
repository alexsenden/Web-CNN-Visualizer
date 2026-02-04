class ReshapeVisualizer extends Animation {
    constructor(srcVis, trgVis, boxSize) {
        super();
        this.srcVis = srcVis;
        this.trgVis = trgVis;
        this.tv = this.srcVis.copy();
        this.boxSize = boxSize;
    }

    startAnimation() {
        this.isComplete = false;
        this.tv.setCurVal(this.srcVis);
        this.tv.setTrgSize(this.boxSize);
        this.tv.setAnimationDuration(100);
        this.tv.setTrgPos(this.trgVis);
        this.tv.setVisible(true);
    }

    resetAnimation() {
        this.isComplete = true;
    }

    update(currentTime) {
        if (!this.isComplete) {
            this.tv.update(currentTime);
            if (this.tv.isAnimationComplete(currentTime)) {
                this.trgVis.setVisible(true);
                this.resetAnimation();
                this.endAnimation();
            }
        }
    }

    getVisibleBoxes() {
        if (!this.isComplete) {
            return this.tv.getVisibleBoxes();
        }
        return [];
    }
}
