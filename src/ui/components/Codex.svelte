<script>
    import { codexStore } from '../../stores/codex.js';
    import { CODEX_CONTENT } from '../codex_content.js';
    import { onMount } from 'svelte';

    const CATEGORIES = [
        { id: 'core',      label: 'Core Concepts' },
        { id: 'controls',  label: 'Controls' },
        { id: 'buildings', label: 'Buildings' },
        { id: 'advanced',  label: 'Advanced' },
    ];

    $: s = $codexStore;
    $: entries = (CODEX_CONTENT.en[s.category] ?? []).filter(e =>
        !s.search || e.title.toLowerCase().includes(s.search) || e.content.toLowerCase().includes(s.search)
    );

    function close() { codexStore.update(st => ({ ...st, open: false })); }
    function selectCategory(id) { codexStore.update(st => ({ ...st, category: id })); }

    onMount(() => {
        const handler = (e) => {
            if (!$codexStore.open && e.key === '?') { e.preventDefault(); codexStore.update(st => ({ ...st, open: true })); }
            if ($codexStore.open && e.key === 'Escape') close();
        };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    });
</script>

{#if s.open}
<div id="codex-overlay" class="overlay" style="display:flex">
    <div class="overlay-content" style="max-width:900px;max-height:90vh;overflow:hidden;display:flex;flex-direction:column">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px">
            <h2 style="margin:0">City Codex</h2>
            <button class="btn btn-secondary" on:click={close} style="padding:8px 16px">✕</button>
        </div>

        <div style="display:flex;gap:16px;flex:1;overflow:hidden">
            <!-- Sidebar -->
            <div style="width:180px;flex-shrink:0;overflow-y:auto;border-right:1px solid rgba(255,255,255,0.1);padding-right:16px">
                <div style="margin-bottom:16px">
                    <input type="text" placeholder="Search topics..." value={s.search}
                           on:input={e => codexStore.update(st => ({ ...st, search: e.target.value.toLowerCase() }))}
                           style="width:100%;padding:10px;background:#1a2634;border:1px solid rgba(255,255,255,0.1);color:white;border-radius:4px;box-sizing:border-box">
                </div>
                <div style="display:flex;flex-direction:column;gap:4px">
                    {#each CATEGORIES as cat}
                    <button style="padding:10px;text-align:left;border:1px solid rgba(255,255,255,0.1);color:white;border-radius:4px;cursor:pointer;background:{s.category === cat.id ? '#2f5f4a' : '#1a2634'}"
                            on:click={() => selectCategory(cat.id)}>
                        {cat.label}
                    </button>
                    {/each}
                </div>
            </div>

            <!-- Content -->
            <div style="flex:1;overflow-y:auto;padding-left:16px">
                {#if entries.length === 0}
                <div style="text-align:center;padding:40px 20px;color:#888">No entries found in this category.</div>
                {:else}
                {#each entries as entry (entry.id)}
                <div class="codex-entry" style="background:rgba(255,255,255,0.03);padding:20px;border-radius:8px;margin-bottom:20px;border:1px solid rgba(255,255,255,0.05)">
                    <h3 style="margin-top:0;color:#54d3ff">
                        <span style="font-size:24px;margin-right:10px">{entry.icon}</span>
                        {entry.title}
                    </h3>
                    <!-- svelte-ignore security-anchor-rel-noreferrer -->
                    <div class="codex-text">{@html entry.content}</div>
                </div>
                {/each}
                {/if}
            </div>
        </div>

        <div style="margin-top:16px;text-align:center;font-size:12px;color:#888">
            Press <kbd>?</kbd> to open/close this guide
        </div>
    </div>
</div>
{/if}
