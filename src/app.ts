import { ConfigUI } from "./config_ui";
import { render_gallery_page } from "./pages/gallery_page";
import {
    render_not_found_page,
    render_scene_detail_page,
} from "./pages/scene_detail_page";
import { Renderer } from "./renderer";
import { get_scene_entry, scene_entries } from "./scenes/registry";

type Route =
    | { type: "gallery" }
    | { type: "scene"; scene_id: string }
    | { type: "not-found" };

export class App {
    private readonly root: HTMLElement;
    private readonly renderer = new Renderer();
    private config_ui: ConfigUI | null = null;
    private route_id = 0;

    public constructor(root: HTMLElement) {
        this.root = root;
    }

    public start(): void {
        window.addEventListener("hashchange", () => {
            void this.render_route();
        });
        void this.render_route();
    }

    private async render_route(): Promise<void> {
        const current_route_id = ++this.route_id;

        this.config_ui?.cleanup();
        this.config_ui = null;
        this.renderer.unmount();

        const route = this.parse_route(window.location.hash);
        if (route.type === "gallery") {
            document.title = "shader-art-lab";
            render_gallery_page(this.root, scene_entries);
            return;
        }

        if (route.type === "not-found") {
            document.title = "Scene not found | shader-art-lab";
            render_not_found_page(this.root);
            return;
        }

        const entry = get_scene_entry(route.scene_id);
        if (!entry) {
            document.title = "Scene not found | shader-art-lab";
            render_not_found_page(this.root);
            return;
        }

        document.title = `${entry.name} | shader-art-lab`;
        const elements = render_scene_detail_page(this.root, entry);

        try {
            const scene = await this.renderer.mount(elements.canvas, entry.create);
            if (!scene || current_route_id !== this.route_id) {
                return;
            }

            if (scene.config.fields.length === 0) {
                elements.config_empty.hidden = false;
            } else {
                this.config_ui = new ConfigUI(
                    elements.config_container,
                    scene.config,
                    (key) => scene.on_config_changed(key),
                );
            }
        } catch (error) {
            if (current_route_id !== this.route_id) {
                return;
            }

            this.renderer.unmount();
            elements.error_display.hidden = false;
            elements.error_display.textContent = error instanceof Error
                ? error.message
                : String(error);
        }
    }

    private parse_route(hash: string): Route {
        if (hash === "" || hash === "#/" || hash === "#") {
            return { type: "gallery" };
        }

        const scene_match = /^#\/scene\/([^/]+)\/?$/.exec(hash);
        if (!scene_match) {
            return { type: "not-found" };
        }

        try {
            return {
                type: "scene",
                scene_id: decodeURIComponent(scene_match[1]),
            };
        } catch {
            return { type: "not-found" };
        }
    }
}
