'use strict';

const compiledSources = new Map();

function setCompiledSource( filename, source ) {
	if ( typeof filename === 'string' && typeof source === 'string' ) {
		compiledSources.set( filename, source );
	}
}

function getCompiledSource( filename ) {
	return compiledSources.get( filename ) || null;
}

module.exports = {
	getCompiledSource,
	setCompiledSource,
};
