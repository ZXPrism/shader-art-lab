import type { Config } from "../config";

export function get_shader_blit(config: Config): string {
  return /* wgsl */`
@group(0) @binding(0) var<uniform> in_scene_info: SceneInfo;
@group(0) @binding(1) var<uniform> in_time: f32;

struct VSOutput {
  @builtin(position) position: vec4f,
  @location(0) uv: vec2f
}

@vertex
fn vertex(@builtin(vertex_index) vertex_index: u32) -> VSOutput {
  var vs_output: VSOutput;

  let pos_x = select(1.0, -1.0, (vertex_index & 1u) == 0u);
  let pos_y = select(1.0, -1.0, ((vertex_index >> 1u) & 1u) == 1u);
  vs_output.position = vec4f(pos_x, pos_y, 0.0, 1.0);

  let uv_x = f32(vertex_index & 1u);
  let uv_y = f32((vertex_index >> 1u) & 1u);
  vs_output.uv = vec2f(uv_x, uv_y);

  return vs_output;
}

@fragment
fn fragment(vs_output: VSOutput) -> @location(0) vec4f {
  let uv = vs_output.uv;
  let linear_color = 0.5 + (0.5 * cos(0.5 * in_time + uv.xyx + vec3(0.0, 2.0, 4.0)));

  return vec4f(linear_color, 1.0);
}
`;
}
