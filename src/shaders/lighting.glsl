vec3 getLight(const in vec3 position, const in vec3 normal, const in vec3 color, const in float metalness, const in float roughness) {
  #ifdef ENVMAP_TYPE_CUBE_UV
    vec3 light = textureCubeUV(envMap, normal, 1.0).rgb * envMapIntensity;
  #else
    vec3 light = vec3(envMapIntensity);
  #endif
  #if NUM_LIGHTS > 0
    vec3 viewDirection = normalize(cameraPosition - position);
    for (int i = 0; i < NUM_LIGHTS; i++) {
      vec3 direction = normalize(-lights[i].direction);
      vec3 halfway = normalize(direction + viewDirection);
      light += lights[i].color * (
        max(dot(direction, normal), 0.0)
        + pow(max(dot(normal, halfway), 0.0), 32.0)
      );
    }
  #endif
  return color * light;
}
