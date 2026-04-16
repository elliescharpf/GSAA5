struct Particle {
  pos: vec2f,
  vel: vec2f,
  speed: f32,
  colorID: f32
};

@group(0) @binding(0) var<uniform> res:   vec2f;
@group(0) @binding(1) var<storage, read_write> state: array<Particle>;
@group(0) @binding(2) var<uniform> speedScale: f32;
@group(0) @binding(3) var<uniform> mouse: vec2f;

@compute
@workgroup_size(64)

fn cs(@builtin(global_invocation_id) cell:vec3u)  {
  let i = cell.x;
  let p = state[ i ];

  // change velocity
  let fi = f32(i);

  // Mouse
  let toMouse = mouse - p.pos;
  let dir = normalize(toMouse);
  var vel = p.vel * 0.95 + dir * 0.05;

  // Clamp speed
  let spd = length(vel);
  if (spd > 1.0) { vel = vel/spd; }

  var next = p.pos + (2. / res) * vel * speedScale;

  // wrap around edges
  if( next.x > 1. ) { next.x -= 2.; }
  if( next.x < -1. ) { next.x += 2.; }
  if( next.y > 1. ) { next.y -= 2.; }
  if( next.y < -1. ) { next.y += 2.; }

  state[i].vel = vel;
  state[i].pos = next;
}
