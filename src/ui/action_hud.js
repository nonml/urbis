/**
 * Action HUD — Watch Dogs-inspired minimal overlay inside the 3D viewport
 */

export class ActionHUD {
    constructor(game) {
        this.game = game;
        this._el = null;
        this._cache = {};
        this._init();
    }

    _init() {
        document.getElementById('action-hud')?.remove();

        const anchor = document.getElementById('main-area') || document.body;
        anchor.style.position = anchor.style.position || 'relative';

        this._el = document.createElement('div');
        this._el.id = 'action-hud';
        this._el.innerHTML = `
            <div class="ahud-stars" id="ahud-stars">
                <span></span><span></span><span></span><span></span><span></span>
            </div>
            <div class="ahud-vitals">
                <div class="ahud-vital-ring" id="ahud-ring">
                    <svg viewBox="0 0 48 48">
                        <circle class="ahud-ring-bg" cx="24" cy="24" r="20"/>
                        <circle class="ahud-ring-hp" id="ahud-ring-hp" cx="24" cy="24" r="20"/>
                        <circle class="ahud-ring-ar" id="ahud-ring-ar" cx="24" cy="24" r="16"/>
                    </svg>
                    <div class="ahud-vital-icon" id="ahud-vital-icon">+</div>
                </div>
                <div class="ahud-vital-text">
                    <span class="ahud-hp-num" id="ahud-hp-num">100</span>
                </div>
            </div>
            <div class="ahud-weapon-box" id="ahud-weapon-box">
                <div class="ahud-weapon-name" id="ahud-wname"></div>
                <div class="ahud-weapon-ammo" id="ahud-wammo"></div>
            </div>
            <div class="ahud-speedo" id="ahud-speedo">
                <span class="ahud-vtype" id="ahud-vtype"></span>
                <span class="ahud-speedo-num" id="ahud-speedo-num">0</span>
                <span class="ahud-speedo-unit">km/h</span>
                <div class="ahud-vhealth" id="ahud-vhealth"><div class="ahud-vhealth-fill" id="ahud-vhealth-fill"></div></div>
            </div>
            <div class="ahud-crosshair" id="ahud-crosshair">
                <svg viewBox="0 0 24 24" width="24" height="24">
                    <line x1="12" y1="4" x2="12" y2="9" stroke="white" stroke-width="1.5" opacity="0.7"/>
                    <line x1="12" y1="15" x2="12" y2="20" stroke="white" stroke-width="1.5" opacity="0.7"/>
                    <line x1="4" y1="12" x2="9" y2="12" stroke="white" stroke-width="1.5" opacity="0.7"/>
                    <line x1="15" y1="12" x2="20" y2="12" stroke="white" stroke-width="1.5" opacity="0.7"/>
                    <circle cx="12" cy="12" r="1.5" fill="white" opacity="0.5"/>
                </svg>
            </div>
            <div class="ahud-flash" id="ahud-flash"></div>
            <div class="ahud-death" id="ahud-death">
                <div class="ahud-death-line"></div>
                <div class="ahud-death-text">WASTED</div>
                <div class="ahud-death-line"></div>
            </div>
        `;

        if (!document.getElementById('ahud-css')) {
            const s = document.createElement('style');
            s.id = 'ahud-css';
            s.textContent = `
                #action-hud {
                    position: absolute;
                    inset: 0;
                    pointer-events: none;
                    z-index: 20;
                    font-family: 'Consolas', 'SF Mono', 'Courier New', monospace;
                    overflow: hidden;
                }

                /* ── Wanted Stars ── top-right inside viewport */
                .ahud-stars {
                    position: absolute;
                    top: 14px;
                    right: 14px;
                    display: flex;
                    gap: 4px;
                    padding: 5px 8px;
                    background: rgba(0,0,0,0.55);
                    border: 1px solid rgba(255,255,255,0.06);
                    border-radius: 3px;
                    backdrop-filter: blur(4px);
                }
                .ahud-stars span {
                    width: 10px;
                    height: 10px;
                    background: rgba(255,255,255,0.08);
                    clip-path: polygon(50% 0%, 61% 35%, 98% 35%, 68% 57%, 79% 91%, 50% 70%, 21% 91%, 32% 57%, 2% 35%, 39% 35%);
                    transition: background 0.2s, filter 0.2s;
                }
                .ahud-stars span.on {
                    background: #f39c12;
                    filter: drop-shadow(0 0 3px rgba(243,156,18,0.6));
                }
                .ahud-stars span.blink {
                    animation: ahud-blink .3s infinite alternate;
                }
                @keyframes ahud-blink { to { opacity: .15 } }

                /* ── Vitals (health ring) ── bottom-left */
                .ahud-vitals {
                    position: absolute;
                    bottom: 16px;
                    left: 16px;
                    display: flex;
                    align-items: center;
                    gap: 8px;
                }
                .ahud-vital-ring {
                    width: 48px;
                    height: 48px;
                    position: relative;
                }
                .ahud-vital-ring svg {
                    width: 100%;
                    height: 100%;
                    transform: rotate(-90deg);
                }
                .ahud-ring-bg {
                    fill: none;
                    stroke: rgba(255,255,255,0.06);
                    stroke-width: 3;
                }
                .ahud-ring-hp {
                    fill: none;
                    stroke: #e74c3c;
                    stroke-width: 3;
                    stroke-linecap: round;
                    stroke-dasharray: 125.66;
                    stroke-dashoffset: 0;
                    transition: stroke-dashoffset 0.3s ease;
                    filter: drop-shadow(0 0 3px rgba(231,76,60,0.4));
                }
                .ahud-ring-ar {
                    fill: none;
                    stroke: #3498db;
                    stroke-width: 2.5;
                    stroke-linecap: round;
                    stroke-dasharray: 100.53;
                    stroke-dashoffset: 100.53;
                    transition: stroke-dashoffset 0.3s ease;
                    filter: drop-shadow(0 0 3px rgba(52,152,219,0.4));
                }
                .ahud-vital-icon {
                    position: absolute;
                    inset: 0;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 16px;
                    font-weight: 700;
                    color: rgba(255,255,255,0.5);
                }
                .ahud-vital-text {
                    display: flex;
                    flex-direction: column;
                }
                .ahud-hp-num {
                    font-size: 20px;
                    font-weight: 700;
                    color: #fff;
                    text-shadow: 0 1px 4px rgba(0,0,0,0.8);
                    line-height: 1;
                }

                /* ── Weapon Box ── bottom-right */
                .ahud-weapon-box {
                    position: absolute;
                    bottom: 16px;
                    right: 16px;
                    text-align: right;
                    background: rgba(0,0,0,0.55);
                    border: 1px solid rgba(255,255,255,0.06);
                    border-radius: 3px;
                    padding: 6px 12px;
                    backdrop-filter: blur(4px);
                }
                .ahud-weapon-name {
                    font-size: 10px;
                    font-weight: 600;
                    color: rgba(255,255,255,0.45);
                    text-transform: uppercase;
                    letter-spacing: 1.5px;
                }
                .ahud-weapon-ammo {
                    font-size: 22px;
                    font-weight: 700;
                    color: #fff;
                    line-height: 1.1;
                    text-shadow: 0 1px 4px rgba(0,0,0,0.6);
                }

                /* ── Speedometer ── above weapon when driving */
                .ahud-speedo {
                    position: absolute;
                    bottom: 72px;
                    right: 16px;
                    text-align: right;
                    opacity: 0;
                    transition: opacity 0.25s;
                }
                .ahud-speedo.on { opacity: 1; }
                .ahud-speedo-num {
                    font-size: 32px;
                    font-weight: 800;
                    color: #fff;
                    text-shadow: 0 2px 6px rgba(0,0,0,0.8);
                }
                .ahud-speedo-unit {
                    font-size: 11px;
                    font-weight: 600;
                    color: rgba(255,255,255,0.4);
                    margin-left: 3px;
                    letter-spacing: 1px;
                }
                .ahud-vtype {
                    display: block;
                    font-size: 10px;
                    font-weight: 600;
                    color: rgba(255,255,255,0.5);
                    text-transform: uppercase;
                    letter-spacing: 2px;
                    margin-bottom: 2px;
                }
                .ahud-vhealth {
                    width: 80px;
                    height: 4px;
                    background: rgba(255,255,255,0.1);
                    border-radius: 2px;
                    margin-top: 4px;
                    margin-left: auto;
                }
                .ahud-vhealth-fill {
                    height: 100%;
                    border-radius: 2px;
                    background: #4caf50;
                    transition: width 0.3s, background 0.3s;
                }

                /* ── Crosshair ── center of viewport */
                .ahud-crosshair {
                    position: absolute;
                    top: 50%;
                    left: 50%;
                    transform: translate(-50%, -50%);
                    opacity: 0;
                    transition: opacity 0.2s;
                }
                .ahud-crosshair.on { opacity: 1; }

                /* ── Damage Flash ── */
                .ahud-flash {
                    position: absolute;
                    inset: 0;
                    background: radial-gradient(ellipse at center, transparent 40%, rgba(200,30,30,0.4) 100%);
                    opacity: 0;
                    transition: opacity .08s;
                    pointer-events: none;
                }
                .ahud-flash.on { opacity: 1; }

                /* ── Death Screen ── */
                .ahud-death {
                    position: absolute;
                    inset: 0;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    gap: 12px;
                    background: rgba(0,0,0,0.6);
                    opacity: 0;
                    transition: opacity .6s;
                    pointer-events: none;
                }
                .ahud-death.on { opacity: 1; }
                .ahud-death-text {
                    font-size: 48px;
                    font-weight: 900;
                    color: #c0392b;
                    letter-spacing: 14px;
                    text-shadow: 0 0 30px rgba(192,57,43,0.5);
                }
                .ahud-death-line {
                    width: 200px;
                    height: 1px;
                    background: linear-gradient(90deg, transparent, rgba(192,57,43,0.6), transparent);
                }
            `;
            document.head.appendChild(s);
        }

        anchor.appendChild(this._el);
    }

    update() {
        const now = performance.now();
        if (now - (this._lastUpdate || 0) < 66) return;
        this._lastUpdate = now;

        const { state, playerHealth: ph, combat, vehicleController: vc, policeSystem: ps } = this.game;
        const player = state.player;

        // Health ring (circumference = 2 * PI * 20 = 125.66)
        const hp = Math.round(((player.health ?? 100) / (player.maxHealth ?? 100)) * 100);
        if (hp !== this._cache.hp) {
            this._cache.hp = hp;
            const ring = this._el.querySelector('#ahud-ring-hp');
            if (ring) ring.style.strokeDashoffset = (125.66 * (1 - hp / 100)).toFixed(1);
            const num = this._el.querySelector('#ahud-hp-num');
            if (num) num.textContent = player.health ?? 100;
            // Change icon color when low
            const icon = this._el.querySelector('#ahud-vital-icon');
            if (icon) icon.style.color = hp < 30 ? '#e74c3c' : 'rgba(255,255,255,0.5)';
        }

        // Armor ring (circumference = 2 * PI * 16 = 100.53)
        const ar = Math.round(player.armor ?? 0);
        if (ar !== this._cache.ar) {
            this._cache.ar = ar;
            const ring = this._el.querySelector('#ahud-ring-ar');
            if (ring) ring.style.strokeDashoffset = (100.53 * (1 - ar / 100)).toFixed(1);
        }

        // Wanted stars
        const heat = player.heat || 0;
        const stars = heat >= 90 ? 5 : heat >= 75 ? 4 : heat >= 50 ? 3 : heat >= 25 ? 2 : heat >= 10 ? 1 : 0;
        if (stars !== this._cache.stars) {
            this._cache.stars = stars;
            const pursuit = ps?.getResponseLevel() === 'pursuit';
            const spans = this._el.querySelectorAll('.ahud-stars span');
            spans.forEach((s, i) => {
                s.className = i < stars ? (pursuit ? 'on blink' : 'on') : '';
            });
        }

        // Weapon
        if (combat) {
            const name = combat.weapon.name;
            const ammo = combat.getAmmoDisplay();
            const key = name + ammo;
            if (key !== this._cache.weapon) {
                this._cache.weapon = key;
                const n = this._el.querySelector('#ahud-wname');
                const a = this._el.querySelector('#ahud-wammo');
                if (n) n.textContent = name;
                if (a) a.textContent = ammo;
            }
        }

        // Crosshair — show in street mode when not driving
        const crosshair = this._el.querySelector('#ahud-crosshair');
        if (crosshair) {
            const show = this.game.mode === 'street' && !vc?.isDriving && !ph?.isDead;
            crosshair.classList.toggle('on', show);
        }

        // Speedometer + vehicle type + health bar
        const speedo = this._el.querySelector('#ahud-speedo');
        if (speedo) {
            if (vc?.isDriving) {
                speedo.classList.add('on');
                const spd = vc.getSpeedKmh();
                if (spd !== this._cache.spd) {
                    this._cache.spd = spd;
                    this._el.querySelector('#ahud-speedo-num').textContent = spd;
                }
                // Vehicle type name
                const typeName = vc.getTypeName();
                if (typeName !== this._cache.vtype) {
                    this._cache.vtype = typeName;
                    const vtypeEl = this._el.querySelector('#ahud-vtype');
                    if (vtypeEl) vtypeEl.textContent = typeName;
                }
                // Vehicle health bar
                const veh = vc.getActiveVehicle();
                const hp = veh ? Math.max(0, veh.health ?? 100) : 100;
                const maxHp = veh ? (veh.maxHealth ?? 100) : 100;
                const pct = Math.round((hp / maxHp) * 100);
                const fill = this._el.querySelector('#ahud-vhealth-fill');
                if (fill && pct !== this._cache.vpct) {
                    this._cache.vpct = pct;
                    fill.style.width = pct + '%';
                    fill.style.background = pct > 60 ? '#4caf50' : pct > 30 ? '#ff9800' : '#f44336';
                }
            } else {
                speedo.classList.remove('on');
            }
        }

        // Effects
        this._el.querySelector('#ahud-flash')?.classList.toggle('on', ph?.showDamageFlash || false);
        this._el.querySelector('#ahud-death')?.classList.toggle('on', ph?.isDead || false);
    }

    destroy() {
        this._el?.remove();
    }
}
