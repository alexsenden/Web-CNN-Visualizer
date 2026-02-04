// Utility functions
function getIndex(shape, ...indices) {
    let index = 0;
    for (let i = 0; i < indices.length; i++) {
        if (indices[i] < 0 || indices[i] >= shape.get(i)) {
            return -1;
        }
        index = index * shape.get(i) + indices[i];
    }
    return index;
}

function index1DTo2D(idx, shape) {
    if (shape.getNumDimensions() !== 2) {
        throw new Error("Shape must have exactly 2 dimensions.");
    }
    const totalSize = shape.getTotalSize();
    idx = ((idx % totalSize) + totalSize) % totalSize;

    const dimX = shape.getDimension(0);
    const dimY = shape.getDimension(1);

    const idxY = idx % dimY;
    const idxX = Math.floor(idx / dimY);

    return [idxX, idxY];
}

function index1DTo3D(idx, shape) {
    if (shape.getNumDimensions() !== 3) {
        throw new Error("Shape must have exactly 3 dimensions.");
    }
    const totalSize = shape.getTotalSize();
    idx = ((idx % totalSize) + totalSize) % totalSize;

    const dimX = shape.getDimension(0);
    const dimY = shape.getDimension(1);
    const dimZ = shape.getDimension(2);

    const idxZ = idx % dimZ;
    const idxY = Math.floor((idx / dimZ) % dimY);
    const idxX = Math.floor(idx / (dimY * dimZ));

    return [idxX, idxY, idxZ];
}

function indicesToSliceIndices(indices, start) {
    return indices.map((idx, i) => idx - start[i]);
}

function parseConvBias(biasData) {
    const outChNum = biasData.length;
    const tensor = new Tensor(outChNum);

    for (let i = 0; i < outChNum; i++) {
        const value = parseFloat((biasData[i] || '').trim());
        tensor.set(isNaN(value) ? 0 : value, i);
    }

    return tensor;
}

function parseConvWeightsToTensor(weightsData) {
    const outChNum = weightsData.length;
    if (outChNum === 0) {
        return new Tensor(1, 1, 1, 1);
    }
    let inChNum = 0;
    let kernelWNum = 0;
    let kernelHNum = 0;

    // Calculate size of each dimension
    for (let i = 0; i < outChNum; i++) {
        if (!weightsData[i] || weightsData[i].trim() === '') {
            continue;
        }
        const inCh = weightsData[i].split("!");
        // Filter out empty strings from split
        const validInCh = inCh.filter(ch => ch.trim().length > 0);
        if (validInCh.length > inChNum) {
            inChNum = validInCh.length;
        }
        for (let j = 0; j < validInCh.length; j++) {
            const kernelW = validInCh[j].split(",");
            const validKernelW = kernelW.filter(kw => kw.trim().length > 0);
            if (validKernelW.length > kernelWNum) {
                kernelWNum = validKernelW.length;
            }
            for (let k = 0; k < validKernelW.length; k++) {
                const kernelH = validKernelW[k].trim().split(/\s+/).filter(s => s.length > 0);
                if (kernelH.length > kernelHNum) {
                    kernelHNum = kernelH.length;
                }
            }
        }
    }

    // Ensure we have valid dimensions
    if (inChNum === 0) inChNum = 1;
    if (kernelWNum === 0) kernelWNum = 1;
    if (kernelHNum === 0) kernelHNum = 1;

    // Define Tensor shape and create Tensor object
    const shape = [outChNum, inChNum, kernelWNum, kernelHNum];
    const tensor = new Tensor(...shape);

    // Store parsed data in Tensor
    for (let i = 0; i < outChNum; i++) {
        if (!weightsData[i] || weightsData[i].trim() === '') continue;
        const inCh = weightsData[i].split("!");
        // Filter out empty strings from split (matching dimension calculation)
        const validInCh = inCh.filter(ch => ch.trim().length > 0);
        // Process up to inChNum input channels (matching Processing: for (int j = 0; j < inChNum; j++))
        for (let j = 0; j < inChNum; j++) {
            let kernelW, validKernelW;
            if (j < validInCh.length) {
                kernelW = validInCh[j].split(",");
                validKernelW = kernelW.filter(kw => kw.trim().length > 0);
            } else {
                validKernelW = [];
            }
            // Process up to kernelWNum (matching Processing: for (int k = 0; k < kernelWNum; k++))
            for (let k = 0; k < kernelWNum; k++) {
                let kernelH;
                if (k < validKernelW.length) {
                    kernelH = validKernelW[k].trim().split(/\s+/).filter(s => s.length > 0);
                } else {
                    kernelH = [];
                }
                // Process up to kernelHNum (matching Processing: for (int l = 0; l < kernelHNum; l++))
                for (let l = 0; l < kernelHNum; l++) {
                    let rawValue;
                    if (l < kernelH.length) {
                        rawValue = kernelH[l];
                    } else {
                        rawValue = '';
                    }
                    if (rawValue === undefined || rawValue.trim() === '') {
                        tensor.set(0, i, j, k, l);
                    } else {
                        const value = parseFloat(rawValue.trim());
                        // Defensive check: if parseFloat returns NaN, use 0 instead
                        if (isNaN(value)) {
                            tensor.set(0, i, j, k, l);
                        } else {
                            tensor.set(value, i, j, k, l);
                        }
                    }
                }
            }
        }
    }
    return tensor;
}

function parseMLPWeight(weightsData) {
    const batchNum = weightsData.length;
    if (batchNum === 0 || !weightsData[0]) {
        return new Tensor(1, 1);
    }
    const inChNum = weightsData[0].trim().split(/\s+/).filter(s => s.length > 0).length;

    const tensor = new Tensor(batchNum, inChNum);

    for (let i = 0; i < batchNum; i++) {
        if (!weightsData[i] || weightsData[i].trim() === '') continue;
        const inCh = weightsData[i].trim().split(/\s+/).filter(s => s.length > 0);
        for (let j = 0; j < inCh.length && j < inChNum; j++) {
            const value = parseFloat(inCh[j]);
            // Defensive check: if parseFloat returns NaN, use 0 instead
            if (isNaN(value)) {
                tensor.set(0, i, j);
            } else {
                tensor.set(value, i, j);
            }
        }
    }
    return tensor;
}

function softmax(tensor) {
    const originalShape = tensor.getShape();
    const flattened = tensor.clone();
    flattened._reshape(flattened.getShape().getTotalSize());

    const maxVal = tensor.max();

    let sumExp = 0;
    for (let i = 0; i < flattened.getShape().get(0); i++) {
        const val = Math.exp(flattened.get(i) - maxVal);
        flattened.set(val, i);
        sumExp += val;
    }

    for (let i = 0; i < flattened.getShape().get(0); i++) {
        flattened.set(flattened.get(i) / sumExp, i);
    }

    // Return to original shape
    flattened._reshape(...originalShape.toArray());
    return flattened;
}

function easeInOutCirc(x) {
    if (x < 0.5) {
        return (1 - Math.sqrt(1 - Math.pow(2 * x, 2))) / 2;
    } else {
        return (Math.sqrt(1 - Math.pow(-2 * x + 2, 2)) + 1) / 2;
    }
}
