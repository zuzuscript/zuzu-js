'use strict';

const { parseTap } = require( './tap' );
const {
	DEFAULT_TRANSPILER,
	VALID_TRANSPILERS,
	normalizeTranspilerName,
	transpile,
} = require( './transpiler' );
const {
	ZuzuScript,
	isWeakableValue,
	makeWeakValue,
	resolveWeakValue,
} = require( './runtime' );
const { createBrowserRuntime } = require( './browser-runtime' );
const {
	createBrowserGuiBridge,
	createBrowserGuiRenderer,
} = require( './browser-gui-renderer' );
const {
	runEmbeddedScripts,
	autoRunEmbeddedScripts,
} = require( './browser-bundle-entry' );
const {
	createElectronRuntime,
	createNodeRuntime,
} = require( './runtime-entrypoints' );
const { createNodeHost } = require( './host/node-host' );
const { createElectronHost } = require( './host/electron-host' );
const { createBrowserHost } = require( './host/browser-host' );

module.exports = {
	ZuzuScript,
	isWeakableValue,
	makeWeakValue,
	resolveWeakValue,
	createBrowserRuntime,
	createBrowserGuiBridge,
	createBrowserGuiRenderer,
	runEmbeddedScripts,
	autoRunEmbeddedScripts,
	createElectronRuntime,
	createNodeRuntime,
	createNodeHost,
	createElectronHost,
	createBrowserHost,
	DEFAULT_TRANSPILER,
	VALID_TRANSPILERS,
	normalizeTranspilerName,
	parseTap,
	transpile,
};
