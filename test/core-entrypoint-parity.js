'use strict';

const assert = require( 'node:assert/strict' );
const fs = require( 'node:fs' );
const path = require( 'node:path' );
const projectPaths = require( '../lib/paths' );
const {
	ZuzuScript,
	createNodeRuntime,
	createBrowserRuntime,
} = require( '../lib/zuzu' );

const repoRoot = projectPaths.projectRoot;

{
	const nodeRuntime = createNodeRuntime( { repoRoot } );
	const browserRuntime = createBrowserRuntime( {
		repoRoot,
		evaluate( source, context ) {
			const keys = Object.keys( context );
			const values = keys.map( (key) => context[key] );
			const fn = Function( ...keys, source );
			return fn( ...values );
		},
	} );

	assert.ok( nodeRuntime instanceof ZuzuScript );
	assert.ok( browserRuntime.runtime instanceof ZuzuScript );
	assert.equal( nodeRuntime.constructor, browserRuntime.runtime.constructor );

	const nodeResult = nodeRuntime.runSource( 'say( 40 + 2 );', { filename: '/app/main.zzs' } );
	const browserResult = browserRuntime.zuzu_run( 'say( 40 + 2 );', { filename: '/app/main.zzs' } );
	assert.equal( nodeResult.status, 0, nodeResult.stderr );
	assert.equal( browserResult.status, 0, browserResult.stderr );
	assert.equal( browserResult.stdout, nodeResult.stdout );
}

{
	const nodeRuntime = createNodeRuntime( { repoRoot } );
	const browserRuntime = createBrowserRuntime( {
		repoRoot,
		evaluate( source, context ) {
			const keys = Object.keys( context );
			const values = keys.map( (key) => context[key] );
			const fn = Function( ...keys, source );
			return fn( ...values );
		},
	} );

	assert.equal( nodeRuntime.transpiler, 'new-only' );
	assert.equal( browserRuntime.runtime.transpiler, 'new-only' );
}

{
	const binScript = fs.readFileSync( path.join( __dirname, '..', 'bin', 'zuzu-js' ), 'utf8' );
	assert.match( binScript, /createNodeRuntime/u );
}

console.log( 'core entrypoint parity tests passed' );
