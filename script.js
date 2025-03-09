document.addEventListener("DOMContentLoaded", () => {
    // Final (visible) canvas dimensions
    const finalWidth = 256;
    const finalHeight = 256;
    // Desired blur radius (in pixels) for the first box blur
    const blurRadius = 40;
    // Contrast factor (1.0 = no change, >1.0 increases contrast)
    const contrastFactor = 1.4;
    // Hidden canvas dimensions (providing a buffer for the blur)
    const hiddenWidth = finalWidth + 2 * blurRadius;
    const hiddenHeight = finalHeight + 2 * blurRadius;

    // Global ellipse parameters:
    const minEllipseSize = 90;         // Minimum base size (in pixels)
    const maxEllipseSize = 120;        // Maximum base size (in pixels)
    // Donut parameters: ellipse center will be between these radii from canvas center.
    const donutInnerRadius = 50;       // Minimum offset from the center (in pixels)
    const donutOuterRadius = 90;       // Maximum offset from the center (in pixels)
    const ellipseDeviationFactor = 0.2; // 0 = perfect circle; higher values allow more deviation

    // Second (lighter) blur radius (for reblurring after dithering)
    const secondBlurRadius = 8;
    // Number of shades per channel for dithering
    const ditherShades = 30;

    // Get canvas references and contexts
    const hiddenCanvas = document.getElementById("hiddenCanvas");
    const finalCanvas = document.getElementById("finalCanvas");
    hiddenCanvas.width = hiddenWidth;
    hiddenCanvas.height = hiddenHeight;
    const ctxHidden = hiddenCanvas.getContext("2d");
    const ctxFinal = finalCanvas.getContext("2d");

    // Create an offscreen temporary canvas for our blurred image
    const tempCanvas = document.createElement("canvas");
    tempCanvas.width = hiddenWidth;
    tempCanvas.height = hiddenHeight;
    const tempCtx = tempCanvas.getContext("2d");

    const generateBtn = document.getElementById("generateBtn");
    const downloadBtn = document.getElementById("downloadBtn");

    // A limited color palette.
    const colorPalette = [
        "#DEE4E7",
        "#b1c7d1",
        "#7a8b91",
        "#47646e",
        "#43565a",
        "#253235",
        "#1D2325",
        "#141515"
    ];

    generateBtn.addEventListener("click", () => {
        // 1) Generate the image on the hidden canvas.
        generateLimitedPaletteImageFull(ctxHidden, hiddenWidth, hiddenHeight, colorPalette);

        // 2) Get the hidden canvas image data and apply our vanilla box blur.
        const hiddenImageData = ctxHidden.getImageData(0, 0, hiddenWidth, hiddenHeight);
        const blurredImageData = boxBlurImageData(hiddenImageData, blurRadius);
        tempCtx.putImageData(blurredImageData, 0, 0);

        // 3) Crop the central region from the blurred temp canvas to the final canvas.
        ctxFinal.clearRect(0, 0, finalWidth, finalHeight);
        ctxFinal.drawImage(
            tempCanvas,
            blurRadius,      // source x offset
            blurRadius,      // source y offset
            finalWidth,      // source width
            finalHeight,     // source height
            0,               // destination x
            0,               // destination y
            finalWidth,      // destination width
            finalHeight      // destination height
        );

        // 4) Enhance the contrast of the final image.
        let imageData = ctxFinal.getImageData(0, 0, finalWidth, finalHeight);
        imageData = enhanceContrast(imageData, contrastFactor);
        ctxFinal.putImageData(imageData, 0, 0);

        // 5) Apply Floyd–Steinberg dithering.
        imageData = ctxFinal.getImageData(0, 0, finalWidth, finalHeight);
        const ditheredData = floydSteinbergDitherImageData(imageData, ditherShades);
        ctxFinal.putImageData(ditheredData, 0, 0);

        // 6) Reblur the dithered image with a smaller blur radius.
        imageData = ctxFinal.getImageData(0, 0, finalWidth, finalHeight);
        const reblurredData = boxBlurImageData(imageData, secondBlurRadius);
        ctxFinal.putImageData(reblurredData, 0, 0);
    });

    downloadBtn.addEventListener("click", () => {
        const dataURL = finalCanvas.toDataURL("image/png");
        const link = document.createElement("a");
        link.href = dataURL;
        link.download = "blurred_contrasted_dithered_image.png";
        link.click();
    });

    /**
     * Generates an image on the entire hidden canvas using a limited palette.
     * It fills the canvas with a gradient background and draws two ellipses.
     * The first ellipse is drawn with a radial gradient fill,
     * and the second ellipse is drawn with a flat color.
     */
    function generateLimitedPaletteImageFull(ctx, width, height, palette) {
        ctx.clearRect(0, 0, width, height);
        const color1 = randomColorFromPalette(palette);
        const color2 = randomColorFromPalette(palette);
        const grad = ctx.createLinearGradient(0, 0, width, height);
        grad.addColorStop(0, color1);
        grad.addColorStop(1, color2);
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, width, height);

        // Draw first ellipse with gradient fill.
        drawRandomEllipse(ctx, width, height, palette, true);
        // Draw second ellipse with flat color.
        drawRandomEllipse(ctx, width, height, palette, false);
    }

    /**
     * Draws a random ellipse on the provided context.
     * The ellipse's center is chosen from a donut-shaped region around the canvas center.
     * If useGradient is true, the ellipse is filled with a radial gradient;
     * otherwise, it is filled with a flat color.
     */
    function drawRandomEllipse(ctx, width, height, palette, useGradient) {
        const canvasCenterX = width / 2;
        const canvasCenterY = height / 2;
        const offsetRadius = donutInnerRadius + Math.random() * (donutOuterRadius - donutInnerRadius);
        const angle = Math.random() * 2 * Math.PI;
        const centerX = canvasCenterX + offsetRadius * Math.cos(angle);
        const centerY = canvasCenterY + offsetRadius * Math.sin(angle);
        const baseSize = minEllipseSize + Math.random() * (maxEllipseSize - minEllipseSize);
        const deviation = (Math.random() * 2 - 1) * ellipseDeviationFactor * baseSize;
        const radiusX = baseSize;
        const radiusY = baseSize + deviation;

        ctx.beginPath();
        ctx.ellipse(centerX, centerY, radiusX, radiusY, 0, 0, 2 * Math.PI);
        if (useGradient) {
            // Create a radial gradient fill for the ellipse.
            const gradColor1 = randomColorFromPalette(palette);
            const gradColor2 = randomColorFromPalette(palette);
            const outerRadius = (radiusX + radiusY) / 2;
            const radialGrad = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, outerRadius);
            radialGrad.addColorStop(0, gradColor1);
            radialGrad.addColorStop(1, gradColor2);
            ctx.fillStyle = radialGrad;
        } else {
            ctx.fillStyle = randomColorFromPalette(palette);
        }
        ctx.fill();
    }

    /**
     * Enhances contrast of the provided ImageData.
     * For each pixel channel, applies: newValue = factor * (oldValue - 128) + 128
     * and clamps the result to [0, 255].
     */
    function enhanceContrast(imageData, factor) {
        const data = imageData.data;
        for (let i = 0; i < data.length; i += 4) {
            for (let c = 0; c < 3; c++) {
                let newVal = factor * (data[i + c] - 128) + 128;
                data[i + c] = Math.max(0, Math.min(255, newVal));
            }
        }
        return imageData;
    }

    /**
     * Returns a random color from the provided palette.
     */
    function randomColorFromPalette(palette) {
        const index = Math.floor(Math.random() * palette.length);
        return palette[index];
    }

    /**
     * Applies a two-pass box blur on the given ImageData.
     * This vanilla implementation averages pixel values horizontally and then vertically.
     *
     * @param {ImageData} imageData - The source image data.
     * @param {number} radius - The blur radius.
     * @returns {ImageData} - The blurred image data.
     */
    function boxBlurImageData(imageData, radius) {
        const { data, width, height } = imageData;
        const tempData = new Uint8ClampedArray(data.length);
        const outputData = new Uint8ClampedArray(data.length);

        // Horizontal pass
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                let r = 0, g = 0, b = 0, a = 0, count = 0;
                for (let dx = -radius; dx <= radius; dx++) {
                    const nx = x + dx;
                    if (nx >= 0 && nx < width) {
                        const index = (y * width + nx) * 4;
                        r += data[index];
                        g += data[index + 1];
                        b += data[index + 2];
                        a += data[index + 3];
                        count++;
                    }
                }
                const index = (y * width + x) * 4;
                tempData[index] = r / count;
                tempData[index + 1] = g / count;
                tempData[index + 2] = b / count;
                tempData[index + 3] = a / count;
            }
        }

        // Vertical pass
        for (let x = 0; x < width; x++) {
            for (let y = 0; y < height; y++) {
                let r = 0, g = 0, b = 0, a = 0, count = 0;
                for (let dy = -radius; dy <= radius; dy++) {
                    const ny = y + dy;
                    if (ny >= 0 && ny < height) {
                        const index = (ny * width + x) * 4;
                        r += tempData[index];
                        g += tempData[index + 1];
                        b += tempData[index + 2];
                        a += tempData[index + 3];
                        count++;
                    }
                }
                const index = (y * width + x) * 4;
                outputData[index] = r / count;
                outputData[index + 1] = g / count;
                outputData[index + 2] = b / count;
                outputData[index + 3] = a / count;
            }
        }

        return new ImageData(outputData, width, height);
    }

    /**
     * Applies Floyd–Steinberg dithering to the provided ImageData while preserving colors.
     * For each pixel and for each channel, quantizes the value to one of the specified shades,
     * then diffuses the quantization error to neighboring pixels.
     *
     * @param {ImageData} imageData - The source image data.
     * @param {number} shades - The number of quantization levels per channel.
     * @returns {ImageData} - The dithered image data.
     */
    function floydSteinbergDitherImageData(imageData, shades) {
        const { width, height } = imageData;
        // Work on a copy of the data in a Float32Array for precision
        const data = new Float32Array(imageData.data);
        const step = 4000 / (shades - 1);

        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const index = (y * width + x) * 4;
                // Process R, G, B channels
                for (let c = 0; c < 3; c++) {
                    const oldVal = data[index + c];
                    const newVal = Math.round(oldVal / step) * step;
                    data[index + c] = newVal;
                    const error = oldVal - newVal;

                    // Distribute the error to neighboring pixels:
                    // x+1, y (7/16)
                    if (x + 1 < width) {
                        data[index + 4 + c] += error * (7 / 16);
                    }
                    // x-1, y+1 (3/16)
                    if (x - 1 >= 0 && y + 1 < height) {
                        data[index - 4 + width * 4 + c] += error * (3 / 16);
                    }
                    // x, y+1 (5/16)
                    if (y + 1 < height) {
                        data[index + width * 4 + c] += error * (5 / 16);
                    }
                    // x+1, y+1 (1/16)
                    if (x + 1 < width && y + 1 < height) {
                        data[index + 4 + width * 4 + c] += error * (1 / 16);
                    }
                }
                // Alpha channel remains unchanged
            }
        }
        // Clamp values and convert back to Uint8ClampedArray
        const output = new Uint8ClampedArray(data.length);
        for (let i = 0; i < data.length; i++) {
            output[i] = Math.max(0, Math.min(255, data[i]));
        }
        return new ImageData(output, width, height);
    }
});
