'use strict';

const assert = require( 'node:assert/strict' );
const fs = require( 'node:fs' );
const path = require( 'node:path' );

const { BinaryString } = require( '../lib/runtime-helpers' );
const {
	SELF_DESCRIBED_TAG,
	byteString,
	bytesValue,
	decodeOne,
	encodeOne,
	isByteString,
	isTagged,
	isTextString,
	tag,
	tagNumber,
	tagValue,
	textString,
	textValue,
	validateProfile,
} = require( '../modules/std/marshal/cbor' );

const repoRoot = path.resolve( __dirname, '..', '..', '..' );
const fixtureDir = path.join( repoRoot, 't', 'fixtures', 'marshal', 'golden' );

function hex( value ) {
	const bytes = value instanceof BinaryString ? value.bytes : value;
	return Buffer.from( bytes ).toString( 'hex' );
}

function fixtureBinary( name ) {
	const b64 = fs.readFileSync( path.join( fixtureDir, `${name}.b64` ), 'utf8' )
		.trim();
	return new BinaryString( Buffer.from( b64, 'base64' ) );
}

{
	const envelope = tag( SELF_DESCRIBED_TAG, [
		textString( 'ZUZU-MARSHAL' ),
		1,
		new Map(),
		null,
		[],
		[],
	] );
	const blob = encodeOne( envelope );
	assert.ok( blob instanceof BinaryString );
	assert.equal(
		hex( blob ),
		'd9d9f7866c5a555a552d4d41525348414c01a0f68080'
	);

	const decoded = decodeOne( blob );
	assert.ok( isTagged( decoded ) );
	assert.equal( tagNumber( decoded ), SELF_DESCRIBED_TAG );
	const fields = tagValue( decoded );
	assert.ok( isTextString( fields[0] ) );
	assert.equal( textValue( fields[0] ), 'ZUZU-MARSHAL' );
	assert.equal( fields[1], 1 );
	assert.ok( fields[2] instanceof Map );
	assert.equal( fields[3], null );
	assert.deepEqual( fields[4], [] );
	assert.deepEqual( fields[5], [] );
}

{
	const scalarNull = fixtureBinary( 'scalar-null' );
	assert.ok( validateProfile( scalarNull ) );
	assert.equal( hex( scalarNull ).slice( 0, 6 ), 'd9d9f7' );
	const decoded = decodeOne( scalarNull );
	assert.ok( isTagged( decoded ) );
	assert.equal( tagNumber( decoded ), SELF_DESCRIBED_TAG );
	const envelope = tagValue( decoded );
	assert.equal( textValue( envelope[0] ), 'ZUZU-MARSHAL' );
	assert.equal( envelope[1], 1 );
	assert.equal( envelope[3], null );
	assert.deepEqual( envelope[4], [] );
	assert.deepEqual( envelope[5], [] );
}

{
	const roundtrip = decodeOne(
		encodeOne( byteString( new Uint8Array( [ 0x00, 0x01, 0xff ] ) ) )
	);
	assert.ok( isByteString( roundtrip ) );
	assert.equal( hex( bytesValue( roundtrip ) ), '0001ff' );
}

{
	const values = decodeOne( encodeOne( [
		textString( 'cafe' ),
		byteString( [ 0x41, 0x42, 0x43 ] ),
		3.25,
		-0,
	] ) );
	assert.ok( isTextString( values[0] ) );
	assert.equal( textValue( values[0] ), 'cafe' );
	assert.ok( isByteString( values[1] ) );
	assert.equal( hex( bytesValue( values[1] ) ), '414243' );
	assert.equal( values[2], 3.25 );
	assert.ok( Object.is( values[3], -0 ) );
	assert.equal(
		hex( encodeOne( -0 ) ),
		'fb8000000000000000',
		'negative zero encodes as binary64'
	);
}

assert.throws(
	() => decodeOne( new BinaryString( [ 0xf6, 0x00 ] ) ),
	/trailing bytes/
);
assert.throws(
	() => decodeOne( new BinaryString( [ 0x18, 0x01 ] ) ),
	/non-shortest/
);
assert.throws(
	() => decodeOne( new BinaryString( [ 0x81, 0xd9, 0xd9, 0xf7, 0x61, 0x78 ] ) ),
	/unsupported tag 55799/
);

console.log( 'std/marshal CBOR adapter tests passed' );
