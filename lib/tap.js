'use strict';

function parseTap( tap ) {
	const lines = tap.split( /\r?\n/ );
	let planned = null;
	let tests = 0;
	let failures = 0;
	for ( const line of lines ) {
		if ( /^\d+\.\.\d+\s*$/.test( line ) ) {
			planned = Number( line.trim().split( '..' )[1] );
			continue;
		}
		if ( /^ok\b/.test( line ) ) {
			tests++;
			continue;
		}
		if ( /^not ok\b/.test( line ) ) {
			tests++;
			failures++;
		}
	}
	return {
		planned,
		tests,
		failures,
		validPlan: planned === null ? tests > 0 : planned === tests,
	};
}

module.exports = {
	parseTap,
};
