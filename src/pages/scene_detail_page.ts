import type { SceneEntry } from "../scenes/registry";

export interface SceneDetailElements {
    canvas: HTMLCanvasElement;
    config_container: HTMLElement;
    config_empty: HTMLElement;
    error_display: HTMLElement;
}

export function render_scene_detail_page(root: HTMLElement, entry: SceneEntry): SceneDetailElements {
    const page = document.createElement("main");
    page.className = "page detail-page";

    const back_link = document.createElement("a");
    back_link.className = "back-link";
    back_link.href = "#/";
    back_link.textContent = "← Gallery";

    const header = document.createElement("header");
    header.className = "scene-header";

    const title = document.createElement("h1");
    title.className = "scene-title";
    title.textContent = entry.name;

    const updated_at = document.createElement("time");
    updated_at.className = "scene-detail-date";
    updated_at.dateTime = entry.updated_at;
    updated_at.textContent = `Last updated ${entry.updated_at}`;

    const description = document.createElement("p");
    description.className = "scene-description";
    description.textContent = entry.description;

    header.append(title, updated_at, description);

    const workspace = document.createElement("div");
    workspace.className = "scene-workspace";

    const canvas_container = document.createElement("div");
    canvas_container.className = "scene-canvas-container";

    const canvas = document.createElement("canvas");
    canvas.className = "scene-canvas";
    canvas.setAttribute("aria-label", `${entry.name} WebGPU canvas`);
    canvas_container.append(canvas);

    const config_panel = document.createElement("aside");
    config_panel.className = "scene-config-panel";

    const config_container = document.createElement("div");
    config_container.className = "scene-config-container";

    const config_empty = document.createElement("p");
    config_empty.className = "config-empty";
    config_empty.textContent = "No configurable parameters.";
    config_empty.hidden = true;

    config_panel.append(config_container, config_empty);
    workspace.append(canvas_container, config_panel);

    const error_display = document.createElement("div");
    error_display.className = "scene-error";
    error_display.hidden = true;

    page.append(back_link, header, workspace, error_display);
    root.replaceChildren(page);

    return {
        canvas,
        config_container,
        config_empty,
        error_display,
    };
}

export function render_not_found_page(root: HTMLElement): void {
    const page = document.createElement("main");
    page.className = "page not-found-page";

    const title = document.createElement("h1");
    title.textContent = "Scene not found";

    const back_link = document.createElement("a");
    back_link.className = "back-link";
    back_link.href = "#/";
    back_link.textContent = "← Back to Gallery";

    page.append(title, back_link);
    root.replaceChildren(page);
}
