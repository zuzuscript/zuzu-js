'use strict';

const assert = require( 'node:assert/strict' );
const { ZuzuScript } = require( '../lib/zuzu' );
const {
	tokenize,
	parse,
	transpileWithoutFallback,
} = require( '../lib/transpiler-new' );

{
	const ast = parse( tokenize( `
		function connect () {
			return 1;
		}
		let opts := {};
		connect( ...opts default { timeout: 30 } );
	` ) );
	const spread = ast.body[2].expression.arguments[0];
	assert.equal( spread.type, 'SpreadArgument' );
	assert.equal( spread.argument.type, 'BinaryExpression' );
	assert.equal( spread.argument.operator, 'default' );
	assert.equal( spread.argument.left.name, 'opts' );
	assert.equal( spread.argument.right.type, 'ObjectExpression' );
}

{
	const ast = parse( tokenize(
		'let merged := { a: 1 } default { b: 2 } default { c: 3 };'
	) );
	const expr = ast.body[0].init;
	assert.equal( expr.type, 'BinaryExpression' );
	assert.equal( expr.operator, 'default' );
	assert.equal( expr.left.type, 'BinaryExpression' );
	assert.equal( expr.left.operator, 'default' );
	assert.equal( expr.right.type, 'ObjectExpression' );
}

{
	const ast = parse( tokenize( 'let got := left default middle == right;' ) );
	const expr = ast.body[0].init;
	assert.equal( expr.operator, '==' );
	assert.equal( expr.left.operator, 'default' );
}

{
	const ast = parse( tokenize( 'let got := left default middle < right;' ) );
	const expr = ast.body[0].init;
	assert.equal( expr.operator, 'default' );
	assert.equal( expr.right.operator, '<' );
}

{
	const js = transpileWithoutFallback( 'let merged := left default right;' );
	assert.match( js, /__zuzu_default\(\s*left,\s*right\s*\)/u );
}

{
	const runtime = new ZuzuScript( { transpiler: 'new-only' } );
	const result = runtime.runSource( `
		from test/more import *;

		let dict := { keep: "left", child: [ "left" ] };
		let dict_got := dict default { keep: "right", add: "fallback" };
		is( typeof dict_got, "Dict", "Dict default returns a Dict" );
		is( dict_got{"keep"}, "left", "Dict default keeps left value" );
		is( dict_got{"add"}, "fallback", "Dict default inserts missing key" );
		dict_got{"child"}.push( "mutated" );
		is( dict{"child"}, [ "left", "mutated" ], "Dict default shares values" );
		dict_got{"extra"} := 1;
		is( dict.exists( "extra" ), 0, "Dict default copies the left Dict" );

		let dict_pairs := { keep: "left" } default {{
			keep: "right",
			add: "first",
			add: "second",
		}};
		is(
			dict_pairs.kv(),
			[ "add", "first", "keep", "left" ],
			"Dict default from PairList uses first missing default",
		);

		let pairs := {{ keep: "left-one", keep: "left-two", child: [ "left" ] }};
		let pairs_got := pairs default {{
			keep: "right",
			add: "first",
			add: "second",
		}};
		is( typeof pairs_got, "PairList", "PairList default returns a PairList" );
		is(
			pairs_got.kv(),
			[
				"keep", "left-one",
				"keep", "left-two",
				"child", [ "left" ],
				"add", "first",
				"add", "second",
			],
			"PairList default preserves left order and appends absent duplicates",
		);
		pairs_got{"child"}.push( "mutated" );
		is( pairs{"child"}, [ "left", "mutated" ], "PairList default shares values" );
		pairs_got.add( "later", 1 );
		is( pairs.exists( "later" ), 0, "PairList default copies the left PairList" );

		let null_got := null default {{ dup: 1, dup: 2 }};
		is( typeof null_got, "PairList", "null default returns a PairList" );
		is(
			null_got.kv(),
			[ "dup", 1, "dup", 2 ],
			"null default appends all PairList defaults",
		);

		let sorted_from_dict := {{ m: 13 }} default { z: 26, a: 1 };
		is(
			sorted_from_dict.kv(),
			[ "m", 13, "a", 1, "z", 26 ],
			"PairList default appends Dict defaults in sorted key order",
		);

		let chained := {{ a: 1 }} default {{ b: 2 }} default {{ b: 3, c: 4 }};
		is( chained.kv(), [ "a", 1, "b", 2, "c", 4 ], "default is left associative" );

		function named ( ... PairList opts ) {
			return opts;
		}

		let opts := {{ explicit: "left" }};
		let spread_got := named( ...opts default {
			explicit: "right",
			fallback: "value",
		} );
		is( spread_got{"explicit"}, "left", "spread default keeps left key" );
		is( spread_got{"fallback"}, "value", "spread default includes fallback key" );

		let integer_key_spread := named( ...({} default {
			"10": 10,
			"2": 2,
			a: 1,
		}) );
		is(
			integer_key_spread.keys(),
			[ "10", "2", "a" ],
			"spread default expands Dict integer-like keys in lexical order",
		);

		switch ( "x" ) {
			case "y": fail( "case should not run" );
			default: pass( "switch default remains a switch clause" );
		}

		like(
			exception( function() {
				let got := 23 default { a: 1 };
			} ),
			/default operator left operand expects Dict, PairList, or Null, got Number/,
			"invalid left operand throws a clear exception",
		);

		like(
			exception( function() {
				let got := { a: 1 } default 23;
			} ),
			/default operator right operand expects Dict or PairList, got Number/,
			"invalid right operand throws a clear exception",
		);

		like(
			exception( function() {
				let got := { a: 1 } default null;
			} ),
			/default operator right operand expects Dict or PairList, got Null/,
			"right null throws a clear exception",
		);

		done_testing();
	`, { filename: '/tmp/default-operator.zzs' } );

	assert.equal( result.status, 0, result.stderr );
	assert.match( result.stdout, /1\.\.21/u );
	assert.doesNotMatch( result.stdout, /^not ok/mu );
}
