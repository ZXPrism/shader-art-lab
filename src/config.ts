import type { vec3 } from "gl-matrix";

export type ConfigValue = number | boolean | vec3;
export type ConfigWidgetType = "slider" | "int-slider" | "toggle" | "position" | "color";

export interface ConfigFieldDef {
    key: string;
    folder?: string;
    label: string;
    widget: ConfigWidgetType;
    min?: number;
    max?: number;
    step?: number;
}

export type TypedConfigFieldDef<TConfig extends object> = Omit<ConfigFieldDef, "key"> & {
    key: Extract<keyof TConfig, string>;
};

export interface SceneConfig {
    readonly values: object;
    readonly fields: readonly ConfigFieldDef[];
}

export class ConfigManager<TConfig extends object> implements SceneConfig {
    public readonly values: TConfig;
    public readonly fields: readonly ConfigFieldDef[];

    public constructor(values: TConfig, fields: readonly TypedConfigFieldDef<TConfig>[]) {
        this.values = values;
        this.fields = fields;
    }
}

export function define_config<TConfig extends { [K in keyof TConfig]: ConfigValue }>(
    values: TConfig,
    fields: readonly TypedConfigFieldDef<TConfig>[],
): ConfigManager<TConfig> {
    return new ConfigManager(values, fields);
}

// Legacy path-tracing shader configuration. Individual gallery scenes should
// define their own config instead of depending on this interface.
export interface Config {
    camera_fov_y: number;
    camera_focal_length: number;
    camera_eye: vec3;
    camera_center: vec3;
    eps: number;
    sky_color: vec3;
    wireframe: boolean;
    ev_correction: number;
}

export const constant_pi = Math.PI;
