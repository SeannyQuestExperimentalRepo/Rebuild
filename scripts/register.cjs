// Stub out "server-only" module for script execution outside Next.js
const Module = require("module");
const orig = Module._resolveFilename;
Module._resolveFilename = function (request, parent, isMain, options) {
  if (request === "server-only") return __filename;
  return orig.call(this, request, parent, isMain, options);
};
