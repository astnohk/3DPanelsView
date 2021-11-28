"use strict";

window.addEventListener("load", init);

let g_fovy = Math.PI * 90.0 / 180.0;
let g_aspect;
let g_near = 0.1;
let g_far = 1000.0;

let rotx = 0.0;
let roty = 0.0;

var cameraPosition = [ 0.0, 0.0, 5.0, 0.0 ];

const display_texture_resolution = 1024;
const display_positions = [
	[
	-4.0, -2.5, 4.0, 1.0,
	 4.0, -2.5, 4.0, 1.0,
	 4.0,  2.5, 4.0, 1.0,
	-4.0,  2.5, 4.0, 1.0
	],
	[
	-4.0, -2.5, -4.0, 1.0,
	-4.0, -2.5,  4.0, 1.0,
	-4.0,  2.5,  4.0, 1.0,
	-4.0,  2.5, -4.0, 1.0
	],
	[
	 4.0, -2.5,  4.0, 1.0,
	 4.0, -2.5, -4.0, 1.0,
	 4.0,  2.5, -4.0, 1.0,
	 4.0,  2.5,  4.0, 1.0
	],
];




////////////////////////////////////////////////////////////////
// main
////////////////////////////////////////////////////////////////
function init()
{
	// Initialize main canvas
	//// Get screen aspect
	g_aspect = window.innerWidth / window.innerHeight;
	//// Create canvas
	const canvas = document.getElementById("canvas_main");
	canvas.width = window.innerWidth;
	canvas.height = window.innerHeight;
	//// Initialize WebGL context
	const gl = canvas.getContext("webgl2", { antialias: false });
	const programInfo = initializeWebGL(gl, vs, fs);
	const programInfo_display = initializeWebGL_projection(gl, vs_projection, fs_projection);

	canvas.addEventListener("mousemove", (e) => {
		roty = 2.0 * e.x / window.innerWidth - 1.0;
		cameraPosition[2] = 4.0 + (1.0 - e.y / window.innerHeight) * 20.0;
	});
	canvas.addEventListener("touchmove", (e) => {
		e.stopPropagation();
		e.preventDefault();
		roty = 2.0 * e.touches[0].screenX / window.innerWidth - 1.0;
		cameraPosition[2] = 4.0 + (1.0 - e.touches[0].screenY / window.innerHeight) * 20.0;
	});

	// Objects
	let cubes = [];
	for (let i = 0; i < 15; ++i) {
		const cube = createCube(gl);
		cube.modelMat[0] = cube.modelMat[5] = cube.modelMat[10] = Math.random();
		let rot;
		rot = createRotationMat4_z(Math.random() * Math.PI * 2.0);
		multiplyMat4(cube.modelMat, rot, cube.modelMat);
		rot = createRotationMat4_x(Math.random() * Math.PI * 2.0);
		multiplyMat4(cube.modelMat, rot, cube.modelMat);
		cube.modelMat[12] = 4.0 * (2.0 * Math.random() - 1.0);
		cube.modelMat[13] = 4.0 * (2.0 * Math.random() - 1.0);
		cube.modelMat[14] = 4.0 * (2.0 * Math.random() - 1.0);
		cubes.push(cube);
	}


	// Initialize displays
	//// Create projected displays
	const canvas_displays = document.getElementById("canvas_displays");
	let displays = [];
	let panels = [];
	for (let i = 0; i < display_positions.length; ++i) {
		const canvas_display = document.createElement("canvas");
		canvas_display.id = "canvas_display" + i;
		canvas_displays.appendChild(canvas_display);

		const display = init_projection(gl, programInfo_display, canvas_display, display_positions[i]);
		canvas_display.style.width = "320px";
		const normX = Math.sqrt(
		    Math.pow(display_positions[i][4] - display_positions[i][0], 2.0) +
		    Math.pow(display_positions[i][5] - display_positions[i][1], 2.0) +
		    Math.pow(display_positions[i][6] - display_positions[i][2], 2.0));
		const normY = Math.sqrt(
		    Math.pow(display_positions[i][12] - display_positions[i][0], 2.0) +
		    Math.pow(display_positions[i][13] - display_positions[i][1], 2.0) +
		    Math.pow(display_positions[i][14] - display_positions[i][2], 2.0));
		canvas_display.style.height = (320 * normY / normX) + "px";
		displays.push(display);

		//// Create display panel on The Main View
		const panel = createPanel(gl, display);
		panels.push(panel);
	}

	// Start animation
	const animate = (gl, programInfo, objects) => {
		const sub = () => {
			requestAnimationFrame(sub);
			// Draw displays
			rotx += 0.01;
			const iMat = createIdenticalMat4();
			//const iMat = createRotationMat4_z(rotx * 0.3 * Math.PI);
			const modelMat = createRotationMat4_y(Math.PI * 186.0 / 180.0 * roty);
			iMat[14] = 3.0;
			for (let i = 0; i < display_positions.length; ++i) {
				multiplyMat4(displays[i].modelMat, modelMat, iMat);
				render_projection(gl, programInfo_display, displays[i], cubes);

				// Draw the display on each canvas by copying the pixel data via ImageData
				const pixels = new Uint8ClampedArray(display_texture_resolution * display_texture_resolution * 4);
				gl.readPixels(0, 0, display_texture_resolution, display_texture_resolution,
				    gl.RGBA, gl.UNSIGNED_BYTE,
				    pixels);
				const img = new ImageData(pixels, display_texture_resolution, display_texture_resolution);
				displays[i].context.putImageData(img, 0, 0);
			}
			// Draw main view
			render(gl, programInfo, objects);
		}
		// Start first time
		sub();
	};
	animate(gl, programInfo, panels);
}


function createPanel(gl, display)
{
	let positionBuffer = gl.createBuffer();
	const disp = display.positions;
	let pos = [
		disp[0], disp[1], disp[2],
		disp[4], disp[5], disp[6],
		disp[8], disp[9], disp[10],
		disp[12], disp[13], disp[14],
	];
	gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
	gl.bufferData(
	    gl.ARRAY_BUFFER,
	    new Float32Array(pos),
	    gl.STATIC_DRAW);

	let textureBuffer = gl.createBuffer();
	let tex = [
	    0.0, 1.0,
	    1.0, 1.0,
	    1.0, 0.0,
	    0.0, 0.0,
	];
	gl.bindBuffer(gl.ARRAY_BUFFER, textureBuffer);
	gl.bufferData(
	    gl.ARRAY_BUFFER,
	    new Float32Array(tex),
	    gl.STATIC_DRAW);

	const indexBuffer = gl.createBuffer();
	const index = new Array(6 * pos.length / 3 / 4);
	for (let i = 0; i < pos.length / 3 / 4; ++i) {
	    index[6 * i + 0] = 4 * i + 0;
	    index[6 * i + 1] = 4 * i + 1;
	    index[6 * i + 2] = 4 * i + 2;
	    index[6 * i + 3] = 4 * i + 0;
	    index[6 * i + 4] = 4 * i + 2;
	    index[6 * i + 5] = 4 * i + 3;
	}
	gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
	gl.bufferData(
	    gl.ELEMENT_ARRAY_BUFFER,
	    new Uint16Array(index),
	    gl.STATIC_DRAW);

	return {
		position: { elements: pos, buffer: positionBuffer, type: gl.FLOAT, numComponents: 3, normalize: false },
		textureCoord: { elements: tex, buffer: textureBuffer, type: gl.FLOAT, numComponents: 2, normalize: false },
		index: { elements: index, buffer: indexBuffer, type: gl.UNSIGNED_SHORT },
		modelMat: display.modelMat,
		display: display,
	};
}

