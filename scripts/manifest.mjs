// Writes goodfellow-plugin.json from the built plugin with Goodfellow's own
// `pluginManifest()`: what the plugin does, which the admin panel's Plugins
// screen shows before it's installed.
import { writeFileSync } from "node:fs";
import { pluginManifest } from "@goodfellow-cms/core";
import plugin from "../dist/index.js";

writeFileSync(
  new URL("../goodfellow-plugin.json", import.meta.url),
  `${JSON.stringify(pluginManifest(plugin), null, 2)}\n`,
);
