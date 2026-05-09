'use strict';

const assert = require( 'node:assert/strict' );
const fs = require( 'node:fs' );
const os = require( 'node:os' );
const path = require( 'node:path' );
const util = require( 'node:util' );
const vm = require( 'node:vm' );
const { compileToBundle } = require( '../lib/compiler' );
const { main: runCompileCli } = require( '../bin/zuzu-js-compile' );

const tmp = fs.mkdtempSync( path.join( os.tmpdir(), 'zuzu-js-compile-' ) );
const libDir = path.join( tmp, 'lib' );
fs.mkdirSync( libDir, { recursive: true } );

const mainPath = path.join( tmp, 'main.zzs' );
const helperPath = path.join( libDir, 'helper.zzm' );
fs.writeFileSync(
	helperPath,
	`
		export function double ( Number n ) {
			return n * 2;
		}
	`,
	'utf8'
);
fs.writeFileSync(
	mainPath,
	`
		from ./lib/helper import double;
		from std/path/z import ZPath;

		let query := new ZPath( path: "/users/#0/name" );
		say( double(21) );
		say( query.first( { users: [ { name: "Ada" } ] } ) );
	`,
	'utf8'
);

const first = compileToBundle( mainPath );
const second = compileToBundle( mainPath );
assert.equal( first, second, 'compiler output is deterministic' );
assert.match( first, /ZuzuBrowser/u );
assert.match( first, /__zuzu_compiled__/u );

const compiledPath = path.join( tmp, 'compiled.js' );
fs.writeFileSync( compiledPath, first, 'utf8' );

const nodeStdout = [];
const nodeStderr = [];
const nodeContext = {
	console,
	TextDecoder: util.TextDecoder,
	TextEncoder: util.TextEncoder,
	URL,
	process: {
		versions: { node: 'test' },
		stdout: {
			write( text ) {
				nodeStdout.push( String( text ) );
			},
		},
		stderr: {
			write( text ) {
				nodeStderr.push( String( text ) );
			},
		},
		exitCode: 0,
	},
};
vm.createContext( nodeContext );
vm.runInContext( first, nodeContext, { filename: compiledPath } );
assert.equal( nodeContext.process.exitCode, 0, nodeStderr.join( '' ) );
assert.equal( nodeStdout.join( '' ), '42\nAda\n' );

const logs = [];
const events = [];
const context = {
	console: {
		log( line ) {
			logs.push( String( line ) );
		},
		error( line ) {
			throw new Error( String( line ) );
		},
	},
	TextDecoder: util.TextDecoder,
	TextEncoder: util.TextEncoder,
	CustomEvent: class CustomEvent {
		constructor( type, options ) {
			this.type = type;
			this.detail = options.detail;
		}
	},
	URL,
	document: {
		readyState: 'complete',
		querySelectorAll() {
			return [];
		},
		addEventListener() {},
	},
};
context.window = context;
context.dispatchEvent = event => events.push( event );
vm.createContext( context );
vm.runInContext( first, context, { filename: 'compiled-browser.js' } );
assert.equal( logs.join( '\n' ), '42\nAda' );
assert.equal( context.ZuzuCompiledResult.stdout, '42\nAda\n' );
assert.equal( events[0].type, 'zuzu:result' );
assert.equal( events[0].detail.stdout, '42\nAda\n' );

const cliOutputPath = path.join( tmp, 'cli-compiled.js' );
const cliResult = runCompileCli( [ mainPath, '-o', cliOutputPath ] );
assert.equal( cliResult, 0 );
assert.equal( fs.readFileSync( cliOutputPath, 'utf8' ), first );

console.log( 'zuzu-js compiler tests passed' );
