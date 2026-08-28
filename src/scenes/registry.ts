import { blit_scene_entry } from "./blit";
import type { SceneFactory } from "./scene";

export interface SceneEntry {
    id: string;
    name: string;
    updated_at: string;
    description: string;
    thumbnail?: string;
    create: SceneFactory;
}

export const scene_entries: readonly SceneEntry[] = [
    blit_scene_entry,
];

const scene_entry_map = new Map<string, SceneEntry>();
for (const entry of scene_entries) {
    if (scene_entry_map.has(entry.id)) {
        throw new Error(`Duplicate scene id: "${entry.id}"`);
    }
    scene_entry_map.set(entry.id, entry);
}

export function get_scene_entry(id: string): SceneEntry | undefined {
    return scene_entry_map.get(id);
}
