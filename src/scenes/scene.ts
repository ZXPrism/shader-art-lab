import type { SceneConfig } from "../config";

export interface SceneSize {
    width: number;
    height: number;
}

export interface SceneContext {
    device: GPUDevice;
    canvas_format: GPUTextureFormat;
}

export type SceneFactory = (context: SceneContext) => Scene;

export interface SceneFrame extends SceneSize {
    encoder: GPUCommandEncoder;
    output_view: GPUTextureView;
    time_seconds: number;
    delta_seconds: number;
    frame_index: number;
}

export interface RenderPipelineOptions {
    label: string;
    code: string;
    targets?: readonly GPUColorTargetState[];
    vertex_entry?: string;
    fragment_entry?: string;
    bind_group_layouts?: readonly GPUBindGroupLayout[];
    primitive?: GPUPrimitiveState;
}

export interface ComputePipelineOptions {
    label: string;
    code: string;
    entry_point: string;
    bind_group_layouts?: readonly GPUBindGroupLayout[];
    constants?: Record<string, number>;
}

export interface MrtTargetDefinition {
    label: string;
    format: GPUTextureFormat;
    usage?: GPUTextureUsageFlags;
}

export interface MrtTarget {
    texture: GPUTexture;
    view: GPUTextureView;
    format: GPUTextureFormat;
}

const EMPTY_CONFIG: SceneConfig = {
    values: {},
    fields: [],
};

export abstract class Scene {
    public readonly config: SceneConfig = EMPTY_CONFIG;
    protected readonly context: SceneContext;

    protected constructor(context: SceneContext) {
        this.context = context;
    }

    public abstract init(size: SceneSize): void | Promise<void>;

    public abstract render(frame: SceneFrame): void;

    public resize(_size: SceneSize): void {}

    public on_config_changed(_key: string): void {}

    public destroy(): void {}

    protected create_render_pipeline(options: RenderPipelineOptions): GPURenderPipeline {
        const module = this.context.device.createShaderModule({
            label: `${options.label} shader module`,
            code: options.code,
        });

        const layout = options.bind_group_layouts === undefined
            ? "auto"
            : this.context.device.createPipelineLayout({
                label: `${options.label} pipeline layout`,
                bindGroupLayouts: [...options.bind_group_layouts],
            });

        return this.context.device.createRenderPipeline({
            label: options.label,
            layout,
            vertex: {
                module,
                entryPoint: options.vertex_entry ?? "vertex",
            },
            fragment: {
                module,
                entryPoint: options.fragment_entry ?? "fragment",
                targets: options.targets === undefined
                    ? [{ format: this.context.canvas_format }]
                    : [...options.targets],
            },
            primitive: options.primitive,
        });
    }

    protected create_compute_pipeline(options: ComputePipelineOptions): GPUComputePipeline {
        const module = this.context.device.createShaderModule({
            label: `${options.label} shader module`,
            code: options.code,
        });

        const layout = options.bind_group_layouts === undefined
            ? "auto"
            : this.context.device.createPipelineLayout({
                label: `${options.label} pipeline layout`,
                bindGroupLayouts: [...options.bind_group_layouts],
            });

        return this.context.device.createComputePipeline({
            label: options.label,
            layout,
            compute: {
                module,
                entryPoint: options.entry_point,
                constants: options.constants,
            },
        });
    }

    protected create_mrt_targets(
        size: SceneSize,
        definitions: readonly MrtTargetDefinition[],
    ): MrtTarget[] {
        return definitions.map((definition) => {
            const texture = this.context.device.createTexture({
                label: definition.label,
                size: {
                    width: Math.max(1, size.width),
                    height: Math.max(1, size.height),
                },
                format: definition.format,
                usage: definition.usage
                    ?? (GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING),
            });

            return {
                texture,
                view: texture.createView(),
                format: definition.format,
            };
        });
    }
}
