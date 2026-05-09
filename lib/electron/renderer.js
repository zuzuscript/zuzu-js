'use strict';

const renderer = window.ZuzuGuiDomRenderer.createZuzuGuiDomRenderer( {
	rootId: 'app',
	sendEvent( payload ) {
		window.zuzuGui.sendEvent( payload );
	},
} );

window.zuzuGui.onRender( (payload) => {
	renderer.render( payload );
} );

window.zuzuGui.onCreate( (payload) => {
	renderer.create( payload );
} );

window.zuzuGui.onUpdate( (payload) => {
	renderer.update( payload );
} );

window.zuzuGui.onDestroy( (payload) => {
	renderer.destroy( payload );
} );
