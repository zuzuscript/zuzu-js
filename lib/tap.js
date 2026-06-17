'use strict';

function parseTap( tap ) {
	const lines = tap.split( /\r?\n/ );
	let planned = null;
	let planDirective = '';
	let tests = 0;
	let failures = 0;
	let todoFailures = 0;
	for ( const line of lines ) {
		const plan = line.match( /^(\d+)\.\.(\d+)(?:\s*#\s*(.*))?\s*$/u );
		if ( plan ) {
			planned = Number( plan[2] );
			planDirective = plan[3] || '';
			continue;
		}
		if ( /^ok\b/.test( line ) ) {
			tests++;
			continue;
		}
		if ( /^not ok\b/.test( line ) ) {
			tests++;
			if ( /#\s*TODO\b/iu.test( line ) ) {
				todoFailures++;
			}
			else {
				failures++;
			}
		}
	}
	return {
		planned,
		tests,
		failures,
		todoFailures,
		planDirective,
		skipAll: planned === 0 && /^SKIP\b/iu.test( planDirective ),
		validPlan: planned === null ? tests > 0 : planned === tests,
	};
}

module.exports = {
	parseTap,
};
