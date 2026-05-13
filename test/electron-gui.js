'use strict';

const assert = require( 'node:assert/strict' );
const fs = require( 'node:fs' );
const os = require( 'node:os' );
const path = require( 'node:path' );
const projectPaths = require( '../lib/paths' );

const {
	createElectronGuiBridge,
	runElectronMain,
} = require( '../lib/electron/main' );
const { createElectronRuntime } = require( '../lib/zuzu' );

const repoRoot = projectPaths.projectRoot;
const pending = [];
let lifecycleReady = Promise.resolve();

function findSnapshot( snapshot, predicate ) {
	if ( predicate( snapshot ) ) {
		return snapshot;
	}
	for ( const child of snapshot.children || [] ) {
		const found = findSnapshot( child, predicate );
		if ( found ) {
			return found;
		}
	}
	return null;
}

function createFakeBridge() {
	let nextWindowId = 1;
	const windows = new Map();
	return {
		windows,
		openWindow( snapshot, options = {} ) {
			const id = nextWindowId++;
			windows.set( id, {
				snapshot,
				options,
				messages: [],
			} );
			return id;
		},
		closeWindow( id ) {
			const win = windows.get( id );
			if ( win && win.options.onClosed ) {
				win.options.onClosed();
			}
		},
		createWidget( id, parentGuid, snapshot, index ) {
			windows.get( id ).messages.push( {
				type: 'create',
				parentGuid,
				widgetType: snapshot.type,
				index,
			} );
		},
		updateWidget( id, snapshot ) {
			windows.get( id ).messages.push( {
				type: 'update',
				widgetType: snapshot.type,
				id: snapshot.id,
				value: snapshot.props.value,
			} );
		},
		destroyWidget( id, widgetGuid ) {
			windows.get( id ).messages.push( {
				type: 'destroy',
				widgetGuid,
			} );
		},
	};
}

function createFakeElectron() {
	const ipcHandlers = new Map();
	const dialogCalls = [];
	const dialogOptions = ( ...args ) => args.length > 1 ? args[1] : args[0];
	class BrowserWindow {
		constructor( options = {} ) {
			this.options = options;
			this.handlers = new Map();
			this.messages = [];
			this.webContents = {
				send: ( ...args ) => {
					this.messages.push( args );
				},
			};
			this.menu = null;
			this.destroyed = false;
			BrowserWindow.last = this;
			BrowserWindow.instances.push( this );
		}

		static instances = [];

		static fromWebContents() {
			return BrowserWindow.last;
		}

		on( name, handler ) {
			this.handlers.set( name, handler );
		}

		async loadFile() {}

		async loadURL() {}

		show() {
			this.shown = true;
		}

		focus() {
			this.focused = true;
		}

		isDestroyed() {
			return this.destroyed;
		}

		close() {
			this.destroyed = true;
			const handler = this.handlers.get( 'closed' );
			if ( handler ) {
				handler();
			}
		}

		setMenu( menu ) {
			this.menu = menu;
		}
	}
	return {
		BrowserWindow,
		dialog: {
			calls: dialogCalls,
			showMessageBoxSync( options ) {
				dialogCalls.push( [ 'message', options ] );
				return options.type === 'question' ? 1 : 0;
			},
			showOpenDialogSync( ...args ) {
				const options = dialogOptions( ...args );
				dialogCalls.push( [ 'open', options ] );
				return options.properties.includes( 'openDirectory' )
					? [ '/tmp/demo-dir' ]
					: [ '/tmp/demo.txt', '/tmp/other.txt' ];
			},
			async showOpenDialog( ...args ) {
				const options = dialogOptions( ...args );
				dialogCalls.push( [ 'open', options ] );
				return {
					canceled: false,
					filePaths: options.properties.includes( 'openDirectory' )
						? [ '/tmp/demo-dir' ]
						: [ '/tmp/demo.txt', '/tmp/other.txt' ],
				};
			},
			showSaveDialogSync( ...args ) {
				const options = dialogOptions( ...args );
				dialogCalls.push( [ 'save', options ] );
				return options.defaultPath || '/tmp/save.txt';
			},
			async showSaveDialog( ...args ) {
				const options = dialogOptions( ...args );
				dialogCalls.push( [ 'save', options ] );
				return {
					canceled: false,
					filePath: options.defaultPath || '/tmp/save.txt',
				};
			},
		},
		ipcMain: {
			on( name, handler ) {
				ipcHandlers.set( name, handler );
			},
		},
		Menu: {
			buildFromTemplate( template ) {
				return { template };
			},
			setApplicationMenu() {},
		},
	};
}

{
	for ( const name of [
		'_phase1',
		'_phase2',
		'_phase3',
		'_phase4',
		'_phase5',
		'objects',
	] ) {
		const bridge = createFakeBridge();
		const runtime = createElectronRuntime( {
			repoRoot,
			guiBridge: bridge,
		} );
		const filename = path.join(
			repoRoot,
			`stdlib/tests/std/gui/${name}.zzs`,
		);
		const result = runtime.runSource(
			fs.readFileSync( filename, 'utf8' ),
			{ filename }
		);
		assert.equal( result.status, 0, result.stderr );
		assert.match( result.stdout, /^1\.\.[1-9][0-9]*$/m );
	}
}

{
	const electron = createFakeElectron();
	const seen = [];
	const bridge = createElectronGuiBridge( electron, {
		rendererHtml: '/tmp/renderer.html',
		preload: '/tmp/preload.js',
	} );
	const id = bridge.openWindow( {
		guid: 'w1',
		type: 'Window',
		props: {},
		children: [
			{
				guid: 'm1',
				type: 'Menu',
				id: 'file-menu',
				props: { text: 'File' },
				children: [
					{
						guid: 'i1',
						type: 'MenuItem',
						id: 'quit',
						props: { text: 'Quit' },
						children: [],
					},
				],
			},
		],
	}, {
		onEvent( event ) {
			seen.push( event );
		},
	} );
	assert.equal( typeof id.then, 'function' );
	pending.push( id.then( () => {
		const win = electron.BrowserWindow.last;
		assert.equal( win.menu.template[0].label, 'File' );
		assert.equal( win.menu.template[0].submenu[0].label, 'Quit' );
		win.menu.template[0].submenu[0].click();
		assert.equal( seen[0].type, 'click' );
		assert.equal( seen[0].widgetGuid, 'i1' );
	} ) );
}

{
	const electron = createFakeElectron();
	const bridge = createElectronGuiBridge( electron, {
		rendererHtml: '/tmp/renderer.html',
		preload: '/tmp/preload.js',
	} );
	assert.equal(
		bridge.alert( 'Saved', { title: 'Done', ok_text: 'Great' } ),
		true,
	);
	assert.equal(
		bridge.confirm( 'Continue?', { title: 'Question', value: true } ),
		true,
	);
	pending.push( ( async () => {
		const openedFiles = await bridge.fileOpen( {
			multiple: true,
			filter: [ [ 'Text', '*.txt' ] ],
		} );
		const savedFile = await bridge.fileSave( { value: '/tmp/out.txt' } );
		const openedDirectory = await bridge.directoryOpen( {} );
		const savedDirectory = await bridge.directorySave( {} );
		assert.equal( openedFiles[0], '/tmp/demo.txt' );
		assert.equal( savedFile, '/tmp/out.txt' );
		assert.equal( openedDirectory, '/tmp/demo-dir' );
		assert.equal( savedDirectory, '/tmp/demo-dir' );
		assert.deepEqual(
			electron.dialog.calls.map( (call) => call[0] ),
			[ 'message', 'message', 'open', 'save', 'open', 'open' ],
		);
		assert.equal(
			electron.BrowserWindow.instances.filter(
				(win) => win.options.show === true
			).length,
			1,
		);
	} )() );
}

{
	const electron = createFakeElectron();
	const bridge = createElectronGuiBridge( electron, {
		createDialogOwner: false,
		rendererHtml: '/tmp/renderer.html',
		preload: '/tmp/preload.js',
	} );
	pending.push( bridge.fileOpen( {} ).then( (openedFile) => {
		assert.equal( openedFile, '/tmp/demo.txt' );
		assert.equal( electron.BrowserWindow.instances.length, 0 );
	} ) );
}

{
	const appHandlers = new Map();
	const app = {
		quitCalls: 0,
		whenReady() {
			return Promise.resolve();
		},
		on( name, handler ) {
			appHandlers.set( name, handler );
		},
		quit() {
			this.quitCalls++;
		},
	};
	const calls = [];
	const tempDir = fs.mkdtempSync(
		path.join( os.tmpdir(), 'zuzu-electron-dialogue-' )
	);
	const scriptPath = path.join( tempDir, 'dialogue-lifecycle.zzs' );
	fs.writeFileSync( scriptPath, `
		from std/gui/dialogue import prompt, file_open;
		async function wait_for_dialogue ( value ) {
			return value;
		}
		async function __main__ () {
			await {
				wait_for_dialogue( prompt( "Name?", title: "Prompt" ) );
			};
			await {
				wait_for_dialogue( file_open( title: "Open" ) );
			};
		}
	` );
	const bridge = {
		...createFakeBridge(),
		alert() {
			calls.push( 'alert' );
			return true;
		},
		confirm() {
			calls.push( 'confirm' );
			return true;
		},
		prompt() {
			calls.push( 'prompt' );
			return null;
		},
		fileOpen() {
			calls.push( 'fileOpen' );
			assert.equal( app.quitCalls, 0 );
			return '/tmp/after-prompt';
		},
		fileSave() {
			calls.push( 'fileSave' );
			return '/tmp/save';
		},
		directoryOpen() {
			calls.push( 'directoryOpen' );
			return '/tmp';
		},
		directorySave() {
			calls.push( 'directorySave' );
			return '/tmp/new';
		},
		colourPicker() {
			calls.push( 'colourPicker' );
			return '#336699';
		},
		openWindow( snapshot, options ) {
			calls.push( 'openWindow' );
			setTimeout( () => {
				const ok = findSnapshot( snapshot, (node) => node.id === 'ok' );
				options.onEvent( {
					type: 'click',
					widgetGuid: ok.guid,
				} );
				appHandlers.get( 'window-all-closed' )();
			}, 0 );
			return Promise.resolve( 1 );
		},
	};
	lifecycleReady = runElectronMain(
		[ scriptPath ],
		{
			electron: {
				app,
				BrowserWindow: {
					getAllWindows() {
						return [];
					},
				},
			},
			repoRoot,
			guiBridge: bridge,
		}
	).then( (status) => {
		try {
			assert.equal( status, 0 );
			assert.ok( calls.indexOf( 'fileOpen' ) > calls.indexOf( 'openWindow' ) );
			assert.equal( app.quitCalls, 1 );
		}
		finally {
			fs.rmSync( tempDir, { recursive: true, force: true } );
		}
	} );
	pending.push( lifecycleReady );
}

{
	const priorPending = pending.slice();
	pending.push( Promise.all( priorPending ).then( () => {
		const previousExitCode = process.exitCode;
		const originalStderrWrite = process.stderr.write;
		const stderr = [];
		const app = {
			exitCalls: [],
			whenReady() {
				return Promise.resolve();
			},
			on() {},
			exit( code ) {
				this.exitCalls.push( code );
			},
			quit() {
				throw new Error( 'failed scripts should use app.exit(status)' );
			},
		};
		const tempDir = fs.mkdtempSync(
			path.join( os.tmpdir(), 'zuzu-electron-failure-' )
		);
		const scriptPath = path.join( tempDir, 'failure.zzs' );
		fs.writeFileSync( scriptPath, 'die "boom";\n' );
		process.stderr.write = (chunk, encoding, callback) => {
			stderr.push( String( chunk ) );
			if ( typeof encoding === 'function' ) {
				encoding();
			}
			else if ( typeof callback === 'function' ) {
				callback();
			}
			return true;
		};
		return runElectronMain(
			[ scriptPath ],
			{
				electron: {
					app,
					BrowserWindow: {
						getAllWindows() {
							return [];
						},
					},
				},
				repoRoot,
				guiBridge: createFakeBridge(),
			}
		).then( (status) => {
			assert.equal( status, 1 );
			assert.deepEqual( app.exitCalls, [ 1 ] );
			assert.equal( process.exitCode, 1 );
			assert.match( stderr.join( '' ), /boom/u );
		} ).finally( () => {
			process.stderr.write = originalStderrWrite;
			process.exitCode = previousExitCode;
			fs.rmSync( tempDir, { recursive: true, force: true } );
		} );
	} ) );
}

{
	const calls = [];
	const bridge = {
			...createFakeBridge(),
		alert( message, options ) {
			calls.push( [ 'alert', message, options.title ] );
			return true;
		},
		confirm( message, options ) {
			calls.push( [ 'confirm', message, options.title ] );
			return true;
		},
		fileOpen( options ) {
			calls.push( [ 'fileOpen', options.title ] );
			return options.multiple ? [ '/tmp/a', '/tmp/b' ] : '/tmp/a';
		},
		fileSave( options ) {
			calls.push( [ 'fileSave', options.title ] );
			return '/tmp/out';
		},
		directoryOpen( options ) {
			calls.push( [ 'directoryOpen', options.title ] );
			return '/tmp';
		},
		directorySave( options ) {
			calls.push( [ 'directorySave', options.title ] );
			return '/tmp/new';
		},
	};
	const runtime = createElectronRuntime( {
		repoRoot,
		guiBridge: bridge,
	} );
	const result = runtime.runSource( `
		from std/gui/dialogue import
			alert,
			confirm,
			file_open,
			file_save,
			directory_open,
			directory_save;
		alert( "Saved", title: "Done" );
		say( confirm( "Continue?", title: "Question" ) );
		say( file_open( title: "Open" ) );
		say( file_open( title: "Open Many", multiple: true ).length() );
		say( file_save( title: "Save" ) );
		say( directory_open( title: "Open Directory" ) );
		say( directory_save( title: "Save Directory" ) );
	`, { filename: '/app/electron-dialogues.zzs' } );
	assert.equal( result.status, 0, result.stderr );
	assert.equal(
		result.stdout,
		'true\n/tmp/a\n2\n/tmp/out\n/tmp\n/tmp/new\n',
	);
	assert.deepEqual(
		calls.map( (call) => call[0] ),
		[
			'alert',
			'confirm',
			'fileOpen',
			'fileOpen',
			'fileSave',
			'directoryOpen',
			'directorySave',
		],
	);
}

{
	const runtime = createElectronRuntime( {
		repoRoot,
		guiBridge: createFakeBridge(),
	} );
	const result = runtime.runSource( `
		from test/more import *;
		from std/eval import eval;
		for ( let source in [
			"from std/gui/dialogue import file_open; file_open(auto_result: \\"x\\");",
			"from std/gui/dialogue import file_save; file_save(auto_result: \\"x\\");",
			"from std/gui/dialogue import directory_open; directory_open(auto_result: \\"x\\");",
			"from std/gui/dialogue import directory_save; directory_save(auto_result: \\"x\\");",
		] ) {
			let e := exception( function () {
				eval( source, deny_fs: true );
			} );
			ok( e instanceof Exception, "fs-denied path dialogue throws" );
			ok( e{message} ~ /GUI_DIALOGUE_FS_DENIED/, "fs-denied path dialogue error includes code" );
		}
		done_testing();
	`, { filename: '/app/electron-dialogue-deny-fs.zzs' } );
	assert.equal( result.status, 0, result.stderr );
	assert.match( result.stdout, /^1\.\.[1-9][0-9]*$/m );
}

{
	const electron = createFakeElectron();
	const bridge = createElectronGuiBridge( electron, {
		rendererHtml: '/tmp/renderer.html',
		preload: '/tmp/preload.js',
		assetBasePaths: [ repoRoot ],
	} );
	const id = bridge.openWindow( {
		guid: 'w1',
		type: 'Window',
		props: {},
		children: [
			{
				guid: 'i1',
				type: 'Image',
				id: 'logo',
				props: {
					src: 'examples/gui-demo-image.png',
					alt: 'Demo image',
				},
				children: [],
			},
		],
	} );
	pending.push( id.then( () => {
		const win = electron.BrowserWindow.last;
		const renderMessage = win.messages.find(
			(message) => message[0] === 'zuzu-gui:render'
		);
		const image = findSnapshot(
			renderMessage[1].snapshot,
			(node) => node.type === 'Image'
		);
		assert.match( image.props.src, /^file:\/\// );
		assert.ok( image.props.src.includes( '/examples/gui-demo-image.png' ) );
	} ) );
}

{
	const bridge = createFakeBridge();
	bridge.openWindow = function openWindow( snapshot, options = {} ) {
		const id = 1;
		this.windows.set( id, {
			snapshot,
			options,
			messages: [],
		} );
		const input = findSnapshot( snapshot, (node) => node.id === 'name' );
		const button = findSnapshot( snapshot, (node) => node.id === 'go' );
		options.onEvent( {
			type: 'input',
			widgetGuid: input.guid,
			value: 'Grace',
		} );
		options.onEvent( {
			type: 'click',
			widgetGuid: button.guid,
		} );
		return id;
	};
	const runtime = createElectronRuntime( {
		repoRoot,
		guiBridge: bridge,
	} );
	const result = runtime.runSource( `
		from std/gui/objects import Window, VBox, Input, Button;
		let name := new Input( id: "name", value: "Ada" );
		let go := new Button( id: "go", text: "Go" );
		let w := new Window(
			title: "Bridge",
			children: [ new VBox( children: [ name, go ] ) ],
		);
		go.click( function () {
			say( "clicked:" _ name.value() );
		} );
		w.show();
	`, { filename: '/app/electron-bridge.zzs' } );
	assert.equal( result.status, 0, result.stderr );
	assert.equal( result.stdout, 'clicked:Grace\n' );
}

{
	const bridge = createFakeBridge();
	const runtime = createElectronRuntime( {
		repoRoot,
		guiBridge: bridge,
	} );
	const result = runtime.runSource( `
		from std/gui/objects import Window, VBox, Label, Input;
		let root := new VBox( id: "root" );
		let input := new Input( id: "name", value: "Ada" );
		let w := new Window( title: "Mutate", children: [ root ] );
		root.add_child(input);
		w.show();
		let added := new Label( id: "added", text: "Added" );
		root.add_child(added);
		input.value("Grace");
		root.remove_child(added);
	`, { filename: '/app/electron-mutations.zzs' } );
	assert.equal( result.status, 0, result.stderr );
	const messages = bridge.windows.get( 1 ).messages;
	assert.equal( messages[0].type, 'create' );
	assert.equal( messages[0].widgetType, 'Label' );
	assert.equal( messages[1].type, 'update' );
	assert.equal( messages[1].id, 'name' );
	assert.equal( messages[1].value, 'Grace' );
	assert.equal( messages[2].type, 'destroy' );
}

{
	pending.push( lifecycleReady.then( () => {
		const calls = [];
		const bridge = {
			...createFakeBridge(),
			prompt( message, options ) {
				calls.push( [ 'prompt', message, options.title ] );
				return null;
			},
			colourPicker( options ) {
				calls.push( [ 'colourPicker', options.title ] );
				return null;
			},
			directorySave( options ) {
				calls.push( [ 'directorySave', options.title ] );
				return null;
			},
			openWindow( snapshot, options ) {
				calls.push( [ 'openWindow', snapshot.props.title ] );
				setTimeout( () => {
					const cancel = findSnapshot(
						snapshot,
						(node) => node.id === 'cancel'
					);
					const ok = findSnapshot( snapshot, (node) => node.id === 'ok' );
					options.onEvent( {
						type: 'click',
						widgetGuid: ( cancel || ok ).guid,
					} );
				}, 0 );
				return Promise.resolve( 1 );
			},
		};
		const runtime = createElectronRuntime( {
			repoRoot,
			guiBridge: bridge,
		} );
		const result = runtime.runSource( `
			from std/gui/dialogue import prompt, colour_picker, directory_save;
			async function wait_for_dialogue ( value ) {
				return value;
			}
			async function __main__ () {
				say(
					await {
						wait_for_dialogue( prompt( "Name?", title: "Prompt" ) );
					} ≡ null
				);
				say(
					await {
						wait_for_dialogue( directory_save( title: "Save Directory" ) );
					} ≡ null
				);
				say(
					await {
						wait_for_dialogue( colour_picker( title: "Colour" ) );
					}
				);
			}
		`, { filename: '/app/electron-dialogue-cancel.zzs' } );
		return Promise.resolve( result ).then( (resolved) => {
			assert.equal( resolved.status, 0, resolved.stderr );
			assert.equal( resolved.stdout, '1\n1\n#000000\n' );
			assert.deepEqual(
				calls.map( (call) => call[0] ),
				[
					'prompt',
					'openWindow',
					'directorySave',
					'colourPicker',
					'openWindow',
				],
			);
		} );
	} ) );
}

{
	const priorPending = pending.slice();
	pending.push( Promise.all( priorPending ).then( () => {
		const previousExitCode = process.exitCode;
		const app = {
			whenReady() {
				return Promise.resolve();
			},
			on() {},
			quit() {},
			getAppPath() {
				return path.join( repoRoot, 'bin' );
			},
		};
		const tempDir = fs.mkdtempSync(
			path.join( os.tmpdir(), 'zuzu-electron-root-' )
		);
		const scriptPath = path.join( tempDir, 'root.zzs' );
		fs.writeFileSync(
			scriptPath,
			'from std/string import substr;\n'
				+ 'die "wrong std/string" unless substr("abcdef", 1, 3) eq "bcd";\n',
			'utf8'
		);
		return runElectronMain(
			[ scriptPath ],
			{
				electron: {
					app,
					BrowserWindow: {
						getAllWindows() {
							return [];
						},
					},
				},
				guiBridge: createFakeBridge(),
			}
		).then( (status) => {
			assert.equal( status, 0 );
		} ).finally( () => {
			process.exitCode = previousExitCode;
			fs.rmSync( tempDir, { recursive: true, force: true } );
		} );
	} ) );
}

	Promise.all( pending ).then(
	() => {
		console.log( 'electron gui tests passed' );
	},
	(err) => {
		throw err;
	},
);
