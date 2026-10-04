## 2026-10-04 — sweep draft: first-minutes (50 shots)

Draft for `docs/shots/REVIEW.md` — judge every shot before pasting (AGENTS.md step 5).

`node scripts/sweep.mjs --poses docs/shots/poses/first-minutes.json` on seeds 7, 11, 22, 33, 73 (generated); 5.5 min of the 10 min budget; draws ≤ 175, frameCheck ≤ 2%.
Worst peak 141; 45 of 50 shots flagged; 0 page error(s).

| Shot | Seed | draws | peak | blocked | Flags |
|---|---|---|---|---|---|
| m1-sweep-s7-north-day.png | 7 | 129 | 129 | 0.0% | raw primitives: Group/Mesh (BoxGeometry) ×3 |
| m1-sweep-s7-east-day.png | 7 | 132 | 132 | 0.0% | raw primitives: Mesh (SphereGeometry) ×1, Group/Mesh (CylinderGeometry) ×1, Group/Mesh (BoxGeometry) ×1 |
| m1-sweep-s7-south-day.png | 7 | 138 | 138 | 0.0% | raw primitives: Group/Mesh (BoxGeometry) ×9 |
| m1-sweep-s7-west-day.png | 7 | 129 | 138 | 0.0% | raw primitives: Mesh (SphereGeometry) ×7, Group/Mesh (BoxGeometry) ×10 |
| m1-sweep-s7-north-night.png | 7 | 114 | 129 | 0.0% | raw primitives: Group/Mesh (BoxGeometry) ×3 |
| m1-sweep-s7-east-night.png | 7 | 119 | 122 | 0.0% | raw primitives: Mesh (SphereGeometry) ×1, Group/Mesh (CylinderGeometry) ×1, Group/Mesh (BoxGeometry) ×1 |
| m1-sweep-s7-south-night.png | 7 | 126 | 126 | 0.0% | raw primitives: Group/Mesh (BoxGeometry) ×10 |
| m1-sweep-s7-west-night.png | 7 | 114 | 126 | 0.0% | raw primitives: Mesh (SphereGeometry) ×7, Group/Mesh (BoxGeometry) ×10 |
| m1-sweep-s7-city-day.png | 7 | 141 | 141 | 0.0% | raw primitives: Group/Mesh (BoxGeometry) ×3 |
| m1-sweep-s7-city-night.png | 7 | 129 | 141 | 0.0% | raw primitives: Group/Mesh (BoxGeometry) ×3 |
| m1-sweep-s11-north-day.png | 11 | 125 | 125 | 0.0% | raw primitives: Mesh (SphereGeometry) ×2, Group/Mesh (BoxGeometry) ×4 |
| m1-sweep-s11-east-day.png | 11 | 133 | 133 | 0.0% | raw primitives: Group/Mesh (BoxGeometry) ×22 |
| m1-sweep-s11-south-day.png | 11 | 134 | 134 | 0.0% | raw primitives: Group/Mesh (BoxGeometry) ×5 |
| m1-sweep-s11-west-day.png | 11 | 125 | 134 | 0.0% | raw primitives: Group/Mesh (BoxGeometry) ×30 |
| m1-sweep-s11-north-night.png | 11 | 110 | 125 | 0.0% | raw primitives: Mesh (SphereGeometry) ×2, Group/Mesh (BoxGeometry) ×6, Group/Mesh (CylinderGeometry) ×1 |
| m1-sweep-s11-east-night.png | 11 | 120 | 123 | 0.0% | raw primitives: Group/Mesh (BoxGeometry) ×27 |
| m1-sweep-s11-south-night.png | 11 | 122 | 122 | 0.0% | raw primitives: Group/Mesh (BoxGeometry) ×17 |
| m1-sweep-s11-west-night.png | 11 | 110 | 122 | 0.0% | raw primitives: Group/Mesh (BoxGeometry) ×30 |
| m1-sweep-s11-city-day.png | 11 | 140 | 140 | 0.0% | raw primitives: Group/Mesh (BoxGeometry) ×5 |
| m1-sweep-s11-city-night.png | 11 | 128 | 140 | 0.0% | raw primitives: Group/Mesh (BoxGeometry) ×5 |
| m1-sweep-s22-north-day.png | 22 | 127 | 127 | 0.0% | raw primitives: Group/Mesh (BoxGeometry) ×6 |
| m1-sweep-s22-east-day.png | 22 | 135 | 135 | 0.0% | raw primitives: Group/Mesh (BoxGeometry) ×5 |
| m1-sweep-s22-south-day.png | 22 | 134 | 138 | 0.0% | raw primitives: Mesh (SphereGeometry) ×1, Group/Mesh (BoxGeometry) ×6 |
| m1-sweep-s22-west-day.png | 22 | 126 | 137 | 0.0% | raw primitives: Mesh (SphereGeometry) ×1, Group/Mesh (BoxGeometry) ×28, Group/Mesh (CylinderGeometry) ×2 |
| m1-sweep-s22-north-night.png | 22 | 112 | 127 | 0.0% | raw primitives: Group/Mesh (BoxGeometry) ×12 |
| m1-sweep-s22-east-night.png | 22 | 122 | 122 | 0.0% | raw primitives: Group/Mesh (BoxGeometry) ×17 |
| m1-sweep-s22-south-night.png | 22 | 122 | 122 | 0.0% | raw primitives: Mesh (SphereGeometry) ×1, Group/Mesh (BoxGeometry) ×4 |
| m1-sweep-s22-west-night.png | 22 | 111 | 122 | 0.0% | raw primitives: Mesh (SphereGeometry) ×1, Group/Mesh (BoxGeometry) ×27, Group/Mesh (CylinderGeometry) ×2 |
| m1-sweep-s22-city-day.png | 22 | 140 | 140 | 0.0% | raw primitives: Group/Mesh (BoxGeometry) ×7 |
| m1-sweep-s22-city-night.png | 22 | 128 | 140 | 0.0% | raw primitives: Group/Mesh (BoxGeometry) ×7 |
| m1-sweep-s33-north-day.png | 33 | 125 | 125 | 0.0% | raw primitives: Group/Mesh (BoxGeometry) ×20 |
| m1-sweep-s33-east-day.png | 33 | 135 | 135 | 0.0% | raw primitives: Group/Mesh (BoxGeometry) ×48 |
| m1-sweep-s33-south-day.png | 33 | 135 | 135 | 0.0% | — |
| m1-sweep-s33-west-day.png | 33 | 127 | 135 | 0.0% | — |
| m1-sweep-s33-north-night.png | 33 | 110 | 130 | 0.0% | raw primitives: Group/Mesh (BoxGeometry) ×17 |
| m1-sweep-s33-east-night.png | 33 | 123 | 126 | 0.0% | raw primitives: Group/Mesh (BoxGeometry) ×47 |
| m1-sweep-s33-south-night.png | 33 | 123 | 123 | 0.0% | raw primitives: Group/Mesh (BoxGeometry) ×1 |
| m1-sweep-s33-west-night.png | 33 | 112 | 123 | 0.0% | — |
| m1-sweep-s33-city-day.png | 33 | 140 | 140 | 0.0% | raw primitives: Group/Mesh (BoxGeometry) ×8 |
| m1-sweep-s33-city-night.png | 33 | 128 | 140 | 0.0% | raw primitives: Group/Mesh (BoxGeometry) ×8 |
| m1-sweep-s73-north-day.png | 73 | 123 | 123 | 0.0% | raw primitives: Group/Mesh (BoxGeometry) ×13, Mesh (SphereGeometry) ×2 |
| m1-sweep-s73-east-day.png | 73 | 136 | 136 | 0.0% | raw primitives: Group/Mesh (BoxGeometry) ×28, Mesh (SphereGeometry) ×1 |
| m1-sweep-s73-south-day.png | 73 | 133 | 136 | 0.0% | raw primitives: Mesh (SphereGeometry) ×1, Group/Mesh (BoxGeometry) ×8 |
| m1-sweep-s73-west-day.png | 73 | 124 | 133 | 0.0% | — |
| m1-sweep-s73-north-night.png | 73 | 109 | 124 | 0.0% | raw primitives: Group/Mesh (BoxGeometry) ×15, Mesh (SphereGeometry) ×2 |
| m1-sweep-s73-east-night.png | 73 | 124 | 127 | 0.0% | raw primitives: Group/Mesh (BoxGeometry) ×30, Mesh (SphereGeometry) ×2 |
| m1-sweep-s73-south-night.png | 73 | 121 | 124 | 0.0% | raw primitives: Mesh (SphereGeometry) ×1, Group/Mesh (BoxGeometry) ×8 |
| m1-sweep-s73-west-night.png | 73 | 109 | 121 | 0.0% | — |
| m1-sweep-s73-city-day.png | 73 | 141 | 141 | 0.0% | raw primitives: Group/Mesh (BoxGeometry) ×11, Group/Mesh (CylinderGeometry) ×1 |
| m1-sweep-s73-city-night.png | 73 | 129 | 141 | 0.0% | raw primitives: Group/Mesh (BoxGeometry) ×10 |

### Flags

- **m1-sweep-s7-north-day.png** — raw primitives: Group/Mesh (BoxGeometry) ×3
- **m1-sweep-s7-east-day.png** — raw primitives: Mesh (SphereGeometry) ×1, Group/Mesh (CylinderGeometry) ×1, Group/Mesh (BoxGeometry) ×1
- **m1-sweep-s7-south-day.png** — raw primitives: Group/Mesh (BoxGeometry) ×9
- **m1-sweep-s7-west-day.png** — raw primitives: Mesh (SphereGeometry) ×7, Group/Mesh (BoxGeometry) ×10
- **m1-sweep-s7-north-night.png** — raw primitives: Group/Mesh (BoxGeometry) ×3
- **m1-sweep-s7-east-night.png** — raw primitives: Mesh (SphereGeometry) ×1, Group/Mesh (CylinderGeometry) ×1, Group/Mesh (BoxGeometry) ×1
- **m1-sweep-s7-south-night.png** — raw primitives: Group/Mesh (BoxGeometry) ×10
- **m1-sweep-s7-west-night.png** — raw primitives: Mesh (SphereGeometry) ×7, Group/Mesh (BoxGeometry) ×10
- **m1-sweep-s7-city-day.png** — raw primitives: Group/Mesh (BoxGeometry) ×3
- **m1-sweep-s7-city-night.png** — raw primitives: Group/Mesh (BoxGeometry) ×3
- **m1-sweep-s11-north-day.png** — raw primitives: Mesh (SphereGeometry) ×2, Group/Mesh (BoxGeometry) ×4
- **m1-sweep-s11-east-day.png** — raw primitives: Group/Mesh (BoxGeometry) ×22
- **m1-sweep-s11-south-day.png** — raw primitives: Group/Mesh (BoxGeometry) ×5
- **m1-sweep-s11-west-day.png** — raw primitives: Group/Mesh (BoxGeometry) ×30
- **m1-sweep-s11-north-night.png** — raw primitives: Mesh (SphereGeometry) ×2, Group/Mesh (BoxGeometry) ×6, Group/Mesh (CylinderGeometry) ×1
- **m1-sweep-s11-east-night.png** — raw primitives: Group/Mesh (BoxGeometry) ×27
- **m1-sweep-s11-south-night.png** — raw primitives: Group/Mesh (BoxGeometry) ×17
- **m1-sweep-s11-west-night.png** — raw primitives: Group/Mesh (BoxGeometry) ×30
- **m1-sweep-s11-city-day.png** — raw primitives: Group/Mesh (BoxGeometry) ×5
- **m1-sweep-s11-city-night.png** — raw primitives: Group/Mesh (BoxGeometry) ×5
- **m1-sweep-s22-north-day.png** — raw primitives: Group/Mesh (BoxGeometry) ×6
- **m1-sweep-s22-east-day.png** — raw primitives: Group/Mesh (BoxGeometry) ×5
- **m1-sweep-s22-south-day.png** — raw primitives: Mesh (SphereGeometry) ×1, Group/Mesh (BoxGeometry) ×6
- **m1-sweep-s22-west-day.png** — raw primitives: Mesh (SphereGeometry) ×1, Group/Mesh (BoxGeometry) ×28, Group/Mesh (CylinderGeometry) ×2
- **m1-sweep-s22-north-night.png** — raw primitives: Group/Mesh (BoxGeometry) ×12
- **m1-sweep-s22-east-night.png** — raw primitives: Group/Mesh (BoxGeometry) ×17
- **m1-sweep-s22-south-night.png** — raw primitives: Mesh (SphereGeometry) ×1, Group/Mesh (BoxGeometry) ×4
- **m1-sweep-s22-west-night.png** — raw primitives: Mesh (SphereGeometry) ×1, Group/Mesh (BoxGeometry) ×27, Group/Mesh (CylinderGeometry) ×2
- **m1-sweep-s22-city-day.png** — raw primitives: Group/Mesh (BoxGeometry) ×7
- **m1-sweep-s22-city-night.png** — raw primitives: Group/Mesh (BoxGeometry) ×7
- **m1-sweep-s33-north-day.png** — raw primitives: Group/Mesh (BoxGeometry) ×20
- **m1-sweep-s33-east-day.png** — raw primitives: Group/Mesh (BoxGeometry) ×48
- **m1-sweep-s33-north-night.png** — raw primitives: Group/Mesh (BoxGeometry) ×17
- **m1-sweep-s33-east-night.png** — raw primitives: Group/Mesh (BoxGeometry) ×47
- **m1-sweep-s33-south-night.png** — raw primitives: Group/Mesh (BoxGeometry) ×1
- **m1-sweep-s33-city-day.png** — raw primitives: Group/Mesh (BoxGeometry) ×8
- **m1-sweep-s33-city-night.png** — raw primitives: Group/Mesh (BoxGeometry) ×8
- **m1-sweep-s73-north-day.png** — raw primitives: Group/Mesh (BoxGeometry) ×13, Mesh (SphereGeometry) ×2
- **m1-sweep-s73-east-day.png** — raw primitives: Group/Mesh (BoxGeometry) ×28, Mesh (SphereGeometry) ×1
- **m1-sweep-s73-south-day.png** — raw primitives: Mesh (SphereGeometry) ×1, Group/Mesh (BoxGeometry) ×8
- **m1-sweep-s73-north-night.png** — raw primitives: Group/Mesh (BoxGeometry) ×15, Mesh (SphereGeometry) ×2
- **m1-sweep-s73-east-night.png** — raw primitives: Group/Mesh (BoxGeometry) ×30, Mesh (SphereGeometry) ×2
- **m1-sweep-s73-south-night.png** — raw primitives: Mesh (SphereGeometry) ×1, Group/Mesh (BoxGeometry) ×8
- **m1-sweep-s73-city-day.png** — raw primitives: Group/Mesh (BoxGeometry) ×11, Group/Mesh (CylinderGeometry) ×1
- **m1-sweep-s73-city-night.png** — raw primitives: Group/Mesh (BoxGeometry) ×10
