'use strict';

const { BinaryString } = require( '../../../lib/runtime-helpers' );

function valueType( value ) {
	if ( value == null ) {
		return 'Null';
	}
	if ( typeof value === 'string' ) {
		return 'String';
	}
	return value.constructor && value.constructor.name ? value.constructor.name : typeof value;
}

function assertBinary( value, fnName, label = 'BinaryString' ) {
	if ( !value || !( value.bytes instanceof Uint8Array ) ) {
		throw new Error( `TypeException: ${fnName} expects ${label}, got ${valueType( value )}` );
	}
}

function toBinary( bytes ) {
	return new BinaryString( Uint8Array.from( bytes ) );
}

function bytesToHex( bytes ) {
	return Array.from( bytes, (byte) => byte.toString( 16 ).padStart( 2, '0' ) ).join( '' );
}

function bytesToBase64( bytes ) {
	if ( typeof Buffer !== 'undefined' ) {
		return Buffer.from( bytes ).toString( 'base64' ).replace( /=+$/u, '' );
	}
	let text = '';
	for ( let i = 0; i < bytes.length; i++ ) {
		text += String.fromCharCode( bytes[i] );
	}
	return btoa( text ).replace( /=+$/u, '' );
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

function padded64( bytes, littleEndianLength = false ) {
	const bitLength = bytes.length * 8;
	const total = Math.ceil( ( bytes.length + 9 ) / 64 ) * 64;
	const out = new Uint8Array( total );
	out.set( bytes );
	out[bytes.length] = 0x80;
	if ( littleEndianLength ) {
		let n = bitLength;
		for ( let i = 0; i < 8; i++ ) {
			out[total - 8 + i] = n & 0xff;
			n = Math.floor( n / 256 );
		}
	}
	else {
		let n = bitLength;
		for ( let i = 7; i >= 0; i-- ) {
			out[total - 8 + i] = n & 0xff;
			n = Math.floor( n / 256 );
		}
	}
	return out;
}

function padded128( bytes ) {
	const bitLength = BigInt( bytes.length ) * 8n;
	const total = Math.ceil( ( bytes.length + 17 ) / 128 ) * 128;
	const out = new Uint8Array( total );
	out.set( bytes );
	out[bytes.length] = 0x80;
	let n = bitLength;
	for ( let i = 15; i >= 0; i-- ) {
		out[total - 16 + i] = Number( n & 0xffn );
		n >>= 8n;
	}
	return out;
}

function rotl32( value, bits ) {
	return ( ( value << bits ) | ( value >>> ( 32 - bits ) ) ) >>> 0;
}

function rotr32( value, bits ) {
	return ( ( value >>> bits ) | ( value << ( 32 - bits ) ) ) >>> 0;
}

function add32( ...values ) {
	return values.reduce( (sum, value) => ( sum + value ) >>> 0, 0 );
}

function md5Bytes( bytes ) {
	const s = [
		7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22,
		5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20,
		4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23,
		6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21,
	];
	const k = Array.from(
		{ length: 64 },
		( _value, i ) => Math.floor( Math.abs( Math.sin( i + 1 ) ) * 0x100000000 ) >>> 0,
	);
	const data = padded64( bytes, true );
	let a0 = 0x67452301;
	let b0 = 0xefcdab89;
	let c0 = 0x98badcfe;
	let d0 = 0x10325476;

	for ( let offset = 0; offset < data.length; offset += 64 ) {
		const m = new Uint32Array( 16 );
		for ( let i = 0; i < 16; i++ ) {
			const j = offset + i * 4;
			m[i] = data[j] | ( data[j + 1] << 8 ) | ( data[j + 2] << 16 ) | ( data[j + 3] << 24 );
		}
		let a = a0;
		let b = b0;
		let c = c0;
		let d = d0;
		for ( let i = 0; i < 64; i++ ) {
			let f;
			let g;
			if ( i < 16 ) {
				f = ( b & c ) | ( ( ~b ) & d );
				g = i;
			}
			else if ( i < 32 ) {
				f = ( d & b ) | ( ( ~d ) & c );
				g = ( 5 * i + 1 ) % 16;
			}
			else if ( i < 48 ) {
				f = b ^ c ^ d;
				g = ( 3 * i + 5 ) % 16;
			}
			else {
				f = c ^ ( b | ( ~d ) );
				g = ( 7 * i ) % 16;
			}
			const tmp = d;
			d = c;
			c = b;
			b = add32( b, rotl32( add32( a, f, k[i], m[g] ), s[i] ) );
			a = tmp;
		}
		a0 = add32( a0, a );
		b0 = add32( b0, b );
		c0 = add32( c0, c );
		d0 = add32( d0, d );
	}

	const out = new Uint8Array( 16 );
	for ( const [ index, value ] of [ a0, b0, c0, d0 ].entries() ) {
		out[index * 4] = value & 0xff;
		out[index * 4 + 1] = ( value >>> 8 ) & 0xff;
		out[index * 4 + 2] = ( value >>> 16 ) & 0xff;
		out[index * 4 + 3] = ( value >>> 24 ) & 0xff;
	}
	return out;
}

function sha1Bytes( bytes ) {
	const data = padded64( bytes );
	let h0 = 0x67452301;
	let h1 = 0xefcdab89;
	let h2 = 0x98badcfe;
	let h3 = 0x10325476;
	let h4 = 0xc3d2e1f0;
	for ( let offset = 0; offset < data.length; offset += 64 ) {
		const w = new Uint32Array( 80 );
		for ( let i = 0; i < 16; i++ ) {
			const j = offset + i * 4;
			w[i] = ( data[j] << 24 ) | ( data[j + 1] << 16 ) | ( data[j + 2] << 8 ) | data[j + 3];
		}
		for ( let i = 16; i < 80; i++ ) {
			w[i] = rotl32( w[i - 3] ^ w[i - 8] ^ w[i - 14] ^ w[i - 16], 1 );
		}
		let a = h0;
		let b = h1;
		let c = h2;
		let d = h3;
		let e = h4;
		for ( let i = 0; i < 80; i++ ) {
			let f;
			let k;
			if ( i < 20 ) {
				f = ( b & c ) | ( ( ~b ) & d );
				k = 0x5a827999;
			}
			else if ( i < 40 ) {
				f = b ^ c ^ d;
				k = 0x6ed9eba1;
			}
			else if ( i < 60 ) {
				f = ( b & c ) | ( b & d ) | ( c & d );
				k = 0x8f1bbcdc;
			}
			else {
				f = b ^ c ^ d;
				k = 0xca62c1d6;
			}
			const temp = add32( rotl32( a, 5 ), f, e, k, w[i] );
			e = d;
			d = c;
			c = rotl32( b, 30 );
			b = a;
			a = temp;
		}
		h0 = add32( h0, a );
		h1 = add32( h1, b );
		h2 = add32( h2, c );
		h3 = add32( h3, d );
		h4 = add32( h4, e );
	}
	return words32ToBytes( [ h0, h1, h2, h3, h4 ] );
}

const SHA256_K = [
	0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
	0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
	0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
	0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
	0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
	0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
	0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
	0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
];

function words32ToBytes( words ) {
	const out = new Uint8Array( words.length * 4 );
	for ( let i = 0; i < words.length; i++ ) {
		out[i * 4] = ( words[i] >>> 24 ) & 0xff;
		out[i * 4 + 1] = ( words[i] >>> 16 ) & 0xff;
		out[i * 4 + 2] = ( words[i] >>> 8 ) & 0xff;
		out[i * 4 + 3] = words[i] & 0xff;
	}
	return out;
}

function sha256Core( bytes, initial ) {
	const data = padded64( bytes );
	const h = initial.slice();
	for ( let offset = 0; offset < data.length; offset += 64 ) {
		const w = new Uint32Array( 64 );
		for ( let i = 0; i < 16; i++ ) {
			const j = offset + i * 4;
			w[i] = ( data[j] << 24 ) | ( data[j + 1] << 16 ) | ( data[j + 2] << 8 ) | data[j + 3];
		}
		for ( let i = 16; i < 64; i++ ) {
			const s0 = rotr32( w[i - 15], 7 ) ^ rotr32( w[i - 15], 18 ) ^ ( w[i - 15] >>> 3 );
			const s1 = rotr32( w[i - 2], 17 ) ^ rotr32( w[i - 2], 19 ) ^ ( w[i - 2] >>> 10 );
			w[i] = add32( w[i - 16], s0, w[i - 7], s1 );
		}
		let [ a, b, c, d, e, f, g, hh ] = h;
		for ( let i = 0; i < 64; i++ ) {
			const s1 = rotr32( e, 6 ) ^ rotr32( e, 11 ) ^ rotr32( e, 25 );
			const ch = ( e & f ) ^ ( ( ~e ) & g );
			const temp1 = add32( hh, s1, ch, SHA256_K[i], w[i] );
			const s0 = rotr32( a, 2 ) ^ rotr32( a, 13 ) ^ rotr32( a, 22 );
			const maj = ( a & b ) ^ ( a & c ) ^ ( b & c );
			const temp2 = add32( s0, maj );
			hh = g;
			g = f;
			f = e;
			e = add32( d, temp1 );
			d = c;
			c = b;
			b = a;
			a = add32( temp1, temp2 );
		}
		for ( const [ i, value ] of [ a, b, c, d, e, f, g, hh ].entries() ) {
			h[i] = add32( h[i], value );
		}
	}
	return words32ToBytes( h );
}

function sha224Bytes( bytes ) {
	return sha256Core(
		bytes,
		[ 0xc1059ed8, 0x367cd507, 0x3070dd17, 0xf70e5939, 0xffc00b31, 0x68581511, 0x64f98fa7, 0xbefa4fa4 ],
	).slice( 0, 28 );
}

function sha256Bytes( bytes ) {
	return sha256Core(
		bytes,
		[ 0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19 ],
	);
}

const MASK64 = ( 1n << 64n ) - 1n;
const SHA512_K = [
	0x428a2f98d728ae22n, 0x7137449123ef65cdn, 0xb5c0fbcfec4d3b2fn, 0xe9b5dba58189dbbcn,
	0x3956c25bf348b538n, 0x59f111f1b605d019n, 0x923f82a4af194f9bn, 0xab1c5ed5da6d8118n,
	0xd807aa98a3030242n, 0x12835b0145706fben, 0x243185be4ee4b28cn, 0x550c7dc3d5ffb4e2n,
	0x72be5d74f27b896fn, 0x80deb1fe3b1696b1n, 0x9bdc06a725c71235n, 0xc19bf174cf692694n,
	0xe49b69c19ef14ad2n, 0xefbe4786384f25e3n, 0x0fc19dc68b8cd5b5n, 0x240ca1cc77ac9c65n,
	0x2de92c6f592b0275n, 0x4a7484aa6ea6e483n, 0x5cb0a9dcbd41fbd4n, 0x76f988da831153b5n,
	0x983e5152ee66dfabn, 0xa831c66d2db43210n, 0xb00327c898fb213fn, 0xbf597fc7beef0ee4n,
	0xc6e00bf33da88fc2n, 0xd5a79147930aa725n, 0x06ca6351e003826fn, 0x142929670a0e6e70n,
	0x27b70a8546d22ffcn, 0x2e1b21385c26c926n, 0x4d2c6dfc5ac42aedn, 0x53380d139d95b3dfn,
	0x650a73548baf63den, 0x766a0abb3c77b2a8n, 0x81c2c92e47edaee6n, 0x92722c851482353bn,
	0xa2bfe8a14cf10364n, 0xa81a664bbc423001n, 0xc24b8b70d0f89791n, 0xc76c51a30654be30n,
	0xd192e819d6ef5218n, 0xd69906245565a910n, 0xf40e35855771202an, 0x106aa07032bbd1b8n,
	0x19a4c116b8d2d0c8n, 0x1e376c085141ab53n, 0x2748774cdf8eeb99n, 0x34b0bcb5e19b48a8n,
	0x391c0cb3c5c95a63n, 0x4ed8aa4ae3418acbn, 0x5b9cca4f7763e373n, 0x682e6ff3d6b2b8a3n,
	0x748f82ee5defb2fcn, 0x78a5636f43172f60n, 0x84c87814a1f0ab72n, 0x8cc702081a6439ecn,
	0x90befffa23631e28n, 0xa4506cebde82bde9n, 0xbef9a3f7b2c67915n, 0xc67178f2e372532bn,
	0xca273eceea26619cn, 0xd186b8c721c0c207n, 0xeada7dd6cde0eb1en, 0xf57d4f7fee6ed178n,
	0x06f067aa72176fban, 0x0a637dc5a2c898a6n, 0x113f9804bef90daen, 0x1b710b35131c471bn,
	0x28db77f523047d84n, 0x32caab7b40c72493n, 0x3c9ebe0a15c9bebcn, 0x431d67c49c100d4cn,
	0x4cc5d4becb3e42b6n, 0x597f299cfc657e2an, 0x5fcb6fab3ad6faecn, 0x6c44198c4a475817n,
];

function rotr64( value, bits ) {
	const n = BigInt( bits );
	return ( ( value >> n ) | ( value << ( 64n - n ) ) ) & MASK64;
}

function add64( ...values ) {
	return values.reduce( (sum, value) => ( sum + value ) & MASK64, 0n );
}

function words64ToBytes( words ) {
	const out = new Uint8Array( words.length * 8 );
	for ( let i = 0; i < words.length; i++ ) {
		let value = words[i];
		for ( let j = 7; j >= 0; j-- ) {
			out[i * 8 + j] = Number( value & 0xffn );
			value >>= 8n;
		}
	}
	return out;
}

function sha512Core( bytes, initial ) {
	const data = padded128( bytes );
	const h = initial.slice();
	for ( let offset = 0; offset < data.length; offset += 128 ) {
		const w = new Array( 80 ).fill( 0n );
		for ( let i = 0; i < 16; i++ ) {
			let value = 0n;
			for ( let j = 0; j < 8; j++ ) {
				value = ( value << 8n ) | BigInt( data[offset + i * 8 + j] );
			}
			w[i] = value;
		}
		for ( let i = 16; i < 80; i++ ) {
			const s0 = rotr64( w[i - 15], 1 ) ^ rotr64( w[i - 15], 8 ) ^ ( w[i - 15] >> 7n );
			const s1 = rotr64( w[i - 2], 19 ) ^ rotr64( w[i - 2], 61 ) ^ ( w[i - 2] >> 6n );
			w[i] = add64( w[i - 16], s0, w[i - 7], s1 );
		}
		let [ a, b, c, d, e, f, g, hh ] = h;
		for ( let i = 0; i < 80; i++ ) {
			const s1 = rotr64( e, 14 ) ^ rotr64( e, 18 ) ^ rotr64( e, 41 );
			const ch = ( e & f ) ^ ( ( ~e ) & g );
			const temp1 = add64( hh, s1, ch, SHA512_K[i], w[i] );
			const s0 = rotr64( a, 28 ) ^ rotr64( a, 34 ) ^ rotr64( a, 39 );
			const maj = ( a & b ) ^ ( a & c ) ^ ( b & c );
			const temp2 = add64( s0, maj );
			hh = g;
			g = f;
			f = e;
			e = add64( d, temp1 );
			d = c;
			c = b;
			b = a;
			a = add64( temp1, temp2 );
		}
		for ( const [ i, value ] of [ a, b, c, d, e, f, g, hh ].entries() ) {
			h[i] = add64( h[i], value );
		}
	}
	return words64ToBytes( h );
}

function sha384Bytes( bytes ) {
	return sha512Core(
		bytes,
		[
			0xcbbb9d5dc1059ed8n, 0x629a292a367cd507n, 0x9159015a3070dd17n, 0x152fecd8f70e5939n,
			0x67332667ffc00b31n, 0x8eb44a8768581511n, 0xdb0c2e0d64f98fa7n, 0x47b5481dbefa4fa4n,
		],
	).slice( 0, 48 );
}

function sha512Bytes( bytes ) {
	return sha512Core(
		bytes,
		[
			0x6a09e667f3bcc908n, 0xbb67ae8584caa73bn, 0x3c6ef372fe94f82bn, 0xa54ff53a5f1d36f1n,
			0x510e527fade682d1n, 0x9b05688c2b3e6c1fn, 0x1f83d9abfb41bd6bn, 0x5be0cd19137e2179n,
		],
	);
}

const ALGORITHMS = {
	md5: { blockSize: 64, digest: md5Bytes },
	sha1: { blockSize: 64, digest: sha1Bytes },
	sha224: { blockSize: 64, digest: sha224Bytes },
	sha256: { blockSize: 64, digest: sha256Bytes },
	sha384: { blockSize: 128, digest: sha384Bytes },
	sha512: { blockSize: 128, digest: sha512Bytes },
};

function digestBytes( algorithm, value, fnName ) {
	assertBinary( value, fnName );
	return ALGORITHMS[algorithm].digest( value.bytes );
}

function hmacBytes( algorithm, value, key, fnName ) {
	assertBinary( value, fnName );
	assertBinary( key, fnName, 'BinaryString key' );
	const spec = ALGORITHMS[algorithm];
	let keyBytes = key.bytes;
	if ( keyBytes.length > spec.blockSize ) {
		keyBytes = spec.digest( keyBytes );
	}
	const paddedKey = new Uint8Array( spec.blockSize );
	paddedKey.set( keyBytes );
	const innerKey = new Uint8Array( spec.blockSize );
	const outerKey = new Uint8Array( spec.blockSize );
	for ( let i = 0; i < spec.blockSize; i++ ) {
		innerKey[i] = paddedKey[i] ^ 0x36;
		outerKey[i] = paddedKey[i] ^ 0x5c;
	}
	return spec.digest( concatBytes( outerKey, spec.digest( concatBytes( innerKey, value.bytes ) ) ) );
}

module.exports = {
	digestBytes,
	hmacBytes,
	toBinary,
	bytesToHex,
	bytesToBase64,
};
