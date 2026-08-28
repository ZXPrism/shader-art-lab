import type { SceneEntry } from "../registry";
import { BlitScene } from "./blit_scene";

export const blit_scene_entry: SceneEntry = {
    id: "blit",
    name: "Cosine Palette",
    updated_at: "2026-08-28",
    description: "An animated cosine color palette rendered in real time with WebGPU.",
    create: (context) => new BlitScene(context),
};
