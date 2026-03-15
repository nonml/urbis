import { UNLOCKS } from '../sim/progression.js';
import { techScreenStore } from '../stores/tech_screen.js';

export class TechScreen {
    constructor(game) {
        this.game = game;
        this.shown = false;
    }

    toggle() {
        this.shown = !this.shown;
        if (this.shown) this.update();
        else techScreenStore.update(s => ({ ...s, open: false }));
    }

    close() {
        this.shown = false;
        techScreenStore.update(s => ({ ...s, open: false }));
    }

    update() {
        const progression = this.game.state.progression || { points: 0, unlocked: [], completedCases: 0, districtStability: {} };

        const unlocks = Object.entries(UNLOCKS).map(([id, u]) => ({
            id,
            name:        u.name,
            description: u.description,
            trigger:     u.trigger,
            isUnlocked:  (progression.unlocked || []).includes(id),
        }));

        const rawDistricts = this.game.map?.districts ?? [];
        const districts = rawDistricts.map(d => ({
            id:        d.id,
            name:      d.name || 'Unknown District',
            stability: progression.districtStability?.[d.id] ?? 50,
        }));

        techScreenStore.set({
            open:           true,
            points:         progression.points || 0,
            maxPoints:      200,
            completedCases: progression.completedCases || 0,
            buildings:      this.game.buildings?.buildings?.length ?? 0,
            days:           this.game.resources?.day ?? 0,
            unlocks,
            districts,
        });
    }

    // Legacy compat
    createOverlay() {}
}
