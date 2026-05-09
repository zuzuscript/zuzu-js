'use strict';

const fs = require( 'node:fs' );
const path = require( 'node:path' );
const {
	normalizeTranspilerName,
	stripPod,
	transpile,
} = require( './transpiler' );
const { tokenize, parse } = require( './transpiler-new' );

const repoRoot = path.resolve( __dirname, '..', '..', '..' );
const jsStdRoot = path.join( repoRoot, 'extras', 'zuzu-js', 'modules' );
const pureStdRoot = path.join( repoRoot, 'modules' );
const browserBundlePath = path.join(
	repoRoot,
	'extras',
	'zuzu-js',
	'dist',
	'zuzu-browser.js'
);

function stripShebang( source ) {
	if ( source.startsWith( '#!' ) ) {
		const idx = source.indexOf( '\n' );
		return idx === -1 ? '' : source.slice( idx + 1 );
	}
	return source;
}

function normalizeSlashes( value ) {
	return String( value ).replace( /\\/g, '/' );
}

function collectImportsFromAst( node, out = [] ) {
	if ( !node || typeof node !== 'object' ) {
		return out;
	}
	if ( node.type === 'ImportDeclaration' ) {
		out.push( {
			source: node.source,
			tryMode: node.tryMode === true,
		} );
		return out;
	}
	for ( const value of Object.values( node ) ) {
		if ( Array.isArray( value ) ) {
			for ( const item of value ) {
				collectImportsFromAst( item, out );
			}
		}
		else if ( value && typeof value === 'object' ) {
			collectImportsFromAst( value, out );
		}
	}
	return out;
}

function collectStaticImports( source ) {
	const tokens = tokenize( stripPod( stripShebang( source ) ) );
	return collectImportsFromAst( parse( tokens ) );
}

function candidatePaths( base ) {
	return [
		base,
		`${base}.zzs`,
		`${base}.zzm`,
		`${base}.js`,
	];
}

function resolveModulePath( moduleName, fromFile, options = {} ) {
	const fromDir = fromFile ? path.dirname( fromFile ) : process.cwd();
	const includePaths = options.includePaths || [];
	const bases = [];
	if ( moduleName.startsWith( '.' ) || path.isAbsolute( moduleName ) ) {
		bases.push( path.resolve( fromDir, moduleName ) );
	}
	else {
		for ( const root of [
			process.cwd(),
			...includePaths,
			jsStdRoot,
			pureStdRoot,
		] ) {
			bases.push( path.resolve( root, moduleName ) );
		}
	}
	for ( const base of bases ) {
		for ( const candidate of candidatePaths( base ) ) {
			if ( fs.existsSync( candidate ) && fs.statSync( candidate ).isFile() ) {
				return candidate;
			}
		}
	}
	return null;
}

function isBuiltinJsModule( filename ) {
	const rel = normalizeSlashes( path.relative( jsStdRoot, filename ) );
	return Boolean( rel && !rel.startsWith( '..' ) && !path.isAbsolute( rel ) );
}

function isUnderRoot( root, filename ) {
	const rel = path.relative( root, filename );
	return Boolean( rel && !rel.startsWith( '..' ) && !path.isAbsolute( rel ) );
}

function collectDependencyGraph( entryPath, options = {} ) {
	const includePaths = ( options.includePaths || [] ).map( (item) => path.resolve( item ) );
	const queue = [ path.resolve( entryPath ) ];
	const seen = new Set();
	const files = [];
	while ( queue.length > 0 ) {
		const filename = queue.shift();
		if ( seen.has( filename ) ) {
			continue;
		}
		seen.add( filename );
		const source = stripShebang( fs.readFileSync( filename, 'utf8' ) );
		files.push( {
			filename,
			source,
		} );
		for ( const imported of collectStaticImports( source ) ) {
			const resolved = resolveModulePath( imported.source, filename, {
				includePaths,
			} );
			if ( !resolved ) {
				if ( imported.tryMode ) {
					continue;
				}
				throw new Error(
					`Unable to resolve imported module '${imported.source}' from ${filename}`
				);
			}
			if ( resolved.endsWith( '.js' ) ) {
				if ( !isBuiltinJsModule( resolved ) ) {
					throw new Error(
						`Cannot compile JavaScript module dependency '${imported.source}' from ${filename}`
					);
				}
				continue;
			}
			queue.push( resolved );
		}
	}
	return files.sort( (a, b) => a.filename.localeCompare( b.filename ) );
}

function commonRoot( filenames ) {
	if ( filenames.length === 0 ) {
		return process.cwd();
	}
	const split = (filename) => normalizeSlashes( path.dirname( filename ) )
		.split( '/' )
		.filter( Boolean );
	const first = split( filenames[0] );
	let count = first.length;
	for ( const filename of filenames.slice( 1 ) ) {
		const parts = split( filename );
		count = Math.min( count, parts.length );
		for ( let i = 0; i < count; i++ ) {
			if ( first[i] !== parts[i] ) {
				count = i;
				break;
			}
		}
	}
	const prefix = first.slice( 0, count ).join( '/' );
	return path.parse( filenames[0] ).root + prefix;
}

function makeVirtualPathMapper( files ) {
	const userFiles = files
		.map( (file) => file.filename )
		.filter( (filename) => !isUnderRoot( pureStdRoot, filename ) );
	const root = commonRoot( userFiles.length > 0
		? userFiles
		: files.map( (file) => file.filename ) );
	return (filename) => {
		if ( isUnderRoot( pureStdRoot, filename ) ) {
			const rel = normalizeSlashes( path.relative( pureStdRoot, filename ) );
			return `/${normalizeSlashes( path.posix.join( 'modules', rel ) )}`;
		}
		const rel = normalizeSlashes( path.relative( root, filename ) );
		return `/${normalizeSlashes( path.posix.join( '__zuzu_compiled__', rel ) )}`;
	};
}

function normalizedBrowserBundle() {
	if ( !fs.existsSync( browserBundlePath ) ) {
		throw new Error(
			`Missing browser bundle: ${browserBundlePath}. Run extras/zuzu-js/bin/build-browser-bundle first.`
		);
	}
	return fs.readFileSync( browserBundlePath, 'utf8' )
		.replace( /zuzu-browser-build\.[A-Za-z0-9]+/g, 'zuzu-browser-build.STABLE' )
		.trimEnd();
}

function stringifyAscii( value ) {
	return JSON.stringify( value, null, '\t' )
		.replace(
			/[^\x00-\x7F]/g,
			(ch) => `\\u${ch.charCodeAt( 0 ).toString( 16 ).padStart( 4, '0' )}`
		);
}

function compileToBundle( entryPath, options = {} ) {
	const transpiler = normalizeTranspilerName( options.transpiler );
	const entry = path.resolve( entryPath );
	const graph = collectDependencyGraph( entry, {
		includePaths: options.includePaths || [],
	} );
	const virtualPathFor = makeVirtualPathMapper( graph );
	const entryFile = graph.find( (file) => file.filename === entry );
	const entrySource = entryFile ? entryFile.source : stripShebang( fs.readFileSync( entry, 'utf8' ) );
	const entryJs = transpile( entrySource, { transpiler } );
	const virtualFiles = {};
	for ( const file of graph ) {
		virtualFiles[virtualPathFor( file.filename )] = file.source;
	}
	const entryVirtualPath = virtualPathFor( entry );
	const payload = {
		entry: entryVirtualPath,
		entryJs,
		virtualFiles,
	};
const bootstrap = `
;(function () {
\t'use strict';
\tconst __zuzu_payload = ${stringifyAscii( payload )};
\tconst __zuzu_api = ZuzuBrowser.createBrowserRuntime( {
\t\tincludePaths: [ '/__zuzu_compiled__' ],
\t\tvirtualFiles: __zuzu_payload.virtualFiles,
\t} );
\tconst __zuzu_result = __zuzu_api.runtime.runCompiled(
\t\t__zuzu_payload.entryJs,
\t\t{ filename: __zuzu_payload.entry }
\t);
\tconst __zuzu_root = typeof globalThis !== 'undefined'
\t\t? globalThis
\t\t: null;
\tconst __zuzu_is_node = typeof process !== 'undefined'
\t\t&& process
\t\t&& process.versions
\t\t&& process.versions.node;
\tconst __zuzu_finish = function ( __zuzu_finished_result ) {
\t\tif ( __zuzu_root ) {
\t\t\t__zuzu_root.ZuzuCompiledResult = __zuzu_finished_result;
\t\t}
\t\tif ( __zuzu_is_node ) {
\t\t\tif ( __zuzu_finished_result.stdout ) {
\t\t\t\tprocess.stdout.write( __zuzu_finished_result.stdout );
\t\t\t}
\t\t\tif ( __zuzu_finished_result.stderr ) {
\t\t\t\tprocess.stderr.write( __zuzu_finished_result.stderr );
\t\t\t}
\t\t\tprocess.exitCode = __zuzu_finished_result.status;
\t\t}
\t\telse {
\t\t\tif (
\t\t\t\ttypeof window !== 'undefined'
\t\t\t\t&& window
\t\t\t\t&& typeof window.dispatchEvent === 'function'
\t\t\t\t&& typeof CustomEvent === 'function'
\t\t\t) {
\t\t\t\twindow.dispatchEvent( new CustomEvent(
\t\t\t\t\t'zuzu:result',
\t\t\t\t\t{ detail: __zuzu_finished_result }
\t\t\t\t) );
\t\t\t}
\t\t\tif ( __zuzu_finished_result.stdout ) {
\t\t\t\tfor ( const __zuzu_line of __zuzu_finished_result.stdout.trimEnd().split( /\\r?\\n/u ) ) {
\t\t\t\t\tif ( __zuzu_line ) {
\t\t\t\t\t\tconsole.log( __zuzu_line );
\t\t\t\t\t}
\t\t\t\t}
\t\t\t}
\t\t\tif ( __zuzu_finished_result.stderr ) {
\t\t\t\tconsole.error( __zuzu_finished_result.stderr.trimEnd() );
\t\t\t}
\t\t}
\t};
\tif ( __zuzu_result && typeof __zuzu_result.then === 'function' ) {
\t\t__zuzu_result.then( __zuzu_finish );
\t}
\telse {
\t\t__zuzu_finish( __zuzu_result );
\t}
})();`;
	const prelude = [
		';(function () {',
		"\t'use strict';",
		"\tconst root = typeof globalThis !== 'undefined' ? globalThis : this;",
		"\troot.__ZUZU_BROWSER_NO_AUTORUN__ = true;",
		'}).call( this );',
	].join( '\n' );
	return `${prelude}\n${normalizedBrowserBundle()}\n${bootstrap}\n`;
}

module.exports = {
	compileToBundle,
	collectDependencyGraph,
	collectStaticImports,
};
