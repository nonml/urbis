# Regression Seeds

Fixed seeds for regression testing across milestones. These seeds should produce consistent, reproducible results.

## Core Regression Seeds (10 seeds)

| Seed | Map Size | Expected Outcome | Notes |
|------|----------|------------------|-------|
| 12345 | Small (40x40) | Stable 15-min session | Baseline seed |
| 67890 | Small (40x40) | Stable 15-min session | High variation |
| 11111 | City (96x96) | Stable 15-min session | Medium density |
| 22222 | City (96x96) | Stable 15-min session | Low density |
| 33333 | City (96x96) | Stable 15-min session | High density |
| 44444 | Mega (256x256) | Loadable, explorable | Performance check |
| 55555 | Mega (256x256) | Loadable, explorable | Performance check |
| 99999 | Small (40x40) | Crisis triggers | Stress test |
| 88888 | City (96x96) | Multiple cases | Quest test |
| 77777 | Mega (256x256) | Stable 20-min | Soak test |

## Running Regression Tests

### Automated (Smoke Test)
```bash
node scripts/smoke_test.mjs --seed 12345
node scripts/smoke_test.mjs --seed 67890
# ... repeat for all seeds
```

### Manual Testing
1. Start new game with seed
2. Play for target duration
3. Record any crashes, errors, or unexpected behavior
4. Save game state at end for comparison

## Expected Invariants

For all seeds:
- No NaN values in citizen stats
- Resources stay non-negative (or documented negative allowed)
- Tile coordinates within bounds
- No infinite loops during generation
- Quests complete or fail gracefully

## Seed Characteristics

### 12345 - Baseline
- Balanced district distribution
- Normal crisis frequency
- Standard case generation

### 67890 - High Variation
- Unusual district patterns
- More frequent crises
- Tests edge cases

### 44444, 55555, 77777 - Mega Performance
- Large map loading
- Chunk streaming behavior
- Memory usage monitoring

## Adding New Seeds

When adding a new regression seed:
1. Pick an unused integer
2. Test across all map sizes
3. Document expected behavior
4. Add to CI/CD pipeline if applicable