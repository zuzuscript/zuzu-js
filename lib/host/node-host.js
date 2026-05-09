'use strict';

const fs = require( 'node:fs' );
const path = require( 'node:path' );
const vm = require( 'node:vm' );

function createNodeHost( options = {} ) {
	const repoRoot = options.repoRoot || process.cwd();
	const includePaths = Array.isArray( options.includePaths )
		? options.includePaths.map( (item) => path.resolve( String( item ) ) )
		: [];
	const capabilities = new Set( [
		'console',
		'time',
		'module_load',
		'module_fetch',
		'file_availability',
		'env',
		'fs',
		'http',
		'proc',
		'db',
		'clib',
		'net',
		'js',
		'worker',
	] );
	return {
		name: 'node',
		repoRoot,
		includePaths,
		capabilities,
		cwd() {
			return process.cwd();
		},
		resolve( ...parts ) {
			return path.resolve( ...parts );
		},
		dirname( value ) {
			return path.dirname( value );
		},
		join( ...parts ) {
			return path.join( ...parts );
		},
		readFileText( filename ) {
			return fs.readFileSync( filename, 'utf8' );
		},
		fileExists( filename ) {
			return fs.existsSync( filename ) && fs.statSync( filename ).isFile();
		},
		runInContext( source, context, runOptions = {} ) {
			return vm.runInNewContext( source, context, runOptions );
		},
		consoleLog( value ) {
			console.log( value );
		},
		now() {
			return Date.now();
		},
		getEnv( name ) {
			if ( !name ) {
				return { ...process.env };
			}
			return process.env[String( name )] ?? null;
		},
		loadJsModule( filename ) {
			return require( filename );
		},
	};
}

module.exports = {
	createNodeHost,
};
