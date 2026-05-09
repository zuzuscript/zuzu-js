'use strict';

const fs = require( 'node:fs' );
const { parentPort, workerData } = require( 'node:worker_threads' );

let connection = null;

function writeResponse( message, payload ) {
	try {
		fs.writeFileSync(
			message.responsePath,
			JSON.stringify( payload ),
			'utf8'
		);
	}
	finally {
		const state = new Int32Array( message.signal );
		Atomics.store( state, 0, 1 );
		Atomics.notify( state, 0, 1 );
	}
}

function postgresSql( sql ) {
	let index = 0;
	let quote = null;
	let dollarQuote = null;
	let out = '';
	for ( let i = 0; i < sql.length; i++ ) {
		const ch = sql[i];
		const next = sql[i + 1];
		if ( dollarQuote ) {
			if ( sql.startsWith( dollarQuote, i ) ) {
				out += dollarQuote;
				i += dollarQuote.length - 1;
				dollarQuote = null;
				continue;
			}
			out += ch;
			continue;
		}
		if ( quote ) {
			out += ch;
			if ( ch === quote ) {
				if ( next === quote ) {
					out += next;
					i++;
				}
				else {
					quote = null;
				}
			}
			continue;
		}
		if ( ch === '-' && next === '-' ) {
			const end = sql.indexOf( '\n', i + 2 );
			if ( end < 0 ) {
				out += sql.slice( i );
				break;
			}
			out += sql.slice( i, end + 1 );
			i = end;
			continue;
		}
		if ( ch === '/' && next === '*' ) {
			const end = sql.indexOf( '*/', i + 2 );
			if ( end < 0 ) {
				out += sql.slice( i );
				break;
			}
			out += sql.slice( i, end + 2 );
			i = end + 1;
			continue;
		}
		if ( ch === '\'' || ch === '"' ) {
			quote = ch;
			out += ch;
			continue;
		}
		if ( ch === '$' ) {
			const match = sql.slice( i ).match( /^\$[A-Za-z_][A-Za-z0-9_]*\$|^\$\$/u );
			if ( match ) {
				dollarQuote = match[0];
				out += dollarQuote;
				i += dollarQuote.length - 1;
				continue;
			}
		}
		if ( ch === '?' ) {
			index++;
			out += `$${index}`;
			continue;
		}
		out += ch;
	}
	return out;
}

function mysqlTypeName( type ) {
	const mysql = require( 'mysql2' );
	const names = mysql.Types || {};
	for ( const [ name, value ] of Object.entries( names ) ) {
		if ( value === type ) {
			return name;
		}
	}
	return type == null ? null : String( type );
}

function postgresTypeName( oid ) {
	const names = {
		16: 'BOOLEAN',
		20: 'BIGINT',
		21: 'SMALLINT',
		23: 'INTEGER',
		25: 'TEXT',
		700: 'REAL',
		701: 'DOUBLE',
		1043: 'VARCHAR',
		1082: 'DATE',
		1114: 'TIMESTAMP',
		1184: 'TIMESTAMPTZ',
		1700: 'NUMERIC',
	};
	return names[oid] || ( oid == null ? null : String( oid ) );
}

function normalizeRowValue( value ) {
	if ( typeof value === 'bigint' ) {
		const number = Number( value );
		return Number.isSafeInteger( number ) ? number : String( value );
	}
	if ( Buffer.isBuffer( value ) ) {
		return Array.from( value );
	}
	return value;
}

function normalizeRows( rows ) {
	if ( !Array.isArray( rows ) ) {
		return [];
	}
	return rows.map( (row) => {
		const out = {};
		for ( const [ key, value ] of Object.entries( row ) ) {
			out[key] = normalizeRowValue( value );
		}
		return out;
	} );
}

async function connectMysql() {
	const mysql = require( 'mysql2/promise' );
	connection = await mysql.createConnection( workerData.config || {} );
}

async function connectPostgresql() {
	const pg = require( 'pg' );
	pg.types.setTypeParser( 20, (value) => Number( value ) );
	pg.types.setTypeParser( 21, (value) => Number( value ) );
	pg.types.setTypeParser( 23, (value) => Number( value ) );
	pg.types.setTypeParser( 700, (value) => Number( value ) );
	pg.types.setTypeParser( 701, (value) => Number( value ) );
	pg.types.setTypeParser( 1700, (value) => Number( value ) );
	connection = new pg.Client( workerData.config || {} );
	await connection.connect();
}

async function ensureConnected() {
	if ( connection ) {
		return;
	}
	if ( workerData.driver === 'mysql' ) {
		await connectMysql();
		return;
	}
	if ( workerData.driver === 'postgresql' ) {
		await connectPostgresql();
		return;
	}
	throw new Error( `unsupported SQL driver ${workerData.driver}` );
}

async function queryMysql( sql, values ) {
	const [ rows, fields ] = await connection.execute( sql, values );
	return {
		rows: normalizeRows( rows ),
		columns: Array.isArray( fields )
			? fields.map( (field) => ( {
				name: field.name,
				type: mysqlTypeName( field.columnType || field.type ),
			} ) )
			: [],
	};
}

async function queryPostgresql( sql, values ) {
	const result = await connection.query( postgresSql( sql ), values );
	return {
		rows: normalizeRows( result.rows ),
		columns: result.fields.map( (field) => ( {
			name: field.name,
			type: postgresTypeName( field.dataTypeID ),
		} ) ),
	};
}

async function runQuery( sql, values = [] ) {
	await ensureConnected();
	if ( workerData.driver === 'mysql' ) {
		return queryMysql( sql, values );
	}
	return queryPostgresql( sql, values );
}

async function handle( message ) {
	switch ( message.op ) {
		case 'connect':
			await ensureConnected();
			return true;
		case 'query':
			return runQuery( message.sql, message.values || [] );
		case 'begin':
			if ( workerData.driver === 'mysql' ) {
				return runQuery( 'start transaction', [] );
			}
			return runQuery( 'begin', [] );
		case 'commit':
			return runQuery( 'commit', [] );
		case 'rollback':
			return runQuery( 'rollback', [] );
		case 'close':
			if ( connection ) {
				await connection.end();
				connection = null;
			}
			return true;
		default:
			throw new Error( `unsupported database worker operation ${message.op}` );
	}
}

parentPort.on( 'message', (message) => {
	handle( message ).then(
		(result) => writeResponse( message, { ok: true, result } ),
		(err) => writeResponse( message, {
			ok: false,
			error: err && err.message ? err.message : String( err ),
		} )
	);
} );
