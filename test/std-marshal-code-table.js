'use strict';

const assert = require( 'node:assert/strict' );
const fs = require( 'node:fs' );
const path = require( 'node:path' );
const { spawnSync } = require( 'node:child_process' );

const { createNodeRuntime } = require( '../lib/zuzu' );

const repoRoot = path.resolve( __dirname, '..', '..', '..' );
const fixtureDir = path.join( repoRoot, 't', 'fixtures', 'marshal', 'golden' );
const commands = [ 'bin/zuzu', 'extras/zuzu-rust/target/release/zuzu-rust' ];

function runZuzuJs( source ) {
	const runtime = createNodeRuntime( {
		repoRoot,
		includePaths: [ 't/modules' ],
	} );
	const result = runtime.runSource( source, { filename: '<marshal-code-table-test>' } );
	assert.equal( result.status, 0, result.stderr );
	return result.stdout.trimEnd();
}

function runCommand( command, source ) {
	const result = spawnSync(
		command,
		[ '-It/modules', '-e', source ],
		{ cwd: repoRoot, encoding: 'utf8' }
	);
	assert.equal( result.status, 0, result.stderr || result.stdout );
	return result.stdout.trimEnd();
}

function fixture( name ) {
	return fs.readFileSync( path.join( fixtureDir, `${name}.b64` ), 'utf8' ).trim();
}

{
	const output = runZuzuJs( `
		from std/marshal import load;
		from std/string/base64 import decode;

		let f := load( decode("${fixture( 'function' )}") );
		say( f(41) );

		let K := load( decode("${fixture( 'class' )}") );
		let o := new K( x: 1 );
		say( o.total(1) );

		let T := load( decode("${fixture( 'trait' )}") );
		class TraitUser with T {
			let String name with get := "Bea";
		}
		say( new TraitUser().label() );

		let box := load( decode("${fixture( 'object-instance' )}") );
		say( typeof box );
		say( box.label() );
		box.set_name("Bea");
		say( box.label() );
	` );
	assert.equal( output, '42\n42\nlabel:Bea\nGoldenBox\nAda:box\nBea:box' );
}

const jsFixtures = {
	function: `
		from std/marshal import dump;
		from std/string/base64 import encode;
		function js_add_one (x) {
			return x + 1;
		}
		say( encode( dump(js_add_one) ) );
	`,
	class: `
		from std/marshal import dump;
		from std/string/base64 import encode;
		const js_offset := 40;
		class JsPoint {
			let Number x := 1;

			method total (Number y) -> Number {
				return x + y + js_offset;
			}
		}
		say( encode( dump(JsPoint) ) );
	`,
	trait: `
		from std/marshal import dump;
		from std/string/base64 import encode;
		const js_prefix := "label:";
		trait JsLabelled {
			method label () -> String {
				return js_prefix _ self.get_name();
			}
		}
		say( encode( dump(JsLabelled) ) );
	`,
	object: `
		from std/marshal import dump;
		from std/string/base64 import encode;
		class JsBox {
			let String name with get, set := "unset";
			const kind := "box";

			method label () {
				return name _ ":" _ kind;
			}
		}
		say( encode( dump( new JsBox( name: "Ada" ) ) ) );
	`,
};

for ( const command of commands ) {
	assert.equal(
		runCommand(
			command,
			`
				from std/marshal import load;
				from std/string/base64 import decode;
				let f := load( decode("${runZuzuJs( jsFixtures.function )}") );
				say( f(41) );
			`
		),
		'42'
	);

	assert.equal(
		runCommand(
			command,
			`
				from std/marshal import load;
				from std/string/base64 import decode;
				let K := load( decode("${runZuzuJs( jsFixtures.class )}") );
				let o := new K( x: 1 );
				say( typeof K );
				say( o.total(1) );
			`
		),
		'Class\n42'
	);

	assert.equal(
		runCommand(
			command,
			`
				from std/marshal import load;
				from std/string/base64 import decode;
				let T := load( decode("${runZuzuJs( jsFixtures.trait )}") );
				class JsTraitUser with T {
					let String name with get := "Bea";
				}
				say( new JsTraitUser().label() );
			`
		),
		'label:Bea'
	);

	assert.equal(
		runCommand(
			command,
			`
				from std/marshal import load;
				from std/string/base64 import decode;
				let box := load( decode("${runZuzuJs( jsFixtures.object )}") );
				say( typeof box );
				say( box.label() );
				box.set_name("Bea");
				say( box.label() );
			`
		),
		'JsBox\nAda:box\nBea:box'
	);
}

console.log( 'std/marshal code table tests passed' );
