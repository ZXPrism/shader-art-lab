import { vec3 } from "gl-matrix";
import * as Tweakpane from "tweakpane";

import type { ConfigFieldDef, ConfigValue, SceneConfig } from "./config";

type Vec3Params = { x: number; y: number; z: number };
type ColorParams = { r: number; g: number; b: number };
type ParamValue = number | boolean | Vec3Params | ColorParams;
type BindingContainer = Tweakpane.Pane | Tweakpane.FolderApi;

export class ConfigUI {
    private readonly pane: Tweakpane.Pane;
    private readonly config_values: Record<string, ConfigValue>;
    private readonly params: Record<string, ParamValue>;
    private readonly on_change: (key: string) => void;
    private readonly debounce_timers = new Map<string, number>();

    public constructor(
        container: HTMLElement,
        config: SceneConfig,
        on_change: (key: string) => void,
    ) {
        this.config_values = config.values as Record<string, ConfigValue>;
        this.on_change = on_change;
        this.pane = new Tweakpane.Pane({ title: "Config", container });
        this.params = this.build_params(config.fields);
        this.setup_inputs(config.fields);
    }

    private build_params(fields: readonly ConfigFieldDef[]): Record<string, ParamValue> {
        const params: Record<string, ParamValue> = {};

        for (const field of fields) {
            const value = this.config_values[field.key];
            if (value === undefined) {
                throw new Error(`ConfigUI: config field "${field.key}" has no matching value`);
            }

            if (field.widget === "position") {
                const position = value as vec3;
                params[field.key] = { x: position[0], y: position[1], z: position[2] };
            } else if (field.widget === "color") {
                const color = value as vec3;
                params[field.key] = { r: color[0], g: color[1], b: color[2] };
            } else {
                params[field.key] = value as number | boolean;
            }
        }

        return params;
    }

    private setup_inputs(fields: readonly ConfigFieldDef[]): void {
        const folders = new Map<string, Tweakpane.FolderApi>();

        for (const field of fields) {
            let container: BindingContainer = this.pane;
            if (field.folder) {
                let folder = folders.get(field.folder);
                if (!folder) {
                    folder = this.pane.addFolder({ title: field.folder });
                    folders.set(field.folder, folder);
                }
                container = folder;
            }

            this.add_binding(container, field);
        }
    }

    private add_binding(container: BindingContainer, field: ConfigFieldDef): void {
        const handle_change = () => this.handle_change(field);

        switch (field.widget) {
            case "slider":
                container.addBinding(this.params, field.key, {
                    min: field.min,
                    max: field.max,
                    step: field.step,
                    label: field.label,
                }).on("change", handle_change);
                break;
            case "int-slider":
                container.addBinding(this.params, field.key, {
                    min: field.min,
                    max: field.max,
                    step: field.step ?? 1,
                    label: field.label,
                }).on("change", handle_change);
                break;
            case "toggle":
                container.addBinding(this.params, field.key, {
                    label: field.label,
                }).on("change", handle_change);
                break;
            case "position":
                container.addBinding(this.params, field.key, {
                    x: { min: field.min, max: field.max },
                    y: { min: field.min, max: field.max },
                    z: { min: field.min, max: field.max },
                    label: field.label,
                }).on("change", handle_change);
                break;
            case "color":
                container.addBinding(this.params, field.key, {
                    color: { type: "float" },
                    label: field.label,
                }).on("change", handle_change);
                break;
        }
    }

    private handle_change(field: ConfigFieldDef): void {
        const value = this.params[field.key];

        if (field.widget === "position") {
            const position = value as Vec3Params;
            this.config_values[field.key] = vec3.fromValues(position.x, position.y, position.z);
        } else if (field.widget === "color") {
            const color = value as ColorParams;
            this.config_values[field.key] = vec3.fromValues(color.r, color.g, color.b);
        } else {
            this.config_values[field.key] = value as number | boolean;
        }

        const existing_timer = this.debounce_timers.get(field.key);
        if (existing_timer !== undefined) {
            window.clearTimeout(existing_timer);
        }

        const timer = window.setTimeout(() => {
            this.debounce_timers.delete(field.key);
            this.on_change(field.key);
        }, 50);
        this.debounce_timers.set(field.key, timer);
    }

    public cleanup(): void {
        for (const timer of this.debounce_timers.values()) {
            window.clearTimeout(timer);
        }
        this.debounce_timers.clear();
        this.pane.dispose();
    }
}
