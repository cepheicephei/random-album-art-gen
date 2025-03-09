document.addEventListener("DOMContentLoaded", () => {
    // Final (visible) canvas dimensions
    const finalWidth = 256;
    const finalHeight = 256;
    // Desired blur radius (in pixels)
    const blurRadius = 20;
    // Contrast factor (1.0 = no change, >1.0 increases contrast)
    const contrastFactor = 1.25;
    // Hidden canvas dimensions are larger to provide a buffer for the blur.
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

    // Create an offscreen temporary canvas for applying the blur
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
        // 1) Generate an image on the hidden canvas using the limited palette.
        //    This version fills the entire hidden canvas so that no transparent edge exists.
        generateLimitedPaletteImageFull(ctxHidden, hiddenWidth, hiddenHeight, colorPalette);

        // 2) Apply the blur filter. Use native canvas filtering if supported,
        //    otherwise use a CSS filter fallback on the final canvas.
        if ('filter' in ctxFinal) {
            // Use canvas filter on the offscreen temp canvas.
            tempCtx.clearRect(0, 0, hiddenWidth, hiddenHeight);
            tempCtx.filter = `blur(${blurRadius}px)`;
            tempCtx.drawImage(hiddenCanvas, 0, 0);
            tempCtx.filter = "none"; // Reset filter

            // 3) Clear the final (visible) canvas.
            ctxFinal.clearRect(0, 0, finalWidth, finalHeight);

            // 4) Crop the central region from the temp canvas (which has the blur applied)
            //    and draw it onto the final canvas.
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
        } else {
            // Fallback: apply a CSS blur filter to the final canvas.
            // First, crop the image from the hidden canvas without applying blur.
            ctxFinal.clearRect(0, 0, finalWidth, finalHeight);
            ctxFinal.drawImage(
                hiddenCanvas,
                blurRadius,      // source x offset (crop center)
                blurRadius,      // source y offset
                finalWidth,      // source width
                finalHeight,     // source height
                0,               // destination x
                0,               // destination y
                finalWidth,      // destination width
                finalHeight      // destination height
            );
            // Then apply a CSS filter to the final canvas element.
            finalCanvas.style.filter = `blur(${blurRadius}px)`;
            // Optionally, remove the CSS filter after a short delay so that further operations work normally.
            setTimeout(() => {
                finalCanvas.style.filter = "";
            }, 50);
        }

        // 5) Enhance the contrast of the final image.
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
     * Draw a random image using a limited color palette on the entire hidden canvas.
     * This function fills the whole hidden canvas (which is larger than the final canvas)
     * so that no transparent regions exist that could cause edge fade when blurred.
     *
     * It draws:
     *  - A 2-color linear gradient background over the entire canvas.
     *  - Two random ellipses whose centers are chosen from a donut-shaped region around the canvas center,
     *    whose sizes are between minEllipseSize and maxEllipseSize, and whose deviation
     *    from a perfect circle is limited by ellipseDeviationFactor.
     */
    function generateLimitedPaletteImageFull(ctx, width, height, palette) {
        // Clear the entire hidden canvas.
        ctx.clearRect(0, 0, width, height);

        // Pick two random colors from the palette for the gradient.
        const color1 = randomColorFromPalette(palette);
        const color2 = randomColorFromPalette(palette);

        // Create a background gradient that fills the entire hidden canvas.
        const grad = ctx.createLinearGradient(0, 0, width, height);
        grad.addColorStop(0, color1);
        grad.addColorStop(1, color2);
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, width, height);

        // Draw first random ellipse.
        drawRandomEllipse(ctx, width, height, palette);
        // Draw a second random ellipse on top.
        drawRandomEllipse(ctx, width, height, palette);
    }

    /**
     * Draws a random ellipse on the provided context.
     * The ellipse's center is chosen from a donut-shaped region (using donutInnerRadius and donutOuterRadius)
     * around the canvas center. Its base size is between minEllipseSize and maxEllipseSize, and its
     * deviation from a perfect circle is controlled by ellipseDeviationFactor.
     */
    function drawRandomEllipse(ctx, width, height, palette) {
        // Calculate the center of the canvas.
        const canvasCenterX = width / 2;
        const canvasCenterY = height / 2;

        // Choose a random offset within the donut-shaped region.
        // That is, choose a radius between donutInnerRadius and donutOuterRadius.
        const offsetRadius = donutInnerRadius + Math.random() * (donutOuterRadius - donutInnerRadius);
        const angle = Math.random() * 2 * Math.PI;
        const centerX = canvasCenterX + offsetRadius * Math.cos(angle);
        const centerY = canvasCenterY + offsetRadius * Math.sin(angle);

        // Choose a base size for the ellipse between minEllipseSize and maxEllipseSize.
        const baseSize = minEllipseSize + Math.random() * (maxEllipseSize - minEllipseSize);
        // Apply a deviation factor: if ellipseDeviationFactor is 0, ellipse remains a circle.
        const deviation = (Math.random() * 2 - 1) * ellipseDeviationFactor * baseSize;
        const radiusX = baseSize;
        const radiusY = baseSize + deviation;

        ctx.beginPath();
        ctx.ellipse(centerX, centerY, radiusX, radiusY, 0, 0, 2 * Math.PI);
        // Choose a random color from the palette for the ellipse.
        ctx.fillStyle = randomColorFromPalette(palette);
        ctx.fill();
    }

    /**
     * Enhance the contrast of the provided ImageData.
     * For each pixel channel, applies:
     *    newValue = factor * (oldValue - 128) + 128
     * and clamps the result to [0, 255].
     * @param {ImageData} imageData
     * @param {number} factor
     * @returns {ImageData}
     */
    function enhanceContrast(imageData, factor) {
        const data = imageData.data;
        for (let i = 0; i < data.length; i += 4) {
            // Process R, G, and B channels
            for (let c = 0; c < 3; c++) {
                let newVal = factor * (data[i + c] - 128) + 128;
                data[i + c] = Math.max(0, Math.min(255, newVal));
            }
        }
        return imageData;
    }

    /**
     * Returns a random color from the provided palette array.
     */
    function randomColorFromPalette(palette) {
        const index = Math.floor(Math.random() * palette.length);
        return palette[index];
    }
});
