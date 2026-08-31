/**
 * Plugin composition root.
 *
 * The one place that knows which plugins ship in this PPMS build. Importing
 * this module registers them all.
 *
 * Dependency direction is preserved: PPMS Core imports this file, this file
 * imports the plugins, and the plugins import the framework. The framework
 * itself never imports anything from src/plugins/**.
 *
 * To ship a new plugin, add a side-effect import below.
 */

import "./ai-clinical-copilot";

export {};
