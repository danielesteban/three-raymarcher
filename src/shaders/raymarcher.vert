out vec3 ray;
in vec3 position;
uniform float cameraFov;
uniform vec2 resolution;
uniform mat4 viewMatrix;

void main() {
  gl_Position = vec4(position.xy, 0, 1);
  float aspect = resolution.y / resolution.x;
  vec2 uv = vec2(position.x, position.y * aspect);
  float cameraDistance = (1.0 / tan(cameraFov / 2.0)) * aspect;
  ray = normalize(vec3(uv, -cameraDistance) * mat3(viewMatrix));
}
