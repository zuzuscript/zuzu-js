'use strict';

const assert = require( 'node:assert/strict' );
const fs = require( 'node:fs' );
const path = require( 'node:path' );
const vm = require( 'node:vm' );
const {
	createBrowserGuiRenderer,
} = require( '../lib/browser-gui-renderer' );

const rendererHtml = fs.readFileSync(
	path.join( __dirname, '..', 'lib', 'electron', 'renderer.html' ),
	'utf8',
);

class FakeClassList {
	constructor( element ) {
		this.element = element;
		this.items = [];
	}

	add( ...names ) {
		this.items.push( ...names );
		this.element.className = this.items.join( ' ' );
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
		this.value = '';
		this.placeholder = '';
		this.selectionStart = 0;
		this.selectionEnd = 0;
	}

	appendChild( child ) {
		child.parentNode = this;
		this.children.push( child );
		return child;
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

	replaceChild( next, old ) {
		const index = this.children.indexOf( old );
		assert.notEqual( index, -1 );
		old.parentNode = null;
		next.parentNode = this;
		this.children[index] = next;
		return old;
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
		for ( const handler of this.listeners[name] || [] ) {
			handler();
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
}

class FakeDocument {
	constructor() {
		this.activeElement = null;
		this.root = new FakeElement( 'div', this );
	}

	createElement( tagName ) {
		return new FakeElement( tagName, this );
	}

	getElementById( id ) {
		return id === 'app' ? this.root : null;
	}
}

function loadRenderer() {
	const document = new FakeDocument();
	const listeners = {};
	const sentEvents = [];
	const context = {
		console,
		document,
		window: {
			zuzuGui: {
				onRender( handler ) { listeners.render = handler; },
				onCreate( handler ) { listeners.create = handler; },
				onUpdate( handler ) { listeners.update = handler; },
				onDestroy( handler ) { listeners.destroy = handler; },
				sendEvent( payload ) { sentEvents.push( payload ); },
			},
		},
	};
	vm.createContext( context );
	vm.runInContext(
		fs.readFileSync(
			path.join( __dirname, '..', 'lib', 'gui', 'dom-renderer.js' ),
			'utf8',
		),
		context,
	);
	vm.runInContext(
		fs.readFileSync(
			path.join( __dirname, '..', 'lib', 'electron', 'renderer.js' ),
			'utf8',
		),
		context,
	);
	return { document, listeners, sentEvents };
}

function loadDomRenderer() {
	const document = new FakeDocument();
	const sentEvents = [];
	const context = {
		console,
		document,
		window: {},
	};
	vm.createContext( context );
	vm.runInContext(
		fs.readFileSync(
			path.join( __dirname, '..', 'lib', 'gui', 'dom-renderer.js' ),
			'utf8',
		),
		context,
	);
	const renderer = context.window.ZuzuGuiDomRenderer.createZuzuGuiDomRenderer( {
		root: document.root,
		sendEvent( payload ) { sentEvents.push( payload ); },
	} );
	return { document, renderer, sentEvents };
}

{
	assert.match( rendererHtml, /img-src[^"]*\bfile:/ );
	assert.match( rendererHtml, /src="\.\.\/gui\/dom-renderer\.js"/ );
	assert.match(
		rendererHtml,
		/\.zuzu-tabs details > :not\(summary\)\s*{\s*margin-left: 1em;/
	);
}

{
	const { document, renderer, sentEvents } = loadDomRenderer();
	renderer.render( {
		windowId: 6,
		snapshot: {
			guid: 'window-0',
			type: 'Window',
			id: null,
			classes: [],
			props: { visible: true, disabled: false },
			children: [
				{
					guid: 'button-0',
					type: 'Button',
					id: 'ok',
					classes: [],
					props: {
						text: 'OK',
						visible: true,
						disabled: false,
					},
					children: [],
				},
			],
		},
	} );
	const button = document.root.children[0].children[0];
	assert.equal( button.tagName, 'BUTTON' );
	button.dispatch( 'click' );
	assert.equal( sentEvents.length, 1 );
	assert.equal( sentEvents[0].windowId, 6 );
	assert.equal( sentEvents[0].type, 'click' );
	assert.equal( sentEvents[0].widgetGuid, 'button-0' );

	renderer.create( {
		parentGuid: 'window-0',
		snapshot: {
			guid: 'label-0',
			type: 'Label',
			id: 'status',
			classes: [],
			props: {
				text: 'Ready',
				visible: true,
				disabled: false,
			},
			children: [],
		},
	} );
	const label = document.root.children[0].children[1];
	assert.equal( label.textContent, 'Ready' );
	renderer.update( {
		snapshot: {
			guid: 'label-0',
			type: 'Label',
			id: 'status',
			classes: [],
			props: {
				text: 'Done',
				visible: true,
				disabled: false,
			},
			children: [],
		},
	} );
	assert.equal( label.textContent, 'Done' );
	renderer.destroy( { widgetGuid: 'label-0' } );
	assert.equal( document.root.children[0].children.length, 1 );
}

{
	const document = new FakeDocument();
	const renderer = createBrowserGuiRenderer( {
		document,
		root: document.root,
		sendEvent() {},
	} );
	renderer.render( {
		windowId: 61,
		snapshot: {
			guid: 'window-browser',
			type: 'Window',
			id: null,
			classes: [],
			props: { visible: true, disabled: false },
			children: [
				{
					guid: 'label-browser',
					type: 'Label',
					id: 'label',
					classes: [],
					props: {
						text: 'Browser',
						visible: true,
						disabled: false,
					},
					children: [],
				},
			],
		},
	} );
	assert.equal( document.root.children[0].children[0].textContent, 'Browser' );
}

{
	const { document, listeners, sentEvents } = loadRenderer();
	const inputSnapshot = {
		guid: 'input-1',
		type: 'Input',
		id: 'name',
		classes: [],
		props: {
			value: '',
			placeholder: '',
			visible: true,
			disabled: false,
		},
		children: [],
	};
	listeners.render( {
		windowId: 7,
		snapshot: {
			guid: 'window-1',
			type: 'Window',
			id: null,
			classes: [],
			props: { visible: true, disabled: false },
			children: [ inputSnapshot ],
		},
	} );

	const input = document.root.children[0].children[0];
	input.focus();
	input.value = 'A';
	input.setSelectionRange( 1, 1 );
	input.dispatch( 'input' );
	assert.equal( sentEvents.length, 1 );
	assert.equal( sentEvents[0].value, 'A' );

	listeners.update( {
		snapshot: {
			...inputSnapshot,
			props: {
				...inputSnapshot.props,
				value: 'A',
			},
		},
	} );

	assert.equal( document.root.children[0].children[0], input );
	assert.equal( document.activeElement, input );
	assert.equal( input.value, 'A' );
	assert.equal( input.selectionStart, 1 );
}

{
	const { document, listeners } = loadRenderer();
	listeners.render( {
		windowId: 8,
		snapshot: {
			guid: 'window-2',
			type: 'Window',
			id: null,
			classes: [],
			props: { visible: true, disabled: false },
			children: [
				{
					guid: 'rich-1',
					type: 'RichText',
					id: 'rich',
					classes: [],
					props: {
						value: '<b>Bold</b>',
						visible: true,
						disabled: false,
					},
					children: [],
				},
			],
		},
	} );

	const rich = document.root.children[0].children[0];
	assert.equal( rich.innerHTML, '<b>Bold</b>' );
	assert.notEqual( rich.textContent, '<b>Bold</b>' );
}

{
	const { document, listeners } = loadRenderer();
	listeners.render( {
		windowId: 9,
		snapshot: {
			guid: 'window-3',
			type: 'Window',
			id: null,
			classes: [],
			props: { visible: true, disabled: false },
			children: [
				{
					guid: 'date-1',
					type: 'DatePicker',
					id: 'date',
					classes: [],
					props: {
						value: '2026-04-26',
						min: '2020-01-01',
						max: '2030-12-31',
						visible: true,
						disabled: false,
					},
					children: [],
				},
			],
		},
	} );

	const date = document.root.children[0].children[0];
	assert.equal( date.type, 'text' );
	assert.equal( date.value, '2026-04-26' );
	assert.equal( date.placeholder, 'YYYY-MM-DD' );
	assert.equal( date.dataset.min, '2020-01-01' );
	assert.equal( date.dataset.max, '2030-12-31' );
}

console.log( 'electron renderer tests passed' );
