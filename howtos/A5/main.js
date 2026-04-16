import { default as gulls } from '../../gulls.js'
import { Pane } from 'https://cdn.jsdelivr.net/npm/tweakpane@4.0.3/dist/tweakpane.min.js';

const sg = await gulls.init(),
      render_shader  = await gulls.import( './render.wgsl' ),
      compute_shader = await gulls.import( './compute.wgsl' )

const params = {speed: 0.2}
const pane = new Pane()
pane.addBinding(params, "speed", {min: 0.0, max: 3.0, step: 0.01})

const mouse_u = sg.uniform([0, 0])

window.addEventListener('mousemove', ev => {
  const x = (ev.clientX / window.innerWidth) * 2 - 1
  const y = -((ev.clientY / window.innerHeight) * 2 - 1)
  mouse_u.value = [x, y]
})

const speed_u = sg.uniform(params.speed)

const NUM_PARTICLES = 1024,
    NUM_PROPERTIES = 6,    // pos.x, pos.y, vel.x, vel.y, speed, colorID
    state = new Float32Array( NUM_PARTICLES * NUM_PROPERTIES )

for( let i = 0; i < NUM_PARTICLES * NUM_PROPERTIES; i += NUM_PROPERTIES ) {
  state[ i ]     = -1 + Math.random() * 2   // pos.x
  state[ i + 1 ] = -1 + Math.random() * 2   // pos.y
  state[ i + 2 ] = (Math.random() - 0.5) * 0.5
  state[ i + 3 ] = (Math.random() - 0.5) * 0.5
  state[ i + 4 ] = Math.random() * 10        // speed
  state[ i + 5 ] = Math.floor( Math.random() * 3 )  // colorID
}

const state_b = sg.buffer( state ),
      frame_u = sg.uniform( 0 ),
      res_u   = sg.uniform([ sg.width, sg.height ]) 

const render = await sg.render({
  shader: render_shader,
  data: [
    frame_u,
    res_u,
    state_b
  ],
  onframe() {
    frame_u.value++
    speed_u.value = params.speed
  },
  count: NUM_PARTICLES,
  blend: true,
})


const dc = Math.ceil( NUM_PARTICLES / 64 )

const compute = sg.compute({
  shader: compute_shader,
  data:[
    res_u,
    state_b,
    speed_u,
    mouse_u
  ],
  dispatchCount: [ dc, 1, 1 ]

})

sg.run( compute, render )
