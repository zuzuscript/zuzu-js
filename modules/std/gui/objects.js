'use strict';

const {
	makeWeakValue,
	retainValue,
	releaseValue,
	resolveWeakValue,
} = require( '../../../lib/runtime-helpers' );

let runtimePolicy = {
	deny_gui: true,
	gui: null,
	host_name: 'node',
};
const meta = {
	backend: 'electron-dom',
	font_size_pixels: 16,
	font_name: 'system-ui',
	font_point_size: 12,
};

let nextWidgetId = 1;

function _getProp( props, key, fallback = null ) {
	if ( props && typeof props.get === 'function' ) {
		return props.get( key, fallback );
	}
	if ( props && Object.prototype.hasOwnProperty.call( props, key ) ) {
		return props[key];
	}
	return fallback;
}

function _setProp( props, key, value ) {
	if ( props && typeof props.set === 'function' ) {
		if ( typeof props.remove === 'function' ) {
			props.remove( key );
		}
		props.set( key, value );
		return;
	}
	props[key] = value;
}

function _getChildren( props ) {
	const children = _getProp( props, 'children', [] );
	return Array.isArray( children ) ? children : [];
}

function _asBool( value ) {
	return value ? true : false;
}

function _asArray( value ) {
	return Array.isArray( value ) ? value : [];
}

function _arrayEquals( left, right ) {
	if ( !Array.isArray( left ) || !Array.isArray( right ) ) {
		return false;
	}
	if ( left.length !== right.length ) {
		return false;
	}
	for ( let i = 0; i < left.length; i++ ) {
		if ( Number( left[i] ) !== Number( right[i] ) ) {
			return false;
		}
	}
	return true;
}

function _itemLabel( item ) {
	if ( item == null ) {
		return '';
	}
	if ( typeof item === 'string' || typeof item === 'number' ) {
		return String( item );
	}
	if ( typeof item === 'object' ) {
		if ( typeof item.get === 'function' ) {
			return String( item.get( 'label', item.get( 'value', '' ) ) ?? '' );
		}
		if ( Object.prototype.hasOwnProperty.call( item, 'label' ) ) {
			return String( item.label ?? '' );
		}
		if ( Object.prototype.hasOwnProperty.call( item, 'value' ) ) {
			return String( item.value ?? '' );
		}
	}
	return String( item );
}

function _itemValue( item ) {
	if ( item == null ) {
		return '';
	}
	if ( typeof item === 'string' || typeof item === 'number' ) {
		return String( item );
	}
	if ( typeof item === 'object' ) {
		if ( typeof item.get === 'function' ) {
			return item.get( 'value', _itemLabel( item ) );
		}
		if ( Object.prototype.hasOwnProperty.call( item, 'value' ) ) {
			return item.value;
		}
	}
	return _itemLabel( item );
}

function _itemChildren( item ) {
	if ( item && typeof item === 'object' ) {
		if ( typeof item.get === 'function' ) {
			return _asArray( item.get( 'children', [] ) );
		}
		if ( Array.isArray( item.children ) ) {
			return item.children;
		}
	}
	return [];
}

function _isMenuKind( value ) {
	return value instanceof Menu || value instanceof MenuItem;
}

function _weak( value ) {
	return makeWeakValue( value );
}

function _resolve( value ) {
	return resolveWeakValue( value );
}

function _retainDispatchPath( path ) {
	for ( const widget of path ) {
		retainValue( widget );
	}
}

function _releaseDispatchPath( path ) {
	for ( const widget of path ) {
		releaseValue( widget );
	}
}

class ListenerToken {
	constructor( widget, type, id ) {
		this.widget = _weak( widget );
		this.type = String( type );
		this.id = id;
	}
}

class Event {
	constructor( props = {} ) {
		this.__zuzu_name = String( props.name || props.type || '' );
		this.__zuzu_target = _weak( props.target || null );
		this.__zuzu_current_target = _weak( props.current_target || null );
		this.__zuzu_timestamp = Date.now() / 1000;
		this.__zuzu_data = Object.prototype.hasOwnProperty.call( props, 'data' )
			? props.data
			: null;
		this.__zuzu_value = Object.prototype.hasOwnProperty.call( props, 'value' )
			? props.value
			: null;
		this.__zuzu_cancelled = false;
		this.__zuzu_propagation_stopped = false;
		this.__zuzu_default_prevented = false;
		this.__zuzu_phase = '';
	}

	name() {
		return this.__zuzu_name;
	}

	type() {
		return this.__zuzu_name;
	}

	target() {
		return _resolve( this.__zuzu_target );
	}

	current_target() {
		return _resolve( this.__zuzu_current_target );
	}

	currentTarget() {
		return _resolve( this.__zuzu_current_target );
	}

	phase() {
		return this.__zuzu_phase;
	}

	timestamp() {
		return this.__zuzu_timestamp;
	}

	data() {
		return this.__zuzu_data;
	}

	value() {
		return this.__zuzu_value;
	}

	cancelled() {
		return this.__zuzu_cancelled;
	}

	propagation_stopped() {
		return this.__zuzu_propagation_stopped;
	}

	default_prevented() {
		return this.__zuzu_default_prevented;
	}

	window() {
		const target = _resolve( this.__zuzu_target );
		return target instanceof Widget ? target.__zuzu_owner_window_live() : null;
	}

	stop_propagation() {
		this.__zuzu_propagation_stopped = true;
		this.__zuzu_cancelled = true;
		return this;
	}

	prevent_default() {
		this.__zuzu_default_prevented = true;
		this.__zuzu_cancelled = true;
		return this;
	}
}

class Widget {
	constructor( props = {} ) {
		this.__zuzu_gui_id = `w${nextWidgetId++}`;
		this.__zuzu_gui_type = this.__zuzu_gui_type_name || this.constructor.name;
		this.__zuzu_props = props || {};
		this.__zuzu_parent = _weak( null );
		this.__zuzu_event_parent = null;
		this.__zuzu_children = [];
		this.__zuzu_listeners = new Map();
		this.__zuzu_listener_seq = 0;
		this.__zuzu_meta = Object.create( null );
		this.__zuzu_style = Object.create( null );
		this.__zuzu_classes = [];
		for ( const child of _getChildren( this.__zuzu_props ) ) {
			this.add_child( child );
		}
	}

	id( value ) {
		if ( arguments.length === 0 ) {
			return _getProp( this.__zuzu_props, 'id', null );
		}
		_setProp( this.__zuzu_props, 'id', value == null ? null : String( value ) );
		this.__zuzu_update_native();
		return this;
	}

	set_id( value ) {
		return this.id( value );
	}

	parent() {
		return _resolve( this.__zuzu_parent );
	}

	children() {
		return this.__zuzu_children.slice();
	}

	add_child( child ) {
		if ( child == null ) {
			return this;
		}
		if ( !( child instanceof Widget ) ) {
			throw new Error( 'GUI_PROP_TYPE: add_child expects a Widget' );
		}
		if ( this instanceof MenuItem ) {
			throw new Error( 'GUI_PROP_TYPE: MenuItem widgets cannot have children' );
		}
		if ( child instanceof Menu && !( this instanceof Window ) ) {
			throw new Error( 'GUI_PROP_TYPE: Menu widgets can only be Window children' );
		}
		if ( child instanceof MenuItem && !( this instanceof Menu ) ) {
			throw new Error( 'GUI_PROP_TYPE: MenuItem widgets can only be Menu children' );
		}
		if ( this instanceof Menu && !( child instanceof MenuItem ) ) {
			throw new Error( 'GUI_PROP_TYPE: Menu widgets can only contain MenuItem children' );
		}
		const oldParent = child.parent();
		if ( oldParent && oldParent !== this ) {
			oldParent.remove_child( child );
		}
		if ( this.__zuzu_children.includes( child ) ) {
			return this;
		}
		child.__zuzu_parent = _weak( this );
		child.__zuzu_event_parent = this;
		this.__zuzu_children.push( child );
		this.__zuzu_child_added( child );
		if (
			this instanceof Window
			&& !_isMenuKind( child )
			&& this.__zuzu_content == null
		) {
			this.__zuzu_content = child;
		}
		this.__zuzu_create_native_child( child );
		return this;
	}

	__zuzu_child_added( _child ) {}

	remove_child( child ) {
		if ( !( child instanceof Widget ) ) {
			return this;
		}
		const before = this.__zuzu_children.length;
		this.__zuzu_children = this.__zuzu_children.filter( (item) => item !== child );
		if ( this.__zuzu_children.length === before ) {
			return this;
		}
		this.__zuzu_destroy_native_child( child );
		this.__zuzu_child_removed( child );
		if ( child.parent() === this ) {
			child.__zuzu_parent = _weak( null );
		}
		if ( child.__zuzu_event_parent === this ) {
			child.__zuzu_event_parent = null;
		}
		if ( this instanceof Window && this.__zuzu_content === child ) {
			this.__zuzu_content = this.__zuzu_children.find(
				(item) => !_isMenuKind( item )
			) || null;
		}
		return this;
	}

	__zuzu_child_removed( _child ) {}

	find_by_id( id ) {
		if ( this.id() != null && this.id() === String( id ) ) {
			return this;
		}
		for ( const child of this.__zuzu_children ) {
			const found = child.find_by_id( id );
			if ( found ) {
				return found;
			}
		}
		return null;
	}

	enabled( value ) {
		if ( arguments.length === 0 ) {
			return _getProp( this.__zuzu_props, 'disabled', false )
				? false
				: Boolean( _getProp( this.__zuzu_props, 'enabled', true ) );
		}
		_setProp( this.__zuzu_props, 'enabled', value ? true : false );
		_setProp( this.__zuzu_props, 'disabled', value ? false : true );
		this.__zuzu_update_native();
		return this;
	}

	set_enabled( value ) {
		return this.enabled( value );
	}

	disabled( value ) {
		if ( arguments.length === 0 ) {
			return this.enabled() ? false : true;
		}
		return this.enabled( value ? false : true );
	}

	visible( value ) {
		if ( arguments.length === 0 ) {
			return Boolean( _getProp( this.__zuzu_props, 'visible', true ) );
		}
		_setProp( this.__zuzu_props, 'visible', value ? true : false );
		this.__zuzu_update_native();
		return this;
	}

	set_visible( value ) {
		return this.visible( value );
	}

	classes() {
		return this.__zuzu_classes.slice();
	}

	add_class( name ) {
		const key = String( name );
		if ( !this.__zuzu_classes.includes( key ) ) {
			this.__zuzu_classes.push( key );
			this.__zuzu_update_native();
		}
		return this;
	}

	remove_class( name ) {
		const key = String( name );
		const before = this.__zuzu_classes.length;
		this.__zuzu_classes = this.__zuzu_classes.filter( (item) => item !== key );
		if ( before !== this.__zuzu_classes.length ) {
			this.__zuzu_update_native();
		}
		return this;
	}

	style( key, value ) {
		if ( arguments.length === 0 ) {
			return { ...this.__zuzu_style };
		}
		const name = String( key );
		if ( arguments.length === 1 ) {
			return this.__zuzu_style[name] ?? null;
		}
		this.__zuzu_style[name] = value;
		this.__zuzu_update_native();
		return this;
	}

	meta( key, value ) {
		if ( arguments.length === 0 ) {
			return { ...this.__zuzu_meta };
		}
		const name = String( key );
		if ( arguments.length === 1 ) {
			return this.__zuzu_meta[name] ?? null;
		}
		this.__zuzu_meta[name] = value;
		return this;
	}

	on( type, handler ) {
		if ( typeof handler !== 'function' ) {
			throw new Error( 'GUI_EVENT_HANDLER: on expects a Function handler' );
		}
		const name = String( type );
		const id = ++this.__zuzu_listener_seq;
		if ( !this.__zuzu_listeners.has( name ) ) {
			this.__zuzu_listeners.set( name, [] );
		}
		this.__zuzu_listeners.get( name ).push( {
			id,
			handler,
			once: false,
		} );
		return new ListenerToken( this, name, id );
	}

	once( type, handler ) {
		if ( typeof handler !== 'function' ) {
			throw new Error( 'GUI_EVENT_HANDLER: once expects a Function handler' );
		}
		const name = String( type );
		const id = ++this.__zuzu_listener_seq;
		if ( !this.__zuzu_listeners.has( name ) ) {
			this.__zuzu_listeners.set( name, [] );
		}
		this.__zuzu_listeners.get( name ).push( {
			id,
			handler,
			once: true,
		} );
		return new ListenerToken( this, name, id );
	}

	off( token ) {
		if ( !( token instanceof ListenerToken ) || _resolve( token.widget ) !== this ) {
			return false;
		}
		const listeners = this.__zuzu_listeners.get( token.type );
		if ( !listeners ) {
			return false;
		}
		const before = listeners.length;
		const kept = listeners.filter( (listener) => listener.id !== token.id );
		this.__zuzu_listeners.set( token.type, kept );
		return kept.length !== before;
	}

	emit( type, payload = null ) {
		const name = String( type );
		const event = payload instanceof Event
			? payload
			: new Event( {
				name,
				target: this,
				data: payload,
				value: payload,
			} );
		event.__zuzu_name = name;
		if ( _resolve( event.__zuzu_target ) == null ) {
			event.__zuzu_target = _weak( this );
		}
		this.__zuzu_dispatch_event( event );
		return event;
	}

	__zuzu_dispatch_event( event ) {
		const path = [];
		let current = this;
		while ( current ) {
			path.push( current );
			current = current.__zuzu_event_parent;
		}
		_retainDispatchPath( path );
		try {
			this.__zuzu_dispatch_at( event, 'target' );
			for ( let i = 1; i < path.length; i++ ) {
				if ( event.__zuzu_propagation_stopped ) {
					break;
				}
				path[i].__zuzu_dispatch_at( event, 'bubble' );
			}
		}
		finally {
			_releaseDispatchPath( path );
		}
	}

	__zuzu_dispatch_at( event, phase ) {
		const listeners = ( this.__zuzu_listeners.get( event.__zuzu_name ) || [] ).slice();
		if ( listeners.length === 0 ) {
			return;
		}
		event.__zuzu_current_target = _weak( this );
		event.__zuzu_phase = phase;
		for ( const listener of listeners ) {
			listener.handler( event );
			if ( listener.once ) {
				this.off( new ListenerToken( this, event.__zuzu_name, listener.id ) );
			}
			if ( event.__zuzu_propagation_stopped ) {
				break;
			}
		}
	}

	__zuzu_owner_window() {
		let current = this;
		while ( current ) {
			if ( current instanceof Window ) {
				return current;
			}
			current = current.parent();
		}
		return null;
	}

	__zuzu_owner_window_live() {
		let current = this;
		while ( current ) {
			if ( current instanceof Window ) {
				return current;
			}
			current = current.__zuzu_event_parent;
		}
		return null;
	}

	__zuzu_create_native_child( child ) {
		const window = this.__zuzu_owner_window_live();
		if (
			!window
			|| window.__zuzu_electron_window_id == null
			|| !runtimePolicy.gui
			|| typeof runtimePolicy.gui.createWidget !== 'function'
		) {
			return;
		}
		runtimePolicy.gui.createWidget(
			window.__zuzu_electron_window_id,
			this.__zuzu_gui_id,
			child.__zuzu_gui_snapshot(),
			this.__zuzu_children.indexOf( child )
		);
	}

	__zuzu_destroy_native_child( child ) {
		const window = this.__zuzu_owner_window_live();
		if (
			!window
			|| window.__zuzu_electron_window_id == null
			|| !runtimePolicy.gui
			|| typeof runtimePolicy.gui.destroyWidget !== 'function'
		) {
			return;
		}
		runtimePolicy.gui.destroyWidget(
			window.__zuzu_electron_window_id,
			child.__zuzu_gui_id
		);
	}

	__zuzu_update_native() {
		const window = this.__zuzu_owner_window_live();
		if (
			!window
			|| window.__zuzu_electron_window_id == null
			|| !runtimePolicy.gui
			|| typeof runtimePolicy.gui.updateWidget !== 'function'
		) {
			return;
		}
		runtimePolicy.gui.updateWidget(
			window.__zuzu_electron_window_id,
			this.__zuzu_gui_snapshot()
		);
	}

	__zuzu_set_prop_silent( key, value ) {
		_setProp( this.__zuzu_props, key, value );
	}

	__zuzu_find_by_guid( guid ) {
		if ( this.__zuzu_gui_id === guid ) {
			return this;
		}
		for ( const child of this.__zuzu_children ) {
			const found = child.__zuzu_find_by_guid( guid );
			if ( found ) {
				return found;
			}
		}
		return null;
	}

	__zuzu_gui_snapshot() {
		return {
			guid: this.__zuzu_gui_id,
			type: this.__zuzu_gui_type,
			id: this.id(),
			classes: this.classes(),
			props: {
				disabled: this.disabled(),
				enabled: this.enabled(),
				visible: this.visible(),
				align: _getProp( this.__zuzu_props, 'align', null ),
				alt: _getProp( this.__zuzu_props, 'alt', null ),
				checked: _getProp( this.__zuzu_props, 'checked', null ),
				closable: _getProp( this.__zuzu_props, 'closable', null ),
				collapsible: _getProp( this.__zuzu_props, 'collapsible', null ),
				collapsed: _getProp( this.__zuzu_props, 'collapsed', null ),
				first_day_of_week: _getProp( this.__zuzu_props, 'first_day_of_week', null ),
				fit: _getProp( this.__zuzu_props, 'fit', null ),
				for_id: this.for_id ? this.for_id() : null,
				group: _getProp( this.__zuzu_props, 'group', null ),
				icon: _getProp( this.__zuzu_props, 'icon', null ),
				indeterminate: _getProp( this.__zuzu_props, 'indeterminate', null ),
				items: _getProp( this.__zuzu_props, 'items', null ),
				label: _getProp( this.__zuzu_props, 'label', null ),
				max: _getProp( this.__zuzu_props, 'max', null ),
				min: _getProp( this.__zuzu_props, 'min', null ),
				modal: _getProp( this.__zuzu_props, 'modal', null ),
				multiline: _getProp( this.__zuzu_props, 'multiline', null ),
				multiple: _getProp( this.__zuzu_props, 'multiple', null ),
				name: _getProp( this.__zuzu_props, 'name', null ),
				options: _getProp( this.__zuzu_props, 'options', null ),
				orientation: _getProp( this.__zuzu_props, 'orientation', null ),
				password: _getProp( this.__zuzu_props, 'password', null ),
				title: _getProp( this.__zuzu_props, 'title', null ),
				placement: _getProp( this.__zuzu_props, 'placement', null ),
				text: _getProp( this.__zuzu_props, 'text', null ),
				readonly: _getProp( this.__zuzu_props, 'readonly', null ),
				required: _getProp( this.__zuzu_props, 'required', null ),
				resizable: _getProp( this.__zuzu_props, 'resizable', null ),
				selected: _getProp( this.__zuzu_props, 'selected', null ),
				selected_index: _getProp( this.__zuzu_props, 'selected_index', null ),
				selected_path: _getProp( this.__zuzu_props, 'selected_path', null ),
				show_text: _getProp( this.__zuzu_props, 'show_text', null ),
				src: _getProp( this.__zuzu_props, 'src', null ),
				step: _getProp( this.__zuzu_props, 'step', null ),
				value: _getProp( this.__zuzu_props, 'value', null ),
				placeholder: _getProp( this.__zuzu_props, 'placeholder', null ),
				variant: _getProp( this.__zuzu_props, 'variant', null ),
				wrap: _getProp( this.__zuzu_props, 'wrap', null ),
				width: _getProp( this.__zuzu_props, 'width', null ),
				height: _getProp( this.__zuzu_props, 'height', null ),
				minwidth: _getProp( this.__zuzu_props, 'minwidth', null ),
				minheight: _getProp( this.__zuzu_props, 'minheight', null ),
				maxwidth: _getProp( this.__zuzu_props, 'maxwidth', null ),
				maxheight: _getProp( this.__zuzu_props, 'maxheight', null ),
				gap: _getProp( this.__zuzu_props, 'gap', null ),
				padding: _getProp( this.__zuzu_props, 'padding', null ),
			},
			children: this.__zuzu_children.map(
				(child) => child.__zuzu_gui_snapshot()
			),
		};
	}
}

for ( const name of [
	'width',
	'height',
	'minwidth',
	'minheight',
	'maxwidth',
	'maxheight',
	'align',
	'alt',
	'closable',
	'collapsible',
	'collapsed',
	'first_day_of_week',
	'fit',
	'gap',
	'group',
	'icon',
	'indeterminate',
	'label',
	'max',
	'min',
	'modal',
	'multiline',
	'multiple',
	'name',
	'orientation',
	'padding',
	'password',
	'placement',
	'readonly',
	'required',
	'resizable',
	'selected',
	'show_text',
	'src',
	'step',
	'title',
	'text',
	'value',
	'placeholder',
	'variant',
	'wrap',
] ) {
	Widget.prototype[name] = function propAccessor( value ) {
		if ( arguments.length === 0 ) {
			return _getProp( this.__zuzu_props, name, null );
		}
		_setProp( this.__zuzu_props, name, value == null ? '' : value );
		this.__zuzu_update_native();
		return this;
	};
}

Widget.prototype.for_id = function forId( value ) {
	if ( arguments.length === 0 ) {
		return _getProp( this.__zuzu_props, 'for', null );
	}
	_setProp( this.__zuzu_props, 'for', value == null ? null : String( value ) );
	this.__zuzu_update_native();
	return this;
};

Widget.prototype.set_for_id = function setForId( value ) {
	return this.for_id( value );
};

Widget.prototype.set_value = function setValue( value ) {
	return this.value( value );
};

Widget.prototype.set_text = function setText( value ) {
	return this.text( value );
};

Widget.prototype.set_title = function setTitle( value ) {
	return this.title( value );
};

for ( const eventName of [
	'activate',
	'blur',
	'change',
	'click',
	'close_request',
	'closed',
	'collapse',
	'enter',
	'expand',
	'focus',
	'input',
	'open',
	'resize',
	'select',
	'submit',
] ) {
	Widget.prototype[eventName] = function eventShortcut( handler = null ) {
		if ( handler == null ) {
			return this.emit( eventName );
		}
		return this.on( eventName, handler );
	};
}

class Window extends Widget {
	constructor( props = {} ) {
		super( props );
		this.__zuzu_close_result = null;
		this.__zuzu_electron_window_id = null;
		this.__zuzu_closed = false;
		this.__zuzu_shown = false;
		this.__zuzu_native_close_allowed = false;
		this.__zuzu_close_waiters = [];
		this.__zuzu_content = _getProp( props, 'content', null );
		if (
			this.__zuzu_content != null
			&& (
				!( this.__zuzu_content instanceof Widget )
				|| _isMenuKind( this.__zuzu_content )
			)
		) {
			throw new Error( 'GUI_PROP_TYPE: Window content expects a non-menu Widget or null' );
		}
		if (
			this.__zuzu_content != null
			&& !this.__zuzu_children.includes( this.__zuzu_content )
		) {
			this.add_child( this.__zuzu_content );
		}
		if ( this.__zuzu_content == null ) {
			this.__zuzu_content = this.__zuzu_children.find(
				(child) => !_isMenuKind( child )
			) || null;
		}
	}

	content() {
		return this.__zuzu_content;
	}

	menus() {
		return this.__zuzu_children.filter( (child) => child instanceof Menu );
	}

	set_content( child = null ) {
		if ( child != null && ( !( child instanceof Widget ) || _isMenuKind( child ) ) ) {
			throw new Error( 'GUI_PROP_TYPE: set_content expects a non-menu Widget or null' );
		}
		for ( const old of this.__zuzu_children.slice() ) {
			if ( !_isMenuKind( old ) ) {
				this.remove_child( old );
			}
		}
		this.__zuzu_content = child;
		if ( child != null ) {
			this.add_child( child );
		}
		return this;
	}

	show() {
		if ( runtimePolicy.deny_gui || !runtimePolicy.gui ) {
			throw new Error(
				`GUI is not available on host '${runtimePolicy.host_name}'`
			);
		}
		if ( this.__zuzu_electron_window_id != null ) {
			return this;
		}
		const result = runtimePolicy.gui.openWindow(
			this.__zuzu_gui_snapshot(),
			{
				onEvent: (event) => this.__zuzu_receive_gui_event( event ),
				onCloseRequest: () => this.__zuzu_native_close_request(),
				onClosed: () => this.__zuzu_native_closed(),
			}
		);
		const markShown = (windowId) => {
			this.__zuzu_electron_window_id = windowId;
			this.__zuzu_shown = true;
			this.emit( 'open' );
			return this;
		};
		if ( result && typeof result.then === 'function' ) {
			return result.then( markShown );
		}
		return markShown( result );
	}

	call( options = null ) {
		const asyncCall = _getProp( options, 'async', false ) ? true : false;
		if ( this.__zuzu_closed ) {
			if ( asyncCall ) {
				return Promise.resolve( this.__zuzu_close_result );
			}
			return this.__zuzu_close_result;
		}
		if ( runtimePolicy.host_name === 'browser' && !asyncCall ) {
			throw new Error(
				'GUI_CALL_SYNC_UNSUPPORTED: Window.call requires async: true on host \'browser\''
			);
		}
		const shown = this.show();
		if ( shown && typeof shown.then === 'function' ) {
			return shown.then( () => this.__zuzu_wait_for_close() );
		}
		return this.__zuzu_wait_for_close();
	}

	close( result = null ) {
		return this.__zuzu_close( result, false );
	}

	__zuzu_close( result = null, nativeClose = false ) {
		if ( this.__zuzu_closed ) {
			return this;
		}
		const request = this.emit( 'close_request', result );
		if ( request.cancelled() || request.default_prevented() ) {
			return this;
		}
		this.__zuzu_closed = true;
		this.__zuzu_close_result = result;
		if (
			!nativeClose
			&& runtimePolicy.gui
			&& typeof runtimePolicy.gui.closeWindow === 'function'
			&& this.__zuzu_electron_window_id != null
		) {
			runtimePolicy.gui.closeWindow( this.__zuzu_electron_window_id );
		}
		this.emit( 'closed', result );
		this.__zuzu_resolve_close_waiters();
		return this;
	}

	__zuzu_wait_for_close() {
		if ( this.__zuzu_closed ) {
			return this.__zuzu_close_result;
		}
		return new Promise( (resolve) => {
			this.__zuzu_close_waiters.push( resolve );
		} );
	}

	__zuzu_resolve_close_waiters() {
		const waiters = this.__zuzu_close_waiters.splice( 0 );
		for ( const resolve of waiters ) {
			resolve( this.__zuzu_close_result );
		}
	}

	__zuzu_native_close_request() {
		if ( this.__zuzu_closed ) {
			return false;
		}
		const request = this.emit( 'close_request', null );
		if ( request.cancelled() || request.default_prevented() ) {
			return true;
		}
		this.__zuzu_native_close_allowed = true;
		return false;
	}

	__zuzu_native_closed() {
		if ( this.__zuzu_closed ) {
			return;
		}
		this.__zuzu_closed = true;
		this.__zuzu_close_result = null;
		this.emit( 'closed', null );
		this.__zuzu_resolve_close_waiters();
	}

	__zuzu_receive_gui_event( raw = {} ) {
		const target = raw.widgetGuid
			? this.__zuzu_find_by_guid( raw.widgetGuid )
			: this;
		if ( !target ) {
			return;
		}
		if ( Object.prototype.hasOwnProperty.call( raw, 'value' ) ) {
			target.__zuzu_set_prop_silent( 'value', raw.value );
		}
		if (
			Object.prototype.hasOwnProperty.call( raw, 'checked' )
			&& typeof target.checked === 'function'
		) {
			target.__zuzu_set_prop_silent( 'checked', raw.checked ? true : false );
		}
		if (
			Object.prototype.hasOwnProperty.call( raw, 'selected_index' )
			&& typeof target.selected_index === 'function'
		) {
			target.__zuzu_set_prop_silent(
				'selected_index',
				raw.selected_index == null ? null : Number( raw.selected_index )
			);
		}
		if (
			Object.prototype.hasOwnProperty.call( raw, 'selected' )
			&& typeof target.selected === 'function'
		) {
			target.__zuzu_set_prop_silent(
				'selected',
				raw.selected == null ? null : String( raw.selected )
			);
			if ( target instanceof Tabs ) {
				target.__zuzu_sync_tabs();
			}
		}
		if (
			Object.prototype.hasOwnProperty.call( raw, 'selected_path' )
			&& typeof target.selected_path === 'function'
		) {
			target.__zuzu_set_prop_silent(
				'selected_path',
				_asArray( raw.selected_path ).map( Number )
			);
		}
		if (
			target instanceof TreeView
			&& Object.prototype.hasOwnProperty.call( raw, 'selected_path' )
			&& raw.type === 'expand'
		) {
			target.__zuzu_set_expanded_silent( raw.selected_path, true );
			target.emit( raw.type, new Event( {
				name: raw.type,
				target,
				data: raw,
				value: raw.selected_path,
			} ) );
			return;
		}
		if (
			target instanceof TreeView
			&& Object.prototype.hasOwnProperty.call( raw, 'selected_path' )
			&& raw.type === 'collapse'
		) {
			target.__zuzu_set_expanded_silent( raw.selected_path, false );
			target.emit( raw.type, new Event( {
				name: raw.type,
				target,
				data: raw,
				value: raw.selected_path,
			} ) );
			return;
		}
		target.emit( raw.type, new Event( {
			name: raw.type,
			target,
			data: raw,
			value: Object.prototype.hasOwnProperty.call( raw, 'value' )
				? raw.value
				: null,
		} ) );
	}
}

class VBox extends Widget {}
class HBox extends Widget {}
class Frame extends Widget {}
class Label extends Widget {}
class Text extends Widget {}
class RichText extends Widget {}
class Image extends Widget {}
class Input extends Widget {
	constructor( props = {} ) {
		if ( props && typeof props.get === 'function' ) {
			if (
				typeof props.has === 'function'
				&& props.has( 'value' )
			) {
				const value = props.get( 'value' );
				props.set( 'value', value == null ? '' : String( value ) );
			}
			super( props );
			return;
		}
		const cooked = { ...props };
		if ( Object.prototype.hasOwnProperty.call( cooked, 'value' ) ) {
			cooked.value = cooked.value == null ? '' : String( cooked.value );
		}
		super( cooked );
	}

	value( value ) {
		if ( arguments.length === 0 ) {
			return _getProp( this.__zuzu_props, 'value', null );
		}
		_setProp( this.__zuzu_props, 'value', value == null ? '' : String( value ) );
		this.__zuzu_update_native();
		return this;
	}

	select_all() {
		this.emit( 'select_all' );
		return this;
	}
}
class DatePicker extends Widget {}
class Checkbox extends Widget {
	checked( value ) {
		if ( arguments.length === 0 ) {
			return _asBool( _getProp( this.__zuzu_props, 'checked', false ) );
		}
		_setProp( this.__zuzu_props, 'checked', _asBool( value ) );
		this.__zuzu_update_native();
		return this;
	}
}
class Radio extends Checkbox {
	checked( value ) {
		if ( arguments.length === 0 ) {
			return super.checked();
		}
		super.checked( value );
		const parent = this.parent();
		if ( value && parent instanceof RadioGroup ) {
			parent.value( this.value() );
		}
		return this;
	}
}
class RadioGroup extends Widget {
	constructor( props = {} ) {
		super( props );
		this.__zuzu_sync_radios();
	}

	options() {
		return this.children().filter( (child) => child instanceof Radio );
	}

	value( value ) {
		if ( arguments.length === 0 ) {
			return _getProp( this.__zuzu_props, 'value', null );
		}
		_setProp( this.__zuzu_props, 'value', value == null ? null : String( value ) );
		this.__zuzu_sync_radios();
		this.__zuzu_update_native();
		return this;
	}

	__zuzu_child_added( child ) {
		if ( child instanceof Radio ) {
			this.__zuzu_sync_radios();
		}
	}

	__zuzu_sync_radios() {
		const selected = this.value();
		for ( const radio of this.options() ) {
			_setProp(
				radio.__zuzu_props,
				'checked',
				selected != null && String( radio.value() ) === String( selected )
			);
		}
	}

	__zuzu_set_prop_silent( key, value ) {
		super.__zuzu_set_prop_silent( key, value );
		if ( key === 'value' ) {
			this.__zuzu_sync_radios();
		}
	}
}
class Select extends Widget {
	options() {
		return _asArray( _getProp( this.__zuzu_props, 'options', [] ) ).slice();
	}

	add_option( option ) {
		const options = this.options();
		options.push( option );
		_setProp( this.__zuzu_props, 'options', options );
		this.__zuzu_update_native();
		return this;
	}

	clear_options() {
		_setProp( this.__zuzu_props, 'options', [] );
		this.__zuzu_update_native();
		return this;
	}
}
class Menu extends Widget {
	items() {
		return this.children();
	}
}
class MenuItem extends Widget {}
class Button extends Widget {}
class Separator extends Widget {}
class Slider extends Widget {}
class Progress extends Widget {}
class Tabs extends Widget {
	constructor( props = {} ) {
		super( props );
		this.__zuzu_sync_tabs();
	}

	tabs() {
		return this.children().filter( (child) => child instanceof Tab );
	}

	selected( value ) {
		if ( arguments.length === 0 ) {
			return _getProp( this.__zuzu_props, 'selected', null );
		}
		_setProp( this.__zuzu_props, 'selected', value == null ? null : String( value ) );
		this.__zuzu_sync_tabs();
		this.__zuzu_update_native();
		return this;
	}

	selected_tab() {
		const selected = this.selected();
		return this.tabs().find( (tab) => String( tab.value() ) === String( selected ) )
			|| null;
	}

	__zuzu_child_added( child ) {
		if ( child instanceof Tab ) {
			this.__zuzu_sync_tabs();
		}
	}

	__zuzu_sync_tabs() {
		const selected = this.selected();
		for ( const tab of this.tabs() ) {
			_setProp(
				tab.__zuzu_props,
				'selected',
				selected != null && String( tab.value() ) === String( selected )
			);
		}
	}
}
class Tab extends Widget {
	selected( value ) {
		if ( arguments.length === 0 ) {
			return _asBool( _getProp( this.__zuzu_props, 'selected', false ) );
		}
		_setProp( this.__zuzu_props, 'selected', _asBool( value ) );
		const parent = this.parent();
		if ( value && parent instanceof Tabs ) {
			parent.selected( this.value() );
		}
		else {
			this.__zuzu_update_native();
		}
		return this;
	}
}
class ListView extends Widget {
	items() {
		return _asArray( _getProp( this.__zuzu_props, 'items', [] ) ).slice();
	}

	selected_index( value ) {
		if ( arguments.length === 0 ) {
			return _getProp( this.__zuzu_props, 'selected_index', null );
		}
		_setProp(
			this.__zuzu_props,
			'selected_index',
			value == null ? null : Number( value )
		);
		this.__zuzu_update_native();
		return this;
	}

	selected_item() {
		const index = this.selected_index();
		const items = this.items();
		return index == null ? null : ( items[Number( index )] ?? null );
	}

	add_item( item ) {
		const items = this.items();
		items.push( item );
		_setProp( this.__zuzu_props, 'items', items );
		this.__zuzu_update_native();
		return this;
	}

	clear_items() {
		_setProp( this.__zuzu_props, 'items', [] );
		_setProp( this.__zuzu_props, 'selected_index', null );
		this.__zuzu_update_native();
		return this;
	}

	activate_index( index ) {
		this.selected_index( index );
		this.emit( 'activate', index );
		return this;
	}
}
class TreeView extends Widget {
	constructor( props = {} ) {
		super( props );
		this.__zuzu_expanded = new Set();
		this.__zuzu_mark_initial_expanded( this.items(), [] );
	}

	items() {
		return _asArray( _getProp( this.__zuzu_props, 'items', [] ) ).slice();
	}

	selected_path( value ) {
		if ( arguments.length === 0 ) {
			return _asArray( _getProp( this.__zuzu_props, 'selected_path', [] ) ).slice();
		}
		_setProp( this.__zuzu_props, 'selected_path', _asArray( value ).map( Number ) );
		this.__zuzu_update_native();
		return this;
	}

	selected_item() {
		return this.__zuzu_item_at_path( this.selected_path() );
	}

	add_item( item ) {
		const items = this.items();
		items.push( item );
		_setProp( this.__zuzu_props, 'items', items );
		this.__zuzu_update_native();
		return this;
	}

	clear_items() {
		_setProp( this.__zuzu_props, 'items', [] );
		_setProp( this.__zuzu_props, 'selected_path', [] );
		this.__zuzu_expanded.clear();
		this.__zuzu_update_native();
		return this;
	}

	activate_path( path ) {
		this.selected_path( path );
		this.emit( 'activate', path );
		return this;
	}

	expand_path( path ) {
		this.__zuzu_expanded.add( this.__zuzu_path_key( path ) );
		this.__zuzu_update_native();
		this.emit( 'expand', path );
		return this;
	}

	collapse_path( path ) {
		this.__zuzu_expanded.delete( this.__zuzu_path_key( path ) );
		this.__zuzu_update_native();
		this.emit( 'collapse', path );
		return this;
	}

	is_expanded( path ) {
		return this.__zuzu_expanded.has( this.__zuzu_path_key( path ) );
	}

	__zuzu_gui_snapshot() {
		const snapshot = super.__zuzu_gui_snapshot();
		snapshot.props.expanded_paths = [ ...this.__zuzu_expanded ].map(
			(key) => key.split( ',' ).filter( Boolean ).map( Number )
		);
		return snapshot;
	}

	__zuzu_item_at_path( path ) {
		let items = this.items();
		let current = null;
		for ( const rawIndex of _asArray( path ) ) {
			const index = Number( rawIndex );
			current = items[index] ?? null;
			if ( current == null ) {
				return null;
			}
			items = _itemChildren( current );
		}
		return current;
	}

	__zuzu_path_key( path ) {
		return _asArray( path ).map( (part) => Number( part ) ).join( ',' );
	}

	__zuzu_mark_initial_expanded( items, prefix ) {
		for ( let i = 0; i < items.length; i++ ) {
			const path = [ ...prefix, i ];
			const children = _itemChildren( items[i] );
			if ( children.length > 0 ) {
				this.__zuzu_expanded.add( this.__zuzu_path_key( path ) );
				this.__zuzu_mark_initial_expanded( children, path );
			}
		}
	}

	__zuzu_set_expanded_silent( path, expanded ) {
		const key = this.__zuzu_path_key( path );
		if ( expanded ) {
			this.__zuzu_expanded.add( key );
		}
		else {
			this.__zuzu_expanded.delete( key );
		}
	}
}

function _nativeDialogue( name ) {
	return function nativeDialogue( first, ...rest ) {
		if (
			runtimePolicy.gui
			&& typeof runtimePolicy.gui[name] === 'function'
		) {
			return runtimePolicy.gui[name]( first, ...rest );
		}
		return null;
	};
}

function _tagGuiType( klass, names ) {
	Object.defineProperty( klass.prototype, '__zuzu_gui_type_name', {
		value: names[0],
		enumerable: false,
		configurable: false,
	} );
	Object.defineProperty( klass.prototype, '__zuzu_type_names', {
		value: names,
		enumerable: false,
		configurable: false,
	} );
}

for ( const [ klass, names ] of [
	[ Widget, [ 'Widget' ] ],
	[ Window, [ 'Window', 'Widget' ] ],
	[ VBox, [ 'VBox', 'Widget' ] ],
	[ HBox, [ 'HBox', 'Widget' ] ],
	[ Frame, [ 'Frame', 'Widget' ] ],
	[ Label, [ 'Label', 'Widget' ] ],
	[ Text, [ 'Text', 'Widget' ] ],
	[ RichText, [ 'RichText', 'Widget' ] ],
	[ Image, [ 'Image', 'Widget' ] ],
	[ Input, [ 'Input', 'Widget' ] ],
	[ DatePicker, [ 'DatePicker', 'Widget' ] ],
	[ Checkbox, [ 'Checkbox', 'Widget' ] ],
	[ Radio, [ 'Radio', 'Checkbox', 'Widget' ] ],
	[ RadioGroup, [ 'RadioGroup', 'Widget' ] ],
	[ Select, [ 'Select', 'Widget' ] ],
	[ Menu, [ 'Menu', 'Widget' ] ],
	[ MenuItem, [ 'MenuItem', 'Widget' ] ],
	[ Button, [ 'Button', 'Widget' ] ],
	[ Separator, [ 'Separator', 'Widget' ] ],
	[ Slider, [ 'Slider', 'Widget' ] ],
	[ Progress, [ 'Progress', 'Widget' ] ],
	[ Tabs, [ 'Tabs', 'Widget' ] ],
	[ Tab, [ 'Tab', 'Widget' ] ],
	[ ListView, [ 'ListView', 'Widget' ] ],
	[ TreeView, [ 'TreeView', 'Widget' ] ],
] ) {
	_tagGuiType( klass, names );
}

module.exports = {
	Widget,
	Window,
	VBox,
	HBox,
	Frame,
	Label,
	Text,
	RichText,
	Image,
	Input,
	DatePicker,
	Checkbox,
	Radio,
	RadioGroup,
	Select,
	Menu,
	MenuItem,
	Button,
	Separator,
	Slider,
	Progress,
	Tabs,
	Tab,
	ListView,
	TreeView,
	Event,
	ListenerToken,
	meta,
	native_file_open: _nativeDialogue( 'fileOpen' ),
	native_file_save: _nativeDialogue( 'fileSave' ),
	native_directory_open: _nativeDialogue( 'directoryOpen' ),
	native_directory_save: _nativeDialogue( 'directorySave' ),
	native_alert: _nativeDialogue( 'alert' ),
	native_confirm: _nativeDialogue( 'confirm' ),
	native_prompt: _nativeDialogue( 'prompt' ),
	native_colour_picker: _nativeDialogue( 'colourPicker' ),
	__zuzu_set_runtime_policy( policy = {} ) {
		runtimePolicy = {
			...runtimePolicy,
			...policy,
		};
		meta.backend = runtimePolicy.host_name === 'browser'
			? 'browser-dom'
			: 'electron-dom';
	},
};
