'use strict';

const {
	bytesToBase64,
	bytesToHex,
	digestBytes,
	toBinary,
} = require( './_hash' );

function md5( value ) {
	return toBinary( digestBytes( 'md5', value, 'md5' ) );
}

function md5_hex( value ) {
	return bytesToHex( digestBytes( 'md5', value, 'md5_hex' ) );
}

function md5_b64( value ) {
	return bytesToBase64( digestBytes( 'md5', value, 'md5_b64' ) );
}

module.exports = {
	md5,
	md5_hex,
	md5_b64,
};
