document.addEventListener("DOMContentLoaded", () => {
    // Final (visible) canvas dimensions
    const finalWidth = 512;
    const finalHeight = 512;

    // Variable blur radius parameters
    const minBlurRadius = 2;
    const maxBlurRadius = 80;

    // Contrast factor (1.0 = no change, >1.0 increases contrast)
    const contrastFactor = 1.1;
    // Hidden canvas dimensions (providing a buffer for the blur)
    const hiddenWidth = finalWidth + 2 * maxBlurRadius;
    const hiddenHeight = finalHeight + 2 * maxBlurRadius;

    // Global ellipse parameters:
    const minEllipseSize = 160 * 2;         // Minimum base size (in pixels)
    const maxEllipseSize = 200 * 2;        // Maximum base size (in pixels)
    // Donut parameters: ellipse center will be between these radii from canvas center.
    const donutInnerRadius = 150 * 2;       // Minimum offset from the center (in pixels)
    const donutOuterRadius = 210 * 2;       // Maximum offset from the center (in pixels)
    const ellipseDeviationFactor = 0.3; // 0 = perfect circle; higher values allow more deviation

    // Second (lighter) blur radius parameters for reblurring after dithering
    const secondMinBlurRadius = 2;
    const secondMaxBlurRadius = 6;

    // Number of shades per channel for dithering
    const ditherShades = 80;

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
        // "#d3dbd8",
        // "#a0bdca",
        // "#65948b",
        // "#365b67",
        // "#303a47",
        // "#384e53",
        // "#2a3639",
        // "#080c10",
        "#0A1318",
        "#D2DCDB",
        "#D2DCDB",
        "#9DBCB7",

    ];

    // Convert palette to a sorted palette (by brightness)
    const sortedPalette = getSortedPalette(colorPalette);

    // Store the first ellipse properties for reference when drawing the second one
    let firstEllipseProps = {
        centerX: 0,
        centerY: 0,
        radiusX: 0,
        radiusY: 0
    };

    generateBtn.addEventListener("click", () => {
        // 1) Generate the image on the hidden canvas.
        // Use our refined gradient colors.
        generateLimitedPaletteImageFull(ctxHidden, hiddenWidth, hiddenHeight, sortedPalette);

        // 2) Get the hidden canvas image data and apply our variable box blur.
        const hiddenImageData = ctxHidden.getImageData(0, 0, hiddenWidth, hiddenHeight);
        const blurredImageData = variableBoxBlurImageData(hiddenImageData, minBlurRadius, maxBlurRadius);
        tempCtx.putImageData(blurredImageData, 0, 0);

        // 3) Crop the central region from the blurred temp canvas to the final canvas.
        ctxFinal.clearRect(0, 0, finalWidth, finalHeight);
        ctxFinal.drawImage(
            tempCanvas,
            maxBlurRadius,   // source x offset (use max to ensure buffer is sufficient)
            maxBlurRadius,   // source y offset
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

        // 6) Reblur the dithered image with a variable smaller blur radius.
        imageData = ctxFinal.getImageData(0, 0, finalWidth, finalHeight);
        const reblurredData = variableBoxBlurImageData(imageData, secondMinBlurRadius, secondMaxBlurRadius);
        ctxFinal.putImageData(reblurredData, 0, 0);

        // 7) Apply noise as a final step
        applyNoise(ctxFinal, finalWidth, finalHeight);
    });

    downloadBtn.addEventListener("click", () => {
        const dataURL = finalCanvas.toDataURL("image/png");
        const link = document.createElement("a");
        link.href = dataURL;
        link.download = "variable_blurred_image.png";
        link.click();
    });

    /**
     * Applies a variable box blur on the given ImageData where some regions are sharper and others more blurry.
     * The blur radius varies based on a noise function to create an interesting organic effect.
     */
    function variableBoxBlurImageData(imageData, minRadius, maxRadius) {
        const {data, width, height} = imageData;
        const tempData = new Uint8ClampedArray(data.length);
        const outputData = new Uint8ClampedArray(data.length);

        // Generate a blur map that determines blur intensity for each pixel
        const blurMap = generateBlurMap(width, height, minRadius, maxRadius);

        // Horizontal pass with variable radius
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const pixelRadius = blurMap[y * width + x];
                let r = 0, g = 0, b = 0, a = 0, count = 0;

                for (let dx = -pixelRadius; dx <= pixelRadius; dx++) {
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

        // Vertical pass with variable radius
        for (let x = 0; x < width; x++) {
            for (let y = 0; y < height; y++) {
                const pixelRadius = blurMap[y * width + x];
                let r = 0, g = 0, b = 0, a = 0, count = 0;

                for (let dy = -pixelRadius; dy <= pixelRadius; dy++) {
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
     * Generates a blur map (an array of blur radii) for each pixel in the image.
     * Uses Perlin-like noise to create natural-looking variation in blur intensity.
     */
    function generateBlurMap(width, height, minRadius, maxRadius) {
        const map = new Array(width * height);
        const scale = 0.01; // Controls the "frequency" of the noise

        // Using a simplified noise approach for variation
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                // Create some noise using sine functions at different frequencies
                const noise =
                    Math.sin(x * scale * 0.5) * Math.cos(y * scale * 0.7) +
                    Math.sin(x * scale * 1.3) * Math.cos(y * scale * 1.1) +
                    Math.sin(x * scale * 2.3 + y * scale * 1.5);

                // Convert noise (-3 to 3) to a value between 0 and 1
                const normalizedNoise = (noise + 3) / 6;

                // Map the noise to our desired radius range
                const radius = Math.floor(minRadius + normalizedNoise * (maxRadius - minRadius));

                // Store the radius in our map
                map[y * width + x] = radius;
            }
        }

        return map;
    }

    /**
     * Generates an image on the entire hidden canvas using a limited palette.
     * It fills the canvas with a gradient background and draws two ellipses.
     * For the gradient background, two similar (adjacent) colors are chosen.
     * For the ellipses, contrasting colors are used (from the opposite end of the brightness spectrum).
     */
    function generateLimitedPaletteImageFull(ctx, width, height, sortedPalette) {
        ctx.clearRect(0, 0, width, height);
        // Choose two adjacent colors for the gradient.
        const gradientColors = getGradientColors(sortedPalette);
        const grad = ctx.createLinearGradient(0, 0, width, height);
        grad.addColorStop(0, gradientColors[0]);
        grad.addColorStop(1, gradientColors[1]);
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, width, height);

        // Determine the average brightness of the gradient.
        const avgBrightness = (getBrightness(gradientColors[0]) + getBrightness(gradientColors[1])) / 2;

        // Draw first ellipse with gradient fill using contrasting colors.
        firstEllipseProps = drawRandomEllipse(ctx, width, height, sortedPalette, true, avgBrightness);

        // Draw second ellipse with flat contrasting color and origin inside the first ellipse.
        drawSecondEllipseInsideFirst(ctx, sortedPalette, avgBrightness, firstEllipseProps);
    }

    /**
     * Draws a random ellipse on the provided context.
     * The ellipse's center is chosen from a donut-shaped region around the canvas center.
     * If useGradient is true, the ellipse is filled with a radial gradient;
     * otherwise, it is filled with a flat contrasting color.
     * The contrast is determined by the gradient's average brightness.
     * Returns the properties of the drawn ellipse.
     */
    function drawRandomEllipse(ctx, width, height, sortedPalette, useGradient, gradientBrightness) {
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
            // For gradient fill, choose contrasting colors.
            const contrastColors = getContrastingColors(sortedPalette, gradientBrightness);
            const outerRadius = (radiusX + radiusY) / 2;
            const radialGrad = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, outerRadius);
            radialGrad.addColorStop(0, contrastColors[0]);
            radialGrad.addColorStop(1, contrastColors[1]);
            ctx.fillStyle = radialGrad;
        } else {
            // For flat fill, choose a contrasting color.
            const contrastColors = getContrastingColors(sortedPalette, gradientBrightness);
            ctx.fillStyle = contrastColors[0];
        }
        ctx.fill();

        // Return properties of this ellipse
        return {
            centerX,
            centerY,
            radiusX,
            radiusY
        };
    }

    /**
     * Draws the second ellipse with its origin (center) inside the first ellipse.
     */
    function drawSecondEllipseInsideFirst(ctx, sortedPalette, gradientBrightness, firstEllipse) {
        // Calculate a random point inside the first ellipse
        // For an ellipse, we need to use a special approach to ensure the point is uniformly distributed

        // Step 1: Generate a random angle
        const angle = Math.random() * 2 * Math.PI;

        // Step 2: Generate a random radius factor (less than 1 to ensure it's inside)
        // Using square root for uniform distribution within the ellipse
        const radiusFactor = Math.sqrt(Math.random()) * 0.8; // 0.8 to keep it visibly inside

        // Step 3: Calculate the point inside the ellipse
        const centerX = firstEllipse.centerX + radiusFactor * firstEllipse.radiusX * Math.cos(angle);
        const centerY = firstEllipse.centerY + radiusFactor * firstEllipse.radiusY * Math.sin(angle);

        // Step 4: Ensure the second ellipse is smaller than the first
        const maxSecondSize = Math.min(firstEllipse.radiusX, firstEllipse.radiusY) * 0.6;
        const baseSize = maxSecondSize * (0.4 + Math.random() * 0.6); // Between 40-100% of maxSecondSize
        const deviation = (Math.random() * 2 - 1) * ellipseDeviationFactor * baseSize;
        const radiusX = baseSize;
        const radiusY = baseSize + deviation;

        ctx.beginPath();
        ctx.ellipse(centerX, centerY, radiusX, radiusY, 0, 0, 2 * Math.PI);

        // Choose a contrasting color for the second ellipse
        const contrastColors = getContrastingColors(sortedPalette, gradientBrightness);
        ctx.fillStyle = contrastColors[0];
        ctx.fill();
    }

    /**
     * Enhances contrast of the provided ImageData.
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
     * Applies Floyd–Steinberg dithering to the provided ImageData while preserving colors.
     */
    function floydSteinbergDitherImageData(imageData, shades) {
        const {width, height} = imageData;
        const data = new Float32Array(imageData.data);
        const step = 4000 / (shades - 1);

        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const index = (y * width + x) * 4;
                for (let c = 0; c < 3; c++) {
                    const oldVal = data[index + c];
                    const newVal = Math.round(oldVal / step) * step;
                    data[index + c] = newVal;
                    const error = oldVal - newVal;

                    if (x + 1 < width) {
                        data[index + 4 + c] += error * (7 / 16);
                    }
                    if (x - 1 >= 0 && y + 1 < height) {
                        data[index - 4 + width * 4 + c] += error * (3 / 16);
                    }
                    if (y + 1 < height) {
                        data[index + width * 4 + c] += error * (5 / 16);
                    }
                    if (x + 1 < width && y + 1 < height) {
                        data[index + 4 + width * 4 + c] += error * (1 / 16);
                    }
                }
            }
        }
        const output = new Uint8ClampedArray(data.length);
        for (let i = 0; i < data.length; i++) {
            output[i] = Math.max(0, Math.min(255, data[i]));
        }
        return new ImageData(output, width, height);
    }

    /**
     * Applies noise as the final step to the image for a grainy texture effect.
     * Inspired by SVG turbulence filters but implemented directly with canvas.
     */
    function applyNoise(ctx, width, height, noiseOpacity = 0.1, noiseScale = 12) {
        // Create a temporary canvas for the noise
        const noiseCanvas = document.createElement('canvas');
        noiseCanvas.width = width;
        noiseCanvas.height = height;
        const noiseCtx = noiseCanvas.getContext('2d');

        // Generate a noise pattern
        const noiseData = noiseCtx.createImageData(width, height);
        const data = noiseData.data;

        // Create Perlin-like noise
        for (let i = 0; i < data.length; i += 4) {
            // Generate random RGB values with a fine-grain texture
            // We use Perlin-like noise by combining multiple frequencies
            const x = (i / 4) % width;
            const y = Math.floor((i / 4) / width);

            // Create more organic looking noise with some structure
            const baseVal = Math.random() * 255;
            // Add some variation with sine functions at different frequencies
            const noise =
                Math.sin(x * 0.07) * Math.cos(y * 0.05) * 15 +
                Math.sin(x * 0.15) * Math.cos(y * 0.12) * 10 +
                (Math.random() - 0.5) * 255 * noiseScale;

            const noiseVal = Math.floor(baseVal + noise);

            // Keep RGB values the same for a grayscale effect
            data[i] = noiseVal;     // Red
            data[i + 1] = noiseVal; // Green
            data[i + 2] = noiseVal; // Blue

            // Set alpha for the noise intensity
            data[i + 3] = 255;
        }

        // Apply the noise to the noise canvas
        noiseCtx.putImageData(noiseData, 0, 0);

        // Get the original image from the final canvas
        const originalImageData = ctx.getImageData(0, 0, width, height);
        const originalData = originalImageData.data;

        // Blend the noise with the original image
        for (let i = 0; i < originalData.length; i += 4) {
            // Get noise pixel value (grayscale, so just use R channel)
            const noiseVal = data[i];

            // Blend noise with the original image
            // Using screen blend mode for lighter noise on darker areas
            for (let c = 0; c < 3; c++) {
                // Apply noise with controlled opacity
                originalData[i + c] = Math.min(255,
                    originalData[i + c] + (noiseVal - 128) * noiseOpacity);
            }
        }

        // Apply the final blended image back to the canvas
        ctx.putImageData(originalImageData, 0, 0);
    }

    // --- Helper functions for refined color selection ---

    /**
     * Converts a hex color string to an RGB object.
     */
    function hexToRGB(hex) {
        // Remove the leading '#' if present.
        hex = hex.replace(/^#/, '');
        if (hex.length === 3) {
            hex = hex.split('').map(c => c + c).join('');
        }
        const num = parseInt(hex, 16);
        return {
            r: (num >> 16) & 255,
            g: (num >> 8) & 255,
            b: num & 255
        };
    }

    /**
     * Calculates the brightness of a hex color.
     * Uses the luminance formula.
     */
    function getBrightness(hex) {
        const {r, g, b} = hexToRGB(hex);
        // Standard luminance formula.
        return 0.299 * r + 0.587 * g + 0.114 * b;
    }

    /**
     * Returns a sorted copy of the palette based on brightness (ascending).
     */
    function getSortedPalette(palette) {
        return palette.slice().sort((a, b) => getBrightness(a) - getBrightness(b));
    }

    /**
     * Returns two adjacent colors from the sorted palette as gradient colors.
     */
    function getGradientColors(sortedPalette) {
        // Ensure we have at least 2 colors.
        if (sortedPalette.length < 2) return [sortedPalette[0], sortedPalette[0]];
        // Choose a random index between 0 and length-2.
        const index = Math.floor(Math.random() * (sortedPalette.length - 1));
        return [sortedPalette[index], sortedPalette[index + 1]];
    }

    /**
     * Returns one or two contrasting colors from the sorted palette.
     * If the average brightness of the gradient is below 128 (darker),
     * choose from the brighter half; otherwise, choose from the darker half.
     * Returns an array of one or two colors.
     */
    function getContrastingColors(sortedPalette, gradientBrightness) {
        const mid = sortedPalette.length / 2;
        let candidatePalette;
        if (gradientBrightness < 128) {
            // Background is dark; choose brighter colors.
            candidatePalette = sortedPalette.slice(Math.floor(mid));
        } else {
            // Background is light; choose darker colors.
            candidatePalette = sortedPalette.slice(0, Math.floor(mid));
        }
        // Return one or two colors randomly.
        const color1 = candidatePalette[Math.floor(Math.random() * candidatePalette.length)];
        const color2 = candidatePalette[Math.floor(Math.random() * candidatePalette.length)];
        return [color1, color2];
    }
});