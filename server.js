const express = require('express');
const os = require('os');
const path = require('path');
const diskusage = require('diskusage');

const app = express();
const PORT = process.env.PORT || 8900;

// Serve static files from public directory
app.use(express.static(path.join(__dirname, 'public')));

// API endpoint to get system metrics
app.get('/api/metrics', async (req, res) => {
    try {
        const metrics = {
            memory: getMemoryUsage(),
            cpu: getCpuUsage(),
            disk: await getDiskUsage(), // Now async
            system: getSystemInfo(),
            timestamp: new Date().toISOString()
        };

        res.json(metrics);
    } catch (error) {
        console.error('Error getting metrics:', error);
        res.status(500).json({ error: 'Failed to get system metrics' });
    }
});

function getMemoryUsage() {
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;
    const usagePercent = (usedMem / totalMem) * 100;

    return {
        total: bytesToGB(totalMem),
        used: bytesToGB(usedMem),
        free: bytesToGB(freeMem),
        usagePercent: usagePercent.toFixed(2)
    };
}

function getCpuUsage() {
    const cpus = os.cpus();

    // Calculate CPU usage
    let totalIdle = 0, totalTick = 0;
    cpus.forEach(cpu => {
        for (let type in cpu.times) {
            totalTick += cpu.times[type];
        }
        totalIdle += cpu.times.idle;
    });

    return {
        cores: cpus.length,
        model: cpus[0].model,
        speed: cpus[0].speed,
        usage: calculateCpuUsage() // Add CPU usage calculation
    };
}

// CPU usage calculation
let previousCpuUsage = null;

function calculateCpuUsage() {
    const cpus = os.cpus();
    let totalIdle = 0;
    let totalTick = 0;

    cpus.forEach(cpu => {
        for (let type in cpu.times) {
            totalTick += cpu.times[type];
        }
        totalIdle += cpu.times.idle;
    });

    const currentUsage = {
        totalIdle,
        totalTick,
        time: Date.now()
    };

    let usagePercent = 0;

    if (previousCpuUsage) {
        const idleDifference = currentUsage.totalIdle - previousCpuUsage.totalIdle;
        const totalDifference = currentUsage.totalTick - previousCpuUsage.totalTick;
        const timeDifference = currentUsage.time - previousCpuUsage.time;

        usagePercent = 100 - (idleDifference / totalDifference) * 100;

        // Ensure usage is between 0-100
        usagePercent = Math.max(0, Math.min(100, usagePercent));
    }

    previousCpuUsage = currentUsage;

    return usagePercent.toFixed(2);
}

async function getDiskUsage() {
    try {
        // Get root path (C:\ on Windows, / on Unix)
        const path = os.platform() === 'win32' ? 'C:' : '/';

        const info = await diskusage.check(path);

        const used = info.total - info.free;
        const usagePercent = (used / info.total) * 100;

        return {
            total: bytesToGB(info.total),
            used: bytesToGB(used),
            free: bytesToGB(info.free),
            usagePercent: usagePercent.toFixed(2),
            path: path
        };
    } catch (error) {
        console.error('Error getting disk usage:', error);
        // Fallback to simplified calculation
        return getFallbackDiskUsage();
    }
}

function getFallbackDiskUsage() {
    // Fallback if diskusage package fails
    const totalSpace = os.totalmem() * 2;
    const freeSpace = os.freemem() * 2;
    const usedSpace = totalSpace - freeSpace;
    const usagePercent = (usedSpace / totalSpace) * 100;

    return {
        total: bytesToGB(totalSpace),
        used: bytesToGB(usedSpace),
        free: bytesToGB(freeSpace),
        usagePercent: usagePercent.toFixed(2),
        path: 'N/A (Fallback)'
    };
}

function getSystemInfo() {
    return {
        platform: os.platform(),
        arch: os.arch(),
        hostname: os.hostname(),
        uptime: os.uptime(),
        release: os.release(),
        type: os.type()
    };
}

function bytesToGB(bytes) {
    return (bytes / (1024 * 1024 * 1024)).toFixed(2);
}

app.listen(PORT, () => {
    console.log(`Monitoring app running on http://localhost:${PORT}`);
});