"use strict";

window.addEventListener("load", init);

const g_fovy = Math.PI * 70.0 / 180.0;
let g_aspect;
const g_near = 0.1;
const g_far = 1000.0;

let rotx = 0.0;

var cameraPosition = [ 0.0, 0.0, 5.0, 0.0 ];

const display0_positions = [
	-1.0, -0.5, 0.0, 1.0,
	 1.0, -0.5, 0.0, 1.0,
	 1.0,  0.5, 0.0, 1.0,
	-1.0,  0.5, 0.0, 1.0];



////////////////////////////////////////////////////////////////
// GLSL
////////////////////////////////////////////////////////////////
const vs =
`#version 300 es
precision highp float;

in vec4 aVertexPosition;
in vec2 aVertexTextureCoord;

uniform mat4 uModelViewMat;
uniform mat4 uProjectionMat;

out vec2 vTextureCoord;

void main(void) {
	vec4 pos = uProjectionMat * uModelViewMat * aVertexPosition;
	gl_Position = pos;
	vTextureCoord = aVertexTextureCoord;
}
`;

const fs =
`#version 300 es
precision highp float;

in vec2 vTextureCoord;

uniform sampler2D uTexture;

out vec4 fragmentColor;

void main(void) {
	fragmentColor.r = 0.1;
	fragmentColor = texture(uTexture, vTextureCoord.xy);
}
`;



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

	// Initialize displays
	//// Create projected displays
	const canvas_display0 = document.getElementById("canvas_display0");
	const display0 = init_projection(canvas_display0, display0_positions);

	//// Create display panel
	const panel0 = createPanel(gl, display0);

	// Start animation
	const animate = (gl, programInfo, objects) => {
		const sub = () => {
			requestAnimationFrame(sub);
			// Draw displays
			rotx += 0.01;
			const roty = Math.sin(rotx);
			const iMat = createIdenticalMat4();
			const modelMat = createRotationMat4_y(Math.PI * 45.0 / 180.0 * roty);
			multiplyMat4(display0.modelMat, modelMat, iMat);
			render_projection(display0.gl, display0.programInfo, display0.objects, display0.positions, display0.modelMat);
			// Draw main view
			render(gl, programInfo, objects);
		}
		// Start first time
		sub();
	};
	animate(gl, programInfo, [ panel0 ]);
}




////////////////////////////////////////////////////////////////
// WebGL
////////////////////////////////////////////////////////////////

function initializeWebGL(gl, vsSource, fsSource)
{
	const shaderProgram = initializeShaderProgram(gl, vsSource, fsSource);
	const programInfo = {
		shaderProgram: shaderProgram,
		attribLocations: {
			vertexPosition: gl.getAttribLocation(shaderProgram, 'aVertexPosition'),
			vertexTextureCoord: gl.getAttribLocation(shaderProgram, 'aVertexTextureCoord'),
		},
		uniformLocations: {
			projectionMatrix: gl.getUniformLocation(shaderProgram, 'uProjectionMat'),
			modelViewMatrix: gl.getUniformLocation(shaderProgram, 'uModelViewMat'),
			texture: gl.getUniformLocation(shaderProgram, 'uTexture'),
		},
	};
	return programInfo;
}

function initializeShaderProgram(gl, vsSource, fsSource)
{
	const vertexShader = loadShader(gl, gl.VERTEX_SHADER, vsSource);
	const fragmentShader = loadShader(gl, gl.FRAGMENT_SHADER, fsSource);

	const shaderProgram = gl.createProgram();
	gl.attachShader(shaderProgram, vertexShader);
	gl.deleteShader(vertexShader);
	gl.attachShader(shaderProgram, fragmentShader);
	gl.deleteShader(fragmentShader);
	gl.linkProgram(shaderProgram);
	if (!gl.getProgramParameter(shaderProgram, gl.LINK_STATUS)) {
		document.write("Unable to initialize the shader program: " + gl.getProgramInfoLog(shaderProgram) + "\n");
		return null;
	}
	return shaderProgram;
}

function loadShader(gl, type, source)
{
	const shader = gl.createShader(type);
	gl.shaderSource(shader, source);
	gl.compileShader(shader);
	if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
		document.write("Failed to compile the shader program: " + gl.getShaderInfoLog(shader) + "\n");
		gl.deleteShader(shader);
		return null;
	}
	return shader;
}


function render(gl, programInfo, objects)
{
	gl.useProgram(programInfo.shaderProgram);

	// Clear
	gl.clearColor(0.0, 0.0, 0.0, 1.0);
	gl.clearDepth(1.0);
	gl.enable(gl.DEPTH_TEST);
	gl.enable(gl.BLEND);
	gl.depthFunc(gl.LEQUAL);
	gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
	gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

	// Get matrix
	const viewMat = createIdenticalMat4();
	viewMat[14] = -3.0;
	const projection = createPerspectiveMat4(g_fovy, g_aspect, g_near, g_far);

	const drawing = (attribLocation, element) => {
		gl.bindBuffer(gl.ARRAY_BUFFER, element.buffer);
		const stride = 0;
		const offset = 0;
		gl.vertexAttribPointer(
		    attribLocation,
		    element.numComponents,
		    element.type,
		    element.normalize,
		    stride,
		    offset);
		gl.enableVertexAttribArray(attribLocation);
	};

	gl.uniformMatrix4fv(
	    programInfo.uniformLocations.projectionMatrix,
	    false,
	    projection);
	gl.uniform1i(
	    programInfo.uniformLocations.texture,
	    0);

	objects.forEach((object) => {
		const modelView = createIdenticalMat4();
		multiplyMat4(modelView, viewMat, object.modelMat);
		gl.uniformMatrix4fv(
		    programInfo.uniformLocations.modelViewMatrix,
		    false,
		    modelView);

		gl.activeTexture(gl.TEXTURE0);
		gl.bindTexture(gl.TEXTURE_2D, object.texture.texture);
		const levelOfDetail = 0;
		gl.texImage2D(gl.TEXTURE_2D, levelOfDetail, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, object.texture.image);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

		drawing(programInfo.attribLocations.vertexPosition, object.position);
		drawing(programInfo.attribLocations.vertexTextureCoord, object.textureCoord);
		gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, object.index.buffer);

		// Draw surface by TRIANGLES
		const offset = 0;
		gl.drawElements(
		    gl.TRIANGLES,
		    object.index.elements.length,
		    object.index.type,
		    offset);
	});
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
		texture: { image: display.canvas, texture: gl.createTexture(gl, display.canvas) },
		modelMat: display.modelMat,
	};
}


function createTexture(gl, img)
{
	const tx = gl.createTexture();
	gl.bindTexture(gl.TEXTURE_2D, tx);
	const levelOfDetail = 0;
	gl.texImage2D(gl.TEXTURE_2D, levelOfDetail, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

	return tx;
}




////////////////////////////////////////////////////////////////
// Matrix
////////////////////////////////////////////////////////////////
function createIdenticalMat3() {
	let A = new Array(9);
	A[0] = 1.0; A[3] = 0.0; A[6] = 0.0;
	A[1] = 0.0; A[4] = 1.0; A[7] = 0.0;
	A[2] = 0.0; A[5] = 0.0; A[8] = 1.0;
	return A;
}

function createIdenticalMat4() {
	let A = new Array(16);
	A[0] = 1.0; A[4] = 0.0; A[8]  = 0.0; A[12] = 0.0;
	A[1] = 0.0; A[5] = 1.0; A[9]  = 0.0; A[13] = 0.0;
	A[2] = 0.0; A[6] = 0.0; A[10] = 1.0; A[14] = 0.0;
	A[3] = 0.0; A[7] = 0.0; A[11] = 0.0; A[15] = 1.0;
	return A;
}

function createPerspectiveMat4(fovy, aspect, near, far) {
	let A = new Array(16);
	const f = 1.0 / Math.tan(fovy / 2);
	A[0] = f / aspect;
	A[1] = 0;
	A[2] = 0;
	A[3] = 0;
	A[4] = 0;
	A[5] = f;
	A[6] = 0;
	A[7] = 0;
	A[8] = 0;
	A[9] = 0;
	A[10] = -(far + near) / (far - near);
	A[11] = -1;
	A[12] = 0;
	A[13] = 0;
	A[14] = 2 * far * near / (near - far);
	A[15] = 0;
	return A;
}

function createRotationMat4_x(rad) {
	let A = new Array(16);
	const cos = Math.cos(rad);
	const sin = Math.sin(rad);
	A[0] = 1.0;
	A[1] = 0;
	A[2] = 0;
	A[3] = 0;
	A[4] = 0;
	A[5] = cos;
	A[6] = sin;
	A[7] = 0;
	A[8] = 0;
	A[9] = -sin;
	A[10] = cos;
	A[11] = 0;
	A[12] = 0;
	A[13] = 0;
	A[14] = 0;
	A[15] = 1.0;
	return A;
}

function createRotationMat4_y(rad) {
	let A = new Array(16);
	const cos = Math.cos(rad);
	const sin = Math.sin(rad);
	A[0] = cos;
	A[1] = 0;
	A[2] = -sin;
	A[3] = 0;
	A[4] = 0;
	A[5] = 1.0;
	A[6] = 0;
	A[7] = 0;
	A[8] = sin;
	A[9] = 0;
	A[10] = cos;
	A[11] = 0;
	A[12] = 0;
	A[13] = 0;
	A[14] = 0;
	A[15] = 1.0;
	return A;
}

function createRotationMat4_z(rad) {
	let A = new Array(16);
	const cos = Math.cos(rad);
	const sin = Math.sin(rad);
	A[0] = cos;
	A[1] = sin;
	A[2] = 0;
	A[3] = 0;
	A[4] = -sin;
	A[5] = cos;
	A[6] = 0;
	A[7] = 0;
	A[8] = 0;
	A[9] = 0;
	A[10] = 1.0;
	A[11] = 0;
	A[12] = 0;
	A[13] = 0;
	A[14] = 0;
	A[15] = 1.0;
	return A;
}


function multiplyMat4(dst, A, B) {
	const a11 = A[0], a21 = A[1], a31 = A[2], a41 = A[3],
	    a12 = A[4], a22 = A[5], a32 = A[6], a42 = A[7],
	    a13 = A[8], a23 = A[9], a33 = A[10], a43 = A[11],
	    a14 = A[12], a24 = A[13], a34 = A[14], a44 = A[15];
	const b11 = B[0], b21 = B[1], b31 = B[2], b41 = B[3],
	    b12 = B[4], b22 = B[5], b32 = B[6], b42 = B[7],
	    b13 = B[8], b23 = B[9], b33 = B[10], b43 = B[11],
	    b14 = B[12], b24 = B[13], b34 = B[14], b44 = B[15];

	dst[0] = a11 * b11 + a12 * b21 + a13 * b31 + a14 * b41;
	dst[1] = a21 * b11 + a22 * b21 + a23 * b31 + a24 * b41;
	dst[2] = a31 * b11 + a32 * b21 + a33 * b31 + a34 * b41;
	dst[3] = a41 * b11 + a42 * b21 + a43 * b31 + a44 * b41;

	dst[4] = a11 * b12 + a12 * b22 + a13 * b32 + a14 * b42;
	dst[5] = a21 * b12 + a22 * b22 + a23 * b32 + a24 * b42;
	dst[6] = a31 * b12 + a32 * b22 + a33 * b32 + a34 * b42;
	dst[7] = a41 * b12 + a42 * b22 + a43 * b32 + a44 * b42;

	dst[8]  = a11 * b13 + a12 * b23 + a13 * b33 + a14 * b43;
	dst[9]  = a21 * b13 + a22 * b23 + a23 * b33 + a24 * b43;
	dst[10] = a31 * b13 + a32 * b23 + a33 * b33 + a34 * b43;
	dst[11] = a41 * b13 + a42 * b23 + a43 * b33 + a44 * b43;

	dst[12] = a11 * b14 + a12 * b24 + a13 * b34 + a14 * b44;
	dst[13] = a21 * b14 + a22 * b24 + a23 * b34 + a24 * b44;
	dst[14] = a31 * b14 + a32 * b24 + a33 * b34 + a34 * b44;
	dst[15] = a41 * b14 + a42 * b24 + a43 * b34 + a44 * b44;
}

function createVec4()
{
	let v = new Array(4);
	v[0] = 0.0;
	v[1] = 0.0;
	v[2] = 0.0;
	v[3] = 1.0;
	return v;
}

function createZerosMat4(initials = [])
{
	let A = new Array(16);
	for (let i = 0; i < Math.min(initials.length, 16); ++i) {
		A[i] = initials[i];
	}
	for (let i = initials.length; i < 16; ++i) {
		A[i] = 0.0;
	}
	return A;
}

function multiplyMatVec4(dst, A, v) {
	const v1 = v[0], v2 = v[1], v3 = v[2], v4 = v[3];
	dst[0] = A[0] * v1 + A[4] * v2 + A[8] * v3 + A[12] * v4;
	dst[1] = A[1] * v1 + A[5] * v2 + A[9] * v3 + A[13] * v4;
	dst[2] = A[2] * v1 + A[6] * v2 + A[10] * v3 + A[14] * v4;
	dst[3] = A[3] * v1 + A[7] * v2 + A[11] * v3 + A[15] * v4;
}

