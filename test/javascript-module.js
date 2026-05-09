'use strict';

const assert = require( 'node:assert/strict' );
const { ZuzuScript } = require( '../lib/zuzu' );

{
	const runtime = new ZuzuScript( { transpiler: 'new-only' } );
	const result = runtime.runSource( `
		from test/more import *;
		from javascript import JS, JSResult;

		let r := JS.eval("[ 7, 8, 9 ]");
		ok( r instanceof JSResult, "JS.eval returns JSResult" );
		is( r.toJSON(), "[7,8,9]", "toJSON serializes wrapped value" );

		let r2 := r.eval(" this[1] ");
		ok( r2 instanceof JSResult, "result.eval returns JSResult" );
		ok( r2.isSafe(), "scalar result is safe" );
		is( r2.value(), 8, "safe scalar unwraps" );

		let r3 := JS.eval("({ answer: 42, nested: [ 1, 2 ] })");
		ok( r3.isSafe(), "plain object result is safe" );
		let v3 := r3.value();
		is( v3.get( "answer", 0 ), 42, "safe dict unwrap keeps object access" );
		is( v3.get( "nested", [] )[1], 2, "safe dict unwrap keeps nested arrays" );

		let r4 := JS.eval("(function () { return 1; })");
		ok( !r4.isSafe(), "functions are not safe to unwrap" );

		done_testing();
	`, { filename: '/tmp/javascript-module.zzs' } );
	assert.equal( result.status, 0, result.stderr );
	assert.match( result.stdout, /ok\s+1\b/ );
	assert.match( result.stdout, /ok\s+9\b/ );
}

{
	const runtime = new ZuzuScript( {
		denyCapabilities: [ 'js' ],
		transpiler: 'new-only',
	} );
	const result = runtime.runSource( `
		from javascript import JS;
	`, { filename: '/tmp/javascript-module-denied.zzs' } );
	assert.notEqual( result.status, 0 );
	assert.match( result.stderr, /Denied capability 'js' blocks module 'javascript'/u );
}

console.log( 'zuzu-js javascript module tests passed' );
