#ifdef ENVMAP_TYPE_CUBE_UV

#include <cube_uv_reflection_fragment>
#include <lights_physical_pars_fragment>

vec3 getIBLRadiance(const in vec3 viewDir, const in vec3 normal, const in float roughness) {
  vec3 reflectVec = reflect(-viewDir, normal);
  reflectVec = normalize(mix(reflectVec, normal, roughness * roughness));
  vec4 envMapColor = textureCubeUV(envMap, reflectVec, roughness);
  return envMapColor.rgb * envMapIntensity;
}

vec3 getIBLIrradiance(const in vec3 normal) {
  vec3 envMapColor = textureCubeUV(envMap, normal, 1.0).rgb;
  return PI * envMapColor * envMapIntensity;
}

vec3 getLight(const in vec3 position, const in vec3 normal, const in vec3 diffuse) {
  PhysicalMaterial material;
  material.diffuseColor = diffuse * (1.0 - metalness);
  material.roughness = max(min(roughness, 1.0), 0.0525);
  material.specularColor = mix(vec3(0.04), diffuse, metalness);
  material.specularF90 = 1.0;

  vec3 clearCoatNormal;
  vec3 clearCoatRadiance;
  vec3 viewDir = normalize(cameraPosition - position);

  vec3 radiance = getIBLRadiance(viewDir, normal, material.roughness);
  vec3 irradiance = getIBLIrradiance(normal);

  ReflectedLight reflectedLight;
  RE_IndirectDiffuse_Physical(irradiance, position, normal, viewDir, clearCoatNormal, material, reflectedLight);
  RE_IndirectSpecular_Physical(radiance, irradiance, clearCoatRadiance, position, normal, viewDir, clearCoatNormal, material, reflectedLight);

  return reflectedLight.indirectDiffuse + reflectedLight.indirectSpecular;
}

#else

vec3 getLight(const in vec3 position, const in vec3 normal, const in vec3 diffuse) {
  return diffuse * envMapIntensity;
}

#endif
