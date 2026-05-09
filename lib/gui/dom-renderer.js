'use strict';

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

let activeState = null;

function rendererState() {
	if ( !activeState ) {
		throw new Error( 'Zuzu GUI DOM renderer is not active' );
	}
	return activeState;
}

function rendererDocument() {
	const state = rendererState();
	return state.document || document;
}

function propValue( props, name, fallback = '' ) {
	return props && Object.prototype.hasOwnProperty.call( props, name )
		? props[name]
		: fallback;
}

function itemLabel( item ) {
	if ( item == null ) {
		return '';
	}
	if ( typeof item === 'string' || typeof item === 'number' ) {
		return String( item );
	}
	return String( item.label ?? item.value ?? '' );
}

function itemValue( item ) {
	if ( item == null ) {
		return '';
	}
	if ( typeof item === 'string' || typeof item === 'number' ) {
		return String( item );
	}
	return item.value ?? itemLabel( item );
}

function itemChildren( item ) {
	return Array.isArray( item && item.children ) ? item.children : [];
}

function pathKey( path ) {
	return Array.isArray( path ) ? path.map( Number ).join( ',' ) : '';
}

function sendWidgetEvent( type, node, extra = {} ) {
	const state = node.__zuzuRendererState || rendererState();
	if ( state.sendEvent ) {
		state.sendEvent( {
			windowId: state.windowId,
			type,
			widgetGuid: node.dataset.guid || null,
			...extra,
		} );
		return;
	}
	if ( !window.zuzuGui ) {
		return;
	}
	window.zuzuGui.sendEvent( {
		windowId: state.windowId,
		type,
		widgetGuid: node.dataset.guid || null,
		...extra,
	} );
}

function sendThrottledWidgetEvent( type, node, extraFactory ) {
	if ( node.__zuzuPendingEvent ) {
		node.__zuzuPendingEvent.extraFactory = extraFactory;
		return;
	}
	node.__zuzuPendingEvent = { extraFactory };
	setTimeout( () => {
		const pending = node.__zuzuPendingEvent;
		node.__zuzuPendingEvent = null;
		sendWidgetEvent( type, node, pending.extraFactory() );
	}, 50 );
}

function applyCommonProps( element, snapshot ) {
	const props = snapshot.props || {};
	element.dataset.guid = snapshot.guid || '';
	element.hidden = props.visible === false;
	element.className = '';
	if ( snapshot.classes && snapshot.classes.length > 0 ) {
		element.classList.add( ...snapshot.classes );
	}
	if ( snapshot.id ) {
		element.id = snapshot.id;
	}
	else {
		element.removeAttribute( 'id' );
	}
	if ( props.disabled ) {
		element.setAttribute( 'aria-disabled', 'true' );
		if ( 'disabled' in element ) {
			element.disabled = true;
		}
	}
	else {
		element.removeAttribute( 'aria-disabled' );
		if ( 'disabled' in element ) {
			element.disabled = false;
		}
	}
	for ( const [ key, cssName ] of [
		[ 'width', 'width' ],
		[ 'height', 'height' ],
		[ 'minwidth', 'minWidth' ],
		[ 'minheight', 'minHeight' ],
		[ 'maxwidth', 'maxWidth' ],
		[ 'maxheight', 'maxHeight' ],
	] ) {
		if ( props[key] != null && props[key] !== '' ) {
			element.style[cssName] = `${Number( props[key] ) || 0}px`;
		}
		else {
			element.style[cssName] = '';
		}
	}
}

function applyBoxStyle( element, snapshot ) {
	const props = snapshot.props || {};
	element.classList.add( snapshot.type === 'HBox' ? 'zuzu-hbox' : 'zuzu-vbox' );
	element.style.display = 'flex';
	element.style.flexDirection = snapshot.type === 'HBox' ? 'row' : 'column';
	if ( props.gap != null ) {
		element.style.gap = `${Number( props.gap ) || 0}px`;
	}
	if ( props.padding != null ) {
		element.style.padding = `${Number( props.padding ) || 0}px`;
	}
}

function applySpecificProps( element, snapshot ) {
	const type = snapshot.type || 'Widget';
	const props = snapshot.props || {};
	if ( type === 'Window' ) {
		return;
	}
	if ( type === 'Frame' ) {
		let legend = element.querySelector( ':scope > legend' );
		if ( !legend ) {
			legend = rendererDocument().createElement( 'legend' );
			element.prepend( legend );
		}
		legend.textContent = props.label || '';
		element.classList.toggle( 'zuzu-collapsed', props.collapsed === true );
		return;
	}
	if ( type === 'VBox' || type === 'HBox' ) {
		applyBoxStyle( element, snapshot );
		return;
	}
	if ( type === 'Label' ) {
		element.textContent = props.text || '';
		if ( props.for_id ) {
			element.htmlFor = props.for_id;
		}
		return;
	}
	if ( type === 'Text' ) {
		element.textContent = props.text || props.value || '';
		element.style.whiteSpace = props.wrap === false ? 'pre' : 'pre-wrap';
		return;
	}
	if ( type === 'RichText' ) {
		element.innerHTML = props.value || '';
		return;
	}
	if ( type === 'Image' ) {
		element.src = props.src || '';
		element.alt = props.alt || '';
		element.style.objectFit = props.fit === 'stretch' ? 'fill' : ( props.fit || 'contain' );
		return;
	}
	if ( type === 'Input' ) {
		setInputValue( element, props.value || '' );
		element.placeholder = props.placeholder || '';
		element.readOnly = props.readonly === true;
		element.required = props.required === true;
		if ( 'type' in element ) {
			element.type = props.password ? 'password' : 'text';
		}
		return;
	}
	if ( type === 'DatePicker' ) {
		setInputValue( element, props.value || '' );
		element.placeholder = 'YYYY-MM-DD';
		element.pattern = '\\d{4}-\\d{2}-\\d{2}';
		element.dataset.min = props.min || '';
		element.dataset.max = props.max || '';
		return;
	}
	if ( type === 'Checkbox' || type === 'Radio' ) {
		const input = element.querySelector( 'input' );
		const label = element.querySelector( 'span' );
		input.checked = props.checked === true;
		input.indeterminate = props.indeterminate === true;
		input.value = props.value || '';
		input.name = props.name || props.group || '';
		label.textContent = props.label || '';
		return;
	}
	if ( type === 'RadioGroup' ) {
		const radios = element.querySelectorAll( ':scope input[type="radio"]' );
		for ( const radio of radios ) {
			radio.name = snapshot.guid || '';
		}
		return;
	}
	if ( type === 'Select' ) {
		renderSelectOptions( element, props );
		element.value = props.value == null ? '' : String( props.value );
		element.multiple = props.multiple === true;
		return;
	}
	if ( type === 'Separator' ) {
		element.classList.toggle( 'zuzu-vertical-separator', props.orientation === 'vertical' );
		return;
	}
	if ( type === 'Slider' ) {
		setInputValue( element, props.value ?? 0 );
		element.min = props.min ?? 0;
		element.max = props.max ?? 100;
		element.step = props.step ?? 1;
		element.disabled = props.disabled === true || props.readonly === true;
		return;
	}
	if ( type === 'Progress' ) {
		element.value = Number( props.value ?? 0 );
		element.max = Number( props.max ?? 100 );
		element.classList.toggle( 'zuzu-indeterminate', props.indeterminate === true );
		element.title = props.show_text ? `${element.value} / ${element.max}` : '';
		return;
	}
	if ( type === 'Tabs' ) {
		element.dataset.selected = props.selected || '';
		for ( const child of Array.from( element.children ) ) {
			if ( child.__zuzuGuiType === 'Tab' ) {
				child.open = child.dataset.value === element.dataset.selected;
			}
		}
		return;
	}
	if ( type === 'Tab' ) {
		element.open = props.selected === true;
		element.dataset.value = props.value || '';
		element.querySelector( 'summary' ).textContent = props.title || props.value || '';
		return;
	}
	if ( type === 'ListView' ) {
		renderListView( element, props );
		return;
	}
	if ( type === 'TreeView' ) {
		renderTreeView( element, props );
		return;
	}
	if ( type === 'Menu' ) {
		let label = element.__zuzuMenuLabel;
		if ( !label ) {
			label = rendererDocument().createElement( 'span' );
			label.className = 'zuzu-menu-label';
			label.__zuzuRendererState = rendererState();
			element.__zuzuMenuLabel = label;
			element.insertBefore( label, element.children[0] || null );
		}
		label.textContent = props.text || '';
		return;
	}
	if ( type === 'Button' || type === 'MenuItem' ) {
		element.textContent = props.text || '';
	}
}

function setInputValue( element, value ) {
	const text = String( value ?? '' );
	if ( element.value === text ) {
		return;
	}
	const focused = rendererDocument().activeElement === element;
	const selectionStart = focused ? element.selectionStart : null;
	const selectionEnd = focused ? element.selectionEnd : null;
	element.value = text;
	if (
		focused
		&& typeof element.setSelectionRange === 'function'
		&& selectionStart != null
		&& selectionEnd != null
	) {
		const start = Math.min( selectionStart, text.length );
		const end = Math.min( selectionEnd, text.length );
		element.setSelectionRange( start, end );
	}
}

function createElement( snapshot ) {
	const type = snapshot.type || 'Widget';
	let element;

	if ( type === 'Window' ) {
		element = rendererDocument().createElement( 'main' );
	}
	else if ( type === 'Frame' ) {
		element = rendererDocument().createElement( 'fieldset' );
	}
	else if ( type === 'VBox' || type === 'HBox' ) {
		element = rendererDocument().createElement( 'div' );
	}
	else if ( type === 'Label' ) {
		element = rendererDocument().createElement( 'label' );
	}
	else if ( type === 'Text' || type === 'RichText' ) {
		element = rendererDocument().createElement( 'div' );
		element.addEventListener( 'click', () => {
			sendWidgetEvent( 'click', element );
		} );
	}
	else if ( type === 'Image' ) {
		element = rendererDocument().createElement( 'img' );
		element.addEventListener( 'click', () => {
			sendWidgetEvent( 'click', element );
		} );
	}
	else if ( type === 'Input' ) {
		element = snapshot.props && snapshot.props.multiline
			? rendererDocument().createElement( 'textarea' )
			: rendererDocument().createElement( 'input' );
		element.addEventListener( 'input', () => {
			sendWidgetEvent( 'input', element, { value: element.value } );
		} );
		element.addEventListener( 'change', () => {
			sendWidgetEvent( 'change', element, { value: element.value } );
		} );
	}
	else if ( type === 'DatePicker' ) {
		element = rendererDocument().createElement( 'input' );
		element.type = 'text';
		element.inputMode = 'numeric';
		element.autocomplete = 'off';
		element.addEventListener( 'input', () => {
			sendWidgetEvent( 'input', element, { value: element.value } );
		} );
		element.addEventListener( 'change', () => {
			sendWidgetEvent( 'change', element, { value: element.value } );
		} );
	}
	else if ( type === 'Checkbox' || type === 'Radio' ) {
		element = rendererDocument().createElement( 'label' );
		element.className = 'zuzu-check-control';
		const input = rendererDocument().createElement( 'input' );
		input.type = type === 'Radio' ? 'radio' : 'checkbox';
		const label = rendererDocument().createElement( 'span' );
		element.append( input, label );
		input.addEventListener( 'change', () => {
			const eventTarget = type === 'Radio' && element.dataset.parentGuid
				? element.dataset.parentGuid
				: element.dataset.guid;
			sendWidgetEvent( 'change', element, {
				widgetGuid: eventTarget,
				checked: input.checked,
				value: input.value,
			} );
		} );
	}
	else if ( type === 'Select' ) {
		element = rendererDocument().createElement( 'select' );
		element.addEventListener( 'change', () => {
			sendWidgetEvent( 'change', element, { value: element.value } );
		} );
	}
	else if ( type === 'Button' || type === 'MenuItem' ) {
		element = rendererDocument().createElement( 'button' );
		element.type = 'button';
		element.addEventListener( 'click', () => {
			sendWidgetEvent( 'click', element );
		} );
	}
	else if ( type === 'Menu' ) {
		element = rendererDocument().createElement( 'nav' );
	}
	else if ( type === 'Separator' ) {
		element = rendererDocument().createElement( 'hr' );
	}
	else if ( type === 'Slider' ) {
		element = rendererDocument().createElement( 'input' );
		element.type = 'range';
		element.addEventListener( 'input', () => {
			sendThrottledWidgetEvent( 'input', element, () => ( {
				value: Number( element.value ),
			} ) );
		} );
		element.addEventListener( 'change', () => {
			sendWidgetEvent( 'change', element, { value: Number( element.value ) } );
		} );
	}
	else if ( type === 'Progress' ) {
		element = rendererDocument().createElement( 'progress' );
	}
	else if ( type === 'Tabs' ) {
		element = rendererDocument().createElement( 'div' );
		element.className = 'zuzu-tabs';
	}
	else if ( type === 'Tab' ) {
		element = rendererDocument().createElement( 'details' );
		const summary = rendererDocument().createElement( 'summary' );
		element.appendChild( summary );
		summary.addEventListener( 'click', (event) => {
			event.preventDefault();
			const parent = element.parentNode;
			if ( parent ) {
				for ( const child of Array.from( parent.children ) ) {
					if ( child.__zuzuGuiType === 'Tab' ) {
						child.open = child === element;
					}
				}
			}
			element.open = true;
			sendWidgetEvent( 'select', element, {
				widgetGuid: element.dataset.parentGuid || element.dataset.guid,
				selected: element.dataset.value || '',
				value: element.dataset.value || '',
			} );
		} );
	}
	else if ( type === 'ListView' || type === 'TreeView' ) {
		element = rendererDocument().createElement( 'div' );
		element.tabIndex = 0;
	}
	else {
		element = rendererDocument().createElement( 'div' );
	}

	element.__zuzuRendererState = rendererState();
	element.__zuzuGuiType = type;
	element.__zuzuGuiSubType = type === 'Input' && snapshot.props && snapshot.props.multiline
		? 'multiline'
		: '';
	return element;
}

function renderNode( snapshot ) {
	const element = createElement( snapshot );
	applyCommonProps( element, snapshot );
	applySpecificProps( element, snapshot );
	rendererState().nodes.set( snapshot.guid, element );
	for ( const child of snapshot.children || [] ) {
		if (
			snapshot.type === 'Window'
			&& child.type === 'Menu'
			&& !rendererState().renderMenus
		) {
			continue;
		}
		const childElement = renderNode( child );
		childElement.dataset.parentGuid = snapshot.guid || '';
		if ( snapshot.type === 'RadioGroup' && child.type === 'Radio' ) {
			const radio = childElement.querySelector( 'input[type="radio"]' );
			if ( radio ) {
				radio.name = snapshot.guid || '';
			}
		}
		element.appendChild( childElement );
	}
	return element;
}

function renderSelectOptions( element, props ) {
	element.replaceChildren();
	for ( const item of props.options || [] ) {
		const option = rendererDocument().createElement( 'option' );
		option.textContent = itemLabel( item );
		option.value = String( itemValue( item ) );
		option.disabled = item && item.disabled === true;
		element.appendChild( option );
	}
}

function renderListView( element, props ) {
	element.classList.add( 'zuzu-listview' );
	element.replaceChildren();
	const list = rendererDocument().createElement( 'ul' );
	const selected = props.selected_index == null ? null : Number( props.selected_index );
	( props.items || [] ).forEach( (item, index) => {
		const row = rendererDocument().createElement( 'li' );
		row.textContent = itemLabel( item );
		row.dataset.index = String( index );
		row.classList.toggle( 'selected', index === selected );
		row.addEventListener( 'click', () => {
			markListSelected( element, index );
			sendWidgetEvent( 'select', element, { selected_index: index } );
		} );
		row.addEventListener( 'dblclick', () => {
			markListSelected( element, index );
			sendWidgetEvent( 'activate', element, { selected_index: index } );
		} );
		list.appendChild( row );
	} );
	element.appendChild( list );
}

function markListSelected( element, index ) {
	for ( const row of element.querySelectorAll( 'li' ) ) {
		row.classList.toggle( 'selected', Number( row.dataset.index ) === Number( index ) );
	}
}

function renderTreeView( element, props ) {
	element.classList.add( 'zuzu-treeview' );
	element.replaceChildren();
	const selected = pathKey( props.selected_path || [] );
	const expanded = new Set( ( props.expanded_paths || [] ).map( pathKey ) );
	element.appendChild( renderTreeItems( props.items || [], [], selected, expanded, element ) );
}

function renderTreeItems( items, prefix, selected, expanded, owner ) {
	const list = rendererDocument().createElement( 'ul' );
	items.forEach( (item, index) => {
		const path = [ ...prefix, index ];
		const key = pathKey( path );
		const children = itemChildren( item );
		const row = rendererDocument().createElement( 'li' );
		if ( children.length > 0 ) {
			const details = rendererDocument().createElement( 'details' );
			details.open = expanded.has( key );
			const summary = rendererDocument().createElement( 'summary' );
			summary.textContent = itemLabel( item );
			summary.dataset.path = key;
			summary.classList.toggle( 'selected', key === selected );
			summary.addEventListener( 'click', () => {
				markTreeSelected( owner, key );
				sendWidgetEvent( 'select', owner, { selected_path: path } );
			} );
			summary.addEventListener( 'dblclick', () => {
				markTreeSelected( owner, key );
				sendWidgetEvent( 'activate', owner, { selected_path: path } );
			} );
			details.addEventListener( 'toggle', () => {
				sendWidgetEvent( details.open ? 'expand' : 'collapse', owner, {
					selected_path: path,
				} );
			} );
			details.append( summary, renderTreeItems( children, path, selected, expanded, owner ) );
			row.appendChild( details );
		}
		else {
			const button = rendererDocument().createElement( 'button' );
			button.type = 'button';
			button.textContent = itemLabel( item );
			button.dataset.path = key;
			button.classList.toggle( 'selected', key === selected );
			button.addEventListener( 'click', () => {
				markTreeSelected( owner, key );
				sendWidgetEvent( 'select', owner, { selected_path: path } );
			} );
			button.addEventListener( 'dblclick', () => {
				markTreeSelected( owner, key );
				sendWidgetEvent( 'activate', owner, { selected_path: path } );
			} );
			row.appendChild( button );
		}
		list.appendChild( row );
	} );
	return list;
}

function markTreeSelected( element, key ) {
	for ( const node of element.querySelectorAll( '[data-path]' ) ) {
		node.classList.toggle( 'selected', node.dataset.path === key );
	}
}

function replaceNode( snapshot ) {
	const old = rendererState().nodes.get( snapshot.guid );
	if ( !old ) {
		return;
	}
	const parent = old.parentNode;
	const next = renderNode( snapshot );
	forgetNode( old );
	parent.replaceChild( next, old );
}

function forgetNode( node ) {
	const guid = node && node.dataset ? node.dataset.guid : null;
	if ( guid ) {
		rendererState().nodes.delete( guid );
	}
	for ( const child of Array.from( node.children || [] ) ) {
		forgetNode( child );
	}
}

function updateNode( snapshot ) {
	const element = rendererState().nodes.get( snapshot.guid );
	if ( !element ) {
		return;
	}
	if ( element.__zuzuGuiType !== ( snapshot.type || 'Widget' ) ) {
		replaceNode( snapshot );
		return;
	}
	if (
		element.__zuzuGuiType === 'Input'
		&& element.__zuzuGuiSubType !== (
			snapshot.props && snapshot.props.multiline ? 'multiline' : ''
		)
	) {
		replaceNode( snapshot );
		return;
	}
	applyCommonProps( element, snapshot );
	applySpecificProps( element, snapshot );
}

function createZuzuGuiDomRenderer( options = {} ) {
	installSafeDefineProperties();
	const doc = options.document
		|| ( options.root && options.root.ownerDocument )
		|| document;
	const root = options.root
		|| doc.getElementById( options.rootId || 'app' );
	if ( !root ) {
		throw new Error( 'Zuzu GUI DOM renderer requires a root element' );
	}
	const state = {
		document: doc,
		windowId: null,
		nodes: new Map(),
		root,
		sendEvent: typeof options.sendEvent === 'function'
			? options.sendEvent
			: null,
		renderMenus: options.renderMenus === true,
	};
	function withState( fn ) {
		const previous = activeState;
		activeState = state;
		try {
			return fn();
		}
		finally {
			activeState = previous;
		}
	}
	return {
		render( payload = {} ) {
			return withState( () => {
				state.windowId = payload.windowId;
				state.nodes.clear();
				root.replaceChildren( renderNode( payload.snapshot ) );
			} );
		},
		create( payload = {} ) {
			return withState( () => {
				if (
					payload.snapshot
					&& payload.snapshot.type === 'Menu'
					&& !state.renderMenus
				) {
					return;
				}
				const parent = state.nodes.get( payload.parentGuid );
				if ( !parent ) {
					return;
				}
				const node = renderNode( payload.snapshot );
				const index = Number.isInteger( payload.index ) ? payload.index : null;
				if ( index == null || index >= parent.children.length ) {
					parent.appendChild( node );
				}
				else {
					parent.insertBefore( node, parent.children[index] );
				}
			} );
		},
		update( payload = {} ) {
			return withState( () => {
				if ( !payload.snapshot ) {
					return;
				}
				if (
					(
						payload.snapshot.type === 'Menu'
						|| payload.snapshot.type === 'MenuItem'
					)
					&& !state.renderMenus
				) {
					return;
				}
				updateNode( payload.snapshot );
			} );
		},
		destroy( payload = {} ) {
			return withState( () => {
				const node = state.nodes.get( payload.widgetGuid );
				if ( node && node.parentNode ) {
					node.parentNode.removeChild( node );
				}
				if ( node ) {
					forgetNode( node );
				}
			} );
		},
		nodeForGuid( guid ) {
			return state.nodes.get( guid ) || null;
		},
	};
}

if ( typeof module !== 'undefined' && module.exports ) {
	module.exports = {
		createZuzuGuiDomRenderer,
	};
}

if ( typeof window !== 'undefined' ) {
	window.ZuzuGuiDomRenderer = {
		createZuzuGuiDomRenderer,
	};
}
