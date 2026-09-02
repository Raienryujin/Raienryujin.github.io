(function () {
    'use strict';

    // ── Canvas Setup ──────────────────────────────────────────────────────────
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    canvas.id = 'bg-network-canvas';
    canvas.setAttribute('aria-hidden', 'true');
    canvas.style.cssText = [
        'position:fixed', 'inset:0', 'width:100vw', 'height:100vh',
        'pointer-events:none', 'z-index:0', 'display:block'
    ].join(';');

    document.body.insertBefore(canvas, document.body.firstChild);

    // Ensure all direct body children (except the canvas) sit above it
    function elevateContent() {
        Array.from(document.body.children).forEach(el => {
            if (el === canvas) return;
            const tag = el.tagName;
            if (tag === 'SCRIPT' || tag === 'STYLE' || tag === 'LINK') return;
            if (el.classList.contains('modal')) return;
            const cs = getComputedStyle(el);
            if (cs.position === 'static') el.style.position = 'relative';
            if (cs.zIndex === 'auto' || cs.zIndex === '0') el.style.zIndex = '1';
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', elevateContent);
    } else {
        elevateContent();
    }

    // ── Config ────────────────────────────────────────────────────────────────
    const CONFIG = {
        nodeCount:       80,        // number of floating nodes
        connectDist:     150,       // px — max distance to draw a node→node line
        mouseDist:       220,       // px — max distance to draw a mouse→node line
        speed:           0.25,      // base drift speed
        nodeMinR:        1.0,       // min node dot radius
        nodeMaxR:        2.2,       // max node dot radius
        lineWidth:       0.55,
        // Palette (hue range in HSL — 190–230 = cyan → blue)
        hueMin:          190,
        hueMax:          230,
        nodeAlphaMin:    0.25,
        nodeAlphaMax:    0.55,
        connectAlpha:    0.18,      // max opacity of node–node lines
        mouseLineAlpha:  0.45,      // max opacity of mouse–node lines
        mouseGlowRadius: 130,
        mouseGlowAlpha:  0.07,
    };

    // ── State ─────────────────────────────────────────────────────────────────
    let W, H;
    const mouse = { x: null, y: null };
    let nodes = [];

    function resize() {
        W = canvas.width  = window.innerWidth;
        H = canvas.height = window.innerHeight;
    }
    window.addEventListener('resize', resize);
    resize();

    window.addEventListener('mousemove', e => { mouse.x = e.clientX; mouse.y = e.clientY; });
    window.addEventListener('touchmove', e => {
        if (e.touches.length) { mouse.x = e.touches[0].clientX; mouse.y = e.touches[0].clientY; }
    }, { passive: true });
    window.addEventListener('mouseout',   () => { mouse.x = null; mouse.y = null; });

    // ── Node class ────────────────────────────────────────────────────────────
    class Node {
        constructor(randomPos = true) { this.init(randomPos); }

        init(randomPos) {
            this.x  = randomPos ? Math.random() * W : (Math.random() < 0.5 ? -10 : W + 10);
            this.y  = randomPos ? Math.random() * H : Math.random() * H;
            this.vx = (Math.random() - 0.5) * CONFIG.speed * 2;
            this.vy = (Math.random() - 0.5) * CONFIG.speed * 2;
            this.r  = CONFIG.nodeMinR + Math.random() * (CONFIG.nodeMaxR - CONFIG.nodeMinR);
            this.hue = CONFIG.hueMin + Math.random() * (CONFIG.hueMax - CONFIG.hueMin);
            this.alpha = CONFIG.nodeAlphaMin + Math.random() * (CONFIG.nodeAlphaMax - CONFIG.nodeAlphaMin);
        }

        update() {
            this.x += this.vx;
            this.y += this.vy;
            // Reset node when it drifts out of bounds
            if (this.x < -60 || this.x > W + 60 || this.y < -60 || this.y > H + 60) {
                this.init(false);
            }
        }

        draw() {
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.r, 0, Math.PI * 2);
            ctx.fillStyle = `hsla(${this.hue},75%,65%,${this.alpha})`;
            ctx.fill();
        }
    }

    // ── Init nodes ────────────────────────────────────────────────────────────
    function initNodes() {
        nodes = Array.from({ length: CONFIG.nodeCount }, () => new Node(true));
    }
    initNodes();

    // ── Draw helpers ──────────────────────────────────────────────────────────
    function drawLine(x1, y1, x2, y2, alpha, hue) {
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.strokeStyle = `hsla(${hue ?? 210},80%,65%,${alpha.toFixed(3)})`;
        ctx.lineWidth = CONFIG.lineWidth;
        ctx.stroke();
    }

    // ── Animation loop ────────────────────────────────────────────────────────
    function animate() {
        ctx.clearRect(0, 0, W, H);

        // Update positions
        nodes.forEach(n => n.update());

        // Node–node connections
        for (let i = 0; i < nodes.length; i++) {
            for (let j = i + 1; j < nodes.length; j++) {
                const dx = nodes[i].x - nodes[j].x;
                const dy = nodes[i].y - nodes[j].y;
                const d2 = dx * dx + dy * dy;
                const maxD = CONFIG.connectDist;
                if (d2 < maxD * maxD) {
                    const t = 1 - Math.sqrt(d2) / maxD;
                    drawLine(
                        nodes[i].x, nodes[i].y,
                        nodes[j].x, nodes[j].y,
                        t * CONFIG.connectAlpha,
                        (nodes[i].hue + nodes[j].hue) / 2
                    );
                }
            }
        }

        // Mouse interactions
        if (mouse.x !== null) {
            // Soft glow under cursor
            const grd = ctx.createRadialGradient(mouse.x, mouse.y, 0, mouse.x, mouse.y, CONFIG.mouseGlowRadius);
            grd.addColorStop(0, `rgba(59,130,246,${CONFIG.mouseGlowAlpha})`);
            grd.addColorStop(1, 'rgba(0,0,0,0)');
            ctx.fillStyle = grd;
            ctx.fillRect(0, 0, W, H);

            // Lines from mouse to nearby nodes
            nodes.forEach(n => {
                const dx = n.x - mouse.x;
                const dy = n.y - mouse.y;
                const d  = Math.sqrt(dx * dx + dy * dy);
                if (d < CONFIG.mouseDist) {
                    const t = 1 - d / CONFIG.mouseDist;
                    drawLine(n.x, n.y, mouse.x, mouse.y, t * CONFIG.mouseLineAlpha, n.hue);
                }
            });
        }

        // Draw dots on top of lines
        nodes.forEach(n => n.draw());

        requestAnimationFrame(animate);
    }

    animate();
})();
