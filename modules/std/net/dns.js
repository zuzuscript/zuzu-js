'use strict';

const { spawnSync } = require( 'node:child_process' );
const dns = require( 'node:dns' );
const { Task, traceBlockingOperation } = require( '../task' );

let runtimePolicy = {};

const SUPPORTED = new Set( [
	'A',
	'AAAA',
	'CNAME',
	'MX',
	'NS',
	'PTR',
	'SRV',
	'TXT',
] );

function __zuzu_set_runtime_policy( policy = {} ) {
	runtimePolicy = policy || {};
}

function _requireDns() {
	if ( runtimePolicy.deny_net || runtimePolicy.host_name === 'browser' ) {
		throw new Error( 'DNSException: std/net/dns is unsupported in this runtime' );
	}
}

function _type( value = 'A' ) {
	const type = String( value ?? 'A' ).toUpperCase();
	if ( !SUPPORTED.has( type ) ) {
		throw new Error( `DNSException: unsupported DNS record type '${type}'` );
	}
	return type;
}

function _family( value = 'any' ) {
	const family = String( value ?? 'any' ).toLowerCase();
	if ( ![ 'any', 'ipv4', 'ipv6' ].includes( family ) ) {
		throw new Error( `DNSException: unsupported address family '${family}'` );
	}
	return family;
}

function _noData( err ) {
	return err && [ 'ENODATA', 'ENOTFOUND', 'ENODOMAIN' ].includes( err.code );
}

function _expectArity( name, count, min, max ) {
	if ( count >= min && count <= max ) {
		return;
	}
	const range = min === max ? String( min ) : `${min} or ${max}`;
	throw new Error( `DNSException: ${name} expects ${range} arguments` );
}

function _record( type, name, item ) {
	const out = {
		type,
		name: String( name ?? '' ),
		value: null,
		ttl: null,
	};
	if ( type === 'A' || type === 'AAAA' ) {
		out.address = typeof item === 'string' ? item : String( item.address ?? '' );
		out.value = out.address;
		if ( item && typeof item === 'object' && item.ttl != null ) {
			out.ttl = Number( item.ttl );
		}
	}
	else if ( type === 'CNAME' || type === 'NS' || type === 'PTR' ) {
		out.target = String( item ?? '' );
		out.value = out.target;
	}
	else if ( type === 'MX' ) {
		out.exchange = String( item.exchange ?? '' );
		out.preference = Number( item.priority ?? item.preference ?? 0 );
		out.value = out.exchange;
	}
	else if ( type === 'TXT' ) {
		const strings = Array.isArray( item ) ? item.map( String ) : [ String( item ?? '' ) ];
		out.strings = strings;
		out.text = strings.join( '' );
		out.value = out.text;
	}
	else if ( type === 'SRV' ) {
		out.target = String( item.name ?? item.target ?? '' );
		out.port = Number( item.port ?? 0 );
		out.priority = Number( item.priority ?? 0 );
		out.weight = Number( item.weight ?? 0 );
		out.value = out.target;
	}
	return out;
}

async function _lookupAsync( name, recordType = 'A' ) {
	_requireDns();
	const type = _type( recordType );
	const query = String( name ?? '' );
	try {
		let records;
		if ( type === 'A' ) {
			records = await dns.promises.resolve4( query, { ttl: true } );
		}
		else if ( type === 'AAAA' ) {
			records = await dns.promises.resolve6( query, { ttl: true } );
		}
		else {
			records = await dns.promises.resolve( query, type );
		}
		return records.map( (item) => _record( type, query, item ) );
	}
	catch ( err ) {
		if ( _noData( err ) ) {
			return [];
		}
		throw new Error( `DNSException: ${err.message || err.code || err}` );
	}
}

async function _addressesAsync( name, family = 'any' ) {
	_requireDns();
	const selected = _family( family );
	const query = String( name ?? '' );
	const familyNumber = selected === 'ipv4' ? 4 : selected === 'ipv6' ? 6 : 0;
	try {
		const records = await dns.promises.lookup( query, {
			all: true,
			family: familyNumber,
		} );
		return records.map( (item) => item.address );
	}
	catch ( err ) {
		if ( _noData( err ) ) {
			return [];
		}
		throw new Error( `DNSException: ${err.message || err.code || err}` );
	}
}

async function _reverseAsync( address ) {
	_requireDns();
	try {
		return await dns.promises.reverse( String( address ?? '' ) );
	}
	catch ( err ) {
		if ( _noData( err ) ) {
			return [];
		}
		throw new Error( `DNSException: ${err.message || err.code || err}` );
	}
}

function _nodeChildOptions() {
	const options = {
		encoding: 'utf8',
	};
	if ( runtimePolicy.host_name === 'electron' ) {
		options.env = {
			...process.env,
			ELECTRON_RUN_AS_NODE: '1',
		};
	}
	return options;
}

function _emptyResponseError( child ) {
	const detail = String( child.stderr || '' ).trim()
		|| (
			Number.isInteger( child.status )
				? `exit ${child.status}`
				: ''
		)
		|| (
			child.signal
				? `signal ${child.signal}`
				: ''
		)
		|| 'empty resolver response';
	return `empty resolver response (${detail})`;
}

function _syncRun( op, args ) {
	_requireDns();
	const source = `
		const dns = require( 'node:dns' );
		const payload = JSON.parse( process.argv[1] );
		const noData = ( err ) => err && [ 'ENODATA', 'ENOTFOUND', 'ENODOMAIN' ].includes( err.code );
		const record = ${_record.toString()};
		(async () => {
			try {
				let result;
				if ( payload.op === 'lookup' ) {
					if ( payload.args[1] === 'A' ) {
						result = ( await dns.promises.resolve4( payload.args[0], { ttl: true } ) )
							.map( ( item ) => record( 'A', payload.args[0], item ) );
					}
					else if ( payload.args[1] === 'AAAA' ) {
						result = ( await dns.promises.resolve6( payload.args[0], { ttl: true } ) )
							.map( ( item ) => record( 'AAAA', payload.args[0], item ) );
					}
					else {
						result = ( await dns.promises.resolve( payload.args[0], payload.args[1] ) )
							.map( ( item ) => record( payload.args[1], payload.args[0], item ) );
					}
				}
				else if ( payload.op === 'addresses' ) {
					const family = payload.args[1] === 'ipv4' ? 4 : payload.args[1] === 'ipv6' ? 6 : 0;
					result = ( await dns.promises.lookup( payload.args[0], { all: true, family } ) )
						.map( ( item ) => item.address );
				}
				else if ( payload.op === 'reverse' ) {
					result = await dns.promises.reverse( payload.args[0] );
				}
				process.stdout.write( JSON.stringify( { ok: true, result } ) );
			}
			catch ( err ) {
				if ( noData( err ) ) {
					process.stdout.write( JSON.stringify( { ok: true, result: [] } ) );
					return;
				}
				process.stdout.write( JSON.stringify( {
					ok: false,
					error: err && ( err.message || err.code ) ? err.message || err.code : String( err ),
				} ) );
			}
		})().catch( ( err ) => {
			process.stdout.write( JSON.stringify( { ok: false, error: String( err ) } ) );
		} );
	`;
	const payload = JSON.stringify( { op, args } );
	const child = spawnSync( process.execPath, [ '-e', source, payload ], {
		..._nodeChildOptions(),
	});
	if ( child.error ) {
		throw new Error( `DNSException: ${child.error.message}` );
	}
	let parsed;
	try {
		parsed = JSON.parse(
			child.stdout || JSON.stringify( {
				ok: false,
				error: _emptyResponseError( child ),
			} )
		);
	}
	catch ( err ) {
		throw new Error(
			`DNSException: invalid resolver response: ${err.message}`
		);
	}
	if ( !parsed.ok ) {
		throw new Error( `DNSException: ${parsed.error}` );
	}
	return parsed.result;
}

function lookup( name, recordType = 'A' ) {
	_expectArity( 'lookup()', arguments.length, 1, 2 );
	traceBlockingOperation( 'std/net/dns lookup' );
	return _syncRun( 'lookup', [ String( name ?? '' ), _type( recordType ) ] );
}

function lookup_async( name, recordType = 'A' ) {
	_expectArity( 'lookup_async()', arguments.length, 1, 2 );
	return new Task( () => _lookupAsync( name, recordType ), {
		name: 'dns.lookup_async',
	} );
}

function addresses( name, family = 'any' ) {
	_expectArity( 'addresses()', arguments.length, 1, 2 );
	traceBlockingOperation( 'std/net/dns addresses' );
	return _syncRun( 'addresses', [ String( name ?? '' ), _family( family ) ] );
}

function addresses_async( name, family = 'any' ) {
	_expectArity( 'addresses_async()', arguments.length, 1, 2 );
	return new Task( () => _addressesAsync( name, family ), {
		name: 'dns.addresses_async',
	} );
}

function reverse( address ) {
	_expectArity( 'reverse()', arguments.length, 1, 1 );
	traceBlockingOperation( 'std/net/dns reverse' );
	return _syncRun( 'reverse', [ String( address ?? '' ) ] );
}

function reverse_async( address ) {
	_expectArity( 'reverse_async()', arguments.length, 1, 1 );
	return new Task( () => _reverseAsync( address ), {
		name: 'dns.reverse_async',
	} );
}

module.exports = {
	__zuzu_set_runtime_policy,
	lookup,
	lookup_async,
	addresses,
	addresses_async,
	reverse,
	reverse_async,
};
