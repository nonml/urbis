/**
 * Breakable Props System
 * Tracks destructible world objects (crates, barrels, etc.)
 * and fires loot drop hooks on destruction.
 */

const BREAKABLE_TYPES = {
    crate: { hp: 30, lootTable: 'crate_common', debrisCount: 4 },
    barrel: { hp: 20, lootTable: 'barrel_common', debrisCount: 3 },
    vent: { hp: 50, lootTable: null, debrisCount: 2 },
};

const LOOT_TABLES = {
    crate_common: [
        { item: 'ammo_pistol', weight: 4, min: 5, max: 15 },
        { item: 'ammo_smg', weight: 3, min: 10, max: 30 },
        { item: 'health_small', weight: 2, min: 1, max: 1 },
        { item: 'credits', weight: 5, min: 10, max: 50 },
    ],
    barrel_common: [
        { item: 'credits', weight: 3, min: 5, max: 25 },
        { item: 'scrap', weight: 4, min: 1, max: 3 },
    ],
};

export class BreakableManager {
    constructor(game) {
        this._game = game;
        this._props = new Map();
        this._nextId = 1;
        this._onDestroy = [];
    }

    spawn(x, y, type) {
        const def = BREAKABLE_TYPES[type];
        if (!def) return null;
        const id = this._nextId++;
        const prop = { id, x, y, type, hp: def.hp, maxHp: def.hp };
        this._props.set(id, prop);
        return prop;
    }

    damage(id, amount) {
        const prop = this._props.get(id);
        if (!prop) return null;
        prop.hp -= amount;
        if (prop.hp <= 0) {
            return this._destroy(prop);
        }
        return { destroyed: false, prop };
    }

    _destroy(prop) {
        this._props.delete(prop.id);
        const def = BREAKABLE_TYPES[prop.type];
        const loot = this._rollLoot(def?.lootTable);
        const result = {
            destroyed: true,
            prop,
            loot,
            debrisCount: def?.debrisCount ?? 3,
        };
        for (const cb of this._onDestroy) cb(result);
        return result;
    }

    _rollLoot(tableName) {
        if (!tableName) return [];
        const table = LOOT_TABLES[tableName];
        if (!table) return [];
        const rng = this._game.rng ?? { next: () => 0.5 };
        const totalWeight = table.reduce((s, e) => s + e.weight, 0);
        const roll = rng.next() * totalWeight;
        let acc = 0;
        for (const entry of table) {
            acc += entry.weight;
            if (roll < acc) {
                const qty = entry.min + Math.floor(
                    rng.next() * (entry.max - entry.min + 1)
                );
                return [{ item: entry.item, quantity: qty }];
            }
        }
        return [];
    }

    onDestroy(callback) {
        this._onDestroy.push(callback);
    }

    getAt(x, y) {
        for (const prop of this._props.values()) {
            if (prop.x === x && prop.y === y) return prop;
        }
        return null;
    }

    getById(id) {
        return this._props.get(id) ?? null;
    }

    serialize() {
        return {
            nextId: this._nextId,
            props: [...this._props.values()],
        };
    }

    deserialize(data) {
        if (!data) return;
        this._nextId = data.nextId ?? 1;
        this._props.clear();
        for (const p of (data.props || [])) {
            this._props.set(p.id, p);
        }
    }
}
