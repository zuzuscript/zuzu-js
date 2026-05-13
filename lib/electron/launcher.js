'use strict';

const path = require( 'node:path' );
const { spawn } = require( 'node:child_process' );

const EXIT_RUNTIME = 1;

function electronCommand() {
	if ( process.env.ZUZU_JS_ELECTRON_COMMAND ) {
		return process.env.ZUZU_JS_ELECTRON_COMMAND;
	}
	try {
		return require( 'electron' );
	}
	catch ( _err ) {
		return path.join(
			__dirname,
			'..',
			'..',
			'node_modules',
			'.bin',
			process.platform === 'win32' ? 'electron.cmd' : 'electron'
		);
	}
}

function forwardStream( stream, target ) {
	if ( stream ) {
		stream.on( 'data', (chunk) => {
			target.write( chunk );
		} );
	}
}

function launchElectronScript( argv, options = {} ) {
	return new Promise( (resolve, reject) => {
		const command = options.command || electronCommand();
		const launcher = options.launcher || path.join(
			__dirname,
			'..',
			'..',
			'bin',
			'zuzu-js-electron'
		);
		const child = spawn( command, [ launcher, ...argv ], {
			cwd: options.cwd || process.cwd(),
			stdio: options.stdio || [ 'inherit', 'pipe', 'pipe' ],
			env: {
				...process.env,
				...( options.env || {} ),
			},
		} );
		forwardStream( child.stdout, process.stdout );
		forwardStream( child.stderr, process.stderr );
		child.on( 'error', reject );
		child.on( 'close', (code, signal) => {
			if ( signal ) {
				process.stderr.write( `Electron exited with signal ${signal}\n` );
				resolve( EXIT_RUNTIME );
				return;
			}
			resolve( code == null ? EXIT_RUNTIME : code );
		} );
	} );
}

module.exports = {
	electronCommand,
	launchElectronScript,
};
