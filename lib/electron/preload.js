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

installSafeDefineProperties();

const { contextBridge, ipcRenderer } = require( 'electron' );

contextBridge.exposeInMainWorld( 'zuzuGui', {
	onRender( handler ) {
		ipcRenderer.on( 'zuzu-gui:render', ( _event, payload ) => {
			handler( payload );
		} );
	},
	onCreate( handler ) {
		ipcRenderer.on( 'zuzu-gui:create', ( _event, payload ) => {
			handler( payload );
		} );
	},
	onUpdate( handler ) {
		ipcRenderer.on( 'zuzu-gui:update', ( _event, payload ) => {
			handler( payload );
		} );
	},
	onDestroy( handler ) {
		ipcRenderer.on( 'zuzu-gui:destroy', ( _event, payload ) => {
			handler( payload );
		} );
	},
	sendEvent( payload ) {
		ipcRenderer.send( 'zuzu-gui:event', payload );
	},
} );
