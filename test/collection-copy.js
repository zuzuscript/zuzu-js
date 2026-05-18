'use strict';

const assert = require( 'node:assert/strict' );
const { ZuzuScript } = require( '../lib/zuzu' );
const {
	ZuzuBag,
	PairList,
	isWeakCell,
	makeWeakValue,
} = require( '../lib/runtime-helpers' );

function run( src ) {
	const runtime = new ZuzuScript();
	const result = runtime.runSource( src );
	assert.equal( result.status, 0, result.stderr );
	return result.stdout;
}

{
	const out = run( `
		from test/more import *;
		let shared := [ "seed" ];
		let array := [ 1, shared ];
		let array_copy := array.copy();
		ok( array_copy instanceof Array, "Array copy returns Array" );
		is( array_copy, array, "Array copy preserves values" );
		array_copy.push( 9 );
		is( length( array ), 2, "Array copy mutation leaves original length" );
		array_copy[1].push( "array" );
		is( shared, [ "seed", "array" ], "Array copy is shallow" );

		let bag := <<< 1, shared, 1 >>>;
		let bag_copy := bag.copy();
		ok( bag_copy instanceof Bag, "Bag copy returns Bag" );
		is( bag_copy.to_Array(), bag.to_Array(), "Bag copy preserves values" );
		bag_copy.add( 9 );
		is( bag.length(), 3, "Bag copy mutation leaves original length" );
		bag_copy.get( 1 ).push( "bag" );
		is( shared, [ "seed", "array", "bag" ], "Bag copy is shallow" );

		let set := [ 1, shared ].to_Set();
		let set_copy := set.copy();
		ok( set_copy instanceof Set, "Set copy returns Set" );
		is( set_copy.contains( 1 ), 1, "Set copy preserves scalar values" );
		is( set_copy.contains( shared ), 1, "Set copy preserves object values" );
		set_copy.push( 9 );
		is( set.contains( 9 ), 0, "Set copy mutation leaves original members" );

		let dict := { one: 1, nested: shared };
		let dict_copy := dict.copy();
		ok( dict_copy instanceof Dict, "Dict copy returns Dict" );
		is( dict_copy, dict, "Dict copy preserves values" );
		dict_copy{two} := 2;
		is( dict.exists( "two" ), 0, "Dict copy mutation leaves original keys" );
		dict_copy{nested}.push( "dict" );
		is( shared, [ "seed", "array", "bag", "dict" ], "Dict copy is shallow" );

		let pairs := new PairList(
			[ "dup", 1 ],
			[ "nested", shared ],
			[ "dup", 2 ],
		);
		let pairs_copy := pairs.copy();
		ok( pairs_copy instanceof PairList, "PairList copy returns PairList" );
		is(
			pairs_copy.keys(),
			[ "dup", "nested", "dup" ],
			"PairList copy keeps order and duplicate keys",
		);
		is( pairs_copy.values(), [ 1, shared, 2 ], "PairList copy preserves values" );
		pairs_copy.remove( "dup" );
		is( pairs.length(), 3, "PairList copy mutation leaves original length" );
		pairs_copy.get( "nested" ).push( "pairlist" );
		is(
			shared,
			[ "seed", "array", "bag", "dict", "pairlist" ],
			"PairList copy is shallow",
		);

		done_testing();
	` );
	for ( let i = 1; i <= 21; i++ ) {
		assert.match( out, new RegExp( `ok\\s+${i}\\b` ) );
	}
}

{
	const context = new ZuzuScript().buildContext( { filename: '<copy-weak-test>' } );
	const referent = { label: 'referent' };
	const weak = makeWeakValue( referent );

	const array = [ weak ];
	const arrayCopy = array.copy();
	assert.notEqual( arrayCopy, array );
	assert.equal( arrayCopy[0], weak );
	assert.equal( isWeakCell( arrayCopy[0] ), true );

	const bag = new ZuzuBag( [ weak ] );
	const bagCopy = bag.copy();
	assert.notEqual( bagCopy, bag );
	assert.equal( bagCopy.items[0], weak );
	assert.equal( isWeakCell( bagCopy.items[0] ), true );

	const set = new Set( [ weak ] );
	const setCopy = set.copy();
	assert.notEqual( setCopy, set );
	assert.equal( [ ...setCopy ][0], weak );
	assert.equal( isWeakCell( [ ...setCopy ][0] ), true );

	const dict = { owner: weak };
	const dictCopy = context.__zuzu_call_member( dict, 'copy' );
	assert.notEqual( dictCopy, dict );
	assert.equal( dictCopy.owner, weak );
	assert.equal( isWeakCell( dictCopy.owner ), true );

	const pairs = new PairList( [ [ 'owner', weak ] ] );
	const pairsCopy = pairs.copy();
	assert.notEqual( pairsCopy, pairs );
	assert.notEqual( pairsCopy.list[0], pairs.list[0] );
	assert.equal( pairsCopy.list[0][1], weak );
	assert.equal( isWeakCell( pairsCopy.list[0][1] ), true );
	pairsCopy.list[0][1] = 'changed';
	assert.equal( pairs.list[0][1], weak );
}
