'use strict';

const assert = require( 'node:assert/strict' );
const { ZuzuScript } = require( '../lib/zuzu' );
const {
	tokenize,
	parse,
	transpileWithoutFallback,
} = require( '../lib/transpiler-new' );
const { collectTopLevelDeclarations } = require( '../lib/runtime-helpers' );

{
	const ast = parse( tokenize( `
		let {
			host,
			Number port,
			"for": for_id,
			\`user-${'${suffix}'}\`: String user_id,
			(content_key): content_type := "text/plain" but weak,
		} := opts;
	` ) );
	const decl = ast.body[0];
	assert.equal( decl.type, 'VariableUnpackDeclaration' );
	assert.equal( decl.kind, 'let' );
	assert.equal( decl.pattern.type, 'KeyedBindingPattern' );
	assert.deepEqual(
		decl.pattern.entries.map( (entry) => entry.name ),
		[ 'host', 'port', 'for_id', 'user_id', 'content_type' ]
	);
	assert.equal( decl.pattern.entries[1].declaredType, 'Number' );
	assert.equal( decl.pattern.entries[3].declaredType, 'String' );
	assert.equal( decl.pattern.entries[4].defaultValue.type, 'StringLiteral' );
	assert.equal( decl.pattern.entries[4].isWeakStorage, true );
}

{
	const js = transpileWithoutFallback( 'let { Number n := 1 } := data;' );
	assert.match( js, /__zuzu_unpack_source\(\s*data\s*\)/u );
	assert.match(
		js,
		/const __zuzu_unpack_value_\d+ = __zuzu_unpack_value\([^,]+,\s*"n",\s*\(\) => 1,\s*"n",\s*"Number",\s*false\s*\)/u
	);
	assert.match( js, /let n = __zuzu_unpack_value_\d+;/u );
}

assert.throws(
	() => transpileWithoutFallback( 'let { a, b: a } := { a: 1, b: 2 };' ),
	/Duplicate unpacked binding 'a'/u
);

assert.throws(
	() => transpileWithoutFallback( 'const { a } := { a: 1 }; a := 2;' ),
	/Cannot assign to const 'a'/u
);

assert.throws(
	() => transpileWithoutFallback(
		'let source := { a: 1 }; let x; ({ a: x }) := source;'
	),
	/Invalid assignment target/u
);

assert.throws(
	() => transpileWithoutFallback( 'let result := (let { a } := { a: 1 });' ),
	/Expected name after let or const in expression/u
);

assert.deepEqual(
	collectTopLevelDeclarations( `
		let {
			host,
			"for": for_id,
			Number port := 1234,
		} := opts;
	`, (source) => source ).sort(),
	[ 'for_id', 'host', 'port' ]
);

const runtime = new ZuzuScript( { transpiler: 'new-only' } );
const result = runtime.runSource( `
	from test/more import *;

	let suffix := "id";
	let content_key := "content-type";
	let calls := 0;
	function fallback () {
		calls := calls + 1;
		return "fallback";
	}
	function explode () {
		die "default should not run";
	}

	let {
		host,
		Number port,
		"for": for_id,
		\`user-\${suffix}\`: String user_id,
		(content_key): content_type,
		present := explode(),
		missing := fallback(),
		absent,
	} := {
		host: "127.0.0.1",
		port: 9000,
		"for": 7,
		"user-id": "ada",
		"content-type": "text/plain",
		present: null,
	};

	is( host, "127.0.0.1", "shorthand binding" );
	is( port, 9000, "typed shorthand binding" );
	is( for_id, 7, "string key alias binding" );
	is( user_id, "ada", "template key typed alias binding" );
	is( content_type, "text/plain", "computed key alias binding" );
	is( present, null, "present null does not use default" );
	is( missing, "fallback", "missing key uses default" );
	is( calls, 1, "defaults are lazy" );
	is( absent, null, "missing key without default binds null" );

	let source_calls := 0;
	function source () {
		source_calls := source_calls + 1;
		return { a: 1, b: 2 };
	}
	let { a, b } := source();
	is( a + b + source_calls, 4, "source evaluates once" );

	let key := "chosen";
	{
		let { (key): key } := { chosen: 5 };
		is( key, 5, "key expressions use outer names before locals exist" );
	}

	let { dup } := {{ dup: 1, dup: 2 }};
	is( dup, 1, "PairList unpacking uses first-match semantics" );

	class Box {}
	let owner := new Box();
	let { owner: parent but weak } := { owner: owner };
	let alive := parent != null;
	owner := null;
	ok( alive and parent == null, "per-entry weak storage is honoured" );

	const { fixed } := { fixed: 42 };
	is( fixed, 42, "const unpacking binds values" );

	like(
		exception( function() {
			let { invalid } := 42;
		} ),
		/Declaration unpacking expects Dict or PairList, got Number/,
		"invalid source throws",
	);

	like(
		exception( function() {
			let { Number n } := { n: "nope" };
		} ),
		/TypeException: 'n' must be Number, got String/,
		"typed unpacked bindings keep normal type checks",
	);

	done_testing();
`, { filename: '/tmp/declaration-unpacking.zzs' } );

assert.equal( result.status, 0, result.stderr );
assert.match( result.stdout, /1\.\.16/u );
assert.doesNotMatch( result.stdout, /^not ok/mu );
