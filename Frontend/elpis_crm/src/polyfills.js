/**
 * CRITICAL: Load polyfills FIRST before any other modules
 * These must be loaded before jwt-decode, @azure/msal-browser, or any crypto-dependent library
 */

// All imports first
import { Buffer } from "buffer";
import stream from "stream-browserify";
import util from "util";

// Then apply polyfills to global scope
window.Buffer = Buffer;
global.Buffer = Buffer;

// Instead, ensure crypto-browserify is available for modules that require it
window.stream = stream;
global.stream = stream;

window.util = util;
global.util = util;

console.log("Polyfills loaded: Buffer, stream, util (crypto uses native browser implementation)");
