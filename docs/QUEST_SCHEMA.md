# Quest Schema Documentation

This document describes the JSON format for quests and storylets in the Dynamic City Builder.

## Overview

Quests are authored as JSON files stored in `src/content/quests/`. The game loads and validates these files at startup, then executes them through the quest engine.

## Quest File Structure

A quest is a JSON object with the following structure:

```json
{
  "id": "case_missing_person",
  "type": "casefile",
  "title": "The Missing Person",
  "description": "A citizen has gone missing from their home.",
  "tags": ["missing", "cctv", "investigation"],
  "steps": [...]
}
```

### Required Fields

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Unique identifier (snake_case) |
| `type` | string | Quest type: `casefile`, `storylet`, or `subcase` |
| `steps` | array | Array of quest steps (minimum 1) |

### Optional Fields

| Field | Type | Description |
|-------|------|-------------|
| `title` | string | Human-readable title |
| `description` | string | Long-form description |
| `tags` | array | Category tags for filtering (e.g., `missing`, `gang`, `corruption`) |
| `weight` | number | For storylets: probability weight (default: 0.5) |

## Step Structure

Steps define what happens during quest progression:

```json
{
  "id": "step_name",
  "kind": "trigger",
  "text": "Step description for UI"
}
```

### Required Step Fields

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Unique step identifier within quest |
| `kind` | string | Step type (see below) |

### Optional Step Fields

| Field | Type | Description |
|-------|------|-------------|
| `text` | string | UI description shown to player |
| `autoAdvance` | number | Steps auto-advance after this many ticks |
| `completeOn` | number | Marks step complete after this many triggers |
| `nextStep` | string | ID of step to advance to (for choices) |
| `onComplete` | array | Actions when step completes |

## Step Kinds

### `trigger` - Wait for Event
Waits for a specific game event to fire.

```json
{
  "id": "start",
  "kind": "trigger",
  "trigger": "ANOMALY_MISSING_PERSON",
  "text": "Report received: Citizen missing from home"
}
```

**Triggers:**
- `ANOMALY_MISSING_PERSON`
- `ANOMALY_CORRUPTION_RUMOR`
- `ANOMALY_GANG_ACTIVITY`
- `ANOMALY_SABOTAGE`
- `ANOMALY_WHALEBlOWER_REQUEST`
- `ANOMALY_VANDALISM`
- `ANOMALY_BLACKMAIL`
- `ANOMALY_SMUGGLING`
- `ANOMALY_PROTEST`

### `hack_node` - Require Player to Hack
Requires player to hack a specific interactable node type.

```json
{
  "id": "clue1_cctv",
  "kind": "hack_node",
  "nodeType": "CCTV",
  "text": "Hack a nearby CCTV pole to find last known location",
  "onComplete": ["spawn_clue:cctv_clip", "advance:travel_location"]
}
```

**Node Types:**
- `CCTV` - Security camera pole
- `TELECOM_BOX` - Telecommunications box
- `POWER_SUBSTATION` - Power distribution node

### `go_to` - Travel to Marker
Requires player to move to a specific location.

```json
{
  "id": "travel_location",
  "kind": "go_to",
  "marker": "last_seen",
  "text": "Travel to the last location seen on CCTV"
}
```

**Markers:**
- `last_seen` - Last known citizen location
- `suspicious_building` - Identified suspicious building
- `saboteur_location` - Saboteur hideout
- `safe_meeting` - Secure meeting point
- `hidden_cache` - Hidden evidence cache
- `smuggling_point` - Smuggling location

### `choice` - Present Options
Presents multiple choices to player.

```json
{
  "id": "choice_method",
  "kind": "choice",
  "text": "How do you stop the saboteur?",
  "choices": [
    {
      "id": "arrest",
      "label": "Arrest and prosecute",
      "effect": "gains_clue:arrest_record",
      "nextStep": "resolve_arrest"
    },
    {
      "id": "silent",
      "label": "Silent elimination",
      "effect": "gains_clue:body_found",
      "nextStep": "resolve_silent"
    }
  ]
}
```

### `investigate` - Search Area
Player must investigate an area (auto-completes on arrival).

```json
{
  "id": "investigate_site",
  "kind": "investigate",
  "text": "Search the area for clues"
}
```

### `interact` - Talk to Citizen
Player must interact with a specific citizen.

```json
{
  "id": "clue1_informant",
  "kind": "interact",
  "interactType": "citizen",
  "text": "Find a gang informant"
}
```

### `outcome` - Apply Consequences
Applies outcome effects (quest completion).

```json
{
  "id": "resolve_final",
  "kind": "outcome",
  "outcomes": [
    {
      "id": "missing_fugitive",
      "label": "Citizen fled due to debt",
      "effect": ["district_residential_stability_down", "reputation_lost"]
    }
  ]
}
```

## Outcome Effects

Outcomes modify game state via effect strings:

### District Modifiers

| Effect | Description |
|--------|-------------|
| `district_corruption_down` | Reduce district corruption |
| `district_security_up` | Increase district security |
| `district_stability_up` | Improve district stability |
| `district_stability_down` | Reduce district stability |
| `district_crime_down` | Reduce district crime |
| `district_crime_neutral` | No district crime change |
| `district_order_up` | Improve public order |
| `district_order_down` | Degrade public order |
| `district_justice_up` | Improve justice perception |
| `district_transparency_up` | Improve government transparency |
| `district_happiness_up` | Increase district happiness |
| `district_happiness_down` | Decrease district happiness |
| `district_income_up` | Increase district income |
| `district_income_down` | Decrease district income |

### Reputation Effects

| Effect | Description |
|--------|-------------|
| `reputation_high` | Significantly boost player reputation |
| `reputation_lost` | Lose player reputation |
| `whistleblower_safe` | Protect whistleblower identity |
| `whistleblower_unknown` | Keep whistleblower anonymous |

### Heat/Faction Effects

| Effect | Description |
|--------|-------------|
| `heat_rival_high` | Increase rival faction pressure |
| `heat_rival_low` | Decrease rival faction pressure |
| `reputation_lost` | Lose reputation |

## Clue Types

Clues are generated by quests and appear in evidence:

| Clue ID | Source | Description |
|---------|--------|-------------|
| `cctv_clip` | Hack CCTV | Video evidence |
| `transaction_log` | Hack Telecom | Financial records |
| `visual_evidence` | Hack CCTV | Person identification |
| `informant_tip` | Interact citizen | Witness information |
| `planned_raid` | Hack Telecom | Gang activity intel |
| `sabotage_log` | Hack Power Substation | Tampering evidence |
| `encrypted_data` | Hack Telecom | Secure communications |
| `saboteur_trace` | Hack Power Substation | Saboteur location |
| `gang_plan` | Interact citizen | Gang operation intel |
| `weapon_cache` | Hack Telecom | Hidden weapons location |
| `document` | Hack Telecom | Paper trail evidence |
| `financial_evidence` | Hack Telecom | Money trail |

## Example: Complete Quest

```json
{
  "id": "case_missing_person",
  "type": "casefile",
  "title": "The Missing Person",
  "description": "A citizen has gone missing from their home. Investigate to find out what happened.",
  "tags": ["missing", "cctv", "district_residential", "investigation"],
  "steps": [
    {
      "id": "start",
      "kind": "trigger",
      "trigger": "ANOMALY_MISSING_PERSON",
      "text": "Report received: Citizen missing from home"
    },
    {
      "id": "clue1_cctv",
      "kind": "hack_node",
      "nodeType": "CCTV",
      "text": "Hack a nearby CCTV pole to find last known location",
      "onComplete": ["spawn_clue:cctv_clip", "advance:travel_location"]
    },
    {
      "id": "travel_location",
      "kind": "go_to",
      "marker": "last_seen",
      "text": "Travel to the last location seen on CCTV"
    },
    {
      "id": "investigate_site",
      "kind": "investigate",
      "text": "Search the area for clues"
    },
    {
      "id": "choice_interrogate",
      "kind": "choice",
      "text": "What's your next move?",
      "choices": [
        {
          "id": "interrogate_witnesses",
          "label": "Interrogate witnesses",
          "effect": "gains_clue:witness_account",
          "nextStep": "resolve_final"
        },
        {
          "id": "check_comms",
          "label": "Check telecom for calls",
          "effect": "gains_clue:phone_records",
          "nextStep": "resolve_final"
        }
      ]
    },
    {
      "id": "resolve_final",
      "kind": "outcome",
      "outcomes": [
        {
          "id": "missing_fugitive",
          "label": "Citizen fled due to debt",
          "effect": ["district_residential_stability_down", "reputation_lost"]
        },
        {
          "id": "missing_kidnapped",
          "label": "Citizen was kidnapped",
          "effect": ["district_security_up", "heat_rival_high"]
        },
        {
          "id": "missing_voluntary",
          "label": "Citizen left voluntarily",
          "effect": ["district_residential_stability_neutral"]
        }
      ]
    }
  ]
}
```

## Validation

Quest files are validated at load time:

- `id` must be present and unique
- `type` must be one of: `casefile`, `storylet`, `subcase`
- `steps` must be an array with at least one element
- Each step must have `id` and `kind`
- `kind` must be one of the valid step types
- `marker` values must match known marker types
- `nodeType` values must match known interactable types

Invalid quest files are skipped with a warning message.