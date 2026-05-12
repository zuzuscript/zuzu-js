'use strict';

const assert = require( 'node:assert/strict' );
const fs = require( 'node:fs' );
const os = require( 'node:os' );
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

const fileResult = runtime.runSource(
	'say( __file__.to_String() );',
	{ filename: 'relative-main.zzs' }
);
assert.equal( fileResult.status, 0, fileResult.stderr );
assert.equal( fileResult.stdout, 'relative-main.zzs\n' );

const deniedRuntime = createNodeRuntime( {
	repoRoot,
	includePaths: [ path.join( repoRoot, 'modules' ) ],
	denyCapabilities: [ 'fs' ],
} );
const deniedFile = deniedRuntime.runSource(
	'say( typeof __file__ );',
	{ filename: path.join( repoRoot, 'tmp', 'file-denied.zzs' ) }
);
assert.equal( deniedFile.status, 0, deniedFile.stderr );
assert.equal( deniedFile.stdout, 'Null\n' );

const tempDir = fs.mkdtempSync( path.join( os.tmpdir(), 'zuzu-js-file-global-' ) );
const moduleDir = path.join( tempDir, 'modules' );
fs.mkdirSync( moduleDir );
const modulePath = path.join( moduleDir, 'file_probe.zzm' );
fs.writeFileSync(
	modulePath,
	'const module_file := __file__.to_String();\n',
	'utf8'
);
const moduleRuntime = createNodeRuntime( {
	repoRoot,
	includePaths: [ moduleDir ],
} );
const moduleResult = moduleRuntime.runSource(
	`
	from file_probe import module_file;
	say( module_file );
	`,
	{ filename: path.join( tempDir, 'main.zzs' ) }
);
assert.equal( moduleResult.status, 0, moduleResult.stderr );
assert.equal( moduleResult.stdout, `${modulePath}\n` );
fs.rmSync( tempDir, { recursive: true, force: true } );

console.log( 'system global tests passed' );
