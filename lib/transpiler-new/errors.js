'use strict';

class TranspilerSyntaxError extends Error {
	constructor( message, token = null ) {
		const suffix = token && token.line != null && token.column != null
			? ` at ${token.line}:${token.column}`
			: '';
		super( `${message}${suffix}` );
		this.name = 'TranspilerSyntaxError';
		this.token = token;
	}
}

class UnsupportedSyntaxError extends Error {
	constructor( message, token = null ) {
		const suffix = token && token.line != null && token.column != null
			? ` at ${token.line}:${token.column}`
			: '';
		super( `${message}${suffix}` );
		this.name = 'UnsupportedSyntaxError';
		this.token = token;
	}
}

module.exports = {
	TranspilerSyntaxError,
	UnsupportedSyntaxError,
};
