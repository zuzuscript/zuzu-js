'use strict';

function withLoc( node, start, end ) {
	return {
		...node,
		loc: {
			start: start ? {
				offset: start.start,
				line: start.line,
				column: start.column,
			} : null,
			end: end ? {
				offset: end.end,
				line: end.endLine,
				column: end.endColumn,
			} : null,
		},
	};
}

module.exports = {
	withLoc,
};
