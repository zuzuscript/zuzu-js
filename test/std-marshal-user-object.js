'use strict';

const assert = require( 'node:assert/strict' );
const path = require( 'node:path' );
const { spawnSync } = require( 'node:child_process' );

const { createNodeRuntime } = require( '../lib/zuzu' );
const marshal = require( '../modules/std/marshal' );
const { BinaryString } = require( '../lib/runtime-helpers' );
const projectPaths = require( '../lib/paths' );

const repoRoot = projectPaths.projectRoot;
const commands = [
	process.env.ZUZU_PERL_BIN,
	process.env.ZUZU_RUST_BIN,
].filter( Boolean );

function runZuzuJs( source ) {
	const runtime = createNodeRuntime( {
		repoRoot,
		includePaths: [ 'stdlib/test-modules' ],
	} );
	const result = runtime.runSource( source, { filename: '<marshal-user-object-test>' } );
	assert.equal( result.status, 0, result.stderr );
	return result.stdout.trimEnd();
}

function runCommand( command, source ) {
	const result = spawnSync(
		command,
		[ '-Istdlib/test-modules', '-e', source ],
		{ cwd: repoRoot, encoding: 'utf8' }
	);
	assert.equal( result.status, 0, result.stderr || result.stdout );
	return result.stdout.trimEnd();
}

function binaryFromBase64( text ) {
	return new BinaryString( Buffer.from( text, 'base64' ) );
}

const simpleObjectSource = `
	from std/marshal import dump;
	from std/string/base64 import encode;
	class SimpleBox {
		let String name with get, set;
	}
	let b := new SimpleBox( name: "Ada" );
	say( encode( dump(b) ) );
`;

{
	const output = runZuzuJs( `
		from std/marshal import dump, load, safe_to_dump;
		__global__{marshal_builds} := 0;
		__global__{marshal_loads} := 0;
		class HookBox {
			let String name with get, set := "unset";
			const kind := "box";

			method __build__ () {
				__global__{marshal_builds} := __global__{marshal_builds} + 1;
			}

			method __on_dump__ () {
				name := name _ ":dump";
			}

			method __on_load__ () {
				__global__{marshal_loads} := __global__{marshal_loads} + 1;
				name := name _ ":load";
			}

			method label () {
				return name _ ":" _ kind;
			}
		}
		let b := new HookBox( name: "Ada" );
		say( safe_to_dump(b) );
		let c := load( dump(b) );
		say( __global__{marshal_builds} );
		say( __global__{marshal_loads} );
		say( typeof c );
		say( c.label() );
		let type_ok := false;
		try {
			c.set_name(123);
		}
		catch ( Exception e ) {
			type_ok := true;
		}
		say( type_ok );
	` );
	assert.equal(
		output,
		'true\n1\n1\nHookBox\nAda:dump:dump:load:box\ntrue'
	);
}

{
	const jsBlob = runZuzuJs( simpleObjectSource );
	for ( const command of commands ) {
		const output = runCommand(
			command,
			`
				from std/marshal import load;
				from std/string/base64 import decode;
				let v := load( decode("${jsBlob}") );
				say( typeof v );
				say( v{name} );
				v.set_name("Bea");
				say( v{name} );
			`
		);
		assert.equal( output, 'SimpleBox\nAda\nBea' );
	}
}

{
	for ( const command of commands ) {
		const blob = runCommand( command, simpleObjectSource );
		const loaded = marshal.load( binaryFromBase64( blob ) );
		assert.equal( loaded.constructor.name, 'SimpleBox' );
		assert.equal( loaded.name, 'Ada' );
		loaded.set_name( 'Bea' );
		assert.equal( loaded.name, 'Bea' );
		assert.throws(
			() => loaded.set_name( 123 ),
			/must be String/
		);
	}
}

console.log( 'std/marshal user object tests passed' );
