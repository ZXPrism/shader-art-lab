import "./style.css";

import { App } from "./app";

function display_error(title: string, error: Error | string, stack?: string): void {
    const error_display = document.getElementById("error-display");
    if (!error_display) {
        return;
    }

    const heading = document.createElement("h2");
    heading.textContent = title;

    const message = document.createElement("div");
    message.className = "error-message";
    message.textContent = typeof error === "string" ? error : error.message;

    error_display.replaceChildren(heading, message);

    if (stack) {
        const stack_display = document.createElement("div");
        stack_display.className = "error-stack";
        stack_display.textContent = stack;
        error_display.append(stack_display);
    }

    error_display.style.display = "block";
}

window.addEventListener("error", (event) => {
    display_error(
        "Runtime Error",
        event.error instanceof Error ? event.error : event.message,
        event.error instanceof Error ? event.error.stack : undefined,
    );
});

window.addEventListener("unhandledrejection", (event) => {
    const reason = event.reason;
    display_error(
        "Unhandled Promise Rejection",
        reason instanceof Error ? reason : String(reason),
        reason instanceof Error ? reason.stack : undefined,
    );
});

const app_root = document.getElementById("app");
if (!app_root) {
    throw new Error("Could not find the application root element.");
}

new App(app_root).start();
