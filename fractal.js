class FractalGenerator {
    constructor() {
        this.canvas = document.getElementById('fractalCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.loading = document.getElementById('loading');

        // Viewport settings
        this.resetViewport();

        // Settings
        this.baseIterations = 100;
        this.maxIterations = 100;
        this.fractalType = 'mandelbrot';
        this.colorScheme = 'classic';
        this.smoothColoring = true;
        this.juliaC = { real: -0.7, imag: 0.27 };

        // Mouse interaction
        this.isDragging = false;
        this.isSelecting = false;
        this.dragStart = { x: 0, y: 0 };
        this.dragEnd = { x: 0, y: 0 };
        this.currentImageData = null;

        // Rendering control
        this.renderingId = 0;

        // Letterboxing parameters
        this.renderWidth = 0;
        this.renderHeight = 0;
        this.offsetX = 0;
        this.offsetY = 0;

        this.setupCanvas();
        this.setupEventListeners();
        this.render();
    }

    resetViewport() {
        this.centerX = -0.5;
        this.centerY = 0;
        this.rangeX = 3.5;
        this.rangeY = 2;
        this.initialRangeX = 3.5;
    }

    setupCanvas() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
    }

    setupEventListeners() {
        // Window resize
        window.addEventListener('resize', () => {
            this.setupCanvas();
            this.render();
        });

        // Mouse controls
        this.canvas.addEventListener('mousedown', (e) => this.handleMouseDown(e));
        this.canvas.addEventListener('mousemove', (e) => this.handleMouseMove(e));
        this.canvas.addEventListener('mouseup', (e) => this.handleMouseUp(e));
        this.canvas.addEventListener('mouseleave', () => this.handleMouseUp());
        this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());

        // Touch controls
        this.canvas.addEventListener('touchstart', (e) => this.handleTouchStart(e));
        this.canvas.addEventListener('touchmove', (e) => this.handleTouchMove(e));
        this.canvas.addEventListener('touchend', (e) => this.handleMouseUp(e));

        // Menu toggle
        document.getElementById('menuToggle').addEventListener('click', () => {
            document.getElementById('controls').classList.toggle('hidden');
        });

        // UI Controls - all changes trigger immediate re-render
        document.getElementById('fractalType').addEventListener('change', (e) => {
            this.fractalType = e.target.value;
            document.getElementById('juliaControls').style.display =
                this.fractalType === 'julia' ? 'block' : 'none';
            this.render();
        });

        document.getElementById('maxIterations').addEventListener('input', (e) => {
            this.baseIterations = parseInt(e.target.value);
            document.getElementById('iterValue').textContent = e.target.value;
            this.render();
        });

        document.getElementById('colorScheme').addEventListener('change', (e) => {
            this.colorScheme = e.target.value;
            this.render();
        });

        document.getElementById('smoothColoring').addEventListener('change', (e) => {
            this.smoothColoring = e.target.checked;
            this.render();
        });

        document.getElementById('juliaReal').addEventListener('input', (e) => {
            this.juliaC.real = parseFloat(e.target.value);
            document.getElementById('juliaRealValue').textContent = e.target.value;
            this.render();
        });

        document.getElementById('juliaImag').addEventListener('input', (e) => {
            this.juliaC.imag = parseFloat(e.target.value);
            document.getElementById('juliaImagValue').textContent = e.target.value;
            this.render();
        });

        document.getElementById('resetBtn').addEventListener('click', () => {
            this.resetViewport();
            this.render();
        });
    }

    handleMouseDown(e) {
        e.preventDefault();
        const rect = this.canvas.getBoundingClientRect();
        this.dragStart = { x: e.clientX - rect.left, y: e.clientY - rect.top };
        this.dragEnd = { ...this.dragStart };

        // Only left button - select area for zoom
        if (e.button === 0) {
            this.isSelecting = true;
            this.isDragging = true;
            this.canvas.style.cursor = 'crosshair';
        }
    }

    handleMouseMove(e) {
        if (!this.isDragging || !this.isSelecting) return;

        const rect = this.canvas.getBoundingClientRect();
        const currentX = e.clientX - rect.left;
        const currentY = e.clientY - rect.top;

        // Draw selection rectangle
        this.dragEnd = { x: currentX, y: currentY };
        this.drawSelectionRect();
    }

    handleMouseUp(e) {
        if (this.isSelecting && this.isDragging) {
            const width = Math.abs(this.dragEnd.x - this.dragStart.x);
            const height = Math.abs(this.dragEnd.y - this.dragStart.y);

            // Only zoom if selection is large enough (avoid accidental clicks)
            if (width > 10 && height > 10) {
                this.zoomToSelection();
            }
        }

        this.isDragging = false;
        this.isSelecting = false;
        this.canvas.style.cursor = 'crosshair';
    }

    drawSelectionRect() {
        if (!this.currentImageData) return;

        // Restore the original image
        this.ctx.putImageData(this.currentImageData, 0, 0);

        // Calculate rectangle with correct aspect ratio
        const canvasAspect = this.canvas.width / this.canvas.height;
        const dx = this.dragEnd.x - this.dragStart.x;
        const dy = this.dragEnd.y - this.dragStart.y;

        let width = Math.abs(dx);
        let height = Math.abs(dy);

        // Adjust to match canvas aspect ratio
        if (width / height > canvasAspect) {
            // Width is limiting factor
            height = width / canvasAspect;
        } else {
            // Height is limiting factor
            width = height * canvasAspect;
        }

        // Calculate position maintaining the drag direction
        let x1, y1;
        if (dx >= 0 && dy >= 0) {
            // Dragging down-right
            x1 = this.dragStart.x;
            y1 = this.dragStart.y;
        } else if (dx >= 0 && dy < 0) {
            // Dragging up-right
            x1 = this.dragStart.x;
            y1 = this.dragStart.y - height;
        } else if (dx < 0 && dy >= 0) {
            // Dragging down-left
            x1 = this.dragStart.x - width;
            y1 = this.dragStart.y;
        } else {
            // Dragging up-left
            x1 = this.dragStart.x - width;
            y1 = this.dragStart.y - height;
        }

        // Update dragEnd to match the corrected rectangle
        this.dragEnd.x = x1 + (dx >= 0 ? width : 0);
        this.dragEnd.y = y1 + (dy >= 0 ? height : 0);
        if (dx < 0) this.dragEnd.x = x1;
        if (dy < 0) this.dragEnd.y = y1;

        this.ctx.strokeStyle = '#4CAF50';
        this.ctx.lineWidth = 2;
        this.ctx.setLineDash([5, 5]);
        this.ctx.strokeRect(x1, y1, width, height);

        // Semi-transparent fill
        this.ctx.fillStyle = 'rgba(76, 175, 80, 0.1)';
        this.ctx.fillRect(x1, y1, width, height);
        this.ctx.setLineDash([]);
    }

    zoomToSelection() {
        const x1 = Math.min(this.dragStart.x, this.dragEnd.x);
        const y1 = Math.min(this.dragStart.y, this.dragEnd.y);
        const x2 = Math.max(this.dragStart.x, this.dragEnd.x);
        const y2 = Math.max(this.dragStart.y, this.dragEnd.y);

        // Adjust for letterboxing offset
        const relX1 = x1 - this.offsetX;
        const relY1 = y1 - this.offsetY;
        const relX2 = x2 - this.offsetX;
        const relY2 = y2 - this.offsetY;

        // Clamp to render area
        const clampedX1 = Math.max(0, Math.min(this.renderWidth, relX1));
        const clampedY1 = Math.max(0, Math.min(this.renderHeight, relY1));
        const clampedX2 = Math.max(0, Math.min(this.renderWidth, relX2));
        const clampedY2 = Math.max(0, Math.min(this.renderHeight, relY2));

        // Convert pixel coordinates to complex plane coordinates
        const minReal = this.centerX + (clampedX1 / this.renderWidth - 0.5) * this.rangeX;
        const maxReal = this.centerX + (clampedX2 / this.renderWidth - 0.5) * this.rangeX;
        const minImag = this.centerY + (clampedY1 / this.renderHeight - 0.5) * this.rangeY;
        const maxImag = this.centerY + (clampedY2 / this.renderHeight - 0.5) * this.rangeY;

        // Update viewport - simply set to the selected area
        this.centerX = (minReal + maxReal) / 2;
        this.centerY = (minImag + maxImag) / 2;
        this.rangeX = maxReal - minReal;
        this.rangeY = maxImag - minImag;

        this.render();
    }

    handleTouchStart(e) {
        e.preventDefault();
        const touch = e.touches[0];
        this.handleMouseDown({
            clientX: touch.clientX,
            clientY: touch.clientY,
            button: 0,
            preventDefault: () => {}
        });
    }

    handleTouchMove(e) {
        e.preventDefault();
        const touch = e.touches[0];
        this.handleMouseMove({
            clientX: touch.clientX,
            clientY: touch.clientY
        });
    }

    // Fractal calculation functions - return smooth iteration value
    calculateMandelbrot(x0, y0) {
        let x = 0, y = 0;
        let iteration = 0;

        while (x*x + y*y <= 4 && iteration < this.maxIterations) {
            const xtemp = x*x - y*y + x0;
            y = 2*x*y + y0;
            x = xtemp;
            iteration++;
        }

        if (iteration < this.maxIterations && this.smoothColoring) {
            const zn = x*x + y*y;
            const nu = Math.log(Math.log(zn) / Math.log(2)) / Math.log(2);
            return iteration + 1 - nu;
        }
        return iteration;
    }

    calculateJulia(x0, y0) {
        let x = x0, y = y0;
        let iteration = 0;

        while (x*x + y*y <= 4 && iteration < this.maxIterations) {
            const xtemp = x*x - y*y + this.juliaC.real;
            y = 2*x*y + this.juliaC.imag;
            x = xtemp;
            iteration++;
        }

        if (iteration < this.maxIterations && this.smoothColoring) {
            const zn = x*x + y*y;
            const nu = Math.log(Math.log(zn) / Math.log(2)) / Math.log(2);
            return iteration + 1 - nu;
        }
        return iteration;
    }

    calculateBurningShip(x0, y0) {
        let x = 0, y = 0;
        let iteration = 0;

        while (x*x + y*y <= 4 && iteration < this.maxIterations) {
            const xtemp = x*x - y*y + x0;
            y = Math.abs(2*x*y) + y0;
            x = Math.abs(xtemp);
            iteration++;
        }

        if (iteration < this.maxIterations && this.smoothColoring) {
            const zn = x*x + y*y;
            const nu = Math.log(Math.log(zn) / Math.log(2)) / Math.log(2);
            return iteration + 1 - nu;
        }
        return iteration;
    }

    calculateTricorn(x0, y0) {
        let x = 0, y = 0;
        let iteration = 0;

        while (x*x + y*y <= 4 && iteration < this.maxIterations) {
            const xtemp = x*x - y*y + x0;
            y = -2*x*y + y0; // Complex conjugate
            x = xtemp;
            iteration++;
        }

        if (iteration < this.maxIterations && this.smoothColoring) {
            const zn = x*x + y*y;
            const nu = Math.log(Math.log(zn) / Math.log(2)) / Math.log(2);
            return iteration + 1 - nu;
        }
        return iteration;
    }

    calculateMultibrot(x0, y0, power) {
        let x = 0, y = 0;
        let iteration = 0;

        while (x*x + y*y <= 4 && iteration < this.maxIterations) {
            const r = Math.sqrt(x*x + y*y);
            const theta = Math.atan2(y, x);
            const rPow = Math.pow(r, power);

            x = rPow * Math.cos(power * theta) + x0;
            y = rPow * Math.sin(power * theta) + y0;
            iteration++;
        }

        if (iteration < this.maxIterations && this.smoothColoring) {
            const zn = x*x + y*y;
            const nu = Math.log(Math.log(zn) / 2 / Math.log(2)) / Math.log(power);
            return iteration + 1 - nu;
        }
        return iteration;
    }

    calculatePhoenix(x0, y0) {
        let x = 0, y = 0;
        let xPrev = 0, yPrev = 0;
        let iteration = 0;
        const p = 0.5667;

        while (x*x + y*y <= 4 && iteration < this.maxIterations) {
            const xtemp = x*x - y*y + x0 + p * xPrev;
            const ytemp = 2*x*y + y0 + p * yPrev;
            xPrev = x;
            yPrev = y;
            x = xtemp;
            y = ytemp;
            iteration++;
        }

        if (iteration < this.maxIterations && this.smoothColoring) {
            const zn = x*x + y*y;
            const nu = Math.log(Math.log(zn) / Math.log(2)) / Math.log(2);
            return iteration + 1 - nu;
        }
        return iteration;
    }

    calculatePerpendicular(x0, y0) {
        let x = 0, y = 0;
        let iteration = 0;

        while (x*x + y*y <= 4 && iteration < this.maxIterations) {
            const xtemp = x*x - y*y + x0;
            y = 2 * Math.abs(x) * Math.abs(y) + y0;
            x = xtemp;
            iteration++;
        }

        if (iteration < this.maxIterations && this.smoothColoring) {
            const zn = x*x + y*y;
            const nu = Math.log(Math.log(zn) / Math.log(2)) / Math.log(2);
            return iteration + 1 - nu;
        }
        return iteration;
    }

    // Color schemes
    getColor(iteration) {
        if (Math.floor(iteration) >= this.maxIterations) {
            return [0, 0, 0];
        }

        const t = iteration / this.maxIterations;

        switch(this.colorScheme) {
            case 'classic':
                return [
                    Math.floor(9 * (1 - t) * t * t * t * 255),
                    Math.floor(15 * (1 - t) * (1 - t) * t * t * 255),
                    Math.floor(8.5 * (1 - t) * (1 - t) * (1 - t) * t * 255)
                ];

            case 'fire':
                return [
                    Math.floor(255 * Math.pow(t, 0.4)),
                    Math.floor(255 * Math.pow(t, 1.5)),
                    Math.floor(50 * Math.pow(t, 3))
                ];

            case 'ocean':
                return [
                    Math.floor(50 * t),
                    Math.floor(150 * Math.sqrt(t)),
                    Math.floor(255 * t)
                ];

            case 'rainbow':
                const hue = t * 360;
                return this.hslToRgb(hue, 100, 50);

            case 'sunset':
                return [
                    Math.floor(255 * Math.pow(t, 0.5)),
                    Math.floor(140 * t),
                    Math.floor(80 * Math.pow(1 - t, 2))
                ];

            case 'ice':
                return [
                    Math.floor(200 * t + 55 * (1 - t)),
                    Math.floor(230 * t + 25 * (1 - t)),
                    Math.floor(255 * Math.sqrt(t))
                ];

            case 'psychedelic':
                return [
                    Math.floor(128 + 127 * Math.sin(t * Math.PI * 4)),
                    Math.floor(128 + 127 * Math.sin(t * Math.PI * 4 + 2)),
                    Math.floor(128 + 127 * Math.sin(t * Math.PI * 4 + 4))
                ];

            case 'gold':
                return [
                    Math.floor(255 * Math.pow(t, 0.5)),
                    Math.floor(215 * Math.pow(t, 0.7)),
                    Math.floor(50 * t)
                ];

            case 'copper':
                return [
                    Math.floor(184 * Math.pow(t, 0.6)),
                    Math.floor(115 * Math.pow(t, 0.8)),
                    Math.floor(51 * t)
                ];

            case 'forest':
                return [
                    Math.floor(34 * t),
                    Math.floor(139 * Math.pow(t, 0.7)),
                    Math.floor(34 * Math.pow(t, 0.5))
                ];

            case 'grayscale':
                const gray = Math.floor(255 * t);
                return [gray, gray, gray];

            default:
                return [0, 0, 0];
        }
    }

    hslToRgb(h, s, l) {
        s /= 100;
        l /= 100;
        const k = n => (n + h / 30) % 12;
        const a = s * Math.min(l, 1 - l);
        const f = n => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
        return [
            Math.floor(255 * f(0)),
            Math.floor(255 * f(8)),
            Math.floor(255 * f(4))
        ];
    }

    // Rendering
    async render() {
        // Increment render ID to cancel any ongoing renders
        const currentRenderId = ++this.renderingId;

        this.loading.style.display = 'block';

        // Calculate effective zoom based on current range vs initial range
        const effectiveZoom = this.initialRangeX / this.rangeX;

        // Gradually increase iterations based on detail level, but more conservatively
        // Using square root to slow down the growth - provides good balance
        this.maxIterations = Math.floor(this.baseIterations * Math.sqrt(effectiveZoom));
        // Cap at reasonable maximum (high enough to prevent pixelation at deep zoom)
        this.maxIterations = Math.min(this.maxIterations, 5000);

        // Update info
        const startTime = performance.now();
        document.getElementById('coordsInfo').textContent =
            `Zoom: ${effectiveZoom.toFixed(1)}x | Center: (${this.centerX.toFixed(6)}, ${this.centerY.toFixed(6)}) | Iter: ${this.maxIterations}`;

        const imageData = this.ctx.createImageData(this.canvas.width, this.canvas.height);
        const data = imageData.data;

        // Calculate letterboxing to maintain aspect ratio
        const viewportAspect = this.rangeX / this.rangeY;
        const canvasAspect = this.canvas.width / this.canvas.height;

        if (canvasAspect > viewportAspect) {
            // Canvas is wider - add vertical black bars (left/right)
            this.renderHeight = this.canvas.height;
            this.renderWidth = Math.floor(this.renderHeight * viewportAspect);
            this.offsetX = Math.floor((this.canvas.width - this.renderWidth) / 2);
            this.offsetY = 0;
        } else {
            // Canvas is taller - add horizontal black bars (top/bottom)
            this.renderWidth = this.canvas.width;
            this.renderHeight = Math.floor(this.renderWidth / viewportAspect);
            this.offsetX = 0;
            this.offsetY = Math.floor((this.canvas.height - this.renderHeight) / 2);
        }

        // Fill entire canvas with black first
        for (let i = 0; i < data.length; i += 4) {
            data[i] = 0;     // R
            data[i + 1] = 0; // G
            data[i + 2] = 0; // B
            data[i + 3] = 255; // A
        }

        // Chunked calculation (but don't draw until complete)
        const chunkSize = 100; // Process 100 rows at a time

        for (let startRow = 0; startRow < this.renderHeight; startRow += chunkSize) {
            // Check if this render was cancelled
            if (currentRenderId !== this.renderingId) {
                return; // Abort this render
            }

            const endRow = Math.min(startRow + chunkSize, this.renderHeight);

            // Process chunk
            for (let row = startRow; row < endRow; row++) {
                for (let col = 0; col < this.renderWidth; col++) {
                    // Map to fractal coordinates
                    const x = this.centerX + (col / this.renderWidth - 0.5) * this.rangeX;
                    const y = this.centerY + (row / this.renderHeight - 0.5) * this.rangeY;

                    let iteration;
                    switch(this.fractalType) {
                        case 'mandelbrot':
                            iteration = this.calculateMandelbrot(x, y);
                            break;
                        case 'julia':
                            iteration = this.calculateJulia(x, y);
                            break;
                        case 'burningship':
                            iteration = this.calculateBurningShip(x, y);
                            break;
                        case 'tricorn':
                            iteration = this.calculateTricorn(x, y);
                            break;
                        case 'multibrot3':
                            iteration = this.calculateMultibrot(x, y, 3);
                            break;
                        case 'multibrot4':
                            iteration = this.calculateMultibrot(x, y, 4);
                            break;
                        case 'phoenix':
                            iteration = this.calculatePhoenix(x, y);
                            break;
                        case 'perpendicular':
                            iteration = this.calculatePerpendicular(x, y);
                            break;
                        default:
                            iteration = this.calculateMandelbrot(x, y);
                    }

                    const [r, g, b] = this.getColor(iteration);

                    // Map to canvas coordinates (with offset for letterboxing)
                    const canvasX = col + this.offsetX;
                    const canvasY = row + this.offsetY;
                    const index = (canvasY * this.canvas.width + canvasX) * 4;

                    data[index] = r;
                    data[index + 1] = g;
                    data[index + 2] = b;
                    data[index + 3] = 255;
                }
            }

            // Update progress (but don't draw yet)
            const progress = Math.floor((endRow / this.renderHeight) * 100);
            this.loading.textContent = `Generuji fraktál... ${progress}%`;

            // Yield to browser to keep UI responsive
            await new Promise(resolve => setTimeout(resolve, 0));
        }

        // Final check before drawing
        if (currentRenderId !== this.renderingId) {
            return; // Abort before drawing
        }

        // Draw complete result once
        this.ctx.putImageData(imageData, 0, 0);

        // Store current image for selection rectangle overlay
        this.currentImageData = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);

        const renderTime = ((performance.now() - startTime) / 1000).toFixed(2);
        document.getElementById('coordsInfo').textContent =
            `Zoom: ${effectiveZoom.toFixed(1)}x | Iter: ${this.maxIterations} | Čas: ${renderTime}s`;

        this.loading.style.display = 'none';
        this.loading.textContent = 'Generuji fraktál...';
    }
}

// Initialize the fractal generator when page loads
window.addEventListener('DOMContentLoaded', () => {
    new FractalGenerator();
});
