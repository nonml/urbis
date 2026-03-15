<script>
    import { buildMenuStore } from '../../stores/build_menu.js';
    import { BUILDING_TYPES } from '../../constants.js';

    $: s = $buildMenuStore;
    $: def = s.selectedType ? (BUILDING_TYPES[s.selectedType] ?? null) : null;

    $: costParts = (() => {
        if (!def?.cost) return [];
        const c = def.cost;
        const parts = [];
        if (c.gold) parts.push(`💰${c.gold}`);
        if (c.wood) parts.push(`🌲${c.wood}`);
        if (c.food) parts.push(`🌾${c.food}`);
        return parts;
    })();

    $: rotDeg = (s.rotation ?? 0) * 90;
</script>

<div id="build-mode-hud" class="build-mode-hud">
    {#if !s.selectedType}
        Build: Off (B to toggle panel)
    {:else}
        {def?.name ?? s.selectedType}
        | Rot {rotDeg}°
        | Upkeep {def?.upkeep ?? 0}
        {#if costParts.length}| Cost {costParts.join(' ')}{/if}
        {#if s.preview && !s.preview.ok}
            <span style="color:#ff6b6b"> | {s.preview.reason}</span>
        {/if}
    {/if}
</div>
