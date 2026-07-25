// Entry point for the standalone browser bundle (dist/elaan-elements.global.js).
// Unlike the ESM/CJS entry it inlines @elaanio/core and registers the tags on
// load, so a plain <script> tag is genuinely all a page needs.
import { defineElaanElements } from "./elements";

defineElaanElements();

export * from "./index";
