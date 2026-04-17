import React from "react";
import { render } from "ink";
import { App } from "../ui/dashboard/App.js";
import { createBackends } from "../backends/factory.js";
import { loadConfig } from "../config/loader.js";

export async function runDash(live = false): Promise<void> {
  const config = loadConfig();
  const backends = createBackends(config);

  const { waitUntilExit } = render(
    React.createElement(App, { backends, live }),
    { exitOnCtrlC: true }
  );

  await waitUntilExit();
}
