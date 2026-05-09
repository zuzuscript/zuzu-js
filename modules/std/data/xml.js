'use strict';

let nextId = 1;
const nodeIds = new WeakMap();
const wrappers = new WeakMap();

function withSafeObjectPrototype( fn ) {
	const hidden = [];
	for ( const name of [ 'get', 'set' ] ) {
		const desc = Object.prototype.hasOwnProperty.call( Object.prototype, name )
			? Object.getOwnPropertyDescriptor( Object.prototype, name )
			: null;
		if ( desc && desc.configurable ) {
			hidden.push( [ name, desc ] );
			delete Object.prototype[name];
		}
	}
	try {
		return fn();
	}
	finally {
		for ( const [ name, desc ] of hidden ) {
			Object.defineProperty( Object.prototype, name, desc );
		}
	}
}

function domClasses() {
	if (
		typeof DOMParser !== 'undefined'
		&& typeof XMLSerializer !== 'undefined'
	) {
		return { DOMParser, XMLSerializer };
	}
	return withSafeObjectPrototype( () => require( '@xmldom/xmldom' ) );
}

function xpathEngine() {
	if ( typeof document !== 'undefined' && document.evaluate ) {
		return null;
	}
	return withSafeObjectPrototype( () => require( 'xpath' ) );
}

function isPath( value ) {
	return value
		&& value.constructor
		&& value.constructor.name === 'Path'
		&& typeof value.slurp_utf8 === 'function'
		&& typeof value.spew_utf8 === 'function';
}

function nodeKey( node ) {
	if ( !nodeIds.has( node ) ) {
		nodeIds.set( node, nextId++ );
	}
	return String( nodeIds.get( node ) );
}

function wrap( node ) {
	if ( !node ) {
		return null;
	}
	if ( wrappers.has( node ) ) {
		return wrappers.get( node );
	}
	let wrapped;
	if ( node.nodeType === 9 ) {
		wrapped = new XMLDocument( node );
	}
	else if ( node.nodeType === 1 ) {
		wrapped = new XMLElement( node );
	}
	else if ( node.nodeType === 2 ) {
		wrapped = new DOMAttr( node );
	}
	else if ( node.nodeType === 3 || node.nodeType === 4 ) {
		wrapped = new DOMText( node );
	}
	else if ( node.nodeType === 8 ) {
		wrapped = new DOMComment( node );
	}
	else {
		wrapped = new XMLNode( node );
	}
	wrappers.set( node, wrapped );
	return wrapped;
}

function unwrap( value ) {
	return value instanceof XMLNode ? value._node : null;
}

function nodeArray( list ) {
	return Array.from( list || [] ).map( wrap ).filter( Boolean );
}

function elementChildren( node ) {
	return Array.from( node.childNodes || [] ).filter( (child) => child.nodeType === 1 );
}

function descendants( node, includeSelf = false ) {
	const out = [];
	const visit = (current) => {
		out.push( current );
		for ( const child of Array.from( current.childNodes || [] ) ) {
			visit( child );
		}
	};
	if ( includeSelf ) {
		visit( node );
	}
	else {
		for ( const child of Array.from( node.childNodes || [] ) ) {
			visit( child );
		}
	}
	return out;
}

function simpleSelectorAll( node, selector ) {
	const text = String( selector || '' ).trim();
	if ( text === '' ) {
		return [];
	}
	if ( typeof node.querySelectorAll === 'function' ) {
		try {
			return nodeArray( node.querySelectorAll( text ) );
		}
		catch ( _err ) {
			// Fall through to the small compatibility subset below.
		}
	}
	if ( text.startsWith( '.' ) ) {
		const klass = text.slice( 1 );
		return descendants( node, false )
			.filter( (child) => child.nodeType === 1 )
			.filter( (child) => {
				const className = child.getAttribute( 'class' );
				return className && className.split( /\s+/u ).includes( klass );
			} )
			.map( wrap );
	}
	if ( typeof node.getElementsByTagName === 'function' ) {
		return nodeArray( node.getElementsByTagName( text ) );
	}
	return descendants( node, false )
		.filter( (child) => child.nodeType === 1 && child.nodeName === text )
		.map( wrap );
}

function evaluateBrowserXPath( node, expr, type ) {
	if ( typeof XPathResult === 'undefined' ) {
		return null;
	}
	const doc = node.nodeType === 9 ? node : node.ownerDocument;
	if ( !doc || typeof doc.evaluate !== 'function' ) {
		return null;
	}
	return doc.evaluate( expr, node, null, type, null );
}

function findNodes( node, expr ) {
	const text = String( expr || '' ).trim();
	if ( text === '' ) {
		return [];
	}
	const snapshotType = typeof XPathResult !== 'undefined'
		? XPathResult.ORDERED_NODE_SNAPSHOT_TYPE
		: 0;
	const browserResult = evaluateBrowserXPath( node, text, snapshotType );
	if ( browserResult ) {
		const out = [];
		for ( let i = 0; i < browserResult.snapshotLength; i++ ) {
			out.push( wrap( browserResult.snapshotItem( i ) ) );
		}
		return out;
	}
	const xpath = xpathEngine();
	const result = xpath.select( text, node );
	return Array.isArray( result ) ? nodeArray( result ) : [];
}

function findValue( node, expr ) {
	const text = String( expr || '' ).trim();
	if ( text === '' ) {
		return '';
	}
	const anyType = typeof XPathResult !== 'undefined' ? XPathResult.ANY_TYPE : 0;
	const browserResult = evaluateBrowserXPath( node, text, anyType );
	if ( browserResult ) {
		switch ( browserResult.resultType ) {
			case XPathResult.NUMBER_TYPE:
				return String( browserResult.numberValue );
			case XPathResult.STRING_TYPE:
				return browserResult.stringValue;
			case XPathResult.BOOLEAN_TYPE:
				return browserResult.booleanValue ? 'true' : 'false';
			default: {
				const found = browserResult.iterateNext();
				return found ? nodeStringValue( found ) : '';
			}
		}
	}
	const xpath = xpathEngine();
	const result = xpath.select1( text, node );
	if ( result == null ) {
		return '';
	}
	if ( typeof result === 'number' || typeof result === 'boolean' ) {
		return String( result );
	}
	if ( typeof result === 'string' ) {
		return result;
	}
	return nodeStringValue( result );
}

function nodeStringValue( node ) {
	if ( node.nodeType === 2 ) {
		return node.value || node.nodeValue || '';
	}
	return node.textContent || node.nodeValue || '';
}

function serialize( node ) {
	const { XMLSerializer } = domClasses();
	return new XMLSerializer().serializeToString( node );
}

function parseXml( text ) {
	const { DOMParser } = domClasses();
	const parser = new DOMParser();
	const doc = parser.parseFromString( String( text ?? '' ), 'application/xml' );
	const parserError = doc.getElementsByTagName
		? doc.getElementsByTagName( 'parsererror' )[0]
		: null;
	if ( parserError ) {
		throw new Error(
			`Exception: XML.parse failed: ${nodeStringValue( parserError )}`
		);
	}
	return wrap( doc );
}

class XMLNode {
	constructor( node ) {
		this._node = node;
	}

	nodeType() { return String( this._node.nodeType ); }
	nodeName() { return this._node.nodeName || ''; }
	nodeValue() { return this._node.nodeValue; }
	setNodeValue( value ) { this._node.nodeValue = String( value ?? '' ); return this; }
	data() { return this._node.data ?? this.nodeValue(); }
	setData( value ) { this._node.data = String( value ?? '' ); return this; }
	nodeKind() {
		switch ( this._node.nodeType ) {
			case 1: return 'element';
			case 2: return 'attr';
			case 3:
			case 4: return 'text';
			case 8: return 'comment';
			case 9: return 'document';
			default: return 'node';
		}
	}
	localName() { return this._node.localName || null; }
	namespaceURI() { return this._node.namespaceURI || null; }
	parentNode() { return wrap( this._node.parentNode || this._node.ownerElement || null ); }
	ownerDocument() {
		return wrap( this._node.nodeType === 9 ? this._node : this._node.ownerDocument );
	}
	childNodes() { return nodeArray( this._node.childNodes ); }
	children() { return elementChildren( this._node ).map( wrap ); }
	hasChildNodes() {
		return this._node.hasChildNodes && this._node.hasChildNodes() ? 1 : 0;
	}
	firstChild() { return wrap( this._node.firstChild ); }
	lastChild() { return wrap( this._node.lastChild ); }
	nextSibling() { return wrap( this._node.nextSibling ); }
	previousSibling() { return wrap( this._node.previousSibling ); }
	textContent() { return this._node.textContent || ''; }
	setTextContent( value ) { this._node.textContent = String( value ?? '' ); return this; }
	appendChild( node ) { return wrap( this._node.appendChild( unwrap( node ) ) ); }
	prependChild( node ) {
		const raw = unwrap( node );
		if ( this._node.firstChild ) {
			this._node.insertBefore( raw, this._node.firstChild );
		}
		else {
			this._node.appendChild( raw );
		}
		return node;
	}
	insertBefore( newNode, refNode ) {
		this._node.insertBefore( unwrap( newNode ), unwrap( refNode ) );
		return newNode;
	}
	replaceChild( newNode, oldNode ) {
		return wrap( this._node.replaceChild( unwrap( newNode ), unwrap( oldNode ) ) );
	}
	removeChild( childNode ) {
		return wrap( this._node.removeChild( unwrap( childNode ) ) );
	}
	remove() {
		if ( this._node.parentNode ) {
			this._node.parentNode.removeChild( this._node );
		}
		return this;
	}
	cloneNode( deep = false ) { return wrap( this._node.cloneNode( Boolean( deep ) ) ); }
	normalize() { this._node.normalize(); return this; }
	isSameNode( other ) { return unwrap( other ) === this._node ? 1 : 0; }
	isEqualNode( other ) {
		const raw = unwrap( other );
		if ( this._node.isEqualNode ) {
			return this._node.isEqualNode( raw ) ? 1 : 0;
		}
		return raw && serialize( this._node ) === serialize( raw ) ? 1 : 0;
	}
	contains( other ) {
		let cur = unwrap( other );
		while ( cur ) {
			if ( cur === this._node ) {
				return 1;
			}
			cur = cur.parentNode || cur.ownerElement || null;
		}
		return 0;
	}
	visitEach( fn ) {
		for ( const node of descendants( this._node, true ) ) {
			fn( wrap( node ) );
		}
		return this;
	}
	findFirst( fn ) {
		for ( const node of descendants( this._node, false ) ) {
			const wrapped = wrap( node );
			if ( fn( wrapped ) ) {
				return wrapped;
			}
		}
		return null;
	}
	findnodes( xpath ) { return findNodes( this._node, xpath ); }
	findvalue( xpath ) { return findValue( this._node, xpath ); }
	querySelectorAll( selector ) { return simpleSelectorAll( this._node, selector ); }
	querySelector( selector ) { return this.querySelectorAll( selector )[0] || null; }
	getElementsByTagName( name ) {
		return this._node.getElementsByTagName
			? nodeArray( this._node.getElementsByTagName( String( name || '' ) ) )
			: [];
	}
	toXML( _pretty = false ) { return serialize( this._node ); }
	to_String() { return this.toXML( false ); }
	uniqueKey() { return nodeKey( this._node ); }
	unique_id() { return this.uniqueKey(); }
}

class XMLElement extends XMLNode {
	tagName() { return this.nodeName(); }
	id() { return this.getAttribute( 'id' ); }
	setId( value ) { return this.setAttribute( 'id', value ); }
	getAttribute( name ) {
		const value = this._node.getAttribute( String( name || '' ) );
		return value == null ? null : value;
	}
	setAttribute( name, value ) {
		this._node.setAttribute( String( name || '' ), String( value ?? '' ) );
		return this;
	}
	hasAttribute( name ) {
		return this._node.hasAttribute( String( name || '' ) ) ? 1 : 0;
	}
	removeAttribute( name ) {
		this._node.removeAttribute( String( name || '' ) );
		return this;
	}
	attributeNames() {
		return Array.from( this._node.attributes || [] ).map( (attr) => attr.name );
	}
	attributes() { return nodeArray( this._node.attributes ); }
}

class DOMAttr extends XMLNode {}
class DOMText extends XMLNode {}
class DOMComment extends XMLNode {}

class XMLDocument extends XMLNode {
	documentElement() { return wrap( this._node.documentElement ); }
	createElement( name ) { return wrap( this._node.createElement( String( name || '' ) ) ); }
	createTextNode( text ) { return wrap( this._node.createTextNode( String( text ?? '' ) ) ); }
	createComment( text ) { return wrap( this._node.createComment( String( text ?? '' ) ) ); }
	createCDATASection( text ) {
		return wrap( this._node.createCDATASection( String( text ?? '' ) ) );
	}
	getElementById( id ) {
		if ( typeof this._node.getElementById === 'function' ) {
			return wrap( this._node.getElementById( String( id || '' ) ) );
		}
		return this.findFirst(
			(node) => node instanceof XMLElement && node.getAttribute( 'id' ) === String( id || '' )
		);
	}
}

const XML = {
	parse( text ) {
		return parseXml( text );
	},
	load( pathValue ) {
		if ( !isPath( pathValue ) ) {
			throw new Error( 'TypeException: XML.load expects Path as first argument' );
		}
		return parseXml( pathValue.slurp_utf8() );
	},
	dump( pathValue, value, pretty = false ) {
		if ( !isPath( pathValue ) ) {
			throw new Error( 'TypeException: XML.dump expects Path as first argument' );
		}
		const xml = value && typeof value.toXML === 'function'
			? value.toXML( pretty )
			: String( value ?? '' );
		pathValue.spew_utf8( xml );
		return pathValue;
	},
};

module.exports = {
	XML,
	XMLDocument,
	XMLNode,
	DOMNode: XMLNode,
	DOMElement: XMLElement,
	DOMAttr,
	DOMText,
	DOMComment,
	DOMDocument: XMLDocument,
};
