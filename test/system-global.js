'use strict';

const assert = require( 'node:assert/strict' );
const path = require( 'node:path' );
const projectPaths = require( '../lib/paths' );
const { createNodeRuntime } = require( '../lib/zuzu' );

const repoRoot = projectPaths.projectRoot;
const runtime = createNodeRuntime( {
	repoRoot,
	includePaths: [ path.join( repoRoot, 'modules' ) ],
} );

const script = `
	from std/dump import Dumper;
	say Dumper.dump( __system__, { pretty: true, sort_keys: true, quiet: true }, );
`;

const result = runtime.runSource(
	script,
	{ filename: path.join( repoRoot, 'tmp', 'system-global-test.zzs' ) }
);

assert.equal( result.status, 0, result.stderr );
const dumped = JSON.parse( result.stdout );
assert.equal( dumped.runtime, 'zuzu-js' );
assert.equal( dumped.language_version, 0 );
assert.ok( Array.isArray( dumped.inc ) );
assert.ok( dumped.inc.includes( projectPaths.jsModuleRoot ) );
assert.ok( dumped.inc.includes( projectPaths.pureModuleRoot ) );
assert.equal( typeof dumped.nodejs_version, 'string' );
assert.match( dumped.nodejs_version, /^\d+\.\d+\.\d+$/u );
assert.ok( Object.prototype.hasOwnProperty.call( dumped, 'deny_fs' ) );
assert.ok( Object.prototype.hasOwnProperty.call( dumped, 'deny_net' ) );
assert.ok( Object.prototype.hasOwnProperty.call( dumped, 'deny_perl' ) );
assert.ok( Object.prototype.hasOwnProperty.call( dumped, 'deny_js' ) );
assert.ok( Object.prototype.hasOwnProperty.call( dumped, 'deny_proc' ) );
assert.ok( Object.prototype.hasOwnProperty.call( dumped, 'deny_db' ) );
assert.ok( Object.prototype.hasOwnProperty.call( dumped, 'deny_clib' ) );
assert.ok( Object.prototype.hasOwnProperty.call( dumped, 'deny_gui' ) );
assert.ok( Object.prototype.hasOwnProperty.call( dumped, 'deny_worker' ) );
assert.equal( typeof dumped.deny_fs, 'boolean' );
assert.equal( typeof dumped.deny_net, 'boolean' );
assert.equal( typeof dumped.deny_perl, 'boolean' );
assert.equal( typeof dumped.deny_js, 'boolean' );
assert.equal( dumped.deny_js, false );
assert.equal( typeof dumped.deny_proc, 'boolean' );
assert.equal( typeof dumped.deny_db, 'boolean' );
assert.equal( typeof dumped.deny_clib, 'boolean' );
assert.equal( dumped.deny_gui, true );
assert.equal( typeof dumped.deny_worker, 'boolean' );

const mutation = runtime.runSource(
	'__system__{inc}.append( "/tmp/other" );',
	{ filename: path.join( repoRoot, 'tmp', 'system-global-mutation.zzs' ) }
);
assert.equal( mutation.status, 1 );
assert.match( mutation.stderr, /object is not extensible|read only|frozen/u );

console.log( 'system global tests passed' );
