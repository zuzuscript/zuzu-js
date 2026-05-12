'use strict';

const fs = require( 'node:fs' );
const path = require( 'node:path' );
const { pathToFileURL } = require( 'node:url' );

const { createElectronRuntime } = require( '../runtime-entrypoints' );
const projectPaths = require( '../paths' );

function installSafeDefineProperties() {
	if ( Object.__zuzu_safe_define_properties ) {
		return;
	}
	const nativeDefineProperty = Object.defineProperty;
	const nativeDefineProperties = Object.defineProperties;
	function safeDescriptor( descriptor ) {
		if ( !descriptor || typeof descriptor !== 'object' ) {
			return descriptor;
		}
		const safe = Object.create( null );
		for ( const key of [
			'value',
			'get',
			'set',
			'writable',
			'enumerable',
			'configurable',
		] ) {
			if ( Object.prototype.hasOwnProperty.call( descriptor, key ) ) {
				safe[key] = descriptor[key];
			}
		}
		return safe;
	}
	Object.defineProperty = function zuzuSafeDefineProperty(
		obj,
		prop,
		descriptor
	) {
		return nativeDefineProperty( obj, prop, safeDescriptor( descriptor ) );
	};
	Object.defineProperties = function zuzuSafeDefineProperties(
		obj,
		descriptors
	) {
		const safe = Object.create( null );
		for ( const key of Object.keys( descriptors || {} ) ) {
			safe[key] = safeDescriptor( descriptors[key] );
		}
		return nativeDefineProperties( obj, safe );
	};
	nativeDefineProperty( Object, '__zuzu_safe_define_properties', {
		value: true,
		enumerable: false,
		configurable: false,
	} );
}

function loadElectron() {
	installSafeDefineProperties();
	try {
		return require( 'electron' );
	}
	catch ( err ) {
		const wrapped = new Error(
			'zuzu-js-electron must be launched by Electron, for example: ' +
			'electron bin/zuzu-js-electron app.zzs'
		);
		wrapped.cause = err;
		throw wrapped;
	}
}

function isMenuSnapshot( snapshot ) {
	return !!snapshot && [ 'Menu', 'MenuItem' ].includes( snapshot.type );
}

function cloneSnapshot( snapshot ) {
	if ( snapshot == null || typeof snapshot !== 'object' ) {
		return snapshot;
	}
	if ( Array.isArray( snapshot ) ) {
		return snapshot.map( cloneSnapshot );
	}
	const clone = {};
	for ( const [ key, value ] of Object.entries( snapshot ) ) {
		clone[key] = cloneSnapshot( value );
	}
	return clone;
}

function isUrlLike( value ) {
	return /^[a-z][a-z0-9+.-]*:/i.test( value );
}

function resolveAssetPath( value, assetBasePaths ) {
	if ( !value || typeof value !== 'string' || isUrlLike( value ) ) {
		return value;
	}
	const compatiblePath = projectPaths.resolveCompatibilityPath( value );
	if ( compatiblePath !== value && fs.existsSync( compatiblePath ) ) {
		return pathToFileURL( compatiblePath ).href;
	}
	if ( path.isAbsolute( value ) ) {
		return pathToFileURL( value ).href;
	}
	for ( const basePath of assetBasePaths ) {
		const candidate = path.resolve( basePath, value );
		if ( fs.existsSync( candidate ) ) {
			return pathToFileURL( candidate ).href;
		}
	}
	return value;
}

function resolveSnapshotAssets( snapshot, assetBasePaths ) {
	const resolved = cloneSnapshot( snapshot );
	function visit( node ) {
		if ( !node || typeof node !== 'object' ) {
			return;
		}
		const props = node.props || {};
		if ( node.type === 'Image' && props.src ) {
			props.src = resolveAssetPath( props.src, assetBasePaths );
		}
		if ( node.type === 'Tab' && props.icon ) {
			props.icon = resolveAssetPath( props.icon, assetBasePaths );
		}
		for ( const child of node.children || [] ) {
			visit( child );
		}
	}
	visit( resolved );
	return resolved;
}

function dialogOption( optionsForDialog, key, fallback = null ) {
	if (
		optionsForDialog
		&& typeof optionsForDialog.get === 'function'
	) {
		return optionsForDialog.get( key, fallback );
	}
	if (
		optionsForDialog
		&& Object.prototype.hasOwnProperty.call( optionsForDialog, key )
	) {
		return optionsForDialog[key];
	}
	return fallback;
}

function dialogString( optionsForDialog, key, fallback = '' ) {
	const value = dialogOption( optionsForDialog, key, fallback );
	return value == null ? value : String( value );
}

function dialogBool( optionsForDialog, key, fallback = false ) {
	return dialogOption( optionsForDialog, key, fallback ) ? true : false;
}

function filterExtensions( pattern ) {
	if ( Array.isArray( pattern ) ) {
		return pattern.flatMap( filterExtensions );
	}
	return String( pattern || '*' )
		.split( /[;,]/ )
		.map( (part) => part.trim() )
		.filter( Boolean )
		.map( (part) => {
			if ( part === '*' || part === '*.*' ) {
				return '*';
			}
			return part.replace( /^\*\./, '' ).replace( /^\./, '' ) || '*';
		} );
}

function electronFilters( optionsForDialog ) {
	const rawFilter = dialogOption( optionsForDialog, 'filter', null );
	if ( !Array.isArray( rawFilter ) ) {
		return undefined;
	}
	const filters = [];
	for ( const entry of rawFilter ) {
		if ( Array.isArray( entry ) ) {
			filters.push( {
				name: String( entry[0] || 'Files' ),
				extensions: filterExtensions( entry[1] || '*' ),
			} );
			continue;
		}
		if ( entry && typeof entry === 'object' ) {
			const name = dialogOption(
				entry,
				'label',
				dialogOption( entry, 'name', 'Files' )
			);
			const mask = dialogOption(
				entry,
				'mask',
				dialogOption( entry, 'pattern', '*' )
			);
			filters.push( {
				name: String( name || 'Files' ),
				extensions: filterExtensions( mask ),
			} );
		}
	}
	return filters.length > 0 ? filters : undefined;
}

function electronFileDialogOptions( optionsForDialog, kind ) {
	const defaultTitle = kind === 'save'
		? 'Save File'
		: kind === 'directory'
			? 'Open Directory'
			: kind === 'directory_save'
				? 'Save Directory'
				: 'Open File';
	const defaultPath = dialogString(
		optionsForDialog,
		'default_path',
		dialogString( optionsForDialog, 'value', '' )
	);
	const resolvedDefaultPath = defaultPath
		? path.resolve( defaultPath )
		: '';
	const properties = [];
	if ( dialogBool( optionsForDialog, 'show_hidden', false ) ) {
		properties.push( 'showHiddenFiles' );
	}
	if ( kind === 'save' && dialogBool( optionsForDialog, 'create_directory', true ) ) {
		properties.push( 'createDirectory' );
	}
	if ( kind === 'save' && dialogBool( optionsForDialog, 'overwrite_prompt', true ) ) {
		properties.push( 'showOverwriteConfirmation' );
	}
	return {
		title: dialogString(
			optionsForDialog,
			'title',
			defaultTitle
		),
		defaultPath: resolvedDefaultPath || undefined,
		buttonLabel: dialogString( optionsForDialog, 'ok_text', '' ) || undefined,
		filters: electronFilters( optionsForDialog ),
		properties,
	};
}

function electronOpenDialogOptions( optionsForDialog, kind ) {
	const options = electronFileDialogOptions( optionsForDialog, kind );
	options.properties = options.properties || [];
	if ( kind === 'directory' || kind === 'directory_save' ) {
		options.properties.unshift( 'openDirectory' );
		if ( kind === 'directory_save' ) {
			options.properties.push( 'createDirectory' );
		}
	}
	else {
		options.properties.unshift( 'openFile' );
		if ( dialogBool( optionsForDialog, 'multiple', false ) ) {
			options.properties.push( 'multiSelections' );
		}
	}
	return options;
}

function messageBoxOptions( message, optionsForDialog, kind ) {
	const isConfirm = kind === 'confirm';
	const buttons = isConfirm
		? [
			dialogString( optionsForDialog, 'cancel_text', 'Cancel' ),
			dialogString( optionsForDialog, 'ok_text', 'OK' ),
		]
		: [ dialogString( optionsForDialog, 'ok_text', 'OK' ) ];
	return {
		type: isConfirm ? 'question' : 'info',
		title: dialogString(
			optionsForDialog,
			'title',
			isConfirm ? 'Confirm' : 'Alert'
		),
		message: String( message ?? '' ),
		buttons,
		defaultId: isConfirm
			? ( dialogBool( optionsForDialog, 'value', false ) ? 1 : 0 )
			: 0,
		cancelId: 0,
		noLink: true,
	};
}

function menuChildren( snapshot ) {
	return ( snapshot && Array.isArray( snapshot.children ) )
		? snapshot.children.filter( (child) => child.type === 'Menu' )
		: [];
}

function menuTemplateFor( snapshot, emitEvent ) {
	return menuChildren( snapshot ).map( (menu) => {
		const props = menu.props || {};
		return {
			id: menu.id || menu.guid,
			label: props.text || 'Menu',
			visible: props.visible !== false,
			enabled: props.disabled !== true && props.enabled !== false,
			submenu: ( menu.children || [] ).map(
				(item) => menuItemTemplateFor( item, emitEvent )
			),
		};
	} );
}

function menuItemTemplateFor( item, emitEvent ) {
	const props = item.props || {};
	return {
		id: item.id || item.guid,
		label: props.text || '',
		visible: props.visible !== false,
		enabled: props.disabled !== true && props.enabled !== false,
		click() {
			emitEvent( {
				type: 'click',
				widgetGuid: item.guid || null,
			} );
		},
	};
}

function installWindowMenu( Menu, win, snapshot, emitEvent ) {
	if ( !Menu || !win || win.isDestroyed() ) {
		return;
	}
	const template = menuTemplateFor( snapshot, emitEvent );
	const menu = template.length > 0 ? Menu.buildFromTemplate( template ) : null;
	if ( typeof win.setMenu === 'function' ) {
		win.setMenu( menu );
		return;
	}
	if ( typeof Menu.setApplicationMenu === 'function' ) {
		Menu.setApplicationMenu( menu );
	}
}

function activeWindow( BrowserWindow, windows ) {
	if ( typeof BrowserWindow.getFocusedWindow === 'function' ) {
		const focused = BrowserWindow.getFocusedWindow();
		if ( windowIsAlive( focused ) ) {
			return focused;
		}
	}
	for ( const win of windows.values() ) {
		if ( windowIsAlive( win ) ) {
			return win;
		}
	}
	return null;
}

function windowIsAlive( win ) {
	return !!win
		&& (
			typeof win.isDestroyed !== 'function'
			|| !win.isDestroyed()
		);
}

function nextDialogTurn() {
	return new Promise( (resolve) => {
		setTimeout( resolve, 0 );
	} );
}

function electronGuiDebug( message ) {
	if ( process.env.ZUZU_ELECTRON_GUI_DEBUG ) {
		process.stderr.write( `[zuzu-electron] ${message}\n` );
	}
}

function findSnapshot( snapshot, guid ) {
	if ( !snapshot || !guid ) {
		return null;
	}
	if ( snapshot.guid === guid ) {
		return snapshot;
	}
	for ( const child of snapshot.children || [] ) {
		const found = findSnapshot( child, guid );
		if ( found ) {
			return found;
		}
	}
	return null;
}

function isMenuParent( root, guid ) {
	const parent = findSnapshot( root, guid );
	return !!parent && parent.type === 'Menu';
}

function insertSnapshotChild( root, parentGuid, child, index = null ) {
	const parent = findSnapshot( root, parentGuid );
	if ( !parent ) {
		return false;
	}
	if ( !Array.isArray( parent.children ) ) {
		parent.children = [];
	}
	if ( Number.isInteger( index ) && index >= 0 && index < parent.children.length ) {
		parent.children.splice( index, 0, child );
	}
	else {
		parent.children.push( child );
	}
	return true;
}

function replaceSnapshot( root, next ) {
	if ( !root || !next ) {
		return null;
	}
	if ( root.guid === next.guid ) {
		const old = { ...root };
		Object.assign( root, next );
		return old;
	}
	for ( const child of root.children || [] ) {
		const replaced = replaceSnapshot( child, next );
		if ( replaced ) {
			return replaced;
		}
	}
	return null;
}

function removeSnapshot( root, guid ) {
	if ( !root || !Array.isArray( root.children ) ) {
		return null;
	}
	const index = root.children.findIndex( (child) => child.guid === guid );
	if ( index >= 0 ) {
		return root.children.splice( index, 1 )[0];
	}
	for ( const child of root.children ) {
		const removed = removeSnapshot( child, guid );
		if ( removed ) {
			return removed;
		}
	}
	return null;
}

function createElectronGuiBridge( electron, options = {} ) {
	installSafeDefineProperties();
	const { BrowserWindow, Menu, app, dialog, ipcMain } = electron;
	const rendererHtml = options.rendererHtml
		|| path.join( __dirname, 'renderer.html' );
	const preload = options.preload
		|| path.join( __dirname, 'preload.js' );
	const assetBasePaths = ( options.assetBasePaths || [] )
		.filter( (value) => typeof value === 'string' && value.length > 0 )
		.map( (value) => path.resolve( value ) );
	const windows = new Map();
	const handlers = new Map();
	const closeRequestHandlers = new Map();
	const closedHandlers = new Map();
	const snapshots = new Map();
	const scriptClosing = new Set();
	let nextWindowId = 1;
	let dialogOwnerWindow = null;

	function dialogParentWindow() {
		const active = activeWindow( BrowserWindow, windows );
		if ( active ) {
			return active;
		}
		if ( options.createDialogOwner === false ) {
			return null;
		}
		if ( windowIsAlive( dialogOwnerWindow ) ) {
			return dialogOwnerWindow;
		}
		dialogOwnerWindow = new BrowserWindow( {
			show: true,
			width: 1,
			height: 1,
			skipTaskbar: true,
			frame: false,
			resizable: false,
			minimizable: false,
			maximizable: false,
			webPreferences: {
				contextIsolation: true,
				nodeIntegration: false,
				sandbox: true,
			},
		} );
		if ( typeof dialogOwnerWindow.on === 'function' ) {
			dialogOwnerWindow.on( 'closed', () => {
				dialogOwnerWindow = null;
			} );
		}
		return dialogOwnerWindow;
	}

	function callNativeDialog( method, dialogOptions ) {
		const parent = dialogParentWindow();
		if ( app && typeof app.focus === 'function' ) {
			app.focus( { steal: true } );
		}
		electronGuiDebug(
			`dialog ${dialogOptions.title || ''}: parent=${parent ? 'yes' : 'no'}`
		);
		return parent ? method( parent, dialogOptions ) : method( dialogOptions );
	}

	ipcMain.on( 'zuzu-gui:event', (ipcEvent, payload = {}) => {
		const senderWindow = BrowserWindow.fromWebContents( ipcEvent.sender );
		if ( !senderWindow ) {
			return;
		}
		for ( const [ windowId, win ] of windows ) {
			if ( win === senderWindow && handlers.has( windowId ) ) {
				handlers.get( windowId )( payload );
				return;
			}
		}
	} );

	return {
		async openWindow( snapshot, bridgeOptions = {} ) {
			const windowId = nextWindowId++;
			const resolvedSnapshot = resolveSnapshotAssets( snapshot, assetBasePaths );
			const props = snapshot && snapshot.props ? snapshot.props : {};
			const win = new BrowserWindow( {
				title: props.title || 'ZuzuScript',
				width: Number( props.width || 800 ),
				height: Number( props.height || 600 ),
				webPreferences: {
					preload,
					contextIsolation: true,
					nodeIntegration: false,
					sandbox: false,
				},
			} );
			windows.set( windowId, win );
			snapshots.set( windowId, resolvedSnapshot );
			if ( typeof bridgeOptions.onEvent === 'function' ) {
				handlers.set( windowId, bridgeOptions.onEvent );
			}
			if ( typeof bridgeOptions.onCloseRequest === 'function' ) {
				closeRequestHandlers.set( windowId, bridgeOptions.onCloseRequest );
			}
			if ( typeof bridgeOptions.onClosed === 'function' ) {
				closedHandlers.set( windowId, bridgeOptions.onClosed );
			}
			win.on( 'close', (event) => {
				if ( scriptClosing.has( windowId ) ) {
					return;
				}
				const handler = closeRequestHandlers.get( windowId );
				if ( handler && handler() ) {
					event.preventDefault();
				}
			} );
			win.on( 'closed', () => {
				windows.delete( windowId );
				snapshots.delete( windowId );
				handlers.delete( windowId );
				closeRequestHandlers.delete( windowId );
				const onClosed = closedHandlers.get( windowId );
				closedHandlers.delete( windowId );
				scriptClosing.delete( windowId );
				if ( onClosed ) {
					onClosed();
				}
			} );
			installWindowMenu( Menu, win, resolvedSnapshot, (payload) => {
				if ( handlers.has( windowId ) ) {
					handlers.get( windowId )( {
						windowId,
						...payload,
					} );
				}
			} );
			await win.loadFile( rendererHtml );
			win.webContents.send( 'zuzu-gui:render', {
				windowId,
				snapshot: resolvedSnapshot,
			} );
			return windowId;
		},

		closeWindow( windowId ) {
			const win = windows.get( Number( windowId ) );
			if ( win && !win.isDestroyed() ) {
				scriptClosing.add( Number( windowId ) );
				win.close();
			}
		},

		createWidget( windowId, parentGuid, snapshot, index = null ) {
			const win = windows.get( Number( windowId ) );
			const root = snapshots.get( Number( windowId ) );
			const resolvedSnapshot = resolveSnapshotAssets( snapshot, assetBasePaths );
			if ( root ) {
				insertSnapshotChild( root, parentGuid, resolvedSnapshot, index );
				if (
					isMenuSnapshot( resolvedSnapshot )
					|| isMenuParent( root, parentGuid )
				) {
					installWindowMenu( Menu, win, root, (payload) => {
						if ( handlers.has( Number( windowId ) ) ) {
							handlers.get( Number( windowId ) )( {
								windowId: Number( windowId ),
								...payload,
							} );
						}
					} );
					return;
				}
			}
			if ( win && !win.isDestroyed() ) {
				win.webContents.send( 'zuzu-gui:create', {
					parentGuid,
					snapshot: resolvedSnapshot,
					index,
				} );
			}
		},

		updateWidget( windowId, snapshot ) {
			const win = windows.get( Number( windowId ) );
			const root = snapshots.get( Number( windowId ) );
			const resolvedSnapshot = resolveSnapshotAssets( snapshot, assetBasePaths );
			if ( root ) {
				const old = replaceSnapshot( root, resolvedSnapshot );
				if ( isMenuSnapshot( resolvedSnapshot ) || isMenuSnapshot( old ) ) {
					installWindowMenu( Menu, win, root, (payload) => {
						if ( handlers.has( Number( windowId ) ) ) {
							handlers.get( Number( windowId ) )( {
								windowId: Number( windowId ),
								...payload,
							} );
						}
					} );
					return;
				}
			}
			if ( win && !win.isDestroyed() ) {
				win.webContents.send( 'zuzu-gui:update', {
					snapshot: resolvedSnapshot,
				} );
			}
		},

		destroyWidget( windowId, widgetGuid ) {
			const win = windows.get( Number( windowId ) );
			const root = snapshots.get( Number( windowId ) );
			if ( root ) {
				const removed = removeSnapshot( root, widgetGuid );
				if ( isMenuSnapshot( removed ) ) {
					installWindowMenu( Menu, win, root, (payload) => {
						if ( handlers.has( Number( windowId ) ) ) {
							handlers.get( Number( windowId ) )( {
								windowId: Number( windowId ),
								...payload,
							} );
						}
					} );
					return;
				}
			}
			if ( win && !win.isDestroyed() ) {
				win.webContents.send( 'zuzu-gui:destroy', {
					widgetGuid,
				} );
			}
		},

		alert( message, optionsForDialog = {} ) {
			if ( !dialog || typeof dialog.showMessageBoxSync !== 'function' ) {
				return null;
			}
			dialog.showMessageBoxSync(
				messageBoxOptions( message, optionsForDialog, 'alert' )
			);
			return true;
		},

		confirm( message, optionsForDialog = {} ) {
			if ( !dialog || typeof dialog.showMessageBoxSync !== 'function' ) {
				return null;
			}
			return dialog.showMessageBoxSync(
				messageBoxOptions( message, optionsForDialog, 'confirm' )
			) === 1;
		},

		prompt() {
			return null;
		},

		colourPicker() {
			return null;
		},

		async fileOpen( optionsForDialog = {} ) {
			if ( !dialog ) {
				return null;
			}
			const options = electronOpenDialogOptions( optionsForDialog, 'open' );
			let paths = null;
			if ( typeof dialog.showOpenDialog === 'function' ) {
				await nextDialogTurn();
				electronGuiDebug( `fileOpen opening ${options.defaultPath || ''}` );
				const result = await callNativeDialog(
					dialog.showOpenDialog.bind( dialog ),
					options,
				);
				electronGuiDebug( `fileOpen result ${JSON.stringify( result )}` );
				paths = result && !result.canceled ? result.filePaths : null;
			}
			else if ( typeof dialog.showOpenDialogSync === 'function' ) {
				paths = callNativeDialog(
					dialog.showOpenDialogSync.bind( dialog ),
					options,
				);
			}
			if ( !paths || paths.length === 0 ) {
				return null;
			}
			return dialogBool( optionsForDialog, 'multiple', false )
				? paths
				: paths[0];
		},

		async fileSave( optionsForDialog = {} ) {
			if ( !dialog ) {
				return null;
			}
			const options = electronFileDialogOptions( optionsForDialog, 'save' );
			if ( typeof dialog.showSaveDialog === 'function' ) {
				await nextDialogTurn();
				electronGuiDebug( `fileSave opening ${options.defaultPath || ''}` );
				const result = await callNativeDialog(
					dialog.showSaveDialog.bind( dialog ),
					options,
				);
				electronGuiDebug( `fileSave result ${JSON.stringify( result )}` );
				return result && !result.canceled ? result.filePath || null : null;
			}
			if ( typeof dialog.showSaveDialogSync === 'function' ) {
				return callNativeDialog(
					dialog.showSaveDialogSync.bind( dialog ),
					options,
				) || null;
			}
			return null;
		},

		async directoryOpen( optionsForDialog = {} ) {
			if ( !dialog ) {
				return null;
			}
			const options = electronOpenDialogOptions( optionsForDialog, 'directory' );
			let paths = null;
			if ( typeof dialog.showOpenDialog === 'function' ) {
				await nextDialogTurn();
				electronGuiDebug( `directoryOpen opening ${options.defaultPath || ''}` );
				const result = await callNativeDialog(
					dialog.showOpenDialog.bind( dialog ),
					options,
				);
				electronGuiDebug( `directoryOpen result ${JSON.stringify( result )}` );
				paths = result && !result.canceled ? result.filePaths : null;
			}
			else if ( typeof dialog.showOpenDialogSync === 'function' ) {
				paths = callNativeDialog(
					dialog.showOpenDialogSync.bind( dialog ),
					options,
				);
			}
			return paths && paths.length > 0 ? paths[0] : null;
		},

		async directorySave( optionsForDialog = {} ) {
			if ( !dialog ) {
				return null;
			}
			const options = electronOpenDialogOptions(
				optionsForDialog,
				'directory_save'
			);
			let paths = null;
			if ( typeof dialog.showOpenDialog === 'function' ) {
				await nextDialogTurn();
				electronGuiDebug( `directorySave opening ${options.defaultPath || ''}` );
				const result = await callNativeDialog(
					dialog.showOpenDialog.bind( dialog ),
					options,
				);
				electronGuiDebug( `directorySave result ${JSON.stringify( result )}` );
				paths = result && !result.canceled ? result.filePaths : null;
			}
			else if ( typeof dialog.showOpenDialogSync === 'function' ) {
				paths = callNativeDialog(
					dialog.showOpenDialogSync.bind( dialog ),
					options,
				);
			}
			return paths && paths.length > 0 ? paths[0] : null;
		},

		shutdown() {
			if ( windowIsAlive( dialogOwnerWindow ) ) {
				dialogOwnerWindow.close();
			}
			dialogOwnerWindow = null;
		},
	};
}

function parseArgs( argv ) {
	const includePaths = [];
	const scriptArgs = [];
	let scriptPath = null;
	for ( let i = 0; i < argv.length; i++ ) {
		const arg = argv[i];
		if ( scriptPath == null && ( arg === '-h' || arg === '--help' ) ) {
			return {
				error: 'Usage: zuzu-js-electron [-I PATH] path/to/script.zzs',
			};
		}
		if ( scriptPath == null && arg === '-I' ) {
			i++;
			if ( i >= argv.length ) {
				return { error: '-I requires a path' };
			}
			includePaths.push( path.resolve( argv[i] ) );
			continue;
		}
		if ( scriptPath == null && arg.startsWith( '-I' ) && arg.length > 2 ) {
			includePaths.push( path.resolve( arg.slice( 2 ) ) );
			continue;
		}
		if ( scriptPath == null ) {
			scriptPath = path.resolve( arg );
			continue;
		}
		scriptArgs.push( arg );
	}
	if ( scriptPath == null ) {
		return {
			error: 'Usage: zuzu-js-electron [-I PATH] path/to/script.zzs',
		};
	}
	return {
		includePaths,
		scriptPath,
		scriptArgs,
	};
}

async function runElectronMain( argv, options = {} ) {
	installSafeDefineProperties();
	const electron = options.electron || loadElectron();
	const { app, BrowserWindow } = electron;
	let scriptRunning = true;
	app.on( 'window-all-closed', () => {
		if ( !scriptRunning ) {
			app.quit();
		}
	} );
	if ( typeof app.disableHardwareAcceleration === 'function' ) {
		app.disableHardwareAcceleration();
	}
	if (
		app.commandLine
		&& typeof app.commandLine.appendSwitch === 'function'
	) {
		app.commandLine.appendSwitch( 'disable-gpu' );
		app.commandLine.appendSwitch( 'disable-accelerated-video-decode' );
		app.commandLine.appendSwitch( 'disable-accelerated-video-encode' );
		app.commandLine.appendSwitch(
			'disable-features',
			'VaapiVideoDecoder,VaapiVideoEncoder'
		);
		app.commandLine.appendSwitch( 'log-level', '3' );
	}
	const parsed = parseArgs( argv );
	if ( parsed.error ) {
		process.stderr.write( `${parsed.error}\n` );
		return 2;
	}

	const repoRoot = options.repoRoot
		|| (
			app
			&& typeof app.getAppPath === 'function'
			&& app.getAppPath()
		)
		|| path.resolve( __dirname, '..', '..' );
	const source = fs.readFileSync( parsed.scriptPath, 'utf8' );
	const assetBasePaths = options.assetBasePaths || [
		process.cwd(),
		path.dirname( parsed.scriptPath ),
		repoRoot,
	];
	const guiBridge = options.guiBridge
		|| createElectronGuiBridge( electron, {
			...options,
			assetBasePaths,
		} );

	await app.whenReady();
	const runtime = createElectronRuntime( {
		repoRoot,
		guiBridge,
		includePaths: parsed.includePaths,
	} );
	const result = await Promise.resolve( runtime.runSource( source, {
		filename: parsed.scriptPath,
		scriptArgs: parsed.scriptArgs,
		onStdout: (chunk) => {
			process.stdout.write( chunk );
		},
		onStderr: (chunk) => {
			process.stderr.write( chunk );
		},
	} ) );
	if ( guiBridge && typeof guiBridge.shutdown === 'function' ) {
		guiBridge.shutdown();
	}
	scriptRunning = false;
	process.exitCode = result.status;
	if (
		result.status !== 0
		|| !BrowserWindow
		|| typeof BrowserWindow.getAllWindows !== 'function'
		|| BrowserWindow.getAllWindows().length === 0
	) {
		if ( result.status !== 0 && typeof app.exit === 'function' ) {
			app.exit( result.status );
		}
		else {
			app.quit();
		}
	}
	return result.status;
}

module.exports = {
	createElectronGuiBridge,
	installSafeDefineProperties,
	runElectronMain,
};
