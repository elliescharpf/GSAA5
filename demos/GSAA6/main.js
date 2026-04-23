import { default as seagulls } from '../../gulls.js'

const WORKGROUP_SIZE = 64,
    NUM_AGENTS = 256,
    DISPATCH_COUNT = [NUM_AGENTS/WORKGROUP_SIZE,1,1],
    GRID_SIZE = 2,
    STARTING_AREA = .3

const W = Math.round( window.innerWidth  / GRID_SIZE ),
    H = Math.round( window.innerHeight / GRID_SIZE )

const render_shader = seagulls.constants.vertex + `
@group(0) @binding(0) var<storage> pheromones: array<f32>;
@group(0) @binding(1) var<storage> render: array<f32>;

@fragment 
fn fs( @builtin(position) pos : vec4f ) -> @location(0) vec4f {
  let grid_pos = floor( pos.xy / ${GRID_SIZE}.);
  
  let pidx = grid_pos.y  * ${W}. + grid_pos.x;
  let p = pheromones[ u32(pidx) ];
  let pType = p;
  let v = render[ u32(pidx) ];

  let trail = select(
  select(
    select( vec3(0.), vec3(1.,1.,1.), pType == 1. ),  // Original: white
    vec3(1.,0.,0.),                                     // Behavior 1: red
    pType == 2.
  ),
  vec3(0.,0.5,1.),                                      // Behavior 2: blue
  pType == 3.
);
let out = select( trail, vec3(1.,1.,0.), v > 0. );  // ants always yellow
  
  return vec4f( out, 1. );
}`

const compute_shader =`
struct Vant {
  pos: vec2f,
  dir: f32,
  flag: f32
}

@group(0) @binding(0) var<storage, read_write> vants: array<Vant>;
@group(0) @binding(1) var<storage, read_write> pheremones: array<f32>;
@group(0) @binding(2) var<storage, read_write> render: array<f32>;

fn pheromoneIndex( vant_pos: vec2f ) -> u32 {
  let width = ${W}.;
  return u32( abs( vant_pos.y % ${H}. ) * width + vant_pos.x );
}

@compute
@workgroup_size(${WORKGROUP_SIZE},1,1)

fn cs(@builtin(global_invocation_id) cell:vec3u)  {
  let pi2   = ${Math.PI*2}; 
  var vant:Vant  = vants[ cell.x ];

  let pIndex    = pheromoneIndex( vant.pos );
  let pheromone = pheremones[ pIndex ];

  // if pheromones were found
  if( vant.flag == 0. ) {
  // Original
  if( pheromone != 0. ) {
    vant.dir += .25;
    pheremones[ pIndex ] = 0.;
  } else {
    vant.dir -= .25;
    pheremones[ pIndex ] = vant.flag + 1.;
  }
} else if( vant.flag == 1. ) {
  // Behavior 1: mirrored turns
  if( pheromone != 0. ) {
    vant.dir -= .25;
    pheremones[ pIndex ] = 0.;
  } else {
    vant.dir += .25;
    pheremones[ pIndex ] = vant.flag + 1.;
  }
} else {
  // Behavior 2: turn 135 on pheromone
  if( pheromone != 0. ) {
    vant.dir += .375;
    pheremones[ pIndex ] = 0.;
  } else {
    vant.dir += .25;
    pheremones[ pIndex ] = vant.flag + 1.;
  }
}

  // calculate direction based on vant heading
  let dir = vec2f( sin( vant.dir * pi2 ), cos( vant.dir * pi2 ) );
  
  vant.pos = round( vant.pos + dir ); 

  vants[ cell.x ] = vant;
  
  // we'll look at the render buffer in the fragment shader
  // if we see a value of one a vant is there and we can color
  // it accordingly. in our JavaScript we clear the buffer on every
  // frame.
    render[ pIndex ] = vant.flag + 1.;
}`

const NUM_PROPERTIES = 4 // must be evenly divisble by 4!
const pheromones   = new Float32Array( W*H ) // hold pheromone data
const vants_render = new Float32Array( W*H ) // hold info to help draw vants
const vants        = new Float32Array( NUM_AGENTS * NUM_PROPERTIES ) // hold vant info

const offset = .5 - STARTING_AREA / 2

function initVants( typeFn ) {
    for( let i = 0; i < NUM_AGENTS * NUM_PROPERTIES; i += NUM_PROPERTIES ) {
        vants[ i ]   = Math.floor( (offset + Math.random() * STARTING_AREA) * W )
        vants[ i+1 ] = Math.floor( (offset + Math.random() * STARTING_AREA) * H )
        vants[ i+2 ] = 0
        vants[ i+3 ] = typeFn()
    }
}

initVants( () => 0 ) // start with Original

const sg = await seagulls.init()
const pheromones_b = sg.buffer( pheromones )
const vants_b  = sg.buffer( vants )
const render_b = sg.buffer( vants_render )

window.setPreset = function( preset ) {
    const presets = [
        () => 0,  // Original
        () => 1,  // Behavior 1
        () => 2,  // Behavior 2
    ]
    initVants( presets[preset] )
    vants_b.write( vants )
    pheromones_b.clear()
}

const render = await sg.render({
    shader: render_shader,
    data:[
        pheromones_b,
        render_b
    ],
})

const compute = sg.compute({
    shader: compute_shader,
    data:[
        vants_b,
        pheromones_b,
        render_b
    ],
    onframe() { render_b.clear() },
    dispatchCount:DISPATCH_COUNT
})

sg.run( compute, render )