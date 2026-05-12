'use strict';

const assert = require( 'node:assert/strict' );
const {
	ZuzuScript,
	createBrowserHost,
	createElectronHost,
	createNodeHost,
} = require( '../lib/zuzu' );

function runOnHost( host, source ) {
	const runtime = new ZuzuScript( { host } );
	const result = runtime.runSource( source, { filename: '/app/main.zzs' } );
	assert.equal( result.status, 0, result.stderr );
	return result;
}

{
	const source = `
		say( 40 + 2 );
	`;
	const nodeResult = runOnHost( createNodeHost(), source );
	const browserResult = runOnHost( createBrowserHost(), source );
	assert.equal( nodeResult.stdout, browserResult.stdout );
}

{
	const nodeRuntime = new ZuzuScript( { host: createNodeHost() } );
	const browserRuntime = new ZuzuScript( { host: createBrowserHost() } );
	const nodeResult = nodeRuntime.runSource( 'say( has_capability( "fs" ) );', { filename: '/app/main.zzs' } );
	const browserResult = browserRuntime.runSource( 'say( has_capability( "fs" ) );', { filename: '/app/main.zzs' } );
	assert.equal( nodeResult.status, 0, nodeResult.stderr );
	assert.equal( browserResult.status, 0, browserResult.stderr );
	assert.equal( nodeResult.stdout, '1\n' );
	assert.equal( browserResult.stdout, '0\n' );
}

{
	const includePaths = [ '/tmp/zuzu/a', '/tmp/zuzu/b' ];
	const runtime = new ZuzuScript( {
		host: createBrowserHost( { includePaths } ),
	} );
	const result = runtime.runSource(
		'say( __system__{inc} );',
		{ filename: '/app/main.zzs' }
	);
	assert.equal( result.status, 0, result.stderr );
	assert.equal(
		result.stdout,
		`/tmp/zuzu/a,/tmp/zuzu/b\n`
	);
}

{
	const runtime = new ZuzuScript( {
		host: createBrowserHost(),
	} );
	assert.throws(
		() => runtime.loadModule( 'std/io', '/app/main.zzs' ),
		(err) => /Module 'std\/io' requires unsupported capability 'fs' on host 'browser'/u.test(
			String( err && ( err.message || err ) )
		)
	);
}

{
	const runtime = new ZuzuScript( {
		host: createBrowserHost(),
	} );
	assert.throws(
		() => runtime.loadModule( 'std/clib', '/app/main.zzs' ),
		(err) => /Module 'std\/clib' requires unsupported capability 'clib' on host 'browser'/u.test(
			String( err && ( err.message || err ) )
		)
	);
}

{
	const host = createElectronHost( {
		guiBridge: {
			openWindow( snapshot ) {
				assert.equal( snapshot.type, 'Window' );
				assert.equal( snapshot.props.title, 'Demo' );
				return 42;
			},
		},
	} );
	const runtime = new ZuzuScript( {
		host,
		allowCapabilities: [ 'gui' ],
	} );
	const result = runtime.runSource( `
		from std/gui/objects import Window;
		say( __system__{deny_gui} );
		let w := new Window( title: "Demo", width: 320, height: 160 );
		w.show();
	`, { filename: '/app/main.zzs' } );
	assert.equal( result.status, 0, result.stderr );
	assert.equal( result.stdout, 'false\n' );
}

{
	const host = createBrowserHost( {
		virtualFiles: {
			'/app/lib/math.zzs': `
				export function inc( Number value ) {
					return value + 1;
				}
			`,
		},
	} );
	const runtime = new ZuzuScript( { host } );
	const result = runtime.runSource( `
		from ./lib/math import inc;
		say( inc( 41 ) );
	`, { filename: '/app/main.zzs' } );
	assert.equal( result.status, 0, result.stderr );
	assert.equal( result.stdout, '42\n' );
}

{
	const host = createBrowserHost( {
		evaluate( source, context ) {
			const keys = Object.keys( context );
			const values = keys.map( (key) => context[key] );
			const fn = Function( ...keys, source );
			return fn( ...values );
		},
	} );
	const runtime = new ZuzuScript( { host } );
	const result = runtime.runSource( 'say( 7 * 6 );', { filename: '/app/main.zzs' } );
	assert.equal( result.status, 0, result.stderr );
	assert.equal( result.stdout, '42\n' );
}
