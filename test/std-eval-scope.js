'use strict';

const assert = require( 'node:assert/strict' );
const path = require( 'node:path' );
const projectPaths = require( '../lib/paths' );
const { ZuzuScript, createNodeHost } = require( '../lib/zuzu' );

const repoRoot = projectPaths.projectRoot;
const runtime = new ZuzuScript( {
	host: createNodeHost( { repoRoot } ),
} );

{
	const result = runtime.runSource(
		[
			'from std/eval import eval;',
			'let x := 41;',
			'say( eval( "x + 1;" ) );',
			'let y := 9;',
			'eval( "y += 2;" );',
			'say( y );',
		].join( '\n' ),
		{ filename: '/app/std-eval-scope.zzs' }
	);
	assert.equal( result.status, 0, result.stderr );
	assert.equal( result.stdout, '42\n11\n' );
}

{
	const result = runtime.runSource(
		[
			'from std/eval import eval;',
			'function f () {',
			'\tlet answer := 40;',
			'\treturn eval( "answer + 2;" );',
			'}',
			'say( f() );',
		].join( '\n' ),
		{ filename: '/app/std-eval-fn.zzs' }
	);
	assert.equal( result.status, 0, result.stderr );
	assert.equal( result.stdout, '42\n' );
}
