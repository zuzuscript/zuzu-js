'use strict';

const assert = require( 'node:assert/strict' );
const {
	createBrowserRuntime,
	installGlobalApis,
	runEmbeddedScripts,
	autoRunEmbeddedScripts,
} = require( '../lib/browser-bundle-entry' );

function makeDocument( scripts = [], readyState = 'complete' ) {
	const listeners = new Map();
	return {
		readyState,
		querySelectorAll( selector ) {
			assert.equal( selector, 'script[type="text/x-zuzuscript"]' );
			return scripts;
		},
		addEventListener( event, handler ) {
			listeners.set( event, handler );
		},
		emit( event ) {
			if ( listeners.has( event ) ) {
				listeners.get( event )();
			}
		},
	};
}

{
	const root = {};
	const installed = installGlobalApis( root );
	assert.equal( installed, root );
	assert.equal( typeof root.zuzu_eval, 'function' );
	assert.equal( typeof root.zuzu_run, 'function' );
	assert.equal( typeof root.zuzu_compile, 'function' );
	assert.equal( typeof root.zuzu_runtime, 'function' );
	assert.equal( root.zuzu_eval( '5 mod 2' ), 1 );
}

{
	const logs = [];
	const runtime = createBrowserRuntime();
	const doc = makeDocument( [
		{ textContent: 'say( "first" );' },
		{ textContent: 'say( "second" );' },
	] );
	const results = runEmbeddedScripts( runtime, {
		document: doc,
		consoleLog( line ) {
			logs.push( String( line ) );
		},
	} );
	assert.equal( results.length, 2 );
	assert.equal( logs.join( '\n' ), 'first\nsecond' );
}

{
	const logs = [];
	const doc = makeDocument( [ { textContent: 'say( "loaded" );' } ], 'loading' );
	const runtime = autoRunEmbeddedScripts( {
		document: doc,
		consoleLog( line ) {
			logs.push( String( line ) );
		},
		runtimeOptions: {
			consoleLog( line ) {
				logs.push( String( line ) );
			},
		},
	} );
	assert.ok( runtime );
	assert.equal( logs.length, 0 );
	doc.emit( 'DOMContentLoaded' );
	assert.equal( logs.join( '\n' ), 'loaded' );
}

console.log( 'browser embedded tests passed' );
