import { default as gulls } from '../../gulls.js'
import { Pane } from 'https://cdn.jsdelivr.net/npm/tweakpane@4.0.3/dist/tweakpane.min.js';

const canvas = document.querySelector('#gulls');
const sg = await gulls.init({ canvas });

const render_shader  = await gulls.import('./render.wgsl');
const compute_shader = await gulls.import('./compute.wgsl');

// UI for adjusting particle speed
const params = { speed: 0.2 };
const pane = new Pane();
pane.addBinding(params, "speed", { min: 0.0, max: 3.0, step: 0.01 });

// uniforms
const mouse_u = sg.uniform([0, 0]);
const speed_u = sg.uniform(params.speed);

// track mouse position
let mouseX = 0, mouseY = 0;

window.addEventListener('mousemove', ev => {
  mouseX = (ev.clientX / window.innerWidth) * 2 - 1;
  mouseY = -((ev.clientY / window.innerHeight) * 2 - 1);
});

// create a 2D canvas overlay for the crosshair so it sits on top of the WebGPU canvas
const ch = document.createElement('canvas');
ch.width = window.innerWidth;
ch.height = window.innerHeight;
ch.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:10';
document.body.appendChild(ch);
const ctx = ch.getContext('2d');

// resize the crosshair canvas if the window size changes
window.addEventListener('resize', () => {
  ch.width = window.innerWidth;
  ch.height = window.innerHeight;
});

// draw a white plus sign at the current position
// converts from clip space (-1 to 1) to screen pixels
function drawCrosshair(x, y) {
  const sx = (x + 1) / 2 * window.innerWidth;
  const sy = (-y + 1) / 2 * window.innerHeight;
  ctx.clearRect(0, 0, ch.width, ch.height);
  ctx.strokeStyle = 'rgba(255,255,255,0.8)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(sx - 12, sy);
  ctx.lineTo(sx + 12, sy);
  ctx.moveTo(sx, sy - 12);
  ctx.lineTo(sx, sy + 12);
  ctx.stroke();
}

// each particle has 8 floats: pos.xy, vel.xy, lifetime, colorID, and 2 padding floats
const NUM_PARTICLES = 2048;
const NUM_PROPERTIES = 8;

const state = new Float32Array(NUM_PARTICLES * NUM_PROPERTIES);

// the last 50 slots are reserved for fire particles so they never overlap with XP orbs
const FIRE_COUNT = 50
const FIRE_START = NUM_PARTICLES - FIRE_COUNT
let fireOffset = 0  // rotates through fire slots so multiple bursts can happen

// fill slots 0 to FIRE_START with XP orbs at random positions
// colorID 0, 1, 2 are the three green/yellow orb colors defined in render.wgsl
for (let i = 0; i < FIRE_START * NUM_PROPERTIES; i += NUM_PROPERTIES) {
  state[i]     = -1 + Math.random() * 2;            // pos.x
  state[i + 1] = -1 + Math.random() * 2;            // pos.y
  state[i + 2] = (Math.random() - 0.5) * 0.5;       // vel.x
  state[i + 3] = (Math.random() - 0.5) * 0.5;       // vel.y
  state[i + 4] = 1.0;                               // lifetime (not used for orbs)
  state[i + 5] = Math.floor(Math.random() * 3);  // colorID
  state[i + 6] = 0.0;                               // padding
  state[i + 7] = 0.0;                               // padding
}

// initialize fire slots as invisible so they don't flash on startup
// lifetime 0 makes the shader discard them before drawing
for (let i = FIRE_START * NUM_PROPERTIES; i < NUM_PARTICLES * NUM_PROPERTIES; i += NUM_PROPERTIES) {
  state[i + 4] = 0.0  // lifetime 0 = invisible
  state[i + 5] = 3    // colorID 3 = fire
}

const state_b = sg.buffer(state);
const frame_u = sg.uniform(0);
const res_u   = sg.uniform([canvas.width, canvas.height]);

// write one fire particle into the reserved fire pool at the current crosshair position
// uses a rotating offset so pressing X multiple times fills different slots
function spawnFire(x, y) {
  const slot = FIRE_START + fireOffset
  const base = slot * NUM_PROPERTIES
  const burst = new Float32Array(NUM_PROPERTIES)

  burst[0] = x
  burst[1] = y
  burst[2] = (Math.random() - 0.5) * 4    // random outward velocity
  burst[3] = (Math.random() - 0.5) * 4
  burst[4] = 1.0                          // lifetime starts full
  burst[5] = 3                            // colorID 3 = fire

  state_b.write(burst, 0, base * 4, NUM_PROPERTIES)

  fireOffset = (fireOffset + 1) % FIRE_COUNT
}

// PS4 controller input via the Gamepad
// left stick moves the attractor that XP orbs are drawn toward
// falls back to mouse position if no controller is connected
// use last known position so the crosshair doesn't snap back to center when stick is idle
let lastX = 0, lastY = 0;

function readGamepad() {
  const gp = navigator.getGamepads()[0];

  if (!gp) {
    mouse_u.value = [mouseX, mouseY];
    drawCrosshair(mouseX, mouseY);
    return;
  }

  // apply a small deadzone so the stick doesn't drift when untouched
  const ax = Math.abs(gp.axes[0]) > 0.12 ? gp.axes[0] : lastX;
  const ay = Math.abs(gp.axes[1]) > 0.12 ? -gp.axes[1] : lastY;

  lastX = ax;
  lastY = ay;

  mouse_u.value = [ax, ay];
  drawCrosshair(ax, ay);

  // X button (index 0) spawns a fire particle at the current position
  if (gp.buttons[0].pressed) {
    spawnFire(ax, ay);
  }
}

const render = await sg.render({
  shader: render_shader,
  data: [frame_u, res_u, state_b],
  onframe() {
    readGamepad();
    frame_u.value++;
    speed_u.value = params.speed;
  },
  count: NUM_PARTICLES,
  blend: true,  // additive blending makes particles glow on the black background
});

const dc = Math.ceil(NUM_PARTICLES / 64);

const compute = sg.compute({
  shader: compute_shader,
  data: [res_u, state_b, speed_u, mouse_u],
  dispatchCount: [dc, 1, 1],
});

sg.run(compute, render);