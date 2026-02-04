DELAY_DURATION_MS = 2000;

class Animation {
    constructor() {
        this.isComplete = true;
        this.state = null;
        this.nextAnimation = null;
        this.pendingNextStartTimeout = null;
    }

    setState(state) {
        this.state = state;
    }

    start() {
        this.resetAnimation();
        this.startAnimation();
        // Camera state handling can be added here if needed
    }

    reset() {
        if (this.pendingNextStartTimeout !== null) {
            clearTimeout(this.pendingNextStartTimeout);
            this.pendingNextStartTimeout = null;
        }
        this.resetAnimation();
    }

    resetAnimation() {
        // To be implemented by subclasses
    }

    startAnimation() {
        // To be implemented by subclasses
    }

    update(currentTime) {
        // To be implemented by subclasses
    }

    isAnimationComplete() {
        return this.isComplete;
    }

    setNextAnimation(nextAnimation) {
        this.nextAnimation = nextAnimation;
    }

    getCompletionDelayMs() {
        return DELAY_DURATION_MS;
    }

    endAnimation() {
        this.isComplete = true;
        this.resetAnimation();
        // Notify before starting next layer (e.g. for camera preset move)
        if (typeof window !== 'undefined' && window.onLayerComplete) {
            window.onLayerComplete(this);
        }
        if (this.nextAnimation !== null) {
            const next = this.nextAnimation;
            const delay = this.getCompletionDelayMs();
            this.pendingNextStartTimeout = setTimeout(() => {
                this.pendingNextStartTimeout = null;
                next.start();
            }, delay);
        }
    }
}
