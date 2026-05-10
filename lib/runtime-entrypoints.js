'use strict';

const { ZuzuScript } = require( './runtime' );
const { createNodeHost } = require( './host/node-host' );
const { createElectronHost } = require( './host/electron-host' );
const paths = require( './paths' );

function createRuntimeForHost( host, options = {} ) {
	return new ZuzuScript( {
		host,
		repoRoot: options.repoRoot || host.repoRoot,
		includePaths: options.includePaths,
		denyCapabilities: options.denyCapabilities,
		allowCapabilities: options.allowCapabilities,
		denyModules: options.denyModules,
		debugLevel: options.debugLevel,
		transpiler: options.transpiler,
	} );
}

function createNodeRuntime( options = {} ) {
	const repoRoot = options.repoRoot || paths.projectRoot;
	const host = options.host || createNodeHost( {
		repoRoot,
		includePaths: options.includePaths || [],
	} );
	return createRuntimeForHost( host, {
		repoRoot,
		includePaths: options.includePaths,
		denyCapabilities: options.denyCapabilities,
		allowCapabilities: options.allowCapabilities,
		denyModules: options.denyModules,
		debugLevel: options.debugLevel,
		transpiler: options.transpiler,
	} );
}

function createElectronRuntime( options = {} ) {
	const repoRoot = options.repoRoot || paths.projectRoot;
	const host = options.host || createElectronHost( {
		repoRoot,
		includePaths: options.includePaths || [],
		guiBridge: options.guiBridge,
	} );
	return createRuntimeForHost( host, {
		repoRoot,
		includePaths: options.includePaths,
		denyCapabilities: options.denyCapabilities,
		allowCapabilities: [ 'gui', ...( options.allowCapabilities || [] ) ],
		denyModules: options.denyModules,
		debugLevel: options.debugLevel,
		transpiler: options.transpiler,
	} );
}

module.exports = {
	createNodeRuntime,
	createElectronRuntime,
	createRuntimeForHost,
};
