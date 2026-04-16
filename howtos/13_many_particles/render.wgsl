struct VertexInput {
  @location(0) pos: vec2f,
  @builtin(instance_index) instance: u32,
};

struct VertexOutput {
  @builtin(position) pos: vec4f,
  @location(0) uv: vec2f,
  @location(1) colorID: f32,
};

struct Particle {
  pos: vec2f,
  vel: vec2f,
  speed: f32,
  colorID: f32
};

@group(0) @binding(0) var<uniform> frame: f32;
@group(0) @binding(1) var<uniform> res:   vec2f;
@group(0) @binding(2) var<storage> state: array<Particle>;

@vertex
fn vs( input: VertexInput ) -> VertexOutput {   // <-- return VertexOutput, not vec4f
  let size = input.pos * .015;
  let aspect = res.y / res.x;
  let p = state[ input.instance ];

  var out: VertexOutput;
  out.pos = vec4f( p.pos.x - size.x * aspect, p.pos.y + size.y, 0., 1.);
  out.uv = input.pos;
  out.colorID = p.colorID;
  return out;
}

@fragment
fn fs( input: VertexOutput ) -> @location(0) vec4f {
  let dist = length( input.uv );
  if( dist > 1.0 ) { discard; }

  let alpha = 1.0 - dist;                        // fade out toward edges
  let id = i32( input.colorID );

  var borderColor: vec3f;
  var middleColor: vec3f;
  var centerColor: vec3f;

  if ( id == 0) {
  // Green
    borderColor = vec3f(0.0/255.0, 107.0/255.0, 0.0/255.0);
    middleColor = vec3f(1.0/255.0, 190.0/255.0, 1.0/255.0);
    centerColor = vec3f(2.0/255.0, 255.0/255.0, 2.0/255.0);
  }
  else if ( id == 1) {
  // Green-Yellow
    borderColor = vec3f(75.0/255.0, 105.0/255.0, 0.0/255.0);
    middleColor = vec3f(135.0/255.0, 189.0/255.0, 0.0/255.0);
    centerColor = vec3f(182.0/255.0, 255.0/255.0, 1.0/255.0);
  }
  else {
  // Yellow
    borderColor = vec3f(112.0/255.0, 112.0/255.0, 0.0/255.0);
    middleColor = vec3f(193.0/255.0, 193.0/255.0, 1.0/255.0);
    centerColor = vec3f(255.0/255.0, 255.0/255.0, 2.0/255.0);
  }

    // Blending colors
    let t = dist * 2.0;
    var color: vec3f;
    if (dist < 0.5 ){
        color = mix(centerColor, middleColor, t);
    }
    else {
    color = mix ( middleColor, borderColor, t - 1.0);
    }

  return vec4f( color, alpha );
}