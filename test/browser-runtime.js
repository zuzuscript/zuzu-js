'use strict';

const assert = require( 'node:assert/strict' );
const path = require( 'node:path' );
const projectPaths = require( '../lib/paths' );
const { ZuzuScript, createBrowserRuntime } = require( '../lib/zuzu' );
const { addModule } = require( '../lib/browser-bundle-entry' );

const repoRoot = projectPaths.projectRoot;

async function main() {
{
	const browser = createBrowserRuntime( {
		evaluate( source, context ) {
			context.globalThis = context;
			try {
				const expr = Function(
					'__zuzu_context',
					`with ( __zuzu_context ) { return ( ${source} ); }`
				);
				return expr( context );
			}
			catch ( _exprError ) {
				const script = Function(
					'__zuzu_context',
					`with ( __zuzu_context ) { ${source}\n }`
				);
				return script( context );
			}
		},
	} );
	assert.ok( browser.runtime instanceof ZuzuScript );
	assert.deepEqual( browser.runtime.getModuleSearchRoots(), [ '/modules' ] );

	assert.equal( browser.zuzu_eval( '6 * 7' ), 42 );
	const result = browser.zuzu_run( 'say( 6 * 7 );' );
	assert.equal( result.status, 0, result.stderr );
	assert.equal( result.stdout, '42\n' );
	assert.equal( typeof browser.zuzu_compile( '5 mod 2' ), 'string' );
}

{
	const browser = createBrowserRuntime( {
		virtualFiles: {
			'/app/lib/tools.zzs': `
				export function twice( Number n ) {
					return n * 2;
				}
			`,
		},
	} );
	const result = browser.zuzu_run( `
		from ./lib/tools import twice;
		say( twice( 21 ) );
	`, { filename: '/app/main.zzs' } );
	assert.equal( result.status, 0, result.stderr );
	assert.equal( result.stdout, '42\n' );
}

	{
		const browser = createBrowserRuntime();
		await assert.rejects(
			browser.zuzu_eval( '1 +', { async: true } ),
			( err ) => err && err.name === 'ZuzuParseError',
		);
	}

	{
		const marshalModulePath = path.join(
			repoRoot,
			'modules',
			'std',
			'marshal.js'
		);
		const browser = createBrowserRuntime( {
			repoRoot,
			jsModules: {
				[marshalModulePath]: require( marshalModulePath ),
			},
		} );
		const result = browser.zuzu_run( `
			from std/marshal import
				dump,
				load,
				safe_to_dump,
				MarshallingException,
				UnmarshallingException;
			say( typeof dump );
			say( typeof load );
			say( typeof safe_to_dump );
			say( typeof MarshallingException );
			say( typeof UnmarshallingException );
			say( safe_to_dump(null) );
			say( load( dump(null) ) eq null );
			let load_typed := false;
			try {
				load("not binary");
			}
			catch ( TypeException e ) {
				load_typed := true;
			}
			say( load_typed );
		`, { filename: '/app/marshal-smoke.zzs' } );
		assert.equal( result.status, 0, result.stderr );
		assert.equal(
			result.stdout,
			'Function\nFunction\nFunction\nClass\nClass\ntrue\n1\ntrue\n'
		);
	}

	{
		const fetchCalls = [];
		addModule( 'foo/base', 'https://example.net/modules/foo/base.zzm' );
		addModule( 'foo/bar', 'https://example.net/modules/foo/bar.zzm' );
		const browser = createBrowserRuntime( {
			fetch( url ) {
				fetchCalls.push( url );
				if ( url.endsWith( '/foo/base.zzm' ) ) {
					return Promise.resolve( {
						ok: true,
						text() {
							return Promise.resolve( `
								export const base := 41;
							` );
						},
					} );
				}
				return Promise.resolve( {
					ok: true,
					text() {
						return Promise.resolve( `
							from foo/base import base;
							export const value := base + 1;
						` );
					},
				} );
			},
		} );
		const first = await browser.zuzu_run( `
			from foo/bar import value;
			from foo/bar import value as again;
			say( value );
			say( again );
		`, { filename: '/app/remote-main.zzs' } );
		assert.equal( first.status, 0, first.stderr );
		assert.equal( first.stdout, '42\n42\n' );
		assert.deepEqual(
			fetchCalls,
			[
				'https://example.net/modules/foo/bar.zzm',
				'https://example.net/modules/foo/base.zzm',
			]
		);

		const second = await browser.zuzu_run( `
			from foo/bar import value;
			say( value + 1 );
		`, { filename: '/app/remote-again.zzs' } );
		assert.equal( second.status, 0, second.stderr );
		assert.equal( second.stdout, '43\n' );
		assert.deepEqual(
			fetchCalls,
			[
				'https://example.net/modules/foo/bar.zzm',
				'https://example.net/modules/foo/base.zzm',
			]
		);
	}

	console.log( 'browser runtime tests passed' );
	}

main().catch( ( err ) => {
	console.error( err );
	process.exitCode = 1;
} );
