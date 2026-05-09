'use strict';

const assert = require( 'node:assert/strict' );
const {
	BinaryString,
	Pair,
	PairList,
	ZuzuBag,
	isWeakCell,
	retainValue,
	releaseValue,
} = require( '../lib/runtime-helpers' );
const {
	isWeakableValue,
	makeWeakValue,
	resolveWeakValue,
} = require( '../lib/zuzu' );

function assertScalar( value, label ) {
	assert.equal( isWeakableValue( value ), false, `${label} is scalar` );
	const weak = makeWeakValue( value );
	assert.equal( isWeakCell( weak ), true, `${label} can be stored in a weak slot` );
	assert.equal( resolveWeakValue( weak ), value, `${label} weak slot resolves unchanged` );
	assert.equal( resolveWeakValue( value ), value, `${label} resolves unchanged` );
}

function assertWeakable( value, label ) {
	assert.equal( isWeakableValue( value ), true, `${label} is weakable` );
	retainValue( value );
	const weak = makeWeakValue( value );
	assert.equal( isWeakCell( weak ), true, `${label} weak storage returns a cell` );
	assert.equal( resolveWeakValue( weak ), value, `${label} resolves while retained` );
	releaseValue( value );
	assert.equal( resolveWeakValue( weak ), null, `${label} resolves to null after release` );
	assert.equal( resolveWeakValue( value ), value, `${label} resolves unchanged` );
}

class ExampleObject {}

const method = function method() {};
method.__zuzu_method = true;

assertScalar( null, 'null' );
assertScalar( true, 'boolean primitive' );
assertScalar( false, 'false primitive' );
assertScalar( 42, 'number primitive' );
assertScalar( 'hello', 'string primitive' );
assertScalar( new Boolean( true ), 'boolean object' );
assertScalar( new Number( 42 ), 'number object' );
assertScalar( new String( 'hello' ), 'string object' );
assertScalar( new BinaryString( [ 0x61, 0x62 ] ), 'binary string' );
assertScalar( /zuzu/u, 'regular expression' );

assertWeakable( [], 'array' );
assertWeakable( new ZuzuBag( [ 'a' ] ), 'bag' );
assertWeakable( new Set( [ 'a' ] ), 'set' );
assertWeakable( {}, 'dict' );
assertWeakable( new PairList( [ [ 'key', 'value' ] ] ), 'pairlist' );
assertWeakable( new Pair( { pair: [ 'key', 'value' ] } ), 'pair' );
assertWeakable( function callback() {}, 'function' );
assertWeakable( method, 'method' );
assertWeakable( ExampleObject, 'class' );
assertWeakable( new ExampleObject(), 'object' );
assertWeakable( [][Symbol.iterator](), 'iterator' );
