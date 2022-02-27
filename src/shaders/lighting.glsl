#ifdef ENVMAP_TYPE_CUBE_UV

#define PI 3.141592653589793
#define RECIPROCAL_PI 0.3183098861837907

struct GeometricContext {
  vec3 normal;
  vec3 viewDir;
};

struct PhysicalMaterial {
  vec3 diffuseColor;
  float roughness;
  vec3 specularColor;
  float specularF90;
};

struct ReflectedLight {
  vec3 indirectDiffuse;
  vec3 indirectSpecular;
};

vec3 BRDF_Lambert(const in vec3 diffuseColor) {
  return RECIPROCAL_PI * diffuseColor;
}

vec2 DFGApprox(const in vec3 normal, const in vec3 viewDir, const in float roughness) {
  float dotNV = saturate(dot(normal, viewDir));
  const vec4 c0 = vec4(-1.0, -0.0275, -0.572, 0.022);
  const vec4 c1 = vec4(1.0, 0.0425, 1.04, -0.04);
  vec4 r = roughness * c0 + c1;
  float a004 = min(r.x * r.x, exp2(-9.28 * dotNV)) * r.x + r.y;
  vec2 fab = vec2(-1.04, 1.04) * a004 + r.zw;
  return fab;
}

void computeMultiscattering(const in vec3 normal, const in vec3 viewDir, const in vec3 specularColor, const in float specularF90, const in float roughness, inout vec3 singleScatter, inout vec3 multiScatter) {
  vec2 fab = DFGApprox(normal, viewDir, roughness);
  vec3 FssEss = specularColor * fab.x + specularF90 * fab.y;
  float Ess = fab.x + fab.y;
  float Ems = 1.0 - Ess;
  vec3 Favg = specularColor + (1.0 - specularColor) * 0.047619;
  vec3 Fms = FssEss * Favg / (1.0 - Ems * Favg);
  singleScatter += FssEss;
  multiScatter += Fms * Ems;
}

void RE_IndirectDiffuse(const in vec3 irradiance, const in GeometricContext geometry, const in PhysicalMaterial material, inout ReflectedLight reflectedLight) {
  reflectedLight.indirectDiffuse += irradiance * BRDF_Lambert(material.diffuseColor);
}

void RE_IndirectSpecular(const in vec3 radiance, const in vec3 irradiance, const in GeometricContext geometry, const in PhysicalMaterial material, inout ReflectedLight reflectedLight) {
  vec3 singleScattering = vec3(0.0);
  vec3 multiScattering = vec3(0.0);
  vec3 cosineWeightedIrradiance = irradiance * RECIPROCAL_PI;
  computeMultiscattering(geometry.normal, geometry.viewDir, material.specularColor, material.specularF90, material.roughness, singleScattering, multiScattering);
  vec3 diffuse = material.diffuseColor * (1.0 - (singleScattering + multiScattering));
  reflectedLight.indirectSpecular += radiance * singleScattering;
  reflectedLight.indirectSpecular += multiScattering * cosineWeightedIrradiance;
  reflectedLight.indirectDiffuse += diffuse * cosineWeightedIrradiance;
}

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
  GeometricContext geometry;
  geometry.normal = normal;
  geometry.viewDir = normalize(cameraPosition - position);

  PhysicalMaterial material;
  material.diffuseColor = diffuse * (1.0 - metalness);
  material.roughness = max(min(roughness, 1.0), 0.0525);
  material.specularColor = mix(vec3(0.04), diffuse, metalness);
  material.specularF90 = 1.0;

  ReflectedLight reflectedLight = ReflectedLight(vec3(0.0), vec3(0.0));
  vec3 radiance = getIBLRadiance(geometry.viewDir, geometry.normal, material.roughness);
  vec3 irradiance = getIBLIrradiance(geometry.normal);
  RE_IndirectDiffuse(irradiance, geometry, material, reflectedLight);
  RE_IndirectSpecular(radiance, irradiance, geometry, material, reflectedLight);

  return reflectedLight.indirectDiffuse + reflectedLight.indirectSpecular;
}

#else

vec3 getLight(const in vec3 position, const in vec3 normal, const in vec3 diffuse) {
  return diffuse * envMapIntensity;
}

#endif
