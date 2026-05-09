'use strict';

const { createNodeHost } = require( './node-host' );

function createElectronHost( options = {} ) {
	const host = createNodeHost( options );
	host.name = 'electron';
	host.capabilities.add( 'gui' );
	host.gui = options.guiBridge || null;
	return host;
}

module.exports = {
	createElectronHost,
};
