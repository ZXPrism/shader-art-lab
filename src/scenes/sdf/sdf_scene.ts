import { BindGroupBuilder } from "../../bind_group_builder";
import { define_config } from "../../config";
import { create_gpu_uniform_buffer } from "../../kernel_utils";
import {
    Scene,
    type SceneContext,
    type SceneFrame,
    type SceneSize,
} from "../scene";
import { sdf_shader } from "./shader";

export class SdfScene extends Scene {
    public override readonly config = define_config(
        {
            animation_speed: 1,
        },
        [
            {
                key: "animation_speed",
                label: "Animation Speed",
                widget: "slider",
                min: 0,
                max: 3,
                step: 0.01,
            },
        ],
    );

    private pipeline!: GPURenderPipeline;
    private bind_group!: GPUBindGroup;
    private frame_buffer!: GPUBuffer;

    public constructor(context: SceneContext) {
        super(context);
    }

    public init(_size: SceneSize): void {
        this.pipeline = this.create_render_pipeline({
            label: "cosine palette pipeline",
            code: sdf_shader,
            primitive: {
                topology: "triangle-strip",
            },
        });

        this.frame_buffer = create_gpu_uniform_buffer(
            this.context.device,
            "cosine palette frame uniforms",
            16,
        );

        const bind_group = new BindGroupBuilder(this.context.device, "cosine palette bind group")
            .add_buffer("frame", 0, this.frame_buffer)
            .build_raw(this.pipeline);

        if (!bind_group.bind_group_object) {
            throw new Error("Failed to create the cosine palette bind group.");
        }
        this.bind_group = bind_group.bind_group_object;
    }

    public render(frame: SceneFrame): void {
        const uniforms = new Float32Array([
            frame.time_seconds,
            this.config.values.animation_speed,
            0,
            0,
        ]);
        this.context.device.queue.writeBuffer(this.frame_buffer, 0, uniforms);

        const pass = frame.encoder.beginRenderPass({
            label: "cosine palette pass",
            colorAttachments: [
                {
                    view: frame.output_view,
                    clearValue: { r: 0, g: 0, b: 0, a: 1 },
                    loadOp: "clear",
                    storeOp: "store",
                },
            ],
        });

        pass.setPipeline(this.pipeline);
        pass.setBindGroup(0, this.bind_group);
        pass.draw(4);
        pass.end();
    }

    public override destroy(): void {
        this.frame_buffer?.destroy();
    }
}
