import {
  DepthTexture,
  LessDepth,
  GLSL3,
  Math as ThreeMath,
  Mesh,
  PlaneGeometry,
  RawShaderMaterial,
  Vector2,
  Vector3,
  WebGLRenderTarget,
} from 'three';
import raymarcherFragment from './shaders/raymarcher.frag';
import raymarcherVertex from './shaders/raymarcher.vert';
import screenFragment from './shaders/screen.frag';
import screenVertex from './shaders/screen.vert';

class Raymarcher extends Mesh {
  constructor({
    entities,
    lightDirection = new Vector3(-1.0, -1.0, -1.0),
    resolution = 1,
  }) {
    const geometry = new PlaneGeometry(2, 2, 1, 1);
    geometry.deleteAttribute('normal');
    geometry.deleteAttribute('uv');
    const target = new WebGLRenderTarget(
      1, 1, { depthTexture: new DepthTexture() }
    );
    super(
      geometry,
      new RawShaderMaterial({
        depthFunc: LessDepth,
        glslVersion: GLSL3,
        vertexShader: screenVertex,
        fragmentShader: screenFragment,
        uniforms: {
          colorTexture: { value: target.texture },
          depthTexture: { value: target.depthTexture },
        },
      })
    );
    const material = new RawShaderMaterial({
      glslVersion: GLSL3,
      vertexShader: raymarcherVertex,
      fragmentShader: raymarcherFragment,
      defines: {
        MIN_DISTANCE: '0.01',
        MAX_DISTANCE: '1000.0',
        MAX_ENTITIES: `${entities.length}`,
        MAX_ITERATIONS: '256',
      },
      uniforms: {
        aspect: { value: new Vector2() },
        camera: { value: new Vector3() },
        cameraForward: { value: new Vector3() },
        lightDirection: { value: lightDirection },
        entities: {
          value: entities,
          properties: {
            color: {},
            position: {},
            scale: {},
            shape: {},
          },
        },
      },
    });
    this.userData = {
      entities,
      material,
      mesh: new Mesh(geometry, material),
      resolution,
      size: new Vector2(),
      target,
    };
    this.matrixAutoUpdate = this.userData.mesh.matrixAutoUpdate = false;
    this.frustumCulled = this.userData.mesh.frustumCulled = false;
  }

  dispose() {
    const { material, geometry, userData } = this;
    material.dispose();
    geometry.dispose();
    userData.material.dispose();
    userData.target.dispose();
    userData.target.depthTexture.dispose();
    userData.target.texture.dispose();
  }

  onBeforeRender(renderer, s, camera) {
    const { userData: { entities, material: { defines, uniforms }, mesh, resolution, size, target } } = this;
    defines.MAX_ENTITIES = `${entities.length}`;
    renderer.getDrawingBufferSize(size).multiplyScalar(resolution);
    if (size.x !== target.width || size.y !== target.height) {
      const { near: zNear, far: zFar, fov } = camera;
      target.setSize(size.x, size.y);
      uniforms.aspect.value.set(
        size.y / size.x,
        size.x / size.y
      );
      uniforms.camera.value.set(
        1.0 / Math.tan(ThreeMath.degToRad(fov) / 2.0),
        (zFar + zNear) / (zFar - zNear),
        (2 * zFar * zNear) / (zFar - zNear)
      );
    }
    camera.getWorldDirection(uniforms.cameraForward.value);
    const currentRenderTarget = renderer.getRenderTarget();
    const currentXrEnabled = renderer.xr.enabled;
    const currentShadowAutoUpdate = renderer.shadowMap.autoUpdate;
    renderer.xr.enabled = false;
    renderer.shadowMap.autoUpdate = false;
    renderer.setRenderTarget(target);
    renderer.state.buffers.depth.setMask(true);
    if (!renderer.autoClear) renderer.clear();
    renderer.render(mesh, camera);
    renderer.xr.enabled = currentXrEnabled;
    renderer.shadowMap.autoUpdate = currentShadowAutoUpdate;
    renderer.setRenderTarget(currentRenderTarget);
    if (camera.viewport) renderer.state.viewport(camera.viewport);
  }
}

Raymarcher.shapes = {
  box: 0,
  sphere: 1, 
};

export default Raymarcher;
