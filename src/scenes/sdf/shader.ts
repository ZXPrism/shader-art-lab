export const sdf_shader = /* wgsl */`
struct FrameUniforms {
    time_seconds: f32,
    animation_speed: f32,
    _padding: vec2f,
}

@group(0) @binding(0) var<uniform> frame: FrameUniforms;

struct VertexOutput {
    @builtin(position) position: vec4f,
    @location(0) uv: vec2f,
}

@vertex
fn vertex(@builtin(vertex_index) vertex_index: u32) -> VertexOutput {
    var output: VertexOutput;

    let position_x = select(1.0, -1.0, (vertex_index & 1u) == 0u);
    let position_y = select(1.0, -1.0, ((vertex_index >> 1u) & 1u) == 1u);
    output.position = vec4f(position_x, position_y, 0.0, 1.0);

    let uv_x = f32(vertex_index & 1u);
    let uv_y = f32((vertex_index >> 1u) & 1u);
    output.uv = vec2f(uv_x, uv_y);

    return output;
}

@fragment
fn fragment(input: VertexOutput) -> @location(0) vec4f {
    let animation_time = 1000.0 * frame.animation_speed * frame.time_seconds;
    let color = 0.5 + 0.5 * cos(
        0.5 * animation_time + input.uv.xyx + vec3f(0.0, 2.0, 4.0)
    );

    return vec4f(color, 1.0);
}
`;
