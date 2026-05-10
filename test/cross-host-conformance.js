'use strict';

const assert = require( 'node:assert/strict' );
const fs = require( 'node:fs' );
const os = require( 'node:os' );
const path = require( 'node:path' );
const projectPaths = require( '../lib/paths' );
const { ZuzuScript, createNodeHost, createBrowserHost } = require( '../lib/zuzu' );

const repoRoot = projectPaths.projectRoot;

function runOnHost( host, source, filename = '/app/main.zzs' ) {
	const runtime = new ZuzuScript( { host } );
	return runtime.runSource( source, { filename } );
}

function assertParity( testName, source, options = {} ) {
	const nodeHost = options.nodeHost || createNodeHost( { repoRoot } );
	const browserHost = options.browserHost || createBrowserHost();
	const filename = options.filename || '/app/main.zzs';
	const nodeResult = runOnHost( nodeHost, source, filename );
	const browserResult = runOnHost( browserHost, source, filename );
	assert.equal( nodeResult.status, 0, `node failed for ${testName}: ${nodeResult.stderr}` );
	assert.equal( browserResult.status, 0, `browser failed for ${testName}: ${browserResult.stderr}` );
	assert.equal( browserResult.stdout, nodeResult.stdout, `stdout mismatch for ${testName}` );
}

function makeBrowserHostWithStdModules( options = {} ) {
	const stdJsRoot = path.join( repoRoot, 'modules' );
	const jsModules = { ...( options.jsModules || {} ) };
	for ( const rel of [
		'std/string.js',
		'std/string/base64.js',
		'std/time.js',
		'std/data/json.js',
		'std/data/xml.js',
		'std/math.js',
		'std/eval.js',
		'std/net/http.js',
		'std/internals.js',
	] ) {
		const full = path.join( stdJsRoot, rel );
		jsModules[full] = require( full );
	}
	const fetchModule = typeof options.fetchModule === 'function'
		? options.fetchModule
		: (resolvedPath) => {
			if ( fs.existsSync( resolvedPath ) && fs.statSync( resolvedPath ).isFile() ) {
				return fs.readFileSync( resolvedPath, 'utf8' );
			}
			return null;
		};
	return createBrowserHost( {
		...options,
		repoRoot,
		jsModules,
		fetchModule,
	} );
}

const pureSnippets = [
	{
		name: 'arithmetic and loop flow',
		source: `
			let total := 0;
			for ( let n in [ 1, 2, 3, 4 ] ) {
				total := total + n;
			}
			say( total );
		`,
	},
	{
		name: 'switch and conditional logic',
		source: `
			let picked := '';
			switch ( 'bar' : eq ) {
				case 'foo':
					picked := 'x';
				case 'bar':
					picked := 'yay';
			}
			say( picked );
		`,
	},
	{
		name: 'capability helper shared surface',
		source: `
			if ( has_capability( 'module_load' ) ) {
				say( 'yes' );
			}
		`,
	},
];

for ( const testCase of pureSnippets ) {
	assertParity( testCase.name, testCase.source );
}

{
	const browserHost = makeBrowserHostWithStdModules();
	const stdParityCases = [
		{
			name: 'std/string trim',
			source: `
				from std/string import trim;
				say( trim( '  hi  ' ) );
			`,
		},
		{
			name: 'std/string chr ord',
			source: `
				from std/string import chr, ord;
				say( chr(9731) );
				say( ord( "a☃😀", 1 ) );
				say( chr( ord( "a☃😀", 2 ) ) );
			`,
		},
		{
			name: 'std/time deterministic epoch',
			source: `
				from std/time import Time;
				say( new Time( 0 ).year() );
			`,
		},
		{
			name: 'std/data/json canonical',
			source: `
				from std/data/json import JSON;
				let j := new JSON( canonical: true );
				say( j.encode( { b: 2, a: 1 } ) );
			`,
		},
		{
			name: 'std/data/xml parse',
			source: `
				from std/data/xml import XML;
				let parsed := XML.parse( '<root>z</root>' );
				say( parsed.documentElement().nodeName() );
			`,
		},
		{
			name: 'std/math sum',
			source: `
				from std/math import Math;
				say( Math.sum( 1, 2, 3 ) );
			`,
		},
		{
			name: 'std/eval eval',
			source: `
				from std/eval import eval;
				say( eval( "6 * 7" ) );
			`,
		},
		{
			name: 'std/net/http API surface',
			source: `
				from std/net/http import CookieJar, UserAgent;
				let jar := new CookieJar();
				let ua := new UserAgent( cookie_jar: jar );
			let req := ua.build_request( 'GET', 'https://example.com/' );
			say( typeof req );
		`,
		},
		{
			name: 'std/uuid create_uuid',
			source: `
				from std/uuid import create_uuid;
				say( typeof create_uuid );
			`,
		},
		{
			name: 'std/dump Dumper.dump',
			source: `
				from std/dump import Dumper;
				say( typeof Dumper );
			`,
		},
		{
			name: 'std/path/z ZPath evaluates',
			source: `
				from std/path/z import ZPath;
				let query := new ZPath( path: "/users/#0/name" );
				say( query.first( { users: [ { name: "Ada" } ] } ) );
			`,
		},
		];
	for ( const testCase of stdParityCases ) {
		assertParity( testCase.name, testCase.source, { browserHost } );
	}
}

{
	const stdJsRoot = path.join( repoRoot, 'modules' );
	const jsModules = {};
	for ( const rel of [ 'std/time.js', 'std/net/http.js' ] ) {
		const full = path.join( stdJsRoot, rel );
		jsModules[full] = require( full );
	}

	const nodeRuntime = new ZuzuScript( { host: createNodeHost( { repoRoot } ) } );
	const browserRuntime = new ZuzuScript( {
		host: createBrowserHost( {
			repoRoot,
			jsModules,
		} ),
	} );

	const nodeTime = nodeRuntime.loadModule( 'std/time', '/app/main.zzs' );
	const browserTime = browserRuntime.loadModule( 'std/time', '/app/main.zzs' );
	assert.equal( typeof nodeTime.Time, 'function' );
	assert.equal( typeof browserTime.Time, 'function' );
	assert.equal( new nodeTime.Time( 0 ).year(), new browserTime.Time( 0 ).year() );

	const nodeHttp = nodeRuntime.loadModule( 'std/net/http', '/app/main.zzs' );
	const browserHttp = browserRuntime.loadModule( 'std/net/http', '/app/main.zzs' );
	for ( const symbol of [ 'CookieJar', 'Request', 'Response', 'UserAgent' ] ) {
		assert.equal( typeof nodeHttp[symbol], 'function' );
		assert.equal( typeof browserHttp[symbol], 'function' );
	}
}

{
	const nodeHost = createNodeHost( { repoRoot } );
	const browserHost = createBrowserHost( {
		repoRoot,
		virtualFiles: {
			'/app/lib/math.zzs': `
				export function add2( Number n ) {
					return n + 2;
				}
			`,
		},
	} );
	const source = `
		from ./lib/math import add2;
		say( add2( 40 ) );
	`;
	const nodeResult = runOnHost( nodeHost, source );
	const browserResult = runOnHost( browserHost, source );
	assert.equal( nodeResult.status, 1 );
	assert.match( nodeResult.stderr, /Unable to resolve module: .\/lib\/math/u );
	assert.equal( browserResult.status, 0, browserResult.stderr );
	assert.equal( browserResult.stdout, '42\n' );
}

{
	const tempDir = fs.mkdtempSync( path.join( os.tmpdir(), 'zuzu-js-phase2-mixed-' ) );
	const utilPath = path.join( tempDir, 'util.zzs' );
	const mainPath = path.join( tempDir, 'main.zzs' );
	const utilSource = `
		from std/math import Math;
		export function ninety_nine () {
			return Math.sum( 33, 33, 33 );
		}
	`;
	const mainSource = `
		from ./util import ninety_nine;
		from std/string import sprint;
		say( sprint( '%s:%d', 'sum', ninety_nine() ) );
	`;
	fs.writeFileSync( utilPath, utilSource, 'utf8' );
	fs.writeFileSync( mainPath, mainSource, 'utf8' );

	const browserHost = makeBrowserHostWithStdModules( {
		virtualFiles: {
			[utilPath]: utilSource,
			[mainPath]: mainSource,
		},
	} );
	const nodeResult = runOnHost( createNodeHost( { repoRoot } ), mainSource, mainPath );
	const browserResult = runOnHost( browserHost, mainSource, mainPath );
	assert.equal( nodeResult.status, 0, nodeResult.stderr );
	assert.equal( browserResult.status, 0, browserResult.stderr );
	assert.equal( browserResult.stdout, nodeResult.stdout );
}

console.log( 'cross-host conformance tests passed' );
