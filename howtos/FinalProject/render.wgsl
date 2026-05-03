struct VertexInput {
  @location(0) pos: vec2f,
  @builtin(instance_index) instance: u32,
};

struct VertexOutput {
  @builtin(position) pos: vec4f,
  @location(0) uv: vec2f,
  @location(1) colorID: f32,
  @location(2) lifetime: f32,   // fire fade
};

struct Particle {
  pos: vec2f,
  vel: vec2f,
  speed: f32,     // lifetime for fire
  colorID: f32,
  pad0: f32,
  pad1: f32,
};


@group(0) @binding(0) var<uniform> frame: f32;
@group(0) @binding(1) var<uniform> res: vec2f;
@group(0) @binding(2) var<storage> state: array<Particle>;

@vertex
fn vs(input: VertexInput) -> VertexOutput {
  let size = input.pos * 0.04;
  let aspect = res.y / res.x;
  let p = state[input.instance];

  var out: VertexOutput;
  out.pos = vec4f(p.pos.x - size.x * aspect, p.pos.y + size.y, 0.0, 1.0);
  out.uv = input.pos;
  out.colorID = p.colorID;
  out.lifetime = p.speed;
  return out;
}

@fragment
fn fs(input: VertexOutput) -> @location(0) vec4f {
  let id = i32(input.colorID);
  var uv = input.uv;

  // dead fire = invisible
  if (id == 3 && input.lifetime <= 0.0) { discard; }

  // pixelation effect for fire
  if (id == 3) {
    uv = floor(uv * 4.0) / 4.0;
  }

  let dist = length(uv);
  if (dist > 1.0) { discard; }

  let core = exp(-dist * 6.0);
  let halo = exp(-dist * 2.5) * 0.4;
  var alpha = core + halo;

  if (id == 3) {
    alpha *= clamp(input.lifetime, 0.0, 1.0);
  }

  var borderColor: vec3f;
  var middleColor: vec3f;
  var centerColor: vec3f;

  if (id == 0) {
    borderColor = vec3f(0.0, 0.42, 0.0);
    middleColor = vec3f(0.0, 0.75, 0.0);
    centerColor = vec3f(0.4, 1.0, 0.4);
  } else if (id == 1) {
    borderColor = vec3f(0.29, 0.41, 0.0);
    middleColor = vec3f(0.53, 0.74, 0.0);
    centerColor = vec3f(0.8, 1.0, 0.4);
  } else if (id == 2) {
    borderColor = vec3f(0.44, 0.44, 0.0);
    middleColor = vec3f(0.76, 0.76, 0.0);
    centerColor = vec3f(1.0, 1.0, 0.5);
  } else {
      // fire
      borderColor = vec3f(0.3, 0.0, 0.0);
      middleColor = vec3f(0.8, 0.0, 0.0);
      centerColor = vec3f(1.0, 0.2, 0.2);
    }

  let t = dist * 2.0;
  var color: vec3f;

  if (dist < 0.5) {
    color = mix(centerColor, middleColor, t);
  } else {
    color = mix(middleColor, borderColor, t - 1.0);
  }

  return vec4f(color * alpha * 2.0, alpha);
}
