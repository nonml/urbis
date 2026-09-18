// On-foot player state. Pure data — render reads, main ticks.
import { WALK_BOUNDS, clampToBounds, heightAt } from './world.js';

export const WALK_SPEED = 3.4;
export const HURRY_SPEED = 6.0;

export function createPlayer() {
  return {
    x: 2.5,
    y: heightAt(2.5, 26),
    z: 26,
    yaw: Math.PI, // facing -z, into the street
    speed: 0,
    walkPhase: 0,
  };
}

// input: {mx, mz} desired move dir (world space, normalized), hurry bool.
export function tickPlayer(player, input, dt) {
  const want = Math.hypot(input.mx, input.mz) > 0.01;
  const targetSpeed = want ? (input.hurry ? HURRY_SPEED : WALK_SPEED) : 0;
  player.speed += (targetSpeed - player.speed) * Math.min(1, dt * 8);
  if (player.speed > 0.05) {
    player.x += input.mx * player.speed * dt;
    player.z += input.mz * player.speed * dt;
    const inside = clampToBounds(WALK_BOUNDS, player.x, player.z);
    player.x = inside.x;
    player.z = inside.z;
    // Only steer while there is actually a direction to steer to. Coasting to
    // a stop still runs this block with a zero input vector, and atan2(0, 0) is
    // 0 — so releasing the key used to spin the hero round to face world +Z,
    // which from the chase camera meant turning to face the player every time
    // they stopped walking.
    if (want) {
      const targetYaw = Math.atan2(input.mx, input.mz);
      let d = targetYaw - player.yaw;
      while (d > Math.PI) d -= Math.PI * 2;
      while (d < -Math.PI) d += Math.PI * 2;
      player.yaw += d * Math.min(1, dt * 10);
    }
    player.walkPhase += dt * player.speed * 2.6;
  }
  // Every tick, not only the moving ones: a spawn preset moves x and z behind
  // this function's back, and standing still on a bank is exactly the case
  // where floating shows.
  player.y = heightAt(player.x, player.z);
}
