'use strict';

const { BinaryString } = require( '../../lib/runtime-helpers' );
const taskRuntime = require( './task' );
const { digestBytes, hmacBytes } = require( './digest/_hash' );
const { Time } = require( './time' );

const BASE64URL = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
const MAX_SAFE_INT = 9007199254740992;
const RANDOM_CAPABILITIES = new Set( [ 'bytes', 'token', 'int' ] );
const KDF_CAPABILITIES = new Set( [ 'hkdf-sha256' ] );
const CIPHER_CAPABILITIES = new Set( [
	'aes-256-gcm',
	'chacha20-poly1305',
] );
const BROWSER_CIPHER_CAPABILITIES = new Set( [ 'aes-256-gcm' ] );
const KEY_AGREEMENT_CAPABILITIES = new Set( [ 'x25519' ] );
const CERTIFICATE_CAPABILITIES = new Set( [
	'parse-x509',
	'parse-x509-der',
	'fingerprint-sha256',
	'public-key',
	'verify-chain',
] );
const BROWSER_CERTIFICATE_CAPABILITIES = new Set( [
	'parse-x509-der',
	'fingerprint-sha256',
] );
const TLS_IDENTITY_CAPABILITIES = new Set( [ 'pem', 'pkcs12' ] );
const BROWSER_TLS_IDENTITY_CAPABILITIES = new Set( [ 'pem' ] );
const SIGNING_CAPABILITIES = new Set( [
	'ed25519',
	'ecdsa-p256-sha256',
	'ecdsa-p384-sha384',
] );
const SIGNING_ALGORITHMS = {
	ed25519: {
		type: 'ed25519',
		privateLength: 32,
		publicLength: 32,
	},
	'ecdsa-p256-sha256': {
		type: 'ecdsa',
		privateLength: 32,
		publicLength: 65,
		signatureLength: 64,
		nodeCurve: 'prime256v1',
		webCurve: 'P-256',
		jwkCurve: 'P-256',
		nodeHash: 'sha256',
		webHash: 'SHA-256',
	},
	'ecdsa-p384-sha384': {
		type: 'ecdsa',
		privateLength: 48,
		publicLength: 97,
		signatureLength: 96,
		nodeCurve: 'secp384r1',
		webCurve: 'P-384',
		jwkCurve: 'P-384',
		nodeHash: 'sha384',
		webHash: 'SHA-384',
	},
};
const KEY_AGREEMENT_ALGORITHMS = {
	x25519: {
		privateLength: 32,
		publicLength: 32,
	},
};
const DEFAULT_PASSWORD_HASH_ALGORITHM = 'pbkdf2-sha256';
const HKDF_SHA256_HASH_LENGTH = 32;
const HKDF_SHA256_MAX_LENGTH = 255 * HKDF_SHA256_HASH_LENGTH;
const CIPHER_ALGORITHMS = {
	'aes-256-gcm': {
		keyLength: 32,
		nonceLength: 12,
		tagLength: 16,
		nodeName: 'aes-256-gcm',
		webName: 'AES-GCM',
	},
	'chacha20-poly1305': {
		keyLength: 32,
		nonceLength: 12,
		tagLength: 16,
		nodeName: 'chacha20-poly1305',
		webName: null,
	},
};
const PASSWORD_HASH_SALT_LENGTH = 16;
const PASSWORD_HASH_LENGTH = 32;
const PBKDF2_SHA256_ITERATIONS = 600000;
const SCRYPT_LOG_N = 17;
const SCRYPT_R = 8;
const SCRYPT_P = 1;

let runtimePolicy = {
	host_name: 'node',
};

function setRuntimePolicy( policy = {} ) {
	runtimePolicy = {
		...runtimePolicy,
		...policy,
	};
}

function capabilities() {
	return {
		host: hostName(),
		random: hasRandomSource(),
		password_hash: passwordHashCapabilities(),
		kdf: [ ...KDF_CAPABILITIES ],
		cipher: cipherCapabilities(),
		key_agreement: keyAgreementCapabilities(),
		signing: signingCapabilities(),
		certificate: certificateCapabilities(),
		tls_identity: tlsIdentityCapabilities(),
		async_required: {
			cipher: hostName() === 'browser',
			kdf: false,
			password_hash: hostName() === 'browser',
			signing: hostName() === 'browser',
			key_agreement: hostName() === 'browser'
				&& keyAgreementCapabilities().length > 0,
		},
	};
}

function hostName() {
	return runtimePolicy.host_name || 'node';
}

function capabilityPart( value ) {
	return value == null ? '' : String( value );
}

function passwordHashCapabilities() {
	return hostName() === 'browser'
		? [ 'pbkdf2-sha256' ]
		: [ 'pbkdf2-sha256', 'scrypt' ];
}

function signingCapabilities() {
	if ( hostName() === 'browser' ) {
		return [ 'ecdsa-p256-sha256', 'ecdsa-p384-sha384' ];
	}
	return [ ...SIGNING_CAPABILITIES ];
}

function keyAgreementCapabilities() {
	if ( hostName() === 'browser' ) {
		return subtleKeyAgreementCrypto() ? [ 'x25519' ] : [];
	}
	const crypto = nodeCrypto();
	return crypto
		&& typeof crypto.generateKeyPairSync === 'function'
		&& typeof crypto.diffieHellman === 'function'
		? [ ...KEY_AGREEMENT_CAPABILITIES ]
		: [];
}

function cipherCapabilities() {
	if ( hostName() === 'browser' ) {
		return [ ...BROWSER_CIPHER_CAPABILITIES ];
	}

	const crypto = nodeCrypto();
	if ( !crypto || typeof crypto.getCiphers !== 'function' ) {
		return [];
	}

	const supported = new Set( crypto.getCiphers() );
	return [ ...CIPHER_CAPABILITIES ].filter( ( algorithm ) => {
		const meta = CIPHER_ALGORITHMS[algorithm];
		return meta && supported.has( meta.nodeName );
	} );
}

function certificateCapabilities() {
	return hostName() === 'browser'
		? [ ...BROWSER_CERTIFICATE_CAPABILITIES ]
		: [ ...CERTIFICATE_CAPABILITIES ];
}

function tlsIdentityCapabilities() {
	return hostName() === 'browser'
		? [ ...BROWSER_TLS_IDENTITY_CAPABILITIES ]
		: [ ...TLS_IDENTITY_CAPABILITIES ];
}

function hasCapability( area, name ) {
	area = capabilityPart( area );
	name = capabilityPart( name );
	if ( area === 'random' ) {
		return hasRandomSource() && RANDOM_CAPABILITIES.has( name );
	}
	if ( area === 'password_hash' ) {
		return passwordHashCapabilities().includes( name );
	}
	if ( area === 'kdf' ) {
		return KDF_CAPABILITIES.has( name );
	}
	if ( area === 'cipher' ) {
		return cipherCapabilities().includes( name );
	}
	if ( area === 'key_agreement' ) {
		return keyAgreementCapabilities().includes( name );
	}
	if ( area === 'signing' ) {
		return signingCapabilities().includes( name );
	}
	if ( area === 'certificate' ) {
		return certificateCapabilities().includes( name );
	}
	if ( area === 'tls_identity' ) {
		return tlsIdentityCapabilities().includes( name );
	}
	return false;
}

function requireCapability( area, name ) {
	area = capabilityPart( area );
	name = capabilityPart( name );
	if ( hasCapability( area, name ) ) {
		return true;
	}
	throw new Error(
		`Secure capability '${area}/${name}' is not available on host '${hostName()}'`
	);
}

function hasRandomSource() {
	if (
		globalThis.crypto
		&& typeof globalThis.crypto.getRandomValues === 'function'
	) {
		return true;
	}
	const crypto = nodeCrypto();
	return !!( crypto && typeof crypto.randomBytes === 'function' );
}

function nodeCrypto() {
	if ( typeof require !== 'function' ) {
		return null;
	}
	try {
		return require( 'node:crypto' );
	}
	catch ( _err ) {
		return null;
	}
}

function nodeForge() {
	if ( hostName() === 'browser' || typeof require !== 'function' ) {
		return null;
	}
	try {
		const nodeRequire = eval( 'require' );
		return nodeRequire( 'node-forge' );
	}
	catch ( _err ) {
		return null;
	}
}

function nodeTls() {
	if ( hostName() === 'browser' || typeof require !== 'function' ) {
		return null;
	}
	try {
		const nodeRequire = eval( 'require' );
		return nodeRequire( 'node:tls' );
	}
	catch ( _err ) {
		return null;
	}
}

function fillRandom( bytes ) {
	if (
		globalThis.crypto
		&& typeof globalThis.crypto.getRandomValues === 'function'
	) {
		for ( let offset = 0; offset < bytes.length; offset += 65536 ) {
			globalThis.crypto.getRandomValues(
				bytes.subarray( offset, Math.min( offset + 65536, bytes.length ) )
			);
		}
		return bytes;
	}
	const crypto = nodeCrypto();
	if ( crypto && typeof crypto.randomBytes === 'function' ) {
		bytes.set( crypto.randomBytes( bytes.length ) );
		return bytes;
	}
	throw new Error( 'Secure random source is unavailable' );
}

function nonNegativeInteger( value, label ) {
	const number = Number( value ?? 0 );
	if ( !Number.isInteger( number ) || number < 0 ) {
		throw new Error( `${label} expects a non-negative integer` );
	}
	return number;
}

function positiveInteger( value, label ) {
	const number = Number( value ?? 0 );
	if ( !Number.isInteger( number ) || number <= 0 ) {
		throw new Error( `${label} expects a positive integer` );
	}
	if ( number > MAX_SAFE_INT ) {
		throw new Error( `${label} maximum is too large` );
	}
	return number;
}

function randomBytes( length ) {
	return fillRandom( new Uint8Array( length ) );
}

function base64url( bytes ) {
	let out = '';
	for ( let i = 0; i < bytes.length; i += 3 ) {
		const b0 = bytes[i];
		const b1 = i + 1 < bytes.length ? bytes[i + 1] : 0;
		const b2 = i + 2 < bytes.length ? bytes[i + 2] : 0;
		const triple = ( b0 << 16 ) | ( b1 << 8 ) | b2;

		out += BASE64URL[( triple >> 18 ) & 0x3f];
		out += BASE64URL[( triple >> 12 ) & 0x3f];
		if ( i + 1 < bytes.length ) {
			out += BASE64URL[( triple >> 6 ) & 0x3f];
		}
		if ( i + 2 < bytes.length ) {
			out += BASE64URL[triple & 0x3f];
		}
	}
	return out;
}

function base64urlDecode( text ) {
	if ( typeof text !== 'string' || /[^A-Za-z0-9_-]/u.test( text ) ) {
		return null;
	}
	const alphabet = new Map( BASE64URL.split( '' ).map(
		( value, index ) => [ value, index ]
	) );
	const out = [];
	let bits = 0;
	let bitLength = 0;
	for ( const char of text ) {
		bits = ( bits << 6 ) | alphabet.get( char );
		bitLength += 6;
		while ( bitLength >= 8 ) {
			bitLength -= 8;
			out.push( ( bits >> bitLength ) & 0xff );
		}
	}
	if ( bitLength > 0 && ( bits & ( ( 1 << bitLength ) - 1 ) ) !== 0 ) {
		return null;
	}
	return Uint8Array.from( out );
}

function base64( bytes ) {
	const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
	let out = '';
	for ( let i = 0; i < bytes.length; i += 3 ) {
		const b0 = bytes[i];
		const b1 = i + 1 < bytes.length ? bytes[i + 1] : 0;
		const b2 = i + 2 < bytes.length ? bytes[i + 2] : 0;
		const triple = ( b0 << 16 ) | ( b1 << 8 ) | b2;

		out += alphabet[( triple >> 18 ) & 0x3f];
		out += alphabet[( triple >> 12 ) & 0x3f];
		out += i + 1 < bytes.length ? alphabet[( triple >> 6 ) & 0x3f] : '=';
		out += i + 2 < bytes.length ? alphabet[triple & 0x3f] : '=';
	}
	return out;
}

function base64Decode( text ) {
	if ( typeof text !== 'string' || /[^A-Za-z0-9+/=]/u.test( text ) ) {
		return null;
	}
	const clean = text.replace( /=+$/u, '' );
	const alphabet = new Map(
		'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
			.split( '' )
			.map( ( value, index ) => [ value, index ] )
	);
	const out = [];
	let bits = 0;
	let bitLength = 0;
	for ( const char of clean ) {
		if ( !alphabet.has( char ) ) {
			return null;
		}
		bits = ( bits << 6 ) | alphabet.get( char );
		bitLength += 6;
		while ( bitLength >= 8 ) {
			bitLength -= 8;
			out.push( ( bits >> bitLength ) & 0xff );
		}
	}
	return Uint8Array.from( out );
}

function pemToDer( pem, label ) {
	const text = assertString( pem, label, 'String key' );
	const body = text
		.replace( /-----BEGIN [^-]+-----/gu, '' )
		.replace( /-----END [^-]+-----/gu, '' )
		.replace( /\s+/gu, '' );
	const bytes = base64Decode( body );
	if ( !bytes ) {
		throw new Error( `${label} expects PEM key text` );
	}
	return bytes;
}

function derToPem( label, der ) {
	const encoded = base64( der );
	const lines = [];
	for ( let i = 0; i < encoded.length; i += 64 ) {
		lines.push( encoded.slice( i, i + 64 ) );
	}
	return `-----BEGIN ${label}-----\n${lines.join( '\n' )}\n-----END ${label}-----\n`;
}

function certificateDerToPem( der ) {
	return derToPem( 'CERTIFICATE', der );
}

function certificatePemBlocks( pem, label ) {
	const text = assertString( pem, label, 'String pem' );
	const blocks = [];
	const re = /-----BEGIN CERTIFICATE-----([^-]*)-----END CERTIFICATE-----/gu;
	let match;
	while ( ( match = re.exec( text ) ) ) {
		const bytes = base64Decode( match[1].replace( /\s+/gu, '' ) );
		if ( !bytes ) {
			throw new Error( `${label} expects PEM certificate text` );
		}
		blocks.push( bytes );
	}
	if ( blocks.length === 0 ) {
		throw new Error( `${label} expects PEM certificate text` );
	}
	return blocks;
}

function randomInt( max ) {
	if ( max === 1 ) {
		return 0;
	}
	const space = 2 ** 56;
	const limit = space - ( space % max );
	while ( true ) {
		const bytes = randomBytes( 7 );
		let value = 0;
		for ( const byte of bytes ) {
			value = value * 256 + byte;
		}
		if ( value < limit ) {
			return value % max;
		}
	}
}

function typeName( value ) {
	if ( value == null ) {
		return 'Null';
	}
	if ( value && value.bytes instanceof Uint8Array ) {
		return 'BinaryString';
	}
	if ( typeof value === 'string' ) {
		return 'String';
	}
	return value.constructor && value.constructor.name ? value.constructor.name : typeof value;
}

function isPlainObject( value ) {
	return value != null
		&& typeof value === 'object'
		&& !Array.isArray( value )
		&& !( value.bytes instanceof Uint8Array );
}

function assertBinaryString( value, label, argName = 'BinaryString' ) {
	if ( value && value.bytes instanceof Uint8Array ) {
		return value.bytes;
	}
	throw new Error(
		`TypeException: ${label} expects ${argName}, got ${typeName( value )}`
	);
}

function optionalBinaryString( value, label, argName ) {
	if ( value == null ) {
		return new Uint8Array( 0 );
	}
	return assertBinaryString( value, label, argName );
}

function optionalDict( value, label, argName = 'Dict' ) {
	if ( value == null ) {
		return {};
	}
	if ( isPlainObject( value ) ) {
		return value;
	}
	throw new Error(
		`TypeException: ${label} expects ${argName}, got ${typeName( value )}`
	);
}

function assertString( value, label, argName = 'String' ) {
	if ( typeof value === 'string' ) {
		return value;
	}
	throw new Error(
		`TypeException: ${label} expects ${argName}, got ${typeName( value )}`
	);
}

function cipherAlgorithm( value, label ) {
	const algorithm = value == null ? 'aes-256-gcm' : String( value );
	if (
		!CIPHER_ALGORITHMS[algorithm]
		|| !cipherCapabilities().includes( algorithm )
	) {
		throw new Error( `${label} cipher algorithm '${algorithm}' is not available` );
	}
	return algorithm;
}

function cipherOptions( value, label ) {
	const options = optionalDict( value, label, 'Dict options' );
	const algorithmValue = options.algorithm;
	return {
		algorithm: cipherAlgorithm( algorithmValue, label ),
		algorithmSupplied: algorithmValue != null,
		aad: optionalBinaryString( options.aad, label, 'BinaryString aad' ),
	};
}

function cipherMeta( algorithm ) {
	return CIPHER_ALGORITHMS[algorithm];
}

function cipherKey( value, label, meta ) {
	const key = assertBinaryString( value, label, 'BinaryString key' );
	if ( key.length !== meta.keyLength ) {
		throw new Error( `${label} expects a ${meta.keyLength}-byte key` );
	}
	return key;
}

function envelopeBytes( envelope, field, label, length = null ) {
	const bytes = assertBinaryString(
		envelope[field],
		label,
		`BinaryString envelope.${field}`
	);
	if ( length != null && bytes.length !== length ) {
		throw new Error( `${label} expects envelope.${field} to be ${length} bytes` );
	}
	return bytes;
}

function cipherEnvelope( value, label ) {
	const envelope = optionalDict( value, label, 'Dict envelope' );
	if ( envelope.version !== 1 ) {
		throw new Error( `${label} expects envelope.version 1` );
	}
	const algorithm = cipherAlgorithm( envelope.algorithm, label );
	const meta = cipherMeta( algorithm );
	return {
		algorithm,
		nonce: envelopeBytes( envelope, 'nonce', label, meta.nonceLength ),
		ciphertext: envelopeBytes( envelope, 'ciphertext', label ),
		tag: envelopeBytes( envelope, 'tag', label, meta.tagLength ),
	};
}

function cipherEnvelopeValue( algorithm, nonce, ciphertext, tag ) {
	return {
		version: 1,
		algorithm,
		nonce: new BinaryString( nonce ),
		ciphertext: new BinaryString( ciphertext ),
		tag: new BinaryString( tag ),
	};
}

function hkdfLength( value, label ) {
	const number = Number( value );
	if (
		!Number.isInteger( number )
		|| number < 0
		|| number > HKDF_SHA256_MAX_LENGTH
	) {
		throw new Error(
			`${label} expects length between 0 and ${HKDF_SHA256_MAX_LENGTH}`
		);
	}
	return number;
}

function concatBytes( ...items ) {
	const total = items.reduce( (sum, item) => sum + item.length, 0 );
	const out = new Uint8Array( total );
	let offset = 0;
	for ( const item of items ) {
		out.set( item, offset );
		offset += item.length;
	}
	return out;
}

function hmacSha256( key, value ) {
	return hmacBytes(
		'sha256',
		new BinaryString( value ),
		new BinaryString( key ),
		'KeyDerivation.hkdf_sha256'
	);
}

function hkdfSha256Bytes( inputKeyMaterial, length, salt, info ) {
	if ( length === 0 ) {
		return new Uint8Array( 0 );
	}
	const prk = hmacSha256( salt, inputKeyMaterial );
	let previous = new Uint8Array( 0 );
	let out = new Uint8Array( 0 );
	let counter = 1;
	while ( out.length < length ) {
		previous = hmacSha256(
			prk,
			concatBytes( previous, info, Uint8Array.of( counter ) )
		);
		out = concatBytes( out, previous );
		counter++;
	}
	return out.slice( 0, length );
}

function hkdfSha256Inputs( inputKeyMaterial, length, salt, info ) {
	const label = 'KeyDerivation.hkdf_sha256';
	return {
		inputKeyMaterial: assertBinaryString( inputKeyMaterial, label ),
		length: hkdfLength( length, label ),
		salt: optionalBinaryString( salt, label, 'BinaryString salt' ),
		info: optionalBinaryString( info, label, 'BinaryString info' ),
	};
}

function hkdfSha256( inputKeyMaterial, length, salt = null, info = null ) {
	const args = hkdfSha256Inputs( inputKeyMaterial, length, salt, info );
	return new BinaryString(
		hkdfSha256Bytes(
			args.inputKeyMaterial,
			args.length,
			args.salt,
			args.info
		)
	);
}

function passwordBytes( value, label ) {
	return new TextEncoder().encode(
		assertString( value, label, 'String password' )
	);
}

function optionString( options, key, fallback ) {
	return options[key] == null ? fallback : String( options[key] );
}

function optionPositiveInteger( options, key, fallback, label ) {
	if ( options[key] == null ) {
		return fallback;
	}
	return positiveInteger( options[key], `${label} option '${key}'` );
}

function passwordHashAlgorithm( options, label ) {
	const algorithm = optionString(
		options,
		'algorithm',
		DEFAULT_PASSWORD_HASH_ALGORITHM
	);
	if ( !passwordHashCapabilities().includes( algorithm ) ) {
		throw new Error(
			`${label} password hash algorithm '${algorithm}' is not available`
		);
	}
	return algorithm;
}

function pbkdf2Options( options, label ) {
	return {
		iterations: optionPositiveInteger(
			options,
			'iterations',
			PBKDF2_SHA256_ITERATIONS,
			label
		),
		length: optionPositiveInteger(
			options,
			'length',
			PASSWORD_HASH_LENGTH,
			label
		),
	};
}

function scryptOptions( options, label ) {
	let logN = optionPositiveInteger( options, 'log_n', SCRYPT_LOG_N, label );
	const defaultCost = 2 ** logN;
	const cost = optionPositiveInteger( options, 'cost', defaultCost, label );
	if ( cost < 2 || ( cost & ( cost - 1 ) ) !== 0 ) {
		throw new Error( `${label} option 'cost' must be a power of two` );
	}
	logN = Math.log2( cost );
	return {
		logN,
		cost,
		r: optionPositiveInteger( options, 'r', SCRYPT_R, label ),
		p: optionPositiveInteger( options, 'p', SCRYPT_P, label ),
		length: optionPositiveInteger(
			options,
			'length',
			PASSWORD_HASH_LENGTH,
			label
		),
	};
}

function constantTimeEqual( left, right ) {
	if ( !left || !right || left.length !== right.length ) {
		return false;
	}
	let diff = 0;
	for ( let i = 0; i < left.length; i++ ) {
		diff |= left[i] ^ right[i];
	}
	return diff === 0;
}

function parseParamList( text ) {
	const out = {};
	for ( const part of text.split( ',' ) ) {
		const index = part.indexOf( '=' );
		if ( index <= 0 ) {
			return null;
		}
		out[part.slice( 0, index )] = part.slice( index + 1 );
	}
	return out;
}

function parsePasswordHash( encoded ) {
	if ( typeof encoded !== 'string' ) {
		return null;
	}

	let match = encoded.match(
		/^\$zuzu-pbkdf2-sha256\$v=1\$([^$]+)\$([^$]+)\$([^$]+)$/u
	);
	if ( match ) {
		const params = parseParamList( match[1] );
		if (
			!params
			|| !/^\d+$/u.test( params.i || '' )
			|| !/^\d+$/u.test( params.l || '' )
		) {
			return null;
		}
		const salt = base64urlDecode( match[2] );
		const hash = base64urlDecode( match[3] );
		if ( !salt || !hash ) {
			return null;
		}
		return {
			algorithm: 'pbkdf2-sha256',
			iterations: Number( params.i ),
			length: Number( params.l ),
			salt,
			hash,
		};
	}

	match = encoded.match(
		/^\$scrypt\$([^$]+)\$([^$]+)\$([^$]+)$/u
	);
	if ( match ) {
		const params = parseParamList( match[1] );
		if (
			!params
			|| !/^\d+$/u.test( params.ln || '' )
			|| !/^\d+$/u.test( params.r || '' )
			|| !/^\d+$/u.test( params.p || '' )
			|| !/^\d+$/u.test( params.l || '' )
		) {
			return null;
		}
		const salt = base64urlDecode( match[2] );
		const hash = base64urlDecode( match[3] );
		if ( !salt || !hash ) {
			return null;
		}
		return {
			algorithm: 'scrypt',
			log_n: Number( params.ln ),
			r: Number( params.r ),
			p: Number( params.p ),
			length: Number( params.l ),
			salt,
			hash,
		};
	}

	return null;
}

function nodePbkdf2( password, salt, iterations, length ) {
	const crypto = nodeCrypto();
	if ( !crypto || typeof crypto.pbkdf2Sync !== 'function' ) {
		throw new Error( 'PBKDF2-SHA256 is unavailable on this host' );
	}
	return new Uint8Array(
		crypto.pbkdf2Sync( password, salt, iterations, length, 'sha256' )
	);
}

function nodeScrypt( password, salt, options ) {
	const crypto = nodeCrypto();
	if ( !crypto || typeof crypto.scryptSync !== 'function' ) {
		throw new Error( 'scrypt is unavailable on this host' );
	}
	return new Uint8Array(
		crypto.scryptSync(
			password,
			salt,
			options.length,
			{
				N: options.cost,
				r: options.r,
				p: options.p,
				maxmem: Math.max(
					32 * 1024 * 1024,
					128 * options.cost * options.r + 64 * 1024 * 1024
				),
			}
		)
	);
}

function passwordHashDeriveBytes( password, algorithm, salt, options, label ) {
	if ( algorithm === 'pbkdf2-sha256' ) {
		const pbkdf2Opts = pbkdf2Options( options, label );
		return nodePbkdf2(
			password,
			salt,
			pbkdf2Opts.iterations,
			pbkdf2Opts.length
		);
	}
	if ( algorithm === 'scrypt' ) {
		return nodeScrypt( password, salt, scryptOptions( options, label ) );
	}
	throw new Error( `${label} does not support algorithm '${algorithm}'` );
}

async function webCryptoPbkdf2( password, salt, iterations, length ) {
	const subtle = subtleCrypto();
	if ( !subtle ) {
		throw new Error( 'Web Crypto PBKDF2-SHA256 is unavailable' );
	}
	const key = await subtle.importKey(
		'raw',
		password,
		'PBKDF2',
		false,
		[ 'deriveBits' ]
	);
	const bits = await subtle.deriveBits(
		{
			name: 'PBKDF2',
			hash: 'SHA-256',
			salt,
			iterations,
		},
		key,
		length * 8
	);
	return new Uint8Array( bits );
}

async function passwordHashDeriveBytesAsync(
	password,
	algorithm,
	salt,
	options,
	label
) {
	if ( algorithm === 'pbkdf2-sha256' && hostName() === 'browser' ) {
		const pbkdf2Opts = pbkdf2Options( options, label );
		return webCryptoPbkdf2(
			password,
			salt,
			pbkdf2Opts.iterations,
			pbkdf2Opts.length
		);
	}
	return passwordHashDeriveBytes( password, algorithm, salt, options, label );
}

function passwordHash( passwordValue, optionsValue = null ) {
	const label = 'PasswordHash.hash';
	if ( hostName() === 'browser' ) {
		throw new Error(
			'PasswordHash.hash is not available synchronously on host browser; '
			+ 'use PasswordHash.hash_async'
		);
	}
	const password = passwordBytes( passwordValue, label );
	const options = optionalDict( optionsValue, label, 'Dict options' );
	const algorithm = passwordHashAlgorithm( options, label );
	const salt = options.salt == null
		? randomBytes( PASSWORD_HASH_SALT_LENGTH )
		: assertBinaryString( options.salt, label, 'BinaryString salt' );
	const hash = passwordHashDeriveBytes(
		password,
		algorithm,
		salt,
		options,
		label
	);

	if ( algorithm === 'pbkdf2-sha256' ) {
		const pbkdf2Opts = pbkdf2Options( options, label );
		return [
			'',
			'zuzu-pbkdf2-sha256',
			'v=1',
			`i=${pbkdf2Opts.iterations},l=${pbkdf2Opts.length}`,
			base64url( salt ),
			base64url( hash ),
		].join( '$' );
	}

	const scryptOpts = scryptOptions( options, label );
	return [
		'',
		'scrypt',
		`ln=${scryptOpts.logN},r=${scryptOpts.r},p=${scryptOpts.p},l=${scryptOpts.length}`,
		base64url( salt ),
		base64url( hash ),
	].join( '$' );
}

async function passwordHashAsyncValue( passwordValue, optionsValue = null ) {
	const label = 'PasswordHash.hash';
	const password = passwordBytes( passwordValue, label );
	const options = optionalDict( optionsValue, label, 'Dict options' );
	const algorithm = passwordHashAlgorithm( options, label );
	const salt = options.salt == null
		? randomBytes( PASSWORD_HASH_SALT_LENGTH )
		: assertBinaryString( options.salt, label, 'BinaryString salt' );
	const hash = await passwordHashDeriveBytesAsync(
		password,
		algorithm,
		salt,
		options,
		label
	);

	if ( algorithm === 'pbkdf2-sha256' ) {
		const pbkdf2Opts = pbkdf2Options( options, label );
		return [
			'',
			'zuzu-pbkdf2-sha256',
			'v=1',
			`i=${pbkdf2Opts.iterations},l=${pbkdf2Opts.length}`,
			base64url( salt ),
			base64url( hash ),
		].join( '$' );
	}

	const scryptOpts = scryptOptions( options, label );
	return [
		'',
		'scrypt',
		`ln=${scryptOpts.logN},r=${scryptOpts.r},p=${scryptOpts.p},l=${scryptOpts.length}`,
		base64url( salt ),
		base64url( hash ),
	].join( '$' );
}

function passwordHashVerify( passwordValue, encodedValue ) {
	const label = 'PasswordHash.verify';
	if ( hostName() === 'browser' ) {
		throw new Error(
			'PasswordHash.verify is not available synchronously on host browser; '
			+ 'use PasswordHash.verify_async'
		);
	}
	const password = passwordBytes( passwordValue, label );
	const encoded = assertString( encodedValue, label, 'String encoded_hash' );
	const parsed = parsePasswordHash( encoded );
	if ( !parsed || !passwordHashCapabilities().includes( parsed.algorithm ) ) {
		return false;
	}
	try {
		const hash = passwordHashDeriveBytes(
			password,
			parsed.algorithm,
			parsed.salt,
			parsed,
			label
		);
		return constantTimeEqual( hash, parsed.hash );
	}
	catch ( _err ) {
		return false;
	}
}

async function passwordHashVerifyAsyncValue( passwordValue, encodedValue ) {
	const label = 'PasswordHash.verify';
	const password = passwordBytes( passwordValue, label );
	const encoded = assertString( encodedValue, label, 'String encoded_hash' );
	const parsed = parsePasswordHash( encoded );
	if ( !parsed || !passwordHashCapabilities().includes( parsed.algorithm ) ) {
		return false;
	}
	try {
		const hash = await passwordHashDeriveBytesAsync(
			password,
			parsed.algorithm,
			parsed.salt,
			parsed,
			label
		);
		return constantTimeEqual( hash, parsed.hash );
	}
	catch ( _err ) {
		return false;
	}
}

function passwordHashNeedsRehash( encodedValue, optionsValue = null ) {
	const label = 'PasswordHash.needs_rehash';
	const encoded = assertString( encodedValue, label, 'String encoded_hash' );
	const options = optionalDict( optionsValue, label, 'Dict options' );
	const target = passwordHashAlgorithm( options, label );
	const parsed = parsePasswordHash( encoded );
	if ( !parsed || parsed.algorithm !== target ) {
		return true;
	}
	if ( target === 'pbkdf2-sha256' ) {
		const pbkdf2Opts = pbkdf2Options( options, label );
		return parsed.iterations < pbkdf2Opts.iterations
			|| parsed.length !== pbkdf2Opts.length;
	}
	if ( target === 'scrypt' ) {
		const scryptOpts = scryptOptions( options, label );
		return parsed.log_n < scryptOpts.logN
			|| parsed.r !== scryptOpts.r
			|| parsed.p !== scryptOpts.p
			|| parsed.length !== scryptOpts.length;
	}
	return true;
}

function passwordHashDeriveKey( passwordValue, optionsValue = null ) {
	const label = 'PasswordHash.derive_key';
	if ( hostName() === 'browser' ) {
		throw new Error(
			'PasswordHash.derive_key is not available synchronously on host browser; '
			+ 'use PasswordHash.derive_key_async'
		);
	}
	const password = passwordBytes( passwordValue, label );
	const options = optionalDict( optionsValue, label, 'Dict options' );
	const algorithm = passwordHashAlgorithm( options, label );
	if ( options.salt == null ) {
		throw new Error( `${label} expects BinaryString salt` );
	}
	const salt = assertBinaryString( options.salt, label, 'BinaryString salt' );
	return new BinaryString(
		passwordHashDeriveBytes( password, algorithm, salt, options, label )
	);
}

async function passwordHashDeriveKeyAsyncValue(
	passwordValue,
	optionsValue = null
) {
	const label = 'PasswordHash.derive_key';
	const password = passwordBytes( passwordValue, label );
	const options = optionalDict( optionsValue, label, 'Dict options' );
	const algorithm = passwordHashAlgorithm( options, label );
	if ( options.salt == null ) {
		throw new Error( `${label} expects BinaryString salt` );
	}
	const salt = assertBinaryString( options.salt, label, 'BinaryString salt' );
	return new BinaryString(
		await passwordHashDeriveBytesAsync(
			password,
			algorithm,
			salt,
			options,
			label
		)
	);
}

function subtleCrypto() {
	return globalThis.crypto
		&& globalThis.crypto.subtle
		&& typeof globalThis.crypto.subtle.importKey === 'function'
		&& typeof globalThis.crypto.subtle.deriveBits === 'function'
		? globalThis.crypto.subtle
		: null;
}

function subtleAesCrypto() {
	return globalThis.crypto
		&& globalThis.crypto.subtle
		&& typeof globalThis.crypto.subtle.importKey === 'function'
		&& typeof globalThis.crypto.subtle.encrypt === 'function'
		&& typeof globalThis.crypto.subtle.decrypt === 'function'
		? globalThis.crypto.subtle
		: null;
}

function cipherGenerateKey( algorithm = 'aes-256-gcm' ) {
	const actual = cipherAlgorithm( algorithm, 'Cipher.generate_key' );
	return new BinaryString( randomBytes( cipherMeta( actual ).keyLength ) );
}

function nodeCipherEncrypt( plaintext, key, options ) {
	const crypto = nodeCrypto();
	const meta = cipherMeta( options.algorithm );
	if (
		!crypto
		|| typeof crypto.createCipheriv !== 'function'
		|| !crypto.getCiphers().includes( meta.nodeName )
	) {
		throw new Error( `${options.algorithm} is unavailable on this host` );
	}
	const nonce = randomBytes( meta.nonceLength );
	const cipher = crypto.createCipheriv(
		meta.nodeName,
		key,
		nonce,
		{ authTagLength: meta.tagLength }
	);
	cipher.setAAD( options.aad );
	const ciphertext = concatBytes(
		cipher.update( plaintext ),
		cipher.final()
	);
	const tag = new Uint8Array( cipher.getAuthTag() );
	return cipherEnvelopeValue( options.algorithm, nonce, ciphertext, tag );
}

function nodeCipherDecrypt( envelope, key, options ) {
	const crypto = nodeCrypto();
	const meta = cipherMeta( envelope.algorithm );
	if (
		!crypto
		|| typeof crypto.createDecipheriv !== 'function'
		|| !crypto.getCiphers().includes( meta.nodeName )
	) {
		throw new Error( `${envelope.algorithm} is unavailable on this host` );
	}
	try {
		const decipher = crypto.createDecipheriv(
			meta.nodeName,
			key,
			envelope.nonce,
			{ authTagLength: meta.tagLength }
		);
		decipher.setAAD( options.aad );
		decipher.setAuthTag( envelope.tag );
		return new BinaryString(
			concatBytes(
				decipher.update( envelope.ciphertext ),
				decipher.final()
			)
		);
	}
	catch ( _err ) {
		throw new Error( 'Cipher.decrypt authentication failed' );
	}
}

function cipherEncrypt( plaintext, key, options = null ) {
	const label = 'Cipher.encrypt';
	const bytes = assertBinaryString( plaintext, label, 'BinaryString plaintext' );
	const cipherOpts = cipherOptions( options, label );
	const keyBytes = cipherKey( key, label, cipherMeta( cipherOpts.algorithm ) );
	if ( hostName() === 'browser' ) {
		throw new Error(
			'Cipher.encrypt is not available synchronously on host browser; '
			+ 'use Cipher.encrypt_async'
		);
	}
	return nodeCipherEncrypt( bytes, keyBytes, cipherOpts );
}

function cipherDecrypt( envelope, key, options = null ) {
	const label = 'Cipher.decrypt';
	const cipherOpts = cipherOptions( options, label );
	const cipherEnv = cipherEnvelope( envelope, label );
	if (
		cipherOpts.algorithmSupplied
		&& cipherOpts.algorithm !== cipherEnv.algorithm
	) {
		throw new Error(
			`${label} options.algorithm does not match envelope.algorithm`
		);
	}
	const keyBytes = cipherKey( key, label, cipherMeta( cipherEnv.algorithm ) );
	if ( hostName() === 'browser' ) {
		throw new Error(
			'Cipher.decrypt is not available synchronously on host browser; '
			+ 'use Cipher.decrypt_async'
		);
	}
	return nodeCipherDecrypt( cipherEnv, keyBytes, cipherOpts );
}

async function webCryptoCipherEncrypt( plaintext, key, options ) {
	if ( options.algorithm !== 'aes-256-gcm' ) {
		throw new Error( `${options.algorithm} is unavailable on host browser` );
	}
	const subtle = subtleAesCrypto();
	if ( !subtle ) {
		throw new Error( 'Web Crypto AES-GCM is unavailable' );
	}
	const meta = cipherMeta( options.algorithm );
	const nonce = randomBytes( meta.nonceLength );
	const cryptoKey = await subtle.importKey(
		'raw',
		key,
		'AES-GCM',
		false,
		[ 'encrypt' ]
	);
	const sealed = new Uint8Array( await subtle.encrypt(
		{
			name: 'AES-GCM',
			iv: nonce,
			additionalData: options.aad,
			tagLength: 128,
		},
		cryptoKey,
		plaintext
	) );
	return cipherEnvelopeValue(
		options.algorithm,
		nonce,
		sealed.slice( 0, sealed.length - meta.tagLength ),
		sealed.slice( sealed.length - meta.tagLength )
	);
}

async function webCryptoCipherDecrypt( envelope, key, options ) {
	if ( envelope.algorithm !== 'aes-256-gcm' ) {
		throw new Error( `${envelope.algorithm} is unavailable on host browser` );
	}
	const subtle = subtleAesCrypto();
	if ( !subtle ) {
		throw new Error( 'Web Crypto AES-GCM is unavailable' );
	}
	const cryptoKey = await subtle.importKey(
		'raw',
		key,
		'AES-GCM',
		false,
		[ 'decrypt' ]
	);
	try {
		const plaintext = await subtle.decrypt(
			{
				name: 'AES-GCM',
				iv: envelope.nonce,
				additionalData: options.aad,
				tagLength: 128,
			},
			cryptoKey,
			concatBytes( envelope.ciphertext, envelope.tag )
		);
		return new BinaryString( new Uint8Array( plaintext ) );
	}
	catch ( _err ) {
		throw new Error( 'Cipher.decrypt authentication failed' );
	}
}

function cipherEncryptAsync( plaintext, key, options = null ) {
	const label = 'Cipher.encrypt';
	const bytes = assertBinaryString( plaintext, label, 'BinaryString plaintext' );
	const cipherOpts = cipherOptions( options, label );
	const keyBytes = cipherKey( key, label, cipherMeta( cipherOpts.algorithm ) );
	if ( hostName() === 'browser' ) {
		return taskRuntime.Task.from(
			webCryptoCipherEncrypt( bytes, keyBytes, cipherOpts )
		);
	}
	return taskRuntime.Task.resolved(
		nodeCipherEncrypt( bytes, keyBytes, cipherOpts )
	);
}

function cipherDecryptAsync( envelope, key, options = null ) {
	const label = 'Cipher.decrypt';
	const cipherOpts = cipherOptions( options, label );
	const cipherEnv = cipherEnvelope( envelope, label );
	if (
		cipherOpts.algorithmSupplied
		&& cipherOpts.algorithm !== cipherEnv.algorithm
	) {
		throw new Error(
			`${label} options.algorithm does not match envelope.algorithm`
		);
	}
	const keyBytes = cipherKey( key, label, cipherMeta( cipherEnv.algorithm ) );
	if ( hostName() === 'browser' ) {
		return taskRuntime.Task.from(
			webCryptoCipherDecrypt( cipherEnv, keyBytes, cipherOpts )
		);
	}
	return taskRuntime.Task.resolved(
		nodeCipherDecrypt( cipherEnv, keyBytes, cipherOpts )
	);
}

async function webCryptoHkdfSha256( args ) {
	if ( args.length === 0 ) {
		return new BinaryString();
	}
	const subtle = subtleCrypto();
	if ( !subtle ) {
		return hkdfSha256(
			new BinaryString( args.inputKeyMaterial ),
			args.length,
			new BinaryString( args.salt ),
			new BinaryString( args.info )
		);
	}
	const key = await subtle.importKey(
		'raw',
		args.inputKeyMaterial,
		'HKDF',
		false,
		[ 'deriveBits' ]
	);
	const bits = await subtle.deriveBits(
		{
			name: 'HKDF',
			hash: 'SHA-256',
			salt: args.salt,
			info: args.info,
		},
		key,
		args.length * 8
	);
	return new BinaryString( new Uint8Array( bits ) );
}

function signingAlgorithm( algorithm, label ) {
	const value = algorithm == null ? 'ed25519' : String( algorithm );
	if ( !SIGNING_ALGORITHMS[value] ) {
		throw new Error(
			`${label} only supports ed25519, ecdsa-p256-sha256, `
				+ 'and ecdsa-p384-sha384'
		);
	}
	return value;
}

function signingAlgorithmOption( options, label ) {
	return options.algorithm == null
		? null
		: signingAlgorithm( options.algorithm, label );
}

function browserSigningAlgorithm( algorithm, label ) {
	if ( !signingCapabilities().includes( algorithm ) ) {
		throw new Error(
			`${label} signing algorithm '${algorithm}' is not available on host browser`
		);
	}
	return algorithm;
}

function signingMeta( algorithm ) {
	return SIGNING_ALGORITHMS[algorithm];
}

function keyAgreementAlgorithm( value = 'x25519', label ) {
	if ( value == null ) {
		value = 'x25519';
	}
	value = String(value);
	if ( !KEY_AGREEMENT_ALGORITHMS[value] ) {
		throw new Error( `${label} only supports x25519` );
	}
	return value;
}

function keyAgreementAlgorithmOption( options, label ) {
	return options.algorithm == null
		? null
		: keyAgreementAlgorithm( options.algorithm, label );
}

function keyAgreementMeta( algorithm ) {
	return KEY_AGREEMENT_ALGORITHMS[algorithm];
}

function keyFormat( key, optionsValue, label ) {
	const options = optionalDict( optionsValue, label, 'Dict options' );
	if ( options.format != null ) {
		return String( options.format );
	}
	return key && key.bytes instanceof Uint8Array ? 'raw' : 'pem';
}

function nodeUnsupported( label ) {
	throw new Error( `${label} signing is unavailable on this host` );
}

function keyAgreementUnsupported( label ) {
	throw new Error( `${label} key agreement is unavailable on this host` );
}

function derLength( length ) {
	if ( length < 128 ) {
		return Uint8Array.of( length );
	}
	const bytes = [];
	while ( length > 0 ) {
		bytes.unshift( length & 0xff );
		length >>= 8;
	}
	return Uint8Array.of( 0x80 | bytes.length, ...bytes );
}

function derElement( tag, body ) {
	return concatBytes( Uint8Array.of( tag ), derLength( body.length ), body );
}

function derSequence( ...items ) {
	return derElement( 0x30, concatBytes( ...items ) );
}

function derIntegerSmall( value ) {
	return derElement( 0x02, Uint8Array.of( value ) );
}

function derOctetString( bytes ) {
	return derElement( 0x04, bytes );
}

function derOid( bytes ) {
	return derElement( 0x06, Uint8Array.from( bytes ) );
}

function derBitString( bytes ) {
	return derElement( 0x03, concatBytes( Uint8Array.of( 0x00 ), bytes ) );
}

function ecCurveOid( algorithm ) {
	return algorithm === 'ecdsa-p256-sha256'
		? [ 0x2a, 0x86, 0x48, 0xce, 0x3d, 0x03, 0x01, 0x07 ]
		: [ 0x2b, 0x81, 0x04, 0x00, 0x22 ];
}

function pkcs8DerFromRawSeed( seed ) {
	return concatBytes(
		Uint8Array.from( [
			0x30, 0x2e, 0x02, 0x01, 0x00, 0x30, 0x05, 0x06,
			0x03, 0x2b, 0x65, 0x70, 0x04, 0x22, 0x04, 0x20,
		] ),
		seed
	);
}

function x25519Pkcs8DerFromRawPrivate( bytes ) {
	return concatBytes(
		Uint8Array.from( [
			0x30, 0x2e, 0x02, 0x01, 0x00, 0x30, 0x05, 0x06,
			0x03, 0x2b, 0x65, 0x6e, 0x04, 0x22, 0x04, 0x20,
		] ),
		bytes
	);
}

function x25519SpkiDerFromRawPublic( bytes ) {
	return concatBytes(
		Uint8Array.from( [
			0x30, 0x2a, 0x30, 0x05, 0x06, 0x03, 0x2b, 0x65,
			0x6e, 0x03, 0x21, 0x00,
		] ),
		bytes
	);
}

function ecdsaPkcs8DerFromRawScalar( scalar, algorithm ) {
	return derSequence(
		derIntegerSmall(0),
		derSequence(
			derOid( [ 0x2a, 0x86, 0x48, 0xce, 0x3d, 0x02, 0x01 ] ),
			derOid( ecCurveOid(algorithm) )
		),
		derOctetString( derSequence(
			derIntegerSmall(1),
			derOctetString(scalar)
		) )
	);
}

function ecdsaSpkiDerFromRawPublic( publicKey, algorithm ) {
	return derSequence(
		derSequence(
			derOid( [ 0x2a, 0x86, 0x48, 0xce, 0x3d, 0x02, 0x01 ] ),
			derOid( ecCurveOid(algorithm) )
		),
		derBitString(publicKey)
	);
}

function derReader( bytes ) {
	return {
		bytes,
		offset: 0,
		readElement( expectedTag = null ) {
			if ( this.offset + 2 > this.bytes.length ) {
				throw new Error( 'truncated DER' );
			}
			const tag = this.bytes[this.offset++];
			if ( expectedTag != null && tag !== expectedTag ) {
				throw new Error( 'unexpected DER tag' );
			}
			let length = this.bytes[this.offset++];
			if ( length & 0x80 ) {
				const count = length & 0x7f;
				if ( count === 0 || count > 4 || this.offset + count > this.bytes.length ) {
					throw new Error( 'invalid DER length' );
				}
				length = 0;
				for ( let i = 0; i < count; ++i ) {
					length = ( length << 8 ) | this.bytes[this.offset++];
				}
			}
			if ( this.offset + length > this.bytes.length ) {
				throw new Error( 'truncated DER value' );
			}
			const body = this.bytes.slice( this.offset, this.offset + length );
			this.offset += length;
			return body;
		},
	};
}

function derIntegerToFixed( integer, length ) {
	let value = integer;
	while ( value.length > 0 && value[0] === 0 ) {
		value = value.slice(1);
	}
	if ( value.length > length ) {
		throw new Error( 'ECDSA integer too long' );
	}
	const out = new Uint8Array( length );
	out.set( value, length - value.length );
	return out;
}

function derToEcdsaRawSignature( signature, algorithm ) {
	const meta = signingMeta(algorithm);
	const reader = derReader(signature);
	const seqReader = derReader( reader.readElement(0x30) );
	const r = derIntegerToFixed(
		seqReader.readElement(0x02),
		meta.signatureLength / 2
	);
	const s = derIntegerToFixed(
		seqReader.readElement(0x02),
		meta.signatureLength / 2
	);
	if ( reader.offset !== signature.length || seqReader.offset !== seqReader.bytes.length ) {
		throw new Error( 'trailing DER data' );
	}
	return concatBytes( r, s );
}

function ecdsaIntegerFromRaw( bytes ) {
	let value = bytes;
	while ( value.length > 0 && value[0] === 0 ) {
		value = value.slice(1);
	}
	if ( value.length === 0 ) {
		value = Uint8Array.of(0);
	}
	if ( value[0] & 0x80 ) {
		value = concatBytes( Uint8Array.of(0), value );
	}
	return derElement( 0x02, value );
}

function ecdsaRawSignatureToDer( signature ) {
	const half = signature.length / 2;
	return derSequence(
		ecdsaIntegerFromRaw( signature.slice( 0, half ) ),
		ecdsaIntegerFromRaw( signature.slice(half) )
	);
}

function algorithmFromJwk( jwk, label ) {
	if ( jwk.kty === 'OKP' && jwk.crv === 'Ed25519' ) {
		return 'ed25519';
	}
	if ( jwk.kty === 'OKP' && jwk.crv === 'X25519' ) {
		return 'x25519';
	}
	if ( jwk.kty === 'EC' && jwk.crv === 'P-256' ) {
		return 'ecdsa-p256-sha256';
	}
	if ( jwk.kty === 'EC' && jwk.crv === 'P-384' ) {
		return 'ecdsa-p384-sha384';
	}
	throw new Error( `${label} expects an Ed25519, P-256, P-384, or X25519 key` );
}

function algorithmFromNodeKey( key, label ) {
	if ( key.asymmetricKeyType === 'ed25519' ) {
		return 'ed25519';
	}
	if ( key.asymmetricKeyType === 'ec' ) {
		const curve = key.asymmetricKeyDetails?.namedCurve;
		if ( curve === 'prime256v1' ) {
			return 'ecdsa-p256-sha256';
		}
		if ( curve === 'secp384r1' ) {
			return 'ecdsa-p384-sha384';
		}
	}
	if ( key.asymmetricKeyType === 'x25519' ) {
		return 'x25519';
	}
	return algorithmFromJwk( key.export( { format: 'jwk' } ), label );
}

function rawPublicFromJwk( jwk, label ) {
	const algorithm = algorithmFromJwk( jwk, label );
	if ( algorithm === 'ed25519' ) {
		return base64urlDecode( jwk.x );
	}
	if ( algorithm === 'x25519' ) {
		const x = base64urlDecode( jwk.x );
		if ( !x || x.length !== 32 ) {
			throw new Error( `${label} has invalid X25519 public key` );
		}
		return x;
	}
	const x = base64urlDecode( jwk.x );
	const y = base64urlDecode( jwk.y );
	const meta = signingMeta(algorithm);
	const width = ( meta.publicLength - 1 ) / 2;
	if ( !x || !y || x.length !== width || y.length !== width ) {
		throw new Error( `${label} has invalid EC public key coordinates` );
	}
	return concatBytes( Uint8Array.of(0x04), x, y );
}

function rawPrivateFromJwk( jwk, label ) {
	const algorithm = algorithmFromJwk( jwk, label );
	const d = base64urlDecode( jwk.d );
	if ( algorithm === 'x25519' ) {
		if ( !d || d.length !== 32 ) {
			throw new Error( `${label} has invalid X25519 private key` );
		}
		return d;
	}
	if ( !d || d.length !== signingMeta(algorithm).privateLength ) {
		throw new Error( `${label} has invalid private key scalar` );
	}
	return d;
}

function jwkFromRawPrivate( bytes, algorithm, label ) {
	const meta = signingMeta(algorithm);
	if ( bytes.length !== meta.privateLength ) {
		throw new Error( `${label} expects a ${meta.privateLength}-byte raw private key` );
	}
	if ( meta.type === 'ed25519' ) {
		return {
			kty: 'OKP',
			crv: 'Ed25519',
			d: base64url(bytes),
		};
	}
	return null;
}

function jwkFromRawPublic( bytes, algorithm, label ) {
	const meta = signingMeta(algorithm);
	if ( bytes.length !== meta.publicLength ) {
		throw new Error( `${label} expects a ${meta.publicLength}-byte raw public key` );
	}
	if ( meta.type === 'ed25519' ) {
		return { kty: 'OKP', crv: 'Ed25519', x: base64url(bytes) };
	}
	if ( bytes[0] !== 0x04 ) {
		throw new Error( `${label} expects an uncompressed EC public key` );
	}
	const width = ( meta.publicLength - 1 ) / 2;
	return {
		kty: 'EC',
		crv: meta.jwkCurve,
		x: base64url( bytes.slice( 1, 1 + width ) ),
		y: base64url( bytes.slice( 1 + width ) ),
	};
}

function algorithmFromRawPublic( bytes, label ) {
	if ( bytes.length === 32 ) {
		return 'ed25519';
	}
	if ( bytes.length === 65 && bytes[0] === 0x04 ) {
		return 'ecdsa-p256-sha256';
	}
	if ( bytes.length === 97 && bytes[0] === 0x04 ) {
		return 'ecdsa-p384-sha384';
	}
	throw new Error(
		`${label} expects a 32-byte Ed25519 key, 65-byte P-256 `
			+ 'public key, or 97-byte P-384 public key'
	);
}

function nodePrivateKeyFromRaw( key, algorithm, label ) {
	const bytes = assertBinaryString( key, label, 'BinaryString key' );
	const meta = signingMeta(algorithm);
	if ( bytes.length !== meta.privateLength ) {
		throw new Error( `${label} expects a ${meta.privateLength}-byte raw private key` );
	}
	const crypto = nodeCrypto();
	if ( !crypto || typeof crypto.createPrivateKey !== 'function' ) {
		nodeUnsupported( label );
	}
	if ( meta.type === 'ed25519' ) {
		return crypto.createPrivateKey( {
			key: Buffer.from( pkcs8DerFromRawSeed(bytes) ),
			format: 'der',
			type: 'pkcs8',
		} );
	}
	return crypto.createPrivateKey( {
		key: Buffer.from( ecdsaPkcs8DerFromRawScalar( bytes, algorithm ) ),
		format: 'der',
		type: 'pkcs8',
	} );
}

function nodePublicKeyFromRaw( key, algorithm, label ) {
	const bytes = assertBinaryString( key, label, 'BinaryString key' );
	const crypto = nodeCrypto();
	if ( !crypto || typeof crypto.createPublicKey !== 'function' ) {
		nodeUnsupported( label );
	}
	return crypto.createPublicKey( {
		key: jwkFromRawPublic( bytes, algorithm, label ),
		format: 'jwk',
	} );
}

function x25519PrivateBytes( key, label ) {
	const bytes = assertBinaryString( key, label, 'BinaryString key' );
	if ( bytes.length !== 32 ) {
		throw new Error( `${label} expects a 32-byte raw private key` );
	}
	return bytes;
}

function x25519PublicBytes( key, label ) {
	const bytes = assertBinaryString( key, label, 'BinaryString key' );
	if ( bytes.length !== 32 ) {
		throw new Error( `${label} expects a 32-byte raw public key` );
	}
	return bytes;
}

function nodeX25519PrivateKeyFromRaw( key, label ) {
	const bytes = x25519PrivateBytes( key, label );
	const crypto = nodeCrypto();
	if ( !crypto || typeof crypto.createPrivateKey !== 'function' ) {
		keyAgreementUnsupported( label );
	}
	return crypto.createPrivateKey( {
		key: Buffer.from( x25519Pkcs8DerFromRawPrivate(bytes) ),
		format: 'der',
		type: 'pkcs8',
	} );
}

function nodeX25519PublicKeyFromRaw( key, label ) {
	const bytes = x25519PublicBytes( key, label );
	const crypto = nodeCrypto();
	if ( !crypto || typeof crypto.createPublicKey !== 'function' ) {
		keyAgreementUnsupported( label );
	}
	return crypto.createPublicKey( {
		key: Buffer.from( x25519SpkiDerFromRawPublic(bytes) ),
		format: 'der',
		type: 'spki',
	} );
}

function syncBrowserSigningError( label, asyncName ) {
	throw new Error(
		`${label} is not available synchronously on host browser; use ${asyncName}`
	);
}

function syncBrowserKeyAgreementError( label, asyncName ) {
	throw new Error(
		`${label} is not available synchronously on host browser; use ${asyncName}`
	);
}

function browserSigningUnsupported( label ) {
	throw new Error( `${label} signing is unavailable on this host` );
}

function subtleSigningCrypto() {
	return globalThis.crypto
		&& globalThis.crypto.subtle
		&& typeof globalThis.crypto.subtle.generateKey === 'function'
		&& typeof globalThis.crypto.subtle.importKey === 'function'
		&& typeof globalThis.crypto.subtle.exportKey === 'function'
		&& typeof globalThis.crypto.subtle.sign === 'function'
		&& typeof globalThis.crypto.subtle.verify === 'function'
		? globalThis.crypto.subtle
		: null;
}

function subtleKeyAgreementCrypto() {
	return globalThis.crypto
		&& globalThis.crypto.subtle
		&& typeof globalThis.crypto.subtle.generateKey === 'function'
		&& typeof globalThis.crypto.subtle.importKey === 'function'
		&& typeof globalThis.crypto.subtle.exportKey === 'function'
		&& typeof globalThis.crypto.subtle.deriveBits === 'function'
		? globalThis.crypto.subtle
		: null;
}

const X509_OIDS = {
	'2.5.4.3': 'CN',
	'2.5.4.6': 'C',
	'2.5.4.7': 'L',
	'2.5.4.8': 'ST',
	'2.5.4.10': 'O',
	'2.5.4.11': 'OU',
	'1.2.840.10045.2.1': 'ecPublicKey',
	'1.2.840.10045.3.1.7': 'prime256v1',
	'1.3.132.0.34': 'secp384r1',
	'1.3.101.112': 'ed25519',
};

function derError( label ) {
	throw new Error( `${label} expects DER X.509 certificate data` );
}

function x509DerReader( bytes, label ) {
	return {
		bytes,
		offset: 0,
		readElement( expectedTag = null ) {
			if ( this.offset + 2 > this.bytes.length ) {
				derError( label );
			}
			const start = this.offset;
			const tag = this.bytes[this.offset++];
			if ( expectedTag != null && tag !== expectedTag ) {
				derError( label );
			}
			let length = this.bytes[this.offset++];
			if ( length & 0x80 ) {
				const count = length & 0x7f;
				if ( count === 0 || count > 4 || this.offset + count > this.bytes.length ) {
					derError( label );
				}
				length = 0;
				for ( let i = 0; i < count; ++i ) {
					length = ( length << 8 ) | this.bytes[this.offset++];
				}
			}
			if ( this.offset + length > this.bytes.length ) {
				derError( label );
			}
			const headerLength = this.offset - start;
			const body = this.bytes.slice( this.offset, this.offset + length );
			const raw = this.bytes.slice( start, this.offset + length );
			this.offset += length;
			return { tag, body, raw, headerLength };
		},
		readBody( expectedTag = null ) {
			return this.readElement( expectedTag ).body;
		},
		empty() {
			return this.offset >= this.bytes.length;
		},
	};
}

function oidFromDer( bytes ) {
	if ( bytes.length === 0 ) {
		return '';
	}
	const parts = [ Math.floor( bytes[0] / 40 ), bytes[0] % 40 ];
	let value = 0;
	for ( let i = 1; i < bytes.length; ++i ) {
		value = ( value << 7 ) | ( bytes[i] & 0x7f );
		if ( ( bytes[i] & 0x80 ) === 0 ) {
			parts.push( value );
			value = 0;
		}
	}
	return parts.join( '.' );
}

function x509TextValue( tag, body ) {
	if ( tag === 0x0c || tag === 0x13 || tag === 0x16 || tag === 0x14 ) {
		return new TextDecoder().decode( body );
	}
	if ( tag === 0x1e ) {
		let out = '';
		for ( let i = 0; i + 1 < body.length; i += 2 ) {
			out += String.fromCharCode( ( body[i] << 8 ) | body[i + 1] );
		}
		return out;
	}
	return Array.from( body, (byte) => byte.toString( 16 ).padStart( 2, '0' ) )
		.join( '' )
		.toUpperCase();
}

function x509NameString( bytes, label ) {
	const seq = x509DerReader( bytes, label );
	const parts = [];
	while ( !seq.empty() ) {
		const set = x509DerReader( seq.readBody(0x31), label );
		while ( !set.empty() ) {
			const attr = x509DerReader( set.readBody(0x30), label );
			const oid = oidFromDer( attr.readBody(0x06) );
			const value = attr.readElement();
			const name = X509_OIDS[oid] || oid;
			parts.push( `${name}=${x509TextValue( value.tag, value.body )}` );
		}
	}
	return parts.join( ', ' );
}

function x509SerialHex( bytes ) {
	let value = bytes;
	while ( value.length > 1 && value[0] === 0 ) {
		value = value.slice(1);
	}
	return Array.from( value, (byte) => byte.toString( 16 ).padStart( 2, '0' ) )
		.join( '' )
		.toUpperCase();
}

function x509TimeEpoch( element, label ) {
	const text = new TextDecoder().decode( element.body );
	let year;
	let month;
	let day;
	let hour;
	let minute;
	let second;
	if ( element.tag === 0x17 ) {
		const match = text.match( /^(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})Z$/u );
		if ( !match ) {
			derError( label );
		}
		year = Number( match[1] );
		year += year >= 50 ? 1900 : 2000;
		month = Number( match[2] );
		day = Number( match[3] );
		hour = Number( match[4] );
		minute = Number( match[5] );
		second = Number( match[6] );
	}
	else if ( element.tag === 0x18 ) {
		const match = text.match( /^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})Z$/u );
		if ( !match ) {
			derError( label );
		}
		year = Number( match[1] );
		month = Number( match[2] );
		day = Number( match[3] );
		hour = Number( match[4] );
		minute = Number( match[5] );
		second = Number( match[6] );
	}
	else {
		derError( label );
	}
	return Math.floor( Date.UTC( year, month - 1, day, hour, minute, second ) / 1000 );
}

function x509BitStringPayload( bytes, label ) {
	if ( bytes.length === 0 || bytes[0] !== 0 ) {
		derError( label );
	}
	return bytes.slice(1);
}

function x509Spki( bytes, label ) {
	const seq = x509DerReader( bytes, label );
	const alg = x509DerReader( seq.readBody(0x30), label );
	const algOid = oidFromDer( alg.readBody(0x06) );
	let curveOid = null;
	if ( !alg.empty() ) {
		const param = alg.readElement();
		if ( param.tag === 0x06 ) {
			curveOid = oidFromDer( param.body );
		}
	}
	const publicBytes = x509BitStringPayload( seq.readBody(0x03), label );
	return { algOid, curveOid, publicBytes };
}

function parseX509Der( der, label = 'Certificate.parse' ) {
	const bytes = Uint8Array.from( der );
	const cert = x509DerReader( bytes, label );
	const certSeq = x509DerReader( cert.readBody(0x30), label );
	const tbs = x509DerReader( certSeq.readBody(0x30), label );
	if ( !cert.empty() ) {
		derError( label );
	}
	if ( !tbs.empty() ) {
		const next = tbs.readElement();
		if ( next.tag !== 0xa0 ) {
			tbs.offset = 0;
		}
	}
	const serial = x509SerialHex( tbs.readBody(0x02) );
	tbs.readElement(0x30);
	const issuer = x509NameString( tbs.readBody(0x30), label );
	const validity = x509DerReader( tbs.readBody(0x30), label );
	const notBefore = x509TimeEpoch( validity.readElement(), label );
	const notAfter = x509TimeEpoch( validity.readElement(), label );
	const subject = x509NameString( tbs.readBody(0x30), label );
	const spki = x509Spki( tbs.readBody(0x30), label );
	return new Certificate( new SecureCertificate(
		bytes,
		subject,
		issuer,
		serial,
		notBefore,
		notAfter,
		spki
	) );
}

class SecureCertificate {
	constructor(
		der,
		subject,
		issuer,
		serial,
		notBefore,
		notAfter,
		spki
	) {
		this.der = der;
		this.subject = subject;
		this.issuer = issuer;
		this.serial = serial;
		this.notBefore = notBefore;
		this.notAfter = notAfter;
		this.spki = spki;
	}
}

class SecureTlsIdentity {
	constructor(
		certPem,
		keyPem,
		password = '',
		source = 'pem',
		chainPem = certPem
	) {
		this.certPem = certPem;
		this.keyPem = keyPem;
		this.password = password;
		this.source = source;
		this.chainPem = chainPem;
	}
}

class SecureKeyAgreement {
	constructor( algorithm, key, publicKey = null, rawPrivate = null, rawPublic = null ) {
		this.algorithm = algorithm;
		this.key = key;
		this.publicKey = publicKey;
		this.rawPrivate = rawPrivate;
		this.rawPublic = rawPublic;
	}
}

class SecureSigningKey {
	constructor( algorithm, key, publicKey = null, rawPrivate = null, rawPublic = null ) {
		this.algorithm = algorithm;
		this.key = key;
		this.publicKey = publicKey;
		this.rawPrivate = rawPrivate;
		this.rawPublic = rawPublic;
	}
}

class SecurePublicKey {
	constructor( algorithm, key, rawPublic = null ) {
		this.algorithm = algorithm;
		this.key = key;
		this.rawPublic = rawPublic;
	}
}

function signingGenerate( algorithm = 'ed25519' ) {
	algorithm = signingAlgorithm( algorithm, 'SigningKey.generate' );
	if ( hostName() === 'browser' ) {
		syncBrowserSigningError(
			'SigningKey.generate',
			'SigningKey.generate_async'
		);
	}
	const crypto = nodeCrypto();
	if ( !crypto || typeof crypto.generateKeyPairSync !== 'function' ) {
		nodeUnsupported( 'SigningKey.generate' );
	}
	const meta = signingMeta(algorithm);
	const pair = meta.type === 'ed25519'
		? crypto.generateKeyPairSync( 'ed25519' )
		: crypto.generateKeyPairSync( 'ec', { namedCurve: meta.nodeCurve } );
	return new SigningKey( new SecureSigningKey( algorithm, pair.privateKey ) );
}

async function browserSigningKeyFromPair( algorithm, pair ) {
	const privateJwk = await globalThis.crypto.subtle.exportKey(
		'jwk',
		pair.privateKey
	);
	const publicJwk = await globalThis.crypto.subtle.exportKey(
		'jwk',
		pair.publicKey
	);
	return new SigningKey( new SecureSigningKey(
		algorithm,
		pair.privateKey,
		pair.publicKey,
		rawPrivateFromJwk( privateJwk, 'SigningKey.generate_async' ),
		rawPublicFromJwk( publicJwk, 'SigningKey.generate_async' )
	) );
}

async function signingGenerateAsyncValue( algorithm = 'ed25519' ) {
	algorithm = signingAlgorithm( algorithm, 'SigningKey.generate' );
	if ( hostName() !== 'browser' ) {
		return signingGenerate( algorithm );
	}
	browserSigningAlgorithm( algorithm, 'SigningKey.generate_async' );
	const subtle = subtleSigningCrypto();
	if ( !subtle ) {
		browserSigningUnsupported( 'SigningKey.generate_async' );
	}
	const meta = signingMeta(algorithm);
	try {
		const pair = await subtle.generateKey(
			meta.type === 'ed25519'
				? { name: 'Ed25519' }
				: { name: 'ECDSA', namedCurve: meta.webCurve },
			true,
			[ 'sign', 'verify' ]
		);
		return await browserSigningKeyFromPair( algorithm, pair );
	}
	catch ( _err ) {
		browserSigningUnsupported( 'SigningKey.generate_async' );
	}
}

function signingImportPrivate( key, options = null ) {
	const label = 'SigningKey.import_private';
	if ( hostName() === 'browser' ) {
		syncBrowserSigningError( label, 'SigningKey.import_private_async' );
	}
	const opts = optionalDict( options, label, 'Dict options' );
	const format = keyFormat( key, options, label );
	const crypto = nodeCrypto();
	if ( !crypto || typeof crypto.createPrivateKey !== 'function' ) {
		nodeUnsupported( label );
	}
	let algorithm = signingAlgorithmOption( opts, label );
	let keyObject;
	if ( format === 'raw' ) {
		algorithm ??= 'ed25519';
		keyObject = nodePrivateKeyFromRaw( key, algorithm, label );
	}
	else if ( format === 'pem' ) {
		const pem = assertString( key, label, 'String key' );
		const password = opts.password == null ? null : String( opts.password );
		keyObject = crypto.createPrivateKey(
			password == null
				? pem
				: { key: pem, passphrase: password }
		);
		const actual = algorithmFromNodeKey( keyObject, label );
		if ( algorithm && actual !== algorithm ) {
			throw new Error( `${label} PEM key algorithm does not match ${algorithm}` );
		}
		algorithm = actual;
	}
	else {
		throw new Error( `${label} only supports raw and pem formats` );
	}
	return new SigningKey( new SecureSigningKey( algorithm, keyObject ) );
}

async function signingImportPrivateAsyncValue( key, options = null ) {
	const label = 'SigningKey.import_private';
	if ( hostName() !== 'browser' ) {
		return signingImportPrivate( key, options );
	}
	const subtle = subtleSigningCrypto();
	if ( !subtle ) {
		browserSigningUnsupported( `${label}_async` );
	}
	const opts = optionalDict( options, label, 'Dict options' );
	const format = keyFormat( key, options, label );
	let algorithm = signingAlgorithmOption( opts, label );
	let der;
	if ( format === 'raw' ) {
		const bytes = assertBinaryString( key, label, 'BinaryString key' );
		algorithm ??= 'ed25519';
		browserSigningAlgorithm( algorithm, `${label}_async` );
		const meta = signingMeta(algorithm);
		if ( bytes.length !== meta.privateLength ) {
			throw new Error( `${label} expects a ${meta.privateLength}-byte raw private key` );
		}
		der = meta.type === 'ed25519'
			? pkcs8DerFromRawSeed(bytes)
			: ecdsaPkcs8DerFromRawScalar( bytes, algorithm );
	}
	else if ( format === 'pem' ) {
		der = pemToDer( key, label );
		if ( algorithm ) {
			browserSigningAlgorithm( algorithm, `${label}_async` );
		}
	}
	else {
		throw new Error( `${label} only supports raw and pem formats` );
	}
	try {
		let cryptoKey = null;
		let jwk = null;
		const candidates = algorithm ? [ algorithm ] : signingCapabilities();
		for ( const candidate of candidates ) {
			const meta = signingMeta(candidate);
			try {
				cryptoKey = await subtle.importKey(
					'pkcs8',
					der,
					meta.type === 'ed25519'
						? { name: 'Ed25519' }
						: { name: 'ECDSA', namedCurve: meta.webCurve },
					true,
					[ 'sign' ]
				);
				jwk = await subtle.exportKey( 'jwk', cryptoKey );
				algorithm = algorithmFromJwk( jwk, label );
				break;
			}
			catch ( _err ) {
				cryptoKey = null;
			}
		}
		if ( !cryptoKey ) {
			browserSigningUnsupported( `${label}_async` );
		}
		const rawPublic = rawPublicFromJwk( jwk, label );
		const publicKey = await subtle.importKey(
			signingMeta(algorithm).type === 'ed25519' ? 'raw' : 'jwk',
			signingMeta(algorithm).type === 'ed25519'
				? rawPublic
				: jwkFromRawPublic( rawPublic, algorithm, label ),
			signingMeta(algorithm).type === 'ed25519'
				? { name: 'Ed25519' }
				: { name: 'ECDSA', namedCurve: signingMeta(algorithm).webCurve },
			true,
			[ 'verify' ]
		);
		return new SigningKey( new SecureSigningKey(
			algorithm,
			cryptoKey,
			publicKey,
			rawPrivateFromJwk( jwk, label ),
			rawPublic
		) );
	}
	catch ( _err ) {
		browserSigningUnsupported( `${label}_async` );
	}
}

function signingImportPublic( key, options = null ) {
	const label = 'SigningKey.import_public';
	if ( hostName() === 'browser' ) {
		syncBrowserSigningError( label, 'SigningKey.import_public_async' );
	}
	const opts = optionalDict( options, label, 'Dict options' );
	const format = keyFormat( key, options, label );
	const crypto = nodeCrypto();
	if ( !crypto || typeof crypto.createPublicKey !== 'function' ) {
		nodeUnsupported( label );
	}
	let algorithm = signingAlgorithmOption( opts, label );
	let keyObject;
	if ( format === 'raw' ) {
		const bytes = assertBinaryString( key, label, 'BinaryString key' );
		algorithm ??= algorithmFromRawPublic( bytes, label );
		keyObject = nodePublicKeyFromRaw( key, algorithm, label );
	}
	else if ( format === 'pem' ) {
		keyObject = crypto.createPublicKey( assertString( key, label, 'String key' ) );
		const actual = algorithmFromNodeKey( keyObject, label );
		if ( algorithm && actual !== algorithm ) {
			throw new Error( `${label} PEM key algorithm does not match ${algorithm}` );
		}
		algorithm = actual;
	}
	else {
		throw new Error( `${label} only supports raw and pem formats` );
	}
	return new PublicKey( new SecurePublicKey( algorithm, keyObject ) );
}

async function signingImportPublicAsyncValue( key, options = null ) {
	const label = 'SigningKey.import_public';
	if ( hostName() !== 'browser' ) {
		return signingImportPublic( key, options );
	}
	const subtle = subtleSigningCrypto();
	if ( !subtle ) {
		browserSigningUnsupported( `${label}_async` );
	}
	const opts = optionalDict( options, label, 'Dict options' );
	const format = keyFormat( key, options, label );
	let algorithm = signingAlgorithmOption( opts, label );
	let importData;
	let importFormat;
	if ( format === 'raw' ) {
		importData = assertBinaryString( key, label, 'BinaryString key' );
		algorithm ??= algorithmFromRawPublic( importData, label );
		browserSigningAlgorithm( algorithm, `${label}_async` );
		importFormat = signingMeta(algorithm).type === 'ed25519' ? 'raw' : 'jwk';
		if ( importFormat === 'jwk' ) {
			importData = jwkFromRawPublic( importData, algorithm, label );
		}
	}
	else if ( format === 'pem' ) {
		importData = pemToDer( key, label );
		importFormat = 'spki';
		if ( algorithm ) {
			browserSigningAlgorithm( algorithm, `${label}_async` );
		}
	}
	else {
		throw new Error( `${label} only supports raw and pem formats` );
	}
	try {
		let cryptoKey = null;
		let jwk = null;
		const candidates = algorithm ? [ algorithm ] : signingCapabilities();
		for ( const candidate of candidates ) {
			const meta = signingMeta(candidate);
			try {
				cryptoKey = await subtle.importKey(
					importFormat,
					importData,
					meta.type === 'ed25519'
						? { name: 'Ed25519' }
						: { name: 'ECDSA', namedCurve: meta.webCurve },
					true,
					[ 'verify' ]
				);
				jwk = await subtle.exportKey( 'jwk', cryptoKey );
				algorithm = algorithmFromJwk( jwk, label );
				break;
			}
			catch ( _err ) {
				cryptoKey = null;
			}
		}
		if ( !cryptoKey ) {
			browserSigningUnsupported( `${label}_async` );
		}
		return new PublicKey( new SecurePublicKey(
			algorithm,
			cryptoKey,
			rawPublicFromJwk( jwk, label )
		) );
	}
	catch ( _err ) {
		browserSigningUnsupported( `${label}_async` );
	}
}

function signingPublicKey( signingKey ) {
	const secure = signingKey.__secureSigningKey;
	if ( hostName() === 'browser' ) {
		if ( secure.publicKey && secure.rawPublic ) {
			return new PublicKey( new SecurePublicKey(
				secure.algorithm,
				secure.publicKey,
				secure.rawPublic
			) );
		}
		throw new Error(
			'SigningKey.public_key is unavailable for this browser key'
		);
	}
	const crypto = nodeCrypto();
	return new PublicKey( new SecurePublicKey(
		secure.algorithm,
		crypto.createPublicKey( secure.key )
	) );
}

function signingSign( signingKey, message ) {
	const label = 'SigningKey.sign';
	if ( hostName() === 'browser' ) {
		syncBrowserSigningError( label, 'SigningKey.sign_async' );
	}
	const bytes = assertBinaryString( message, label, 'BinaryString message' );
	const crypto = nodeCrypto();
	if ( !crypto || typeof crypto.sign !== 'function' ) {
		nodeUnsupported( label );
	}
	const meta = signingMeta( signingKey.__secureSigningKey.algorithm );
	return new BinaryString(
		new Uint8Array( crypto.sign( meta.nodeHash ?? null, bytes, signingKey.__secureSigningKey.key ) )
	);
}

async function signingSignAsyncValue( signingKey, message ) {
	const label = 'SigningKey.sign';
	const bytes = assertBinaryString( message, label, 'BinaryString message' );
	if ( hostName() !== 'browser' ) {
		return signingSign( signingKey, message );
	}
	const subtle = subtleSigningCrypto();
	if ( !subtle ) {
		browserSigningUnsupported( `${label}_async` );
	}
	const meta = signingMeta( signingKey.__secureSigningKey.algorithm );
	try {
		const rawSignature = new Uint8Array( await subtle.sign(
			meta.type === 'ed25519'
				? { name: 'Ed25519' }
				: { name: 'ECDSA', hash: meta.webHash },
			signingKey.__secureSigningKey.key,
			bytes
		) );
		return new BinaryString(
			meta.type === 'ed25519'
				? rawSignature
				: ecdsaRawSignatureToDer(rawSignature)
		);
	}
	catch ( _err ) {
		browserSigningUnsupported( `${label}_async` );
	}
}

function signingExportPrivate( signingKey, optionsValue = null ) {
	const label = 'SigningKey.export_private';
	const options = optionalDict( optionsValue, label, 'Dict options' );
	const format = options.format == null ? 'raw' : String( options.format );
	const secure = signingKey.__secureSigningKey;
	if ( format === 'raw' ) {
		if ( secure.rawPrivate ) {
			return new BinaryString( secure.rawPrivate );
		}
		return new BinaryString(
			rawPrivateFromJwk( secure.key.export( { format: 'jwk' } ), label )
		);
	}
	if ( format === 'pem' ) {
		if ( hostName() !== 'browser' ) {
			return String( secure.key.export( {
				format: 'pem',
				type: 'pkcs8',
			} ) );
		}
		const meta = signingMeta(secure.algorithm);
		const der = meta.type === 'ed25519'
			? pkcs8DerFromRawSeed(secure.rawPrivate)
			: ecdsaPkcs8DerFromRawScalar( secure.rawPrivate, secure.algorithm );
		return derToPem( 'PRIVATE KEY', der );
	}
	throw new Error( `${label} only supports raw and pem formats` );
}

function certificateParse( input ) {
	const label = 'Certificate.parse';
	if ( input && input.bytes instanceof Uint8Array ) {
		return parseX509Der( input.bytes, label );
	}
	if ( hostName() === 'browser' ) {
		throw new Error( `${label} only supports DER BinaryString on host browser` );
	}
	return parseX509Der( certificatePemBlocks( input, label )[0], label );
}

function certificateParseChain( input ) {
	const label = 'Certificate.parse_chain';
	if ( input && input.bytes instanceof Uint8Array ) {
		return [ parseX509Der( input.bytes, label ) ];
	}
	if ( hostName() === 'browser' ) {
		throw new Error( `${label} only supports DER BinaryString on host browser` );
	}
	return certificatePemBlocks( input, label )
		.map( (der) => parseX509Der( der, label ) );
}

function certificateState( certificate, label ) {
	if ( !( certificate instanceof Certificate ) ) {
		throw new Error( `TypeException: ${label} expects Certificate` );
	}
	return certificate.__secureCertificate;
}

function certificateFingerprint( certificate, algorithm ) {
	const label = 'Certificate.fingerprint';
	const state = certificateState( certificate, label );
	const value = algorithm == null ? 'sha256' : String( algorithm ).toLowerCase();
	if ( value !== 'sha256' ) {
		throw new Error( `${label} only supports sha256` );
	}
	return new BinaryString(
		digestBytes( 'sha256', new BinaryString( state.der ), label )
	);
}

function certificatePublicKey( certificate ) {
	const label = 'Certificate.public_key';
	if ( hostName() === 'browser' ) {
		throw new Error( `${label} is not supported on host browser` );
	}
	const state = certificateState( certificate, label );
	const { algOid, curveOid, publicBytes } = state.spki;
	if ( algOid === '1.3.101.112' ) {
		const raw = Uint8Array.from( publicBytes );
		return new PublicKey( new SecurePublicKey(
			'ed25519',
			nodePublicKeyFromRaw( new BinaryString( raw ), 'ed25519', label ),
			raw
		) );
	}
	if ( algOid === '1.2.840.10045.2.1' && curveOid === '1.2.840.10045.3.1.7' ) {
		const raw = Uint8Array.from( publicBytes );
		return new PublicKey( new SecurePublicKey(
			'ecdsa-p256-sha256',
			nodePublicKeyFromRaw(
				new BinaryString( raw ),
				'ecdsa-p256-sha256',
				label
			),
			raw
		) );
	}
	if ( algOid === '1.2.840.10045.2.1' && curveOid === '1.3.132.0.34' ) {
		const raw = Uint8Array.from( publicBytes );
		return new PublicKey( new SecurePublicKey(
			'ecdsa-p384-sha384',
			nodePublicKeyFromRaw(
				new BinaryString( raw ),
				'ecdsa-p384-sha384',
				label
			),
			raw
		) );
	}
	throw new Error( `${label} certificate public-key algorithm is unsupported` );
}

function certificateVerifyChain( chain, options = null ) {
	const label = 'Certificate.verify_chain';
	if ( hostName() === 'browser' ) {
		throw new Error( `${label} is not supported on host browser` );
	}
	if ( !Array.isArray( chain ) || chain.length === 0 ) {
		throw new Error( `TypeException: ${label} expects non-empty Array chain` );
	}
	const states = chain.map( (certificate) => certificateState( certificate, label ) );
	const opts = certificateVerifyOptions( options, label );
	const crypto = nodeCrypto();
	if ( !crypto || typeof crypto.X509Certificate !== 'function' ) {
		throw new Error( `${label} requires X509Certificate support on host node` );
	}

	const rootCerts = certificateRootNodeCerts( opts.roots, crypto, label );
	if ( opts.use_system_roots ) {
		const tls = nodeTls();
		if ( tls && Array.isArray( tls.rootCertificates ) ) {
			for ( const pem of tls.rootCertificates ) {
				rootCerts.push( new crypto.X509Certificate( pem ) );
			}
		}
	}
	const nodeChain = states.map(
		(state) => new crypto.X509Certificate( Buffer.from( state.der ) )
	);
	const verifiedAt = opts.time;
	let valid = true;
	let error = null;
	error = certificateVerifyNodeChain( nodeChain, rootCerts, verifiedAt );
	valid = error == null;
	let reason = valid ? 'ok' : certificateVerifyReason( error );
	if ( valid && opts.hostname != null ) {
		if ( !certificateHostnameMatches( states[0], opts.hostname ) ) {
			valid = false;
			reason = 'hostname-mismatch';
			error = 'hostname mismatch';
		}
	}

	return {
		valid,
		reason,
		error: valid ? null : error,
		hostname: opts.hostname,
		verified_at: verifiedAt,
		chain_length: chain.length,
	};
}

function certificateVerifyOptions( options, label ) {
	if ( options == null ) {
		options = {};
	}
	if ( typeof options !== 'object' || Array.isArray( options ) ) {
		throw new Error( `TypeException: ${label} expects Dict options` );
	}
	const useSystemRoots = options.use_system_roots == null
		? false
		: options.use_system_roots;
	if ( typeof useSystemRoots !== 'boolean' ) {
		throw new Error(
			`TypeException: ${label} option 'use_system_roots' expects Boolean`
		);
	}
	let hostname = options.hostname == null ? null : options.hostname;
	if ( hostname != null && typeof hostname !== 'string' ) {
		throw new Error( `TypeException: ${label} option 'hostname' expects String` );
	}
	let time = options.time;
	if ( time == null ) {
		time = Math.floor( Date.now() / 1000 );
	}
	else if ( time instanceof Time ) {
		time = time.epoch();
	}
	else if ( typeof time === 'number' ) {
		time = Math.floor( time );
	}
	else {
		throw new Error(
			`TypeException: ${label} option 'time' expects Time, Number, or null`
		);
	}
	return {
		roots: options.roots,
		use_system_roots: useSystemRoots,
		hostname,
		time,
	};
}

function certificateRootNodeCerts( value, crypto, label ) {
	if ( value == null ) {
		return [];
	}
	if ( value instanceof Certificate ) {
		const state = certificateState( value, label );
		return [ new crypto.X509Certificate( Buffer.from( state.der ) ) ];
	}
	if ( typeof value === 'string' ) {
		return certificatePemBlocks( value, label )
			.map( (der) => new crypto.X509Certificate( Buffer.from( der ) ) );
	}
	if ( Array.isArray( value ) ) {
		return value.flatMap(
			(item) => certificateRootNodeCerts( item, crypto, label )
		);
	}
	throw new Error(
		`TypeException: ${label} expects roots to be Certificate, String PEM, `
			+ 'Array, or null'
	);
}

function certificateVerifyNodeChain( chain, roots, verifiedAt ) {
	const verifiedDate = new Date( verifiedAt * 1000 );
	for ( const cert of chain ) {
		const notBefore = new Date( cert.validFrom );
		const notAfter = new Date( cert.validTo );
		if ( verifiedDate < notBefore ) {
			return 'certificate is not yet valid';
		}
		if ( verifiedDate > notAfter ) {
			return 'certificate has expired';
		}
	}
	for ( let i = 0; i < chain.length; i++ ) {
		const child = chain[i];
		const issuer = chain[i + 1] || roots.find(
			(root) => child.checkIssued( root ) && child.verify( root.publicKey )
		);
		if ( !issuer ) {
			return 'certificate is not trusted';
		}
		if ( !child.checkIssued( issuer ) || !child.verify( issuer.publicKey ) ) {
			return 'certificate signature is invalid';
		}
		if ( i > 0 && issuer !== child && !child.ca ) {
			return 'certificate is not a CA';
		}
	}
	return null;
}

function certificateVerifyReason( error ) {
	const text = String( error || '' ).toLowerCase();
	if ( text === '' || text === 'ok' ) {
		return 'ok';
	}
	if ( text.includes( 'hostname' ) ) {
		return 'hostname-mismatch';
	}
	if ( text.includes( 'not valid yet' ) || text.includes( 'not yet valid' ) ) {
		return 'not-yet-valid';
	}
	if ( text.includes( 'expired' ) || text.includes( 'not valid' ) ) {
		return 'expired';
	}
	if (
		text.includes( 'unknown_ca' )
		|| text.includes( 'not trusted' )
		|| text.includes( 'unknown ca' )
	) {
		return 'untrusted-root';
	}
	return 'invalid-chain';
}

function certificateHostnameMatches( state, hostname ) {
	const crypto = nodeCrypto();
	if ( crypto && typeof crypto.X509Certificate === 'function' ) {
		const cert = new crypto.X509Certificate( Buffer.from( state.der ) );
		if ( isIpAddress( hostname ) && typeof cert.checkIP === 'function' ) {
			return !!cert.checkIP( hostname );
		}
		if ( typeof cert.checkHost === 'function' ) {
			return !!cert.checkHost( hostname );
		}
	}
	return certificateHostnameMatchesFallback( state, hostname );
}

function isIpAddress( text ) {
	return /^(\d{1,3}\.){3}\d{1,3}$/u.test( text ) || text.includes( ':' );
}

function certificateHostnameMatchesFallback( state, hostname ) {
	const extensions = state.extensions || [];
	const subjectAltName = extensions.find(
		(ext) => ext.oid === '2.5.29.17'
	);
	if ( subjectAltName ) {
		for ( const name of subjectAltName.names || [] ) {
			if ( name.type === 'dns' && dnsNameMatches( name.value, hostname ) ) {
				return true;
			}
			if ( name.type === 'ip' && name.value === hostname ) {
				return true;
			}
		}
		return false;
	}
	const match = state.subject.match( /(?:^|,\s*)CN=([^,]+)/u );
	return !!( match && dnsNameMatches( match[1], hostname ) );
}

function dnsNameMatches( pattern, hostname ) {
	pattern = String( pattern ).toLowerCase();
	hostname = String( hostname ).toLowerCase();
	if ( pattern === hostname ) {
		return true;
	}
	if ( !pattern.startsWith( '*.' ) ) {
		return false;
	}
	const suffix = pattern.slice( 1 );
	return hostname.endsWith( suffix )
		&& hostname.slice( 0, -suffix.length ).indexOf( '.' ) === -1;
}

function binaryStringFromBytes( bytes ) {
	let out = '';
	for ( let i = 0; i < bytes.length; i += 8192 ) {
		out += String.fromCharCode( ...bytes.slice( i, i + 8192 ) );
	}
	return out;
}

function bytesFromBinaryString( text ) {
	const bytes = new Uint8Array( text.length );
	for ( let i = 0; i < text.length; i++ ) {
		bytes[i] = text.charCodeAt(i) & 0xff;
	}
	return bytes;
}

function forgeAsn1Bytes( forge, asn1 ) {
	return bytesFromBinaryString( forge.asn1.toDer(asn1).getBytes() );
}

function tlsIdentityFromPem(
	certificatePem,
	privateKeyPem,
	password = null
) {
	const label = 'TlsIdentity.from_pem';
	const certPem = assertString(
		certificatePem,
		label,
		'String certificate_pem'
	);
	const keyPem = assertString(
		privateKeyPem,
		label,
		'String private_key_pem'
	);
	const pass = password == null ? '' : assertString(
		password,
		label,
		'String password'
	);
	const blocks = certificatePemBlocks( certPem, label );
	parseX509Der( blocks[0], label );
	if ( !/-----BEGIN [A-Z ]*PRIVATE KEY-----/u.test( keyPem ) ) {
		throw new Error( `${label} expects PEM private key text` );
	}
	return new TlsIdentity( new SecureTlsIdentity(
		certificateDerToPem( blocks[0] ),
		keyPem,
		pass,
		'pem',
		blocks.map( certificateDerToPem ).join( '' )
	) );
}

function tlsIdentityFromPkcs12( bytesValue, password = null ) {
	const label = 'TlsIdentity.from_pkcs12';
	if ( hostName() === 'browser' ) {
		throw new Error( `${label} is not supported on host browser` );
	}
	const bytes = assertBinaryString( bytesValue, label, 'BinaryString bytes' );
	const pass = password == null ? '' : assertString(
		password,
		label,
		'String password'
	);
	const forge = nodeForge();
	if ( !forge ) {
		nodeUnsupported(label);
	}
	try {
		const asn1 = forge.asn1.fromDer(
			forge.util.createBuffer( binaryStringFromBytes(bytes) )
		);
		const p12 = forge.pkcs12.pkcs12FromAsn1( asn1, false, pass );
		const keyBags = [
			...( p12.getBags( {
				bagType: forge.pki.oids.pkcs8ShroudedKeyBag,
			} )[forge.pki.oids.pkcs8ShroudedKeyBag] || [] ),
			...( p12.getBags( {
				bagType: forge.pki.oids.keyBag,
			} )[forge.pki.oids.keyBag] || [] ),
		];
		const certBags = p12.getBags( {
			bagType: forge.pki.oids.certBag,
		} )[forge.pki.oids.certBag] || [];
		if ( keyBags.length === 0 || certBags.length === 0 ) {
			throw new Error( 'missing identity material' );
		}
		const keyBag = keyBags[0];
		const certBag = certBags[0];
		const keyPem = keyBag.key
			? forge.pki.privateKeyToPem(keyBag.key)
			: derToPem( 'PRIVATE KEY', forgeAsn1Bytes( forge, keyBag.asn1 ) );
		const certPem = certBag.cert
			? forge.pki.certificateToPem(certBag.cert)
			: derToPem( 'CERTIFICATE', forgeAsn1Bytes( forge, certBag.asn1 ) );
		const chainPem = certBags.map( ( bag ) => bag.cert
			? forge.pki.certificateToPem(bag.cert)
			: derToPem( 'CERTIFICATE', forgeAsn1Bytes( forge, bag.asn1 ) )
		).join( '' );
		return new TlsIdentity( new SecureTlsIdentity(
			certPem,
			keyPem,
			'',
			'pkcs12',
			chainPem
		) );
	}
	catch ( err ) {
		if ( /password|decrypt|mac|integrity/iu.test( String( err.message ) ) ) {
			throw new Error( `${label} failed to decrypt PKCS#12 data` );
		}
		throw new Error(
			`${label} expects PKCS#12 data with certificate and private key`
		);
	}
}

function tlsIdentityState( identity, label ) {
	if ( !( identity instanceof TlsIdentity ) ) {
		throw new Error( `TypeException: ${label} expects TlsIdentity` );
	}
	return identity.__secureTlsIdentity;
}

function tlsIdentityCertificate( identity ) {
	const label = 'TlsIdentity.certificate';
	const state = tlsIdentityState( identity, label );
	return parseX509Der( certificatePemBlocks( state.certPem, label )[0], label );
}

function tlsIdentityPrivateKey( identity ) {
	const label = 'TlsIdentity.private_key';
	if ( hostName() === 'browser' ) {
		throw new Error( `${label} is not supported on host browser` );
	}
	const state = tlsIdentityState( identity, label );
	try {
		return signingImportPrivate(
			state.keyPem,
			{ format: 'pem', password: state.password }
		);
	}
	catch ( _err ) {
		throw new Error(
			`${label} only supports Ed25519, ECDSA P-256, and ECDSA P-384 private keys`
		);
	}
}

function publicKeyVerify( publicKey, message, signature ) {
	const label = 'PublicKey.verify';
	if ( hostName() === 'browser' ) {
		syncBrowserSigningError( label, 'PublicKey.verify_async' );
	}
	const messageBytes = assertBinaryString(
		message,
		label,
		'BinaryString message'
	);
	const signatureBytes = assertBinaryString(
		signature,
		label,
		'BinaryString signature'
	);
	const meta = signingMeta( publicKey.__securePublicKey.algorithm );
	if ( !meta ) {
		throw new Error( `${label} expects a signing public key` );
	}
	if ( meta.type === 'ed25519' && signatureBytes.length !== 64 ) {
		return false;
	}
	const crypto = nodeCrypto();
	if ( !crypto || typeof crypto.verify !== 'function' ) {
		nodeUnsupported( label );
	}
	return crypto.verify(
		meta.nodeHash ?? null,
		messageBytes,
		publicKey.__securePublicKey.key,
		signatureBytes
	);
}

async function publicKeyVerifyAsyncValue( publicKey, message, signature ) {
	const label = 'PublicKey.verify';
	const messageBytes = assertBinaryString(
		message,
		label,
		'BinaryString message'
	);
	const signatureBytes = assertBinaryString(
		signature,
		label,
		'BinaryString signature'
	);
	if ( hostName() !== 'browser' ) {
		return publicKeyVerify( publicKey, message, signature );
	}
	const subtle = subtleSigningCrypto();
	if ( !subtle ) {
		browserSigningUnsupported( `${label}_async` );
	}
	const meta = signingMeta( publicKey.__securePublicKey.algorithm );
	if ( !meta ) {
		throw new Error( `${label} expects a signing public key` );
	}
	let verifySignature = signatureBytes;
	if ( meta.type === 'ed25519' ) {
		if ( signatureBytes.length !== 64 ) {
			return false;
		}
	}
	else {
		try {
			verifySignature = derToEcdsaRawSignature(
				signatureBytes,
				publicKey.__securePublicKey.algorithm
			);
		}
		catch ( _err ) {
			return false;
		}
	}
	try {
		return await subtle.verify(
			meta.type === 'ed25519'
				? { name: 'Ed25519' }
				: { name: 'ECDSA', hash: meta.webHash },
			publicKey.__securePublicKey.key,
			verifySignature,
			messageBytes
		);
	}
	catch ( _err ) {
		return false;
	}
}

function publicKeyExport( publicKey, optionsValue = null ) {
	const label = 'PublicKey.export';
	const options = optionalDict( optionsValue, label, 'Dict options' );
	const format = options.format == null ? 'raw' : String( options.format );
	const secure = publicKey.__securePublicKey;
	if ( format === 'raw' ) {
		if ( secure.rawPublic ) {
			return new BinaryString( secure.rawPublic );
		}
		return new BinaryString(
			rawPublicFromJwk( secure.key.export( { format: 'jwk' } ), label )
		);
	}
	if ( format === 'pem' ) {
		if ( secure.algorithm === 'x25519' ) {
			throw new Error(
				`${label} only supports raw format for x25519 public keys`
			);
		}
		if ( hostName() !== 'browser' ) {
			return String( secure.key.export( {
				format: 'pem',
				type: 'spki',
			} ) );
		}
		const meta = signingMeta(secure.algorithm);
		const der = meta.type === 'ed25519'
			? null
			: ecdsaSpkiDerFromRawPublic( secure.rawPublic, secure.algorithm );
		if ( der == null ) {
			throw new Error( `${label} PEM export is unavailable for this browser key` );
		}
		return derToPem( 'PUBLIC KEY', der );
	}
	throw new Error( `${label} only supports raw and pem formats` );
}

function keyAgreementGenerate( algorithm = 'x25519' ) {
	const label = 'KeyAgreement.generate';
	algorithm = keyAgreementAlgorithm( algorithm, label );
	if ( hostName() === 'browser' ) {
		syncBrowserKeyAgreementError( label, 'KeyAgreement.generate_async' );
	}
	const crypto = nodeCrypto();
	if ( !crypto || typeof crypto.generateKeyPairSync !== 'function' ) {
		keyAgreementUnsupported( label );
	}
	const pair = crypto.generateKeyPairSync(algorithm);
	return new KeyAgreement( new SecureKeyAgreement(
		algorithm,
		pair.privateKey
	) );
}

async function browserKeyAgreementFromPair( algorithm, pair, label ) {
	const privateJwk = await globalThis.crypto.subtle.exportKey(
		'jwk',
		pair.privateKey
	);
	const publicJwk = await globalThis.crypto.subtle.exportKey(
		'jwk',
		pair.publicKey
	);
	return new KeyAgreement( new SecureKeyAgreement(
		algorithm,
		pair.privateKey,
		pair.publicKey,
		rawPrivateFromJwk( privateJwk, label ),
		rawPublicFromJwk( publicJwk, label )
	) );
}

async function keyAgreementGenerateAsyncValue( algorithm = 'x25519' ) {
	const label = 'KeyAgreement.generate';
	algorithm = keyAgreementAlgorithm( algorithm, label );
	if ( hostName() !== 'browser' ) {
		return keyAgreementGenerate( algorithm );
	}
	const subtle = subtleKeyAgreementCrypto();
	if ( !subtle ) {
		keyAgreementUnsupported( `${label}_async` );
	}
	try {
		const pair = await subtle.generateKey(
			{ name: 'X25519' },
			true,
			[ 'deriveBits' ]
		);
		return await browserKeyAgreementFromPair( algorithm, pair, label );
	}
	catch ( _err ) {
		keyAgreementUnsupported( `${label}_async` );
	}
}

function keyAgreementImportPrivate( key, options = null ) {
	const label = 'KeyAgreement.import_private';
	if ( hostName() === 'browser' ) {
		syncBrowserKeyAgreementError(
			label,
			'KeyAgreement.import_private_async'
		);
	}
	const opts = optionalDict( options, label, 'Dict options' );
	keyAgreementAlgorithmOption( opts, label );
	const format = keyFormat( key, options, label );
	if ( format !== 'raw' ) {
		throw new Error( `${label} only supports raw format` );
	}
	return new KeyAgreement( new SecureKeyAgreement(
		'x25519',
		nodeX25519PrivateKeyFromRaw( key, label )
	) );
}

async function keyAgreementImportPrivateAsyncValue( key, options = null ) {
	const label = 'KeyAgreement.import_private';
	if ( hostName() !== 'browser' ) {
		return keyAgreementImportPrivate( key, options );
	}
	const subtle = subtleKeyAgreementCrypto();
	if ( !subtle ) {
		keyAgreementUnsupported( `${label}_async` );
	}
	const opts = optionalDict( options, label, 'Dict options' );
	keyAgreementAlgorithmOption( opts, label );
	const format = keyFormat( key, options, label );
	if ( format !== 'raw' ) {
		throw new Error( `${label} only supports raw format` );
	}
	const rawPrivate = x25519PrivateBytes( key, label );
	try {
		const privateKey = await subtle.importKey(
			'pkcs8',
			x25519Pkcs8DerFromRawPrivate(rawPrivate),
			{ name: 'X25519' },
			true,
			[ 'deriveBits' ]
		);
		const privateJwk = await subtle.exportKey( 'jwk', privateKey );
		const rawPublic = rawPublicFromJwk( privateJwk, label );
		const publicKey = await subtle.importKey(
			'raw',
			rawPublic,
			{ name: 'X25519' },
			true,
			[]
		);
		return new KeyAgreement( new SecureKeyAgreement(
			'x25519',
			privateKey,
			publicKey,
			rawPrivateFromJwk( privateJwk, label ),
			rawPublic
		) );
	}
	catch ( _err ) {
		keyAgreementUnsupported( `${label}_async` );
	}
}

function keyAgreementImportPublic( key, options = null ) {
	const label = 'KeyAgreement.import_public';
	if ( hostName() === 'browser' ) {
		syncBrowserKeyAgreementError( label, 'KeyAgreement.import_public_async' );
	}
	const opts = optionalDict( options, label, 'Dict options' );
	keyAgreementAlgorithmOption( opts, label );
	const format = keyFormat( key, options, label );
	if ( format !== 'raw' ) {
		throw new Error( `${label} only supports raw format` );
	}
	return new PublicKey( new SecurePublicKey(
		'x25519',
		nodeX25519PublicKeyFromRaw( key, label )
	) );
}

async function keyAgreementImportPublicAsyncValue( key, options = null ) {
	const label = 'KeyAgreement.import_public';
	if ( hostName() !== 'browser' ) {
		return keyAgreementImportPublic( key, options );
	}
	const subtle = subtleKeyAgreementCrypto();
	if ( !subtle ) {
		keyAgreementUnsupported( `${label}_async` );
	}
	const opts = optionalDict( options, label, 'Dict options' );
	keyAgreementAlgorithmOption( opts, label );
	const format = keyFormat( key, options, label );
	if ( format !== 'raw' ) {
		throw new Error( `${label} only supports raw format` );
	}
	const rawPublic = x25519PublicBytes( key, label );
	try {
		const publicKey = await subtle.importKey(
			'raw',
			rawPublic,
			{ name: 'X25519' },
			true,
			[]
		);
		return new PublicKey( new SecurePublicKey(
			'x25519',
			publicKey,
			rawPublic
		) );
	}
	catch ( _err ) {
		keyAgreementUnsupported( `${label}_async` );
	}
}

function keyAgreementPublicKey( keyAgreement ) {
	const secure = keyAgreement.__secureKeyAgreement;
	if ( hostName() === 'browser' ) {
		if ( secure.publicKey && secure.rawPublic ) {
			return new PublicKey( new SecurePublicKey(
				secure.algorithm,
				secure.publicKey,
				secure.rawPublic
			) );
		}
		throw new Error(
			'KeyAgreement.public_key is unavailable for this browser key'
		);
	}
	const crypto = nodeCrypto();
	return new PublicKey( new SecurePublicKey(
		secure.algorithm,
		crypto.createPublicKey( secure.key )
	) );
}

function keyAgreementExportPrivate( keyAgreement, optionsValue = null ) {
	const label = 'KeyAgreement.export_private';
	const options = optionalDict( optionsValue, label, 'Dict options' );
	const format = options.format == null ? 'raw' : String( options.format );
	if ( format !== 'raw' ) {
		throw new Error( `${label} only supports raw format` );
	}
	const secure = keyAgreement.__secureKeyAgreement;
	if ( secure.rawPrivate ) {
		return new BinaryString( secure.rawPrivate );
	}
	return new BinaryString(
		rawPrivateFromJwk( secure.key.export( { format: 'jwk' } ), label )
	);
}

function keyAgreementDerive( keyAgreement, publicKey ) {
	const label = 'KeyAgreement.derive';
	if ( hostName() === 'browser' ) {
		syncBrowserKeyAgreementError( label, 'KeyAgreement.derive_async' );
	}
	if ( !( publicKey instanceof PublicKey )
		|| publicKey.__securePublicKey.algorithm !== 'x25519' ) {
		throw new Error( `${label} expects an x25519 public key` );
	}
	const crypto = nodeCrypto();
	if ( !crypto || typeof crypto.diffieHellman !== 'function' ) {
		keyAgreementUnsupported( label );
	}
	return new BinaryString(
		new Uint8Array( crypto.diffieHellman( {
			privateKey: keyAgreement.__secureKeyAgreement.key,
			publicKey: publicKey.__securePublicKey.key,
		} ) )
	);
}

async function keyAgreementDeriveAsyncValue( keyAgreement, publicKey ) {
	const label = 'KeyAgreement.derive';
	if ( hostName() !== 'browser' ) {
		return keyAgreementDerive( keyAgreement, publicKey );
	}
	if ( !( publicKey instanceof PublicKey )
		|| publicKey.__securePublicKey.algorithm !== 'x25519' ) {
		throw new Error( `${label} expects an x25519 public key` );
	}
	const subtle = subtleKeyAgreementCrypto();
	if ( !subtle ) {
		keyAgreementUnsupported( `${label}_async` );
	}
	try {
		return new BinaryString( new Uint8Array( await subtle.deriveBits(
			{ name: 'X25519', public: publicKey.__securePublicKey.key },
			keyAgreement.__secureKeyAgreement.key,
			256
		) ) );
	}
	catch ( _err ) {
		keyAgreementUnsupported( `${label}_async` );
	}
}

class Secure {
	static capabilities() {
		return capabilities();
	}

	static has( area, name ) {
		return hasCapability( area, name );
	}

	static require( area, name ) {
		return requireCapability( area, name );
	}
}

class KeyDerivation {
	static hkdf_sha256( inputKeyMaterial, length, salt = null, info = null ) {
		return hkdfSha256( inputKeyMaterial, length, salt, info );
	}

	static hkdf_sha256_async( inputKeyMaterial, length, salt = null, info = null ) {
		const args = hkdfSha256Inputs( inputKeyMaterial, length, salt, info );
		if ( subtleCrypto() ) {
			return taskRuntime.Task.from( webCryptoHkdfSha256( args ) );
		}
		return taskRuntime.Task.resolved(
			new BinaryString(
				hkdfSha256Bytes(
					args.inputKeyMaterial,
					args.length,
					args.salt,
					args.info
				)
			)
		);
	}
}

class SecureRandom {
	static bytes( length ) {
		if ( arguments.length !== 1 || length == null ) {
			throw new Error( 'SecureRandom.bytes expects a non-negative integer' );
		}
		return new BinaryString(
			randomBytes( nonNegativeInteger( length, 'SecureRandom.bytes' ) )
		);
	}

	static token( length = 32 ) {
		if ( length == null ) {
			length = 32;
		}
		return base64url(
			randomBytes( nonNegativeInteger( length, 'SecureRandom.token' ) )
		);
	}

	static int( max ) {
		return randomInt( positiveInteger( max, 'SecureRandom.int' ) );
	}
}
class PasswordHash {
	static default_algorithm() {
		return DEFAULT_PASSWORD_HASH_ALGORITHM;
	}

	static hash( password, options = null ) {
		return passwordHash( password, options );
	}

	static hash_async( password, options = null ) {
		return taskRuntime.Task.from( passwordHashAsyncValue( password, options ) );
	}

	static verify( password, encodedHash ) {
		return passwordHashVerify( password, encodedHash );
	}

	static verify_async( password, encodedHash ) {
		return taskRuntime.Task.from(
			passwordHashVerifyAsyncValue( password, encodedHash )
		);
	}

	static needs_rehash( encodedHash, options = null ) {
		return passwordHashNeedsRehash( encodedHash, options );
	}

	static derive_key( password, options = null ) {
		return passwordHashDeriveKey( password, options );
	}

	static derive_key_async( password, options = null ) {
		return taskRuntime.Task.from(
			passwordHashDeriveKeyAsyncValue( password, options )
		);
	}
}
class Cipher {
	static generate_key( algorithm = 'aes-256-gcm' ) {
		return cipherGenerateKey( algorithm );
	}

	static encrypt( plaintext, key, options = null ) {
		return cipherEncrypt( plaintext, key, options );
	}

	static decrypt( envelope, key, options = null ) {
		return cipherDecrypt( envelope, key, options );
	}

	static encrypt_async( plaintext, key, options = null ) {
		return cipherEncryptAsync( plaintext, key, options );
	}

	static decrypt_async( envelope, key, options = null ) {
		return cipherDecryptAsync( envelope, key, options );
	}
}
class KeyAgreement {
	constructor( secureKeyAgreement ) {
		if ( !( secureKeyAgreement instanceof SecureKeyAgreement ) ) {
			throw new Error( 'KeyAgreement objects are created by std/secure' );
		}
		this.__secureKeyAgreement = secureKeyAgreement;
	}

	static generate( algorithm = 'x25519' ) {
		return keyAgreementGenerate( algorithm );
	}

	static generate_async( algorithm = 'x25519' ) {
		return taskRuntime.Task.from(
			keyAgreementGenerateAsyncValue( algorithm )
		);
	}

	static import_private( key, options = null ) {
		return keyAgreementImportPrivate( key, options );
	}

	static import_private_async( key, options = null ) {
		return taskRuntime.Task.from(
			keyAgreementImportPrivateAsyncValue( key, options )
		);
	}

	static import_public( key, options = null ) {
		return keyAgreementImportPublic( key, options );
	}

	static import_public_async( key, options = null ) {
		return taskRuntime.Task.from(
			keyAgreementImportPublicAsyncValue( key, options )
		);
	}

	public_key() {
		return keyAgreementPublicKey( this );
	}

	derive( publicKey ) {
		return keyAgreementDerive( this, publicKey );
	}

	derive_async( publicKey ) {
		return taskRuntime.Task.from(
			keyAgreementDeriveAsyncValue( this, publicKey )
		);
	}

	export_private( options = null ) {
		return keyAgreementExportPrivate( this, options );
	}
}
class SigningKey {
	constructor( secureSigningKey ) {
		if ( !( secureSigningKey instanceof SecureSigningKey ) ) {
			throw new Error( 'SigningKey objects are created by std/secure' );
		}
		this.__secureSigningKey = secureSigningKey;
	}

	static generate( algorithm = 'ed25519' ) {
		return signingGenerate( algorithm );
	}

	static generate_async( algorithm = 'ed25519' ) {
		return taskRuntime.Task.from( signingGenerateAsyncValue( algorithm ) );
	}

	static import_private( key, options = null ) {
		return signingImportPrivate( key, options );
	}

	static import_private_async( key, options = null ) {
		return taskRuntime.Task.from(
			signingImportPrivateAsyncValue( key, options )
		);
	}

	static import_public( key, options = null ) {
		return signingImportPublic( key, options );
	}

	static import_public_async( key, options = null ) {
		return taskRuntime.Task.from(
			signingImportPublicAsyncValue( key, options )
		);
	}

	public_key() {
		return signingPublicKey( this );
	}

	sign( message ) {
		return signingSign( this, message );
	}

	sign_async( message ) {
		return taskRuntime.Task.from( signingSignAsyncValue( this, message ) );
	}

	export_private( options = null ) {
		return signingExportPrivate( this, options );
	}
}
class Certificate {
	constructor( secureCertificate ) {
		if ( !( secureCertificate instanceof SecureCertificate ) ) {
			throw new Error( 'Certificate objects are created by std/secure' );
		}
		this.__secureCertificate = secureCertificate;
	}

	static parse( input ) {
		return certificateParse( input );
	}

	static parse_chain( input ) {
		return certificateParseChain( input );
	}

	static verify_chain( chain, options = null ) {
		return certificateVerifyChain( chain, options );
	}

	subject() {
		return certificateState( this, 'Certificate.subject' ).subject;
	}

	issuer() {
		return certificateState( this, 'Certificate.issuer' ).issuer;
	}

	serial_number() {
		return certificateState( this, 'Certificate.serial_number' ).serial;
	}

	not_before() {
		return new Time( certificateState( this, 'Certificate.not_before' ).notBefore );
	}

	not_after() {
		return new Time( certificateState( this, 'Certificate.not_after' ).notAfter );
	}

	fingerprint( algorithm = 'sha256' ) {
		return certificateFingerprint( this, algorithm );
	}

	to_der() {
		return new BinaryString(
			Uint8Array.from( certificateState( this, 'Certificate.to_der' ).der )
		);
	}

	to_pem() {
		return certificateDerToPem(
			certificateState( this, 'Certificate.to_pem' ).der
		);
	}

	public_key() {
		return certificatePublicKey( this );
	}
}
class PrivateKey {}
class PublicKey {
	constructor( securePublicKey ) {
		if ( !( securePublicKey instanceof SecurePublicKey ) ) {
			throw new Error( 'PublicKey objects are created by std/secure' );
		}
		this.__securePublicKey = securePublicKey;
	}

	verify( message, signature ) {
		return publicKeyVerify( this, message, signature );
	}

	verify_async( message, signature ) {
		return taskRuntime.Task.from(
			publicKeyVerifyAsyncValue( this, message, signature )
		);
	}

	export( options = null ) {
		return publicKeyExport( this, options );
	}
}
class SealedBox {}
class TlsIdentity {
	constructor( secureTlsIdentity ) {
		if ( !( secureTlsIdentity instanceof SecureTlsIdentity ) ) {
			throw new Error( 'TlsIdentity objects are created by std/secure' );
		}
		this.__secureTlsIdentity = secureTlsIdentity;
	}

	static from_pem( certificatePem, privateKeyPem, password = null ) {
		return tlsIdentityFromPem( certificatePem, privateKeyPem, password );
	}

	static from_pkcs12( bytes, password = null ) {
		return tlsIdentityFromPkcs12( bytes, password );
	}

	certificate() {
		return tlsIdentityCertificate( this );
	}

	private_key() {
		return tlsIdentityPrivateKey( this );
	}
}

module.exports = {
	Secure,
	SecureRandom,
	PasswordHash,
	KeyDerivation,
	Cipher,
	KeyAgreement,
	SigningKey,
	Certificate,
	PrivateKey,
	PublicKey,
	SealedBox,
	TlsIdentity,
	__zuzu_set_runtime_policy: setRuntimePolicy,
};
