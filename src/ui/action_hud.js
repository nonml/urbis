/**
 * Action HUD — GTA-style HUD overlay
 * Shows: health bar, armor bar, wanted stars, weapon/ammo, speedometer
 */

export class ActionHUD {
    constructor(game) {
        this.game = game;
        this._el = null;
        this._init();
    }

    _init() {
        this._el = document.createElement('div');
        this._el.id = 'action-hud';
        this._el.innerHTML = `
            <div class="ahud-top-right">
                <div class="ahud-wanted" id="ahud-wanted"></div>
            </div>
            <div class="ahud-bottom-left">
                <div class="ahud-health-group">
                    <div class="ahud-bar ahud-health-bar">
                        <div class="ahud-bar-fill ahud-health-fill" id="ahud-health-fill"></div>
                    </div>
                    <div class="ahud-bar ahud-armor-bar">
                        <div class="ahud-bar-fill ahud-armor-fill" id="ahud-armor-fill"></div>
                    </div>
                </div>
            </div>
            <div class="ahud-bottom-right">
                <div class="ahud-weapon" id="ahud-weapon"></div>
                <div class="ahud-speed" id="ahud-speed"></div>
            </div>
            <div class="ahud-damage-flash" id="ahud-damage-flash"></div>
            <div class="ahud-death-overlay" id="ahud-death-overlay">WASTED</div>
        `;

        const style = document.createElement('style');
        style.textContent = `
            #action-hud {
                position: fixed;
                top: 0; left: 0; right: 0; bottom: 0;
                pointer-events: none;
                z-index: 50;
                font-family: 'Courier New', monospace;
            }
            .ahud-top-right {
                position: absolute;
                top: 12px;
                right: 12px;
            }
            .ahud-wanted {
                display: flex;
                gap: 4px;
                font-size: 22px;
                filter: drop-shadow(0 1px 2px rgba(0,0,0,0.8));
            }
            .ahud-star {
                color: #333;
                transition: color 0.2s;
            }
            .ahud-star.active {
                color: #ffcc00;
                text-shadow: 0 0 8px #ff8800;
            }
            .ahud-star.flashing {
                animation: starFlash 0.4s infinite alternate;
            }
            @keyframes starFlash {
                from { opacity: 1; }
                to { opacity: 0.3; }
            }
            .ahud-bottom-left {
                position: absolute;
                bottom: 16px;
                left: 16px;
            }
            .ahud-health-group {
                display: flex;
                flex-direction: column;
                gap: 3px;
            }
            .ahud-bar {
                width: 200px;
                height: 12px;
                background: rgba(0,0,0,0.6);
                border-radius: 2px;
                overflow: hidden;
                border: 1px solid rgba(255,255,255,0.15);
            }
            .ahud-bar-fill {
                height: 100%;
                transition: width 0.15s ease;
            }
            .ahud-health-fill {
                background: linear-gradient(90deg, #cc2222, #ee4444);
                width: 100%;
            }
            .ahud-armor-fill {
                background: linear-gradient(90deg, #2266cc, #4488ee);
                width: 0%;
            }
            .ahud-bottom-right {
                position: absolute;
                bottom: 16px;
                right: 16px;
                text-align: right;
                color: #fff;
                text-shadow: 0 1px 3px rgba(0,0,0,0.9);
            }
            .ahud-weapon {
                font-size: 14px;
                margin-bottom: 4px;
            }
            .ahud-speed {
                font-size: 24px;
                font-weight: bold;
                opacity: 0;
                transition: opacity 0.3s;
            }
            .ahud-speed.visible {
                opacity: 1;
            }
            .ahud-damage-flash {
                position: fixed;
                top: 0; left: 0; right: 0; bottom: 0;
                background: radial-gradient(ellipse at center, transparent 40%, rgba(180,0,0,0.4) 100%);
                pointer-events: none;
                opacity: 0;
                transition: opacity 0.15s;
            }
            .ahud-damage-flash.active {
                opacity: 1;
            }
            .ahud-death-overlay {
                position: fixed;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                font-size: 72px;
                font-weight: bold;
                color: #cc0000;
                text-shadow: 0 0 20px rgba(200,0,0,0.8), 0 4px 8px rgba(0,0,0,0.9);
                letter-spacing: 8px;
                opacity: 0;
                transition: opacity 0.5s;
                pointer-events: none;
            }
            .ahud-death-overlay.active {
                opacity: 1;
            }
        `;

        document.head.appendChild(style);
        document.body.appendChild(this._el);
    }

    update() {
        const game = this.game;
        const player = game.state.player;
        const ph = game.playerHealth;
        const combat = game.combat;
        const vc = game.vehicleController;

        // Health bar
        const healthFill = this._el.querySelector('#ahud-health-fill');
        if (healthFill) {
            const ratio = (player.health ?? 100) / (player.maxHealth ?? 100);
            healthFill.style.width = `${ratio * 100}%`;
        }

        // Armor bar
        const armorFill = this._el.querySelector('#ahud-armor-fill');
        if (armorFill) {
            const ratio = (player.armor ?? 0) / 100;
            armorFill.style.width = `${ratio * 100}%`;
        }

        // Wanted stars (5 stars based on heat)
        const wantedEl = this._el.querySelector('#ahud-wanted');
        if (wantedEl) {
            const heat = player.heat || 0;
            let stars = 0;
            if (heat >= 90) stars = 5;
            else if (heat >= 75) stars = 4;
            else if (heat >= 50) stars = 3;
            else if (heat >= 25) stars = 2;
            else if (heat >= 10) stars = 1;

            const inPursuit = game.policeSystem?.getResponseLevel() === 'pursuit';
            let html = '';
            for (let i = 0; i < 5; i++) {
                const active = i < stars;
                const flashing = active && inPursuit;
                html += `<span class="ahud-star${active ? ' active' : ''}${flashing ? ' flashing' : ''}">★</span>`;
            }
            wantedEl.innerHTML = html;
        }

        // Weapon / ammo
        const weaponEl = this._el.querySelector('#ahud-weapon');
        if (weaponEl && combat) {
            const w = combat.weapon;
            const ammo = combat.getAmmoDisplay();
            weaponEl.textContent = `${w.name} | ${ammo}`;
        }

        // Speedometer (only when driving)
        const speedEl = this._el.querySelector('#ahud-speed');
        if (speedEl) {
            if (vc?.isDriving) {
                speedEl.classList.add('visible');
                speedEl.textContent = `${vc.getSpeedKmh()} km/h`;
            } else {
                speedEl.classList.remove('visible');
            }
        }

        // Damage flash
        const flashEl = this._el.querySelector('#ahud-damage-flash');
        if (flashEl) {
            flashEl.classList.toggle('active', ph?.showDamageFlash || false);
        }

        // Death overlay
        const deathEl = this._el.querySelector('#ahud-death-overlay');
        if (deathEl) {
            deathEl.classList.toggle('active', ph?.isDead || false);
        }
    }

    destroy() {
        this._el?.remove();
    }
}
