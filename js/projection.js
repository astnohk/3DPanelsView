"use strict";



////////////////////////////////////////////////////////////////
// GLSL
////////////////////////////////////////////////////////////////

const vs_projection =
`#version 300 es
precision highp float;

in vec4 aVertexPosition;
in vec4 aVertexColor;

uniform vec4 uCameraPosition;
uniform mat4 uModelMat;

// Display
// y
// A
// | [3]---[2]
// |  |     |
// | [0]---[1]
// o---------->x
uniform mat4 uDisplayPositions;
uniform mat4 uDisplayModelMat;

uniform mat4 uWorldMat;

out lowp vec4 vColor;

void main(void) {
	vec4 pos = uWorldMat * uModelMat * aVertexPosition - uCameraPosition;
	mat4 dispos = uWorldMat * uDisplayModelMat * uDisplayPositions;
	vec3 dispos0 = dispos[0].xyz - uCameraPosition.xyz;
	vec3 dispos1 = dispos[1].xyz - uCameraPosition.xyz;
	vec3 dispos2 = dispos[2].xyz - uCameraPosition.xyz;
	vec3 dispos3 = dispos[3].xyz - uCameraPosition.xyz;

	vec3 X = normalize(dispos1 - dispos0);
	vec3 Y = normalize(dispos3 - dispos0);
	vec3 dispPlane = cross(Y, X);
	// Normalized position
	float d = dot(dispPlane, dispos0);
	if (dot(dispos0 + dispos1 + dispos3, dispPlane) < 0.0) {
		gl_Position = vec4(-2.0, -2.0, -2.0, 1.0);
		vColor = vec4(0.0, 0.0, 0.0, 0.0);
	} else {
		vec3 pos_onPlane = pos.xyz * d / dot(pos.xyz, dispPlane);

		gl_Position = vec4(
		    2.0 * dot(pos_onPlane - dispos0, X) / max(1.0E-9, length(dispos1 - dispos0)) - 1.0,
		    2.0 * dot(pos_onPlane - dispos0, Y) / max(1.0E-9, length(dispos3 - dispos0)) - 1.0,
		    -0.001 * pos.z,
		    1.0);
		vColor = aVertexColor;
	}
}
`;

const fs_projection =
`#version 300 es
precision highp float;

in lowp vec4 vColor;
out vec4 fragmentColor;

void main(void) {
	fragmentColor = vColor;
}
`;



////////////////////////////////////////////////////////////////
// main
////////////////////////////////////////////////////////////////
function init_projection(gl, programInfo, canvas, positions)
{
	// Create canvas
	canvas.width = display_texture_resolution;
	canvas.height = display_texture_resolution;

	// Create the target color buffer
	const targetTexture = gl.createTexture();
	const textureLevel = 0;
	{
		const internalFormat = gl.RGBA;
		const border = 0;
		const format = gl.RGBA;
		const type = gl.UNSIGNED_BYTE;
		const data = null;
		gl.bindTexture(gl.TEXTURE_2D, targetTexture);
		gl.texImage2D(
		    gl.TEXTURE_2D, textureLevel, internalFormat,
		    display_texture_resolution, display_texture_resolution,
		    border, format, type, data);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
	}

	// Create the target depth buffer
	const targetDepth = gl.createRenderbuffer();
	gl.bindRenderbuffer(gl.RENDERBUFFER, targetDepth);
	{
		const format = gl.DEPTH_COMPONENT16;
		gl.renderbufferStorage(
		    gl.RENDERBUFFER, format,
		    display_texture_resolution, display_texture_resolution);
	}

	// Create the frame buffer
	const frameBuffer = gl.createFramebuffer();
	gl.bindFramebuffer(gl.FRAMEBUFFER, frameBuffer);

	// Attach buffers to the frame buffer
	const attachmentPointDepth = gl.DEPTH_ATTACHMENT;
	gl.framebufferRenderbuffer(gl.FRAMEBUFFER, attachmentPointDepth, gl.RENDERBUFFER, targetDepth);
	const attachmentPointColor = gl.COLOR_ATTACHMENT0;
	gl.framebufferTexture2D(gl.FRAMEBUFFER, attachmentPointColor, gl.TEXTURE_2D, targetTexture, textureLevel);

	return {
		canvas: canvas,
		positions: positions,
		frameBuffer: frameBuffer,
		colorBuffer: targetTexture,
		depthBuffer: targetDepth,
		attachmentPointColor: attachmentPointColor,
		attachmentPointDepth: attachmentPointDepth,
		modelMat: createIdenticalMat4(),
	};
}





////////////////////////////////////////////////////////////////
// WebGL
////////////////////////////////////////////////////////////////

function initializeWebGL_projection(gl, vsSource, fsSource) {
	const shaderProgram = initializeShaderProgram(gl, vsSource, fsSource);
	const programInfo = {
		shaderProgram: shaderProgram,
		attribLocations: {
			vertexPosition: gl.getAttribLocation(shaderProgram, 'aVertexPosition'),
			vertexColor: gl.getAttribLocation(shaderProgram, 'aVertexColor'),
		},
		uniformLocations: {
			cameraPosition: gl.getUniformLocation(shaderProgram, 'uCameraPosition'),
			projectionMatrix: gl.getUniformLocation(shaderProgram, 'uProjectionMat'),
			modelMatrix: gl.getUniformLocation(shaderProgram, 'uModelMat'),
			displayPositions: gl.getUniformLocation(shaderProgram, 'uDisplayPositions'),
			displayModelMatrix: gl.getUniformLocation(shaderProgram, 'uDisplayModelMat'),
			worldMatrix: gl.getUniformLocation(shaderProgram, 'uWorldMat'),
		},
	};
	return programInfo;
}


function render_projection(gl, programInfo, display, objects)
{
	gl.useProgram(programInfo.shaderProgram);

	gl.enable(gl.DEPTH_TEST);

	// Render buffer
	gl.bindFramebuffer(gl.FRAMEBUFFER, display.frameBuffer);
	gl.bindTexture(gl.TEXTURE_2D, display.colorBuffer);
	gl.bindRenderbuffer(gl.RENDERBUFFER, display.depthBuffer);
	gl.viewport(0, 0, display_texture_resolution, display_texture_resolution);

	// Clear
	gl.clearColor(0.1, 0.1, 0.0, 1.0);
	gl.clearDepth(1.0);
	gl.depthFunc(gl.LEQUAL);
	gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

	const world = createIdenticalMat4();

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

	gl.uniform4fv(
	    programInfo.uniformLocations.cameraPosition,
	    cameraPosition);
	gl.uniformMatrix4fv(
	    programInfo.uniformLocations.displayPositions,
	    false,
	    display.positions);
	gl.uniformMatrix4fv(
	    programInfo.uniformLocations.displayModelMatrix,
	    false,
	    display.modelMat);
	gl.uniformMatrix4fv(
	    programInfo.uniformLocations.worldMatrix,
	    false,
	    world);

	objects.forEach((object) => {
		const modelMat = createIdenticalMat4();
		const rotXMat = createRotationMat4_x(rotx);
		const rotYMat = createRotationMat4_y(Math.PI * 0.1);
		multiplyMat4(rotYMat, rotYMat, rotXMat);
		multiplyMat4(modelMat, object.modelMat, rotYMat);
		gl.uniformMatrix4fv(
		    programInfo.uniformLocations.modelMatrix,
		    false,
		    modelMat);

		drawing(programInfo.attribLocations.vertexPosition, object.position);
		drawing(programInfo.attribLocations.vertexColor, object.color);
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



function createCube(gl)
{
	let positionBuffer = gl.createBuffer();
	let pos = [
		// front
		-0.5, -0.5, -0.5,
		 0.5, -0.5, -0.5,
		 0.5,  0.5, -0.5,
		-0.5,  0.5, -0.5,
		// top
		-0.5,  0.5, -0.5,
		 0.5,  0.5, -0.5,
		 0.5,  0.5,  0.5,
		-0.5,  0.5,  0.5,
		// bottom
		-0.5, -0.5,  0.5,
		 0.5, -0.5,  0.5,
		 0.5, -0.5, -0.5,
		-0.5, -0.5, -0.5,
		// back
		 0.5, -0.5,  0.5,
		-0.5, -0.5,  0.5,
		-0.5,  0.5,  0.5,
		 0.5,  0.5,  0.5,
		// right
		 0.5, -0.5, -0.5,
		 0.5,  0.5, -0.5,
		 0.5,  0.5,  0.5,
		 0.5, -0.5,  0.5,
		// left
		-0.5, -0.5, -0.5,
		-0.5, -0.5,  0.5,
		-0.5,  0.5,  0.5,
		-0.5,  0.5, -0.5,
	];
	gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
	gl.bufferData(
	    gl.ARRAY_BUFFER,
	    new Float32Array(pos),
	    gl.STATIC_DRAW);

	let colorBuffer = gl.createBuffer();
	let col = [
	    // front
	    0.0, 1.0, 0.0, 1.0,
	    0.0, 1.0, 0.0, 1.0,
	    0.0, 1.0, 0.0, 1.0,
	    0.0, 1.0, 0.0, 1.0,
	    // top 
	    1.0, 0.0, 0.0, 1.0,
	    1.0, 0.0, 0.0, 1.0,
	    1.0, 0.0, 0.0, 1.0,
	    1.0, 0.0, 0.0, 1.0,
	    // bottom
	    0.0, 0.0, 1.0, 1.0,
	    0.0, 0.0, 1.0, 1.0,
	    0.0, 0.0, 1.0, 1.0,
	    0.0, 0.0, 1.0, 1.0,
	    // back
	    1.0, 1.0, 1.0, 1.0,
	    1.0, 1.0, 1.0, 1.0,
	    1.0, 1.0, 1.0, 1.0,
	    1.0, 1.0, 1.0, 1.0,
	    // right
	    1.0, 1.0, 0.0, 1.0,
	    1.0, 1.0, 0.0, 1.0,
	    1.0, 1.0, 0.0, 1.0,
	    1.0, 1.0, 0.0, 1.0,
	    // left
	    0.0, 1.0, 1.0, 1.0,
	    0.0, 1.0, 1.0, 1.0,
	    0.0, 1.0, 1.0, 1.0,
	    0.0, 1.0, 1.0, 1.0,
	];
	gl.bindBuffer(gl.ARRAY_BUFFER, colorBuffer);
	gl.bufferData(
	    gl.ARRAY_BUFFER,
	    new Float32Array(col),
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
		color: { elements: col, buffer: colorBuffer, type: gl.FLOAT, numComponents: 4, normalize: false },
		index: { elements: index, buffer: indexBuffer, type: gl.UNSIGNED_SHORT },
		modelMat: createIdenticalMat4(),
	};
}

