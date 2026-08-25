/**
 * Decal Atlas — DataArrayTexture for Q11.D q11-tx-array-decals
 * 8 layers, 64×64 each, packed into ONE DataArrayTexture.
 * Avoids per-decal CanvasTexture allocation and sampled via sampler2DArray.
 */

export const DECAL_TYPES = {
    puddle: 0,
    grime: 1,
    blood: 2,
    scorch: 3,
    poster: 4,
    graffiti: 5,
    skid: 6,
    bullet: 7,
};

const SIZE = 64;
const DEPTH = 8;

function hash2(ix, iz) {
    let h = (Math.imul(ix | 0, 374761393) + Math.imul(iz | 0, 668265263)) >>> 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0;
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

function drawPuddle(ctx) {
    ctx.clearRect(0, 0, SIZE, SIZE);
    ctx.fillStyle = 'rgba(18,24,36,0.0)';
    ctx.fillRect(0, 0, SIZE, SIZE);
    const g = ctx.createRadialGradient(32, 32, 8, 32, 32, 28);
    g.addColorStop(0, 'rgba(46,78,120,0.85)');
    g.addColorStop(0.5, 'rgba(32,52,84,0.55)');
    g.addColorStop(1, 'rgba(18,24,36,0.0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(32, 32, 26, 20, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(180,210,255,0.18)';
    ctx.beginPath();
    ctx.ellipse(22, 24, 10, 5, -0.4, 0, Math.PI * 2);
    ctx.fill();
}

function drawGrime(ctx) {
    ctx.clearRect(0, 0, SIZE, SIZE);
    ctx.fillStyle = 'rgba(28,28,28,0)';
    ctx.fillRect(0, 0, SIZE, SIZE);
    for (let y = 0; y < SIZE; y += 4) {
        for (let x = 0; x < SIZE; x += 4) {
            const n = hash2(x, y);
            if (n > 0.62) {
                ctx.fillStyle = `rgba(42,42,38,${0.18 + (n - 0.62) * 0.6})`;
                ctx.fillRect(x, y, 4, 4);
            }
        }
    }
    ctx.strokeStyle = 'rgba(0,0,0,0.07)';
    for (let i = 0; i < 6; i++) {
        const x = hash2(i * 19, 7) * SIZE;
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x + (hash2(i * 7, 13) - 0.5) * 16, SIZE);
        ctx.stroke();
    }
}

function drawBlood(ctx) {
    ctx.clearRect(0, 0, SIZE, SIZE);
    ctx.fillStyle = 'rgba(120,14,14,0)';
    ctx.fillRect(0, 0, SIZE, SIZE);
    ctx.fillStyle = 'rgba(138,18,18,0.92)';
    ctx.beginPath();
    ctx.ellipse(32, 32, 14, 11, 0, 0, Math.PI * 2);
    ctx.fill();
    for (let i = 0; i < 8; i++) {
        const a = hash2(i * 33, 5) * Math.PI * 2;
        const r = 12 + hash2(i * 17, 9) * 10;
        const x = 32 + Math.cos(a) * r;
        const y = 32 + Math.sin(a) * r;
        const s = 2 + hash2(i * 53, 11) * 3;
        ctx.beginPath();
        ctx.arc(x, y, s, 0, Math.PI * 2);
        ctx.fill();
    }
    ctx.fillStyle = 'rgba(200,40,40,0.35)';
    ctx.beginPath();
    ctx.ellipse(28, 26, 6, 4, -0.5, 0, Math.PI * 2);
    ctx.fill();
}

function drawScorch(ctx) {
    ctx.clearRect(0, 0, SIZE, SIZE);
    const g = ctx.createRadialGradient(32, 32, 2, 32, 32, 28);
    g.addColorStop(0, 'rgba(18,18,18,0.95)');
    g.addColorStop(0.4, 'rgba(28,24,22,0.75)');
    g.addColorStop(0.7, 'rgba(48,42,36,0.25)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(32, 32, 28, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,120,40,0.06)';
    for (let i = 0; i < 5; i++) {
        const a = hash2(i * 41, 3) * Math.PI * 2;
        ctx.beginPath();
        ctx.moveTo(32, 32);
        ctx.lineTo(32 + Math.cos(a) * 26, 32 + Math.sin(a) * 26);
        ctx.stroke();
    }
}

function drawPoster(ctx) {
    ctx.clearRect(0, 0, SIZE, SIZE);
    ctx.fillStyle = '#e8e0c8';
    ctx.fillRect(4, 4, 56, 56);
    ctx.fillStyle = '#2f9be0';
    ctx.fillRect(8, 8, 48, 10);
    ctx.fillStyle = '#111';
    ctx.font = 'bold 7px Consolas';
    ctx.fillText('NEON CITY', 12, 16);
    ctx.fillStyle = '#57b894';
    ctx.fillRect(10, 22, 44, 18);
    ctx.fillStyle = '#e0a13a';
    ctx.beginPath();
    ctx.arc(32, 48, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.18)';
    ctx.strokeRect(4, 4, 56, 56);
}

function drawGraffiti(ctx) {
    ctx.clearRect(0, 0, SIZE, SIZE);
    ctx.fillStyle = 'rgba(0,0,0,0)';
    ctx.fillRect(0, 0, SIZE, SIZE);
    ctx.save();
    ctx.translate(32, 32);
    ctx.rotate(-0.18);
    ctx.strokeStyle = 'rgba(224,32,96,0.92)';
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(-22, 6);
    ctx.bezierCurveTo(-12, -14, 6, -12, 18, 4);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(47,155,224,0.85)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(-18, 10);
    ctx.bezierCurveTo(-8, 2, 4, 12, 20, 8);
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.beginPath();
    ctx.arc(16, -6, 2.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    for (let i = 0; i < 40; i++) {
        const x = hash2(i * 11, 2) * SIZE;
        const y = hash2(i * 13, 3) * SIZE;
        if (hash2(i * 7, 5) > 0.88) {
            ctx.fillStyle = `rgba(0,0,0,${0.04 + hash2(i, 9) * 0.06})`;
            ctx.fillRect(x, y, 1, 1);
        }
    }
}

function drawSkid(ctx) {
    ctx.clearRect(0, 0, SIZE, SIZE);
    ctx.strokeStyle = 'rgba(18,18,18,0.0)';
    ctx.fillRect(0, 0, SIZE, SIZE);
    ctx.strokeStyle = 'rgba(18,18,22,0.82)';
    ctx.lineWidth = 5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(6, 18);
    ctx.bezierCurveTo(20, 20, 32, 24, 58, 26);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(28,28,30,0.62)';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(6, 26);
    ctx.bezierCurveTo(20, 28, 32, 32, 58, 34);
    ctx.stroke();
    for (let i = 0; i < 16; i++) {
        const x = 6 + hash2(i * 23, 1) * 52;
        const y = 20 + hash2(i * 29, 2) * 14;
        ctx.fillStyle = `rgba(0,0,0,${0.06 + hash2(i, 3) * 0.08})`;
        ctx.fillRect(x, y, 2, 1);
    }
}

function drawBullet(ctx) {
    ctx.clearRect(0, 0, SIZE, SIZE);
    ctx.fillStyle = 'rgba(0,0,0,0)';
    ctx.fillRect(0, 0, SIZE, SIZE);
    ctx.fillStyle = 'rgba(12,12,12,0.96)';
    ctx.beginPath();
    ctx.arc(32, 32, 4.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(80,80,82,0.45)';
    ctx.lineWidth = 1.1;
    for (let i = 0; i < 5; i++) {
        const a = hash2(i * 31, 7) * Math.PI * 2;
        const len = 6 + hash2(i * 17, 11) * 7;
        ctx.beginPath();
        ctx.moveTo(32 + Math.cos(a) * 4.5, 32 + Math.sin(a) * 4.5);
        ctx.lineTo(32 + Math.cos(a) * len, 32 + Math.sin(a) * len);
        ctx.stroke();
    }
    ctx.fillStyle = 'rgba(200,200,210,0.22)';
    ctx.beginPath();
    ctx.arc(30, 30, 1.2, 0, Math.PI * 2);
    ctx.fill();
}

const DRAWERS = [
    drawPuddle,
    drawGrime,
    drawBlood,
    drawScorch,
    drawPoster,
    drawGraffiti,
    drawSkid,
    drawBullet,
];

export function createDecalArrayTexture(THREE) {
    const width = SIZE;
    const height = SIZE;
    const depth = DEPTH;
    const data = new Uint8Array(width * height * depth * 4);

    // Reuse one canvas per layer
    const canvas = typeof document !== 'undefined' ? document.createElement('canvas') : null;
    if (!canvas) {
        // Headless fallback: solid slices
        for (let i = 0; i < data.length; i += 4) {
            data[i] = 128; data[i + 1] = 128; data[i + 2] = 128; data[i + 3] = 64;
        }
    } else {
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        for (let layer = 0; layer < depth; layer++) {
            ctx.clearRect(0, 0, width, height);
            DRAWERS[layer](ctx);
            const img = ctx.getImageData(0, 0, width, height).data;
            const off = layer * width * height * 4;
            data.set(img, off);
        }
    }

    const tex = new THREE.DataArrayTexture(data, width, height, depth);
    tex.format = THREE.RGBAFormat;
    tex.type = THREE.UnsignedByteType;
    tex.minFilter = THREE.LinearFilter;
    tex.magFilter = THREE.LinearFilter;
    tex.wrapS = THREE.ClampToEdgeWrapping;
    tex.wrapT = THREE.ClampToEdgeWrapping;
    tex.needsUpdate = true;
    return tex;
}
