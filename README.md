[three-raymarcher](https://github.com/danielesteban/three-raymarcher)
[![npm-version](https://img.shields.io/npm/v/three-raymarcher.svg)](https://www.npmjs.com/package/three-raymarcher)
==

## Examples

 * Animation: [glitch.com/~three-raymarcher](https://glitch.com/edit/#!/three-raymarcher)
 * Interactive: [glitch.com/~three-raymarcher-interactive](https://glitch.com/edit/#!/three-raymarcher-interactive)
 * Physics: [glitch.com/~three-raymarcher-physics](https://glitch.com/edit/#!/three-raymarcher-physics)
 * Reactive: [glitch.com/~three-raymarcher-reactive](https://glitch.com/edit/#!/three-raymarcher-reactive)
 * Skinning: [glitch.com/~three-raymarcher-skinning](https://glitch.com/edit/#!/three-raymarcher-skinning)
 * Transform: [glitch.com/~three-raymarcher-transform](https://glitch.com/edit/#!/three-raymarcher-transform)
 * react-three-fiber: [codesandbox.io/s/three-raymarcher-3xdor](https://codesandbox.io/s/three-raymarcher-3xdor)

## Installation

```bash
npm i three-raymarcher
```

## Basic usage

```js
import {
  Color, PerspectiveCamera, Quaternion, Scene, Vector3, WebGLRenderer
} from 'three';
import Raymarcher from 'three-raymarcher';

const aspect = window.innerWidth / window.innerHeight;
const camera = new PerspectiveCamera(70, aspect, 0.01, 1000);
const renderer = new WebGLRenderer();
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

const scene = new Scene();
const raymarcher = new Raymarcher({
  layers: [
    [
      {
        color: new Color(0xFF0000),
        operation: Raymarcher.operations.union,
        position: new Vector3(-1.5, 0, -4),
        rotation: new Quaternion(0, 0, 0, 1),
        scale: new Vector3(1, 1, 1),
        shape: Raymarcher.shapes.box,
      },
    ],
    [
      {
        color: new Color(0x00FF00),
        operation: Raymarcher.operations.union,
        position: new Vector3(0, 0, -4),
        rotation: new Quaternion(0, 0, 0, 1),
        scale: new Vector3(0.5, 1, 0.5),
        shape: Raymarcher.shapes.capsule,
      },
    ],
    [
      {
        color: new Color(0x0000FF),
        operation: Raymarcher.operations.union,
        position: new Vector3(1.5, 0, -4),
        rotation: new Quaternion(0, 0, 0, 1),
        scale: new Vector3(1, 1, 1),
        shape: Raymarcher.shapes.sphere,
      }
    ],
  ],
});
scene.add(raymarcher);

renderer.setAnimationLoop(() => (
  renderer.render(scene, camera)
));
```

## Lighting

three-raymarcher uses indirect PBR lighting only. Direct light support (DirectionalLight/PointLight/SpotLight) will come in future versions.

Assign a CubeUVMap texture to `userData.envMap` and control it's intensity with `userData.envMapIntensity`:

```js
(new RGBELoader()).load('environment.hdr', (texture) => {
  raymarcher.userData.envMap = (new PMREMGenerator(renderer)).fromEquirectangular(texture).texture;
  raymarcher.userData.envMapIntensity = 0.7;
});
```

`userData.metalness` controls the global metalness of the material.

`userData.roughness` controls the global roughness of the material.

If you don't set an envMap, the shader will use `vec3(envMapIntensity)` as the ambient light.

## Raymarching

`userData.blending` controls the global smoothing of the union, substraction and intersection operations.

`userData.conetracing` enables/disables conetracing (sort of antialias).

You can increase the performance by setting `userData.resolution` to something less than 1. In most of the examples is set to 0.5 (2x downsampling), which seems to give the best quality/performance trade-off.

## Raycasting

three-raymarcher supports the three.js [Raycaster](https://threejs.org/docs/api/en/core/Raycaster) out of the box:

```js
const [hit] = raycaster.intersectObject(raymarcher);
if (hit) {
  console.log(
    hit.entityId, // The index of the intersected entity
    hit.entity, // A reference to the intersected entity
    hit.layerId, // The index of the intersected entity layer
    hit.layer, // A reference to the intersected entity layer
  );
}
```

## Want to contribute?

Here's how to setup the module dev environment:

```bash
# clone this repo
git clone https://github.com/danielesteban/three-raymarcher.git
cd three-raymarcher
# install dependencies
pnpm install
# start the environment:
pnpm start
# open http://localhost:8080/examples/animation in your browser
```
