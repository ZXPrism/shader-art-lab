import type { SceneEntry } from "../scenes/registry";

const default_thumbnail = `${import.meta.env.BASE_URL}shader-art-lab.svg`;

export function render_gallery_page(root: HTMLElement, entries: readonly SceneEntry[]): void {
    const page = document.createElement("main");
    page.className = "page gallery-page";

    const heading = document.createElement("h1");
    heading.className = "site-title";
    heading.textContent = "shader-art-lab";
    page.append(heading);

    const grid = document.createElement("div");
    grid.className = "scene-grid";

    for (const entry of entries) {
        const card = document.createElement("a");
        card.className = "scene-card";
        card.href = `#/scene/${encodeURIComponent(entry.id)}`;

        const thumbnail = document.createElement("img");
        thumbnail.className = "scene-thumbnail";
        thumbnail.src = entry.thumbnail ?? default_thumbnail;
        thumbnail.alt = `${entry.name} thumbnail`;
        thumbnail.loading = "lazy";
        thumbnail.addEventListener("error", () => {
            thumbnail.src = default_thumbnail;
        }, { once: true });

        const body = document.createElement("div");
        body.className = "scene-card-body";

        const name = document.createElement("h2");
        name.className = "scene-card-title";
        name.textContent = entry.name;

        const updated_at = document.createElement("time");
        updated_at.className = "scene-card-date";
        updated_at.dateTime = entry.updated_at;
        updated_at.textContent = `Updated ${entry.updated_at}`;

        body.append(name, updated_at);
        card.append(thumbnail, body);
        grid.append(card);
    }

    page.append(grid);
    root.replaceChildren(page);
}
