'use strict';

const { createBrowserHost } = require( './host/browser-host' );
const { transpile } = require( './transpiler' );
const { ZuzuScript } = require( './runtime' );

function _extractLineColumn( errorText ) {
	const match = String( errorText || '' ).match( /:(\d+):(\d+)\)?(?:\n|$)/u );
	if ( !match ) {
		return null;
	}
	return {
		line: Number( match[1] ),
		column: Number( match[2] ),
	};
}

function _makeSnippet( source, line, column ) {
	const lines = String( source || '' ).split( /\r?\n/u );
	if ( !Number.isInteger( line ) || line < 1 || line > lines.length ) {
		return null;
	}
	const content = lines[line - 1];
	const caretColumn = Number.isInteger( column ) && column > 0 ? column : 1;
	return `${content}\n${' '.repeat( Math.max( 0, caretColumn - 1 ) )}^`;
}

function _toJsError( source, filename, result ) {
	const stderr = String( result && result.stderr || '' ).trim();
	const message = stderr || `Zuzu evaluation failed (${filename})`;
	const err = new Error( message );
	err.name = result && result.status === 3 ? 'ZuzuParseError' : 'ZuzuRuntimeError';
	err.filename = filename;
	err.source = String( source || '' );
	err.zuzu = {
		status: result ? result.status : 1,
		stdout: result ? result.stdout : '',
		stderr: result ? result.stderr : '',
	};
	const where = _extractLineColumn( stderr );
	if ( where ) {
		err.line = where.line;
		err.column = where.column;
		err.snippet = _makeSnippet( source, where.line, where.column );
	}
	return err;
}

function _coerceScalarOutput( stdout ) {
	const lines = String( stdout || '' ).trimEnd().split( /\r?\n/u );
	if ( lines.length !== 1 ) {
		return undefined;
	}
	const raw = lines[0];
	if ( /^-?\d+(?:\.\d+)?$/u.test( raw ) ) {
		return Number( raw );
	}
	if ( raw === 'true' || raw === '1' ) {
		return true;
	}
	if ( raw === 'false' || raw === '0' ) {
		return false;
	}
	if ( raw === 'null' ) {
		return null;
	}
	return raw;
}

function createBrowserRuntime( options = {} ) {
	const host = options.host || createBrowserHost( options );
	const runtime = options.runtime || new ZuzuScript( {
		host,
		repoRoot: options.repoRoot || host.repoRoot || '/',
		includePaths: options.includePaths,
		denyCapabilities: options.denyCapabilities,
		allowCapabilities: options.allowCapabilities,
		denyModules: options.denyModules,
		debugLevel: options.debugLevel,
		executionTimeoutMs: options.executionTimeoutMs,
		transpiler: options.transpiler,
	} );

	function _runSource( source, evalOptions = {} ) {
		const filename = evalOptions.filename || '/<browser>.zzs';
		return runtime.runSource( String( source ?? '' ), {
			filename,
			preloadModules: evalOptions.preloadModules || [],
		} );
	}

	function zuzu_run( source, evalOptions = {} ) {
		const result = _runSource( source, evalOptions );
		if ( result && typeof result.then === 'function' ) {
			return result.then( (resolved) => {
				if ( evalOptions.throwOnError !== false && resolved.status !== 0 ) {
					throw _toJsError( source, evalOptions.filename || '/<browser>.zzs', resolved );
				}
				return resolved;
			} );
		}
		if ( evalOptions.throwOnError !== false && result.status !== 0 ) {
			throw _toJsError( source, evalOptions.filename || '/<browser>.zzs', result );
		}
		return result;
	}

	function zuzu_eval( source, evalOptions = {} ) {
		const sourceText = String( source ?? '' );
		const filename = evalOptions.filename || '/<browser>.zzs';
		const run = () => {
			if ( evalOptions.result === true ) {
				return zuzu_run( sourceText, evalOptions );
			}

			const expressionResult = _runSource( `say( ${sourceText} );`, {
				...evalOptions,
				filename,
			} );
			if ( expressionResult && typeof expressionResult.then === 'function' ) {
				return expressionResult.then( (resolvedExpression) => {
					if ( resolvedExpression.status === 0 ) {
						return _coerceScalarOutput( resolvedExpression.stdout );
					}
					return Promise.resolve( zuzu_run( sourceText, evalOptions ) )
						.then( (result) => {
							if ( result.stdout && evalOptions.returnStdout === true ) {
								return result.stdout;
							}
							return undefined;
						} );
				} );
			}
			if ( expressionResult.status === 0 ) {
				return _coerceScalarOutput( expressionResult.stdout );
			}

			const result = zuzu_run( sourceText, evalOptions );
			if ( result.stdout && evalOptions.returnStdout === true ) {
				return result.stdout;
			}
			return undefined;
		};
		if ( evalOptions.async === true ) {
			return Promise.resolve().then( run );
		}
		return run();
	}

	function zuzu_compile( source, _compileOptions = {} ) {
		return transpile( String( source ?? '' ), {
			transpiler: runtime.transpiler,
		} );
	}

	return {
		host,
		runtime,
		zuzu_eval,
		zuzu_run,
		zuzu_compile,
	};
}

module.exports = {
	createBrowserRuntime,
};
