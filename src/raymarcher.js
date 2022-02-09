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
  Vector4,
  WebGLRenderTarget,
} from 'three';
import raymarcherFragment from './shaders/raymarcher.frag';
import raymarcherVertex from './shaders/raymarcher.vert';
import screenFragment from './shaders/screen.frag';
import screenVertex from './shaders/screen.vert';

class Raymarcher extends Mesh {
  constructor({
    entities = [{ color: new Vector3(), position: new Vector3(), rotation: new Vector4(), scale: new Vector3() }],
    lightDirection = new Vector3(-1.0, -1.0, -1.0),
    resolution = 1,
  } = {}) {
    const plane = new PlaneGeometry(2, 2, 1, 1);
    plane.deleteAttribute('normal');
    plane.deleteAttribute('uv');
    const target = new WebGLRenderTarget(1, 1, { depthTexture: new DepthTexture() });
    super(
      plane,
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
    this.userData = {
      entities,
      lightDirection,
      raymarcher: new Mesh(
        plane,
        new RawShaderMaterial({
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
            cameraDirection: { value: new Vector3() },
            entities: {
              value: entities,
              properties: {
                color: {},
                position: {},
                rotation: {},
                scale: {},
                shape: {},
              },
            },
            lightDirection: { value: lightDirection },
          },
        })
      ),
      resolution,
      size: new Vector2(),
      target,
    };
    this.matrixAutoUpdate = this.userData.raymarcher.matrixAutoUpdate = false;
    this.frustumCulled = this.userData.raymarcher.frustumCulled = false;
  }

  copy(source) {
    const { userData: { raymarcher: { material: { uniforms } } } } = this;
    const { userData: { entities, lightDirection, resolution } } = source;
    this.userData = {
      ...this.userData,
      entities: uniforms.entities.value = entities.map(({ color, position, rotation, scale, shape }) => ({
        color: color.clone(),
        position: position.clone(),
        rotation: rotation.clone(),
        scale: scale.clone(),
        shape: shape,
      })),
      lightDirection: uniforms.lightDirection.value = lightDirection.clone(),
      resolution,
    };
    return this;
  }

  dispose() {
    const { material, geometry, userData: { raymarcher, target } } = this;
    material.dispose();
    geometry.dispose();
    raymarcher.material.dispose();
    target.dispose();
    target.depthTexture.dispose();
    target.texture.dispose();
  }

  onBeforeRender(renderer, s, camera) {
    const { userData: { entities, resolution, raymarcher, size, target } } = this;
    const { material: { defines, uniforms } } = raymarcher;
    defines.MAX_ENTITIES = `${entities.length}`;
    renderer.getDrawingBufferSize(size).multiplyScalar(resolution);
    if (target.width !== size.x || target.height !== size.y) {
      target.setSize(size.x, size.y);
      uniforms.aspect.value.set(
        size.y / size.x,
        size.x / size.y
      );
      const { near, far, fov } = camera;
      uniforms.camera.value.set(
        1.0 / Math.tan(ThreeMath.degToRad(fov) / 2.0),
        (far + near) / (far - near),
        (2 * far * near) / (far - near)
      );
    }
    camera.getWorldDirection(uniforms.cameraDirection.value);
    const currentRenderTarget = renderer.getRenderTarget();
    const currentXrEnabled = renderer.xr.enabled;
    const currentShadowAutoUpdate = renderer.shadowMap.autoUpdate;
    renderer.xr.enabled = false;
    renderer.shadowMap.autoUpdate = false;
    renderer.setRenderTarget(target);
    renderer.state.buffers.depth.setMask(true);
    if (!renderer.autoClear) renderer.clear();
    renderer.render(raymarcher, camera);
    renderer.xr.enabled = currentXrEnabled;
    renderer.shadowMap.autoUpdate = currentShadowAutoUpdate;
    renderer.setRenderTarget(currentRenderTarget);
    if (camera.viewport) renderer.state.viewport(camera.viewport);
  }
}

Raymarcher.shapes = {
  box: 0,
  capsule: 1,
  sphere: 2,
};

export default Raymarcher;
