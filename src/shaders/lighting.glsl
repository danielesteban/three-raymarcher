#define EPSILON 1e-6
#define PI 3.141592653589793
#define RECIPROCAL_PI 0.3183098861837907

struct IncidentLight {
  vec3 color;
  vec3 direction;
  bool visible;
};

struct ReflectedLight {
  vec3 directDiffuse;
  vec3 directSpecular;
  vec3 indirectDiffuse;
  vec3 indirectSpecular;
};

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

vec3 inverseTransformDirection(in vec3 dir, in mat4 matrix) {
  return normalize((vec4(dir, 0.0) * matrix).xyz);
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

vec3 BRDF_Lambert(const in vec3 diffuseColor) {
  return RECIPROCAL_PI * diffuseColor;
}

vec3 F_Schlick(const in vec3 f0, const in float f90, const in float dotVH) {
  float fresnel = exp2((-5.55473 * dotVH - 6.98316) * dotVH);
  return f0 * (1.0 - fresnel) + (f90 * fresnel);
}

float V_GGX_SmithCorrelated(const in float alpha, const in float dotNL, const in float dotNV) {
  float a2 = pow(alpha, 2.0);
  float gv = dotNL * sqrt(a2 + (1.0 - a2) * pow(dotNV, 2.0));
  float gl = dotNV * sqrt(a2 + (1.0 - a2) * pow(dotNL, 2.0));
  return 0.5 / max(gv + gl, EPSILON);
}

float D_GGX(const in float alpha, const in float dotNH) {
  float a2 = pow(alpha, 2.0);
  float denom = pow(dotNH, 2.0) * (a2 - 1.0) + 1.0;
  return RECIPROCAL_PI * a2 / pow(denom, 2.0);
}

vec3 BRDF_GGX(const in vec3 lightDir, const in vec3 viewDir, const in vec3 normal, const in vec3 f0, const in float f90, const in float roughness) {
  float alpha = pow(roughness, 2.0);
  vec3 halfDir = normalize(lightDir + viewDir);
  float dotNL = saturate(dot(normal, lightDir));
  float dotNV = saturate(dot(normal, viewDir));
  float dotNH = saturate(dot(normal, halfDir));
  float dotVH = saturate(dot(viewDir, halfDir));
  vec3 F = F_Schlick(f0, f90, dotVH);
  float V = V_GGX_SmithCorrelated(alpha, dotNL, dotNV);
  float D = D_GGX(alpha, dotNH);
  return F * (V * D);
}

void RE_Direct(const in IncidentLight directLight, const in GeometricContext geometry, const in PhysicalMaterial material, inout ReflectedLight reflectedLight) {
  float dotNL = saturate(dot(geometry.normal, directLight.direction));
  vec3 irradiance = dotNL * directLight.color;
  reflectedLight.directSpecular += irradiance * BRDF_GGX(directLight.direction, geometry.viewDir, geometry.normal, material.specularColor, material.specularF90, material.roughness);
  reflectedLight.directDiffuse += irradiance * BRDF_Lambert(material.diffuseColor);
}

void RE_IndirectDiffuse(const in GeometricContext geometry, const in PhysicalMaterial material, inout ReflectedLight reflectedLight) {
  reflectedLight.indirectDiffuse += BRDF_Lambert(material.diffuseColor);
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
  #ifdef ENVMAP_TYPE_CUBE_UV
    PhysicalMaterial material;
    material.diffuseColor = diffuse * (1.0 - metalness);
    material.roughness = max(min(roughness, 1.0), 0.0525);
    material.specularColor = mix(vec3(0.04), diffuse, metalness);
    material.specularF90 = 1.0;
    
    GeometricContext geometry;
    geometry.normal = normal;
    geometry.viewDir = normalize(cameraPosition - position);
  
    ReflectedLight reflectedLight = ReflectedLight(vec3(0.0), vec3(0.0), vec3(0.0), vec3(0.0));
    vec3 iblIrradiance = getIBLIrradiance(geometry.normal);
    vec3 radiance = getIBLRadiance(geometry.viewDir, geometry.normal, material.roughness);
    RE_IndirectDiffuse(geometry, material, reflectedLight);
    RE_IndirectSpecular(radiance, iblIrradiance, geometry, material, reflectedLight);
    vec3 indirectDiffuse = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse;
    vec3 indirectSpecular = reflectedLight.directSpecular + reflectedLight.indirectSpecular;
    return indirectDiffuse + indirectSpecular;
  #else
    return BRDF_Lambert(material.diffuseColor) * envMapIntensity;
  #endif
}
