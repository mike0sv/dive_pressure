class Segment {
    constructor(name, initialVolume, compressible) {
        this.name = name;
        this.initialVolume = initialVolume;
        this.compressible = compressible;
        this.connections = new Set();
    }

    connect(other) {
        this.connections.add(other);
        other.connections.add(this);
    }
}

class Checkpoint {
    constructor(volumes, pressure, model) {
        this.volumes = volumes;
        this.pressure = pressure;
        this.model = model;
    }

    pprint() {
        const canvas = document.getElementById('pressureCanvas');
        const ctx = canvas.getContext('2d');

        ctx.clearRect(0, 0, canvas.width, canvas.height);

        const entries = Object.entries(this.volumes).sort(([a], [b]) => a.localeCompare(b));
        const centerX = canvas.width / 2;
        
        // Special positioning for each segment in a more vertical layout
        const positions = {
            "lungs": { 
                x: centerX, 
                y: canvas.height - 200  // Moved up (was -100)
            },
            "nasopharynx": { 
                x: centerX, 
                y: canvas.height - 400  // Unchanged
            },
            "sinuses": { 
                x: centerX, 
                y: canvas.height - 500  // Unchanged
            },
            "middle_ear": { 
                x: centerX + 150,  // Unchanged
                y: canvas.height - 450  // Unchanged
            }
        };

        // Calculate circles (rest of the code remains the same)
        const circles = {};
        entries.forEach(([name, volume]) => {
            circles[name] = {
                x: positions[name].x,
                y: positions[name].y,
                radius: Math.sqrt(volume / Math.PI) * 2
            };
        });

        // Draw connection lines first
        ctx.beginPath();
        ctx.strokeStyle = '#999';
        ctx.lineWidth = 2;
        this.model.segments.forEach(segment => {
            segment.connections.forEach(connectedSegment => {
                if (segment.name < connectedSegment.name) {
                    const from = circles[segment.name];
                    const to = circles[connectedSegment.name];
                    ctx.moveTo(from.x, from.y);
                    ctx.lineTo(to.x, to.y);
                }
            });
        });
        ctx.stroke();

        // Then draw circles on top
        entries.forEach(([name, volume]) => {
            const {x, y, radius} = circles[name];

            // Draw circle
            ctx.beginPath();
            ctx.arc(x, y, radius, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(255, 0, 0, 0.5)';
            ctx.fill();
            ctx.strokeStyle = 'red';
            ctx.lineWidth = 1;
            ctx.stroke();

            // Add labels
            ctx.fillStyle = 'black';
            ctx.font = '14px Arial';
            ctx.textAlign = 'center';
            ctx.fillText(name, x, y - radius - 10);
            ctx.fillText(`${volume.toFixed(1)}`, x, y + radius + 20);
        });

        // Add pressure and volume labels at the top
        ctx.font = 'bold 16px Arial';
        ctx.textAlign = 'left';
        const totalVolume = Object.values(this.volumes).reduce((a, b) => a + b, 0);
        ctx.fillText(`Total Volume: ${totalVolume.toFixed(1)} ml`, 20, 30);
        ctx.textAlign = 'right';
        ctx.fillText(`Pressure: ${this.pressure.toFixed(2)} atm`, canvas.width - 20, 30);
    }
}

class Model {
    constructor(segments) {
        this.segments = segments;
    }

    getInitialCheckpoint() {
        const volumes = {};
        this.segments.forEach(s => volumes[s.name] = s.initialVolume);
        return new Checkpoint(volumes, 1, this);
    }

    getVolumesAtPressure(pressure, checkpoint = null) {
        if (checkpoint === null) {
            checkpoint = this.getInitialCheckpoint();
        }

        const totalVolume = Object.values(checkpoint.volumes).reduce((a, b) => a + b, 0);
        const compressionRate = pressure / checkpoint.pressure;
        const newVolume = totalVolume / compressionRate;
        let volumeLeft = newVolume;
        const result = {};

        // Handle incompressible segments first
        this.segments.forEach(segment => {
            if (!segment.compressible) {
                result[segment.name] = segment.initialVolume;
                volumeLeft -= segment.initialVolume;
            }
        });

        // Calculate total compressible volume
        const totalCompressableVolume = this.segments
            .filter(s => s.compressible)
            .reduce((sum, s) => sum + s.initialVolume, 0);

        // Handle compressible segments
        this.segments.forEach(segment => {
            if (segment.compressible) {
                result[segment.name] = volumeLeft * segment.initialVolume / totalCompressableVolume;
            }
        });

        return new Checkpoint(result, pressure, this);
    }
}

function main() {
    // Function to get initial volumes from URL or use defaults
    function getInitialVolumes() {
        const urlParams = new URLSearchParams(window.location.search);
        return {
            lungs: Number(urlParams.get('lungs')) || 5000,
            nasopharynx: Number(urlParams.get('nasopharynx')) || 250,
            sinuses: Number(urlParams.get('sinuses')) || 90,
            middle_ear: Number(urlParams.get('middle_ear')) || 1
        };
    }

    // Store initialVolumes in window
    window.initialVolumes = getInitialVolumes();

    // Initialize the model first
    function initializeModel() {
        const segments = {
            lungs: new Segment("lungs", window.initialVolumes.lungs, true),
            nasopharynx: new Segment("nasopharynx", window.initialVolumes.nasopharynx, true),
            sinuses: new Segment("sinuses", window.initialVolumes.sinuses, false),
            middle_ear: new Segment("middle_ear", window.initialVolumes.middle_ear, false)
        };

        segments.lungs.connect(segments.nasopharynx);
        segments.nasopharynx.connect(segments.sinuses);
        segments.nasopharynx.connect(segments.middle_ear);

        window.currentModel = new Model(Object.values(segments));
    }

    // Initialize model before defining functions
    initializeModel();

    // Define updatePressure first
    window.updatePressure = function(pressure) {
        const checkpoint = window.currentModel.getVolumesAtPressure(Number(pressure));
        checkpoint.pprint();
        updateTotalVolumeDisplays(checkpoint);
    };

    // Define updateTotalVolumeDisplays
    function updateTotalVolumeDisplays(checkpoint) {
        // Calculate initial total
        const initialTotal = Object.values(window.initialVolumes)
            .reduce((sum, vol) => sum + vol, 0);
        
        // Calculate current total
        const currentTotal = Object.values(checkpoint.volumes)
            .reduce((sum, vol) => sum + vol, 0);

        // Update the display elements if they exist
        const initialElement = document.getElementById('initialTotalVolumeValue');
        const currentElement = document.getElementById('totalVolumeValue');
        
        if (initialElement) {
            initialElement.textContent = initialTotal.toFixed(1);
        }
        if (currentElement) {
            currentElement.textContent = currentTotal.toFixed(1);
        }
    }

    // Simulation variables
    let isPlaying = false;
    let simulationSpeed = 1;
    let lastTimestamp = null;
    let animationFrameId = null;
    let currentDepth = 0;

    window.updateFromDepth = function(depth) {
        depth = Math.min(190, Math.max(0, Number(depth)));
        currentDepth = depth; // Update the tracked depth
        const pressure = 1 + (depth / 10);
        
        // Update UI elements
        const depthSlider = document.getElementById('depthSlider');
        const depthValue = document.getElementById('depthValue');
        const pressureValue = document.getElementById('pressureValue');
        
        if (depthSlider) depthSlider.value = depth;
        if (depthValue) depthValue.value = depth.toFixed(1);
        if (pressureValue) pressureValue.value = pressure.toFixed(2);
        
        window.updatePressure(pressure);
    };

    // Animation function
    function animate(timestamp) {
        if (!isPlaying) return;

        if (lastTimestamp === null) {
            lastTimestamp = timestamp;
        }

        const deltaTime = (timestamp - lastTimestamp) / 1000;
        currentDepth += simulationSpeed * deltaTime;
        
        if (currentDepth >= 190) {
            currentDepth = 190;
            window.togglePlay();
        }
        
        window.updateFromDepth(currentDepth);
        
        lastTimestamp = timestamp;
        if (isPlaying) {
            animationFrameId = requestAnimationFrame(animate);
        }
    }

    window.togglePlay = function() {
        isPlaying = !isPlaying;
        const playButton = document.getElementById('playButton');
        
        if (isPlaying) {
            // Start animation
            playButton.textContent = 'Pause';
            playButton.classList.add('playing');
            lastTimestamp = null;
            animationFrameId = requestAnimationFrame(animate);
        } else {
            // Stop animation
            playButton.textContent = 'Play';
            playButton.classList.remove('playing');
            if (animationFrameId) {
                cancelAnimationFrame(animationFrameId);
                animationFrameId = null;
            }
        }
    };

    window.resetSimulation = function() {
        // Stop simulation if playing
        if (isPlaying) {
            window.togglePlay();
        }
        // Reset depth to 0
        currentDepth = 0;
        window.updateFromDepth(0);
        lastTimestamp = null;
    };

    window.updateSpeed = function(speed) {
        simulationSpeed = Math.max(0.1, Math.min(10, Number(speed)));
        document.getElementById('speedInput').value = simulationSpeed;
    };

    window.updateFromManualDepth = function(depth) {
        if (!isPlaying) {  // Only allow manual updates when not playing
            window.updateFromDepth(depth);
        }
    };

    // Initialize
    window.updateSpeed(1);
    window.updateFromDepth(0);
}

// Make sure main runs after DOM is loaded
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', main);
} else {
    main();
}
