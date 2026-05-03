struct Particle {
  pos: vec2f,
  vel: vec2f,
  speed: f32,
  colorID: f32,
  pad0: f32,
  pad1: f32,
};

@group(0) @binding(0) var<uniform> res: vec2f;
@group(0) @binding(1) var<storage, read_write> state: array<Particle>;
@group(0) @binding(2) var<uniform> speedScale: f32;
@group(0) @binding(3) var<uniform> mouse: vec2f;

@compute
@workgroup_size(64)
fn cs(@builtin(global_invocation_id) cell: vec3u) {
  let i = cell.x;
  let p = state[i];

  // FIRE PARTICLES
  if (p.colorID == 3.0) {
    // skip dead fire
    if (p.speed <= 0.0) { return; }

    // fire spreads outward, no attraction
    let vel = p.vel * 0.92;
    let next = p.pos + (2.0 / res) * vel * speedScale * 5.0;

    // fire does not wrap around edges
    if (next.x > 1.2 || next.x < -1.2 || next.y > 1.2 || next.y < -1.2) {
      state[i].speed = 0.0; // kill particle
      return;
    }

    state[i].vel = vel;
    state[i].pos = next;
    state[i].speed = p.speed - 0.02; // lifetime countdown
    return;
  }

  // XP ORBS (colorID 0,1,2)
  let toMouse = mouse - p.pos;
  let dir = normalize(toMouse);

  var vel = p.vel * 0.95 + dir * 0.05;

  // clamp speed
  let spd = length(vel);
  if (spd > 1.0) { vel = vel / spd; }

  var next = p.pos + (2.0 / res) * vel * speedScale;

  // wrap around edges (XP orbs only)
  if (next.x > 1.0) { next.x -= 2.0; }
  if (next.x < -1.0) { next.x += 2.0; }
  if (next.y > 1.0) { next.y -= 2.0; }
  if (next.y < -1.0) { next.y += 2.0; }

  state[i].vel = vel;
  state[i].pos = next;
}
