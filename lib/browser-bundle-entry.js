'use strict';

const { createBrowserRuntime } = require( './browser-runtime' );
const {
	createBrowserGuiBridge,
	createBrowserGuiRenderer,
} = require( './browser-gui-renderer' );

let defaultRuntime = null;

function _defaultRuntimeOptions() {
	const root = typeof globalThis !== 'undefined'
		? globalThis
		: null;
	const value = root && root.__ZUZU_BROWSER_DEFAULT_RUNTIME_OPTIONS__;
	return value && typeof value === 'object' ? value : {};
}

function _mergeMapOption( left, right ) {
	return {
		...( left || {} ),
		...( right || {} ),
	};
}

function _mergeRuntimeOptions( defaults, options ) {
	return {
		...defaults,
		...options,
		virtualFiles: _mergeMapOption( defaults.virtualFiles, options.virtualFiles ),
		jsModules: _mergeMapOption( defaults.jsModules, options.jsModules ),
		workerSource: options.workerSource || defaults.workerSource,
		workerUrl: options.workerUrl || defaults.workerUrl,
		workerFactory: options.workerFactory || defaults.workerFactory,
	};
}

function createConfiguredBrowserRuntime( options = {} ) {
	return createBrowserRuntime(
		_mergeRuntimeOptions( _defaultRuntimeOptions(), options )
	);
}

function getDefaultBrowserRuntime( options = {} ) {
	if ( !defaultRuntime || options.reset === true ) {
		defaultRuntime = createConfiguredBrowserRuntime(
			options.runtimeOptions || options
		);
	}
	return defaultRuntime;
}

function zuzu_eval( source, options = {} ) {
	return getDefaultBrowserRuntime( options.runtimeOptions || {} )
		.zuzu_eval( source, options );
}

function zuzu_run( source, options = {} ) {
	return getDefaultBrowserRuntime( options.runtimeOptions || {} )
		.zuzu_run( source, options );
}

function zuzu_compile( source, options = {} ) {
	return getDefaultBrowserRuntime( options.runtimeOptions || {} )
		.zuzu_compile( source, options );
}

function installGlobalApis( root = globalThis ) {
	if ( !root || typeof root !== 'object' ) {
		return null;
	}
	root.zuzu_eval = zuzu_eval;
	root.zuzu_run = zuzu_run;
	root.zuzu_compile = zuzu_compile;
	root.zuzu_runtime = getDefaultBrowserRuntime;
	return root;
}

function runEmbeddedScripts( runtime, options = {} ) {
	const doc = options.document || ( typeof document !== 'undefined' ? document : null );
	if ( !doc ) {
		return [];
	}
	const selector = options.selector || 'script[type="text/x-zuzuscript"]';
	const filenamePrefix = options.filenamePrefix || '/<embedded>';
	const scripts = Array.from( doc.querySelectorAll( selector ) );
	const log = typeof options.consoleLog === 'function'
		? options.consoleLog
		: ( line ) => console.log( line );
	const errorLog = typeof options.consoleError === 'function'
		? options.consoleError
		: ( err ) => console.error( err );
	const results = [];
	for ( let i = 0; i < scripts.length; i++ ) {
		const script = scripts[i];
		const source = script.textContent || '';
		try {
			const result = runtime.zuzu_run( source, {
				filename: `${filenamePrefix}-${i + 1}.zzs`,
				throwOnError: options.throwOnError !== false,
			} );
			if ( result.stdout ) {
				for ( const line of result.stdout.trimEnd().split( /\r?\n/u ) ) {
					if ( line ) {
						log( line );
					}
				}
			}
			results.push( result );
		}
		catch ( err ) {
			errorLog( err );
			results.push( err );
			if ( options.stopOnError !== false ) {
				throw err;
			}
		}
	}
	return results;
}

function autoRunEmbeddedScripts( options = {} ) {
	const doc = options.document || ( typeof document !== 'undefined' ? document : null );
	if ( !doc ) {
		return null;
	}
	const runtime = options.runtime || getDefaultBrowserRuntime( {
		runtimeOptions: options.runtimeOptions || {},
	} );
	const runNow = () => runEmbeddedScripts( runtime, options );
	if ( doc.readyState === 'loading' ) {
		doc.addEventListener( 'DOMContentLoaded', runNow, { once: true } );
		return runtime;
	}
	runNow();
	return runtime;
}

if (
	typeof window !== 'undefined'
	&& window
	&& window.document
	&& !window.__ZUZU_BROWSER_NO_AUTORUN__
) {
	installGlobalApis( window );
	autoRunEmbeddedScripts( {} );
}

module.exports = {
	createBrowserRuntime: createConfiguredBrowserRuntime,
	createBrowserGuiBridge,
	createBrowserGuiRenderer,
	getDefaultBrowserRuntime,
	zuzu_eval,
	zuzu_run,
	zuzu_compile,
	installGlobalApis,
	runEmbeddedScripts,
	autoRunEmbeddedScripts,
};
