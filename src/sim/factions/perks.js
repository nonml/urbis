export function getRepBand(rep) {
    if (rep <= -60) return 'hostile';
    if (rep <= -20) return 'wary';
    if (rep < 20) return 'neutral';
    if (rep < 60) return 'friendly';
    return 'allied';
}

const PERK_TABLE = {
    police: {
        hostile: { heatDecayMultiplier: 0.5, pursuitPressure: 1.35 },
        wary: { heatDecayMultiplier: 0.8, pursuitPressure: 1.1 },
        neutral: { heatDecayMultiplier: 1, pursuitPressure: 1 },
        friendly: { heatDecayMultiplier: 1.2, pursuitPressure: 0.9 },
        allied: { heatDecayMultiplier: 1.4, pursuitPressure: 0.8 },
    },
    corp: {
        hostile: { wageMultiplier: 1.12, incomeMultiplier: 0.95 },
        wary: { wageMultiplier: 1.05, incomeMultiplier: 0.98 },
        neutral: { wageMultiplier: 1, incomeMultiplier: 1 },
        friendly: { wageMultiplier: 0.95, incomeMultiplier: 1.03 },
        allied: { wageMultiplier: 0.9, incomeMultiplier: 1.06 },
    },
    gangs: {
        hostile: { gangThreat: 1.4, blackMarket: false },
        wary: { gangThreat: 1.15, blackMarket: false },
        neutral: { gangThreat: 1, blackMarket: false },
        friendly: { gangThreat: 0.9, blackMarket: true },
        allied: { gangThreat: 0.75, blackMarket: true },
    },
    citizens: {
        hostile: { happinessBias: -2 },
        wary: { happinessBias: -1 },
        neutral: { happinessBias: 0 },
        friendly: { happinessBias: 1 },
        allied: { happinessBias: 2 },
    },
};

export function getFactionPerks(reputation) {
    const rep = reputation || {};
    const policeBand = getRepBand(rep.police || 0);
    const corpBand = getRepBand(rep.corp || 0);
    const gangsBand = getRepBand(rep.gangs || 0);
    const citizensBand = getRepBand(rep.citizens || 0);

    return {
        bands: {
            police: policeBand,
            corp: corpBand,
            gangs: gangsBand,
            citizens: citizensBand,
        },
        modifiers: {
            ...PERK_TABLE.police[policeBand],
            ...PERK_TABLE.corp[corpBand],
            ...PERK_TABLE.gangs[gangsBand],
            ...PERK_TABLE.citizens[citizensBand],
        },
    };
}
