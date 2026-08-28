import type { Scene, SceneFactory, SceneSize } from "./scenes/scene";

export class Renderer {
    private device: GPUDevice | null = null;
    private canvas_format: GPUTextureFormat | null = null;
    private webgpu_init_promise: Promise<void> | null = null;

    private canvas: HTMLCanvasElement | null = null;
    private canvas_context: GPUCanvasContext | null = null;
    private active_scene: Scene | null = null;
    private resize_observer: ResizeObserver | null = null;

    private canvas_width = 1;
    private canvas_height = 1;
    private animation_frame_id: number | null = null;
    private last_timestamp: number | null = null;
    private time_seconds = 0;
    private frame_index = 0;
    private mount_id = 0;

    public async mount(canvas: HTMLCanvasElement, create_scene: SceneFactory): Promise<Scene | null> {
        this.stop_active_scene();
        const current_mount_id = ++this.mount_id;

        await this.init_webgpu();
        if (current_mount_id !== this.mount_id) {
            return null;
        }

        if (!this.device || !this.canvas_format) {
            throw new Error("WebGPU initialization completed without a device or canvas format.");
        }

        const canvas_context = canvas.getContext("webgpu");
        if (!canvas_context) {
            throw new Error("Failed to create a WebGPU canvas context.");
        }

        canvas_context.configure({
            device: this.device,
            format: this.canvas_format,
            alphaMode: "opaque",
        });

        this.canvas = canvas;
        this.canvas_context = canvas_context;
        this.update_canvas_size(false);

        const scene = create_scene({
            device: this.device,
            canvas_format: this.canvas_format,
        });

        try {
            await scene.init(this.current_size());
        } catch (error) {
            scene.destroy();
            throw error;
        }

        if (current_mount_id !== this.mount_id) {
            scene.destroy();
            return null;
        }

        this.active_scene = scene;
        this.resize_observer = new ResizeObserver(() => this.update_canvas_size(true));
        this.resize_observer.observe(canvas);
        this.update_canvas_size(true);
        this.start_render_loop();

        return scene;
    }

    public unmount(): void {
        this.mount_id++;
        this.stop_active_scene();
    }

    private async init_webgpu(): Promise<void> {
        if (this.device && this.canvas_format) {
            return;
        }

        if (this.webgpu_init_promise) {
            await this.webgpu_init_promise;
            return;
        }

        this.webgpu_init_promise = this.create_webgpu_device();
        try {
            await this.webgpu_init_promise;
        } finally {
            this.webgpu_init_promise = null;
        }
    }

    private async create_webgpu_device(): Promise<void> {

        if (!navigator.gpu) {
            throw new Error("WebGPU is not supported by this browser.");
        }

        const adapter = await navigator.gpu.requestAdapter();
        if (!adapter) {
            throw new Error("Failed to request a WebGPU adapter.");
        }

        const device = await adapter.requestDevice();
        device.addEventListener("uncapturederror", (event) => {
            throw new Error(`WebGPU Error: ${event.error.message}`);
        });

        this.device = device;
        this.canvas_format = navigator.gpu.getPreferredCanvasFormat();
    }

    private update_canvas_size(notify_scene: boolean): void {
        if (!this.canvas) {
            return;
        }

        const dpr = window.devicePixelRatio || 1;
        const width = Math.max(1, Math.floor(this.canvas.clientWidth * dpr));
        const height = Math.max(1, Math.floor(this.canvas.clientHeight * dpr));

        if (width === this.canvas_width && height === this.canvas_height) {
            return;
        }

        this.canvas.width = width;
        this.canvas.height = height;
        this.canvas_width = width;
        this.canvas_height = height;

        if (notify_scene) {
            this.active_scene?.resize(this.current_size());
        }
    }

    private current_size(): SceneSize {
        return {
            width: this.canvas_width,
            height: this.canvas_height,
        };
    }

    private start_render_loop(): void {
        this.last_timestamp = null;
        this.time_seconds = 0;
        this.frame_index = 0;
        this.animation_frame_id = window.requestAnimationFrame((timestamp) => {
            this.render_frame(timestamp);
        });
    }

    private render_frame(timestamp: DOMHighResTimeStamp): void {
        this.animation_frame_id = null;

        if (!this.device || !this.canvas_context || !this.active_scene) {
            return;
        }

        const delta_seconds = this.last_timestamp === null
            ? 0
            : (timestamp - this.last_timestamp) / 1000;
        this.last_timestamp = timestamp;
        this.time_seconds += delta_seconds;

        const encoder = this.device.createCommandEncoder({ label: "scene frame" });
        const output_view = this.canvas_context.getCurrentTexture().createView();

        this.active_scene.render({
            encoder,
            output_view,
            width: this.canvas_width,
            height: this.canvas_height,
            time_seconds: this.time_seconds,
            delta_seconds,
            frame_index: this.frame_index,
        });

        this.device.queue.submit([encoder.finish()]);
        this.frame_index++;
        this.animation_frame_id = window.requestAnimationFrame((next_timestamp) => {
            this.render_frame(next_timestamp);
        });
    }

    private stop_active_scene(): void {
        if (this.animation_frame_id !== null) {
            window.cancelAnimationFrame(this.animation_frame_id);
            this.animation_frame_id = null;
        }

        this.resize_observer?.disconnect();
        this.resize_observer = null;

        const scene = this.active_scene;
        this.active_scene = null;
        scene?.destroy();

        this.canvas_context?.unconfigure();
        this.canvas_context = null;
        this.canvas = null;
        this.last_timestamp = null;
    }
}
