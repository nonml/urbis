# Milestone L: Player vehicles v1 (driving, entering/exiting, road adherence)

## Objective
Introduce Watch Dogs core mobility: steal/enter vehicles and drive through the city reliably.

## Exit criteria (acceptance for milestone)
- Player can enter/exit vehicles with animation stub and camera swap.
- Driving model works: accelerate, brake, steer, handbrake.
- Vehicles follow road surface and collide with buildings/props.
- MEGA city driving is stable with streaming chunks.

## Phases
- L1: Vehicle entity + physics-lite controller
- L2: Road-follow + collision
- L3: Camera + UI + spawning

## Tickets

## Ticket L-1: Vehicle entity + driving controller (arcade)
- **Phase:** L1
- **Depends on:** D-1, B-2

### Objective
A controllable car without full physics engine.

### Design
Use kinematic vehicle with velocity, heading, slip. Apply steering to heading, acceleration to velocity, clamp max speed. Use simple friction and drift when handbrake.

### Specs
- Top speed: 22 m/s (80 km/h).
- 0-60: ~4 seconds (tunable).
- Handbrake increases slip and reduces traction.

### Implementation details
- Add `src/vehicles/vehicle_state.js` and `vehicle_controller.js`.
- Store active vehicle id in `state.player.vehicleId`.
- When in vehicle, player position snaps to vehicle.

### Acceptance
- Driving feels responsive and stable (no NaN).
- Vehicle can stop and reverse.

### DoD (Definition of Done)
- Controller uses sim dt (fixed).
- No allocations per tick in vehicle sim.

### QA checklist
- Drive for 5 minutes in CITY; no jitter accumulation.
- Enter/exit 20 times; no stuck state.

## Ticket L-2: Road adherence + collision resolution
- **Phase:** L2
- **Depends on:** C-2, E-1

### Objective
Vehicles should naturally stay on roads but allow off-road at penalty.

### Design
Sample tile under wheels; roads give higher traction and speed. Off-road reduces traction. Collision: AABB checks vs buildings; push vehicle out along minimum penetration axis.

### Specs
- Traction multiplier: road 1.0, grass 0.75, forest 0.6, water blocked.
- Collision stops forward velocity and adds damage/heat.

### Implementation details
- Add `src/vehicles/road_query.js` hooking to map road layer.
- Add `src/physics/aabb_collision.js` shared utility.
- Mark water as non-drivable.

### Acceptance
- Car can drive through city roads without getting stuck.
- Hitting buildings prevents passing through.

### DoD (Definition of Done)
- Collision tested against 10 building types.
- Water tiles block movement with clear feedback.

### QA checklist
- Drive into dense block; ensure car doesn’t tunnel.
- Drive off-road; feel slower/less control.

## Ticket L-3: Vehicle camera + vehicle spawning/selection
- **Phase:** L3
- **Depends on:** L-1, D-1

### Objective
Make driving readable and usable.

### Design
Switch to chase cam when in vehicle, with lower pitch and wider FOV. Spawn ambient parked cars near roads/POIs.

### Specs
- Vehicle camera distance: 8–12m; FOV 70–85.
- Spawn: SMALL 20 cars, CITY 80, MEGA 200 (streamed by chunks).

### Implementation details
- Update camera rig to support modes: onFoot vs driving.
- Add `src/vehicles/vehicle_spawner.js` and store vehicles in `state.world.vehicles`.
- Add HUD speedometer + damage meter.

### Acceptance
- Entering vehicle switches camera and HUD.
- Vehicles appear in world and can be entered.

### DoD (Definition of Done)
- Vehicle spawn deterministic by seed.
- Vehicles streamed with chunks (no huge upfront spawn).

### QA checklist
- Drive across chunk boundaries; vehicles don’t vanish under player.
- Reload save in vehicle; resume driving.
