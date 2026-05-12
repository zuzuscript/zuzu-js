'use strict';

const assert = require( 'node:assert/strict' );
const fs = require( 'node:fs' );
const os = require( 'node:os' );
const path = require( 'node:path' );
const projectPaths = require( '../lib/paths' );
const { spawnSync } = require( 'node:child_process' );

const cliPath = path.join( __dirname, '..', 'bin', 'zuzu-js' );
const repoRoot = projectPaths.projectRoot;

function runCli( args, options = {} ) {
	return spawnSync( process.execPath, [ cliPath, ...args ], {
		cwd: options.cwd || repoRoot,
		encoding: 'utf8',
		env: {
			...process.env,
			...( options.env || {} ),
		},
	} );
}

{
	const tmp = fs.mkdtempSync( path.join( os.tmpdir(), 'zuzu-js-cli-' ) );
	const script = path.join( tmp, 'hello.zzs' );
	fs.writeFileSync( script, 'say( "OK" );\n', 'utf8' );
	const result = runCli( [ script ] );
	assert.equal( result.status, 0 );
	assert.equal( result.stdout, 'OK\n' );
}

{
	const tmp = fs.mkdtempSync( path.join( os.tmpdir(), 'zuzu-js-cli-' ) );
	const script = path.join( tmp, 'argv.zzs' );
	fs.writeFileSync(
		script,
		'function __main__ (args) { say( args.length() ); for ( let arg in args ) { say( arg ); } }\n',
		'utf8'
	);
	const result = runCli( [ script, 'one', 'two', 'three' ] );
	assert.equal( result.status, 0 );
	assert.equal( result.stdout, '3\none\ntwo\nthree\n' );
}

{
	const result = runCli( [ '-e', 'say( "INLINE" );' ] );
	assert.equal( result.status, 0 );
	assert.equal( result.stdout, 'INLINE\n' );
}

{
	const result = runCli( [ '--transpiler=new-only', '-e', 'say( "STRICT" );' ] );
	assert.equal( result.status, 0 );
	assert.equal( result.stdout, 'STRICT\n' );
}

{
	const result = runCli( [ '-d0', '-e', 'assert false; say "after";' ] );
	assert.equal( result.status, 0 );
	assert.equal( result.stdout, 'after\n' );
	assert.equal( result.stderr, '' );
}

{
	const result = runCli( [ '-d1', '-e', 'assert false; say "after";' ] );
	assert.equal( result.status, 1 );
	assert.equal( result.stdout, '' );
	assert.match( result.stderr, /^Error: Assertion failed\n$/u );
}

{
	const result = runCli( [ '-d3', '-e', 'debug 3, "shown"; say "visible";' ] );
	assert.equal( result.status, 0 );
	assert.equal( result.stdout, 'visible\n' );
	assert.equal( result.stderr, 'shown\n' );
}

{
	const result = runCli( [ '-e', 'warn "careful"; say "visible";' ] );
	assert.equal( result.status, 0 );
	assert.equal( result.stdout, 'visible\n' );
	assert.equal( result.stderr, 'careful\n' );
}

{
	const result = runCli( [
		'-d2',
		'-e',
		'function explode () { die "debug should not evaluate"; } debug 3, explode(); say "visible";',
	] );
	assert.equal( result.status, 0 );
	assert.equal( result.stdout, 'visible\n' );
	assert.equal( result.stderr, '' );
}

{
	const result = runCli( [ '--transpiler=new', '-e', 'say( "NEW" );' ] );
	assert.equal( result.status, 2 );
	assert.match( result.stderr, /Unknown transpiler: new/ );
}

{
	const result = runCli( [ '--help' ] );
	assert.equal( result.status, 0 );
	assert.doesNotMatch( result.stderr, /--transpiler/ );
	assert.match( result.stderr, /--electron/ );
}

{
	const result = runCli( [ '--electron', '-e', 'say("no");' ] );
	assert.equal( result.status, 2 );
	assert.match( result.stderr, /Cannot combine --electron with -e/ );
}

{
	const tmp = fs.mkdtempSync( path.join( os.tmpdir(), 'zuzu-js-cli-electron-' ) );
	const fakeElectron = path.join( tmp, process.platform === 'win32'
		? 'electron.cmd'
		: 'electron' );
	const script = path.join( tmp, 'app.zzs' );
	fs.writeFileSync( script, 'say("GUI");\n', 'utf8' );
	if ( process.platform === 'win32' ) {
		fs.writeFileSync(
			fakeElectron,
			'@echo off\r\nnode -e "console.log(JSON.stringify(process.argv.slice(1)))" %*\r\n',
			'utf8'
		);
	}
	else {
		fs.writeFileSync(
			fakeElectron,
			'#!/usr/bin/env node\nconsole.log(JSON.stringify(process.argv.slice(2)));\n',
			'utf8'
		);
		fs.chmodSync( fakeElectron, 0o755 );
	}
	const result = runCli(
		[ '--electron', script, 'one', 'two' ],
		{ env: { ZUZU_JS_ELECTRON_COMMAND: fakeElectron } }
	);
	assert.equal( result.status, 0 );
	const launched = JSON.parse( result.stdout.trim() );
	assert.equal( path.basename( launched[0] ), 'zuzu-js-electron' );
	assert.equal( launched[1], script );
	assert.deepEqual( launched.slice( 2 ), [ 'one', 'two' ] );
}

{
	const tmp = fs.mkdtempSync( path.join( os.tmpdir(), 'zuzu-js-cli-electron-' ) );
	const fakeElectron = path.join( tmp, process.platform === 'win32'
		? 'electron.cmd'
		: 'electron' );
	const lib = path.join( tmp, 'lib' );
	const script = path.join( tmp, 'app.zzs' );
	fs.mkdirSync( lib, { recursive: true } );
	fs.writeFileSync( script, 'from greet import hi;\nsay( hi() );\n', 'utf8' );
	if ( process.platform === 'win32' ) {
		fs.writeFileSync(
			fakeElectron,
			'@echo off\r\nnode -e "console.log(JSON.stringify(process.argv.slice(1)))" %*\r\n',
			'utf8'
		);
	}
	else {
		fs.writeFileSync(
			fakeElectron,
			'#!/usr/bin/env node\nconsole.log(JSON.stringify(process.argv.slice(2)));\n',
			'utf8'
		);
		fs.chmodSync( fakeElectron, 0o755 );
	}
	const result = runCli(
		[ '--electron', '-I', lib, script, 'arg' ],
		{ env: { ZUZU_JS_ELECTRON_COMMAND: fakeElectron } }
	);
	assert.equal( result.status, 0 );
	const launched = JSON.parse( result.stdout.trim() );
	assert.equal( path.basename( launched[0] ), 'zuzu-js-electron' );
	assert.deepEqual( launched.slice( 1 ), [ '-I', lib, script, 'arg' ] );
}

{
	const tmp = fs.mkdtempSync( path.join( os.tmpdir(), 'zuzu-js-cli-' ) );
	const lib = path.join( tmp, 'lib' );
	fs.mkdirSync( lib, { recursive: true } );
	fs.writeFileSync( path.join( lib, 'greet.js' ), 'module.exports.hi = () => "HELLO";\n', 'utf8' );
	const script = path.join( tmp, 'main.zzs' );
	fs.writeFileSync( script, 'from greet import hi;\nsay( hi() );\n', 'utf8' );
	const result = runCli( [ `-I${lib}`, script ] );
	assert.equal( result.status, 0 );
	assert.equal( result.stdout, 'HELLO\n' );
}

{
	const tmp = fs.mkdtempSync( path.join( os.tmpdir(), 'zuzu-js-cli-' ) );
	const lib = path.join( tmp, 'lib' );
	fs.mkdirSync( lib, { recursive: true } );
	fs.writeFileSync( path.join( lib, 'nums.js' ), 'module.exports.forty_two = () => 42;\n', 'utf8' );
	const result = runCli( [ `-I${lib}`, '-Mnums', '-e', 'say( forty_two() );' ] );
	assert.equal( result.status, 0 );
	assert.equal( result.stdout, '42\n' );
}

{
	const result = runCli( [ '--deny=fs', '-e', 'from std/io import cwd;' ] );
	assert.notEqual( result.status, 0 );
	assert.match( result.stderr, /Denied capability 'fs'/ );
}

{
	const result = runCli( [
		'--deny=fs',
		'-e',
		[
			'from std/tui import filename_completions, directory_completions;',
			'say(filename_completions("modules/std/tu").length());',
			'say(directory_completions("modules/st").length());',
		].join( ' ' ),
	] );
	assert.equal( result.status, 0 );
	assert.equal( result.stdout, '0\n0\n' );
	assert.equal( result.stderr, '' );
}

{
	const result = runCli( [ '--deny=clib', '-e', 'from std/clib import CLib;' ] );
	assert.notEqual( result.status, 0 );
	assert.match( result.stderr, /Denied capability 'clib'/ );
}

{
	const result = runCli( [
		'-e',
		[
			'from std/worker import Worker;',
			'let task := Worker.spawn(function ( x ) { return x * 2; }, [21]);',
			'say(await { task; });',
		].join( ' ' ),
	] );
	assert.equal( result.status, 0 );
	assert.equal( result.stdout, '42\n' );
	assert.equal( result.stderr, '' );
}

{
	const result = runCli( [ '-e', 'say( __system__{deny_js} );' ] );
	assert.equal( result.status, 0 );
	assert.equal( result.stdout, 'false\n' );
}

{
	const result = runCli( [ '--deny=js', '-e', 'from javascript import JS;' ] );
	assert.notEqual( result.status, 0 );
	assert.match( result.stderr, /Denied capability 'js'/ );
}

{
	const result = runCli( [ '-e', 'say( __system__{deny_gui} );' ] );
	assert.equal( result.status, 0 );
	assert.equal( result.stdout, 'true\n' );
}

{
	const result = runCli( [
		'-e',
		[
			'from std/marshal import dump, load, safe_to_dump, MarshallingException, UnmarshallingException;',
			'say( typeof dump );',
			'say( typeof load );',
			'say( typeof safe_to_dump );',
			'say( typeof MarshallingException );',
			'say( typeof UnmarshallingException );',
			'say( safe_to_dump(null) );',
			'say( load( dump(null) ) eq null );',
			'let load_typed := false;',
			'try { load("not binary"); }',
			'catch ( TypeException e ) { load_typed := true; }',
			'say( load_typed );',
		].join( ' ' ),
	] );
	assert.equal( result.status, 0, result.stderr );
	assert.equal(
		result.stdout,
		'Function\nFunction\nFunction\nClass\nClass\ntrue\n1\ntrue\n'
	);
}

{
	const result = runCli( [ '-e', 'from std/gui/objects import Widget;' ] );
	assert.notEqual( result.status, 0 );
	assert.match( result.stderr, /Denied capability 'gui'/ );
}

{
	const result = runCli( [
		'-e',
		[
			'from std/gui/dialogue import alert, confirm, prompt, file_open;',
			'alert("Hi");',
			'say(confirm("Q", auto_result: true));',
			'say(prompt("Name:", auto_result: "Ada"));',
			'say(file_open(auto_result: "x.txt"));',
			'from std/tui import filename_completions;',
			'say(filename_completions("modules/std/tu").length() > 0);',
		].join( ' ' ),
	] );
	assert.equal( result.status, 0 );
	assert.equal( result.stdout, 'Hi\ntrue\nAda\nx.txt\n1\n' );
	assert.equal( result.stderr, '' );
}

{
	const result = runCli( [ '--denymodule=std/string', '-e', 'from std/string import trim;' ] );
	assert.notEqual( result.status, 0 );
	assert.match( result.stderr, /Denied module: std\/string/ );
}

{
	const result = runCli( [ '--nope' ] );
	assert.equal( result.status, 2 );
	assert.match( result.stderr, /Unknown option: --nope/ );
}

{
	const result = runCli( [ '--transpiler=broken', '-e', 'say( "NOPE" );' ] );
	assert.equal( result.status, 2 );
	assert.match( result.stderr, /Unknown transpiler: broken/ );
}

{
	const result = runCli( [ '-I' ] );
	assert.equal( result.status, 2 );
	assert.match( result.stderr, /Missing value for -I/ );
}

{
	const tmp = fs.mkdtempSync( path.join( os.tmpdir(), 'zuzu-js-cli-' ) );
	const script = path.join( tmp, 'shebang.zzs' );
	fs.writeFileSync( script, '#!/usr/bin/env zuzu-js\nsay( "SHEBANG" );\n', 'utf8' );
	const result = runCli( [ script ] );
	assert.equal( result.status, 0 );
	assert.equal( result.stdout, 'SHEBANG\n' );
}

{
	const tmp = fs.mkdtempSync( path.join( os.tmpdir(), 'zuzu-js-cli-' ) );
	const script = path.join( tmp, 'large-output.zzs' );
	const lineCount = 4000;
	const lines = [];
	for ( let i = 0; i < lineCount; i++ ) {
		lines.push(
			`say( "LINE-${String( i ).padStart( 4, '0' )}-abcdefghijklmnopqrstuvwxyz" );`
		);
	}
	fs.writeFileSync( script, `${lines.join( '\n' )}\n`, 'utf8' );
	const result = runCli( [ script ] );
	assert.equal( result.status, 0 );
	assert.ok( result.stdout.length > 73728 );
	assert.ok(
		result.stdout.endsWith( 'LINE-3999-abcdefghijklmnopqrstuvwxyz\n' )
	);
}

console.log( 'zuzu-js cli tests passed' );
