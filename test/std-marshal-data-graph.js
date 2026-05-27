'use strict';

const assert = require( 'node:assert/strict' );
const fs = require( 'node:fs' );
const path = require( 'node:path' );
const projectPaths = require( '../lib/paths' );

const marshal = require( '../modules/std/marshal' );
const {
	BinaryString,
	Pair,
	PairList,
	ZuzuBag,
} = require( '../lib/runtime-helpers' );
const { Time } = require( '../modules/std/time' );
const { Path } = require( '../modules/std/io' );

const repoRoot = projectPaths.projectRoot;
const fixtureDir = path.join( projectPaths.stdlibFixtureRoot, 'marshal' );
const goldenDir = path.join( fixtureDir, 'golden' );

function base64( blob ) {
	return Buffer.from( blob.bytes ).toString( 'base64' );
}

function golden( name ) {
	return fs.readFileSync( path.join( goldenDir, `${name}.b64` ), 'utf8' )
		.trim();
}

function binaryFromBase64( text ) {
	return new BinaryString( Buffer.from( text, 'base64' ) );
}

assert.equal( base64( marshal.dump( null ) ), golden( 'scalar-null' ) );
assert.equal( marshal.load( binaryFromBase64( golden( 'scalar-null' ) ) ), null );

{
	const array = [];
	array.push( array );
	assert.equal( base64( marshal.dump( array ) ), golden( 'array-cycle' ) );

	const loaded = marshal.load( binaryFromBase64( golden( 'array-cycle' ) ) );
	assert.ok( Array.isArray( loaded ) );
	assert.equal( loaded[0], loaded );
}

{
	const pairList = new PairList( [
		[ 'foo', 1 ],
		[ 'bar', 2 ],
		[ 'foo', 3 ],
	] );
	const value = [
		{ beta: 2, alpha: 1 },
		pairList,
	];
	assert.equal( base64( marshal.dump( value ) ), golden( 'dict-pairlist' ) );

	const loaded = marshal.load( binaryFromBase64( golden( 'dict-pairlist' ) ) );
	assert.equal( loaded[0].alpha, 1 );
	assert.equal( loaded[0].beta, 2 );
	assert.ok( loaded[1] instanceof PairList );
	assert.deepEqual( loaded[1].list, [
		[ 'foo', 1 ],
		[ 'bar', 2 ],
		[ 'foo', 3 ],
	] );
}

{
	const value = [
		new Time( 12345 ),
		new Path( 'tmp/../file.txt' ),
	];
	assert.equal( base64( marshal.dump( value ) ), golden( 'time-path' ) );

	const loaded = marshal.load( binaryFromBase64( golden( 'time-path' ) ) );
	assert.ok( loaded[0] instanceof Time );
	assert.equal( loaded[0].epoch(), 12345 );
	assert.ok( loaded[1] instanceof Path );
	assert.equal( loaded[1].to_String(), 'tmp/../file.txt' );
}

{
	const shared = [ 'shared' ];
	const loaded = marshal.load( marshal.dump( [ shared, shared ] ) );
	assert.equal( loaded[0], loaded[1] );
}

{
	const loaded = marshal.load( marshal.dump( [
		new BinaryString( [ 0x41, 0x42 ] ),
		new Set( [ 1, 1, 2 ] ),
		new ZuzuBag( [ 1, 1, 2 ] ),
		new Pair( { pair: [ 7, [ 'value' ] ] } ),
	] ) );
	assert.ok( loaded[0] instanceof BinaryString );
	assert.equal( loaded[0].to_String(), 'AB' );
	assert.ok( loaded[1] instanceof Set );
	assert.equal( loaded[1].size, 2 );
	assert.ok( loaded[2] instanceof ZuzuBag );
	assert.equal( loaded[2].count( 1 ), 2 );
	assert.ok( loaded[3] instanceof Pair );
	assert.equal( loaded[3].key(), '7' );
	assert.equal( loaded[3].value()[0], 'value' );
}

{
	const weak = JSON.parse(
		fs.readFileSync( path.join( fixtureDir, 'weak-records.json' ), 'utf8' )
	);
	const supported = new Set( [
		'strong-only-nested-array',
		'weak-root-null',
		'weak-array-null',
		'weak-array-nested-weak',
		'weak-array-bad-arity',
		'weak-dict-scalar',
		'weak-pairlist-scalar',
		'weak-set-reference',
		'weak-bag-bad-id',
		'weak-object-slot',
	] );
	for ( const fixture of weak.fixtures ) {
		if ( !supported.has( fixture.name ) ) {
			continue;
		}
		const blob = binaryFromBase64( fixture.base64 );
		if ( fixture.expect === 'loads' ) {
			assert.doesNotThrow( () => marshal.load( blob ), fixture.name );
			continue;
		}
		assert.throws(
			() => marshal.load( blob ),
			/weak storage record|Reference id|array must/,
			fixture.name
		);
	}
}

assert.equal( marshal.safe_to_dump( [ null, { a: 1 } ] ), true );
assert.equal( marshal.safe_to_dump( function unsupported() {} ), false );

console.log( 'std/marshal data graph tests passed' );
