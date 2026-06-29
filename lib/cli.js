'use strict';

const fs = require( 'node:fs' );
const path = require( 'node:path' );
const { normalizeTranspilerName } = require( './transpiler' );
const { launchElectronScript } = require( './electron/launcher' );

const EXIT_OK = 0;
const EXIT_RUNTIME = 1;
const EXIT_USAGE = 2;
const EXIT_PARSE = 3;

function printUsage( message = '' ) {
	if ( message ) {
		process.stderr.write( `${message}\n` );
	}
	process.stderr.write( 'Usage: zuzu-js [options] path/to/script.zzs\n' );
	process.stderr.write( "       zuzu-js [options] -e 'code'\n" );
	process.stderr.write( 'Options:\n' );
	process.stderr.write( '  -d[=N]                 set debug level (default: 1 if omitted)\n' );
	process.stderr.write( '  -I/path/to/lib         add module include directory\n' );
	process.stderr.write( '  --deny=CAP             deny runtime capability (repeatable)\n' );
	process.stderr.write( '  --denymodule=MODULE    deny a specific module (repeatable)\n' );
	process.stderr.write( "  -e 'code'              evaluate inline code (repeatable)\n" );
	process.stderr.write( '  -Mmodule               preload module with wildcard import\n' );
	process.stderr.write( '  --electron             launch a script through Electron GUI mode\n' );
	process.stderr.write( '  -h, --help             show this help\n' );
	process.stderr.write( '  -v                     print version\n' );
	process.stderr.write( '  -V                     print verbose version details\n' );
}

function flattenOptionValues( values ) {
	const out = [];
	for ( const raw of values ) {
		for ( const entry of String( raw ).split( ',' ) ) {
			const trimmed = entry.trim();
			if ( trimmed ) {
				out.push( trimmed );
			}
		}
	}
	return out;
}

function parseArgValue( argv, index, flag ) {
	if ( index + 1 >= argv.length ) {
		return { error: `Missing value for ${flag}` };
	}
	return { value: argv[index + 1], nextIndex: index + 1 };
}

function parseCliArgs( argv ) {
	const options = {
		includePaths: [],
		denies: [],
		denyModules: [],
		inlineSnippets: [],
		preloadModules: [],
		transpiler: null,
		debugLevel: 0,
		electronMode: false,
		showHelp: false,
		showVersion: false,
		showVersionVerbose: false,
		scriptPath: null,
		scriptArgs: [],
	};

	for ( let i = 0; i < argv.length; i++ ) {
		const arg = argv[i];
		if ( options.scriptPath != null ) {
			options.scriptArgs.push( arg );
			continue;
		}
		if ( arg === '--' ) {
			if ( i + 1 < argv.length ) {
				options.scriptPath = argv[i + 1];
				options.scriptArgs = argv.slice( i + 2 );
				break;
			}
			return { error: 'Missing script path after --' };
		}
		if ( arg === '-h' || arg === '--help' ) {
			options.showHelp = true;
			continue;
		}
		if ( arg === '-v' ) {
			options.showVersion = true;
			continue;
		}
		if ( arg === '-V' ) {
			options.showVersionVerbose = true;
			continue;
		}
		if ( arg === '--electron' ) {
			options.electronMode = true;
			continue;
		}
		if ( arg === '-d' ) {
			options.debugLevel = 1;
			continue;
		}
		if ( arg.startsWith( '-d=' ) ) {
			const parsed = parseDebugLevel( arg.slice( 3 ) );
			if ( parsed.error ) {
				return { error: parsed.error };
			}
			options.debugLevel = parsed.value;
			continue;
		}
		if ( /^-d[0-9]+$/u.test( arg ) ) {
			const parsed = parseDebugLevel( arg.slice( 2 ) );
			if ( parsed.error ) {
				return { error: parsed.error };
			}
			options.debugLevel = parsed.value;
			continue;
		}
		if ( arg === '-e' ) {
			const parsed = parseArgValue( argv, i, '-e' );
			if ( parsed.error ) {
				return { error: parsed.error };
			}
			options.inlineSnippets.push( parsed.value );
			i = parsed.nextIndex;
			continue;
		}
		if ( arg.startsWith( '-e' ) && arg.length > 2 ) {
			options.inlineSnippets.push( arg.slice( 2 ) );
			continue;
		}
		if ( arg === '-I' ) {
			const parsed = parseArgValue( argv, i, '-I' );
			if ( parsed.error ) {
				return { error: parsed.error };
			}
			options.includePaths.push( parsed.value );
			i = parsed.nextIndex;
			continue;
		}
		if ( arg.startsWith( '-I' ) && arg.length > 2 ) {
			options.includePaths.push( arg.slice( 2 ) );
			continue;
		}
		if ( arg === '-M' ) {
			const parsed = parseArgValue( argv, i, '-M' );
			if ( parsed.error ) {
				return { error: parsed.error };
			}
			options.preloadModules.push( parsed.value );
			i = parsed.nextIndex;
			continue;
		}
		if ( arg.startsWith( '-M' ) && arg.length > 2 ) {
			options.preloadModules.push( arg.slice( 2 ) );
			continue;
		}
		if ( arg === '--deny' ) {
			const parsed = parseArgValue( argv, i, '--deny' );
			if ( parsed.error ) {
				return { error: parsed.error };
			}
			options.denies.push( parsed.value );
			i = parsed.nextIndex;
			continue;
		}
		if ( arg.startsWith( '--deny=' ) ) {
			options.denies.push( arg.slice( '--deny='.length ) );
			continue;
		}
		if ( arg === '--denymodule' ) {
			const parsed = parseArgValue( argv, i, '--denymodule' );
			if ( parsed.error ) {
				return { error: parsed.error };
			}
			options.denyModules.push( parsed.value );
			i = parsed.nextIndex;
			continue;
		}
		if ( arg.startsWith( '--denymodule=' ) ) {
			options.denyModules.push( arg.slice( '--denymodule='.length ) );
			continue;
		}
		if ( arg === '--transpiler' ) {
			const parsed = parseArgValue( argv, i, '--transpiler' );
			if ( parsed.error ) {
				return { error: parsed.error };
			}
			options.transpiler = parsed.value;
			i = parsed.nextIndex;
			continue;
		}
		if ( arg.startsWith( '--transpiler=' ) ) {
			options.transpiler = arg.slice( '--transpiler='.length );
			continue;
		}
		if ( arg.startsWith( '-' ) ) {
			return { error: `Unknown option: ${arg}` };
		}
		options.scriptPath = arg;
	}

	options.includePaths = flattenOptionValues( options.includePaths );
	options.denies = flattenOptionValues( options.denies );
	options.denyModules = flattenOptionValues( options.denyModules );
	options.preloadModules = flattenOptionValues( options.preloadModules );

	for ( const item of [ ...options.includePaths, ...options.denies, ...options.denyModules, ...options.preloadModules ] ) {
		if ( item.trim().length === 0 ) {
			return { error: 'Option values may not be empty' };
		}
	}
	if ( options.transpiler != null ) {
		try {
			options.transpiler = normalizeTranspilerName( options.transpiler );
		}
		catch ( err ) {
			return { error: err.message };
		}
	}

	if ( options.inlineSnippets.length > 0 && options.scriptPath != null ) {
		return { error: 'Cannot combine -e snippets with a script path' };
	}
	if ( options.electronMode && options.inlineSnippets.length > 0 ) {
		return { error: 'Cannot combine --electron with -e snippets' };
	}
	if ( options.inlineSnippets.length === 0 && options.scriptPath == null && !options.showHelp && !options.showVersion && !options.showVersionVerbose ) {
		return { error: '' };
	}

	return { options };
}

function parseDebugLevel( value ) {
	if ( value === '' ) {
		return { value: 1 };
	}
	if ( !/^(?:0|[1-9][0-9]*)$/u.test( value ) ) {
		return { error: 'debug level must be a non-negative integer' };
	}
	return { value: Number( value ) };
}

function stripShebang( source ) {
	if ( source.startsWith( '#!' ) ) {
		const idx = source.indexOf( '\n' );
		if ( idx === -1 ) {
			return '';
		}
		return source.slice( idx + 1 );
	}
	return source;
}

function printVersion( runtime, verbose ) {
	process.stdout.write( 'zuzu-js version 0.7.1\n' );
	if ( verbose ) {
		process.stdout.write( '\nlib search paths:\n' );
		for ( const p of runtime.getModuleSearchRoots() ) {
			process.stdout.write( `  ${p}\n` );
		}
	}
}

function runCli( argv, runtimeFactory ) {
	return runCliAsync( argv, runtimeFactory );
}

function runElectronCli( options ) {
	return launchElectronScript( [
		...options.includePaths.flatMap( (item) => [ '-I', item ] ),
		path.resolve( options.scriptPath ),
		...options.scriptArgs,
	] );
}

async function runCliAsync( argv, runtimeFactory ) {
	const parsed = parseCliArgs( argv );
	if ( parsed.error != null ) {
		printUsage( parsed.error );
		return EXIT_USAGE;
	}
	const { options } = parsed;
	if ( options.showHelp ) {
		printUsage();
		return EXIT_OK;
	}
	const runtime = runtimeFactory( {
		includePaths: options.includePaths,
		denyCapabilities: options.denies,
		denyModules: options.denyModules,
		debugLevel: options.debugLevel,
		transpiler: options.transpiler,
	} );
	if ( options.showVersion || options.showVersionVerbose ) {
		printVersion( runtime, options.showVersionVerbose );
		return EXIT_OK;
	}
	if ( options.electronMode ) {
		return runElectronCli( options );
	}

	let result;
	const streamOptions = {
		onStdout: (chunk) => {
			process.stdout.write( chunk );
		},
		onStderr: (chunk) => {
			process.stderr.write( chunk );
		},
	};
	if ( options.inlineSnippets.length > 0 ) {
		const body = options.inlineSnippets.join( '\n' );
		result = runtime.runSource( body, {
			...streamOptions,
			filename: '(command line)',
			preloadModules: options.preloadModules,
			scriptArgs: options.scriptArgs,
		} );
	}
	else {
		const scriptPath = path.resolve( options.scriptPath );
		let source = fs.readFileSync( scriptPath, 'utf8' );
		source = stripShebang( source );
		result = runtime.runSource( source, {
			...streamOptions,
			filename: scriptPath,
			preloadModules: options.preloadModules,
			scriptArgs: options.scriptArgs,
		} );
	}
	result = await Promise.resolve( result );

	if ( result.status === EXIT_RUNTIME || result.status === EXIT_PARSE ) {
		return result.status;
	}
	return result.status === 0 ? EXIT_OK : EXIT_RUNTIME;
}

module.exports = {
	EXIT_OK,
	EXIT_RUNTIME,
	EXIT_USAGE,
	EXIT_PARSE,
	runCli,
	runCliAsync,
	parseCliArgs,
	stripShebang,
};
