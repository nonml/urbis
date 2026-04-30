# Save Schema Documentation

**Current Version:** `8` (Q8 — Playability Pass 2)

## Schema Structure

```json
{
    "schemaVersion": 8,
    "meta": {
        "seed": 123456789,
        "mapPreset": "SMALL",
        "mapWidth": 96,
        "mapHeight": 96,
        "createdAt": 1700000000000,
        "runId": "uuid"
    },
    "time": {
        "tick": 0,
        "paused": false,
        "simDt": 0.2
    },
    "resources": {
        "gold": 0,
        "food": 0,
        "wood": 0,
        "jobProduction": { "gold": 0, "food": 0, "wood": 0 },
        "totalGoldEarned": 0,
        "totalFoodProduced": 0,
        "totalWoodProduced": 0
    },
    "player": {
        "x": 0,
        "y": 0,
        "wx": 0,
        "wz": 0,
        "yaw": 0,
        "pitch": -0.35,
        "health": 100,
        "reputation": 0
    },
    "stealth": {
        "isCrouching": false,
        "visibility": "exposed",
        "detectionLevel": 0
    },
    "combat": {
        "currentWeapon": "fist",
        "heat": 0,
        "wantedLevel": 0
    },
    "vehicles": {
        "activeId": null,
        "damageStage": 0
    },
    "wanted": {
        "level": 0,
        "timer": 0,
        "responders": []
    },
    "districts": {},
    "progress": {
        "unlocks": { "buildings": [], "hacks": [] },
        "rewardLog": {},
        "runFlags": {}
    },
    "cameraNetwork": {
        "hacked": [],
        "traversalPath": []
    },
    "profiler": {
        "targets": [],
        "relationsGraph": {}
    },
    "hackChains": {
        "active": [],
        "cooldowns": {}
    },
    "audio": {
        "ttsEnabled": true,
        "subtitlesEnabled": true,
        "subtitleSize": "medium",
        "radioChannel": 0,
        "radioVolume": 0.7
    },
    "arc": {
        "currentArc": null,
        "completedMissions": [],
        "missionFlags": {}
    },
    "tutorial": {
        "completed": false,
        "currentStep": 0,
        "skipped": false
    },
    "accessibility": {
        "colorblindMode": "none",
        "reducedMotion": false
    },
    "activeQuests": [],
    "completedQuests": []
}
```

## Migration History

| Version | Quarter | Changes |
|---------|---------|---------|
| 0 → 1 | Initial | Add schemaVersion, meta, time, resources normalization |
| 2 → 3 | Q3 | Stealth system, combat state |
| 3 → 4 | Q4 | Vehicle system, wanted escalation |
| 4 → 5 | Q5 | Districts, content progress, unlocks |
| 5 → 6 | Q6 | Camera network, profiler, hack chains |
| 6 → 7 | Q7 | TTS/subtitles/audio, arc missions |
| 7 → 8 | Q8 | Tutorial state, zero-hostilities, colorblind mode |

## Breaking Changes

- Schema version must always be present
- Missing fields are filled with defaults during migration
- No data is lost during migration — only additions and renames
