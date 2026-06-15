'use strict';

function _splitPath( value ) {
	return String( value ?? '' ).split( /[\\/]+/u ).filter( Boolean );
}

function _normalizePath( value ) {
	const isAbs = String( value ?? '' ).startsWith( '/' );
	const stack = [];
	for ( const part of _splitPath( value ) ) {
		if ( part === '.' ) {
			continue;
		}
		if ( part === '..' ) {
			if ( stack.length > 0 ) {
				stack.pop();
			}
			continue;
		}
		stack.push( part );
	}
	if ( isAbs ) {
		return `/${stack.join( '/' )}`;
	}
	return stack.join( '/' ) || '.';
}

function _resolvePath( ...parts ) {
	const raw = parts.map( (item) => String( item ?? '' ) ).join( '/' );
	const seeded = raw.startsWith( '/' ) ? raw : `/${raw}`;
	return _normalizePath( seeded );
}

function _dirname( value ) {
	const normalized = _normalizePath( value );
	if ( normalized === '/' || normalized === '.' ) {
		return '/';
	}
	const parts = _splitPath( normalized );
	parts.pop();
	return parts.length > 0 ? `/${parts.join( '/' )}` : '/';
}

function _sourceUrlComment( runOptions = {} ) {
	const filename = runOptions.filename == null
		? '/<browser>.zzs'
		: String( runOptions.filename );
	return `\n//# sourceURL=${filename.replace( /[\r\n]/gu, '_' )}`;
}

const browserModuleUrls = new Map();

function _normalizeModuleName( value ) {
	const name = String( value ?? '' ).trim().replace( /\\/gu, '/' );
	if (
		name === ''
		|| name.startsWith( '/' )
		|| name.endsWith( '/' )
		|| /(^|\/)\.\.?(\/|$)/u.test( name )
	) {
		throw new Error( `Invalid browser module name: ${value}` );
	}
	return name.replace( /\.zzm$/u, '' );
}

function _moduleNameFromPath( filename ) {
	const path = _resolvePath( filename );
	if ( !path.startsWith( '/modules/' ) || !path.endsWith( '.zzm' ) ) {
		return null;
	}
	return path.slice( '/modules/'.length, -'.zzm'.length );
}

function addBrowserModule( moduleName, url ) {
	const logicalName = _normalizeModuleName( moduleName );
	const moduleUrl = String( url ?? '' ).trim();
	if ( moduleUrl === '' ) {
		throw new Error( `Invalid URL for browser module '${logicalName}'` );
	}
	browserModuleUrls.set( logicalName, moduleUrl );
	return logicalName;
}

function hasBrowserModules() {
	return browserModuleUrls.size > 0;
}

function _browserEval( source, context, runOptions = {} ) {
	context.globalThis = context;
	const sourceUrl = _sourceUrlComment( runOptions );
	try {
		const expr = Function(
			'__zuzu_context',
			`with ( __zuzu_context ) { return ( ${source} ); }${sourceUrl}`
		);
		return expr( context );
	}
	catch ( _exprError ) {
		const script = Function(
			'__zuzu_context',
			`with ( __zuzu_context ) { ${source}\n }${sourceUrl}`
		);
		return script( context );
	}
}

function _defaultGuiBridge( options ) {
	if ( Object.prototype.hasOwnProperty.call( options, 'guiBridge' ) ) {
		return options.guiBridge;
	}
	const doc = options.document
		|| ( typeof document !== 'undefined' ? document : null );
	if ( !doc || typeof doc.createElement !== 'function' ) {
		return null;
	}
	let bridge = null;
	function getBridge() {
		if ( bridge ) {
			return bridge;
		}
		const {
			createBrowserGuiBridge,
		} = require( '../browser-gui-renderer' );
		bridge = createBrowserGuiBridge( {
			document: doc,
			root: options.guiRoot,
			rootId: options.guiRootId,
			baseZIndex: options.guiBaseZIndex,
			dialogs: options.guiDialogs,
			window: options.window,
		} );
		return bridge;
	}
	return {
		get windows() {
			return getBridge().windows;
		},
		openWindow( ...args ) {
			return getBridge().openWindow( ...args );
		},
		closeWindow( ...args ) {
			return getBridge().closeWindow( ...args );
		},
		createWidget( ...args ) {
			return getBridge().createWidget( ...args );
		},
		updateWidget( ...args ) {
			return getBridge().updateWidget( ...args );
		},
		destroyWidget( ...args ) {
			return getBridge().destroyWidget( ...args );
		},
		focusWindow( ...args ) {
			return getBridge().focusWindow( ...args );
		},
		alert( ...args ) {
			return getBridge().alert( ...args );
		},
		confirm( ...args ) {
			return getBridge().confirm( ...args );
		},
		prompt( ...args ) {
			return getBridge().prompt( ...args );
		},
		colourPicker( ...args ) {
			return getBridge().colourPicker( ...args );
		},
		fileOpen( ...args ) {
			return getBridge().fileOpen( ...args );
		},
		fileSave( ...args ) {
			return getBridge().fileSave( ...args );
		},
		directoryOpen( ...args ) {
			return getBridge().directoryOpen( ...args );
		},
		directorySave( ...args ) {
			return getBridge().directorySave( ...args );
		},
	};
}

function createBrowserHost( options = {} ) {
	const repoRoot = options.repoRoot || '/';
	const includePaths = Array.isArray( options.includePaths )
		? options.includePaths.map( (item) => _resolvePath( item ) )
		: [];
	const virtualFiles = new Map( Object.entries( options.virtualFiles || {} )
		.map( ( [ filename, source ] ) => [ _resolvePath( filename ), String( source ) ] ) );
	const jsModules = new Map( Object.entries( options.jsModules || {} )
		.map( ( [ filename, loaded ] ) => [ _resolvePath( filename ), loaded ] ) );
	const fetchedFiles = new Map();
	const fetchingFiles = new Map();
	const optionModuleUrls = new Map(
		Object.entries( options.remoteModules || {} )
			.map( ( [ name, url ] ) => [ _normalizeModuleName( name ), String( url ) ] )
	);
	const fetchText = typeof options.fetch === 'function'
		? options.fetch
		: (
			typeof fetch === 'function'
				? fetch
				: null
		);
	const fetchModule = typeof options.fetchModule === 'function'
		? options.fetchModule
		: null;
	const runInContext = typeof options.evaluate === 'function'
		? options.evaluate
		: _browserEval;
	const capabilities = new Set( [
		'console',
		'time',
		'module_load',
		'module_fetch',
		'file_availability',
		'http',
		'js',
		'gui',
	] );
	const workerSource = options.workerSource
		|| (
			typeof globalThis !== 'undefined'
			&& globalThis.__ZUZU_BROWSER_WORKER_SOURCE__
		)
		|| null;
	const workerUrl = options.workerUrl
		|| (
			typeof globalThis !== 'undefined'
			&& globalThis.__ZUZU_BROWSER_WORKER_URL__
		)
		|| null;
	const workerFactory = typeof options.workerFactory === 'function'
		? options.workerFactory
		: (
			typeof globalThis !== 'undefined'
			&& typeof globalThis.__ZUZU_BROWSER_WORKER_FACTORY__ === 'function'
				? globalThis.__ZUZU_BROWSER_WORKER_FACTORY__
				: null
		);
	if ( workerSource || workerUrl || workerFactory ) {
		capabilities.add( 'worker' );
	}
	const gui = _defaultGuiBridge( options );
	function browserModuleUrlForPath( filename ) {
		const logicalName = _moduleNameFromPath( filename );
		if ( !logicalName ) {
			return null;
		}
		if ( optionModuleUrls.has( logicalName ) ) {
			return optionModuleUrls.get( logicalName );
		}
		return browserModuleUrls.get( logicalName ) || null;
	}
	function hasAsyncModules() {
		return optionModuleUrls.size > 0 || browserModuleUrls.size > 0;
	}
	async function fetchBrowserModule( key, url ) {
		if ( fetchedFiles.has( key ) ) {
			return fetchedFiles.get( key );
		}
		if ( fetchingFiles.has( key ) ) {
			return fetchingFiles.get( key );
		}
		if ( !fetchText ) {
			throw new Error( `Exception: Browser host cannot fetch module '${key}'` );
		}
		const pending = Promise.resolve( fetchText( url ) )
			.then( async (response) => {
				if ( typeof response === 'string' ) {
					return response;
				}
				if ( response && response.ok === false ) {
					throw new Error(
						`Exception: Fetch failed for browser module '${key}' (${response.status})`
					);
				}
				if ( !response || typeof response.text !== 'function' ) {
					throw new Error(
						`Exception: Fetch did not return text for browser module '${key}'`
					);
				}
				return response.text();
			} )
			.then( (source) => {
				const text = String( source );
				fetchedFiles.set( key, text );
				fetchingFiles.delete( key );
				return text;
			}, (err) => {
				fetchingFiles.delete( key );
				throw err;
			} );
		fetchingFiles.set( key, pending );
		return pending;
	}
	return {
		name: 'browser',
		repoRoot,
		includePaths,
		capabilities,
		gui,
		workerSource,
		workerUrl,
		workerFactory,
		cwd() {
			return '/';
		},
		resolve( ...parts ) {
			return _resolvePath( ...parts );
		},
		dirname( value ) {
			return _dirname( value );
		},
		join( ...parts ) {
			return _normalizePath( parts.map( (item) => String( item ?? '' ) ).join( '/' ) );
		},
		readFileText( filename ) {
			const key = _resolvePath( filename );
			if ( virtualFiles.has( key ) ) {
				return virtualFiles.get( key );
			}
			if ( fetchedFiles.has( key ) ) {
				return fetchedFiles.get( key );
			}
			if ( fetchModule ) {
				const fetched = fetchModule( key );
				if ( typeof fetched === 'string' ) {
					fetchedFiles.set( key, fetched );
					return fetched;
				}
			}
			if ( browserModuleUrlForPath( key ) ) {
				throw new Error( `Exception: Browser module '${filename}' requires asynchronous loading` );
			}
			throw new Error( `Exception: Browser host cannot read file '${filename}'` );
		},
		async readFileTextAsync( filename ) {
			const key = _resolvePath( filename );
			if ( virtualFiles.has( key ) ) {
				return virtualFiles.get( key );
			}
			if ( fetchedFiles.has( key ) ) {
				return fetchedFiles.get( key );
			}
			const browserModuleUrl = browserModuleUrlForPath( key );
			if ( browserModuleUrl ) {
				return fetchBrowserModule( key, browserModuleUrl );
			}
			return this.readFileText( key );
		},
		fileExists( filename ) {
			const key = _resolvePath( filename );
			if ( virtualFiles.has( key ) || jsModules.has( key ) || fetchedFiles.has( key ) ) {
				return true;
			}
			if ( browserModuleUrlForPath( key ) ) {
				return true;
			}
			if ( fetchModule ) {
				const fetched = fetchModule( key );
				if ( typeof fetched === 'string' ) {
					fetchedFiles.set( key, fetched );
					return true;
				}
			}
			return false;
		},
		runInContext( source, context, runOptions = {} ) {
			return runInContext( source, context, runOptions );
		},
		consoleLog( value ) {
			if ( typeof options.consoleLog === 'function' ) {
				options.consoleLog( value );
				return;
			}
			if ( typeof console !== 'undefined' && typeof console.log === 'function' ) {
				console.log( value );
			}
		},
		now() {
			return Date.now();
		},
		getEnv( _name ) {
			return null;
		},
		loadJsModule( filename ) {
			const key = _resolvePath( filename );
			if ( !jsModules.has( key ) ) {
				throw new Error( `Exception: Browser host has no JS module for '${filename}'` );
			}
			return jsModules.get( key );
		},
		hasAsyncModules,
	};
}

module.exports = {
	addBrowserModule,
	createBrowserHost,
	hasBrowserModules,
};
