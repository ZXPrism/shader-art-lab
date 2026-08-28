import type { SceneEntry } from "../registry";
import { SdfScene } from "./sdf_scene";

export const sdf_scene_entry: SceneEntry = {
    id: "sdf",
    name: "SDF",
    updated_at: "2026-08-28",
    description: "SDF experiments following https://iquilezles.org/articles/.",
    create: (context) => new SdfScene(context),
};
