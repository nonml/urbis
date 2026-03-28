<script>
    import { resourceStore } from '../../stores/resources.js';
    import { tweened } from 'svelte/motion';
    import { cubicOut } from 'svelte/easing';

    const gold     = tweened(100, { duration: 400, easing: cubicOut });
    const food     = tweened(100, { duration: 400, easing: cubicOut });
    const wood     = tweened(100, { duration: 400, easing: cubicOut });

    let population = 3, housing = 10, day = 1;
    let heat = 0;
    let weather = { icon: '☀️', type: 'clear', speedModifier: 1 };
    let rival = { influence: 0, currentAction: null };

    let prevGold = 100, prevFood = 100, prevWood = 100;
    let goldDelta = 0, foodDelta = 0, woodDelta = 0;
    let goldFlash = '', foodFlash = '', woodFlash = '';
    let showUnaffordableFlash = false;

    function flashClass(delta) {
        return delta > 0 ? 'res-gain' : delta < 0 ? 'res-loss' : '';
    }

    resourceStore.subscribe(r => {
        goldDelta = Math.floor(r.gold) - Math.floor(prevGold);
        foodDelta = Math.floor(r.food) - Math.floor(prevFood);
        woodDelta = Math.floor(r.wood) - Math.floor(prevWood);

        if (goldDelta !== 0) goldFlash = flashClass(goldDelta);
        if (foodDelta !== 0) foodFlash = flashClass(foodDelta);
        if (woodDelta !== 0) woodFlash = flashClass(woodDelta);

        gold.set(Math.floor(r.gold));
        food.set(Math.floor(r.food));
        wood.set(Math.floor(r.wood));

        prevGold = r.gold;
        prevFood = r.food;
        prevWood = r.wood;

        population = r.population;
        housing    = r.housing;
        day        = r.day;
        heat       = r.heat ?? 0;
        weather    = r.weather ?? { icon: '☀️', type: 'clear', speedModifier: 1 };
        rival      = r.rival ?? { influence: 0, currentAction: null };

        // Handle unaffordable flash
        if (r.unaffordable) {
            showUnaffordableFlash = true;
            setTimeout(() => { showUnaffordableFlash = false; }, 400);
        }

        // Clear flash after animation
        setTimeout(() => { goldFlash = ''; foodFlash = ''; woodFlash = ''; }, 600);
    });

    $: overcrowded = population > housing;
    $: heatColor = heat >= 70 ? '#ff4444' : heat >= 30 ? '#ffaa00' : '#44ff44';
    $: rivalColor = rival.influence >= 80 ? '#ff4444' : rival.influence >= 60 ? '#ffaa00' : '#aaaaaa';
    $: weatherTip = weather.speedModifier < 1
        ? `Weather: ${weather.type} (−${Math.round((1 - weather.speedModifier) * 100)}% food/wood)`
        : `Weather: ${weather.type}`;
</script>

<div id="resource-bar">
    <div class="resource" id="gold-display">
        <span class="icon">💰</span>
        <span class="amount {goldFlash} {showUnaffordableFlash ? 'res-unaffordable' : ''}" id="gold-amount">{Math.round($gold)}</span>
    </div>
    <div class="resource" id="food-display">
        <span class="icon">🌾</span>
        <span class="amount {foodFlash}" id="food-amount">{Math.round($food)}</span>
    </div>
    <div class="resource" id="wood-display">
        <span class="icon">🌲</span>
        <span class="amount {woodFlash}" id="wood-amount">{Math.round($wood)}</span>
    </div>
    <div class="resource" id="population-display"
         style="border: 3px solid {overcrowded ? '#ff6b6b' : '#fff'}; box-shadow: 0 4px 0 {overcrowded ? '#ff6b6b' : 'rgba(0,0,0,0.15)'}">
        <span class="icon">👥</span>
        <span class="amount" id="population-amount">{population}</span>
    </div>
    <div class="resource" id="day-display">
        <span class="icon">📅</span>
        <span class="amount" id="day-amount">Day {day}</span>
    </div>

    <!-- Heat meter (only shown when > 0) -->
    {#if heat > 0}
    <div class="resource heat-meter" id="heat-meter" style="border-color: {heatColor}">
        <span class="icon">🔥</span>
        <div class="heat-bar-container">
            <div class="heat-bar" id="heat-bar">
                <div class="heat-fill" id="heat-fill" style="width: {heat}%"></div>
            </div>
            <span class="heat-label" id="heat-label">{heat}</span>
        </div>
    </div>
    {/if}

    <!-- Weather indicator -->
    <div class="resource" id="weather-indicator"
         style="padding:2px 8px;font-size:18px;cursor:default;"
         title={weatherTip}>
        {weather.icon}
    </div>

    <!-- Rival indicator (only when active) -->
    {#if rival.influence > 0}
    <div class="resource" id="rival-indicator"
         style="padding:2px 8px;font-size:12px;cursor:default;white-space:nowrap;"
         title="Rival influence: {rival.influence}%{rival.currentAction ? '\nActive: ' + rival.currentAction : ''}">
        <span style="color: {rivalColor}">🕵️ {Math.round(rival.influence)}%{rival.currentAction ? ' — ' + rival.currentAction.replace(/_/g, ' ') : ''}</span>
    </div>
    {/if}
</div>
