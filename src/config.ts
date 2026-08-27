import { vec3 } from "gl-matrix";

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

export class ConfigManager {
    public config: Config;

    constructor() {
        this.config = {
            camera_fov_y: 0.546,
            camera_focal_length: 1.0,
            camera_eye: vec3.fromValues(10, 0.77, 6.57),
            camera_center: vec3.fromValues(0.0, 0.0, 0.0),
            eps: 0.001,
            sky_color: vec3.fromValues(0.7, 0.7, 0.7),
            wireframe: false,
            ev_correction: 0,
        };
    }
}

export const constant_pi = Math.PI;
