'use strict';

const assert = require( 'node:assert/strict' );
const childProcess = require( 'node:child_process' );
const fs = require( 'node:fs' );
const os = require( 'node:os' );
const path = require( 'node:path' );
const projectPaths = require( '../lib/paths' );
const { createBrowserRuntime } = require( '../lib/zuzu' );

const repoRoot = projectPaths.projectRoot;
const generator = path.join( repoRoot, 'bin', 'zuzu-generate-browser-stdlib' );
const builder = path.join( repoRoot, 'bin', 'zuzu-build-browser-bundle' );

function makeTempDir() {
	return fs.mkdtempSync( path.join( os.tmpdir(), 'zuzu-browser-stdlib-' ) );
}

function runGenerator( args = [] ) {
	const outDir = makeTempDir();
	const stdoutPath = path.join( outDir, 'stdout.txt' );
	const stderrPath = path.join( outDir, 'stderr.txt' );
	const stdoutFd = fs.openSync( stdoutPath, 'w' );
	const stderrFd = fs.openSync( stderrPath, 'w' );
	const result = childProcess.spawnSync(
		process.execPath,
		[ generator, outDir, ...args ],
		{
			cwd: repoRoot,
			stdio: [ 'ignore', stdoutFd, stderrFd ],
		}
	);
	fs.closeSync( stdoutFd );
	fs.closeSync( stderrFd );
	if ( result.error ) {
		throw result.error;
	}
	return {
		...result,
		outDir,
		stdlibPath: path.join( outDir, 'browser-stdlib.generated.js' ),
		stdout: fs.readFileSync( stdoutPath, 'utf8' ),
		stderr: fs.readFileSync( stderrPath, 'utf8' ),
	};
}

function runCommand( command, args = [] ) {
	const result = childProcess.spawnSync(
		command,
		args,
		{
			cwd: repoRoot,
			encoding: 'utf8',
		}
	);
	if ( result.error ) {
		throw result.error;
	}
	return result;
}

function loadStdlib( run ) {
	delete require.cache[require.resolve( run.stdlibPath )];
	return require( run.stdlibPath ).createBrowserStdlib();
}

function writeModule( root, logicalName, source, ext = '.zzm' ) {
	const filename = path.join( root, `${logicalName}${ext}` );
	fs.mkdirSync( path.dirname( filename ), { recursive: true } );
	fs.writeFileSync( filename, source, 'utf8' );
	return filename;
}

function reportModules( run ) {
	return run.stderr
		.trimEnd()
		.split( /\r?\n/u )
		.filter( (line) => line && line !== 'Bundling ZuzuScript browser modules:' )
		.map( (line) => line.split( /\t/u )[0] );
}

{
	const run = runCommand( process.execPath, [ generator, '--help' ] );
	assert.equal( run.status, 0, run.stderr );
	assert.match( run.stdout, /^Usage: zuzu-generate-browser-stdlib /u );
	assert.match( run.stdout, /--include=MODULE/u );
	assert.match( run.stdout, /--exclude=MODULE/u );
	assert.equal( run.stderr, '' );
}

{
	const run = runCommand( builder, [ '--help' ] );
	assert.equal( run.status, 0, run.stderr );
	assert.match( run.stdout, /^Usage: zuzu-build-browser-bundle /u );
	assert.match( run.stdout, /--include=MODULE/u );
	assert.match( run.stdout, /--exclude=MODULE/u );
	assert.doesNotMatch( run.stdout, /Built .*zuzu-browser/u );
	assert.equal( run.stderr, '' );
}

{
	const run = runGenerator();
	assert.equal( run.status, 0, run.stderr );
	assert.match( run.stdout, /^Generated .*browser-stdlib\.generated\.js/mu );
	assert.match( run.stderr, /^Bundling ZuzuScript browser modules:$/mu );
	assert.deepEqual( reportModules( run ), [
		'javascript',
		'std/string',
		'std/string/base64',
		'std/string/encode',
		'std/time',
		'std/marshal',
		'std/task',
		'std/worker',
		'std/secure',
		'std/data/json',
		'std/data/yaml',
		'std/data/csv',
		'std/data/xml',
		'std/digest/md5',
		'std/digest/sha',
		'std/net/http',
		'std/math',
		'std/math/bignum',
		'std/eval',
		'std/gui/objects',
		'std/tui',
		'std/internals',
		'std/net/url',
		'std/colour',
		'std/result',
		'std/string/quoted_printable',
		'std/gui',
		'std/gui/dialogue',
		'std/uuid',
		'std/dump',
		'std/data/cbor',
		'std/data/kdl',
		'std/data/kdl/json',
		'std/data/kdl/xml',
		'std/path/jsonpointer',
		'std/data/json/schema',
		'std/data/json/schema/core',
		'std/data/json/schema/format',
		'std/data/json/schema/model',
		'std/data/json/schema/output',
		'std/data/json/schema/relative_pointer',
		'std/data/json/schema/validation',
		'std/mail',
		'std/data/xml/escape',
		'std/path/simple',
		'std/path/z',
		'std/path/z/context',
		'std/path/z/evaluate',
		'std/path/z/functions',
		'std/path/z/lexer',
		'std/path/z/node',
		'std/path/z/operators',
		'std/path/z/parser',
		'std/path/zz',
		'std/path/zz/functions',
		'std/path/zz/operators',
		'std/template/z',
		'std/template/zz',
	] );
	const stdlib = loadStdlib( run );
	assert.ok( stdlib.jsModules['/modules/std/string.js'] );
	assert.ok(
		stdlib.virtualFiles['/modules/std/string/quoted_printable.zzm']
	);
	assert.ok( stdlib.virtualFiles['/modules/std/uuid.zzm'] );
	assert.ok( stdlib.virtualFiles['/modules/std/data/cbor.zzm'] );
	assert.ok( stdlib.virtualFiles['/modules/std/data/json/schema.zzm'] );
	assert.ok( stdlib.virtualFiles['/modules/std/path/jsonpointer.zzm'] );
	assert.ok( stdlib.virtualFiles['/modules/std/path/z.zzm'] );
	assert.ok( stdlib.virtualFiles['/modules/std/template/z.zzm'] );
	assert.ok( stdlib.virtualFiles['/modules/std/template/zz.zzm'] );
	assert.equal( stdlib.virtualFiles['/modules/std/io.zzm'], undefined );
	assert.deepEqual( stdlib.includePaths, [] );
}

{
	const root = makeTempDir();
	writeModule( root, 'custom/tool', 'export function answer () { return 42; }' );
	const run = runGenerator( [ '-M', root, '--include=custom/tool' ] );
	assert.equal( run.status, 0, run.stderr );
	const stdlib = loadStdlib( run );
	assert.equal( stdlib.includePaths[0], '/__zuzu_browser_modules__/0' );
	assert.match(
		stdlib.virtualFiles['/__zuzu_browser_modules__/0/custom/tool.zzm'],
		/export function answer/u
	);
}

{
	const root = makeTempDir();
	writeModule( root, 'custom/main', `
		from ./helper import answer;
		export function main () { return answer(); }
	` );
	writeModule( root, 'custom/helper', 'export function answer () { return 42; }' );
	const run = runGenerator( [ `-M${root}`, '--include', 'custom/main' ] );
	assert.equal( run.status, 0, run.stderr );
	const stdlib = loadStdlib( run );
	assert.ok( stdlib.virtualFiles['/__zuzu_browser_modules__/0/custom/main.zzm'] );
	assert.ok( stdlib.virtualFiles['/__zuzu_browser_modules__/0/custom/helper.zzm'] );
}

{
	const root = makeTempDir();
	writeModule( root, 'custom/main', `
		from custom
		/helper import answer;
		export function main () { return answer(); }
	` );
	writeModule( root, 'custom/helper', 'export function answer () { return 42; }' );
	const run = runGenerator( [ '-M', root, '--include', 'custom/main' ] );
	assert.equal( run.status, 0, run.stderr );
	const stdlib = loadStdlib( run );
	assert.ok( stdlib.virtualFiles['/__zuzu_browser_modules__/0/custom/main.zzm'] );
	assert.ok( stdlib.virtualFiles['/__zuzu_browser_modules__/0/custom/helper.zzm'] );
	const browser = createBrowserRuntime( stdlib );
	const loaded = browser.runtime.loadModule( 'custom/main', '/app/main.zzs' );
	assert.equal( loaded.main(), 42 );
}

{
	const root = makeTempDir();
	writeModule( root, 'custom/main', `
		from "custom/helper" import answer;
		export function main () { return answer(); }
	` );
	writeModule( root, 'custom/helper', 'export function answer () { return 42; }' );
	const run = runGenerator( [ '-M', root, '--include', 'custom/main' ] );
	assert.equal( run.status, 0, run.stderr );
	const stdlib = loadStdlib( run );
	assert.ok( stdlib.virtualFiles['/__zuzu_browser_modules__/0/custom/main.zzm'] );
	assert.ok( stdlib.virtualFiles['/__zuzu_browser_modules__/0/custom/helper.zzm'] );
}

{
	const root = makeTempDir();
	writeModule( root, 'custom/main', 'from missing/optional try import nope;' );
	const run = runGenerator( [ '-M', root, '--include', 'custom/main' ] );
	assert.equal( run.status, 0, run.stderr );
	assert.deepEqual( reportModules( run ).slice( -1 ), [ 'custom/main' ] );
}

{
	const root = makeTempDir();
	writeModule( root, 'custom/once', 'export const VALUE := 1;' );
	const run = runGenerator( [
		'-M',
		root,
		'--include',
		'custom/once',
		'--include=custom/once',
	] );
	assert.equal( run.status, 0, run.stderr );
	const generated = fs.readFileSync( run.stdlibPath, 'utf8' );
	const matches = generated.match(
		/\/__zuzu_browser_modules__\/0\/custom\/once\.zzm/gu
	);
	assert.equal( matches.length, 1 );
}

{
	const run = runGenerator( [ '--exclude', 'std/gui/dialogue' ] );
	assert.equal( run.status, 0, run.stderr );
	const stdlib = loadStdlib( run );
	assert.equal( stdlib.virtualFiles['/modules/std/gui/dialogue.zzm'], undefined );
}

{
	const root = makeTempDir();
	writeModule( root, 'custom/main', 'from custom/helper import answer;' );
	writeModule( root, 'custom/helper', 'export function answer () { return 42; }' );
	const run = runGenerator( [
		'-M',
		root,
		'--include',
		'custom/main',
		'--exclude',
		'custom/helper',
	] );
	assert.notEqual( run.status, 0 );
	assert.match( run.stderr, /Excluded required module 'custom\/helper'/u );
	assert.match( run.stderr, /required by 'custom\/main'/u );
	assert.match( run.stderr, /custom\/main\.zzm/u );
}

{
	const root = makeTempDir();
	writeModule( root, 'custom/main', `
		from custom
		/helper import answer;
		export function main () { return answer(); }
	` );
	writeModule( root, 'custom/helper', 'export function answer () { return 42; }' );
	const run = runGenerator( [
		'-M',
		root,
		'--include',
		'custom/main',
		'--exclude',
		'custom/helper',
	] );
	assert.notEqual( run.status, 0 );
	assert.match( run.stderr, /Excluded required module 'custom\/helper'/u );
	assert.match( run.stderr, /required by 'custom\/main'/u );
	assert.match( run.stderr, /custom\/main\.zzm/u );
}

{
	const root = makeTempDir();
	writeModule( root, 'custom/main', 'from custom/helper try import answer;' );
	writeModule( root, 'custom/helper', 'export function answer () { return 42; }' );
	const run = runGenerator( [
		'-M',
		root,
		'--include',
		'custom/main',
		'--exclude',
		'custom/helper',
	] );
	assert.notEqual( run.status, 0 );
	assert.match( run.stderr, /Excluded required module 'custom\/helper'/u );
	assert.match( run.stderr, /required by 'custom\/main'/u );
}

{
	const run = runGenerator( [ '--exclude', 'std/string' ] );
	assert.notEqual( run.status, 0 );
	assert.match( run.stderr, /Excluded required module 'std\/string'/u );
	assert.match( run.stderr, /required by 'std\/colour'/u );
	assert.match( run.stderr, /modules\/std\/colour\.zzm/u );
}

{
	const run = runGenerator();
	assert.equal( run.status, 0, run.stderr );
	assert.match(
		run.stderr,
		/std\/string\truntime-js\t.*zuzu-js\/modules\/std\/string\.js/u
	);
	assert.match(
		run.stderr,
		/std\/uuid\tpure-zuzu\t.*modules\/std\/uuid\.zzm/u
	);
}

{
	const root = makeTempDir();
	writeModule( root, 'custom/main', `
		from ./helper import answer;
		export function main () { return answer(); }
	` );
	writeModule( root, 'custom/helper', 'export function answer () { return 42; }' );
	const run = runGenerator( [ '-M', root, '--include', 'custom/main' ] );
	assert.equal( run.status, 0, run.stderr );
	const browser = createBrowserRuntime( loadStdlib( run ) );
	const loaded = browser.runtime.loadModule( 'custom/main', '/app/main.zzs' );
	assert.equal( loaded.main(), 42 );
}

{
	const run = runGenerator( [ '--include', 'std/net/smtp' ] );
	assert.equal( run.status, 0, run.stderr );
	const stdlib = loadStdlib( run );
	assert.ok( stdlib.jsModules['/modules/std/net/smtp.js'] );
	const browser = createBrowserRuntime( stdlib );
	const loaded = browser.runtime.loadModule( 'std/net/smtp', '/app/main.zzs' );
	assert.equal( loaded.Mailer.capabilities().smtp, false );
}

{
	const run = runGenerator( [ '--include', 'std/io' ] );
	assert.notEqual( run.status, 0 );
	assert.match(
		run.stderr,
		/Module 'std\/io' is runtime-supported and is not available in the browser bundle/u
	);
}

console.log( 'browser stdlib generator tests passed' );
