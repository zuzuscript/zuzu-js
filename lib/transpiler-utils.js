'use strict';

function isEscaped( text, idx ) {
	let k = idx - 1;
	let backslashes = 0;
	while ( k >= 0 && text[k] === '\\' ) {
		backslashes++;
		k--;
	}
	return ( backslashes % 2 ) === 1;
}

function findMatching( source, start, openChar, closeChar ) {
	let depth = 0;
	let quote = null;
	for ( let i = start; i < source.length; i++ ) {
		const ch = source[i];
		if ( quote ) {
			if ( ch === quote && !isEscaped( source, i ) ) {
				quote = null;
			}
			continue;
		}
		if ( ch === '"' || ch === '\'' || ch === '`' ) {
			quote = ch;
			continue;
		}
		if ( ch === openChar ) {
			depth++;
		}
		else if ( ch === closeChar ) {
			depth--;
			if ( depth === 0 ) {
				return i;
			}
		}
	}
	return -1;
}

function splitCaseValues( text ) {
	return text
		.split( ',' )
		.map( (v) => v.trim() )
		.filter( (v) => v.length > 0 );
}

function stripPod( source ) {
	const lines = source.split( /\r?\n/ );
	const out = [];
	let inPod = false;
	for ( const line of lines ) {
		if ( /^=cut\b/.test( line ) ) {
			inPod = false;
			continue;
		}
		if ( /^=\w+/.test( line ) ) {
			inPod = true;
			continue;
		}
		if ( inPod ) {
			continue;
		}
		out.push( line );
	}
	return out.join( '\n' );
}

function stripPodPreservingLines( source ) {
	const lines = source.split( /\r?\n/ );
	const out = [];
	let inPod = false;
	for ( const line of lines ) {
		if ( /^=cut\b/.test( line ) ) {
			inPod = false;
			out.push( '' );
			continue;
		}
		if ( /^=\w+/.test( line ) ) {
			inPod = true;
			out.push( '' );
			continue;
		}
		out.push( inPod ? '' : line );
	}
	return out.join( '\n' );
}

module.exports = {
	isEscaped,
	findMatching,
	splitCaseValues,
	stripPod,
	stripPodPreservingLines,
};
