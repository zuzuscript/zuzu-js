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

assert.deepEqual(
	collectTopLevelDeclarations( `
		function has_quote_regex () {
			return text ~ /^[btnrf"'\\\\]$/;
		}
		function after_regex () {
			return true;
		}
	`, (source) => source ).sort(),
	[ 'after_regex', 'has_quote_regex' ]
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

	let released_owner := new Box();
	let released_source := { owner: released_owner };
	let { owner: released_saved but weak } := released_source;
	released_owner := null;
	ok( released_saved != null, "Dict source keeps weak unpacked value live" );
	released_source := null;
	ok( released_saved == null, "Dict source release drops weak unpacked value" );

	let alias_owner := new Box();
	let alias_source := { owner: alias_owner };
	let alias_source_copy := alias_source;
	let { owner: alias_saved but weak } := alias_source;
	alias_owner := null;
	alias_source := null;
	ok( alias_saved != null, "Dict source alias keeps weak unpacked value live" );
	alias_source_copy := null;
	ok( alias_saved == null, "Dict source final release drops weak unpacked value" );

	let pair_owner := new Box();
	let pair_source := {{ owner: pair_owner }};
	let { owner: pair_saved but weak } := pair_source;
	pair_owner := null;
	ok( pair_saved != null, "PairList source keeps weak unpacked value live" );
	pair_source := null;
	ok( pair_saved == null, "PairList source release drops weak unpacked value" );

	let copied_owner := new Box();
	let copied_source := { owner: copied_owner };
	let copied_dict := copied_source.copy();
	let { owner: copied_saved but weak } := copied_dict;
	copied_owner := null;
	copied_source := null;
	ok( copied_saved != null, "copied Dict keeps weak unpacked value live" );
	copied_dict := null;
	ok( copied_saved == null, "copied Dict release drops weak unpacked value" );

	let constructed_pair_owner := new Box();
	let constructed_pair_arg := [ "owner", constructed_pair_owner ];
	let constructed_pairs := new PairList( constructed_pair_arg );
	let { owner: constructed_pair_saved but weak } := constructed_pairs;
	constructed_pair_arg := null;
	constructed_pair_owner := null;
	ok(
		constructed_pair_saved != null,
		"constructed PairList keeps weak unpacked value live",
	);
	constructed_pairs := null;
	ok(
		constructed_pair_saved == null,
		"constructed PairList release drops weak unpacked value",
	);

	let removal_owner := new Box();
	let removal_source := { owner: removal_owner };
	let removal_copy := removal_source.copy();
	let removal_saved := removal_owner but weak;
	removal_copy.remove( "owner" );
	removal_owner := null;
	ok(
		removal_saved != null,
		"copy removal does not release original Dict value",
	);
	removal_source := null;
	ok(
		removal_saved == null,
		"original Dict release drops value after copy removal",
	);

	let weak_set_owner := new Box();
	let weak_set_dict := { owner: weak_set_owner };
	let weak_set_saved := weak_set_owner but weak;
	weak_set_dict.set_weak( "owner", new Box() );
	weak_set_owner := null;
	ok(
		weak_set_saved == null,
		"Dict weak write releases previous strong retained value",
	);

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
assert.match( result.stdout, /1\.\.29/u );
assert.doesNotMatch( result.stdout, /^not ok/mu );
