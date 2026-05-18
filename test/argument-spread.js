'use strict';

const assert = require( 'node:assert/strict' );
const { ZuzuScript } = require( '../lib/zuzu' );

const runtime = new ZuzuScript( { transpiler: 'new-only' } );
const result = runtime.runSource( `
	from test/more import *;

	function collect ( first, second, ... rest ) {
		return first _ ":" _ second _ ":" _ rest.join( "," );
	}

	function inspect_named ( first, ... PairList named ) {
		return first _ ":" _ named.keys().join( "," ) _ ":"
			_ named.values().join( "," );
	}

	function duplicate_values ( ... PairList named ) {
		return named.get_all( "x" ).join( "," );
	}

	function collect_all ( ... rest ) {
		return rest.join( "," );
	}

	is(
		collect( "a", ...[ "b", "c", "d" ] ),
		"a:b:c,d",
		"array argument spread expands positional arguments",
	);

	is(
		inspect_named( "a", ...{ x: "b" }, y: "c" ),
		"a:x,y:b,c",
		"dict argument spread expands named arguments",
	);

	is(
		duplicate_values( ...{{ x: 1, x: 2 }} ),
		"1,2",
		"pairlist argument spread preserves order and duplicate keys",
	);

	let seen := [];
	function mark ( label, value ) {
		seen.append( label );
		return value;
	}

	is(
		inspect_named(
			mark( "a", "first" ),
			...mark( "b", { one: 1 } ),
			two: mark( "c", 2 ),
			...mark( "d", {{ three: 3 }} ),
		),
		"first:one,two,three:1,2,3",
		"spread operands evaluate left-to-right",
	);
	is( seen.join( "" ), "abcd", "argument expression order is left-to-right" );

	class Joiner {
		method pair ( left, right ) {
			return left _ right;
		}
	}

	let method_name := "pair";
	let joiner := new Joiner();
	is( joiner.pair( ...[ "m", "n" ] ), "mn", "method call supports spread" );
	is(
		joiner.(method_name)( ...[ "d", "y" ] ),
		"dy",
		"dynamic member call supports spread",
	);

	class Person {
		let name;

		method get_name () {
			return name;
		}
	}

	let person := new Person( ...{ name: "Ada" } );
	is( person.get_name(), "Ada", "constructor call supports spread" );

	let arr := [ "a" ];
	function mutate_array () {
		arr.append( "b" );
		return "c";
	}
	is(
		collect_all( ...arr, mutate_array() ),
		"a,c",
		"array spread snapshots before later argument mutation",
	);

	let dict := { x: "a" };
	function mutate_dict () {
		dict{y} := "b";
		return "c";
	}
	is(
		inspect_named( "first", ...dict, tail: mutate_dict() ),
		"first:x,tail:a,c",
		"dict spread snapshots before later argument mutation",
	);

	let pairs := {{ x: "a" }};
	function mutate_pairlist () {
		pairs.add( "x", "b" );
		return "c";
	}
	is(
		duplicate_values( ...pairs, x: mutate_pairlist() ),
		"a,c",
		"pairlist spread snapshots before later argument mutation",
	);

	like(
		exception( function() {
			collect( ...42 );
		} ),
		/argument spread expects Array, Dict, or PairList, got Number/,
		"invalid spread operand throws a clear exception",
	);

	done_testing();
`, { filename: '/tmp/argument-spread.zzs' } );

assert.equal( result.status, 0, result.stderr );
assert.match( result.stdout, /1\.\.12/u );
assert.doesNotMatch( result.stdout, /^not ok/mu );
