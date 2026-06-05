'use strict';

const assert = require( 'node:assert/strict' );
const fs = require( 'node:fs' );
const path = require( 'node:path' );
const projectPaths = require( '../lib/paths' );

const {
	ZuzuScript,
	createBrowserGuiBridge,
	createBrowserHost,
} = require( '../lib/zuzu' );

const repoRoot = projectPaths.projectRoot;
const jsModuleRoot = projectPaths.jsModuleRoot;
const pureModuleRoot = projectPaths.pureModuleRoot;

function loadJsModules( rels ) {
	const modules = {};
	for ( const rel of rels ) {
		const fullPath = path.join( jsModuleRoot, rel );
		modules[fullPath] = require( fullPath );
	}
	return modules;
}

function createFakeBrowserBridge() {
	let nextWindowId = 1;
	const windows = new Map();
	return {
		windows,
		openWindow( snapshot, options = {} ) {
			const id = nextWindowId++;
			windows.set( id, {
				snapshot,
				options,
			} );
			return id;
		},
		closeWindow( id ) {
			const win = windows.get( Number( id ) );
			windows.delete( Number( id ) );
			if ( win && typeof win.options.onClosed === 'function' ) {
				win.options.onClosed();
			}
		},
		createWidget() {},
		updateWidget() {},
		destroyWidget() {},
	};
}

class FakeClassList {
	constructor( element ) {
		this.element = element;
		this.items = new Set();
	}

	add( ...names ) {
		for ( const name of names ) {
			this.items.add( name );
		}
		this.element.className = Array.from( this.items ).join( ' ' );
	}

	remove( ...names ) {
		for ( const name of names ) {
			this.items.delete( name );
		}
		this.element.className = Array.from( this.items ).join( ' ' );
	}

	toggle( name, force ) {
		const shouldAdd = force === undefined ? !this.items.has( name ) : force;
		if ( shouldAdd ) {
			this.add( name );
			return true;
		}
		this.remove( name );
		return false;
	}
}

class FakeElement {
	constructor( tagName, ownerDocument ) {
		this.tagName = tagName.toUpperCase();
		this.ownerDocument = ownerDocument;
		this.children = [];
		this.parentNode = null;
		this.dataset = {};
		this.style = {};
		this.className = '';
		this.classList = new FakeClassList( this );
		this.attributes = {};
		this.listeners = {};
		this.hidden = false;
		this.disabled = false;
		this.id = '';
		this.type = '';
		this.textContent = '';
		this.innerHTML = '';
		this.value = '';
		this.checked = false;
		this.indeterminate = false;
		this.open = false;
		this.tabIndex = 0;
		this.selectionStart = 0;
		this.selectionEnd = 0;
	}

	appendChild( child ) {
		child.parentNode = this;
		this.children.push( child );
		return child;
	}

	append( ...children ) {
		for ( const child of children ) {
			this.appendChild( child );
		}
	}

	prepend( ...children ) {
		for ( let i = children.length - 1; i >= 0; i-- ) {
			const child = children[i];
			child.parentNode = this;
			this.children.unshift( child );
		}
	}

	insertBefore( child, before ) {
		const index = this.children.indexOf( before );
		child.parentNode = this;
		if ( index < 0 ) {
			this.children.push( child );
		}
		else {
			this.children.splice( index, 0, child );
		}
		return child;
	}

	replaceChildren( ...children ) {
		for ( const child of this.children ) {
			child.parentNode = null;
		}
		this.children = [];
		for ( const child of children ) {
			this.appendChild( child );
		}
	}

	replaceChild( next, old ) {
		const index = this.children.indexOf( old );
		assert.notEqual( index, -1 );
		old.parentNode = null;
		next.parentNode = this;
		this.children[index] = next;
		return old;
	}

	removeChild( child ) {
		this.children = this.children.filter( (item) => item !== child );
		child.parentNode = null;
		return child;
	}

	addEventListener( name, handler ) {
		if ( !this.listeners[name] ) {
			this.listeners[name] = [];
		}
		this.listeners[name].push( handler );
	}

	dispatch( name ) {
		const event = {
			preventDefault() {},
		};
		for ( const handler of this.listeners[name] || [] ) {
			handler( event );
		}
	}

	focus() {
		this.ownerDocument.activeElement = this;
	}

	setSelectionRange( start, end ) {
		this.selectionStart = start;
		this.selectionEnd = end;
	}

	setAttribute( name, value ) {
		this.attributes[name] = String( value );
	}

	removeAttribute( name ) {
		delete this.attributes[name];
		if ( name === 'id' ) {
			this.id = '';
		}
	}

	querySelector( selector ) {
		return this.querySelectorAll( selector )[0] || null;
	}

	querySelectorAll( selector ) {
		const normalized = String( selector || '' )
			.replace( /^:scope\s*>\s*/u, '' )
			.replace( /^:scope\s+/u, '' );
		return findElements(
			this,
			(node) => node !== this && matchesSelector( node, normalized )
		);
	}
}

class FakeDocument {
	constructor() {
		this.activeElement = null;
		this.documentElement = new FakeElement( 'html', this );
		this.head = new FakeElement( 'head', this );
		this.body = new FakeElement( 'body', this );
		this.documentElement.append( this.head, this.body );
	}

	createElement( tagName ) {
		return new FakeElement( tagName, this );
	}

	getElementById( id ) {
		return findElement(
			this.documentElement,
			(item) => item.id === id
		);
	}
}

function findElement( root, predicate ) {
	if ( predicate( root ) ) {
		return root;
	}
	for ( const child of root.children || [] ) {
		const found = findElement( child, predicate );
		if ( found ) {
			return found;
		}
	}
	return null;
}

function findElements( root, predicate, found = [] ) {
	if ( predicate( root ) ) {
		found.push( root );
	}
	for ( const child of root.children || [] ) {
		findElements( child, predicate, found );
	}
	return found;
}

function matchesSelector( node, selector ) {
	if ( selector === 'legend' ) {
		return node.tagName === 'LEGEND';
	}
	if ( selector === 'input' ) {
		return node.tagName === 'INPUT';
	}
	if ( selector === 'span' ) {
		return node.tagName === 'SPAN';
	}
	if ( selector === 'summary' ) {
		return node.tagName === 'SUMMARY';
	}
	if ( selector === 'li' ) {
		return node.tagName === 'LI';
	}
	if ( selector === 'input[type="radio"]' ) {
		return node.tagName === 'INPUT' && node.type === 'radio';
	}
	if ( selector === '[data-path]' ) {
		return Object.prototype.hasOwnProperty.call( node.dataset, 'path' );
	}
	return false;
}

function createBrowserRuntime( options = {} ) {
	const host = createBrowserHost( {
		repoRoot,
		includePaths: options.includePaths || [ pureModuleRoot ],
		...( Object.prototype.hasOwnProperty.call( options, 'guiBridge' )
			? { guiBridge: options.guiBridge }
			: {} ),
		document: options.document,
		guiRoot: options.guiRoot,
		guiDialogs: options.guiDialogs,
		jsModules: {
			...loadJsModules( [
				'std/gui/objects.js',
				'std/data/xml.js',
				'std/string.js',
				'std/string/base64.js',
				'std/time.js',
				'std/math.js',
				'std/tui.js',
				'std/internals.js',
			] ),
		},
		fetchModule( resolvedPath ) {
			if (
				fs.existsSync( resolvedPath )
				&& fs.statSync( resolvedPath ).isFile()
			) {
				return fs.readFileSync( resolvedPath, 'utf8' );
			}
			return null;
		},
	} );
	return new ZuzuScript( {
		host,
		denyCapabilities: options.denyCapabilities,
	} );
}

async function main() {
{
	const runtime = createBrowserRuntime();
	const result = runtime.runSource(
		[
			'from std/gui/objects import Window;',
			'say( __system__{deny_gui} );',
			'say( has_capability("gui") );',
			'say( typeof Window );',
		].join( ' ' ),
		{ filename: '/app/browser-gui.zzs' },
	);
	assert.equal( result.status, 0, result.stderr );
	assert.equal( result.stdout, 'false\n1\nClass\n' );
}

{
	const runtime = createBrowserRuntime();
	const result = runtime.runSource(
		[
			'from std/gui import Window;',
			'say( __system__{deny_gui} );',
			'say( typeof Window );',
		].join( ' ' ),
		{ filename: '/app/browser-std-gui.zzs' },
	);
	assert.equal( result.status, 0, result.stderr );
	assert.equal( result.stdout, 'false\nFunction\n' );
}

{
	const document = new FakeDocument();
	const root = document.createElement( 'div' );
	document.body.appendChild( root );
	const calls = [];
	const runtime = createBrowserRuntime( {
		document,
		guiRoot: root,
		guiDialogs: {
			alert( message ) {
				calls.push( [ 'alert', message ] );
			},
			confirm( message ) {
				calls.push( [ 'confirm', message ] );
				return false;
			},
			prompt( message, value ) {
				calls.push( [ 'prompt', message, value ] );
				return message === 'Colour:' ? 'red' : 'Grace';
			},
		},
	} );
	const result = runtime.runSource(
		[
			'from test/more import *;',
			'from std/gui/objects import meta;',
			'from std/gui/dialogue import *;',
			'is( meta{backend}, "browser-dom", "browser dialogue backend metadata" );',
			'is( alert( "Saved", title: "Done" ), null, "browser alert returns null" );',
			'is( confirm( "Continue?", title: "Question" ), false, "browser confirm returns bool" );',
			'is( prompt( "Name:", value: "Ada" ), "Grace", "browser prompt returns string" );',
			'is( colour_picker( value: "#000000" ), "#ff0000", "browser colour picker normalizes native result" );',
			'let file_open_error := exception( function () { file_open( auto_result: "ignored" ); } );',
			'ok( file_open_error instanceof Exception, "browser file_open throws" );',
			'ok( file_open_error{message} ~ /GUI_DIALOGUE_/, "browser file_open error includes code" );',
			'let file_save_error := exception( function () { file_save( auto_result: "ignored" ); } );',
			'ok( file_save_error instanceof Exception, "browser file_save throws" );',
			'ok( file_save_error{message} ~ /GUI_DIALOGUE_/, "browser file_save error includes code" );',
			'let directory_open_error := exception( function () { directory_open( auto_result: "ignored" ); } );',
			'ok( directory_open_error instanceof Exception, "browser directory_open throws" );',
			'ok( directory_open_error{message} ~ /GUI_DIALOGUE_/, "browser directory_open error includes code" );',
			'let directory_save_error := exception( function () { directory_save( auto_result: "ignored" ); } );',
			'ok( directory_save_error instanceof Exception, "browser directory_save throws" );',
			'ok( directory_save_error{message} ~ /GUI_DIALOGUE_/, "browser directory_save error includes code" );',
			'done_testing();',
		].join( '\n' ),
		{ filename: '/app/browser-dialogues.zzs' },
	);
	assert.equal( result.status, 0, result.stderr );
	assert.match( result.stdout, /^1\.\.[1-9][0-9]*$/m );
	assert.deepEqual(
		calls,
		[
			[ 'alert', 'Saved' ],
			[ 'confirm', 'Continue?' ],
			[ 'prompt', 'Name:', 'Ada' ],
			[ 'prompt', 'Colour:', '#000000' ],
		],
	);
}

{
	for ( const phase of [ 2, 3 ] ) {
		const runtime = createBrowserRuntime();
		const filename = path.join(
			repoRoot,
			`stdlib/tests/std/gui/_phase${phase}.zzs`,
		);
		const result = runtime.runSource(
			fs.readFileSync( filename, 'utf8' ),
			{ filename },
		);
		assert.equal( result.status, 0, result.stderr );
		assert.match( result.stdout, /^1\.\.[1-9][0-9]*$/m );
	}
}

{
	const runtime = createBrowserRuntime();
	const result = runtime.runSource(
		[
			'from test/more import *;',
			'requires_capability( "gui" );',
			'from std/eval import eval;',
			'from std/gui import *;',
			'let xml := "<Window xmlns=\\"https://zuzulang.org/ns/std/gui\\""',
			' _ " title=\\"Browser XML\\">"',
			' _ "<Menu id=\\"file-menu\\" text=\\"File\\">"',
			' _ "<MenuItem id=\\"save-item\\" text=\\"Save\\" disabled=\\"true\\" />"',
			' _ "</Menu>"',
			' _ "<VBox id=\\"root\\" gap=\\"6\\" padding=\\"2\\">"',
			' _ "<Input id=\\"name\\" value=\\"Ada\\" required=\\"yes\\""',
			' _ " meta.model=\\"person.name\\" />"',
			' _ "<Slider id=\\"volume\\" value=\\"25\\" min=\\"0\\" max=\\"100\\""',
			' _ " step=\\"5\\" />"',
			' _ "<Progress id=\\"progress\\" value=\\"30\\" max=\\"200\\""',
			' _ " show_text=\\"on\\" />"',
			' _ "<DatePicker id=\\"date\\" value=\\"2026-04-26\\""',
			' _ " min=\\"2020-01-01\\" max=\\"2030-12-31\\""',
			' _ " first_day_of_week=\\"1\\" />"',
			' _ "<Tabs id=\\"tabs\\" selected=\\"details\\">"',
			' _ "<Tab id=\\"summary\\" title=\\"Summary\\" value=\\"summary\\" />"',
			' _ "<Tab id=\\"details\\" title=\\"Details\\" value=\\"details\\""',
			' _ " icon=\\"details.png\\" closable=\\"true\\" />"',
			' _ "</Tabs>"',
			' _ "<TreeView id=\\"tree\\" multiple=\\"true\\" selected_path=\\"0,1\\" />"',
			' _ "</VBox>"',
			' _ "</Window>";',
			'let ui := gui_from_xml(xml);',
			'is( ui.title(), "Browser XML", "gui_from_xml builds Window" );',
			'is( ui.menus().length(), 1, "XML Window preserves Menu child" );',
			'is( ui.find_by_id("save-item").disabled(), true, "XML MenuItem disabled coerces bool" );',
			'is( ui.find_by_id("root").gap(), 6, "XML layout number coerces" );',
			'is( ui.find_by_id("name").required(), true, "XML bool yes coerces" );',
			'is( ui.find_by_id("name").meta("model"), "person.name", "XML meta maps to widget meta" );',
			'is( ui.find_by_id("volume").step(), 5, "XML Slider step coerces" );',
			'is( ui.find_by_id("progress").show_text(), true, "XML Progress bool coerces" );',
			'is( ui.find_by_id("date").first_day_of_week(), 1, "XML DatePicker number coerces" );',
			'is( ui.find_by_id("tabs").selected(), "details", "XML Tabs selected parsed" );',
			'is( ui.find_by_id("details").closable(), true, "XML Tab bool parsed" );',
			'is( ui.find_by_id("tree").selected_path()[1], 1, "XML TreeView path coerces" );',
			'let out := gui_to_xml(ui);',
			'ok( out ~ /xmlns=\\"https:\\/\\/zuzulang\\.org\\/ns\\/std\\/gui\\"/, "gui_to_xml writes namespace" );',
			'ok( out ~ /meta\\.model=\\"person\\.name\\"/, "gui_to_xml writes meta attrs" );',
			'ok( out ~ /selected_path=\\"0,1\\"/, "gui_to_xml writes selected paths" );',
			'let denied := exception( function () {',
			' gui_from_xml_file("missing.xml");',
			'} );',
			'ok( denied instanceof Exception, "gui_from_xml_file denied fs throws" );',
			'ok( denied{message} ~ /XML\\.load is denied by runtime policy/, "denied fs error is deterministic" );',
			'done_testing();',
		].join( '\n' ),
		{ filename: '/app/browser-gui-xml.zzs' },
	);
	assert.equal( result.status, 0, result.stderr );
	assert.match( result.stdout, /^1\.\.[1-9][0-9]*$/m );
}

{
	const runtime = createBrowserRuntime( {
		denyCapabilities: [ 'gui' ],
	} );
	const result = runtime.runSource(
		[
			'say( __system__{deny_gui} );',
			'from std/gui/objects import Widget;',
		].join( ' ' ),
		{ filename: '/app/browser-gui-denied.zzs' },
	);
	assert.notEqual( result.status, 0 );
	assert.match( result.stdout, /^true\n/u );
	assert.match( result.stderr, /Denied capability 'gui'/u );
}

{
	const bridge = createFakeBrowserBridge();
	const runtime = createBrowserRuntime( {
		guiBridge: bridge,
	} );
	const { Window } = runtime.loadModule( 'std/gui/objects', '/app/main.zzs' );
	const w = new Window( {
		title: 'Browser async',
	} );
	const resultPromise = w.call( {
		async: true,
	} );
	assert.equal( bridge.windows.size, 1 );
	assert.ok( resultPromise && typeof resultPromise.then === 'function' );
	w.close( 'done' );
	assert.equal( await resultPromise, 'done' );
}

{
	const bridge = createFakeBrowserBridge();
	const runtime = createBrowserRuntime( {
		guiBridge: bridge,
	} );
	const { Window } = runtime.loadModule( 'std/gui/objects', '/app/main.zzs' );
	const isSyncUnsupported = (err) => /GUI_CALL_SYNC_UNSUPPORTED/u.test(
		String( err && ( err.message || err ) )
	);
	assert.throws(
		() => new Window( { title: 'Sync' } ).call(),
		isSyncUnsupported,
	);
	assert.throws(
		() => new Window( { title: 'Sync' } ).call( { async: false } ),
		isSyncUnsupported,
	);
	assert.equal( bridge.windows.size, 0 );
}

{
	const runtime = createBrowserRuntime();
	const { Window } = runtime.loadModule( 'std/gui/objects', '/app/main.zzs' );
	const w = new Window( { title: 'Already closed' } );
	w.close( 'closed' );
	assert.equal( w.call(), 'closed' );
	assert.equal( await w.call( { async: true } ), 'closed' );
}

{
	const document = new FakeDocument();
	const root = document.createElement( 'div' );
	document.body.appendChild( root );
	const bridge = createBrowserGuiBridge( {
		document,
		root,
	} );
	const runtime = createBrowserRuntime( {
		guiBridge: bridge,
	} );
	const {
		Button,
		Checkbox,
		DatePicker,
		Frame,
		HBox,
		Image,
		Input,
		Label,
		ListView,
		Progress,
		Radio,
		RadioGroup,
		RichText,
		Select,
		Separator,
		Slider,
		Tab,
		Tabs,
		Text,
		TreeView,
		VBox,
		Window,
	} = runtime.loadModule( 'std/gui/objects', '/app/main.zzs' );

	const checkbox = new Checkbox( {
		label: 'Active',
		checked: true,
	} );
	const select = new Select( {
		value: 'one',
		options: [
			{ label: 'One', value: 'one' },
			{ label: 'Two', value: 'two' },
		],
	} );
	const slider = new Slider( {
		value: 25,
		min: 0,
		max: 100,
		step: 5,
	} );
	const tabs = new Tabs( {
		selected: 'details',
		children: [
			new Tab( {
				title: 'Summary',
				value: 'summary',
			} ),
			new Tab( {
				title: 'Details',
				value: 'details',
			} ),
		],
	} );
	const list = new ListView( {
		items: [
			{ label: 'Alpha', value: 'a' },
			{ label: 'Beta', value: 'b' },
		],
		selected_index: 0,
	} );
	const tree = new TreeView( {
		items: [
			{
				label: 'Root',
				value: 'root',
				children: [
					{ label: 'Child', value: 'child' },
				],
			},
		],
		selected_path: [ 0, 0 ],
	} );
	const w = new Window( {
		title: 'Controls',
		children: [
			new VBox( {
				children: [
					new Frame( {
						label: 'Profile',
						children: [
							new Text( { value: 'plain' } ),
							new RichText( { value: '<b>rich</b>' } ),
							new Image( {
								src: 'logo.png',
								alt: 'Logo',
								fit: 'contain',
							} ),
						],
					} ),
					new HBox( {
						children: [
							new Label( { text: 'Name' } ),
							new Input( { value: 'Ada' } ),
						],
					} ),
					checkbox,
					new RadioGroup( {
						value: 'b',
						children: [
							new Radio( { label: 'A', value: 'a' } ),
							new Radio( { label: 'B', value: 'b' } ),
						],
					} ),
					select,
					new Button( { text: 'Go' } ),
					new Separator( {} ),
					slider,
					new Progress( {
						value: 30,
						max: 200,
						show_text: true,
					} ),
					new DatePicker( {
						value: '2026-04-26',
						min: '2020-01-01',
						max: '2030-12-31',
					} ),
					tabs,
					list,
					tree,
				],
			} ),
		],
	} );

	const events = [];
	checkbox.change( () => events.push( 'checkbox' ) );
	select.change( (event) => events.push( `select:${event.value()}` ) );
	slider.change( (event) => events.push( `slider:${event.value()}` ) );
	tabs.select( (event) => events.push( `tabs:${event.data().selected}` ) );
	list.select( (event) => events.push( `list:${event.data().selected_index}` ) );
	list.activate( (event) => events.push( `list-activate:${event.data().selected_index}` ) );
	tree.select( (event) => events.push( `tree:${event.data().selected_path.join( '.' )}` ) );
	tree.activate( (event) => events.push( `tree-activate:${event.data().selected_path.join( '.' )}` ) );
	tree.expand( (event) => events.push( `tree-expand:${event.data().selected_path.join( '.' )}` ) );
	tree.collapse( (event) => events.push( `tree-collapse:${event.data().selected_path.join( '.' )}` ) );

	w.show();
	const win = Array.from( bridge.windows.values() )[0];
	assert.ok( findElement( win.frame, (node) => node.tagName === 'FIELDSET' ) );
	assert.ok( findElement( win.frame, (node) => node.textContent === 'Profile' ) );
	assert.equal(
		findElement( win.frame, (node) => node.tagName === 'IMG' ).alt,
		'Logo',
	);
	assert.equal(
		findElement( win.frame, (node) => node.tagName === 'IMG' ).style.objectFit,
		'contain',
	);
	assert.equal(
		findElement( win.frame, (node) => node.innerHTML === '<b>rich</b>' ).innerHTML,
		'<b>rich</b>',
	);
	const checkboxInput = findElement(
		win.frame,
		(node) => node.tagName === 'INPUT' && node.type === 'checkbox'
	);
	assert.equal( checkboxInput.checked, true );
	checkboxInput.checked = false;
	checkboxInput.dispatch( 'change' );
	assert.equal( checkbox.checked(), false );
	assert.ok( events.includes( 'checkbox' ) );

	const selectNode = findElement( win.frame, (node) => node.tagName === 'SELECT' );
	assert.equal( selectNode.children.length, 2 );
	selectNode.value = 'two';
	selectNode.dispatch( 'change' );
	assert.equal( select.value(), 'two' );
	assert.ok( events.includes( 'select:two' ) );

	const sliderNode = findElement(
		win.frame,
		(node) => node.tagName === 'INPUT' && node.type === 'range'
	);
	sliderNode.value = '55';
	sliderNode.dispatch( 'change' );
	assert.equal( slider.value(), 55 );
	assert.ok( events.includes( 'slider:55' ) );

	const progressNode = findElement( win.frame, (node) => node.tagName === 'PROGRESS' );
	assert.equal( progressNode.value, 30 );
	assert.equal( progressNode.max, 200 );
	const dateNode = findElement(
		win.frame,
		(node) => node.tagName === 'INPUT' && node.placeholder === 'YYYY-MM-DD'
	);
	assert.equal( dateNode.value, '2026-04-26' );
	assert.equal( dateNode.dataset.min, '2020-01-01' );

	findElement( win.frame, (node) => node.tagName === 'SUMMARY' && node.textContent === 'Summary' )
		.dispatch( 'click' );
	assert.equal( tabs.selected(), 'summary' );
	assert.ok( events.includes( 'tabs:summary' ) );

	const rows = findElements( win.frame, (node) => node.tagName === 'LI' );
	rows[1].dispatch( 'click' );
	assert.equal( list.selected_index(), 1 );
	assert.ok( events.includes( 'list:1' ) );
	rows[1].dispatch( 'dblclick' );
	assert.ok( events.includes( 'list-activate:1' ) );

	const rootSummary = findElement(
		win.frame,
		(node) => node.tagName === 'SUMMARY' && node.textContent === 'Root'
	);
	rootSummary.dispatch( 'click' );
	assert.equal( tree.selected_path()[0], 0 );
	assert.ok( events.includes( 'tree:0' ) );
	const childButton = findElement(
		win.frame,
		(node) => node.tagName === 'BUTTON' && node.textContent === 'Child'
	);
	childButton.dispatch( 'dblclick' );
	assert.ok( events.includes( 'tree-activate:0.0' ) );
	const treeDetails = findElement(
		win.frame,
		(node) => node.tagName === 'DETAILS' && node.children.some(
			(child) => child.textContent === 'Root'
		)
	);
	treeDetails.open = false;
	treeDetails.dispatch( 'toggle' );
	treeDetails.open = true;
	treeDetails.dispatch( 'toggle' );
	assert.ok( events.includes( 'tree-collapse:0' ) );
	assert.ok( events.includes( 'tree-expand:0' ) );
}

{
	assert.equal( typeof createBrowserGuiBridge, 'function' );
	const document = new FakeDocument();
	const root = document.createElement( 'div' );
	document.body.appendChild( root );
	const bridge = createBrowserGuiBridge( {
		document,
		root,
	} );
	const runtime = createBrowserRuntime( {
		guiBridge: bridge,
	} );
	const {
		Button,
		Input,
		Menu,
		MenuItem,
		Window,
	} = runtime.loadModule( 'std/gui/objects', '/app/main.zzs' );
	const menuItem = new MenuItem( { text: 'About' } );
	const menu = new Menu( {
		text: 'Help',
		children: [ menuItem ],
	} );
	const button = new Button( { text: 'Press' } );
	const input = new Input( { value: '' } );
	const w = new Window( {
		title: 'Browser window',
		width: 360,
		height: 220,
		children: [ menu, button, input ],
	} );
	let openCount = 0;
	let closeCount = 0;
	let clickCount = 0;
	let inputValue = null;
	w.open( () => {
		openCount++;
	} );
	w.closed( () => {
		closeCount++;
	} );
	button.click( () => {
		clickCount++;
	} );
	input.input( (event) => {
		inputValue = event.value();
	} );

	w.show();
	assert.equal( openCount, 1 );
	assert.equal( bridge.windows.size, 1 );
	const win = Array.from( bridge.windows.values() )[0];
	assert.equal( win.frame.attributes.role, 'dialog' );
	assert.equal( win.frame.attributes['aria-label'], 'Browser window' );
	assert.equal( win.frame.style.width, '360px' );
	assert.equal( win.frame.style.height, '220px' );
	const mainNode = findElement( win.frame, (node) => node.tagName === 'MAIN' );
	assert.equal( mainNode.style.width || '', '' );
	assert.equal( mainNode.style.height || '', '' );
	assert.ok( findElement( win.frame, (node) => node.tagName === 'NAV' ) );
	assert.ok( findElement( win.frame, (node) => node.textContent === 'Help' ) );
	assert.ok( findElement( win.frame, (node) => node.textContent === 'About' ) );

	findElement( win.frame, (node) => node.textContent === 'Press' ).dispatch( 'click' );
	assert.equal( clickCount, 1 );
	const inputNode = findElement( win.frame, (node) => node.tagName === 'INPUT' );
	inputNode.value = 'typed';
	inputNode.dispatch( 'input' );
	assert.equal( inputValue, 'typed' );
	assert.equal( input.value(), 'typed' );

	button.text( 'Updated' );
	assert.ok( findElement( win.frame, (node) => node.textContent === 'Updated' ) );
	const extra = new Button( { text: 'Extra' } );
	w.add_child( extra );
	assert.ok( findElement( win.frame, (node) => node.textContent === 'Extra' ) );
	w.remove_child( extra );
	assert.equal( findElement( win.frame, (node) => node.textContent === 'Extra' ), null );

	const closeButton = findElement(
		win.frame,
		(node) => String( node.className ).includes( 'zuzu-browser-window-close' )
	);
	closeButton.dispatch( 'click' );
	assert.equal( bridge.windows.size, 0 );
	assert.equal( closeCount, 1 );
}

{
	const document = new FakeDocument();
	const root = document.createElement( 'div' );
	document.body.appendChild( root );
	const runtime = createBrowserRuntime( {
		document,
		guiRoot: root,
	} );
	const { Window } = runtime.loadModule( 'std/gui/objects', '/app/main.zzs' );
	const first = new Window( { title: 'First' } );
	const second = new Window( { title: 'Second' } );
	first.show();
	second.show();
	const bridge = runtime.host.gui;
	assert.equal( bridge.windows.size, 2 );
	const firstFrame = root.children[0];
	const secondFrame = root.children[1];
	assert.ok( Number( secondFrame.style.zIndex ) > Number( firstFrame.style.zIndex ) );
	firstFrame.dispatch( 'mousedown' );
	assert.ok( Number( firstFrame.style.zIndex ) > Number( secondFrame.style.zIndex ) );
}

{
	const document = new FakeDocument();
	const root = document.createElement( 'div' );
	document.body.appendChild( root );
	const bridge = createBrowserGuiBridge( {
		document,
		root,
	} );
	const runtime = createBrowserRuntime( {
		guiBridge: bridge,
	} );
	const { Window } = runtime.loadModule( 'std/gui/objects', '/app/main.zzs' );
	const w = new Window( { title: 'Async browser call' } );
	const resultPromise = w.call( { async: true } );
	const win = Array.from( bridge.windows.values() )[0];
	const closeButton = findElement(
		win.frame,
		(node) => String( node.className ).includes( 'zuzu-browser-window-close' )
	);
	closeButton.dispatch( 'click' );
	assert.equal( await resultPromise, null );
}

console.log( 'browser GUI tests passed' );
}

main().catch( (err) => {
	console.error( err );
	process.exitCode = 1;
} );
