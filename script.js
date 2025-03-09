document.addEventListener("DOMContentLoaded", () => {
    // Final (visible) canvas dimensions
    const finalWidth = 256;
    const finalHeight = 256;
    // Desired blur radius (in pixels) for the box blur
    const blurRadius = 20;
    // Contrast factor (1.0 = no change, >1.0 increases contrast)
    const contrastFactor = 1.25;
    // Hidden canvas dimensions (providing a buffer for the blur)
    const hiddenWidth = finalWidth + 2 * blurRadius;
    const hiddenHeight = finalHeight + 2 * blurRadius;

    // Global ellipse parameters:
    const minEllipseSize = 90;         // Minimum base size (in pixels)
    const maxEllipseSize = 120;        // Maximum base size (in pixels)
    // Donut parameters: ellipse center will be between these radii from canvas center.
    const donutInnerRadius = 30;       // Minimum offset from the center (in pixels)
    const donutOuterRadius = 70;       // Maximum offset from the center (in pixels)
    const ellipseDeviationFactor = 0.2; // 0 = perfect circle; higher values allow more deviation

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
        "#C6D0D5",
        "#A3B2B8",
        "#7F949C",
        "#495B60",
        "#364447",
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
        const imageData = ctxFinal.getImageData(0, 0, finalWidth, finalHeight);
        const contrastedData = enhanceContrast(imageData, contrastFactor);
        ctxFinal.putImageData(contrastedData, 0, 0);
    });

    downloadBtn.addEventListener("click", () => {
        const dataURL = finalCanvas.toDataURL("image/png");
        const link = document.createElement("a");
        link.href = dataURL;
        link.download = "blurred_contrasted_image.png";
        link.click();
    });

    /**
     * Generates an image on the entire hidden canvas using a limited palette.
     * It fills the canvas with a gradient background and draws two random ellipses.
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

        // Draw two random ellipses.
        drawRandomEllipse(ctx, width, height, palette);
        drawRandomEllipse(ctx, width, height, palette);
    }

    /**
     * Draws a random ellipse.
     * The ellipse's center is chosen from a donut-shaped region around the canvas center.
     */
    function drawRandomEllipse(ctx, width, height, palette) {
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
        ctx.fillStyle = randomColorFromPalette(palette);
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
});
