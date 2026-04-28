/**
 * Sample hack chains — 5 pre-built environmental combos.
 */

export const SAMPLE_CHAINS = [
    {
        id: 'steam_ambush',
        name: 'Steam Ambush',
        description: 'Burst a pipe then drop a crane on the fleeing targets.',
        cooldown: 50,
        steps: [
            { action: 'steam_pipe', delay: 0, offsetX: 0, offsetY: 0 },
            { action: 'crane_drop', delay: 6, offsetX: 3, offsetY: 0 },
        ],
    },
    {
        id: 'intersection_trap',
        name: 'Intersection Trap',
        description: 'Chaos the lights, raise barriers to trap vehicles, then gas explosion.',
        cooldown: 60,
        steps: [
            { action: 'traffic_lights', delay: 0, offsetX: 0, offsetY: 0 },
            { action: 'barrier', delay: 3, offsetX: 4, offsetY: 0 },
            { action: 'barrier', delay: 3, offsetX: -4, offsetY: 0 },
            { action: 'explosion_gas', delay: 8, offsetX: 0, offsetY: 0 },
        ],
    },
    {
        id: 'blackout_breach',
        name: 'Blackout Breach',
        description: 'Kill the cameras, blackout the block, slip through undetected.',
        cooldown: 45,
        steps: [
            { action: 'cctv_disable', delay: 0, offsetX: 0, offsetY: 0 },
            { action: 'explosion_electrical', delay: 2, offsetX: 1, offsetY: 1 },
        ],
    },
    {
        id: 'double_pipe',
        name: 'Double Pipe',
        description: 'Two steam bursts flank a corridor.',
        cooldown: 40,
        steps: [
            { action: 'steam_pipe', delay: 0, offsetX: -3, offsetY: 0 },
            { action: 'steam_pipe', delay: 2, offsetX: 3, offsetY: 0 },
        ],
    },
    {
        id: 'crane_and_block',
        name: 'Crane & Block',
        description: 'Block the escape route then drop heavy metal.',
        cooldown: 55,
        steps: [
            { action: 'barrier', delay: 0, offsetX: 5, offsetY: 0 },
            { action: 'barrier', delay: 0, offsetX: -5, offsetY: 0 },
            { action: 'crane_drop', delay: 4, offsetX: 0, offsetY: 0 },
        ],
    },
];
