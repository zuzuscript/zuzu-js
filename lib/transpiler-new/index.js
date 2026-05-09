'use strict';

const { stripPod } = require( '../transpiler-utils' );
const { tokenize } = require( './lexer' );
const { parse } = require( './parser' );
const { emitProgram } = require( './codegen' );
const { validateBindings } = require( './validate-bindings' );

function transpileWithoutFallback( source, options = {} ) {
	const preprocessed = stripPod( String( source ?? '' ) );
	const tokens = tokenize( preprocessed );
	const ast = parse( tokens );
	validateBindings( ast );
	return emitProgram( ast, { ...options, marshalSource: preprocessed } );
}

function transpile( source, options = {} ) {
	return transpileWithoutFallback( source, options );
}

module.exports = {
	tokenize,
	parse,
	transpileWithoutFallback,
	transpile,
};
