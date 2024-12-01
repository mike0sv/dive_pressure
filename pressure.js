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
    constructor(volumes, pressure) {
        this.volumes = volumes;
        this.pressure = pressure;
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
        currentModel.segments.forEach(segment => {
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
        return new Checkpoint(volumes, 1);
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

        return new Checkpoint(result, pressure);
    }
}

// Global variable to hold the model
let currentModel;

function updatePressure(pressure) {
    currentModel.getVolumesAtPressure(Number(pressure)).pprint();
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

    // Function to update URL with current volumes
    function updateURL(segments) {
        const params = new URLSearchParams();
        Object.entries(segments).forEach(([name, segment]) => {
            params.set(name, segment.initialVolume);
        });
        
        // Update URL without reloading the page
        const newURL = `${window.location.pathname}?${params.toString()}`;
        window.history.pushState({ path: newURL }, '', newURL);
    }

    // Initialize segments with values from URL or defaults
    const initialVolumes = getInitialVolumes();
    const segments = {
        lungs: new Segment("lungs", initialVolumes.lungs, true),
        nasopharynx: new Segment("nasopharynx", initialVolumes.nasopharynx, true),
        sinuses: new Segment("sinuses", initialVolumes.sinuses, false),
        middle_ear: new Segment("middle_ear", initialVolumes.middle_ear, false)
    };

    segments.lungs.connect(segments.nasopharynx);
    segments.nasopharynx.connect(segments.sinuses);
    segments.nasopharynx.connect(segments.middle_ear);

    currentModel = new Model(Object.values(segments));

    // Update initial volume inputs to match URL values
    Object.entries(initialVolumes).forEach(([name, volume]) => {
        const input = document.querySelector(`input[oninput*="${name}"]`);
        if (input) input.value = volume;
    });

    window.updateInitialVolume = function(segmentName, volume) {
        volume = Number(volume);
        if (isNaN(volume) || volume <= 0) return;
        
        segments[segmentName].initialVolume = volume;
        currentModel = new Model(Object.values(segments));
        
        // Update URL with new volumes
        updateURL(segments);
        
        // Get current pressure from depth value
        const pressure = 1 + (Number(document.getElementById('depthValue').value) / 10);
        
        // Update visualization and volumes
        const checkpoint = currentModel.getVolumesAtPressure(pressure);
        checkpoint.pprint();
        updateTotalVolumeDisplays(checkpoint);
    }

    window.updatePressure = function(pressure) {
        const checkpoint = currentModel.getVolumesAtPressure(Number(pressure));
        checkpoint.pprint();
        updateTotalVolumeDisplays(checkpoint);
    }

    // Initial render
    updatePressure(1);
}

// Run main when the document is loaded
document.addEventListener('DOMContentLoaded', main);

function updateFromDepth(depth) {
    depth = Math.min(190, Math.max(0, depth)); // Clamp between 0 and 190 (gives max pressure of 20 atm)
    const pressure = 1 + (depth / 10);
    
    // Update all controls
    document.getElementById('depthSlider').value = depth;
    document.getElementById('depthValue').value = Number(depth).toFixed(1);
    document.getElementById('pressureValue').value = pressure.toFixed(2);
    
    // Update the model
    updatePressure(pressure);
}

function updateFromPressure(pressure) {
    pressure = Math.min(20, Math.max(1, pressure)); // Clamp between 1 and 20
    const depth = (pressure - 1) * 10;
    
    // Update all controls
    document.getElementById('depthSlider').value = depth;
    document.getElementById('depthValue').value = depth.toFixed(1);
    document.getElementById('pressureValue').value = Number(pressure).toFixed(2);
    
    // Update the model
    updatePressure(pressure);
}
