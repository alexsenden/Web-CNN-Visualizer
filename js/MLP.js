class MLP {
    constructor(weightsPath, biasPath, relu, weightsData, biasData) {
        this.weights = parseMLPWeight(weightsData);
        this.bias = parseConvBias(biasData);
        this.wShape = [this.weights.getShape().get(0), this.weights.getShape().get(1)];
        this.relu = relu;
    }

    matMul(matrix1, matrix2) {
        const m1Rows = matrix1.getShape().get(0);
        const m1Cols = matrix1.getShape().get(1);
        const m2Cols = matrix2.getShape().get(1);

        // Check if the matrices can be multiplied
        if (m1Cols !== matrix2.getShape().get(0)) {
            throw new Error("Invalid matrix dimensions");
        }

        const result = new Tensor(m1Rows, m2Cols);

        for (let i = 0; i < m1Rows; i++) {
            for (let j = 0; j < m2Cols; j++) {
                let sum = 0.0;
                for (let k = 0; k < m1Cols; k++) {
                    const val1 = matrix1.get(i, k);
                    const val2 = matrix2.get(k, j);
                    // Defensive check: ensure no NaN or undefined values
                    const safeVal1 = (typeof val1 === 'number' && !isNaN(val1)) ? val1 : 0;
                    const safeVal2 = (typeof val2 === 'number' && !isNaN(val2)) ? val2 : 0;
                    sum += safeVal1 * safeVal2;
                }
                result.set((typeof sum === 'number' && !isNaN(sum)) ? sum : 0, i, j);
            }
            const currentVal = result.get(i, 0);
            const biasVal = this.bias.get(i);
            // Defensive check: ensure no NaN or undefined values
            const safeCurrent = (typeof currentVal === 'number' && !isNaN(currentVal)) ? currentVal : 0;
            const safeBias = (typeof biasVal === 'number' && !isNaN(biasVal)) ? biasVal : 0;
            const finalVal = safeCurrent + safeBias;
            result.set((typeof finalVal === 'number' && !isNaN(finalVal)) ? finalVal : 0, i, 0);

            if (this.relu) {
                result._relu();
            }
        }

        return result;
    }

    forward(x) {
        return this.matMul(this.weights, x);
    }
}
