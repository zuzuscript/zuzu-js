'use strict';

const MODULE_CAPABILITIES = {
	'std/io': [ 'fs' ],
	'std/io/socks': [ 'fs', 'net' ],
	'std/proc': [ 'proc' ],
	'std/db': [ 'db' ],
	'std/clib': [ 'clib' ],
	'std/gui/objects': [ 'gui' ],
	'std/net/dns': [ 'net' ],
	'std/net/http': [ 'http' ],
	'std/worker': [ 'worker' ],
	'perl': [ 'perl' ],
	'javascript': [ 'js' ],
};

const BROWSER_SAFE_MODULES = new Set( [
	'std/string',
	'std/time',
	'std/data/json',
	'std/data/xml',
	'std/net/http',
	'std/net/smtp',
	'std/secure',
	'std/math',
	'std/eval',
	'std/colour',
	'std/gui',
	'std/gui/dialogue',
	'std/gui/objects',
	'std/tui',
] );

function capabilitiesForModule( moduleName ) {
	for ( const [ prefix, capabilities ] of Object.entries( MODULE_CAPABILITIES ) ) {
		if ( moduleName === prefix || moduleName.startsWith( `${prefix}/` ) ) {
			return capabilities.slice();
		}
	}
	return [];
}

module.exports = {
	MODULE_CAPABILITIES,
	BROWSER_SAFE_MODULES,
	capabilitiesForModule,
};
