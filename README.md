# Web CNN Visualizer

A simple CNN visualizer that runs right in your browser! Draw a digit 0–9, click **Predict**, and watch the CNN forward pass through each layer. All inference runs in on-device.

Based on [okdalto/conv_visualizer](https://github.com/okdalto/conv_visualizer).

## Run locally

The app uses `fetch` for data, so serve it over HTTP:

```bash
python -m http.server 8000
# or: npx serve .
```

Open `http://localhost:8000`.

## Controls

- **Draw** on the canvas, then click **Predict** to run the network.
- **Mouse drag** – rotate | **Scroll** – zoom | **Arrow keys / W / S** – pan

## What it shows

- 4 conv layers (filters and activations)
- Reshape (4D → 1D)
- 2 fully connected (MLP) layers
- Softmax → digit 0–9 probabilities

Weights are loaded from text files (exported from a PyTorch-trained model).

