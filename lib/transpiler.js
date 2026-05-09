'use strict';

const { stripPod } = require( './transpiler-utils' );
const { transpile: transpileNew } = require( './transpiler-new' );

const DEFAULT_TRANSPILER = 'new-only';
const VALID_TRANSPILERS = new Set( [ DEFAULT_TRANSPILER ] );

function normalizeTranspilerName( value ) {
	if ( value == null || value === '' ) {
		return DEFAULT_TRANSPILER;
	}
	const name = String( value ).trim().toLowerCase();
	if ( !VALID_TRANSPILERS.has( name ) ) {
		throw new Error(
			`Unknown transpiler: ${value}. Expected: ${DEFAULT_TRANSPILER}`
		);
	}
	return name;
}

function transpile( source, options = {} ) {
	normalizeTranspilerName( options.transpiler );
	return transpileNew( source, options );
}

module.exports = {
	DEFAULT_TRANSPILER,
	VALID_TRANSPILERS,
	normalizeTranspilerName,
	transpile,
	stripPod,
};
