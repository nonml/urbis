/**
 * Visual Hacking Network Interface
 * Node graph visualization similar to Deus Ex / Hacknet
 */

export class HackNetwork {
    constructor(game) {
        this.game = game;
        this.canvas = null;
        this.ctx = null;
        this.overlay = null;
        this.active = false;
        this.nodes = [];
        this.connections = [];
        this.selectedNode = null;
        this.camera = { x: 0, y: 0, zoom: 1 };
        this.dragging = null;
        this.pulseTimes = new Map();
        this.breachMode = false;
        this.breachTarget = null;
        this.breachProgress = 0;
        this.breachDifficulty = 1;
        this.breachNeedle = 0;
        this.breachWindow = { from: 0.4, size: 0.2 };
        this.breachHolding = false;
        this.breachHoldFrames = 0;
        this.raf = null;
        this.onComplete = null;
        
        // Police detection meter (time pressure)
        this.detectionLevel = 0; // 0-100
        this.detectionRate = 0.5; // per second
        this.detectionMax = 100;
        this.detectionWarning = 70;
        this.detectionCritical = 90;
        this.detectionTimer = 0;
        this.busted = false;
        
        this.colors = {
            background: '#0a0a1a',
            nodeUnlocked: '#4caf50',
            nodeLocked: '#f44336',
            nodeSelected: '#2196f3',
            nodeHacked: '#9c27b0',
            connection: '#1a4d2e',
            connectionActive: '#4caf50',
            text: '#e0e0e0',
            textDim: '#888888',
            detectionSafe: '#4caf50',
            detectionWarning: '#ff9800',
            detectionCritical: '#f44336'
        };
        
        this.mount();
    }
    
    mount() {
        this.overlay = document.createElement('div');
        this.overlay.id = 'hack-network-overlay';
        this.overlay.className = 'overlay hidden';
        this.overlay.innerHTML = `
            <div class="hack-network-container">
                <canvas id="hack-network-canvas"></canvas>
                <div class="hack-network-ui">
                    <div class="hack-network-header">
                        <span class="hack-network-title">🔓 Network Breach</span>
                        <div class="hack-network-skill">
                            <span class="skill-label">Skill Lvl</span>
                            <span class="skill-value" id="hack-skill-level">1</span>
                        </div>
                        <button class="hack-network-close">✕</button>
                    </div>
                    <div class="detection-meter-container">
                        <div class="detection-label">🚔 Police Detection</div>
                        <div class="detection-meter">
                            <div class="detection-fill" id="detection-fill"></div>
                        </div>
                        <div class="detection-value" id="detection-value">0%</div>
                    </div>
                    <div class="hack-network-legend">
                        <div class="legend-item">
                            <span class="legend-icon">🟢</span>
                            <span class="legend-text">Remote Node</span>
                        </div>
                        <div class="legend-item">
                            <span class="legend-icon">🟠 🚶</span>
                            <span class="legend-text">Physical Node (Street Mode Required)</span>
                        </div>
                    </div>
                    <div class="hack-network-info hidden" id="hack-network-info"></div>
                    <div class="hack-network-breach hidden" id="hack-network-breach">
                        <div class="breach-meter">
                            <div class="breach-window" id="breach-window"></div>
                            <div class="breach-needle" id="breach-needle"></div>
                        </div>
                        <p class="breach-instruction">Hold SPACE in green zone</p>
                        <p class="breach-progress" id="breach-progress">0%</p>
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(this.overlay);
        
        this.canvas = this.overlay.querySelector('#hack-network-canvas');
        this.ctx = this.canvas.getContext('2d');
        
        // Setup event listeners
        this.overlay.querySelector('.hack-network-close').addEventListener('click', () => {
            this.finish(false);
        });
        
        this.canvas.addEventListener('mousedown', (e) => this._onMouseDown(e));
        this.canvas.addEventListener('mousemove', (e) => this._onMouseMove(e));
        this.canvas.addEventListener('mouseup', (e) => this._onMouseUp(e));
        this.canvas.addEventListener('wheel', (e) => this._onWheel(e));
        
        // Keyboard for breach minigame
        window.addEventListener('keydown', (e) => this._onKeyDown(e));
        window.addEventListener('keyup', (e) => this._onKeyUp(e));
    }
    
    start(nodes, onComplete) {
        if (this.active) return;
        
        this.active = true;
        this.onComplete = onComplete;
        this.breachMode = false;
        this.breachTarget = null;
        
        // Get player's hacking skill level
        const hackingSkill = this.game.state.progression?.hackingSkill || 1;
        this.hackingSkill = hackingSkill;
        
        // Initialize detection meter (skill reduces detection rate)
        this.detectionLevel = 0;
        const baseRate = 15 + (nodes.length * 2);
        const skillReduction = Math.min(0.7, (hackingSkill - 1) * 0.07); // Up to 70% reduction at skill 11
        this.detectionRate = baseRate * (1 - skillReduction);
        this.detectionTimer = 0;
        this.busted = false;
        
        // Convert interactable nodes to network nodes
        this.nodes = nodes.map((node, i) => ({
            id: node.id,
            name: node.name,
            x: 0, y: 0, // Will be positioned
            securityLevel: node.securityLevel || 1,
            ownerFaction: node.ownerFaction || 'Unknown',
            distance: node.distance || 0,
            hacked: false,
            icon: node.icon || '🔒',
            type: node.type || 'server',
            requiresStreetMode: node.requiresStreetMode || false
        }));
        
        // Generate network layout (force-directed simulation)
        this._layoutNetwork();
        
        // Generate connections based on proximity
        this.connections = [];
        for (let i = 0; i < this.nodes.length; i++) {
            for (let j = i + 1; j < this.nodes.length; j++) {
                const a = this.nodes[i];
                const b = this.nodes[j];
                const dist = Math.hypot(a.x - b.x, a.y - b.y);
                if (dist < 150) {
                    this.connections.push({ from: i, to: j });
                }
            }
        }
        
        // Initialize pulse times
        this.pulseTimes.clear();
        this.nodes.forEach((_, i) => {
            this.pulseTimes.set(i, Math.random() * Math.PI * 2);
        });
        
        // Center camera
        const centerX = this.nodes.reduce((sum, n) => sum + n.x, 0) / this.nodes.length;
        const centerY = this.nodes.reduce((sum, n) => sum + n.y, 0) / this.nodes.length;
        this.camera.x = centerX;
        this.camera.y = centerY;
        this.camera.zoom = 1;
        
        // Show overlay
        this.overlay.classList.remove('hidden');
        this._resizeCanvas();
        this._updateUI();
        
        // Start render loop
        this._tick();
    }
    
    _layoutNetwork() {
        const n = this.nodes.length;
        if (n === 0) return;
        
        // Simple circular layout with some randomness
        const radius = Math.min(200, 100 + n * 20);
        const angleStep = (Math.PI * 2) / Math.max(1, n);
        
        this.nodes.forEach((node, i) => {
            const angle = i * angleStep + (Math.random() - 0.5) * 0.3;
            node.x = Math.cos(angle) * radius;
            node.y = Math.sin(angle) * radius;
        });
        
        // Run a few iterations of force-directed layout
        for (let iter = 0; iter < 20; iter++) {
            const forces = this.nodes.map(() => ({ fx: 0, fy: 0 }));
            
            // Repulsion between all nodes
            for (let i = 0; i < n; i++) {
                for (let j = i + 1; j < n; j++) {
                    const dx = this.nodes[i].x - this.nodes[j].x;
                    const dy = this.nodes[i].y - this.nodes[j].y;
                    const dist = Math.max(1, Math.hypot(dx, dy));
                    const repulsion = 5000 / (dist * dist);
                    const fx = (dx / dist) * repulsion;
                    const fy = (dy / dist) * repulsion;
                    forces[i].fx += fx;
                    forces[i].fy += fy;
                    forces[j].fx -= fx;
                    forces[j].fy -= fy;
                }
            }
            
            // Attraction along connections
            for (const conn of this.connections) {
                const a = this.nodes[conn.from];
                const b = this.nodes[conn.to];
                const dx = b.x - a.x;
                const dy = b.y - a.y;
                const dist = Math.hypot(dx, dy);
                const target = 100;
                const spring = (dist - target) * 0.05;
                const fx = (dx / dist) * spring;
                const fy = (dy / dist) * spring;
                forces[conn.from].fx += fx;
                forces[conn.from].fy += fy;
                forces[conn.to].fx -= fx;
                forces[conn.to].fy -= fy;
            }
            
            // Apply forces
            this.nodes.forEach((node, i) => {
                node.x += forces[i].fx * 0.1;
                node.y += forces[i].fy * 0.1;
            });
        }
    }
    
    _tick() {
        if (!this.active) return;
        
        // Update detection meter (time pressure)
        if (!this.breachMode && !this.busted) {
            this._updateDetection();
        }
        
        this._render();
        
        if (this.breachMode && this.breachTarget) {
            this._updateBreach();
        }
        
        this.raf = requestAnimationFrame(() => this._tick());
    }
    
    _updateDetection() {
        // Increase detection level over time (per frame at ~60fps)
        const dt = 1/60;
        this.detectionLevel += this.detectionRate * dt;
        
        // Clamp to max
        if (this.detectionLevel >= this.detectionMax) {
            this.detectionLevel = this.detectionMax;
            this._onBusted();
        }
        
        // Update UI
        this._updateDetectionUI();
    }
    
    _updateDetectionUI() {
        const fill = this.overlay.querySelector('#detection-fill');
        const value = this.overlay.querySelector('#detection-value');
        const container = this.overlay.querySelector('.detection-meter-container');
        if (fill && value && container) {
            const pct = this.detectionLevel;
            fill.style.width = `${pct}%`;
            value.textContent = `${Math.round(pct)}%`;
            
            // Change color based on level
            if (pct >= this.detectionCritical) {
                fill.style.backgroundColor = this.colors.detectionCritical;
                value.style.color = this.colors.detectionCritical;
                container.classList.add('critical');
                container.classList.remove('warning');
            } else if (pct >= this.detectionWarning) {
                fill.style.backgroundColor = this.colors.detectionWarning;
                value.style.color = this.colors.detectionWarning;
                container.classList.add('warning');
                container.classList.remove('critical');
            } else {
                fill.style.backgroundColor = this.colors.detectionSafe;
                value.style.color = this.colors.detectionSafe;
                container.classList.remove('warning', 'critical');
            }
        }
    }
    
    _onBusted() {
        this.busted = true;
        this.finish(false);
    }
    
    _render() {
        const ctx = this.ctx;
        const w = this.canvas.width;
        const h = this.canvas.height;
        
        // Clear background
        ctx.fillStyle = this.colors.background;
        ctx.fillRect(0, 0, w, h);
        
        // Save and apply camera transform
        ctx.save();
        ctx.translate(w / 2, h / 2);
        ctx.scale(this.camera.zoom, this.camera.zoom);
        ctx.translate(-this.camera.x, -this.camera.y);
        
        // Draw connections
        ctx.lineWidth = 2;
        for (const conn of this.connections) {
            const a = this.nodes[conn.from];
            const b = this.nodes[conn.to];
            
            // Check if connection is active (both nodes hacked)
            const isActive = a.hacked && b.hacked;
            ctx.strokeStyle = isActive ? this.colors.connectionActive : this.colors.connection;
            
            // Draw connection line
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.stroke();
            
            // Draw data packets on active connections
            if (isActive) {
                const pulse = this.pulseTimes.get(conn.from) || 0;
                const t = (Math.sin(pulse) + 1) / 2;
                const px = a.x + (b.x - a.x) * t;
                const py = a.y + (b.y - a.y) * t;
                
                ctx.fillStyle = this.colors.nodeUnlocked;
                ctx.beginPath();
                ctx.arc(px, py, 3, 0, Math.PI * 2);
                ctx.fill();
            }
        }
        
        // Draw nodes
        for (let i = 0; i < this.nodes.length; i++) {
            const node = this.nodes[i];
            const isSelected = this.selectedNode === i;
            
            // Pulse effect
            const pulse = this.pulseTimes.get(i) || 0;
            const pulseScale = 1 + Math.sin(pulse) * 0.05;
            
            // Node glow
            if (isSelected || node.hacked) {
                const gradient = ctx.createRadialGradient(node.x, node.y, 0, node.x, node.y, 30);
                const glowColor = node.hacked ? this.colors.nodeHacked : this.colors.nodeSelected;
                gradient.addColorStop(0, glowColor + '40');
                gradient.addColorStop(1, glowColor + '00');
                ctx.fillStyle = gradient;
                ctx.beginPath();
                ctx.arc(node.x, node.y, 30, 0, Math.PI * 2);
                ctx.fill();
            }
            
            // Node circle
            ctx.fillStyle = this._getNodeColor(node);
            ctx.beginPath();
            ctx.arc(node.x, node.y, 15 * pulseScale, 0, Math.PI * 2);
            ctx.fill();
            
            // Node border
            ctx.strokeStyle = isSelected ? '#ffffff' : this.colors.textDim;
            ctx.lineWidth = isSelected ? 3 : 2;
            ctx.beginPath();
            ctx.arc(node.x, node.y, 15 * pulseScale, 0, Math.PI * 2);
            ctx.stroke();
            
            // Node icon
            ctx.fillStyle = '#ffffff';
            ctx.font = '14px Arial';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(node.icon, node.x, node.y);
            
            // Node name
            ctx.fillStyle = this.colors.text;
            ctx.font = '11px Arial';
            ctx.fillText(node.name, node.x, node.y + 25);
            
            // Security level badge
            if (!node.hacked) {
                ctx.fillStyle = this.colors.nodeLocked;
                ctx.fillRect(node.x - 20, node.y - 25, 40, 16);
                ctx.fillStyle = '#ffffff';
                ctx.font = '9px Arial';
                ctx.fillText(`S${node.securityLevel}`, node.x, node.y - 17);
            }
            
            // Physical node indicator (requires street mode)
            if (node.requiresStreetMode && !node.hacked) {
                // Draw indicator badge
                ctx.fillStyle = '#ff6b35';
                ctx.fillRect(node.x + 12, node.y - 25, 10, 10);
                ctx.strokeStyle = '#ffffff';
                ctx.lineWidth = 1;
                ctx.strokeRect(node.x + 12, node.y - 25, 10, 10);
                
                // Draw "🚶" icon to indicate physical presence required
                ctx.fillStyle = '#ffffff';
                ctx.font = '8px Arial';
                ctx.fillText('🚶', node.x + 17, node.y - 20);
            }
        }
        
        ctx.restore();
        
        // Update pulse times
        this.pulseTimes.forEach((_, key) => {
            this.pulseTimes.set(key, this.pulseTimes.get(key) + 0.05);
        });
    }
    
    _getNodeColor(node) {
        if (node.hacked) return this.colors.nodeHacked;
        return this.colors.nodeLocked;
    }
    
    _updateBreach() {
        if (!this.breachTarget) return;
        
        const node = this.nodes[this.breachTarget];
        const skill = this.hackingSkill || 1;
        
        // Skill affects breach difficulty:
        // - Higher skill = wider window (easier to hit)
        // - Higher skill = faster needle (more control)
        // - Higher skill = fewer frames required (faster completion)
        const skillBonus = (skill - 1) * 0.05; // 5% bonus per skill level
        
        const speed = 0.012 + (node.securityLevel * 0.006) - (skill * 0.001);
        const windowSize = Math.max(0.15, 0.26 - (node.securityLevel * 0.03) + skillBonus);
        const successFrom = 0.5 - (windowSize / 2);
        
        this.breachNeedle += speed;
        if (this.breachNeedle > 1) this.breachNeedle -= 1;
        
        const inWindow = this.breachNeedle >= successFrom &&
                         this.breachNeedle <= (successFrom + windowSize);
        
        if (this.breachHolding && inWindow) {
            this.breachHoldFrames++;
        } else {
            this.breachHoldFrames = Math.max(0, this.breachHoldFrames - 2);
        }
        
        const baseFrames = 20 + (node.securityLevel * 8);
        const requiredFrames = Math.max(15, Math.floor(baseFrames * (1 - skill * 0.04))); // 4% reduction per skill level
        const progress = Math.min(100, (this.breachHoldFrames / requiredFrames) * 100);
        
        // Update UI
        const needleEl = this.overlay.querySelector('#breach-needle');
        const windowEl = this.overlay.querySelector('#breach-window');
        const progressEl = this.overlay.querySelector('#breach-progress');
        
        if (needleEl) needleEl.style.left = `${this.breachNeedle * 100}%`;
        if (windowEl) {
            windowEl.style.left = `${successFrom * 100}%`;
            windowEl.style.width = `${windowSize * 100}%`;
        }
        if (progressEl) progressEl.textContent = `${Math.floor(progress)}%`;
        
        // Check for success
        if (this.breachHoldFrames >= requiredFrames) {
            this._completeBreach(node, true);
        }
    }
    
    // -----------------------------------------------------------------------
    // Per-node-type intel rewards (meaningful gameplay effects)
    // -----------------------------------------------------------------------

    /** Returns a description and gameplay effect for a node type. */
    _getNodeReward(nodeType) {
        const rewards = {
            power_substation: {
                label: '⚡ Power Disruption',
                description: 'Disables security cameras in this district for 120 ticks',
                apply: (game) => {
                    const state = game.state.player || {};
                    state.camerasDisabledUntil = (game.state.time?.tick || 0) + 120;
                    state.detectionMultiplier = (state.detectionMultiplier || 1) * 0.5;
                    game.state.player = state;
                    game.heatSystem?.addHeat(-8);
                }
            },
            cctv_pole: {
                label: '📡 Surveillance Tap',
                description: 'Reveals rival AI positions + reduces heat by 10',
                apply: (game) => {
                    game.heatSystem?.addHeat(-10);
                    // Reveal rival position intel
                    const rival = game.state.rival;
                    if (rival) {
                        game.intelSystem?.generateEntry?.('rival_location', {
                            text: `Rival network traced to sector ${Math.floor(Math.random() * 9) + 1}`,
                            source: 'cctv_tap', tier: 2,
                        });
                    }
                    if (game.ui) game.ui.showMessage('📡 Rival position logged to intel database', 'success');
                }
            },
            telecom_box: {
                label: '📶 Comms Intercept',
                description: 'Intercepts faction comms — unlocks faction intel & slows detection for 60 ticks',
                apply: (game) => {
                    const state = game.state.player || {};
                    state.commsInterceptUntil = (game.state.time?.tick || 0) + 60;
                    game.state.player = state;
                    // Boost faction visibility
                    game.intelSystem?.generateEntry?.('faction_comms', {
                        text: 'Faction communication patterns decoded — rep changes reduced by 30%',
                        source: 'comms_intercept', tier: 2,
                    });
                    if (game.ui) game.ui.showMessage('📶 Faction comms intercepted — rep penalties reduced', 'success');
                }
            },
            server: {
                label: '💾 Data Exfil',
                description: 'Extracts financial data — gain 25-80 gold',
                apply: (game) => {
                    const bonus = 25 + Math.floor(Math.random() * 56);
                    game.resources?.add?.({ gold: bonus });
                    if (game.ui) game.ui.showMessage(`💾 Exfiltrated data sold for +${bonus} gold`, 'success');
                }
            },
        };
        return rewards[nodeType] || rewards.server;
    }

    _completeBreach(node, success) {
        if (success) {
            node.hacked = true;

            // Award XP based on security level
            const xpGained = node.securityLevel * 10;
            this._awardHackingXP(xpGained);

            // Apply per-node-type gameplay reward
            const reward = this._getNodeReward(node.type);
            if (reward?.apply) {
                try { reward.apply(this.game); } catch (e) { console.warn('[HackNetwork] reward apply failed:', e); }
            }

            // Show reward popup inside the network UI
            const infoEl = this.overlay.querySelector('#hack-network-info');
            if (infoEl) {
                infoEl.classList.remove('hidden');
                infoEl.innerHTML = `
                    <h3 style="color:#4caf50">✅ ${node.name} — Breached</h3>
                    <p style="color:#aaffaa"><strong>${reward.label}</strong></p>
                    <p>${reward.description}</p>
                    <p style="opacity:0.7">+${xpGained} Hack XP (Skill Lv.${this.hackingSkill})</p>
                `;
            }

            // Check if all nodes hacked
            const allHacked = this.nodes.every(n => n.hacked);
            if (allHacked && this.onComplete) {
                this.onComplete(true, this.nodes);
                this.finish(true);
                return;
            }
        }

        this.breachMode = false;
        this.breachTarget = null;
        this.breachHolding = false;
        this.breachHoldFrames = 0;
        this._updateUI();
    }
    
    _awardHackingXP(xp) {
        const progression = this.game.state.progression || {};
        const currentXP = progression.hackingXP || 0;
        const currentLevel = progression.hackingSkill || 1;
        
        // XP needed for next level: 100 + (level * 50)
        const xpNeeded = 100 + (currentLevel * 50);
        const newXp = currentXP + xp;
        
        let newLevel = currentLevel;
        let remainingXp = newXp;
        
        // Check for level up
        if (remainingXp >= xpNeeded) {
            newLevel++;
            remainingXp = remainingXp - xpNeeded;
            
            // Show level up notification
            if (this.game.ui) {
                this.game.ui.showMessage(`🔓 Hacking Skill Level Up! (Level ${newLevel})`, 'success');
            }
        }
        
        // Update progression
        progression.hackingSkill = newLevel;
        progression.hackingXP = remainingXp;
        progression.totalNodesHacked = (progression.totalNodesHacked || 0) + 1;
        progression.successfulBreaches = (progression.successfulBreaches || 0) + 1;
        
        // Store back to state
        this.game.state.progression = progression;
    }
    
    _onMouseDown(e) {
        const rect = this.canvas.getBoundingClientRect();
        const mx = e.clientX - rect.left;
        const my = e.clientY - rect.top;
        
        // Convert to world coordinates
        const wx = (mx - this.canvas.width / 2) / this.camera.zoom + this.camera.x;
        const wy = (my - this.canvas.height / 2) / this.camera.zoom + this.camera.y;
        
        // Check for node click
        for (let i = 0; i < this.nodes.length; i++) {
            const node = this.nodes[i];
            const dist = Math.hypot(node.x - wx, node.y - wy);
            if (dist < 20) {
                if (node.hacked) {
                    // Already hacked, just select
                    this.selectedNode = i;
                } else {
                    // Start breach
                    this.selectedNode = i;
                    this.breachMode = true;
                    this.breachTarget = i;
                    this.breachNeedle = 0;
                    this.breachHolding = false;
                    this.breachHoldFrames = 0;
                }
                this._updateUI();
                return;
            }
        }
        
        // Start dragging camera
        this.dragging = { x: mx, y: my, camX: this.camera.x, camY: this.camera.y };
    }
    
    _onMouseMove(e) {
        if (this.dragging) {
            const rect = this.canvas.getBoundingClientRect();
            const mx = e.clientX - rect.left;
            const my = e.clientY - rect.top;
            
            const dx = (mx - this.dragging.x) / this.camera.zoom;
            const dy = (my - this.dragging.y) / this.camera.zoom;
            
            this.camera.x = this.dragging.camX - dx;
            this.camera.y = this.dragging.camY - dy;
        }
    }
    
    _onMouseUp(e) {
        this.dragging = null;
    }
    
    _onWheel(e) {
        e.preventDefault();
        const zoomSpeed = 0.1;
        const delta = e.deltaY > 0 ? -zoomSpeed : zoomSpeed;
        this.camera.zoom = Math.max(0.5, Math.min(2, this.camera.zoom + delta));
    }
    
    _onKeyDown(e) {
        if (!this.breachMode) {
            if (e.code === 'Escape') {
                this.finish(false);
            }
            return;
        }
        
        if (e.code === 'Space') {
            e.preventDefault();
            this.breachHolding = true;
        }
        if (e.code === 'Escape') {
            e.preventDefault();
            this.breachMode = false;
            this.breachTarget = null;
            this._updateUI();
        }
    }
    
    _onKeyUp(e) {
        if (e.code === 'Space') {
            this.breachHolding = false;
        }
    }
    
    _updateUI() {
        // Update skill level display
        const skillEl = this.overlay.querySelector('#hack-skill-level');
        if (skillEl) {
            skillEl.textContent = this.hackingSkill || 1;
        }
        
        const infoEl = this.overlay.querySelector('#hack-network-info');
        const breachEl = this.overlay.querySelector('#hack-network-breach');
        
        if (this.breachMode && this.breachTarget !== null) {
            const node = this.nodes[this.breachTarget];
            infoEl.classList.add('hidden');
            breachEl.classList.remove('hidden');
        } else if (this.selectedNode !== null) {
            const node = this.nodes[this.selectedNode];
            infoEl.classList.remove('hidden');
            breachEl.classList.add('hidden');
            
            const status = node.hacked ? '✅ HACKED' : '🔒 LOCKED';
            const reward = this._getNodeReward(node.type);
            const skillOk = (this.hackingSkill || 1) >= node.securityLevel;
            const skillWarning = !skillOk ? `<p style="color:#ff9800">⚠ Security Lv.${node.securityLevel} — Hacking Skill Lv.${this.hackingSkill} may be insufficient</p>` : '';
            infoEl.innerHTML = `
                <h3>${node.icon} ${node.name}</h3>
                <p><strong>Status:</strong> ${status}</p>
                <p><strong>Security:</strong> Level ${node.securityLevel}</p>
                <p><strong>Owner:</strong> ${node.ownerFaction}</p>
                <p><strong>Distance:</strong> ${Math.round(node.distance)}m</p>
                ${!node.hacked ? `<p style="color:#7ec8e3"><strong>Reward:</strong> ${reward.label}</p><p style="opacity:0.8">${reward.description}</p>${skillWarning}<p class="hack-prompt">Click to initiate breach</p>` : `<p style="color:#9c27b0">Intel acquired: ${reward.label}</p>`}
            `;
        } else {
            infoEl.classList.add('hidden');
            breachEl.classList.add('hidden');
        }
    }
    
    _resizeCanvas() {
        const container = this.overlay.querySelector('.hack-network-container');
        const rect = container.getBoundingClientRect();
        this.canvas.width = rect.width;
        this.canvas.height = rect.height;
    }
    
    finish(success) {
        if (!this.active) return;
        
        this.active = false;
        this.breachMode = false;
        this.breachTarget = null;
        
        if (this.raf) {
            cancelAnimationFrame(this.raf);
            this.raf = null;
        }
        
        this.overlay.classList.add('hidden');
        
        // Remove keyboard listeners
        window.removeEventListener('keydown', (e) => this._onKeyDown(e));
        window.removeEventListener('keyup', (e) => this._onKeyUp(e));
        
        if (this.onComplete) {
            this.onComplete(success, this.nodes);
            this.onComplete = null;
        }
    }
}
