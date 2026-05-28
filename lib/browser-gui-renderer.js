'use strict';

const {
	createZuzuGuiDomRenderer,
} = require( './gui/dom-renderer' );

const DEFAULT_ROOT_ID = 'zuzu-browser-gui';
const STYLE_ID = 'zuzu-browser-gui-style';

function createBrowserGuiRenderer( options = {} ) {
	return createZuzuGuiDomRenderer( {
		document: options.document,
		root: options.root,
		rootId: options.rootId,
		renderMenus: options.renderMenus,
		sendEvent: options.sendEvent,
	} );
}

function browserDocument( options ) {
	if ( options.document ) {
		return options.document;
	}
	if ( typeof document !== 'undefined' ) {
		return document;
	}
	throw new Error( 'Zuzu browser GUI requires a DOM document' );
}

function resolveRoot( doc, options ) {
	if ( options.root ) {
		return options.root;
	}
	const rootId = options.rootId || DEFAULT_ROOT_ID;
	let root = doc.getElementById ? doc.getElementById( rootId ) : null;
	if ( root ) {
		return root;
	}
	root = doc.createElement( 'div' );
	root.id = rootId;
	root.className = 'zuzu-browser-gui-root';
	const parent = doc.body || doc.documentElement;
	if ( !parent ) {
		throw new Error( 'Zuzu browser GUI requires document.body' );
	}
	parent.appendChild( root );
	return root;
}

function installStyles( doc ) {
	if ( !doc.createElement || !doc.head ) {
		return;
	}
	if ( doc.getElementById && doc.getElementById( STYLE_ID ) ) {
		return;
	}
	const style = doc.createElement( 'style' );
	style.id = STYLE_ID;
	style.textContent = [
		'.zuzu-browser-gui-root{position:fixed;inset:0;pointer-events:none;',
		'z-index:2147480000;font:13px/1.4 system-ui,sans-serif;color:#202124;}',
		'.zuzu-browser-window{position:absolute;display:flex;flex-direction:column;',
		'min-width:220px;min-height:120px;background:#fff;border:1px solid #8c939f;',
		'box-shadow:0 12px 36px rgba(0,0,0,.22);pointer-events:auto;}',
		'.zuzu-browser-window-titlebar{display:flex;align-items:center;gap:8px;',
		'height:32px;padding:0 6px 0 10px;background:#e9edf3;border-bottom:1px solid #c8ced8;',
		'user-select:none;cursor:default;}',
		'.zuzu-browser-window-title{flex:1;overflow:hidden;text-overflow:ellipsis;',
		'white-space:nowrap;font-weight:600;}',
		'.zuzu-browser-window-close{width:24px;height:24px;border:0;background:transparent;',
		'font:16px/1 system-ui,sans-serif;cursor:pointer;}',
		'.zuzu-browser-window-close:hover{background:#d8dde6;}',
		'.zuzu-browser-window-content{flex:1;min-height:0;overflow:auto;padding:12px;}',
		'.zuzu-browser-window-content>main{display:flex;flex-direction:column;gap:8px;}',
		'.zuzu-browser-window nav{display:flex;gap:4px;padding:4px 8px;',
		'border-bottom:1px solid #d7dbe2;background:#f7f8fa;}',
		'.zuzu-browser-window .zuzu-menu-label{padding:4px 8px;font-weight:600;}',
		'.zuzu-browser-window nav button{border:1px solid transparent;background:transparent;',
		'padding:4px 8px;cursor:pointer;}',
		'.zuzu-browser-window nav button:hover{border-color:#c4c9d2;background:#fff;}',
	].join( '' );
	doc.head.appendChild( style );
}

function snapshotTitle( snapshot ) {
	const props = snapshot && snapshot.props ? snapshot.props : {};
	return String( props.title || 'Zuzu Window' );
}

function snapshotDimension( snapshot, name, fallback ) {
	const props = snapshot && snapshot.props ? snapshot.props : {};
	const value = Number( props[name] );
	return Number.isFinite( value ) && value > 0 ? value : fallback;
}

const WINDOW_FRAME_PROPS = new Set( [
	'height',
	'maxheight',
	'maxwidth',
	'minheight',
	'minwidth',
	'width',
] );

function contentSnapshot( snapshot ) {
	if ( !snapshot || snapshot.type !== 'Window' || !snapshot.props ) {
		return snapshot;
	}
	const props = { ...snapshot.props };
	for ( const key of WINDOW_FRAME_PROPS ) {
		delete props[key];
	}
	return {
		...snapshot,
		props,
	};
}

function optionValue( options, key, fallback = null ) {
	if ( options && typeof options.get === 'function' ) {
		return options.get( key, fallback );
	}
	if ( options && Object.prototype.hasOwnProperty.call( options, key ) ) {
		return options[key];
	}
	return fallback;
}

function optionString( options, key, fallback = '' ) {
	const value = optionValue( options, key, fallback );
	return value == null ? value : String( value );
}

function browserDialogHost( doc, options ) {
	if ( options.dialogs && typeof options.dialogs === 'object' ) {
		return options.dialogs;
	}
	if ( options.window && typeof options.window === 'object' ) {
		return options.window;
	}
	if ( doc.defaultView && typeof doc.defaultView === 'object' ) {
		return doc.defaultView;
	}
	if ( typeof window !== 'undefined' && window ) {
		return window;
	}
	if ( typeof globalThis !== 'undefined' && globalThis ) {
		return globalThis;
	}
	return {};
}

function removeNode( node ) {
	if ( node && node.parentNode ) {
		node.parentNode.removeChild( node );
	}
}

function createBrowserGuiBridge( options = {} ) {
	const doc = browserDocument( options );
	const root = resolveRoot( doc, options );
	installStyles( doc );

	let nextWindowId = 1;
	let nextZIndex = Number( options.baseZIndex || 100 );
	const windows = new Map();
	const dialogs = browserDialogHost( doc, options );

	function focusWindow( id ) {
		const win = windows.get( Number( id ) );
		if ( !win ) {
			return;
		}
		win.frame.style.zIndex = String( nextZIndex++ );
		if ( typeof win.frame.focus === 'function' ) {
			win.frame.focus();
		}
	}

	function closeNativeWindow( id, notifyClosed = true ) {
		const win = windows.get( Number( id ) );
		if ( !win ) {
			return;
		}
		windows.delete( Number( id ) );
		removeNode( win.frame );
		if ( notifyClosed && typeof win.options.onClosed === 'function' ) {
			win.options.onClosed();
		}
	}

	function requestClose( id ) {
		const win = windows.get( Number( id ) );
		if ( !win ) {
			return;
		}
		let cancelled = false;
		if ( typeof win.options.onCloseRequest === 'function' ) {
			cancelled = win.options.onCloseRequest() === true;
		}
		if ( cancelled ) {
			return;
		}
		closeNativeWindow( id );
	}

	function createFrame( id, snapshot ) {
		const width = snapshotDimension( snapshot, 'width', 480 );
		const height = snapshotDimension( snapshot, 'height', 320 );
		const title = snapshotTitle( snapshot );
		const frame = doc.createElement( 'div' );
		frame.className = 'zuzu-browser-window';
		frame.dataset.windowId = String( id );
		frame.setAttribute( 'role', 'dialog' );
		frame.setAttribute( 'aria-label', title );
		frame.tabIndex = -1;
		frame.style.width = `${width}px`;
		frame.style.height = `${height}px`;
		frame.style.left = `${24 + ( ( id - 1 ) % 8 ) * 28}px`;
		frame.style.top = `${24 + ( ( id - 1 ) % 8 ) * 24}px`;
		frame.addEventListener( 'mousedown', () => focusWindow( id ) );

		const titlebar = doc.createElement( 'div' );
		titlebar.className = 'zuzu-browser-window-titlebar';
		const titleText = doc.createElement( 'span' );
		titleText.className = 'zuzu-browser-window-title';
		titleText.textContent = title;
		const close = doc.createElement( 'button' );
		close.className = 'zuzu-browser-window-close';
		close.type = 'button';
		close.setAttribute( 'aria-label', `Close ${title}` );
		close.textContent = 'x';
		close.addEventListener( 'click', () => requestClose( id ) );
		titlebar.append( titleText, close );

		const content = doc.createElement( 'div' );
		content.className = 'zuzu-browser-window-content';
		frame.append( titlebar, content );

		return {
			frame,
			content,
			titleText,
		};
	}

	return {
		windows,
		openWindow( snapshot, bridgeOptions = {} ) {
			const id = nextWindowId++;
			const frameParts = createFrame( id, snapshot );
			const renderer = createBrowserGuiRenderer( {
				document: doc,
				root: frameParts.content,
				renderMenus: true,
				sendEvent( payload ) {
					if ( typeof bridgeOptions.onEvent === 'function' ) {
						bridgeOptions.onEvent( payload );
					}
				},
			} );
			windows.set( id, {
				id,
				snapshot,
				options: bridgeOptions,
				renderer,
				...frameParts,
			} );
			root.appendChild( frameParts.frame );
			renderer.render( {
				windowId: id,
				snapshot: contentSnapshot( snapshot ),
			} );
			focusWindow( id );
			return id;
		},
		closeWindow( id ) {
			closeNativeWindow( id );
		},
		createWidget( id, parentGuid, snapshot, index ) {
			const win = windows.get( Number( id ) );
			if ( win ) {
				win.renderer.create( {
					parentGuid,
					snapshot,
					index,
				} );
			}
		},
		updateWidget( id, snapshot ) {
			const win = windows.get( Number( id ) );
			if ( !win ) {
				return;
			}
			if ( snapshot && snapshot.type === 'Window' ) {
				win.snapshot = snapshot;
				const title = snapshotTitle( snapshot );
				win.titleText.textContent = title;
				win.frame.setAttribute( 'aria-label', title );
				win.frame.style.width = `${snapshotDimension( snapshot, 'width', 480 )}px`;
				win.frame.style.height = `${snapshotDimension( snapshot, 'height', 320 )}px`;
				return;
			}
			win.renderer.update( {
				snapshot,
			} );
		},
		destroyWidget( id, widgetGuid ) {
			const win = windows.get( Number( id ) );
			if ( win ) {
				win.renderer.destroy( {
					widgetGuid,
				} );
			}
		},
		alert( message, optionsForDialog = {} ) {
			if ( typeof dialogs.alert === 'function' ) {
				dialogs.alert( String( message ?? '' ) );
			}
			return true;
		},
		confirm( message, optionsForDialog = {} ) {
			if ( typeof dialogs.confirm === 'function' ) {
				return dialogs.confirm( String( message ?? '' ) ) ? true : false;
			}
			return optionValue( optionsForDialog, 'default', false ) ? true : false;
		},
		prompt( message, optionsForDialog = {} ) {
			const defaultValue = optionString(
				optionsForDialog,
				'value',
				optionString( optionsForDialog, 'default', '' )
			);
			if ( typeof dialogs.prompt === 'function' ) {
				return dialogs.prompt( String( message ?? '' ), defaultValue );
			}
			return defaultValue;
		},
		colourPicker( optionsForDialog = {} ) {
			const defaultValue = optionString(
				optionsForDialog,
				'value',
				'#000000'
			);
			if ( typeof dialogs.colourPicker === 'function' ) {
				return dialogs.colourPicker( defaultValue, optionsForDialog );
			}
			if ( typeof dialogs.colorPicker === 'function' ) {
				return dialogs.colorPicker( defaultValue, optionsForDialog );
			}
			if ( typeof dialogs.prompt === 'function' ) {
				const answer = dialogs.prompt(
					optionString( optionsForDialog, 'label', 'Colour:' ),
					defaultValue
				);
				return answer == null ? defaultValue : answer;
			}
			return defaultValue;
		},
		fileOpen() {
			throw new Error(
				'GUI_DIALOGUE_UNSUPPORTED: file dialogues are unsupported in JS/Browser'
			);
		},
		fileSave() {
			throw new Error(
				'GUI_DIALOGUE_UNSUPPORTED: file dialogues are unsupported in JS/Browser'
			);
		},
		directoryOpen() {
			throw new Error(
				'GUI_DIALOGUE_UNSUPPORTED: directory dialogues are unsupported in JS/Browser'
			);
		},
		directorySave() {
			throw new Error(
				'GUI_DIALOGUE_UNSUPPORTED: directory dialogues are unsupported in JS/Browser'
			);
		},
		focusWindow,
	};
}

module.exports = {
	createBrowserGuiBridge,
	createBrowserGuiRenderer,
};
