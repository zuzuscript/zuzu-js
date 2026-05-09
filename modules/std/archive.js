'use strict';

const fs = require( 'node:fs' );
const path = require( 'node:path' );
const zlib = require( 'node:zlib' );

const AdmZip = require( 'adm-zip' );
const compressjs = require( 'compressjs' );

const { BinaryString } = require( '../../lib/runtime-helpers' );
const { Path } = require( './io.js' );

function typeName( value ) {
	if ( value == null ) {
		return 'Null';
	}
	if ( value && value.bytes instanceof Uint8Array ) {
		return 'BinaryString';
	}
	if ( Array.isArray( value ) ) {
		return 'Array';
	}
	if ( typeof value === 'string' ) {
		return 'String';
	}
	if ( value.constructor && value.constructor.name ) {
		return value.constructor.name === 'Object' ? 'Dict' : value.constructor.name;
	}
	return typeof value;
}

function isPlainObject( value ) {
	return value != null
		&& typeof value === 'object'
		&& !Array.isArray( value )
		&& !( value instanceof Path )
		&& !( value && value.bytes instanceof Uint8Array );
}

function isPath( value ) {
	return value instanceof Path;
}

function assertBinaryString( value, label ) {
	if ( value && value.bytes instanceof Uint8Array ) {
		return Buffer.from( value.bytes );
	}
	throw new Error( `TypeException: ${label} expects BinaryString, got ${typeName( value )}` );
}

function pathFromObject( value, methodName ) {
	if ( isPath( value ) ) {
		return value;
	}
	throw new Error( `TypeException: ${methodName} expects Path as first argument` );
}

function normalizeFormat( raw ) {
	if ( raw == null || raw === '' ) {
		return 'auto';
	}
	const format = String( raw ).toLowerCase().replace( /^\./u, '' );
	const aliases = {
		auto: 'auto',
		zip: 'zip',
		tar: 'tar',
		'tar.gz': 'tar.gz',
		tgz: 'tar.gz',
		'gzip+tar': 'tar.gz',
		'tar.bz2': 'tar.bz2',
		tbz: 'tar.bz2',
		tbz2: 'tar.bz2',
		'bzip2+tar': 'tar.bz2',
		gz: 'gz',
		gzip: 'gz',
		bz2: 'bz2',
		bzip2: 'bz2',
	};
	if ( Object.prototype.hasOwnProperty.call( aliases, format ) ) {
		return aliases[format];
	}
	throw new Error( `Unsupported archive format '${raw}'` );
}

function formatFromName( name ) {
	if ( name == null || name === '' ) {
		return null;
	}
	const lower = String( name ).toLowerCase();
	if ( /\.tar\.gz$/u.test( lower ) || /\.tgz$/u.test( lower ) ) {
		return 'tar.gz';
	}
	if ( /\.tar\.bz2$/u.test( lower ) || /\.tbz2?$/u.test( lower ) ) {
		return 'tar.bz2';
	}
	if ( /\.zip$/u.test( lower ) ) {
		return 'zip';
	}
	if ( /\.tar$/u.test( lower ) ) {
		return 'tar';
	}
	if ( /\.gz$/u.test( lower ) ) {
		return 'gz';
	}
	if ( /\.bz2$/u.test( lower ) ) {
		return 'bz2';
	}
	return null;
}

function looksLikeTar( bytes ) {
	const buffer = Buffer.from( bytes );
	return buffer.length >= 512
		&& buffer.subarray( 257, 262 ).toString( 'ascii' ) === 'ustar';
}

function detectFormatFromBytes( bytes ) {
	const buffer = Buffer.from( bytes );
	if ( buffer.length >= 4 && buffer[0] === 0x50 && buffer[1] === 0x4b ) {
		return 'zip';
	}
	if ( buffer.length >= 2 && buffer[0] === 0x1f && buffer[1] === 0x8b ) {
		const raw = gunzipBytes( buffer ).data;
		return looksLikeTar( raw ) ? 'tar.gz' : 'gz';
	}
	if ( buffer.length >= 3 && buffer[0] === 0x42 && buffer[1] === 0x5a && buffer[2] === 0x68 ) {
		const raw = bunzip2Bytes( buffer );
		return looksLikeTar( raw ) ? 'tar.bz2' : 'bz2';
	}
	if ( looksLikeTar( buffer ) ) {
		return 'tar';
	}
	throw new Error( 'Could not detect archive format from bytes' );
}

function safeArchivePath( raw, label, allowEmpty = false ) {
	const value = raw == null ? '' : String( raw );
	if ( value === '' ) {
		if ( allowEmpty ) {
			return '';
		}
		throw new Error( `${label} requires path` );
	}
	const normalized = value.replace( /\\/gu, '/' );
	if ( normalized.startsWith( '/' ) ) {
		throw new Error( `${label} requires relative paths` );
	}
	const parts = normalized.split( '/' );
	for ( const part of parts ) {
		if ( part === '' || part === '.' || part === '..' ) {
			throw new Error( `${label} requires safe relative paths` );
		}
	}
	return parts.join( '/' );
}

function archiveEntryName( raw, label ) {
	if ( raw == null || String( raw ) === '' ) {
		throw new Error( `${label} requires path` );
	}
	return String( raw );
}

function archiveToValue( format, entries ) {
	return { format, entries };
}

function entryDataBytes( entry, label ) {
	if ( entry.data_value != null ) {
		return assertBinaryString( entry.data_value, `${label}.data` );
	}
	if ( entry.data_from_path != null ) {
		const sourcePath = entry.data_from_path;
		return Buffer.from( fs.readFileSync( sourcePath.to_String() ) );
	}
	throw new Error( `TypeException: ${label} expects BinaryString data or Path data_from` );
}

function entriesFromArchiveValue( archive, label ) {
	if ( !isPlainObject( archive ) ) {
		throw new Error( `TypeException: ${label} expects Dict archive, got ${typeName( archive )}` );
	}
	if ( !Array.isArray( archive.entries ) ) {
		throw new Error( `TypeException: ${label} expects archive.entries to be an Array` );
	}
	const entries = archive.entries.map( (entry, idx) => {
		if ( !isPlainObject( entry ) ) {
			throw new Error( `TypeException: ${label} expects archive.entries[${idx}] to be a Dict` );
		}
		const normalized = {
			path: entry.path == null ? null : String( entry.path ),
			label: `${label} archive.entries[${idx}]`,
		};
		if ( entry.data != null ) {
			normalized.data_value = entry.data;
		}
		else if ( entry.data_from != null ) {
			normalized.data_from_path = pathFromObject( entry.data_from, `${label} archive.entries[${idx}].data_from` );
		}
		else {
			throw new Error( `TypeException: ${label} archive.entries[${idx}] expects BinaryString data or Path data_from` );
		}
		return normalized;
	} );
	return [ entries, normalizeFormat( archive.format ) ];
}

function binaryValue( bytes ) {
	return new BinaryString( Uint8Array.from( bytes ) );
}

function decodeZipBytes( bytes ) {
	try {
		const zip = new AdmZip( Buffer.from( bytes ) );
		return zip.getEntries()
			.filter( (entry) => !entry.isDirectory )
			.map( (entry) => ( {
				path: entry.entryName,
				data: binaryValue( entry.getData() ),
			} ) );
	}
	catch ( err ) {
		throw new Error( `Archive decode failed: ${err.message}` );
	}
}

function encodeZipBytes( entries ) {
	try {
		const zip = new AdmZip();
		for ( const entry of entries ) {
			const name = archiveEntryName( entry.path, 'Archive.encode' );
			zip.addFile( name, entryDataBytes( entry, entry.label ) );
		}
		return zip.toBuffer();
	}
	catch ( err ) {
		if ( /^Archive\.encode/u.test( err.message ) ) {
			throw err;
		}
		throw new Error( `Archive encode failed: ${err.message}` );
	}
}

function tarString( buffer, start, length ) {
	const slice = buffer.subarray( start, start + length );
	const end = slice.indexOf( 0 );
	return slice.subarray( 0, end < 0 ? slice.length : end ).toString( 'utf8' );
}

function tarOctal( buffer, start, length ) {
	const text = tarString( buffer, start, length ).trim();
	return text === '' ? 0 : Number.parseInt( text, 8 );
}

function writeTarString( header, start, length, value ) {
	const bytes = Buffer.from( value, 'utf8' );
	if ( bytes.length > length ) {
		throw new Error( 'Archive.encode tar path is too long' );
	}
	bytes.copy( header, start );
}

function writeTarOctal( header, start, length, value ) {
	const text = value.toString( 8 ).padStart( length - 1, '0' );
	header.write( text.slice( -( length - 1 ) ), start, length - 1, 'ascii' );
	header[start + length - 1] = 0;
}

function splitTarPath( raw ) {
	const nameBytes = Buffer.byteLength( raw, 'utf8' );
	if ( nameBytes <= 100 ) {
		return { name: raw, prefix: '' };
	}
	const parts = raw.split( '/' );
	for ( let index = 1; index < parts.length; index++ ) {
		const prefix = parts.slice( 0, index ).join( '/' );
		const name = parts.slice( index ).join( '/' );
		if (
			Buffer.byteLength( prefix, 'utf8' ) <= 155
			&& Buffer.byteLength( name, 'utf8' ) <= 100
		) {
			return { name, prefix };
		}
	}
	throw new Error( 'Archive.encode tar path is too long' );
}

function createTarHeader( name, data ) {
	const header = Buffer.alloc( 512, 0 );
	const split = splitTarPath( name );
	writeTarString( header, 0, 100, split.name );
	writeTarOctal( header, 100, 8, 0o644 );
	writeTarOctal( header, 108, 8, 0 );
	writeTarOctal( header, 116, 8, 0 );
	writeTarOctal( header, 124, 12, data.length );
	writeTarOctal( header, 136, 12, Math.floor( Date.now() / 1000 ) );
	header.fill( 0x20, 148, 156 );
	header[156] = 0x30;
	header.write( 'ustar\0', 257, 6, 'ascii' );
	header.write( '00', 263, 2, 'ascii' );
	writeTarString( header, 345, 155, split.prefix );
	let checksum = 0;
	for ( const byte of header ) {
		checksum += byte;
	}
	const checksumText = checksum.toString( 8 ).padStart( 6, '0' );
	header.write( checksumText.slice( -6 ), 148, 6, 'ascii' );
	header[154] = 0;
	header[155] = 0x20;
	return header;
}

function encodeTarBytes( entries, format ) {
	const chunks = [];
	for ( const entry of entries ) {
		const name = archiveEntryName( entry.path, 'Archive.encode' );
		const data = entryDataBytes( entry, entry.label );
		chunks.push( createTarHeader( name, data ) );
		chunks.push( data );
		const padding = ( 512 - ( data.length % 512 ) ) % 512;
		if ( padding > 0 ) {
			chunks.push( Buffer.alloc( padding, 0 ) );
		}
	}
	chunks.push( Buffer.alloc( 1024, 0 ) );
	const tarBytes = Buffer.concat( chunks );
	if ( format === 'tar.gz' ) {
		return gzipBytes( tarBytes );
	}
	if ( format === 'tar.bz2' ) {
		return bzip2Bytes( tarBytes );
	}
	return tarBytes;
}

function decodeTarBytes( bytes, format ) {
	let buffer = Buffer.from( bytes );
	if ( format === 'tar.gz' ) {
		buffer = gunzipBytes( buffer ).data;
	}
	else if ( format === 'tar.bz2' ) {
		buffer = bunzip2Bytes( buffer );
	}
	const entries = [];
	for ( let offset = 0; offset + 512 <= buffer.length; ) {
		const header = buffer.subarray( offset, offset + 512 );
		offset += 512;
		if ( header.every( (byte) => byte === 0 ) ) {
			break;
		}
		const size = tarOctal( header, 124, 12 );
		const type = header[156];
		const name = tarString( header, 0, 100 );
		const prefix = tarString( header, 345, 155 );
		const fullName = prefix === '' ? name : `${prefix}/${name}`;
		const data = buffer.subarray( offset, offset + size );
		offset += size + ( ( 512 - ( size % 512 ) ) % 512 );
		if ( type === 0 || type === 0x30 ) {
			entries.push( {
				path: fullName,
				data: binaryValue( data ),
			} );
		}
	}
	return entries;
}

const CRC32_TABLE = (() => {
	const table = new Uint32Array( 256 );
	for ( let i = 0; i < 256; i++ ) {
		let crc = i;
		for ( let bit = 0; bit < 8; bit++ ) {
			crc = ( crc & 1 ) ? ( 0xedb88320 ^ ( crc >>> 1 ) ) : ( crc >>> 1 );
		}
		table[i] = crc >>> 0;
	}
	return table;
})();

function crc32( bytes ) {
	let crc = 0xffffffff;
	for ( const byte of bytes ) {
		crc = CRC32_TABLE[( crc ^ byte ) & 0xff] ^ ( crc >>> 8 );
	}
	return ( crc ^ 0xffffffff ) >>> 0;
}

function gzipBytes( bytes, fileName = null ) {
	const data = Buffer.from( bytes );
	const parts = [
		Buffer.from( [ 0x1f, 0x8b, 0x08, fileName ? 0x08 : 0x00, 0, 0, 0, 0, 0, 0xff ] ),
	];
	if ( fileName ) {
		parts.push( Buffer.from( fileName, 'utf8' ), Buffer.from( [ 0 ] ) );
	}
	parts.push( zlib.deflateRawSync( data ) );
	const trailer = Buffer.alloc( 8 );
	trailer.writeUInt32LE( crc32( data ), 0 );
	trailer.writeUInt32LE( data.length >>> 0, 4 );
	parts.push( trailer );
	return Buffer.concat( parts );
}

function gunzipBytes( bytes ) {
	const buffer = Buffer.from( bytes );
	return {
		data: zlib.gunzipSync( buffer ),
		name: parseGzipName( buffer ),
	};
}

function bzip2Bytes( bytes ) {
	return Buffer.from( compressjs.Bzip2.compressFile( Buffer.from( bytes ) ) );
}

function bunzip2Bytes( bytes ) {
	try {
		return Buffer.from( compressjs.Bzip2.decompressFile( Buffer.from( bytes ) ) );
	}
	catch ( err ) {
		throw new Error( `Archive decode failed: ${err.message}` );
	}
}

function parseGzipName( bytes ) {
	if ( bytes.length < 10 || bytes[0] !== 0x1f || bytes[1] !== 0x8b ) {
		return null;
	}
	const flags = bytes[3];
	let index = 10;
	if ( flags & 0x04 ) {
		if ( index + 1 >= bytes.length ) {
			return null;
		}
		const xlen = bytes[index] | ( bytes[index + 1] << 8 );
		index += 2 + xlen;
	}
	if ( flags & 0x08 ) {
		let end = index;
		while ( end < bytes.length && bytes[end] !== 0x00 ) {
			end++;
		}
		if ( end <= bytes.length ) {
			return Buffer.from( bytes.slice( index, end ) ).toString( 'utf8' );
		}
	}
	return null;
}

function decodeSingleCompressedBytes( bytes, format, defaultName = null ) {
	if ( format === 'gz' ) {
		const decoded = gunzipBytes( bytes );
		return [
			{
				path: decoded.name || defaultName,
				data: binaryValue( decoded.data ),
			},
		];
	}
	return [
		{
			path: defaultName,
			data: binaryValue( bunzip2Bytes( bytes ) ),
		},
	];
}

function encodeSingleCompressedBytes( entries, format ) {
	if ( entries.length !== 1 ) {
		throw new Error( `Archive.encode with format '${format}' expects exactly one entry` );
	}
	const entry = entries[0];
	const fileName = entry.path == null || entry.path === ''
		? 'payload.bin'
		: path.basename( safeArchivePath( entry.path, 'Archive.encode' ) );
	const data = entryDataBytes( entry, entry.label );
	if ( format === 'gz' ) {
		return gzipBytes( data, fileName );
	}
	return bzip2Bytes( data );
}

function deriveSingleEntryNameFromPath( pathObj, format ) {
	let name = path.basename( pathObj.to_String() );
	if ( format === 'gz' ) {
		name = name.replace( /\.(?:gz|gzip)$/iu, '' );
	}
	else if ( format === 'bz2' ) {
		name = name.replace( /\.bz2$/iu, '' );
	}
	return name === '' ? null : name;
}

function resolveFormatForEncode( pathName, archiveFormat, givenFormat ) {
	const pathFormat = formatFromName( pathName );
	let format = normalizeFormat( givenFormat );
	if ( format === 'auto' && archiveFormat !== 'auto' ) {
		format = archiveFormat;
	}
	if ( format === 'auto' && pathFormat != null ) {
		format = pathFormat;
	}
	if ( format === 'auto' ) {
		throw new Error( 'Archive format is required when it cannot be inferred from path' );
	}
	return format;
}

class Archive {
	static decode( bytesValue, formatValue = null ) {
		const bytes = assertBinaryString( bytesValue, 'Archive.decode' );
		let format = normalizeFormat( formatValue );
		if ( format === 'auto' ) {
			format = detectFormatFromBytes( bytes );
		}
		if ( format === 'zip' ) {
			return archiveToValue( format, decodeZipBytes( bytes ) );
		}
		if ( format === 'tar' || format === 'tar.gz' || format === 'tar.bz2' ) {
			return archiveToValue( format, decodeTarBytes( bytes, format ) );
		}
		if ( format === 'gz' || format === 'bz2' ) {
			return archiveToValue( format, decodeSingleCompressedBytes( bytes, format ) );
		}
		throw new Error( `Unsupported archive format '${format}'` );
	}

	static encode( archiveValue, formatValue = null ) {
		const [ entries, archiveFormat ] = entriesFromArchiveValue( archiveValue, 'Archive.encode' );
		let format = normalizeFormat( formatValue );
		if ( format === 'auto' && archiveFormat !== 'auto' ) {
			format = archiveFormat;
		}
		if ( format === 'auto' ) {
			throw new Error( 'Archive.encode requires an explicit format' );
		}
		if ( format === 'zip' ) {
			return binaryValue( encodeZipBytes( entries ) );
		}
		if ( format === 'tar' || format === 'tar.gz' || format === 'tar.bz2' ) {
			return binaryValue( encodeTarBytes( entries, format ) );
		}
		if ( format === 'gz' || format === 'bz2' ) {
			return binaryValue( encodeSingleCompressedBytes( entries, format ) );
		}
		throw new Error( `Unsupported archive format '${format}'` );
	}

	static load( pathValue, formatValue = null ) {
		const archivePath = pathFromObject( pathValue, 'Archive.load' );
		const bytes = fs.readFileSync( archivePath.to_String() );
		let format = normalizeFormat( formatValue );
		if ( format === 'auto' ) {
			format = formatFromName( archivePath.to_String() ) || detectFormatFromBytes( bytes );
		}
		if ( format === 'zip' ) {
			return archiveToValue( format, decodeZipBytes( bytes ) );
		}
		if ( format === 'tar' || format === 'tar.gz' || format === 'tar.bz2' ) {
			return archiveToValue( format, decodeTarBytes( bytes, format ) );
		}
		if ( format === 'gz' || format === 'bz2' ) {
			return archiveToValue(
				format,
				decodeSingleCompressedBytes(
					bytes,
					format,
					deriveSingleEntryNameFromPath( archivePath, format )
				)
			);
		}
		throw new Error( `Unsupported archive format '${format}'` );
	}

	static dump( pathValue, archiveValue, formatValue = null ) {
		const archivePath = pathFromObject( pathValue, 'Archive.dump' );
		const [ entries, archiveFormat ] = entriesFromArchiveValue( archiveValue, 'Archive.dump' );
		const format = resolveFormatForEncode(
			archivePath.to_String(),
			archiveFormat,
			formatValue
		);
		let bytes;
		if ( format === 'zip' ) {
			bytes = encodeZipBytes( entries );
		}
		else if ( format === 'tar' || format === 'tar.gz' || format === 'tar.bz2' ) {
			bytes = encodeTarBytes( entries, format );
		}
		else if ( format === 'gz' || format === 'bz2' ) {
			bytes = encodeSingleCompressedBytes( entries, format );
		}
		else {
			throw new Error( `Unsupported archive format '${format}'` );
		}
		fs.writeFileSync( archivePath.to_String(), bytes );
		return archivePath;
	}
}

module.exports = {
	Archive,
};
