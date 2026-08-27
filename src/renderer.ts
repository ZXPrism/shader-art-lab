import type { BindGroup } from "./bind_group";
import { BindGroupBuilder } from "./bind_group_builder";
import { ConfigManager } from "./config";

import { get_shader_utils } from "./shaders/utils";
import { get_shader_blit } from "./shaders/blit";

import { ShaderReflector } from "./shader_reflector/shader_reflector";
import { EventBus } from "./event_bus";
import { create_gpu_uniform_buffer, create_gpu_uniform_buffer_f32 } from "./kernel_utils";

import { vec3, mat4 } from "gl-matrix";

export class Renderer {
    private _config_manager: ConfigManager;

    _event_bus!: EventBus;

    _device!: GPUDevice;
    _context!: GPUCanvasContext;
    _presentation_format!: GPUTextureFormat;
    _canvas_width!: number;
    _canvas_height!: number;

    _blit_pipeline!: GPURenderPipeline;
    _blit_bind_group!: BindGroup;

    _utils_shader_reflector!: ShaderReflector;

    constructor(config_manager: ConfigManager) {
        this._config_manager = config_manager;
    }

    public async main() {
        await this.init_webgpu();
        this.init_canvas_size();
        if (await this.pre_init()) {
            this.init_kernels();
            await this.init_bind_groups();
            this.init_callbacks();
            this.render();
        }
    }

    public async init_webgpu() {
        const adapter = await navigator.gpu.requestAdapter();
        if (adapter === null) {
            throw new Error("Failed to request WebGPU adapter. Your browser may not support WebGPU.");
        }

        const device = await adapter.requestDevice({
            requiredLimits: {
                maxBufferSize: adapter.limits.maxBufferSize,
                maxStorageBufferBindingSize: adapter.limits.maxStorageBufferBindingSize,
                maxComputeInvocationsPerWorkgroup: adapter.limits.maxComputeInvocationsPerWorkgroup,
                maxComputeWorkgroupSizeX: adapter.limits.maxComputeWorkgroupSizeX,
                maxStorageBuffersPerShaderStage: adapter.limits.maxStorageBuffersPerShaderStage
            },
            requiredFeatures: ["subgroups"] as const,
        });
        if (device === null) {
            throw new Error("Failed to request WebGPU device.");
        }

        // Catch uncaptured WebGPU errors and convert to thrown errors
        device.addEventListener('uncapturederror', (event) => {
            throw new Error(`WebGPU Error: ${event.error.message}`);
        });

        this._device = device;

        this._presentation_format = navigator.gpu.getPreferredCanvasFormat();

        const canvas = document.querySelector("canvas");
        if (canvas === null) {
            throw new Error("could not find canvas element. please check index.html!");
        }

        const context = canvas.getContext("webgpu");
        if (context === null) {
            console.error("failed to initialize WebGPU!");
            return;
        }

        context.configure({// srgb?? gamma correction??
            device: this._device,
            format: this._presentation_format,
        });
        this._context = context;

        console.info("WebGPU initialized successfully 😘");
    }

    public async pre_init(): Promise<boolean> {
        this._utils_shader_reflector = new ShaderReflector(get_shader_utils(this._config_manager.config));
        this._event_bus = new EventBus();

        return true;
    }

    public prepare_scene_info_data(): ArrayBuffer {
        // ========
        //  camera
        // ========
        // let camera_gaze_norm = normalize(camera_info.center - camera_info.eye);
        // let camera_right_norm = normalize(cross(camera_gaze_norm, vec3f(0.0, 1.0, 0.0)));
        // let camera_down_norm = cross(camera_gaze_norm, camera_right_norm);

        const config = this._config_manager.config;

        const camera_gaze_norm = vec3.create(); // F
        vec3.sub(camera_gaze_norm, config.camera_center, config.camera_eye);
        vec3.normalize(camera_gaze_norm, camera_gaze_norm);

        const camera_right_norm = vec3.create(); // R
        vec3.cross(camera_right_norm, camera_gaze_norm, vec3.fromValues(0.0, 1.0, 0.0));
        vec3.normalize(camera_right_norm, camera_right_norm);

        const camera_down_norm = vec3.create(); // D
        vec3.cross(camera_down_norm, camera_gaze_norm, camera_right_norm);

        const fy = this._canvas_height / (2.0 * Math.tan(config.camera_fov_y / 2.0));
        const fx = fy;
        const cx = this._canvas_width / 2.0;
        const cy = this._canvas_height / 2.0;
        const intrinsics = mat4.fromValues(
            fx, 0.0, 0.0, 0.0,
            0.0, fy, 0.0, 0.0,
            cx, cy, 1.0, 0.0,
            0.0, 0.0, 0.0, 1.0,
        );
        const inv_intrinsics = mat4.create();
        mat4.invert(inv_intrinsics, intrinsics);

        const c2w = mat4.fromValues(
            camera_right_norm[0], camera_right_norm[1], camera_right_norm[2], 0.0,
            camera_down_norm[0], camera_down_norm[1], camera_down_norm[2], 0.0,
            camera_gaze_norm[0], camera_gaze_norm[1], camera_gaze_norm[2], 0.0,
            config.camera_eye[0], config.camera_eye[1], config.camera_eye[2], 1.0,
        );
        const w2c = mat4.create();
        mat4.invert(w2c, c2w);


        // =================
        //  fill scene info
        // =================
        // see `struct SceneInfo` in `utils.wgsl`

        const scene_info_struct = this._utils_shader_reflector.get_struct("SceneInfo");
        scene_info_struct
            .set_field("intrinsics", intrinsics)
            .set_field("extrinsics", w2c)
            .set_field("inv_intrinsics", inv_intrinsics)
            .set_field("inv_extrinsics", c2w)
            .set_field("width", this._canvas_width)
            .set_field("height", this._canvas_height)
            .set_field("eye", config.camera_eye);

        return scene_info_struct.data;
    }

    public init_canvas_size() {
        const canvas = document.querySelector("canvas");
        if (canvas === null) {
            throw new Error("could not find canvas element. please check index.html!");
        }

        const dpr = window.devicePixelRatio;
        canvas.width = Math.floor(dpr * canvas.clientWidth);
        canvas.height = Math.floor(dpr * canvas.clientHeight);
        this._canvas_width = canvas.width;
        this._canvas_height = canvas.height;
    }

    public init_kernels() {
        const config = this._config_manager.config;
        const shader_utils = get_shader_utils(config);

        // =========
        //  kernels
        // =========
        const blit_bind_group_layout = this._device.createBindGroupLayout({
            entries: [
                {
                    binding: 0,
                    visibility: GPUShaderStage.FRAGMENT,
                    buffer: {
                        type: "uniform"
                    }
                },
                {
                    binding: 1,
                    visibility: GPUShaderStage.FRAGMENT,
                    buffer: {
                        type: "uniform"
                    }
                },
            ]
        });
        const blit_pipeline_layout = this._device.createPipelineLayout({
            bindGroupLayouts: [blit_bind_group_layout]
        });
        this._blit_pipeline = this._device.createRenderPipeline({
            label: "blit pipeline",
            layout: blit_pipeline_layout,
            vertex: {
                module: this._device.createShaderModule({
                    code: shader_utils + get_shader_blit(config),
                }),
                entryPoint: "vertex"
            },
            fragment: {
                module: this._device.createShaderModule({
                    code: shader_utils + get_shader_blit(config),
                }),
                entryPoint: "fragment",
                targets: [
                    {
                        format: this._presentation_format,
                        writeMask: GPUColorWrite.ALL
                    }
                ]
            },
            primitive: {
                topology: "triangle-strip"
            },
        });
    }

    public async init_bind_groups() {
        const scene_info_data = this.prepare_scene_info_data();
        const scene_info_buffer = create_gpu_uniform_buffer(this._device, "scene info", scene_info_data.byteLength);
        this._device.queue.writeBuffer(scene_info_buffer, 0, scene_info_data);

        const time_buffer = create_gpu_uniform_buffer_f32(this._device, "time", 0.0);

        this._blit_bind_group = new BindGroupBuilder(this._device, "blit bind group")
            .add_buffer("in_scene_info", 0, scene_info_buffer)
            .add_buffer("in_time", 1, time_buffer)
            .build_raw(this._blit_pipeline);
    }

    public init_callbacks() {
        this._event_bus.listen("canvas-size-changed", () => {
            this.init_canvas_size();
            this.init_bind_groups();
        });

        this._event_bus.listen("config-changed", () => {
            this.init_kernels();
            this.init_bind_groups();
        });

        let resize_callback: number;
        addEventListener("resize", () => {
            if (resize_callback) {
                clearTimeout(resize_callback);
            }
            resize_callback = setTimeout(() => {
                // Wait for the browser to complete layout updates before reading canvas size
                requestAnimationFrame(() => {
                    this._event_bus.emit("canvas-size-changed");
                });
            }, 100);
        });
    }

    public get_event_bus(): EventBus {
        return this._event_bus;
    }

    public render() {
        let last_timestamp: DOMHighResTimeStamp | null = null;
        let time_acc = 0.0;

        const _render = async (time: DOMHighResTimeStamp) => {
            window.requestAnimationFrame(_render);

            this._event_bus.process();

            if (last_timestamp === null) {
                last_timestamp = time;
            }
            const delta_time = time - last_timestamp;
            last_timestamp = time;
            time_acc += delta_time;

            const buffer = new Float32Array(1);
            buffer[0] = time_acc;
            this._device.queue.writeBuffer(this._blit_bind_group.get_buffer("in_time"), 0, buffer.buffer);

            const config = this._config_manager.config;

            const command_encoder = this._device.createCommandEncoder();
            {
                command_encoder.pushDebugGroup("frame");
                {
                    command_encoder.pushDebugGroup("blit");
                    {
                        const sky_color = config.sky_color;
                        const blit_render_pass = command_encoder.beginRenderPass({
                            colorAttachments: [
                                {
                                    view: this._context.getCurrentTexture().createView(),
                                    clearValue: { r: sky_color[0], g: sky_color[1], b: sky_color[2], a: 1 },
                                    loadOp: "clear",
                                    storeOp: "store",
                                },
                            ],
                        });
                        blit_render_pass.setBindGroup(0, this._blit_bind_group.bind_group_object);
                        blit_render_pass.setPipeline(this._blit_pipeline);
                        blit_render_pass.draw(4, 1);
                        blit_render_pass.end();

                        command_encoder.popDebugGroup();
                    }

                    command_encoder.popDebugGroup();
                }

                this._device.queue.submit([command_encoder.finish()]);
            }
        };

        window.requestAnimationFrame(_render);
    }
}
