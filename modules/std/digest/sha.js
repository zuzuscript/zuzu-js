'use strict';

const {
	bytesToBase64,
	bytesToHex,
	digestBytes,
	hmacBytes,
	toBinary,
} = require( './_hash' );

function digestFn( algorithm, fnName ) {
	return ( value ) => {
		return toBinary( digestBytes( algorithm, value, fnName ) );
	};
}

function digestHexFn( algorithm, fnName ) {
	return ( value ) => {
		return bytesToHex( digestBytes( algorithm, value, fnName ) );
	};
}

function digestB64Fn( algorithm, fnName ) {
	return ( value ) => {
		return bytesToBase64( digestBytes( algorithm, value, fnName ) );
	};
}

function hmacFn( algorithm, fnName ) {
	return ( value, key ) => {
		return toBinary( hmacBytes( algorithm, value, key, fnName ) );
	};
}

function hmacHexFn( algorithm, fnName ) {
	return ( value, key ) => {
		return bytesToHex( hmacBytes( algorithm, value, key, fnName ) );
	};
}

function hmacB64Fn( algorithm, fnName ) {
	return ( value, key ) => {
		return bytesToBase64( hmacBytes( algorithm, value, key, fnName ) );
	};
}

module.exports = {
	sha1: digestFn( 'sha1', 'sha1' ),
	sha224: digestFn( 'sha224', 'sha224' ),
	sha256: digestFn( 'sha256', 'sha256' ),
	sha384: digestFn( 'sha384', 'sha384' ),
	sha512: digestFn( 'sha512', 'sha512' ),
	sha1_hex: digestHexFn( 'sha1', 'sha1_hex' ),
	sha224_hex: digestHexFn( 'sha224', 'sha224_hex' ),
	sha256_hex: digestHexFn( 'sha256', 'sha256_hex' ),
	sha384_hex: digestHexFn( 'sha384', 'sha384_hex' ),
	sha512_hex: digestHexFn( 'sha512', 'sha512_hex' ),
	sha1_b64: digestB64Fn( 'sha1', 'sha1_b64' ),
	sha256_b64: digestB64Fn( 'sha256', 'sha256_b64' ),
	sha512_b64: digestB64Fn( 'sha512', 'sha512_b64' ),
	hmac_sha1: hmacFn( 'sha1', 'hmac_sha1' ),
	hmac_sha224: hmacFn( 'sha224', 'hmac_sha224' ),
	hmac_sha256: hmacFn( 'sha256', 'hmac_sha256' ),
	hmac_sha384: hmacFn( 'sha384', 'hmac_sha384' ),
	hmac_sha512: hmacFn( 'sha512', 'hmac_sha512' ),
	hmac_sha1_hex: hmacHexFn( 'sha1', 'hmac_sha1_hex' ),
	hmac_sha224_hex: hmacHexFn( 'sha224', 'hmac_sha224_hex' ),
	hmac_sha256_hex: hmacHexFn( 'sha256', 'hmac_sha256_hex' ),
	hmac_sha384_hex: hmacHexFn( 'sha384', 'hmac_sha384_hex' ),
	hmac_sha512_hex: hmacHexFn( 'sha512', 'hmac_sha512_hex' ),
	hmac_sha256_b64: hmacB64Fn( 'sha256', 'hmac_sha256_b64' ),
};
