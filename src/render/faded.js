// A transparent draw at zero opacity adds nothing to the frame and still costs
// its draw call: three culls on `visible`, never on opacity. Every object handed
// here blends without writing depth, so dropping it while it is fully faded
// changes no pixel. By day that is every light pool, road streak, lamp shaft,
// star and the moon's halo; in a blackout it is the dead zone's share of them.
//
// Only for materials whose opacity really is the whole contribution. A glow
// dimmed through its colour instead still picks up fog, so it stays drawn.
export function hideFaded(objects) {
  for (const o of objects) o.visible = o.material.opacity > 0;
}
