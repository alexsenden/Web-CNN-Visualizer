class Conv2D {
    constructor(weightsPath, biasPath, weightsData, biasData) {
        this.weights = parseConvWeightsToTensor(weightsData);
        this.bias = parseConvBias(biasData);
        this.wShape = this.weights.getShape().toArray();
        this.stride = 2;
    }

    forward(x) {
        const xShape = x.getShape();
        const bSize = xShape.get(0);
        const imgSize = Math.floor(xShape.get(2) / 2);
        const outShape = [bSize, this.wShape[0], imgSize, imgSize];
        const kernelH = this.wShape[2];
        const kernelW = this.wShape[3];
        const kernelHSize = Math.floor(kernelH / 2);
        const kernelWSize = Math.floor(kernelW / 2);
        const result = new Tensor(outShape[0], outShape[1], outShape[2], outShape[3]);

        // loop over every output channel
        for (let i = 0; i < outShape[1]; i++) {
            // loop over every pixel
            for (let j = 0; j < outShape[2]; j++) {
                for (let k = 0; k < outShape[3]; k++) {
                    // loop over kernel
                    for (let l = 0; l < this.wShape[1]; l++) {
                        for (let m = 0; m < kernelH; m++) {
                            for (let n = 0; n < kernelW; n++) {
                                const offsetX = m - kernelHSize;
                                const offsetY = n - kernelWSize;
                                result.set(
                                    result.get(0, i, j, k) +
                                    x.get(0, l, j * this.stride + offsetX, k * this.stride + offsetY) *
                                    this.weights.get(i, l, m, n),
                                    0,
                                    i,
                                    j,
                                    k
                                );
                            }
                        }
                    }
                    result.set(result.get(0, i, j, k) + this.bias.get(i), 0, i, j, k);
                    result._relu();
                }
            }
        }
        return result;
    }
}
