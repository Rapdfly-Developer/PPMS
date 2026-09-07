/**
 * Voice-to-EMR AI — Plugin Registration
 *
 * Side-effect import: registers the plugin with the PPMS framework.
 * No business logic lives here. The Voice-to-EMR application itself is a
 * separate, independently deployed project.
 */

import { registerPlugin } from "@/plugin-framework/registry";
import { manifest } from "./manifest";

registerPlugin({ manifest });

export {};
