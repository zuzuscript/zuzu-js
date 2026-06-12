'use strict';

const PI = Math.PI;

function normalizeNumberArgs( values ) {
	if ( values.length === 1 && Array.isArray( values[0] ) ) {
		return values[0];
	}
	return values;
}

const ZMath = {
	pi() { return PI; },
	sin( value ) { return Math.sin( Number( value ?? 0 ) ); },
	cos( value ) { return Math.cos( Number( value ?? 0 ) ); },
	tan( value ) { return Math.tan( Number( value ?? 0 ) ); },
	asin( value ) { return Math.asin( Number( value ?? 0 ) ); },
	acos( value ) { return Math.acos( Number( value ?? 0 ) ); },
	atan( value ) { return Math.atan( Number( value ?? 0 ) ); },
	atan2( y, x ) { return Math.atan2( Number( y ?? 0 ), Number( x ?? 0 ) ); },
	pow( base, exp ) { return Math.pow( Number( base ?? 0 ), Number( exp ?? 0 ) ); },
	exp( value ) { return Math.exp( Number( value ?? 0 ) ); },
	log( value ) { return Math.log( Number( value ?? 0 ) ); },
	log10( value ) { return Math.log10( Number( value ?? 0 ) ); },
	min( ...values ) { return Math.min( ...normalizeNumberArgs( values ).map( Number ) ); },
	max( ...values ) { return Math.max( ...normalizeNumberArgs( values ).map( Number ) ); },
	sum( ...values ) { return normalizeNumberArgs( values ).map( Number ).reduce( ( acc, v ) => acc + v, 0 ); },
	clamp( value, low, high ) {
		return Math.min( Number( high ?? 0 ), Math.max( Number( low ?? 0 ), Number( value ?? 0 ) ) );
	},
	hypot( ...values ) { return Math.hypot( ...values.map( Number ) ); },
	deg2rad( degrees ) { return Number( degrees ?? 0 ) * ( PI / 180 ); },
	rad2deg( radians ) { return Number( radians ?? 0 ) * ( 180 / PI ); },
	rand() { return Math.random(); },
	hex2dec( value ) { return convertBase( value, 16, 10 ); },
	hex2oct( value ) { return convertBase( value, 16, 8 ); },
	hex2bin( value ) { return convertBase( value, 16, 2 ); },
	dec2hex( value ) { return convertBase( value, 10, 16 ); },
	dec2oct( value ) { return convertBase( value, 10, 8 ); },
	dec2bin( value ) { return convertBase( value, 10, 2 ); },
	oct2hex( value ) { return convertBase( value, 8, 16 ); },
	oct2dec( value ) { return convertBase( value, 8, 10 ); },
	oct2bin( value ) { return convertBase( value, 8, 2 ); },
	bin2hex( value ) { return convertBase( value, 2, 16 ); },
	bin2dec( value ) { return convertBase( value, 2, 10 ); },
	bin2oct( value ) { return convertBase( value, 2, 8 ); },
};

function normalizeDigits( value, base ) {
	let text = String( value ?? '' ).trim().toLowerCase();
	if ( base === 16 ) {
		text = text.replace( /^0x/u, '' );
	}
	else if ( base === 8 ) {
		text = text.replace( /^0o/u, '' );
	}
	else if ( base === 2 ) {
		text = text.replace( /^0b/u, '' );
	}
	return text;
}

function convertBase( value, fromBase, toBase ) {
	const text = normalizeDigits( value, fromBase );
	if ( text === '' ) {
		return '0';
	}
	const num = Number.parseInt( text, fromBase );
	if ( Number.isNaN( num ) ) {
		return '0';
	}
	return num.toString( toBase );
}

module.exports = {
	Math: ZMath,
	pi: PI,
	π: PI,
};
