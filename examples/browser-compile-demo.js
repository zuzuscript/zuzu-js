;(function () {
	'use strict';
	const root = typeof globalThis !== 'undefined' ? globalThis : this;
	root.__ZUZU_BROWSER_NO_AUTORUN__ = true;
}).call( this );
"use strict";
var ZuzuBrowser = (() => {
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __require = /* @__PURE__ */ ((x) => typeof require !== "undefined" ? require : typeof Proxy !== "undefined" ? new Proxy(x, {
    get: (a, b) => (typeof require !== "undefined" ? require : a)[b]
  }) : x)(function(x) {
    if (typeof require !== "undefined") return require.apply(this, arguments);
    throw Error('Dynamic require of "' + x + '" is not supported');
  });
  var __commonJS = (cb, mod) => function __require2() {
    return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
  };

  // extras/zuzu-js/modules/std/string.js
  var require_string = __commonJS({
    "extras/zuzu-js/modules/std/string.js"(exports, module) {
      "use strict";
      function toStringValue(value) {
        if (value instanceof RegExp) {
          return value.source;
        }
        if (value && typeof value.to_String === "function") {
          return String(value.to_String());
        }
        if (value instanceof Error) {
          return value.message || value.name || String(value);
        }
        return value == null ? "" : String(value);
      }
      function isRegexLike(value) {
        if (value == null) {
          return false;
        }
        if (value instanceof RegExp) {
          return true;
        }
        return Object.prototype.toString.call(value) === "[object RegExp]";
      }
      function index(text, needle, start = 0) {
        return toStringValue(text).indexOf(toStringValue(needle), Number(start ?? 0));
      }
      function rindex(text, needle, start = null) {
        const haystack = toStringValue(text);
        if (start == null) {
          return haystack.lastIndexOf(toStringValue(needle));
        }
        return haystack.lastIndexOf(toStringValue(needle), Number(start));
      }
      function substr(text, offset, length = null) {
        const from = Number(offset ?? 0);
        if (length == null) {
          return toStringValue(text).slice(from);
        }
        return toStringValue(text).slice(from, from + Number(length));
      }
      function pattern_to_regexp(pattern, caseInsensitive = false) {
        return new RegExp(String(pattern ?? ""), caseInsensitive ? "i" : "");
      }
      function normalizePattern(pattern, flags = "") {
        if (isRegexLike(pattern)) {
          const mergedFlags = [...pattern.flags || "", ...flags || ""];
          const uniqFlags = [...new Set(mergedFlags)].join("");
          return new RegExp(pattern.source, uniqFlags);
        }
        return new RegExp(String(pattern ?? ""), flags);
      }
      function search(text, pattern, flags = "") {
        const match = toStringValue(text).match(normalizePattern(pattern, flags));
        return match ? match[0] : null;
      }
      function replace(text, pattern, replacement, flags = "") {
        return toStringValue(text).replace(normalizePattern(pattern, flags), toStringValue(replacement));
      }
      function sprint(format, ...args) {
        let idx = 0;
        return toStringValue(format).replace(/%([0-9]+)?(?:\.([0-9]+))?([sdfc])/gu, (_token, width, precision, kind) => {
          const value = args[idx++];
          let out = "";
          if (kind === "d") {
            out = String(Math.trunc(Number(value ?? 0)));
          } else if (kind === "f") {
            const num = Number(value ?? 0);
            out = precision != null ? num.toFixed(Number(precision)) : String(num);
          } else if (kind === "c") {
            out = String.fromCharCode(Number(value ?? 0));
          } else {
            out = toStringValue(value);
          }
          if (width != null) {
            const target = Number(width);
            if (out.length < target) {
              out = `${" ".repeat(target - out.length)}${out}`;
            }
          }
          return out;
        });
      }
      function join(separator, values) {
        const sep = toStringValue(separator);
        if (Array.isArray(values)) {
          return values.map((value) => toStringValue(value)).join(sep);
        }
        if (values == null) {
          return "";
        }
        if (typeof values.to_Iterator === "function") {
          const out = [];
          for (const value of values.to_Iterator()) {
            out.push(toStringValue(value));
          }
          return out.join(sep);
        }
        if (typeof values.to_Array === "function") {
          return join(sep, values.to_Array());
        }
        if (typeof values[Symbol.iterator] === "function") {
          return Array.from(values, (value) => toStringValue(value)).join(sep);
        }
        return toStringValue(values);
      }
      function split(text, pattern) {
        return toStringValue(text).split(pattern);
      }
      function starts_with(text, prefix) {
        return toStringValue(text).startsWith(toStringValue(prefix)) ? 1 : 0;
      }
      function ends_with(text, suffix) {
        return toStringValue(text).endsWith(toStringValue(suffix)) ? 1 : 0;
      }
      function trim(text) {
        return toStringValue(text).trim();
      }
      function pad(text, width, ch = " ", side = "right") {
        const src = toStringValue(text);
        const padChar = toStringValue(ch || " ");
        const target = Number(width ?? 0);
        if (src.length >= target) {
          return src;
        }
        const fill = padChar.repeat(target - src.length);
        return side === "left" ? `${fill}${src}` : `${src}${fill}`;
      }
      function chomp(text) {
        return toStringValue(text).replace(/\r?\n$/u, "");
      }
      function words(text) {
        return toStringValue(text).replace(/([a-z0-9])([A-Z])/gu, "$1 $2").replace(/[_\-]+/gu, " ").trim().split(/\s+/u).filter(Boolean);
      }
      function title(text) {
        return words(text).map((w) => `${w[0].toUpperCase()}${w.slice(1).toLowerCase()}`).join(" ");
      }
      function snake(text) {
        return words(text).map((w) => w.toLowerCase()).join("_");
      }
      function kebab(text) {
        return words(text).map((w) => w.toLowerCase()).join("-");
      }
      function camel(text) {
        const ws = words(text).map((w) => w.toLowerCase());
        return ws.map((w, i) => i === 0 ? w : `${w[0].toUpperCase()}${w.slice(1)}`).join("");
      }
      module.exports = {
        camel,
        chomp,
        index,
        join,
        kebab,
        pad,
        pattern_to_regexp,
        rindex,
        replace,
        search,
        snake,
        split,
        starts_with,
        sprint,
        substr,
        title,
        trim,
        ends_with
      };
    }
  });

  // extras/zuzu-js/lib/collections.js
  var require_collections = __commonJS({
    "extras/zuzu-js/lib/collections.js"(exports, module) {
      "use strict";
      var ZuzuBag = class _ZuzuBag {
        constructor(...items) {
          if (items.length === 0) {
            this.items = [];
            return;
          }
          if (items.length > 1) {
            this.items = items.slice();
            return;
          }
          const first = items[0];
          if (Array.isArray(first)) {
            this.items = first.slice();
            return;
          }
          if (first != null && typeof first !== "string" && typeof first[Symbol.iterator] === "function") {
            this.items = Array.from(first);
            return;
          }
          this.items = [first];
        }
        length() {
          return this.items.length;
        }
        count(value) {
          if (arguments.length === 0) {
            return this.items.length;
          }
          return this.items.filter((item) => item === value).length;
        }
        empty() {
          return this.items.length === 0 ? 1 : 0;
        }
        is_empty() {
          return this.empty();
        }
        contains(value) {
          return this.items.includes(value) ? 1 : 0;
        }
        add(...values) {
          this.items.push(...values);
          return this;
        }
        push(...values) {
          return this.add(...values);
        }
        remove(value) {
          return this.remove_first(value);
        }
        remove_first(value) {
          const idx = this.items.indexOf(value);
          if (idx >= 0) {
            this.items.splice(idx, 1);
          }
          return this;
        }
        remove_if(fn) {
          this.items = this.items.filter((item) => !fn(item));
          return this;
        }
        get(idx, fallback = null) {
          return idx >= 0 && idx < this.items.length ? this.items[idx] : fallback;
        }
        map(fn) {
          return new _ZuzuBag(this.items.map(fn));
        }
        grep(fn) {
          return new _ZuzuBag(this.items.filter(fn));
        }
        any(fn) {
          return this.items.some(fn) ? 1 : 0;
        }
        all(fn) {
          return this.items.every(fn) ? 1 : 0;
        }
        first(fn) {
          for (const item of this.items) {
            if (fn(item)) {
              return item;
            }
          }
          return null;
        }
        for_each_value(fn) {
          this.items.forEach(fn);
          return this;
        }
        to_Array() {
          return this.items.slice();
        }
        to_Set() {
          return new Set(this.items);
        }
        to_Iterator() {
          return this.items[Symbol.iterator]();
        }
        uniq() {
          return new _ZuzuBag([...new Set(this.items)]);
        }
        sum() {
          return this.items.reduce((a, b) => Number(a) + Number(b), 0);
        }
        product() {
          return this.items.reduce((a, b) => Number(a) * Number(b), 1);
        }
        sort(fn) {
          return this.to_Array().sort(fn);
        }
        sortstr() {
          return this.to_Array().sort((a, b) => String(a).localeCompare(String(b)));
        }
        sortnum() {
          return this.to_Array().map((item) => Number(item)).sort((a, b) => a - b);
        }
        clear() {
          this.items = [];
          return this;
        }
        [Symbol.iterator]() {
          return this.items[Symbol.iterator]();
        }
      };
      var Pair = class {
        constructor(options = {}) {
          this.pair = options.pair || [];
        }
        get key() {
          return this.pair[0] ?? null;
        }
        set key(value) {
          this.pair[0] = value;
        }
        get value() {
          return this.pair[1] ?? null;
        }
        set value(value) {
          this.pair[1] = value;
        }
      };
      var PairList = class {
        constructor(...options) {
          this.list = [];
          if (options.length > 1) {
            this.list = options.filter((entry) => Array.isArray(entry) && entry.length >= 2).map((entry) => [String(entry[0]), entry[1]]);
            return;
          }
          const first = options.length === 0 ? {} : options[0];
          if (Array.isArray(first)) {
            this.list = first.slice();
            return;
          }
          if (Array.isArray(first.list)) {
            this.list = first.list.slice();
          }
          return new Proxy(this, {
            get(target, prop, receiver) {
              if (typeof prop === "symbol" || prop in target) {
                return Reflect.get(target, prop, receiver);
              }
              if (typeof prop === "string") {
                return target.get(prop, null);
              }
              return void 0;
            },
            set(target, prop, value, receiver) {
              if (typeof prop === "symbol" || prop in target) {
                return Reflect.set(target, prop, value, receiver);
              }
              if (typeof prop === "string") {
                const idx = target.list.findIndex((pair) => pair[0] === String(prop));
                if (idx >= 0) {
                  target.list[idx][1] = value;
                } else {
                  target.list.push([String(prop), value]);
                }
                return true;
              }
              return false;
            }
          });
        }
        length() {
          return this.list.length;
        }
        count() {
          return this.list.length;
        }
        empty() {
          return this.list.length === 0 ? 1 : 0;
        }
        keys() {
          return this.list.map((pair) => pair[0]);
        }
        values() {
          return this.list.map((pair) => pair[1]);
        }
        enumerate() {
          return this.to_Array();
        }
        has(key) {
          return this.list.some((pair) => pair[0] === String(key)) ? 1 : 0;
        }
        exists(key) {
          return this.has(key);
        }
        defined(key) {
          const found = this.list.find((pair) => pair[0] === String(key));
          return found ? found[1] == null ? 0 : 1 : 0;
        }
        get(key, fallback = null) {
          const found = this.list.find((pair) => pair[0] === String(key));
          return found ? found[1] : fallback;
        }
        get_all(key) {
          return this.list.filter((pair) => pair[0] === String(key)).map((pair) => pair[1]);
        }
        all(key) {
          return this.get_all(key);
        }
        add(key, value) {
          this.list.push([String(key), value]);
          return this;
        }
        set(key, value) {
          return this.add(key, value);
        }
        kv() {
          const out = [];
          for (const [key, value] of this.list) {
            out.push(key, value);
          }
          return out;
        }
        sorted_keys() {
          return this.keys().slice().sort();
        }
        remove(key) {
          if (typeof key === "function") {
            this.list = this.list.filter(
              (pair) => !key(new Pair({ pair: pair.slice() }))
            );
            return this;
          }
          const normalized = String(key);
          this.list = this.list.filter((pair) => pair[0] !== normalized);
          return this;
        }
        for_each_key(fn) {
          for (const key of this.keys()) {
            fn(key);
          }
          return this;
        }
        for_each_value(fn) {
          for (const value of this.values()) {
            fn(value);
          }
          return this;
        }
        for_each_pair(fn) {
          for (const pair of this.list) {
            fn(new Pair({ pair: pair.slice() }));
          }
          return this;
        }
        to_Array() {
          return this.list.map((pair) => new Pair({ pair: pair.slice() }));
        }
        to_Iterator() {
          return this.keys()[Symbol.iterator]();
        }
        clear() {
          this.list = [];
          return this;
        }
      };
      function withArrayMethods() {
        const define = (name, fn) => {
          if (!Object.prototype.hasOwnProperty.call(Array.prototype, name)) {
            Object.defineProperty(Array.prototype, name, { value: fn, enumerable: false });
          }
        };
        define("count", function _count() {
          return this.length;
        });
        define("empty", function _empty() {
          return this.length === 0 ? 1 : 0;
        });
        define("is_empty", function _is_empty() {
          return this.empty();
        });
        define("append", function _append(...values) {
          this.push(...values);
          return this;
        });
        define("add", function _add(...values) {
          this.push(...values);
          return this;
        });
        define("prepend", function _prepend(...values) {
          this.unshift(...values);
          return this;
        });
        define("get", function _get(idx, fallback = null) {
          return idx >= 0 && idx < this.length ? this[idx] : fallback;
        });
        define("set", function _set(idx, value) {
          this[idx] = value;
          return this;
        });
        define("grep", function _grep(fn) {
          return this.filter(fn);
        });
        define("any", function _any(fn) {
          return this.some(fn) ? 1 : 0;
        });
        define("all", function _all(fn) {
          return this.every(fn) ? 1 : 0;
        });
        define("first", function _first(fn) {
          return this.find(fn) ?? null;
        });
        define("remove", function _remove(fn) {
          for (let i = this.length - 1; i >= 0; i--) {
            if (fn(this[i])) {
              this.splice(i, 1);
            }
          }
          return this;
        });
        define("contains", function _contains(value) {
          return this.includes(value) ? 1 : 0;
        });
        define("first_index", function _first_index(fn) {
          return this.findIndex(fn);
        });
        define("reductions", function _reductions(fn) {
          const out = [];
          for (const item of this) {
            if (out.length === 0) {
              out.push(item);
            } else {
              out.push(fn(out[out.length - 1], item));
            }
          }
          return out;
        });
        define("head", function _head(n) {
          return this.slice(0, n);
        });
        define("tail", function _tail(n) {
          return this.slice(n - 1);
        });
        define("sum", function _sum() {
          return this.reduce((a, b) => Number(a) + Number(b), 0);
        });
        define("product", function _product() {
          return this.reduce((a, b) => Number(a) * Number(b), 1);
        });
        define("shuffle", function _shuffle() {
          return this.slice();
        });
        define("sample", function _sample(n) {
          return this.slice(0, n);
        });
        define("for_each_value", function _for_each_value(fn) {
          this.forEach(fn);
          return this;
        });
        define("sortstr", function _sortstr() {
          return this.slice().sort((a, b) => String(a).localeCompare(String(b)));
        });
        define(
          "sortnum",
          function _sortnum() {
            return this.map((item) => Number(item)).sort((a, b) => a - b);
          }
        );
        define("to_Array", function _to_array() {
          return this.slice();
        });
        define("to_Set", function _to_set() {
          return new Set(this);
        });
        define("to_Bag", function _to_bag() {
          return new ZuzuBag(this);
        });
        define("to_Iterator", function _to_iterator() {
          return this[Symbol.iterator]();
        });
        define("clear", function _clear() {
          this.splice(0, this.length);
          return this;
        });
      }
      module.exports = {
        ZuzuBag,
        Pair,
        PairList,
        withArrayMethods
      };
    }
  });

  // extras/zuzu-js/lib/runtime-helpers.js
  var require_runtime_helpers = __commonJS({
    "extras/zuzu-js/lib/runtime-helpers.js"(exports, module) {
      "use strict";
      var { ZuzuBag, Pair, PairList, withArrayMethods } = require_collections();
      var ZuzuBinary = class _ZuzuBinary {
        constructor(bytes = []) {
          if (bytes instanceof _ZuzuBinary) {
            this.bytes = new Uint8Array(bytes.bytes);
            return;
          }
          if (bytes instanceof Uint8Array) {
            this.bytes = new Uint8Array(bytes);
            return;
          }
          if (Array.isArray(bytes)) {
            this.bytes = Uint8Array.from(bytes.map((item) => Number(item) & 255));
            return;
          }
          this.bytes = new Uint8Array(0);
        }
        get length() {
          return this.bytes.length;
        }
        byteLength() {
          return this.bytes.length;
        }
        isAscii() {
          for (const byte of this.bytes) {
            if (byte > 127) {
              return 0;
            }
          }
          return 1;
        }
        slice(start, end) {
          return new _ZuzuBinary(this.bytes.slice(start, end));
        }
        at(index) {
          const idx = Number(index);
          if (idx < 0 || idx >= this.bytes.length) {
            return null;
          }
          return new _ZuzuBinary([this.bytes[idx]]);
        }
        to_String() {
          let out = "";
          for (const byte of this.bytes) {
            out += String.fromCharCode(byte);
          }
          return out;
        }
      };
      var BinaryString = class extends ZuzuBinary {
        constructor(bytes) {
          super(bytes);
        }
      };
      function isSetLike(value) {
        return Object.prototype.toString.call(value) === "[object Set]";
      }
      function collectTopLevelDeclarations(source, stripPod) {
        const stripped = stripPod(source);
        const masked = [];
        let depth = 0;
        let inSingle = false;
        let inDouble = false;
        let inBacktick = false;
        let inLineComment = false;
        let inBlockComment = false;
        let escape = false;
        for (let i = 0; i < stripped.length; i++) {
          const ch = stripped[i];
          const next = stripped[i + 1] || "";
          if (inLineComment) {
            if (ch === "\n") {
              inLineComment = false;
              masked.push("\n");
            } else {
              masked.push(" ");
            }
            continue;
          }
          if (inBlockComment) {
            if (ch === "*" && next === "/") {
              inBlockComment = false;
              masked.push(" ");
              i++;
              masked.push(" ");
              continue;
            }
            masked.push(ch === "\n" ? "\n" : " ");
            continue;
          }
          if (inSingle || inDouble || inBacktick) {
            if (escape) {
              escape = false;
              masked.push(" ");
              continue;
            }
            if (ch === "\\") {
              escape = true;
              masked.push(" ");
              continue;
            }
            if (inSingle && ch === "'") {
              inSingle = false;
            } else if (inDouble && ch === '"') {
              inDouble = false;
            } else if (inBacktick && ch === "`") {
              inBacktick = false;
            }
            masked.push(ch === "\n" ? "\n" : " ");
            continue;
          }
          if (ch === "/" && next === "/") {
            inLineComment = true;
            masked.push(" ");
            i++;
            masked.push(" ");
            continue;
          }
          if (ch === "/" && next === "*") {
            inBlockComment = true;
            masked.push(" ");
            i++;
            masked.push(" ");
            continue;
          }
          if (ch === "'") {
            inSingle = true;
            masked.push(" ");
            continue;
          }
          if (ch === '"') {
            inDouble = true;
            masked.push(" ");
            continue;
          }
          if (ch === "`") {
            inBacktick = true;
            masked.push(" ");
            continue;
          }
          if (ch === "{") {
            depth++;
            masked.push(" ");
            continue;
          }
          if (ch === "}") {
            if (depth > 0) {
              depth--;
            }
            masked.push(" ");
            continue;
          }
          masked.push(depth === 0 ? ch : ch === "\n" ? "\n" : " ");
        }
        const topLevel = masked.join("");
        const names = /* @__PURE__ */ new Set();
        const patterns = [
          /(?:^|[;\n])\s*(?:export\s+)?function\s+([A-Za-z_][A-Za-z0-9_]*)\s*(?:\(|\b)/gm,
          /(?:^|[;\n])\s*(?:export\s+)?fn\s+(?:[A-Za-z_][A-Za-z0-9_]*\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*(?:\(|\b)/gm,
          /(?:^|[;\n])\s*(?:export\s+)?class\s+([A-Za-z_][A-Za-z0-9_]*)\b/gm,
          /(?:^|[;\n])\s*(?:export\s+)?trait\s+([A-Za-z_][A-Za-z0-9_]*)\b/gm,
          /(?:^|[;\n])\s*(?:export\s+)?(?:let|const)\s+(?:[A-Za-z_][A-Za-z0-9_]*\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*(?::=|=|;)/gm
        ];
        for (const rx of patterns) {
          let match = rx.exec(topLevel);
          while (match) {
            names.add(match[1]);
            match = rx.exec(topLevel);
          }
        }
        return [...names];
      }
      function buildComparator(name) {
        if (name === "eq") {
          return (left, right) => String(left) === String(right);
        }
        if (name === "~") {
          return (left, right) => {
            if (right && typeof right.test === "function") {
              return right.test(String(left));
            }
            return false;
          };
        }
        return (left, right) => left == right;
      }
      function runSwitch(value, cmpName, cases, defaultBody) {
        const cmp = buildComparator(cmpName);
        let runNext = false;
        for (const section of cases) {
          const matched = section.values.some((item) => cmp(value, item));
          if (matched || runNext) {
            const result = section.body();
            runNext = result === true;
            if (!runNext && result && typeof result === "object" && result.__zuzu_return) {
              return result;
            }
            if (!runNext) {
              return;
            }
          }
        }
        if (defaultBody) {
          const result = defaultBody();
          if (result && typeof result === "object" && result.__zuzu_return) {
            return result;
          }
        }
      }
      function runMatch(left, right) {
        const normalize = (value) => {
          if (value == null) {
            return "";
          }
          if (value instanceof RegExp) {
            return value.source;
          }
          if (value instanceof Error || value && typeof value === "object" && typeof value.message === "string") {
            return value.message || value.name || String(value);
          }
          if (value && typeof value.to_String === "function") {
            return String(value.to_String());
          }
          return String(value);
        };
        if (right && typeof right.test === "function") {
          const flags = typeof right.flags === "string" ? right.flags : "";
          const clone = new RegExp(right.source || normalize(right), flags);
          const input = normalize(left);
          if (flags.includes("g")) {
            return [...input.matchAll(clone)];
          }
          const matched = input.match(clone);
          return matched || false;
        }
        if (right != null) {
          const input = normalize(left);
          const pattern = new RegExp(normalize(right));
          const matched = input.match(pattern);
          return matched || false;
        }
        return false;
      }
      function toArrayLike(value) {
        if (value instanceof ZuzuBag) {
          return value.to_Array();
        }
        if (isSetLike(value)) {
          return [...value];
        }
        if (Array.isArray(value)) {
          return value.slice();
        }
        if (value && typeof value === "object") {
          return Object.keys(value);
        }
        return [];
      }
      function contains(collection, item) {
        if (collection instanceof ZuzuBag) {
          return collection.contains(item);
        }
        if (isSetLike(collection)) {
          return collection.has(item) ? 1 : 0;
        }
        if (Array.isArray(collection)) {
          return collection.includes(item) ? 1 : 0;
        }
        if (collection && typeof collection === "object") {
          return Object.prototype.hasOwnProperty.call(collection, String(item)) ? 1 : 0;
        }
        return 0;
      }
      function makeLike(left, values) {
        if (left instanceof ZuzuBag) {
          return new ZuzuBag(values);
        }
        if (isSetLike(left)) {
          return new Set(values);
        }
        if (Array.isArray(left)) {
          return [...new Set(values)];
        }
        if (left && typeof left === "object") {
          const out = {};
          for (const key of values) {
            out[String(key)] = true;
          }
          Object.defineProperty(out, "contains", {
            value(key) {
              return Object.prototype.hasOwnProperty.call(out, String(key)) ? 1 : 0;
            },
            enumerable: false
          });
          return out;
        }
        return values;
      }
      function collectionUnion(left, right) {
        const merged = [...toArrayLike(left), ...toArrayLike(right)];
        const deduped = [...new Set(merged)];
        return makeLike(left, deduped);
      }
      function collectionIntersection(left, right) {
        const rightArr = toArrayLike(right);
        return makeLike(left, toArrayLike(left).filter((item) => rightArr.includes(item)));
      }
      function collectionDifference(left, right) {
        const rightArr = toArrayLike(right);
        return makeLike(left, toArrayLike(left).filter((item) => !rightArr.includes(item)));
      }
      function collectionSubsetOf(left, right) {
        const rightArr = toArrayLike(right);
        return toArrayLike(left).every((item) => rightArr.includes(item)) ? 1 : 0;
      }
      function collectionSupersetOf(left, right) {
        return collectionSubsetOf(right, left);
      }
      function collectionEquivalentOf(left, right) {
        return collectionSubsetOf(left, right) && collectionSubsetOf(right, left) ? 1 : 0;
      }
      function makeSet(values) {
        const set = new Set(values);
        if (typeof set.to_Iterator !== "function") {
          Object.defineProperty(set, "to_Iterator", {
            value() {
              return this.values();
            },
            enumerable: false
          });
        }
        return set;
      }
      function makeBag(values) {
        return new ZuzuBag(values);
      }
      function makePairList(entries = []) {
        return new PairList({ list: entries.map((entry) => [String(entry[0]), entry[1]]) });
      }
      function lengthOf(value) {
        if (value instanceof ZuzuBinary) {
          return value.byteLength();
        }
        if (value && value.bytes instanceof Uint8Array) {
          return value.bytes.length;
        }
        if (value instanceof PairList) {
          return value.length();
        }
        if (value instanceof ZuzuBag) {
          return value.length();
        }
        if (isSetLike(value)) {
          return value.size;
        }
        if (Array.isArray(value) || typeof value === "string") {
          return value.length;
        }
        if (value && typeof value === "object") {
          return Object.keys(value).length;
        }
        return 0;
      }
      module.exports = {
        collectTopLevelDeclarations,
        runSwitch,
        runMatch,
        toArrayLike,
        contains,
        collectionUnion,
        collectionIntersection,
        collectionDifference,
        collectionSubsetOf,
        collectionSupersetOf,
        collectionEquivalentOf,
        makeSet,
        makeBag,
        makePairList,
        lengthOf,
        ZuzuBinary,
        BinaryString,
        ZuzuBag,
        Pair,
        PairList,
        withArrayMethods
      };
    }
  });

  // extras/zuzu-js/modules/std/string/base64.js
  var require_base64 = __commonJS({
    "extras/zuzu-js/modules/std/string/base64.js"(exports, module) {
      "use strict";
      var { BinaryString } = require_runtime_helpers();
      function typeName(value) {
        if (value == null) {
          return "Null";
        }
        if (typeof value === "string") {
          return "String";
        }
        if (value.bytes instanceof Uint8Array) {
          return "BinaryString";
        }
        return value.constructor && value.constructor.name ? value.constructor.name : typeof value;
      }
      function encode(value) {
        if (!(value && value.bytes instanceof Uint8Array)) {
          throw new Error(`TypeException: encode expects BinaryString, got ${typeName(value)}`);
        }
        return Buffer.from(value.bytes).toString("base64");
      }
      function decode(value) {
        if (typeof value !== "string") {
          throw new Error(`TypeException: decode expects String, got ${typeName(value)}`);
        }
        return new BinaryString(Uint8Array.from(Buffer.from(value, "base64")));
      }
      function encode_urlsafe(value) {
        return encode(value).replace(/\+/gu, "-").replace(/\//gu, "_").replace(/=+$/gu, "");
      }
      function decode_urlsafe(value) {
        if (typeof value !== "string") {
          throw new Error(`TypeException: decode expects String, got ${typeName(value)}`);
        }
        let normalized = value.replace(/-/gu, "+").replace(/_/gu, "/");
        const mod = normalized.length % 4;
        if (mod !== 0) {
          normalized += "=".repeat(4 - mod);
        }
        return decode(normalized);
      }
      module.exports = {
        decode,
        decode_urlsafe,
        encode,
        encode_urlsafe
      };
    }
  });

  // extras/zuzu-js/modules/std/time.js
  var require_time = __commonJS({
    "extras/zuzu-js/modules/std/time.js"(exports, module) {
      "use strict";
      var Time = class _Time {
        constructor(epoch = null) {
          this._epoch = epoch == null ? Math.floor(Date.now() / 1e3) : Number(epoch);
        }
        _clone(nextEpoch) {
          return new _Time(nextEpoch);
        }
        epoch() {
          return this._epoch;
        }
        sec() {
          return new Date(this._epoch * 1e3).getUTCSeconds();
        }
        min() {
          return new Date(this._epoch * 1e3).getUTCMinutes();
        }
        hour() {
          return new Date(this._epoch * 1e3).getUTCHours();
        }
        day_of_month() {
          return new Date(this._epoch * 1e3).getUTCDate();
        }
        mon() {
          return new Date(this._epoch * 1e3).getUTCMonth() + 1;
        }
        month() {
          return this.mon();
        }
        year() {
          return new Date(this._epoch * 1e3).getUTCFullYear();
        }
        add_seconds(n) {
          return this._clone(this._epoch + Number(n));
        }
        add_minutes(n) {
          return this.add_seconds(Number(n) * 60);
        }
        add_hours(n) {
          return this.add_seconds(Number(n) * 3600);
        }
        add_days(n) {
          return this.add_seconds(Number(n) * 86400);
        }
        add_weeks(n) {
          return this.add_days(Number(n) * 7);
        }
        add_months(n) {
          const d = new Date(this._epoch * 1e3);
          d.setUTCMonth(d.getUTCMonth() + Number(n));
          return this._clone(Math.floor(d.getTime() / 1e3));
        }
        add_years(n) {
          const d = new Date(this._epoch * 1e3);
          d.setUTCFullYear(d.getUTCFullYear() + Number(n));
          return this._clone(Math.floor(d.getTime() / 1e3));
        }
      };
      var TimeParser = class {
        constructor(_fmt = "%Y-%m-%d") {
        }
        parse(text) {
          const m = String(text).match(/([0-9]{1,2})(?:st|nd|rd|th)\s+([A-Za-z]{3}),\s+([0-9]{4})/u);
          if (!m) {
            throw new Error("Exception: unable to parse time string");
          }
          const day = Number(m[1]);
          const monName = m[2].toLowerCase();
          const year = Number(m[3]);
          const months = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
          const mon = months.indexOf(monName);
          if (mon < 0) {
            throw new Error("Exception: unable to parse month");
          }
          const epoch = Math.floor(Date.UTC(year, mon, day, 0, 0, 0) / 1e3);
          return new Time(epoch);
        }
      };
      module.exports = {
        Time,
        TimeParser
      };
    }
  });

  // extras/zuzu-js/modules/std/data/json.js
  var require_json = __commonJS({
    "extras/zuzu-js/modules/std/data/json.js"(exports, module) {
      "use strict";
      var { Pair, PairList, ZuzuBag } = require_collections();
      var utf8Decoder = new TextDecoder("utf-8", { fatal: true });
      function _isPlainObject(value) {
        return value != null && typeof value === "object" && !Array.isArray(value) && !(value instanceof PairList) && !(value instanceof ZuzuBag) && Object.prototype.toString.call(value) !== "[object Set]";
      }
      function _isSet(value) {
        return Object.prototype.toString.call(value) === "[object Set]";
      }
      function _optionsObject(value) {
        if (value instanceof PairList) {
          const out = {};
          for (const [key, inner] of value.list) {
            out[String(key)] = inner;
          }
          return out;
        }
        if (_isPlainObject(value)) {
          return value;
        }
        return {};
      }
      function _decorateDict(value) {
        if (!_isPlainObject(value)) {
          return value;
        }
        const sortedKeys = () => Object.keys(value).sort();
        for (const [name, fn] of [
          ["length", function _length() {
            return Object.keys(this).length;
          }],
          ["count", function _count() {
            return Object.keys(this).length;
          }],
          ["empty", function _empty() {
            return Object.keys(this).length === 0 ? 1 : 0;
          }],
          ["keys", function _keys() {
            return new Set(sortedKeys());
          }],
          ["values", function _values() {
            return new ZuzuBag(sortedKeys().map((key) => this[key]));
          }],
          [
            "enumerate",
            function _enumerate() {
              return new ZuzuBag(
                sortedKeys().map(
                  (key) => new Pair({ pair: [key, this[key]] })
                )
              );
            }
          ],
          ["has", function _has(key) {
            return Object.prototype.hasOwnProperty.call(this, String(key)) ? 1 : 0;
          }],
          ["contains", function _contains(key) {
            return this.has(key);
          }],
          ["exists", function _exists(key) {
            return this.has(key);
          }],
          ["defined", function _defined(key) {
            return this.has(key) && this[String(key)] != null ? 1 : 0;
          }],
          ["get", function _get(key, fallback = null) {
            return this.has(key) ? this[String(key)] : fallback;
          }],
          ["add", function _add(key, inner) {
            this[String(key)] = inner;
            return this;
          }],
          ["set", function _set(key, inner) {
            return this.add(key, inner);
          }],
          [
            "kv",
            function _kv() {
              const out = [];
              for (const key of sortedKeys()) {
                out.push(key, this[key]);
              }
              return out;
            }
          ],
          ["sorted_keys", function _sorted_keys() {
            return sortedKeys();
          }],
          [
            "to_Array",
            function _to_array() {
              return sortedKeys().map(
                (key) => new Pair({ pair: [key, this[key]] })
              );
            }
          ],
          ["to_Iterator", function _to_iterator() {
            return sortedKeys()[Symbol.iterator]();
          }],
          [
            "for_each_key",
            function _for_each_key(fn2) {
              for (const key of sortedKeys()) {
                fn2(key);
              }
              return this;
            }
          ],
          [
            "for_each_value",
            function _for_each_value(fn2) {
              for (const key of sortedKeys()) {
                fn2(this[key]);
              }
              return this;
            }
          ],
          [
            "for_each_pair",
            function _for_each_pair(fn2) {
              for (const key of sortedKeys()) {
                fn2(new Pair({ pair: [key, this[key]] }));
              }
              return this;
            }
          ],
          [
            "remove",
            function _remove(key) {
              if (typeof key === "function") {
                for (const entryKey of Object.keys(this)) {
                  if (key(new Pair({ pair: [entryKey, this[entryKey]] }))) {
                    delete this[entryKey];
                  }
                }
                return this;
              }
              delete this[String(key)];
              return this;
            }
          ],
          [
            "clear",
            function _clear() {
              for (const key of Object.keys(this)) {
                delete this[key];
              }
              return this;
            }
          ]
        ]) {
          if (!Object.prototype.hasOwnProperty.call(value, name)) {
            Object.defineProperty(value, name, {
              value: fn,
              enumerable: false,
              configurable: true,
              writable: true
            });
          }
        }
        for (const key of Object.keys(value)) {
          value[key] = _decorateValue(value[key]);
        }
        return value;
      }
      function _decoratePairList(value) {
        if (!(value instanceof PairList)) {
          return value;
        }
        for (const [name, getter] of [
          ["keys", function _keys() {
            return value.list.map((pair) => pair[0]);
          }],
          ["values", function _values() {
            return value.list.map((pair) => pair[1]);
          }]
        ]) {
          if (!Object.prototype.hasOwnProperty.call(value, name)) {
            Object.defineProperty(value, name, {
              get: getter,
              enumerable: false,
              configurable: true
            });
          }
        }
        return value;
      }
      function _decorateArray(value) {
        if (!Array.isArray(value)) {
          return value;
        }
        for (let i = 0; i < value.length; i++) {
          value[i] = _decorateValue(value[i]);
        }
        return value;
      }
      function _decorateValue(value) {
        if (Array.isArray(value)) {
          return _decorateArray(value);
        }
        if (value instanceof PairList) {
          return _decoratePairList(value);
        }
        if (_isPlainObject(value)) {
          return _decorateDict(value);
        }
        return value;
      }
      function _sortCollectionValues(values) {
        return values.slice().sort((left, right) => String(left).localeCompare(String(right)));
      }
      function _collapsePairListEntries(entries) {
        const order = [];
        const values = /* @__PURE__ */ new Map();
        for (const [rawKey, entryValue] of entries) {
          const key = String(rawKey);
          if (!values.has(key)) {
            order.push(key);
          }
          values.set(key, entryValue);
        }
        return order.map((key) => [key, values.get(key)]);
      }
      function _objectEntriesForEncode(value, options) {
        if (value instanceof PairList) {
          const entries2 = value.list.map((pair) => [String(pair[0]), pair[1]]);
          if (options.pairlists) {
            return options.canonical ? entries2.slice().sort((left, right) => left[0].localeCompare(right[0])) : entries2;
          }
          value = Object.fromEntries(_collapsePairListEntries(entries2));
        }
        const entries = Object.keys(value).map((key) => [key, value[key]]);
        if (options.canonical) {
          entries.sort((left, right) => left[0].localeCompare(right[0]));
        }
        return entries;
      }
      function _encodeJson(value, options, depth = 0) {
        if (value == null) {
          return "null";
        }
        if (typeof value === "string") {
          return JSON.stringify(value);
        }
        if (typeof value === "number") {
          return Number.isFinite(value) ? String(value) : "null";
        }
        if (typeof value === "boolean") {
          return value ? "true" : "false";
        }
        if (Array.isArray(value)) {
          const items = value.map((item) => {
            const encoded = _encodeJson(item, options, depth + 1);
            return encoded === void 0 ? "null" : encoded;
          });
          if (!options.pretty) {
            return `[${items.join(",")}]`;
          }
          if (items.length === 0) {
            return "[]";
          }
          const indent = "	".repeat(depth);
          const inner = "	".repeat(depth + 1);
          return `[
${inner}${items.join(`,
${inner}`)}
${indent}]`;
        }
        if (value instanceof ZuzuBag) {
          return _encodeJson(_sortCollectionValues(value.items), options, depth);
        }
        if (_isSet(value)) {
          return _encodeJson(_sortCollectionValues([...value]), options, depth);
        }
        if (value instanceof PairList || _isPlainObject(value)) {
          const entries = _objectEntriesForEncode(value, options).map((pair) => [pair[0], _encodeJson(pair[1], options, depth + 1)]).filter((pair) => pair[1] !== void 0);
          if (!options.pretty) {
            return `{${entries.map((pair) => `${JSON.stringify(pair[0])}:${pair[1]}`).join(",")}}`;
          }
          if (entries.length === 0) {
            return "{}";
          }
          const indent = "	".repeat(depth);
          const inner = "	".repeat(depth + 1);
          return `{
${inner}${entries.map((pair) => `${JSON.stringify(pair[0])}: ${pair[1]}`).join(`,
${inner}`)}
${indent}}`;
        }
        if (typeof value.toJSON === "function") {
          return _encodeJson(value.toJSON(), options, depth);
        }
        return void 0;
      }
      function _parseJson(text, pairlists) {
        let index = 0;
        let source = "";
        if (text && text.bytes instanceof Uint8Array) {
          source = utf8Decoder.decode(text.bytes);
        } else {
          source = String(text ?? "");
        }
        function error(message) {
          throw new Error(`JSON.parse error at position ${index}: ${message}`);
        }
        function skipWhitespace() {
          while (index < source.length && /\s/u.test(source[index])) {
            index++;
          }
        }
        function parseString() {
          let out = "";
          index++;
          while (index < source.length) {
            const ch = source[index++];
            if (ch === '"') {
              return out;
            }
            if (ch !== "\\") {
              out += ch;
              continue;
            }
            if (index >= source.length) {
              error("unterminated escape sequence");
            }
            const esc = source[index++];
            if (esc === '"' || esc === "\\" || esc === "/") {
              out += esc;
              continue;
            }
            if (esc === "b") {
              out += "\b";
              continue;
            }
            if (esc === "f") {
              out += "\f";
              continue;
            }
            if (esc === "n") {
              out += "\n";
              continue;
            }
            if (esc === "r") {
              out += "\r";
              continue;
            }
            if (esc === "t") {
              out += "	";
              continue;
            }
            if (esc === "u") {
              const hex = source.slice(index, index + 4);
              if (!/^[0-9A-Fa-f]{4}$/u.test(hex)) {
                error("invalid unicode escape");
              }
              out += String.fromCharCode(Number.parseInt(hex, 16));
              index += 4;
              continue;
            }
            error(`invalid escape ${esc}`);
          }
          error("unterminated string literal");
        }
        function parseNumber() {
          const match = /^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/u.exec(source.slice(index));
          if (!match) {
            error("invalid number");
          }
          index += match[0].length;
          return Number(match[0]);
        }
        function parseLiteral(literal, value2) {
          if (source.slice(index, index + literal.length) !== literal) {
            error(`expected ${literal}`);
          }
          index += literal.length;
          return value2;
        }
        function parseArray() {
          index++;
          skipWhitespace();
          const out = [];
          if (source[index] === "]") {
            index++;
            return out;
          }
          while (index < source.length) {
            out.push(parseValue());
            skipWhitespace();
            if (source[index] === "]") {
              index++;
              return out;
            }
            if (source[index] !== ",") {
              error("expected , or ]");
            }
            index++;
            skipWhitespace();
          }
          error("unterminated array");
        }
        function parseObject() {
          index++;
          skipWhitespace();
          const entries = [];
          if (source[index] === "}") {
            index++;
            return pairlists ? _decoratePairList(new PairList()) : _decorateDict({});
          }
          while (index < source.length) {
            if (source[index] !== '"') {
              error("expected object key string");
            }
            const key = parseString();
            skipWhitespace();
            if (source[index] !== ":") {
              error("expected :");
            }
            index++;
            skipWhitespace();
            entries.push([key, parseValue()]);
            skipWhitespace();
            if (source[index] === "}") {
              index++;
              if (pairlists) {
                return _decoratePairList(new PairList({ list: entries }));
              }
              const out = {};
              for (const [entryKey, entryValue] of entries) {
                out[entryKey] = entryValue;
              }
              return _decorateDict(out);
            }
            if (source[index] !== ",") {
              error("expected , or }");
            }
            index++;
            skipWhitespace();
          }
          error("unterminated object");
        }
        function parseValue() {
          skipWhitespace();
          const ch = source[index];
          if (ch === '"') {
            return parseString();
          }
          if (ch === "[") {
            return parseArray();
          }
          if (ch === "{") {
            return parseObject();
          }
          if (ch === "t") {
            return parseLiteral("true", true);
          }
          if (ch === "f") {
            return parseLiteral("false", false);
          }
          if (ch === "n") {
            return parseLiteral("null", null);
          }
          return parseNumber();
        }
        const value = parseValue();
        skipWhitespace();
        if (index !== source.length) {
          error("unexpected trailing input");
        }
        return _decorateValue(value);
      }
      function _asPath(value, methodName) {
        if (value && typeof value.slurp_utf8 === "function" && typeof value.spew_utf8 === "function") {
          return value;
        }
        throw new Error(`TypeException: ${methodName} expects Path as first argument`);
      }
      var JSONCodec = class {
        constructor(options = {}, named = {}) {
          const merged = {
            ..._optionsObject(options),
            ..._optionsObject(named)
          };
          this.utf8 = Boolean(merged.utf8);
          this.pretty = Boolean(merged.pretty);
          this.canonical = Boolean(merged.canonical);
          this.pairlists = Boolean(merged.pairlists);
        }
        encode(value) {
          return _encodeJson(value, {
            canonical: this.canonical,
            pairlists: this.pairlists,
            pretty: this.pretty
          });
        }
        decode(text) {
          return _parseJson(text, this.pairlists);
        }
        load(pathObj) {
          const pathValue = _asPath(pathObj, "JSON.load");
          return this.decode(pathValue.slurp_utf8());
        }
        dump(pathObj, value) {
          const pathValue = _asPath(pathObj, "JSON.dump");
          pathValue.spew_utf8(this.encode(value));
          return pathObj;
        }
      };
      module.exports = {
        JSON: JSONCodec
      };
    }
  });

  // extras/zuzu-js/modules/std/data/xml.js
  var require_xml = __commonJS({
    "extras/zuzu-js/modules/std/data/xml.js"(exports, module) {
      "use strict";
      var XMLNS_NS = "http://www.w3.org/2000/xmlns/";
      var nextId = 1;
      var XMLNode = class {
        constructor(type, name = "", ownerDocument = null) {
          this._type = type;
          this._name = String(name || "");
          this._ownerDocument = ownerDocument;
          this._parent = null;
          this._children = [];
          this._attrs = [];
          this.unique_id = nextId++;
        }
        nodeType() {
          return String(this._type);
        }
        nodeName() {
          return this._name;
        }
        nodeValue() {
          return null;
        }
        data() {
          return this.nodeValue();
        }
        setData(value) {
          return this.setNodeValue(value);
        }
        nodeKind() {
          switch (this._type) {
            case 1:
              return "element";
            case 2:
              return "attr";
            case 3:
            case 4:
              return "text";
            case 8:
              return "comment";
            case 9:
              return "document";
            default:
              return "node";
          }
        }
        localName() {
          const idx = this._name.indexOf(":");
          return idx >= 0 ? this._name.slice(idx + 1) : this._name;
        }
        namespaceURI() {
          return null;
        }
        parentNode() {
          return this._parent;
        }
        ownerDocument() {
          return this._type === 9 ? this : this._ownerDocument;
        }
        childNodes() {
          return this._children.slice();
        }
        children() {
          return this._children.filter((node) => node._type === 1);
        }
        hasChildNodes() {
          return this._children.length > 0 ? 1 : 0;
        }
        firstChild() {
          return this._children[0] || null;
        }
        lastChild() {
          return this._children[this._children.length - 1] || null;
        }
        get nextSibling() {
          if (!this._parent) {
            return null;
          }
          const siblings = this._parent._children;
          const idx = siblings.indexOf(this);
          return idx >= 0 ? siblings[idx + 1] || null : null;
        }
        get previousSibling() {
          if (!this._parent) {
            return null;
          }
          const siblings = this._parent._children;
          const idx = siblings.indexOf(this);
          return idx > 0 ? siblings[idx - 1] : null;
        }
        textContent() {
          if (this._type === 3 || this._type === 4 || this._type === 8 || this._type === 2) {
            return this.nodeValue() || "";
          }
          return this._children.map((child) => child.textContent()).join("");
        }
        setTextContent(value) {
          this._children = [];
          this.appendChild(this.ownerDocument().createTextNode(value));
          return this;
        }
        appendChild(node) {
          attachNode(this, node, this._children.length);
          return node;
        }
        prependChild(node) {
          attachNode(this, node, 0);
          return node;
        }
        insertBefore(newNode, refNode) {
          const idx = this._children.indexOf(refNode);
          attachNode(this, newNode, idx >= 0 ? idx : this._children.length);
          return newNode;
        }
        replaceChild(newNode, oldNode) {
          const idx = this._children.indexOf(oldNode);
          if (idx < 0) {
            return null;
          }
          if (newNode._parent) {
            newNode._parent.removeChild(newNode);
          }
          oldNode._parent = null;
          newNode._parent = this;
          newNode._ownerDocument = this.ownerDocument();
          this._children[idx] = newNode;
          return oldNode;
        }
        removeChild(childNode) {
          const idx = this._children.indexOf(childNode);
          if (idx >= 0) {
            this._children.splice(idx, 1);
            childNode._parent = null;
          }
          return childNode;
        }
        remove() {
          if (this._parent) {
            this._parent.removeChild(this);
          }
          return this;
        }
        cloneNode(deep = false) {
          const clone = cloneXmlNode(this, this.ownerDocument(), Boolean(deep));
          return clone;
        }
        normalize() {
          return this;
        }
        isSameNode(other) {
          return other === this ? 1 : 0;
        }
        isEqualNode(other) {
          return xmlEqual(this, other) ? 1 : 0;
        }
        contains(other) {
          let cur = other;
          while (cur) {
            if (cur === this) {
              return 1;
            }
            cur = cur.parentNode ? cur.parentNode() : null;
          }
          return 0;
        }
        visitEach(fn) {
          forEachXmlNode(this, fn);
          return this;
        }
        findFirst(fn) {
          for (const child of this._children) {
            if (fn(child)) {
              return child;
            }
            const nested = child.findFirst(fn);
            if (nested) {
              return nested;
            }
          }
          return null;
        }
        findnodes(xpath) {
          return evaluateSimpleXPath(this, String(xpath || ""));
        }
        findvalue(xpath) {
          return evaluateXPathValue(this, String(xpath || ""));
        }
        querySelectorAll(selector) {
          return querySelectorAllFrom(this, selector);
        }
        querySelector(selector) {
          return this.querySelectorAll(selector)[0] || null;
        }
        getElementsByTagName(name) {
          return getElementsByTagNameFrom(this, name);
        }
        toXML(pretty = false) {
          return serializeNode(this, { pretty: Boolean(pretty) });
        }
        to_String() {
          return this.toXML(false);
        }
        uniqueKey() {
          return String(this.unique_id);
        }
        unique_id() {
          return this.uniqueKey();
        }
      };
      var XMLAttr = class extends XMLNode {
        constructor(name, value, namespaceURI, ownerDocument) {
          super(2, name, ownerDocument);
          this._value = String(value ?? "");
          this._namespaceURI = namespaceURI || null;
        }
        nodeValue() {
          return this._value;
        }
        setNodeValue(value) {
          this._value = String(value ?? "");
          return this;
        }
        namespaceURI() {
          return this._namespaceURI;
        }
        textContent() {
          return this._value;
        }
        toXML() {
          return escapeAttr(this._value);
        }
      };
      var XMLText = class extends XMLNode {
        constructor(value, ownerDocument) {
          super(3, "#text", ownerDocument);
          this._value = String(value ?? "");
        }
        nodeValue() {
          return this._value;
        }
        setNodeValue(value) {
          this._value = String(value ?? "");
          return this;
        }
        textContent() {
          return this._value;
        }
      };
      var XMLCData = class extends XMLText {
        constructor(value, ownerDocument) {
          super(value, ownerDocument);
          this._type = 4;
        }
      };
      var XMLComment = class extends XMLNode {
        constructor(value, ownerDocument) {
          super(8, "#comment", ownerDocument);
          this._value = String(value ?? "");
        }
        nodeValue() {
          return this._value;
        }
        setNodeValue(value) {
          this._value = String(value ?? "");
          return this;
        }
        textContent() {
          return this._value;
        }
      };
      var XMLElement = class extends XMLNode {
        constructor(name, namespaceURI, nsMap, ownerDocument) {
          super(1, name, ownerDocument);
          this._namespaceURI = namespaceURI || null;
          this._nsMap = { ...nsMap || {} };
        }
        namespaceURI() {
          return this._namespaceURI;
        }
        tagName() {
          return this.nodeName();
        }
        id() {
          return this.getAttribute("id");
        }
        setId(value) {
          return this.setAttribute("id", value);
        }
        getAttribute(name) {
          const attr = this._attrs.find((item) => item.nodeName() === String(name));
          return attr ? attr.nodeValue() : null;
        }
        setAttribute(name, value) {
          const key = String(name);
          let attr = this._attrs.find((item) => item.nodeName() === key);
          if (!attr) {
            attr = new XMLAttr(key, value, resolveAttrNamespace(key, this._nsMap), this.ownerDocument());
            attr._parent = this;
            this._attrs.push(attr);
          }
          attr.setNodeValue(value);
          if (key === "xmlns" || key.startsWith("xmlns:")) {
            const nsKey = key === "xmlns" ? "" : key.slice(6);
            this._nsMap[nsKey] = String(value ?? "");
            attr._namespaceURI = XMLNS_NS;
          }
          return this;
        }
        hasAttribute(name) {
          return this.getAttribute(name) != null ? 1 : 0;
        }
        removeAttribute(name) {
          const key = String(name);
          this._attrs = this._attrs.filter((item) => item.nodeName() !== key);
          return this;
        }
        attributeNames() {
          return this._attrs.map((item) => item.nodeName());
        }
        attributes() {
          return this._attrs.slice();
        }
      };
      var XMLDocument = class extends XMLNode {
        constructor() {
          super(9, "#document", null);
          this._ownerDocument = this;
        }
        documentElement() {
          return this._children.find((child) => child._type === 1) || null;
        }
        createElement(name) {
          return new XMLElement(String(name || ""), null, {}, this);
        }
        createTextNode(text) {
          return new XMLText(text, this);
        }
        createComment(text) {
          return new XMLComment(text, this);
        }
        createCDATASection(text) {
          return new XMLCData(text, this);
        }
        getElementsByTagName(name) {
          return getElementsByTagNameFrom(this, name);
        }
        getElementById(id) {
          return this.findFirst((node) => node._type === 1 && node.getAttribute && node.getAttribute("id") === String(id));
        }
      };
      function attachNode(parent, node, index, replacing = false) {
        if (!node) {
          return;
        }
        if (node._parent) {
          node._parent.removeChild(node);
        }
        node._parent = parent;
        node._ownerDocument = parent.ownerDocument();
        parent._children.splice(index, replacing ? 1 : 0, node);
      }
      function cloneXmlNode(node, ownerDocument, deep) {
        let clone;
        if (node._type === 9) {
          clone = new XMLDocument();
        } else if (node._type === 1) {
          clone = new XMLElement(node.nodeName(), node.namespaceURI(), node._nsMap, ownerDocument);
          for (const attr of node.attributes()) {
            clone.setAttribute(attr.nodeName(), attr.nodeValue());
          }
        } else if (node._type === 2) {
          clone = new XMLAttr(node.nodeName(), node.nodeValue(), node.namespaceURI(), ownerDocument);
        } else if (node._type === 4) {
          clone = new XMLCData(node.nodeValue(), ownerDocument);
        } else if (node._type === 8) {
          clone = new XMLComment(node.nodeValue(), ownerDocument);
        } else {
          clone = new XMLText(node.nodeValue(), ownerDocument);
        }
        if (deep) {
          for (const child of node.childNodes()) {
            clone.appendChild(cloneXmlNode(child, ownerDocument, true));
          }
        }
        return clone;
      }
      function xmlEqual(left, right) {
        if (!left || !right || left.nodeType() !== right.nodeType() || left.nodeName() !== right.nodeName()) {
          return false;
        }
        if (left.nodeValue() !== right.nodeValue()) {
          return false;
        }
        if (left._type === 1) {
          const leftAttrs = left.attributes();
          const rightAttrs = right.attributes();
          if (leftAttrs.length !== rightAttrs.length) {
            return false;
          }
          for (let i = 0; i < leftAttrs.length; i++) {
            if (leftAttrs[i].nodeName() !== rightAttrs[i].nodeName() || leftAttrs[i].nodeValue() !== rightAttrs[i].nodeValue()) {
              return false;
            }
          }
        }
        const leftKids = left.childNodes();
        const rightKids = right.childNodes();
        if (leftKids.length !== rightKids.length) {
          return false;
        }
        for (let i = 0; i < leftKids.length; i++) {
          if (!xmlEqual(leftKids[i], rightKids[i])) {
            return false;
          }
        }
        return true;
      }
      function forEachXmlNode(node, fn) {
        fn(node);
        for (const child of node.childNodes()) {
          forEachXmlNode(child, fn);
        }
      }
      function getElementsByTagNameFrom(node, name) {
        const needle = String(name || "");
        const out = [];
        forEachXmlNode(node, (child) => {
          if (child !== node && child._type === 1 && child.nodeName() === needle) {
            out.push(child);
          }
        });
        return out;
      }
      function querySelectorAllFrom(node, selector) {
        const text = String(selector || "").trim();
        if (text === "") {
          return [];
        }
        if (text.startsWith(".")) {
          const klass = text.slice(1);
          const out = [];
          forEachXmlNode(node, (child) => {
            if (child !== node && child._type === 1) {
              const className = child.getAttribute("class");
              if (className && className.split(/\s+/u).includes(klass)) {
                out.push(child);
              }
            }
          });
          return out;
        }
        return getElementsByTagNameFrom(node, text);
      }
      function evaluateXPathValue(node, expr) {
        const text = expr.trim();
        if (text.startsWith("count(") && text.endsWith(")")) {
          return String(evaluateSimpleXPath(node, text.slice(6, -1)).length);
        }
        if (text.startsWith("name(") && text.endsWith(")")) {
          const found2 = evaluateSimpleXPath(node, text.slice(5, -1))[0] || null;
          return found2 ? found2.nodeName() : "";
        }
        const found = evaluateSimpleXPath(node, text)[0] || null;
        if (!found) {
          return "";
        }
        if (found._type === 2) {
          return found.nodeValue();
        }
        return found.textContent();
      }
      function evaluateSimpleXPath(startNode, expr) {
        const text = String(expr || "").trim();
        if (text === "") {
          return [];
        }
        let current = [];
        let path = text;
        if (path.startsWith("/")) {
          const doc = startNode.nodeType && startNode._type === 9 ? startNode : startNode.ownerDocument();
          const root = doc && doc.documentElement ? doc.documentElement() : null;
          current = root ? [root] : [];
          path = path.slice(1);
          if (path.startsWith(current[0]?.nodeName() || "")) {
            const rootName = current[0].nodeName();
            if (path === rootName) {
              return current;
            }
            if (path.startsWith(`${rootName}/`)) {
              path = path.slice(rootName.length + 1);
            }
          }
        } else {
          current = startNode.nodeType && startNode._type === 9 ? startNode.documentElement() ? [startNode.documentElement()] : [] : [startNode];
        }
        if (path === "") {
          return current;
        }
        const segments = splitXPathSegments(path);
        for (const segment of segments) {
          current = stepXPath(current, segment);
        }
        return current;
      }
      function splitXPathSegments(path) {
        const out = [];
        let depth = 0;
        let start = 0;
        for (let i = 0; i < path.length; i++) {
          const ch = path[i];
          if (ch === "[") {
            depth++;
          } else if (ch === "]") {
            depth = Math.max(0, depth - 1);
          } else if (ch === "/" && depth === 0) {
            out.push(path.slice(start, i));
            start = i + 1;
          }
        }
        out.push(path.slice(start));
        return out.filter(Boolean);
      }
      function stepXPath(nodes, rawSegment) {
        const match = rawSegment.match(/^(.*?)((?:\[[^\]]+\])*)$/u);
        const base = match ? match[1] : rawSegment;
        const predicates = match && match[2] ? [...match[2].matchAll(/\[([^\]]+)\]/gu)].map((item) => item[1].trim()) : [];
        let next = [];
        for (const node of nodes) {
          next.push(...selectXPathChildren(node, base.trim()));
        }
        for (const predicate of predicates) {
          next = applyXPathPredicate(next, predicate);
        }
        return next;
      }
      function selectXPathChildren(node, segment) {
        if (segment === "*") {
          return node.children ? node.children() : [];
        }
        if (segment === "@*") {
          return node.attributes ? node.attributes() : [];
        }
        if (segment.startsWith("@")) {
          const needle = segment.slice(1);
          return (node.attributes ? node.attributes() : []).filter((attr) => attr.nodeName() === needle);
        }
        return (node.children ? node.children() : []).filter((child) => child.nodeName() === segment);
      }
      function applyXPathPredicate(nodes, predicate) {
        if (/^\d+$/u.test(predicate)) {
          const index = Number(predicate) - 1;
          return index >= 0 && index < nodes.length ? [nodes[index]] : [];
        }
        const attrEq = predicate.match(/^@([^=\s]+)\s*=\s*['"]([^'"]*)['"]$/u);
        if (attrEq) {
          return nodes.filter((node) => node.getAttribute && node.getAttribute(attrEq[1]) === attrEq[2]);
        }
        return nodes;
      }
      function escapeText(text) {
        return String(text ?? "").replace(/&/gu, "&amp;").replace(/</gu, "&lt;").replace(/>/gu, "&gt;");
      }
      function escapeAttr(text) {
        return escapeText(text).replace(/"/gu, "&quot;").replace(/'/gu, "&apos;");
      }
      function serializeNode(node, options = {}, depth = 0) {
        if (node._type === 9) {
          return node.childNodes().map((child) => serializeNode(child, options, depth)).join("");
        }
        if (node._type === 2) {
          return `${node.nodeName()}="${escapeAttr(node.nodeValue())}"`;
        }
        if (node._type === 3) {
          return escapeText(node.nodeValue());
        }
        if (node._type === 4) {
          return `<![CDATA[${node.nodeValue()}]]>`;
        }
        if (node._type === 8) {
          return `<!--${node.nodeValue()}-->`;
        }
        const attrs = node.attributes().map((attr) => serializeNode(attr, options, depth)).join(" ");
        const open = attrs ? `<${node.nodeName()} ${attrs}>` : `<${node.nodeName()}>`;
        const children = node.childNodes();
        if (children.length === 0) {
          return attrs ? `<${node.nodeName()} ${attrs}/>` : `<${node.nodeName()}/>`;
        }
        const body = children.map((child) => serializeNode(child, options, depth + 1)).join("");
        return `${open}${body}</${node.nodeName()}>`;
      }
      function parseAttributes(text, nsMap, ownerDocument) {
        const attrs = [];
        const attrRx = /([A-Za-z_][A-Za-z0-9_.:-]*)\s*=\s*("([^"]*)"|'([^']*)')/gu;
        for (const match of text.matchAll(attrRx)) {
          const name = match[1];
          const value = match[3] ?? match[4] ?? "";
          if (name === "xmlns" || name.startsWith("xmlns:")) {
            const key = name === "xmlns" ? "" : name.slice(6);
            nsMap[key] = value;
            attrs.push(new XMLAttr(name, value, XMLNS_NS, ownerDocument));
            continue;
          }
          attrs.push(new XMLAttr(name, value, resolveAttrNamespace(name, nsMap), ownerDocument));
        }
        return attrs;
      }
      function resolveElementNamespace(name, nsMap) {
        const idx = String(name).indexOf(":");
        if (idx < 0) {
          return nsMap[""] || null;
        }
        return nsMap[String(name).slice(0, idx)] || null;
      }
      function resolveAttrNamespace(name, nsMap) {
        const idx = String(name).indexOf(":");
        if (idx < 0) {
          return null;
        }
        return nsMap[String(name).slice(0, idx)] || null;
      }
      function parseXml(text) {
        const source = String(text ?? "");
        const doc = new XMLDocument();
        const stack = [doc];
        let i = 0;
        while (i < source.length) {
          if (source.startsWith("<!--", i)) {
            const end = source.indexOf("-->", i + 4);
            const comment = doc.createComment(source.slice(i + 4, end));
            stack[stack.length - 1].appendChild(comment);
            i = end + 3;
            continue;
          }
          if (source.startsWith("<![CDATA[", i)) {
            const end = source.indexOf("]]>", i + 9);
            const cdata = doc.createCDATASection(source.slice(i + 9, end));
            stack[stack.length - 1].appendChild(cdata);
            i = end + 3;
            continue;
          }
          if (source.startsWith("<?", i)) {
            const end = source.indexOf("?>", i + 2);
            i = end + 2;
            continue;
          }
          if (source[i] === "<" && source[i + 1] === "/") {
            const end = source.indexOf(">", i + 2);
            stack.pop();
            i = end + 1;
            continue;
          }
          if (source[i] === "<") {
            const end = source.indexOf(">", i + 1);
            let inner = source.slice(i + 1, end).trim();
            const selfClosing = inner.endsWith("/");
            if (selfClosing) {
              inner = inner.slice(0, -1).trim();
            }
            const nameMatch = inner.match(/^([A-Za-z_][A-Za-z0-9_.:-]*)/u);
            const name = nameMatch ? nameMatch[1] : "";
            const parent = stack[stack.length - 1];
            const nsMap = parent._type === 1 ? { ...parent._nsMap } : {};
            const attrs = parseAttributes(inner.slice(name.length), nsMap, doc);
            const elem = new XMLElement(name, resolveElementNamespace(name, nsMap), nsMap, doc);
            for (const attr of attrs) {
              attr._parent = elem;
              elem._attrs.push(attr);
            }
            parent.appendChild(elem);
            if (!selfClosing) {
              stack.push(elem);
            }
            i = end + 1;
            continue;
          }
          const next = source.indexOf("<", i);
          const textChunk = source.slice(i, next < 0 ? source.length : next);
          if (textChunk.trim() !== "") {
            stack[stack.length - 1].appendChild(doc.createTextNode(textChunk));
          }
          i = next < 0 ? source.length : next;
        }
        return doc;
      }
      var XML = {
        parse(text) {
          return parseXml(text);
        },
        load(pathValue) {
          if (!pathValue || pathValue.constructor?.name !== "Path" || typeof pathValue.slurp_utf8 !== "function") {
            throw new Error("TypeException: XML.load expects Path as first argument");
          }
          return parseXml(pathValue.slurp_utf8());
        },
        dump(pathValue, value, pretty = false) {
          if (!pathValue || pathValue.constructor?.name !== "Path" || typeof pathValue.spew_utf8 !== "function") {
            throw new Error("TypeException: XML.dump expects Path as first argument");
          }
          const xml = value && typeof value.toXML === "function" ? value.toXML(pretty) : String(value ?? "");
          pathValue.spew_utf8(xml);
          return pathValue;
        }
      };
      module.exports = {
        XML
      };
    }
  });

  // extras/zuzu-js/modules/std/net/http.js
  var require_http = __commonJS({
    "extras/zuzu-js/modules/std/net/http.js"(exports, module) {
      "use strict";
      var nodeSpawnSync;
      var nodeSpawnLoaded = false;
      function _nodeSpawnSync() {
        if (nodeSpawnLoaded) {
          return nodeSpawnSync;
        }
        nodeSpawnLoaded = true;
        if (typeof __require !== "function") {
          nodeSpawnSync = null;
          return nodeSpawnSync;
        }
        try {
          nodeSpawnSync = __require("node:child_process").spawnSync;
        } catch (_err) {
          nodeSpawnSync = null;
        }
        return nodeSpawnSync;
      }
      function _toDict(value) {
        if (value == null) {
          return {};
        }
        if (typeof value !== "object" || Array.isArray(value)) {
          return {};
        }
        return { ...value };
      }
      function _urlWithQuery(url, query) {
        const queryMap = _toDict(query);
        const keys = Object.keys(queryMap);
        if (keys.length === 0) {
          return String(url);
        }
        const usp = new URLSearchParams();
        for (const key of keys.sort()) {
          usp.set(key, queryMap[key] == null ? "" : String(queryMap[key]));
        }
        const base = String(url);
        return `${base}${base.includes("?") ? "&" : "?"}${usp.toString()}`;
      }
      var CookieJar = class {
        constructor() {
          this._cookies = /* @__PURE__ */ new Map();
        }
        add(setCookie, url) {
          this._cookies.set(String(url ?? ""), String(setCookie ?? ""));
          return this;
        }
        cookie_header(url) {
          return this._cookies.get(String(url ?? "")) ?? null;
        }
        clear() {
          this._cookies.clear();
          return this;
        }
      };
      var Response = class {
        constructor(payload) {
          this._payload = payload;
        }
        status() {
          return this._payload.status;
        }
        reason() {
          return this._payload.reason;
        }
        url() {
          return this._payload.url;
        }
        content() {
          return this._payload.content;
        }
        headers() {
          return { ...this._payload.headers };
        }
        header(name) {
          return this._payload.headers[String(name).toLowerCase()] ?? null;
        }
        success() {
          return this._payload.success ? 1 : 0;
        }
        json() {
          return JSON.parse(this._payload.content || "");
        }
        expect_success() {
          if (this.success()) {
            return this;
          }
          throw new Error(`HTTP request failed with status ${this.status()}`);
        }
        to_Dict() {
          return {
            status: this.status(),
            reason: this.reason(),
            url: this.url(),
            content: this.content(),
            headers: this.headers(),
            success: this.success()
          };
        }
      };
      var Request = class {
        constructor(method, url) {
          this._spec = {
            method: String(method || "GET").toUpperCase(),
            url: String(url || ""),
            headers: {}
          };
        }
        method(value) {
          this._spec.method = String(value).toUpperCase();
          return this;
        }
        url(value) {
          this._spec.url = String(value);
          return this;
        }
        header(name, value) {
          this._spec.headers[String(name).toLowerCase()] = String(value);
          return this;
        }
        headers(value) {
          for (const [key, item] of Object.entries(_toDict(value))) {
            this.header(key, item);
          }
          return this;
        }
        query(value) {
          this._spec.query = _toDict(value);
          return this;
        }
        body(value) {
          this._spec.body = value == null ? "" : String(value);
          return this;
        }
        json(value) {
          this._spec.json = value;
          this._spec.headers["content-type"] = this._spec.headers["content-type"] || "application/json";
          return this;
        }
        auth_bearer(token) {
          return this.header("authorization", `Bearer ${token}`);
        }
        timeout(value) {
          this._spec.timeout = Number(value);
          return this;
        }
        retries(value) {
          this._spec.retries = Number(value);
          return this;
        }
        download_to(value) {
          this._spec.download_to = String(value);
          return this;
        }
        upload_from(value) {
          this._spec.upload_from = String(value);
          return this;
        }
        multipart(value) {
          this._spec.multipart = _toDict(value);
          return this;
        }
        send(ua) {
          if (!(ua instanceof UserAgent)) {
            throw new Error("Request.send expects a UserAgent");
          }
          return ua.send(this);
        }
      };
      function _curlRequest(spec, uaConfig) {
        const spawnSync = _nodeSpawnSync();
        if (!spawnSync) {
          throw new Error("Exception: curl transport is unavailable");
        }
        const method = String(spec.method || "GET").toUpperCase();
        const target = _urlWithQuery(spec.url, spec.query);
        const args = ["-sS", "-i", "-X", method, target];
        const headers = { ..._toDict(uaConfig.default_headers), ..._toDict(spec.headers) };
        if (uaConfig.agent) {
          headers["user-agent"] = String(uaConfig.agent);
        }
        if (uaConfig.cookie_jar && typeof uaConfig.cookie_jar.cookie_header === "function") {
          const cookie = uaConfig.cookie_jar.cookie_header(target);
          if (cookie) {
            headers.cookie = cookie;
          }
        }
        for (const [name, value] of Object.entries(headers)) {
          args.push("-H", `${name}: ${String(value)}`);
        }
        if (spec.json !== void 0) {
          args.push("--data", JSON.stringify(spec.json));
        } else if (spec.body !== void 0) {
          args.push("--data", String(spec.body));
        }
        const spawned = spawnSync("curl", args, { encoding: "utf8" });
        if (spawned.error) {
          throw spawned.error;
        }
        const raw = String(spawned.stdout || "");
        const split = raw.split(/\r?\n\r?\n/u);
        const headerText = split.shift() || "";
        const body = split.join("\n\n");
        const headerLines = headerText.split(/\r?\n/u);
        const statusLine = headerLines.shift() || "HTTP/1.1 599 Request Failed";
        const statusMatch = statusLine.match(/^HTTP\/\d(?:\.\d)?\s+(\d+)(?:\s+(.*))?$/u);
        const status = statusMatch ? Number(statusMatch[1]) : 599;
        const reason = statusMatch ? statusMatch[2] || "" : "Request Failed";
        const outHeaders = {};
        for (const line of headerLines) {
          const idx = line.indexOf(":");
          if (idx < 0) {
            continue;
          }
          outHeaders[line.slice(0, idx).trim().toLowerCase()] = line.slice(idx + 1).trim();
        }
        if (outHeaders["set-cookie"] && uaConfig.cookie_jar && typeof uaConfig.cookie_jar.add === "function") {
          uaConfig.cookie_jar.add(outHeaders["set-cookie"], target);
        }
        return new Response({
          status,
          reason,
          url: target,
          content: body,
          headers: outHeaders,
          success: status >= 200 && status < 300
        });
      }
      async function _fetchRequest(spec, uaConfig) {
        if (typeof fetch !== "function") {
          throw new Error("Exception: fetch transport is unavailable");
        }
        const method = String(spec.method || "GET").toUpperCase();
        const target = _urlWithQuery(spec.url, spec.query);
        const headers = { ..._toDict(uaConfig.default_headers), ..._toDict(spec.headers) };
        if (uaConfig.agent) {
          headers["user-agent"] = String(uaConfig.agent);
        }
        if (uaConfig.cookie_jar && typeof uaConfig.cookie_jar.cookie_header === "function") {
          const cookie = uaConfig.cookie_jar.cookie_header(target);
          if (cookie) {
            headers.cookie = cookie;
          }
        }
        const fetchOptions = {
          method,
          headers
        };
        if (spec.json !== void 0) {
          headers["content-type"] = headers["content-type"] || "application/json";
          fetchOptions.body = JSON.stringify(spec.json);
        } else if (spec.body !== void 0) {
          fetchOptions.body = String(spec.body);
        }
        const response = await fetch(target, fetchOptions);
        const outHeaders = {};
        if (response.headers && typeof response.headers.forEach === "function") {
          response.headers.forEach((value, key) => {
            outHeaders[String(key).toLowerCase()] = String(value);
          });
        }
        if (outHeaders["set-cookie"] && uaConfig.cookie_jar && typeof uaConfig.cookie_jar.add === "function") {
          uaConfig.cookie_jar.add(outHeaders["set-cookie"], target);
        }
        return new Response({
          status: response.status,
          reason: response.statusText || "",
          url: response.url || target,
          content: await response.text(),
          headers: outHeaders,
          success: response.ok
        });
      }
      var UserAgent = class {
        constructor(options = {}, named = {}) {
          this._config = { ..._toDict(options), ..._toDict(named) };
        }
        build_request(method, url) {
          return new Request(method, url);
        }
        send(request) {
          if (!(request instanceof Request)) {
            throw new Error("UserAgent.send expects a Request");
          }
          if (!_nodeSpawnSync() && typeof fetch === "function") {
            return _fetchRequest(request._spec, this._config);
          }
          return _curlRequest(request._spec, this._config);
        }
        request(method, url, data, headers) {
          const req = this.build_request(method, url);
          if (method === "POST" || method === "PUT" || method === "PATCH") {
            if (data !== void 0) {
              req.body(data);
            }
            if (headers !== void 0) {
              req.headers(headers);
            }
          } else {
            if (data !== void 0) {
              req.headers(data);
            }
          }
          return this.send(req);
        }
        get(url, headers) {
          return this.request("GET", url, headers);
        }
        head(url, headers) {
          return this.request("HEAD", url, headers);
        }
        delete(url, headers) {
          return this.request("DELETE", url, headers);
        }
        options(url, headers) {
          return this.request("OPTIONS", url, headers);
        }
        post(url, data, headers) {
          return this.request("POST", url, data, headers);
        }
        put(url, data, headers) {
          return this.request("PUT", url, data, headers);
        }
        patch(url, data, headers) {
          return this.request("PATCH", url, data, headers);
        }
      };
      module.exports = {
        CookieJar,
        Request,
        Response,
        UserAgent
      };
    }
  });

  // extras/zuzu-js/modules/std/math.js
  var require_math = __commonJS({
    "extras/zuzu-js/modules/std/math.js"(exports, module) {
      "use strict";
      var PI = Math.PI;
      function normalizeNumberArgs(values) {
        if (values.length === 1 && Array.isArray(values[0])) {
          return values[0];
        }
        return values;
      }
      var ZMath = {
        pi: PI,
        sin(value) {
          return Math.sin(Number(value ?? 0));
        },
        cos(value) {
          return Math.cos(Number(value ?? 0));
        },
        tan(value) {
          return Math.tan(Number(value ?? 0));
        },
        asin(value) {
          return Math.asin(Number(value ?? 0));
        },
        acos(value) {
          return Math.acos(Number(value ?? 0));
        },
        atan(value) {
          return Math.atan(Number(value ?? 0));
        },
        atan2(y, x) {
          return Math.atan2(Number(y ?? 0), Number(x ?? 0));
        },
        pow(base, exp) {
          return Math.pow(Number(base ?? 0), Number(exp ?? 0));
        },
        exp(value) {
          return Math.exp(Number(value ?? 0));
        },
        log(value) {
          return Math.log(Number(value ?? 0));
        },
        log10(value) {
          return Math.log10(Number(value ?? 0));
        },
        min(...values) {
          return Math.min(...normalizeNumberArgs(values).map(Number));
        },
        max(...values) {
          return Math.max(...normalizeNumberArgs(values).map(Number));
        },
        sum(...values) {
          return normalizeNumberArgs(values).map(Number).reduce((acc, v) => acc + v, 0);
        },
        clamp(value, low, high) {
          return Math.min(Number(high ?? 0), Math.max(Number(low ?? 0), Number(value ?? 0)));
        },
        hypot(...values) {
          return Math.hypot(...values.map(Number));
        },
        deg2rad(degrees) {
          return Number(degrees ?? 0) * (PI / 180);
        },
        rad2deg(radians) {
          return Number(radians ?? 0) * (180 / PI);
        },
        rand() {
          return Math.random();
        },
        hex2dec(value) {
          return convertBase(value, 16, 10);
        },
        hex2oct(value) {
          return convertBase(value, 16, 8);
        },
        hex2bin(value) {
          return convertBase(value, 16, 2);
        },
        dec2hex(value) {
          return convertBase(value, 10, 16);
        },
        dec2oct(value) {
          return convertBase(value, 10, 8);
        },
        dec2bin(value) {
          return convertBase(value, 10, 2);
        },
        oct2hex(value) {
          return convertBase(value, 8, 16);
        },
        oct2dec(value) {
          return convertBase(value, 8, 10);
        },
        oct2bin(value) {
          return convertBase(value, 8, 2);
        },
        bin2hex(value) {
          return convertBase(value, 2, 16);
        },
        bin2dec(value) {
          return convertBase(value, 2, 10);
        },
        bin2oct(value) {
          return convertBase(value, 2, 8);
        }
      };
      function normalizeDigits(value, base) {
        let text = String(value ?? "").trim().toLowerCase();
        if (base === 16) {
          text = text.replace(/^0x/u, "");
        } else if (base === 8) {
          text = text.replace(/^0o/u, "");
        } else if (base === 2) {
          text = text.replace(/^0b/u, "");
        }
        return text;
      }
      function convertBase(value, fromBase, toBase) {
        const text = normalizeDigits(value, fromBase);
        if (text === "") {
          return "0";
        }
        const num = Number.parseInt(text, fromBase);
        if (Number.isNaN(num)) {
          return "0";
        }
        return num.toString(toBase);
      }
      module.exports = {
        Math: ZMath,
        pi: PI,
        \u03C0: PI
      };
    }
  });

  // extras/zuzu-js/modules/std/eval.js
  var require_eval = __commonJS({
    "extras/zuzu-js/modules/std/eval.js"(exports, module) {
      "use strict";
      function evalZuzu(code) {
        const src = String(code ?? "");
        return (0, eval)(src);
      }
      module.exports = {
        eval: evalZuzu
      };
    }
  });

  // extras/zuzu-js/lib/execution-metadata.js
  var require_execution_metadata = __commonJS({
    "extras/zuzu-js/lib/execution-metadata.js"(exports, module) {
      "use strict";
      var compiledSources = /* @__PURE__ */ new Map();
      function setCompiledSource(filename, source) {
        if (typeof filename === "string" && typeof source === "string") {
          compiledSources.set(filename, source);
        }
      }
      function getCompiledSource(filename) {
        return compiledSources.get(filename) || null;
      }
      module.exports = {
        getCompiledSource,
        setCompiledSource
      };
    }
  });

  // extras/zuzu-js/modules/std/internals.js
  var require_internals = __commonJS({
    "extras/zuzu-js/modules/std/internals.js"(exports, module) {
      "use strict";
      var { getCompiledSource } = require_execution_metadata();
      var frameProps = /* @__PURE__ */ new Map();
      var refIds = /* @__PURE__ */ new WeakMap();
      var scopeTrees = /* @__PURE__ */ new Map();
      var refSeq = 1;
      var nodeFs;
      var nodeFsLoaded = false;
      function _nodeFs() {
        if (nodeFsLoaded) {
          return nodeFs;
        }
        nodeFsLoaded = true;
        if (typeof __require !== "function") {
          nodeFs = null;
          return nodeFs;
        }
        try {
          nodeFs = __require("node:fs");
        } catch (_err) {
          nodeFs = null;
        }
        return nodeFs;
      }
      function parseUserFrames() {
        const lines = String(new Error().stack || "").split("\n").slice(1);
        const frames = [];
        for (const line of lines) {
          const trimmed = line.trim();
          let match = trimmed.match(/^at\s+(.*?)\s+\((.+):(\d+):(\d+)\)$/);
          if (!match) {
            match = trimmed.match(/^at\s+(.+):(\d+):(\d+)$/);
            if (match) {
              match = [match[0], "", match[1], match[2], match[3]];
            }
          }
          if (!match) {
            continue;
          }
          const file = match[2];
          if (file === __filename || file.startsWith("node:") || file === "[stdin]") {
            continue;
          }
          frames.push({
            func: match[1] || "",
            file,
            line: Number(match[3]),
            col: Number(match[4])
          });
        }
        return frames;
      }
      function loadScopeTree(file) {
        if (scopeTrees.has(file)) {
          return scopeTrees.get(file);
        }
        let source = "";
        const compiled = getCompiledSource(file);
        if (compiled != null) {
          source = compiled;
        } else try {
          const fs = _nodeFs();
          if (!fs) {
            throw new Error("fs unavailable");
          }
          source = fs.readFileSync(file, "utf8");
        } catch (_err) {
          const fallback = {
            nodes: [{ id: 0, parent: null, startLine: 1, endLine: Number.MAX_SAFE_INTEGER }]
          };
          scopeTrees.set(file, fallback);
          return fallback;
        }
        const nodes = [
          { id: 0, parent: null, startLine: 1, endLine: Number.MAX_SAFE_INTEGER }
        ];
        const stack = [0];
        let line = 1;
        let mode = "code";
        let quote = "";
        let escaped = false;
        let atLineStart = true;
        let inPod = false;
        for (let i = 0; i < source.length; i++) {
          const ch = source[i];
          const next = source[i + 1] || "";
          if (ch === "\n") {
            line++;
            atLineStart = true;
            if (mode === "line-comment") {
              mode = "code";
            }
            continue;
          }
          if (inPod) {
            if (atLineStart && ch === "=") {
              const end = source.indexOf("\n", i);
              const rest = source.slice(i, end === -1 ? source.length : end);
              if (/^=cut\b/.test(rest)) {
                inPod = false;
              }
            }
            atLineStart = false;
            continue;
          }
          if (atLineStart && ch === "=") {
            const end = source.indexOf("\n", i);
            const rest = source.slice(i, end === -1 ? source.length : end);
            if (/^=\w+/.test(rest) && !/^=cut\b/.test(rest)) {
              inPod = true;
              atLineStart = false;
              continue;
            }
          }
          atLineStart = false;
          if (mode === "line-comment") {
            continue;
          }
          if (mode === "block-comment") {
            if (ch === "*" && next === "/") {
              mode = "code";
              i++;
            }
            continue;
          }
          if (mode === "string") {
            if (escaped) {
              escaped = false;
              continue;
            }
            if (ch === "\\") {
              escaped = true;
              continue;
            }
            if (ch === quote) {
              mode = "code";
            }
            continue;
          }
          if (ch === "/" && next === "/") {
            mode = "line-comment";
            i++;
            continue;
          }
          if (ch === "/" && next === "*") {
            mode = "block-comment";
            i++;
            continue;
          }
          if (ch === '"' || ch === "'" || ch === "`") {
            mode = "string";
            quote = ch;
            escaped = false;
            continue;
          }
          if (ch === "{") {
            const id = nodes.length;
            nodes.push({
              id,
              parent: stack[stack.length - 1],
              startLine: line,
              endLine: Number.MAX_SAFE_INTEGER
            });
            stack.push(id);
            continue;
          }
          if (ch === "}" && stack.length > 1) {
            const id = stack.pop();
            nodes[id].endLine = line;
          }
        }
        const tree = { nodes };
        scopeTrees.set(file, tree);
        return tree;
      }
      function scopePathForLocation(file, line) {
        const tree = loadScopeTree(file);
        let current = 0;
        let found = true;
        while (found) {
          found = false;
          for (let i = tree.nodes.length - 1; i >= 1; i--) {
            const node = tree.nodes[i];
            if (node.parent !== current) {
              continue;
            }
            if (node.startLine <= line && line <= node.endLine) {
              current = node.id;
              found = true;
              break;
            }
          }
        }
        const path = [];
        let nodeId = current;
        while (nodeId != null) {
          path.push(nodeId);
          nodeId = tree.nodes[nodeId].parent;
        }
        return path;
      }
      function contextAtDepth(depth = 0) {
        const frames = parseUserFrames();
        const frame = frames[depth];
        if (!frame) {
          return null;
        }
        const caller = frames[depth + 1] || null;
        const activationKey = frame.func ? `fn:${frame.file}:${frame.func}<-${caller ? `${caller.file}:${caller.line}:${caller.col}` : "<top>"}` : `top:${frame.file}`;
        return {
          activationKey,
          scopePath: scopePathForLocation(frame.file, Math.max(1, frame.line))
        };
      }
      function ensureFrame(activationKey, scopeId) {
        const key = `${activationKey}#${scopeId}`;
        if (!frameProps.has(key)) {
          frameProps.set(key, /* @__PURE__ */ new Map());
        }
        return frameProps.get(key);
      }
      function getFrame(activationKey, scopeId) {
        return frameProps.get(`${activationKey}#${scopeId}`);
      }
      function class_name(value) {
        if (value == null || typeof value !== "object") {
          return null;
        }
        return value.constructor && value.constructor.name ? value.constructor.name : null;
      }
      function object_slots(value) {
        if (value == null || typeof value !== "object") {
          return null;
        }
        const out = {};
        for (const key of Object.keys(value)) {
          if (!key.startsWith("_")) {
            out[key] = value[key];
          }
        }
        Object.defineProperty(
          out,
          "get",
          {
            value(key) {
              const id = String(key);
              return Object.prototype.hasOwnProperty.call(out, id) ? out[id] : null;
            },
            enumerable: false
          }
        );
        Object.defineProperty(
          out,
          "keys",
          {
            value() {
              return Object.keys(out);
            },
            enumerable: false
          }
        );
        Object.defineProperty(
          out,
          "sorted_keys",
          {
            value() {
              return Object.keys(out).sort();
            },
            enumerable: false
          }
        );
        return out;
      }
      function ansi_esc() {
        return "\x1B";
      }
      function ref_id(value) {
        if (value == null || typeof value !== "object" && typeof value !== "function") {
          return null;
        }
        if (!refIds.has(value)) {
          refIds.set(value, `ref:${refSeq++}`);
        }
        return refIds.get(value);
      }
      function validateKey(key) {
        if (typeof key !== "string") {
          throw new Error("getprop|setprop key must be String");
        }
      }
      function setprop(key, value) {
        validateKey(key);
        const ctx = contextAtDepth(0);
        if (!ctx) {
          return value;
        }
        ensureFrame(ctx.activationKey, ctx.scopePath[0]).set(key, value);
        return value;
      }
      function getprop(key) {
        validateKey(key);
        const ctx = contextAtDepth(0);
        if (!ctx) {
          return null;
        }
        for (const scopeId of ctx.scopePath) {
          const frame = getFrame(ctx.activationKey, scopeId);
          if (frame && frame.has(key)) {
            return frame.get(key);
          }
        }
        return null;
      }
      function setupperprop(level, key, value) {
        validateKey(key);
        const ctx = contextAtDepth(Number(level ?? 0));
        if (!ctx) {
          return value;
        }
        ensureFrame(ctx.activationKey, ctx.scopePath[0]).set(key, value);
        return value;
      }
      function getupperprop(level, key) {
        validateKey(key);
        const ctx = contextAtDepth(Number(level ?? 0));
        if (!ctx) {
          return null;
        }
        for (const scopeId of ctx.scopePath) {
          const frame = getFrame(ctx.activationKey, scopeId);
          if (frame && frame.has(key)) {
            return frame.get(key);
          }
        }
        return null;
      }
      module.exports = {
        ansi_esc,
        class_name,
        getprop,
        getupperprop,
        object_slots,
        ref_id,
        setprop,
        setupperprop
      };
    }
  });

  // extras/zuzu-js/modules/std/net/url.js
  var require_url = __commonJS({
    "extras/zuzu-js/modules/std/net/url.js"(exports, module) {
      "use strict";
      function _str(value, fallback = "") {
        if (value == null) {
          return fallback;
        }
        return String(value);
      }
      function _dict(source = {}) {
        const out = { ...source };
        Object.defineProperties(out, {
          has: {
            value(key) {
              return Object.prototype.hasOwnProperty.call(out, String(key)) ? 1 : 0;
            },
            enumerable: false
          },
          exists: {
            value(key) {
              return out.has(key);
            },
            enumerable: false
          },
          get: {
            value(key, fallback = null) {
              return out.has(key) ? out[String(key)] : fallback;
            },
            enumerable: false
          }
        });
        return out;
      }
      function escape(value) {
        return encodeURIComponent(_str(value));
      }
      function unescape(value) {
        return decodeURIComponent(_str(value));
      }
      function parse(value) {
        const urlText = _str(value);
        const parsed = new URL(urlText, "http://localhost");
        const out = _dict({
          url: parsed.href,
          scheme: parsed.protocol.replace(/:$/u, "") || null,
          authority: parsed.host || null,
          userinfo: null,
          host: parsed.hostname || null,
          port: parsed.port || null,
          path: parsed.pathname || "",
          query: parsed.search.replace(/^\?/u, "") || null,
          fragment: parsed.hash.replace(/^#/u, "") || null,
          query_params: _dict({})
        });
        if (parsed.username || parsed.password) {
          out.userinfo = parsed.username;
          if (parsed.password) {
            out.userinfo += `:${parsed.password}`;
          }
        }
        for (const [key, item] of parsed.searchParams.entries()) {
          out.query_params[key] = item;
        }
        return out;
      }
      function _templateVar(values, name) {
        if (values[name] == null) {
          return "";
        }
        return encodeURIComponent(_str(values[name]));
      }
      function _templateQuery(values, namesText) {
        const names = String(namesText).split(/\s*,\s*/u).filter(Boolean);
        const parts = [];
        for (const name of names) {
          if (values[name] == null) {
            continue;
          }
          const key = encodeURIComponent(name);
          const val = encodeURIComponent(_str(values[name]));
          parts.push(`${key}=${val}`);
        }
        return parts.length > 0 ? `?${parts.join("&")}` : "";
      }
      function fill_template(template, values) {
        const source = _str(template);
        const data = values && typeof values === "object" && !Array.isArray(values) ? values : {};
        return source.replace(/\{\?([^}]+)\}/gu, (_, names) => _templateQuery(data, names)).replace(/\{([a-zA-Z_][a-zA-Z0-9_]*)\}/gu, (_, name) => _templateVar(data, name));
      }
      module.exports = {
        escape,
        unescape,
        parse,
        fill_template
      };
    }
  });

  // ../../../../../tmp/zuzu-browser-build.STABLE/browser-stdlib.generated.js
  var require_browser_stdlib_generated = __commonJS({
    "../../../../../tmp/zuzu-browser-build.STABLE/browser-stdlib.generated.js"(exports, module) {
      "use strict";
      function createBrowserStdlib() {
        const jsModules = /* @__PURE__ */ Object.create(null);
        jsModules["/extras/zuzu-js/modules/std/string.js"] = require_string();
        jsModules["/extras/zuzu-js/modules/std/string/base64.js"] = require_base64();
        jsModules["/extras/zuzu-js/modules/std/time.js"] = require_time();
        jsModules["/extras/zuzu-js/modules/std/data/json.js"] = require_json();
        jsModules["/extras/zuzu-js/modules/std/data/xml.js"] = require_xml();
        jsModules["/extras/zuzu-js/modules/std/net/http.js"] = require_http();
        jsModules["/extras/zuzu-js/modules/std/math.js"] = require_math();
        jsModules["/extras/zuzu-js/modules/std/eval.js"] = require_eval();
        jsModules["/extras/zuzu-js/modules/std/internals.js"] = require_internals();
        jsModules["/extras/zuzu-js/modules/std/net/url.js"] = require_url();
        const virtualFiles = /* @__PURE__ */ Object.create(null);
        virtualFiles["/modules/std/uuid.zzm"] = '=encoding utf8\n\n=head1 NAME\n\nstd/uuid - Pure ZuzuScript UUID v1 generator.\n\n=head1 SYNOPSIS\n\n  from std/uuid import create_uuid, create_uuid_binary;\n\n  let text := create_uuid();\n  let raw := create_uuid_binary();\n\n=head1 DESCRIPTION\n\nThis module implements UUID version 1 generation using only\nZuzuScript code.\n\nIt exports:\n\n=over\n\n=item * C<create_uuid_binary()>\n\nReturns a single UUID as a C<BinaryString> of 16 bytes.\n\n=item * C<create_uuid()>\n\nReturns a single UUID as lower-case hexadecimal with hyphens,\nin the usual C<8-4-4-4-12> layout.\n\n=back\n\n=head1 COPYRIGHT AND LICENCE\n\nB<< std/uuid >> by Toby Inkster is marked CC0 1.0 Universal.\n\n=cut\n\nfrom std/math import Math;\nfrom std/string import substr;\nfrom std/string/base64 import decode;\nfrom std/time import Time;\n\nlet _B64_ALPHABET := "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";\nlet _HEX_ALPHABET := "0123456789abcdef";\n\nfunction _div_floor ( Number n, Number d ) {\n	return floor( n / d );\n}\n\nfunction _mod ( Number n, Number d ) {\n	return n - _div_floor( n, d ) * d;\n}\n\nfunction _rand_int ( Number max ) {\n	return floor( Math.rand(max) );\n}\n\nfunction _bytes_to_binary ( Array bytes ) {\n	let out := "";\n	let i := 0;\n	let n := bytes.length();\n\n	while ( i < n ) {\n		let b0 := bytes[i];\n		let b1 := null;\n		let b2 := null;\n		if ( i + 1 < n ) {\n			b1 := bytes[i + 1];\n		}\n		if ( i + 2 < n ) {\n			b2 := bytes[i + 2];\n		}\n\n		let c0 := _div_floor( b0, 4 );\n		let c1 := _mod( b0, 4 ) * 16;\n		let c2 := 64;\n		let c3 := 64;\n\n		if ( b1 \u2262 null ) {\n			c1 += _div_floor( b1, 16 );\n			c2 := _mod( b1, 16 ) * 4;\n			if ( b2 \u2262 null ) {\n				c2 += _div_floor( b2, 64 );\n				c3 := _mod( b2, 64 );\n			}\n		}\n\n		out _= substr( _B64_ALPHABET, c0, 1 );\n		out _= substr( _B64_ALPHABET, c1, 1 );\n		if ( c2 \u2261 64 ) {\n			out _= "=";\n		}\n		else {\n			out _= substr( _B64_ALPHABET, c2, 1 );\n		}\n		if ( c3 \u2261 64 ) {\n			out _= "=";\n		}\n		else {\n			out _= substr( _B64_ALPHABET, c3, 1 );\n		}\n\n		i += 3;\n	}\n\n	return decode(out);\n}\n\nfunction _timestamp_words () {\n	// Seconds between 1582-10-15 and 1970-01-01.\n	let epoch_offset := 12219292800;\n	let seconds := new Time().epoch() + epoch_offset;\n	let ticks := _rand_int(10000000);\n\n	let words := [\n		_mod( seconds, 65536 ),\n		_mod( _div_floor( seconds, 65536 ), 65536 ),\n		_mod( _div_floor( seconds, 4294967296 ), 65536 ),\n		0,\n		0,\n	];\n\n	let scale := 10000000;\n	let i := 0;\n	let carry := 0;\n	while ( i < words.length() ) {\n		let product := words[i] * scale + carry;\n		words[i] := _mod( product, 65536 );\n		carry := _div_floor( product, 65536 );\n		i++;\n	}\n\n	let add_i := 0;\n	let add_carry := ticks;\n	while ( add_carry > 0 and add_i < words.length() ) {\n		let sum := words[add_i] + _mod( add_carry, 65536 );\n		words[add_i] := _mod( sum, 65536 );\n		add_carry := _div_floor( add_carry, 65536 ) + _div_floor( sum, 65536 );\n		add_i++;\n	}\n\n	return words;\n}\n\nfunction _create_uuid_bytes () {\n	let words := _timestamp_words();\n	let time_low := words[0] + words[1] * 65536;\n	let time_mid := words[2];\n	let time_hi_and_version := _mod( words[3], 4096 ) + 4096;\n\n	let clock_seq := _rand_int(16384);\n	let clock_seq_hi_and_reserved := _mod( _div_floor( clock_seq, 256 ), 64 ) + 128;\n	let clock_seq_low := _mod( clock_seq, 256 );\n\n	let node := [];\n	let j := 0;\n	while ( j < 6 ) {\n		node.push( _rand_int(256) );\n		j++;\n	}\n	// Multicast bit set means this is not an IEEE MAC address.\n	node[0] := node[0] | 1;\n\n	return [\n		_mod( _div_floor( time_low, 16777216 ), 256 ),\n		_mod( _div_floor( time_low, 65536 ), 256 ),\n		_mod( _div_floor( time_low, 256 ), 256 ),\n		_mod( time_low, 256 ),\n		_mod( _div_floor( time_mid, 256 ), 256 ),\n		_mod( time_mid, 256 ),\n		_mod( _div_floor( time_hi_and_version, 256 ), 256 ),\n		_mod( time_hi_and_version, 256 ),\n		clock_seq_hi_and_reserved,\n		clock_seq_low,\n		node[0],\n		node[1],\n		node[2],\n		node[3],\n		node[4],\n		node[5],\n	];\n}\n\nfunction _byte_to_hex ( Number b ) {\n	let hi := _div_floor( b, 16 );\n	let lo := _mod( b, 16 );\n	return substr( _HEX_ALPHABET, hi, 1 ) _ substr( _HEX_ALPHABET, lo, 1 );\n}\n\nfunction _bytes_to_uuid_text ( Array bytes ) {\n	let out := "";\n	let i := 0;\n	while ( i < 16 ) {\n		out _= _byte_to_hex( bytes[i] );\n		if ( i \u2261 3 or i \u2261 5 or i \u2261 7 or i \u2261 9 ) {\n			out _= "-";\n		}\n		i++;\n	}\n	return out;\n}\n\nfunction create_uuid_binary () {\n	return _bytes_to_binary( _create_uuid_bytes() );\n}\n\nfunction create_uuid () {\n	return _bytes_to_uuid_text( _create_uuid_bytes() );\n}\n';
        virtualFiles["/modules/std/dump.zzm"] = `=encoding utf8

=head1 NAME

std/dump - Structured value dumper for ZuzuScript.

=head1 SYNOPSIS

  from std/dump import Dumper;

  let text := Dumper.dump(
    { nums: [ 1, 2, 3 ] },
    { pretty: true, sort_keys: true }
  );

=head1 DESCRIPTION

This module provides a pure-Zuzu C<Dumper> class which serializes
Zuzu values into code-like text.

If a value cannot be realistically dumped (for example a function),
C<Dumper> emits a warning and inserts C<null> in that location.

=head1 COPYRIGHT AND LICENCE

B<< std/dump >> by Toby Inkster is marked CC0 1.0 Universal.

=cut

from std/internals import class_name, object_slots, ansi_esc, ref_id;
from std/string import join, substr;
let _ANSI_RESET := ansi_esc() _ "[0m";
let _ANSI_NUMBER := ansi_esc() _ "[33m";
let _ANSI_STRING := ansi_esc() _ "[32m";
let _ANSI_BOOL := ansi_esc() _ "[35m";
let _ANSI_NULL := ansi_esc() _ "[90m";
let _ANSI_PUNC := ansi_esc() _ "[36m";
let _ANSI_KEYWORD := ansi_esc() _ "[34m";

function _is_true (value) {
	return value ? true: false;
}

function _warn_unless_quiet ( String msg, Dict cfg ) {
	warn msg if not cfg{quiet};
}

function _indent_pad ( depth, cfg ) {
	return "" if not cfg{pretty};
	let out := "";
	let i := 0;
	while ( i < depth ) {
		out _= "  ";
		i++;
	}

	return out;
}

function _colorize ( String text, String tone, Dict cfg ) {
	return text if not cfg{color};
	return tone _ text _ _ANSI_RESET;
}

function _punc ( String text, Dict cfg ) {
	return _colorize( text, _ANSI_PUNC, cfg );
}

function _quote ( String text, Dict cfg ) {
	let s := text;
	s := "" if s \u2261 null;
	let out := "";
	let i := 0;
	let n := length s;

	while ( i < n ) {
		let ch := substr( s, i, 1 );
		if ( ch \u2261 "\\\\" ) {
			out _= "\\\\\\\\";
		}
		else if ( ch \u2261 "\\"" ) {
			out _= "\\\\\\"";
		}
		else if ( ch \u2261 "\\n" ) {
			out _= "\\\\n";
		}
		else if ( ch \u2261 "\\r" ) {
			out _= "\\\\r";
		}
		else if ( ch \u2261 "\\t" ) {
			out _= "\\\\t";
		}
		else {
			out _= ch;
		}
		i++;
	}

	return _colorize( "\\"" _ out _ "\\"", _ANSI_STRING, cfg );
}

function _keys_for ( Dict d, Dict cfg ) {
	return cfg{sort_keys} ? d.sorted_keys(): d.keys();
}

function _null_literal ( Dict cfg ) {
	return _colorize( "null", _ANSI_NULL, cfg );
}

function _seen_check_and_mark ( value, String label, Dict cfg, Dict state ) {
	let id := ref_id(value);
	if ( id \u2262 null and state{seen}.exists(id) ) {
		_warn_unless_quiet( "Dumper: recursive " _ label _ " detected; dumping null", cfg );
		return true;
	}
	if ( id \u2262 null ) {
		state{seen}.set( id, true );
	}

	return false;
}

function _dump_value ( value, Dict cfg, Dict state, Number depth ) {
	let t := typeof value;
	if ( t \u2261 "Null" ) {
		return _null_literal(cfg);
	}
	if ( t \u2261 "Boolean" ) {
		return _colorize( value ? "true": "false", _ANSI_BOOL, cfg );
	}
	if ( t \u2261 "Number" ) {
		return _colorize( "" _ value, _ANSI_NUMBER, cfg );
	}
	if ( t \u2261 "String" ) {
		return _quote( value, cfg );
	}

	if ( t \u2261 "Array" ) {
		return _null_literal(cfg) if _seen_check_and_mark( value, "array", cfg, state );
		if ( value.length() \u2261 0 ) {
			return _punc( "[", cfg ) _ _punc( "]", cfg );
		}
		let pretty := cfg{pretty};
		let sep := pretty ? _punc( ",\\n", cfg ): _punc(",", cfg );
		let parts := [];
		for ( let item in value ) {
			parts.push( _dump_value( item, cfg, state, depth + 1 ) );
		}
		if ( not pretty ) {
			return _punc( "[", cfg ) _ join( sep, parts ) _ _punc( "]", cfg );
		}
		let inner := [];
		for ( let p in parts ) {
			inner.push( _indent_pad( depth + 1, cfg ) _ p );
		}
		return _punc( "[\\n", cfg ) _ join( sep, inner ) _ _punc( "\\n", cfg ) _ _indent_pad( depth, cfg ) _
		    _punc( "]", cfg );
	}

	if ( t \u2261 "Dict" ) {
		return _null_literal(cfg) if _seen_check_and_mark( value, "dict", cfg, state );
		let keys := _keys_for( value, cfg );
		if ( keys.length() \u2261 0 ) {
			return _punc( "{" , cfg ) _ _punc( "}", cfg );
		}
		let pretty := cfg{pretty};
		let sep := pretty ? _punc( ",\\n", cfg ): _punc(",", cfg );
		let colon := pretty ? _punc( ": ", cfg ): _punc(":", cfg );
		let entries := [];
		for ( let key in keys ) {
			let dumped := _dump_value( value.get(key), cfg, state, depth + 1 );
			entries.push( _quote( key, cfg ) _ colon _ dumped );
		}
		if ( not pretty ) {
			return _punc( "{" , cfg ) _ join( sep, entries ) _ _punc( "}", cfg );
		}
		let inner := [];
		for ( let e in entries ) {
			inner.push( _indent_pad( depth + 1, cfg ) _ e );
		}
		return _punc( "{\\n", cfg ) _ join( sep, inner ) _ _punc( "\\n", cfg ) _ _indent_pad( depth, cfg ) _
		    _punc( "}", cfg );
	}

	if ( t \u2261 "PairList" ) {
		return _null_literal(cfg) if _seen_check_and_mark( value, "pairlist", cfg, state );
		if ( value.empty ) {
			return _punc( "{{" , cfg ) _ _punc( "}}", cfg );
		}
		let pretty := cfg{pretty};
		let sep := pretty ? _punc( ",\\n", cfg ): _punc(",", cfg );
		let colon := pretty ? _punc( ": ", cfg ): _punc(":", cfg );
		let entries := [];
		value.for_each_pair( function (p) {
			let dumped := _dump_value( p.value, cfg, state, depth + 1 );
			entries.push( _quote( p.key, cfg ) _ colon _ dumped );
		} );
		if ( not pretty ) {
			return _punc( "{{" , cfg ) _ join( sep, entries ) _ _punc( "}}", cfg );
		}
		let inner := [];
		for ( let e in entries ) {
			inner.push( _indent_pad( depth + 1, cfg ) _ e );
		}
		return _punc( "{{\\n", cfg ) _ join( sep, inner ) _ _punc( "\\n", cfg ) _ _indent_pad( depth, cfg ) _
		    _punc( "}}", cfg );
	}

	if ( t \u2261 "Set" or t \u2261 "Bag" ) {
		return _null_literal(cfg) if _seen_check_and_mark( value, lc t, cfg, state );
		let left :=( t \u2261 "Set" ) ? "<<": "<<<";
		let right :=( t \u2261 "Set" ) ? ">>": ">>>";
		let sep := cfg{pretty} ? _punc( ", ", cfg ): _punc(",", cfg );
		let items := [];
		for ( let item in value ) {
			items.push( _dump_value( item, cfg, state, depth + 1 ) );
		}
		return _punc( left, cfg ) _ join( sep, items ) _ _punc( right, cfg );
	}

	if ( t \u2261 "Pair" ) {
		let pair_value := value{pair};
		if ( typeof pair_value \u2262 "Array" or pair_value.length() < 2 ) {
			_warn_unless_quiet( "Dumper: invalid Pair shape; using null", cfg );
			return _null_literal(cfg);
		}
		let first := _dump_value( pair_value[0], cfg, state, depth + 1 );
		let second := _dump_value( pair_value[1], cfg, state, depth + 1 );
		let body := _punc( "[", cfg ) _ first _ _punc(",", cfg ) _ second _ _punc( "]", cfg );
		let kw_new := _colorize( "new", _ANSI_KEYWORD, cfg );
		return kw_new _ " Pair" _ _punc("(", cfg ) _ "pair" _ _punc(":", cfg ) _ body _ _punc(")", cfg );
	}

	if ( t \u2261 "Function" or t \u2261 "Method" or t \u2261 "Class" or t \u2261 "Regexp" ) {
		_warn_unless_quiet( "Dumper: value of type '" _ t _ "' is not dumpable; using null", cfg, );
		return _null_literal(cfg);
	}
	return _null_literal(cfg) if _seen_check_and_mark( value, "object", cfg, state );
	let cname := class_name(value);
	let slots := object_slots(value);
	if ( cname \u2261 null or typeof slots \u2262 "Dict" ) {
		_warn_unless_quiet( "Dumper: object internals unavailable; dumping null", cfg );
		return _null_literal(cfg);
	}
	let keys := _keys_for( slots, cfg );
	let colon := cfg{pretty} ? _punc( ": ", cfg ): _punc(":", cfg );
	let args := [];
	for ( let key in keys ) {
		args.push( key _ colon _ _dump_value( slots.get(key), cfg, state, depth + 1 ) );
	}
	let kw_new := _colorize( "new", _ANSI_KEYWORD, cfg );
	if ( args.length() \u2261 0 ) {
		return kw_new _ " " _ cname _ _punc( "()", cfg );
	}
	if ( not cfg{pretty} ) {
		return kw_new _ " " _ cname _ _punc("(", cfg ) _ join( _punc(",", cfg ), args ) _ _punc(")", cfg );
	}
	let inner := [];
	for ( let arg in args ) {
		inner.push( _indent_pad( depth + 1, cfg ) _ arg );
	}
	return kw_new _ " " _ cname _ _punc( "(\\n", cfg ) _ join( _punc( ",\\n", cfg ), inner ) _ _punc( "\\n",
	    cfg ) _ _indent_pad( depth, cfg ) _ _punc(")", cfg );
}

class Dumper {

	static method dump ( value, options? ) {
		let cfg := { pretty: false, sort_keys: false, color: false, quiet: false };
		if ( typeof options \u2261 "Dict" ) {
			cfg{pretty} := _is_true( options{pretty} ) if "pretty" in options;
			cfg{sort_keys} := _is_true( options{sort_keys} ) if "sort_keys" in options;
			cfg{color} := _is_true( options{color} ) if "color" in options;
			cfg{quiet} := _is_true( options{quiet} ) if "quiet" in options;
		}
		return _dump_value( value, cfg, { seen: {} }, 0 );
	}

}
`;
        virtualFiles["/modules/std/data/xml/escape.zzm"] = `=encoding utf8

=head1 NAME

std/data/xml/escape - XML entity escaping helpers.

=head1 SYNOPSIS

  from std/data/xml/escape import
    escape_xml, unescape_xml;

  let escaped := escape_xml(
    "<tea attr=\\"hot\\">& 'biscuits'</tea>"
  );
  let text := unescape_xml(
    "&lt;tea&gt;&#x41;&#65;&lt;/tea&gt;"
  );

=head1 DESCRIPTION

This module provides lightweight XML entity
escaping and unescaping helpers.

=head2 Functions

=over

=item C<< escape_xml(value) >>

Escape XML special characters C<&>, C<< < >>, C<< > >>,
C<">, and C<'>.

=item C<< unescape_xml(value) >>

Unescape XML named entities C<&lt;>, C<&gt;>, C<&quot;>,
C<&apos;>, and C<&amp;>.

Also decodes numeric entities in decimal and hexadecimal
forms, such as C<&#65;> and C<&#x41;>.

=back

=head1 COPYRIGHT AND LICENCE

B<< std/data/xml/escape >> by Toby Inkster is marked
CC0 1.0 Universal.

=cut

from std/string import substr, replace, sprint, index;

function escape_xml ( value ) {
	let out := value \u2261 null ? "" : "" _ value;
	out := replace( out, "&", "&amp;", "g" );
	out := replace( out, "<", "&lt;", "g" );
	out := replace( out, ">", "&gt;", "g" );
	out := replace( out, "\\"", "&quot;", "g" );
	out := replace( out, "'", "&apos;", "g" );
	return out;
}

function _hex_to_number ( String digits ) {
	let out := 0;
	let i := 0;
	let n := length digits;

	while ( i < n ) {
		let ch := substr( digits, i, 1 );
		let val := 0;

		if ( ch ~ /[0-9]/ ) {
			val := 0 + ch;
		}
		else {
			let lower := lc(ch);
			val := 10 + index( "abcdef", lower );
		}

		out := out * 16 + val;
		i++;
	}

	return out;
}

function _decode_numeric_xml_entities ( text ) {
	let out := "";
	let i := 0;
	let n := length text;

	while ( i < n ) {
		let ch := substr( text, i, 1 );
		if ( ch \u2261 "&" and i + 2 < n and substr( text, i, 2 ) \u2261 "&#" ) {
			let j := i + 2;
			let hex := false;

			if ( j < n ) {
				let mark := substr( text, j, 1 );
				if ( mark \u2261 "x" or mark \u2261 "X" ) {
					hex := true;
					j++;
				}
			}

			let digits := "";
			while ( j < n ) {
				let d := substr( text, j, 1 );
				last if d \u2261 ";";

				if ( hex ) {
					last unless d ~ /[0-9A-Fa-f]/;
				}
				else {
					last unless d ~ /[0-9]/;
				}

				digits _= d;
				j++;
			}

			if ( digits \u2262 "" and j < n and substr( text, j, 1 ) \u2261 ";" ) {
				let code := hex
					? _hex_to_number( digits )
					: 0 + digits;
				out _= sprint( "%c", code );
				i := j + 1;
				next;
			}
		}

		out _= ch;
		i++;
	}

	return out;
}

function unescape_xml ( value ) {
	let out := value \u2261 null ? "" : "" _ value;
	out := _decode_numeric_xml_entities( out );
	out := replace( out, "&lt;", "<", "g" );
	out := replace( out, "&gt;", ">", "g" );
	out := replace( out, "&quot;", "\\"", "g" );
	out := replace( out, "&apos;", "'", "g" );
	out := replace( out, "&amp;", "&", "g" );
	return out;
}
`;
        virtualFiles["/modules/std/path/z.zzm"] = '=encoding utf8\n\n=head1 NAME\n\nstd/path/z - Pure Zuzu implementation of ZPath selectors.\n\n=head1 SYNOPSIS\n\n  from std/path/z import ZPath;\n  from std/time import Time;\n  \n  let data := {\n    users: [\n      { name: "Ada", age: 32, updated: new Time() },\n      { name: "Bob", age: 27 },\n    ],\n  };\n  \n  let names := query( data, "/users/*/name" );\n  let zp := new ZPath( path: "/users/#0/name" );\n  say( zp.first( data, "n/a" ) );\n  say( exists( data, "/users/#9/name" ) );\n  say( first( data, "/users/#0/updated/@year" ) );\n  say( zp.assign_first( data, "Adele" ) );\n\n=head1 DESCRIPTION\n\nNative (pure-Zuzu) path traversal for structured values.\n\n=head2 Use with path operators\n\nThe path operators C<@>, C<@@>, and C<@?> can be set to use this module\nin a lexical scope.\n\n  from std/path/z import ZPath;\n  \n  function find_usernames (data) {\n    ZPath.use();\n    return data @@ "/users/*/name";\n  }\n\nHowever, for repeatedly used paths it may be more efficient to compile the\npath once and use many times:\n\n  let _usernames_zpath;\n  function find_usernames (data) {\n    from std/path/z import ZPath;\n    _usernames_zpath ?:= new ZPath( path: "/users/*/name" );\n    return data @@ _usernames_zpath;\n  }\n\n=head2 Methods\n\nA compiled C<ZPath> object provides the following methods:\n\n=over\n\n=item * C<query(haystack)>\n\nReturns an Array with all results searching the haystack.\n\n=item * C<first(haystack)>\n\nReturns just the first result, or null if none were found.\n\n=item * C<exists(haystack)>\n\nReturns a boolean indicating if any results were found.\n\n=item * C<assign_first(haystack, value, op := ":=")>\n\nUpdates the first selected node. Throws if no matches are found.\n\n=item * C<assign_all(haystack, value, op := ":=")>\n\nUpdates all selected nodes. If no matches are found, returns C<value>\nwithout mutation.\n\n=item * C<assign_maybe(haystack, value, op := ":=")>\n\nUpdates the first selected node when one exists. Returns C<true> on\nmatch and C<false> on no match.\n\n=item * C<ref_first(haystack)>\n\nReturns a reference-like getter/setter closure for the first selected\nnode. Throws if no matches are found.\n\n=item * C<ref_all(haystack)>\n\nReturns an Array of reference-like getter/setter closures.\n\n=item * C<ref_maybe(haystack)>\n\nReturns one reference-like getter/setter closure when a match exists,\notherwise C<null>.\n\n=back\n\n=head2 Supported types\n\n=over\n\n=item B<Null>, B<Boolean>, B<Number>, B<String>, B<BinaryString>, B<Regexp>\n\nTreated as terminal nodes. These objects cannot have child objects.\n\n=item B<Array>\n\nArray items can be indexed by number.\n\n=item B<Bag>, B<Set>\n\nItems cannot be indexed by number, but can be returned by "*".\n\n=item B<Dict>\n\nValues are named by their key.\n\n=item B<PairList>\n\nPairs can be indexed by number, named by their key, or use a combination of\nboth.\n\n  {{ foo: 11, bar: -1, foo: 22, foo: 33 }}\n\nC<< /#2 >> (0-based index) will retrieve C<< foo: 22 >>.\nC<< /foo >> will retrieve C<< foo: 11 >>, C<< foo: 22 >>, and C<< foo: 33 >>.\nC<< /foo#2 >> (0-based index on just values with key "foo") will retrieve C<< foo: 33 >>.\n\nNote that rather than just retrieving the value, a Pair object is retrieved.\n\n=item B<< Pair >>\n\nPair objects do not have child objects but do have C<< @key >> and\nC<< @value >> attributes.\n\n  let pairlist := {{ foo: 11, bar: -1, foo: 22, foo: 33 }};\n  say( first( pairlist, "/#2/@key" ) );     // "foo"\n  say( first( pairlist, "/#2/@value" ) );   // 22\n\n=item B<< Time >>\n\nTime is treated as a terminal node with attributes C<< @year >>,\nC<< @month >>, C<< @day >>, C<< @hour >>, C<< @min >>, and C<< @sec >>.\n\nSee C<< std/time >>.\n\n=item B<< Path >>\n\nPaths representing files are treated as terminal nodes with attributes\ncorresponding to the values from the C<stat> system call: C<< @dev >>,\nC<< @ino >>, C<< @mode >>, C<< @nlink >>, C<< @uid >>, C<< @gid >>,\nC<< @rdev >>, C<< @size >>, C<< @atime >>, C<< @mtime >>, C<< @ctime >>,\nC<< @blksize >>, and C<< @blocks >>.\n\nSee C<< std/io >>.\n\n=item B<< XMLDocument >>, B<< XMLNode >>, etc.\n\nAre treated roughly how the ZPath specification suggests.\n\n  /html/body/table/tbody/tr     // all rows in the tbody\n  /html/body/table/tbody/tr#0   // the first row in the tbody\n  /html/body/table/tbody/#0     // the child element in the tbody\n  /html/body/table[@id]         // all tables that have an id attribute\n\nSee C<< std/data/xml >>.\n\n=back\n\n=head1 SEE ALSO\n\nSpecification: L<https://zpath.me>.\n\nPerl implementation: L<Data::ZPath>.\n\n=cut\n\nfrom std/path/z/parser import Parser;\nfrom std/path/z/evaluate import Evaluator;\nfrom std/path/z/context import Ctx;\n\nlet _cache;\ndo {\n	from std/cache/lru try import Cache;\n	if ( Cache ) {\n		_cache := new Cache( capacity: 16 );\n	}\n};\n\nclass ZPath {\n	let String path;\n	let ast;\n	let ev;\n	\n	static method use () {\n		from std/internals import setupperprop;\n		setupperprop( 1, "paths", self );\n	}\n	\n	method __build__ () {\n		ev := self.get_evaluator;\n		const p := new Parser( allowed_operators: ev.operator_definitions );\n		ast ?:= _cache\n			? _cache.get( path, fn x \u2192 p.parse_top_level_terms(x) )\n			: p.parse_top_level_terms(path);\n	}\n	\n	method get_evaluator () {\n		return new Evaluator();\n	}\n	\n	method evaluate ( raw, meta := {} ) {\n\n		meta.set( "level", 0 ) unless meta.defined( "level" );\n		const ctx := new Ctx(\n			root: raw,\n			nodeset: meta.get( "nodeset", null ),\n			parentset: meta.get( "parentset", null ),\n			meta: meta,\n		);\n\n		const short_circuit := ( meta.get( "want", "all" ) in [ "first", "exists" ] );\n\n		let results := [];\n		for ( let term in ast ) {\n			for ( let node in ev.eval_expr( term, ctx ) ) {\n				let next_node := ev.maybe_apply_action( node, ctx );\n				results.push(next_node);\n				return results if short_circuit;\n			}\n		}\n\n		return results;\n	}\n	\n	method get ( raw ) {\n		return self.evaluate(raw).map( fn r \u2192 r.primitive_value );\n	}\n	\n	method select ( raw ) {\n		return self.evaluate(raw).map( fn r \u2192 r.primitive_value );\n	}\n	\n	method query ( raw ) {\n		return self.evaluate(raw).map( fn r \u2192 r.primitive_value );\n	}\n\n	method first ( raw, fallback? ) {\n		let got := self.evaluate( raw, { want: "first" } );\n		return got.empty ? fallback : got[0].primitive_value;\n	}\n	\n	method exists ( raw ) {\n		let got := self.evaluate( raw, { want: "exists" } );\n		return not got.empty;\n	}\n\n	method _apply_assignment_ref ( ref, value, op := ":=" ) {\n		if ( op \u2261 ":=" ) {\n			return ref(value);\n		}\n\n		let current := ref();\n\n		if ( op \u2261 "+=" ) {\n			current += value;\n		}\n		else if ( op \u2261 "-=" ) {\n			current -= value;\n		}\n		else if ( op \u2261 "*=" or op \u2261 "\xD7=" ) {\n			current *= value;\n		}\n		else if ( op \u2261 "/=" or op \u2261 "\xF7=" ) {\n			current /= value;\n		}\n		else if ( op \u2261 "**=" ) {\n			current **= value;\n		}\n		else if ( op \u2261 "_=" ) {\n			current _= value;\n		}\n		else if ( op \u2261 "?:=" ) {\n			current ?:= value;\n		}\n		else if ( op \u2261 "~=" ) {\n			current ~= value[0] -> value[1](m);\n		}\n		else {\n			die `Unsupported path assignment operator \'${op}\'`;\n		}\n\n		ref(current);\n		return current;\n	}\n\n	method _assign_all_result ( value, op, last_result ) {\n		return op \u2261 "~=" ? last_result : value;\n	}\n\n	method assign_first ( raw, value, op := ":=" ) {\n		let got := self.evaluate( raw, { want: "first" } );\n		die "Path assignment (@) found no matches" if got.empty;\n		return self._apply_assignment_ref(\n			got[0].ref(),\n			value,\n			op,\n		);\n	}\n\n	method assign_all ( raw, value, op := ":=" ) {\n		let got := self.evaluate(raw);\n		if ( got.empty ) {\n			return self._assign_all_result( value, op, value );\n		}\n\n		let last_result := value;\n		for ( let node in got ) {\n			last_result := self._apply_assignment_ref(\n				node.ref(),\n				value,\n				op,\n			);\n		}\n\n		return self._assign_all_result( value, op, last_result );\n	}\n\n	method assign_maybe ( raw, value, op := ":=" ) {\n		let got := self.evaluate( raw, { want: "first" } );\n		if ( got.empty ) {\n			return false;\n		}\n\n		self._apply_assignment_ref( got[0].ref(), value, op );\n		return true;\n	}\n\n	method ref_first ( raw ) {\n		let got := self.evaluate( raw, { want: "first" } );\n		die "Path assignment (@) found no matches" if got.empty;\n		return got[0].ref();\n	}\n\n	method ref_all ( raw ) {\n		return self.evaluate(raw).map( fn n \u2192 n.ref );\n	}\n\n	method ref_maybe ( raw ) {\n		let got := self.evaluate( raw, { want: "first" } );\n		return got.empty ? null : got[0].ref();\n	}\n}\n';
        virtualFiles["/modules/std/path/z/context.zzm"] = '=encoding utf8\n\n=head1 NAME\n\nstd/path/z/context - Evaluation context used by std/path/z.\n\n=head1 DESCRIPTION\n\nThis module ports the C<Data::ZPath::_Ctx> Perl class to pure\nZuzuScript with a near line-by-line translation and matching public API.\n\n=cut\n\nfrom std/path/z/node import Node;\n\nclass Ctx {\n	let root := null;\n	let nodeset := null;\n	let parentset := null;\n	let meta := null;\n\n	method __build__ () {\n		if ( not ( root instanceof Node ) ) {\n			let root_obj := root;\n			let root_type := typeof root_obj;\n			let node_type := null;\n\n			try {\n				node_type := int( "" _ root_obj.nodeType() );\n			}\n			catch {\n			}\n\n			if (\n				root_type eq "XMLDocument"\n				or root_type eq "DOMDocument"\n				or node_type = 9\n			) {\n				try {\n					let de := root_obj.documentElement();\n					root_obj := de if de \u2262 null;\n				}\n				catch {\n				}\n			}\n\n			root := Node.wrap( root_obj );\n		}\n\n		nodeset ?:= [ root ];\n		meta ?:= { level: 0 };\n	}\n\n	method with_nodeset ( ns, ps ) {\n		return new Ctx(\n			root: root,\n			nodeset: ns,\n			parentset: ps,\n			meta: meta,\n		);\n	}\n\n	method nested ( extras? ) {\n		let extra_meta := extras ?: {};\n\n		let next_meta := {\n			level: meta.get( "level", 0 ) + 1,\n		};\n\n		for ( let pair in extra_meta.enumerate ) {\n			next_meta.add( pair );\n		}\n\n		return new Ctx(\n			root: root,\n			nodeset: nodeset,\n			parentset: parentset,\n			meta: next_meta,\n		);\n	}\n\n	method root () { return root; }\n	method nodeset () { return nodeset; }\n	method parentset () { return parentset; }\n	method meta () { return meta; }\n}\n';
        virtualFiles["/modules/std/path/z/evaluate.zzm"] = '=encoding utf8\n\n=head1 NAME\n\nstd/path/z/evaluate - Pure Zuzu evaluator for ZPath expressions.\n\n=head1 DESCRIPTION\n\nThis module ports C<Data::ZPath::_Evaluate> to pure ZuzuScript with a\nnear line-by-line translation and object-oriented public API.\n\n=cut\n\nfrom std/string import replace, index, substr;\nfrom std/path/z/node import Node;\nfrom std/path/z/functions import STANDARD_FUNCTIONS;\nfrom std/path/z/operators import STANDARD_OPERATORS;\n\nlet _do_dump := false;\n\nclass Evaluator {\n	let _operator_definitions;\n	let _function_definitions;\n	\n	let \u03B5 := 0.000000001;\n	\n	method operator_definitions () {\n		_operator_definitions ?:= STANDARD_OPERATORS;\n		return _operator_definitions;\n	}\n	\n	method function_definitions () {\n		_function_definitions ?:= STANDARD_FUNCTIONS;\n		return _function_definitions;\n	}\n	\n	method eval_expr_wrap ( ast, ctx ) {\n		from std/dump import Dumper;\n		let got := self._real_eval_expr ( ast, ctx );\n		say `AST ${Dumper.dump(ast)} CTX ${Dumper.dump(ctx)} \u21D2 GOT ${Dumper.dump(got)}` if _do_dump;\n		return got;\n	}\n	\n	method eval_expr ( ast, ctx ) {\n		\n		switch ( ast{t} : eq ) {\n			case "num":\n				return [ Node.wrap( ast{v} ) ];\n			case "str":\n				return [ Node.wrap( ast{v} ) ];\n			case "path":\n				return self.eval_path( ast, ctx );\n			case "fn":\n				return self.eval_fn( ast, ctx );\n			case "un":\n				return self.eval_unop( ast, ctx );\n			case "bin":\n				return self.eval_binop( ast, ctx );\n			case "ternary":\n				let c  := self.eval_expr( ast{c}, ctx );\n				let ab := self.truthy( c.get(0) ) ? "a" : "b";\n				return self.eval_expr( ast{(ab)}, ctx );\n			default:\n				die "Panic! Unknown AST node type!";\n		}\n	}\n\n	method nested_ctx ( ctx, ... PairList extras ) {\n		return null if ctx \u2261 null;\n		return ctx.nested( extras );\n	}\n\n	method eval_binop ( ast, ctx ) {\n		const op := ast{op};\n		const op_def := self.operator_definitions().first( fn x \u2192 x.get_spelling eq op );\n		if ( op_def and op_def{f} ) {\n			const implementation := op_def{f};\n			return implementation( op_def, self, ast, ctx, ast{l}, ast{r} );\n		}\n		return [];\n	}\n\n	method eval_unop ( ast, ctx ) {\n		const op := ast{op};\n		if ( op \u2261 "!" ) {\n			const got := self.eval_expr( ast{e}, ctx );\n			const value := got.length() > 0 ? got[0] : null;\n			return [ Node.wrap( not self.truthy(value) ) ];\n		}\n		return [];\n	}\n\n	method eval_path ( path_ast, ctx ) {\n		let current := [];\n		for ( let n in ctx.nodeset() ) {\n			current.push(n);\n		}\n\n		let parentset := ctx.parentset();\n\n		for ( let seg in path_ast{s} ) {\n			let next_nodes := [];\n\n			if ( seg{k} \u2261 "root" ) {\n				next_nodes := [ ctx.root() ];\n			}\n			else if ( seg{k} \u2261 "dot" ) {\n				next_nodes := current;\n			}\n			else if ( seg{k} \u2261 "parent" ) {\n				for ( let n in current ) {\n					let p := n.parent();\n					if ( p \u2262 null ) {\n						next_nodes.push(p);\n					}\n				}\n				next_nodes := self.dedup_nodes(next_nodes);\n			}\n			else if ( seg{k} \u2261 "ancestors" ) {\n				let anc := [];\n				for ( let n in current ) {\n					let p := n.parent();\n					while ( p \u2262 null ) {\n						anc.push(p);\n						p := p.parent();\n					}\n				}\n				next_nodes := self.dedup_nodes(anc);\n			}\n			else if ( seg{k} \u2261 "star" ) {\n				let kids := [];\n				for ( let n in current ) {\n					for ( let child in n.children() ) {\n						if ( child.type() \u2262 "attr" ) {\n							kids.push(child);\n						}\n					}\n				}\n				next_nodes := self.dedup_nodes(kids);\n			}\n			else if ( seg{k} \u2261 "desc" ) {\n				let acc := [];\n				let stack := [];\n				for ( let n in current ) {\n					stack.push(n);\n				}\n\n				while ( stack.length() > 0 ) {\n					let n := stack.shift();\n					acc.push(n);\n					for ( let child in n.children() ) {\n						if ( child.type() \u2262 "attr" ) {\n							stack.push(child);\n						}\n					}\n				}\n				next_nodes := self.dedup_nodes(acc);\n			}\n			else if ( seg{k} \u2261 "index" ) {\n				let idx := seg{i};\n				let kids := [];\n				for ( let n in current ) {\n					let c := n.indexed_child( idx );\n					kids.push(c) if c \u2262 null;\n				}\n				next_nodes := self.dedup_nodes(kids);\n			}\n			else if ( seg{k} \u2261 "fnseg" ) {\n				let out := [];\n				for ( let n in current ) {\n					let seg_ctx := ctx.with_nodeset( [ n ], current );\n					let fn_ast := { t: "fn", n: seg{n}, a: seg{a} };\n					let res := self.eval_fn( fn_ast, seg_ctx );\n					for ( let x in res ) {\n						out.push(x);\n					}\n				}\n				next_nodes := out;\n			}\n			else if ( seg{k} \u2261 "name" ) {\n				let name := seg{n};\n\n				if ( name ~ /^\\@/ ) {\n					if ( name \u2261 "@*" ) {\n						let attrs := [];\n						for ( let n in current ) {\n							for ( let a in n.attributes() ) {\n								attrs.push(a);\n							}\n						}\n						next_nodes := self.dedup_nodes(attrs);\n					}\n					else {\n						let attrs := [];\n						for ( let n in current ) {\n							for ( let a in n.attributes() ) {\n								if ( a.name() \u2261 name ) {\n									attrs.push(a);\n								}\n							}\n						}\n						next_nodes := self.dedup_nodes(attrs);\n					}\n				}\n				else {\n					let kids := [];\n					for ( let n in current ) {\n						if ( n.can_have_named_indexed_children() ) {\n							let idx := 0;\n							while ( true ) {\n								let c := n.named_indexed_child( name, idx );\n								last if c \u2261 null;\n								kids.push(c);\n								idx++;\n							}\n						}\n						else {\n							let c := n.named_child( name );\n							kids.push(c) if c \u2262 null;\n						}\n					}\n					next_nodes := self.dedup_nodes(kids);\n				}\n\n				if ( seg.exists("i") and seg{i} \u2262 null ) {\n					let idx := seg{i};\n					let picked := [];\n					for ( let n in current ) {\n						let c := n.named_indexed_child( name, idx );\n						picked.push(c) if c \u2262 null;\n					}\n					next_nodes := self.dedup_nodes(picked);\n				}\n			}\n			else {\n				die "Unknown path segment kind: " _ seg{k};\n			}\n\n			if ( seg.exists("q") and seg{q}.length() > 0 ) {\n				for ( let q in seg{q} ) {\n					if ( q.exists("t") and q{t} \u2261 "num" and q{v} ~ /^\\d+$/ ) {\n						let idx := 0 + q{v};\n\n						if ( next_nodes.length() > 0 and self._node_is_xml(next_nodes[0]) ) {\n							next_nodes := ( idx \u2265 0 and idx < next_nodes.length() ) ? [ next_nodes[idx] ] : [];\n						}\n						else {\n							let picked := [];\n							for ( let node in next_nodes ) {\n								let ch := node.children().grep( fn c \u2192 c.type() \u2262 "attr" );\n								if ( idx \u2265 0 and idx < ch.length() ) {\n									picked.push( ch[idx] );\n								}\n							}\n							next_nodes := picked;\n						}\n\n						next;\n					}\n\n					let filtered := [];\n					let i := 0;\n					while ( i < next_nodes.length() ) {\n						let node := next_nodes[i];\n						let ns_ctx := ctx.with_nodeset( next_nodes, current );\n						let filter_ctx := ns_ctx.with_nodeset( [ node ], next_nodes );\n						let r := self.eval_expr( q, self.nested_ctx( filter_ctx, want: "exists" ) );\n\n						let ok := false;\n						if ( q.exists("t") and q{t} \u2261 "path" ) {\n							ok := r.length() > 0;\n						}\n						else {\n							ok := self.truthy( r.length() > 0 ? r[0] : null );\n						}\n\n						if ( ok ) {\n							filtered.push(node);\n						}\n						i++;\n					}\n					next_nodes := filtered;\n				}\n			}\n\n			parentset := current;\n			current := next_nodes;\n		}\n\n		return current;\n	}\n\n	method maybe_apply_action ( node, ctx ) {\n		const meta := ctx.meta();\n		return node if not meta.exists( "action" );\n		const action := meta{action};\n		return node if action \u2261 null;\n		return node if not action.exists( "op" );\n		node.do_action(action);\n		return node;\n	}\n\n	method eval_fn ( fn_ast, ctx ) {\n		const name := fn_ast{n};\n		const fn_def := self.function_definitions().first( fn f \u2192 f.has_name(name) );\n		return fn_def{f}( fn_def, self, fn_ast, ctx, fn_ast{a} ?: [] ) if fn_def;\n		return [];\n	}\n\n	method string_replace ( string, pattern, replacement ) {\n		let text := string \u2261 null ? "" : "" _ string;\n		let rep := replacement \u2261 null ? "" : "" _ replacement;\n\n		try {\n			return replace( text, pattern, rep, "g" );\n		}\n		catch {\n			return replace( text, "" _ pattern, rep, "g" );\n		}\n	}\n\n	method dedup_nodes ( nodes ) {\n		let seen := {};\n		let out := [];\n		for ( let n in nodes ) {\n			let key := n.id ?: ( "anon:" _ out.length() _ ":" _ ( "" _ n.raw() ) );\n			if ( not seen.exists(key) ) {\n				seen.set( key, true );\n				out.push(n);\n			}\n		}\n		return out;\n	}\n\n	method truthy ( n ) {\n		return false if n \u2261 null;\n		let pv := n.primitive_value();\n		return pv ? true : false;\n	}\n\n	method to_number ( n ) {\n		return null if n \u2261 null;\n		return n.number_value();\n	}\n\n	method to_string ( n ) {\n		return null if n \u2261 null;\n		return n.string_value();\n	}\n\n	method equals ( a, b ) {\n		return false if a \u2261 null or b \u2261 null;\n\n		let a_type := a.type();\n		let b_type := b.type();\n\n		if ( b_type eq "null" ) {\n			return a_type eq "null";\n		}\n		if ( a_type eq "null" ) {\n			return b_type eq "null";\n		}\n\n		if ( a_type eq "boolean" and b_type eq "boolean" ) {\n			let av := a.primitive_value() ? true : false;\n			let bv := b.primitive_value() ? true : false;\n			return av \u2261 bv;\n		}\n\n		if ( a_type \u2261 "number" and b_type \u2261 "number" ) {\n			let av := a.number_value();\n			let bv := b.number_value();\n			return false if av \u2261 null or bv \u2261 null;\n\n			if ( ( "" _ av ) ~ /\\./ or ( "" _ bv ) ~ /\\./ ) {\n				return abs( av - bv ) < \u03B5;\n			}\n\n			return av = bv;\n		}\n\n		let string_like := [ "string", "text", "attr", "comment", "element" ];\n		if ( a_type in string_like and b_type in string_like ) {\n			let av := a.string_value();\n			let bv := b.string_value();\n			return av eq bv;\n		}\n\n		let aid := a.id();\n		let bid := b.id();\n		return false if aid \u2261 null or bid \u2261 null;\n		return aid eq bid;\n	}\n\n	method _node_is_xml ( n ) {\n		if ( n \u2261 null ) {\n			return false;\n		}\n		let raw := n.raw();\n		try {\n			let node_type := raw.nodeType();\n			return node_type \u2262 null;\n		}\n		catch {\n			return false;\n		}\n	}\n}\n';
        virtualFiles["/modules/std/path/z/functions.zzm"] = `from std/path/z/node import Node;
from std/path/z/operators import EvalHelpers;
from std/data/xml/escape import escape_xml, unescape_xml;
from std/string import index, rindex, search, sprint, substr, join;
from std/math import Math;

class Func with EvalHelpers {
	let String spelling with get;
	let Function f;
	
	method has_name ( n ) {
		return true if self.get_spelling eq n;
		return false;
	}
}

function replace ( haystack, needle, replacement ) {
	let copy := haystack;
	
	if ( replacement ~ /\\$[0-9]/ ) {
		let r := replacement;
		copy ~= needle \u2192 do {
			let matches := m;
			r ~= /\\$([0-9]+)/g \u2192 matches[ m[1] ];
			r;
		};
	}
	else {
		copy ~= needle \u2192 replacement;
	}
	
	return copy;
}

function mk_single_number_function ( String name, Function impl ) {
	return function ( funk, ev, ast, ctx, args ) {
		let nodes := [];
		for ( let a in args ) {
			const got := ev.eval_expr( a, ev.nested_ctx( ctx ) );
			for ( let n in got ) {
				nodes.push( n );
			}
		}
		else {
			nodes := ctx.nodeset;
		}
		return nodes
			.map( fn x \u2192 x.number_value )
			.grep( fn x \u2192 typeof x eq "Number" )
			.map( fn x \u2192 funk.wrap_for_array( impl(x) ) );
	};
}

function mk_aggregate_number_function ( String name, Function impl ) {
	return function ( funk, ev, ast, ctx, args ) {
		let nodes := [];
		for ( let a in args ) {
			const got := ev.eval_expr( a, ev.nested_ctx( ctx ) );
			for ( let n in got ) {
				nodes.push( n );
			}
		}
		else {
			nodes := ctx.nodeset;
		}
		const nums := nodes
			.map( fn x \u2192 x.number_value )
			.grep( fn x \u2192 typeof x eq "Number" );
		return funk.wrap( impl( nums ) );
	};
}

function mk_single_string_function ( String name, Function impl ) {
	return function ( funk, ev, ast, ctx, args ) {
		let nodes := [];
		for ( let a in args ) {
			const got := ev.eval_expr( a, ev.nested_ctx( ctx ) );
			for ( let n in got ) {
				nodes.push( n );
			}
		}
		else {
			nodes := ctx.nodeset;
		}
		return nodes
			.map( fn x \u2192 x.string_value )
			.grep( fn x \u2192 typeof x eq "String" )
			.map( fn x \u2192 funk.wrap_for_array( impl(x) ) );
	};
}

function mk_match_function () {
	return function ( funk, ev, ast, ctx, args ) {
		let nodes := [];
		let re;
		
		if ( args.empty ) {
			die "Not enough arguments for match()";
		}
		else {
			re := try {
				ev.eval_expr( args[0], ev.nested_ctx( ctx ) )[0].string_value;
			} catch {
				"";
			};
		}
		
		for ( let a in args[1:] ) {
			const got := ev.eval_expr( a, ev.nested_ctx( ctx ) );
			for ( let n in got ) {
				nodes.push( n );
			}
		}
		else {
			nodes := ctx.nodeset;
		}
		
		return nodes
			.map( fn x \u2192 x.string_value )
			.grep( fn x \u2192 typeof x eq "String" )
			.map( fn x \u2192 funk.wrap_for_array( ( x ~ re ) ? true : false ) );
	}
}

const STANDARD_FUNCTIONS := [
	new Func(
		spelling: "true",
		f: function ( funk, ev, ast, ctx, args ) {
			die "Too many arguments for true()" unless args.empty;
			return funk.wrap( true );
		},
	),
	
	new Func(
		spelling: "false",
		f: function ( funk, ev, ast, ctx, args ) {
			die "Too many arguments for false()" unless args.empty;
			return funk.wrap( false );
		},
	),
	
	new Func(
		spelling: "null",
		f: function ( funk, ev, ast, ctx, args ) {
			die "Too many arguments for null()" unless args.empty;
			return funk.wrap( null );
		},
	),
	
	new Func(
		spelling: "die",
		f: function ( funk, ev, ast, ctx, args ) {
			die "Called 'die' function in zpath";
		},
	),
	
	new Func(
		spelling: "count",
		f: function ( funk, ev, ast, ctx, args ) {
			let n := 0;
			for ( let a in args ) {
				const got := ev.eval_expr( a, ev.nested_ctx( ctx ) );
				n += got.length;
			}
			else {
				const cur := ctx.parentset ?: ctx.nodeset;
				n := cur.length;
			}
			return funk.wrap( n );
		},
	),

	new Func(
		spelling: "index",
		f: function ( funk, ev, ast, ctx, args ) {
			if ( args.length = 0 ) {
				const cur := ctx.nodeset.get( 0, null );
				return funk.wrap( cur ? cur.ix : null );
			}
			else if ( args.length = 1 ) {
				const got := ev.eval_expr( args[0], ev.nested_ctx( ctx ) );
				return got.map( fn x \u2192 funk.wrap_for_array(x.ix) );
			}
			die "Too many arguments for index()";
		},
	),
	
	new Func(
		spelling: "key",
		f: function ( funk, ev, ast, ctx, args ) {
			if ( args.length = 0 ) {
				const cur := ctx.nodeset.get( 0, null );
				return funk.wrap( cur ? cur.key : null );
			}
			else if ( args.length = 1 ) {
				const got := ev.eval_expr( args[0], ev.nested_ctx( ctx ) );
				return got.map(
					fn x \u2192 funk.wrap_for_array(
						x \u2261 null ? null : x.key
					)
				);
			}
			die "Too many arguments for key()";
		},
	),

	new Func(
		spelling: "type",
		f: function ( funk, ev, ast, ctx, args ) {
			if ( args.length = 0 ) {
				const cur := ctx.nodeset.get( 0, null );
				return funk.wrap( cur ? cur.type : "undefined" );
			}
			else if ( args.length = 1 ) {
				const got := ev.eval_expr( args[0], ev.nested_ctx( ctx ) ).get( 0, null );
				return funk.wrap( got ? got.type : "undefined" );
			}
			die "Too many arguments for type()";
		},
	),
	
	new Func(
		spelling: "union",
		f: function ( funk, ev, ast, ctx, args ) {
			let out := [];
			for ( let arg in args ) {
				const got := ev.eval_expr( arg, ev.nested_ctx( ctx ) );
				for ( let n in got ) {
					out.push( n );
				}
			}
			return ev.dedup_nodes( out );
		},
	),
	
	new Func(
		spelling: "intersection",
		f: function ( funk, ev, ast, ctx, args ) {
			return [] if args.empty;

			let out := ev.eval_expr( args[0], ev.nested_ctx( ctx ) );
			out := ev.dedup_nodes( out );

			let i := 1;
			while ( i < args.length() ) {
				let got := ev.eval_expr( args[i], ev.nested_ctx( ctx ) );
				got := ev.dedup_nodes( got );

				let seen := {};
				for ( let n in got ) {
					let key := n.id();
					if ( key \u2261 null ) {
						key := "anon:" _ ( "" _ n.raw() );
					}
					seen.set( key, true );
				}

				let next_out := [];
				for ( let n in out ) {
					let key := n.id();
					if ( key \u2261 null ) {
						key := "anon:" _ ( "" _ n.raw() );
					}
					if ( seen.exists(key) ) {
						next_out.push(n);
					}
				}

				out := next_out;
				last if out.empty;
				i++;
			}

			return ev.dedup_nodes( out );
		},
	),
	
	new Func(
		spelling: "is-first",
		f: function ( funk, ev, ast, ctx, args ) {
			if ( args.length = 0 ) {
				const cur := ctx.nodeset.get( 0, null );
				return [] unless cur and cur.parent;
				return funk.wrap( cur.ix = 0 );
			}
			die "Too many arguments for is-first()";
		},
	),

	new Func(
		spelling: "is-last",
		f: function ( funk, ev, ast, ctx, args ) {
			if ( args.length = 0 ) {
				const cur := ctx.nodeset.get( 0, null );
				return [] unless cur and cur.parent and cur.ix \u2262 null;
				const siblings := cur.parent.children
					.grep( fn kid \u2192 kid.key \u2261 cur.key );
				return [] if siblings.empty;
				let pos := 0;
				while ( pos < siblings.length ) {
					const kid := siblings[pos];
					last if kid.id() \u2261 cur.id();
					pos++;
				}
				return [] if pos \u2265 siblings.length;
				return funk.wrap( pos = siblings.length - 1 );
			}
			die "Too many arguments for is-last()";
		},
	),
	
	new Func(
		spelling: "next",
		f: function ( funk, ev, ast, ctx, args ) {
			if ( args.length = 0 ) {
				const cur := ctx.nodeset.get( 0, null );
				return [ cur.next_sibling ];
			}
			else {
				let out := [];
				for ( let arg in args ) {
					const got := ev.eval_expr( arg, ev.nested_ctx( ctx ) );
					for ( let n in got ) {
						out.push( n.next_sibling );
					}
				}
				return out;
			}
		},
	),
	
	new Func(
		spelling: "prev",
		f: function ( funk, ev, ast, ctx, args ) {
			if ( args.length = 0 ) {
				const cur := ctx.nodeset.get( 0, null );
				return [ cur.prev_sibling ];
			}
			else {
				let out := [];
				for ( let arg in args ) {
					const got := ev.eval_expr( arg, ev.nested_ctx( ctx ) );
					for ( let n in got ) {
						out.push( n.prev_sibling );
					}
				}
				return out;
			}
		},
	),
	
	new Func(
		spelling: "string",
		f: function ( funk, ev, ast, ctx, args ) {
			if ( args.length = 0 ) {
				const cur := ctx.nodeset.get( 0, null );
				return [] unless cur;
				return funk.wrap( cur.string_value );
			}
			else {
				let out := [];
				for ( let arg in args ) {
					const got := ev.eval_expr( arg, ev.nested_ctx( ctx ) );
					for ( let n in got ) {
						out.push( n );
					}
				}
				return out.map( fn x \u2192 funk.wrap_for_array( x.string_value ) );
			}
		},
	),

	new Func(
		spelling: "number",
		f: function ( funk, ev, ast, ctx, args ) {
			if ( args.length = 0 ) {
				const cur := ctx.nodeset.get( 0, null );
				return [] unless cur;
				return funk.wrap( cur.number_value );
			}
			else {
				let out := [];
				for ( let arg in args ) {
					const got := ev.eval_expr( arg, ev.nested_ctx( ctx ) );
					for ( let n in got ) {
						out.push( n );
					}
				}
				return out.map( fn x \u2192 funk.wrap_for_array( x.number_value ) );
			}
		},
	),

	new Func(
		spelling: "value",
		f: function ( funk, ev, ast, ctx, args ) {
			if ( args.length = 0 ) {
				const cur := ctx.nodeset.get( 0, null );
				return [] unless cur;
				return funk.wrap( cur.primitive_value );
			}
			else {
				let out := [];
				for ( let arg in args ) {
					const got := ev.eval_expr( arg, ev.nested_ctx( ctx ) );
					for ( let n in got ) {
						out.push( n );
					}
				}
				return out.map( fn x \u2192 funk.wrap_for_array( x.primitive_value ) );
			}
		},
	),

	new Func(
		spelling: "ceil",
		f: mk_single_number_function( "ceil", fn n \u2192 ceil n ),
	),

	new Func(
		spelling: "floor",
		f: mk_single_number_function( "floor", fn n \u2192 floor n ),
	),

	new Func(
		spelling: "round",
		f: mk_single_number_function( "round", fn n \u2192 round n ),
	),

	new Func(
		spelling: "sum",
		f: mk_aggregate_number_function( "sum", fn nums \u2192 Math.sum(nums) ),
	),

	new Func(
		spelling: "min",
		f: mk_aggregate_number_function( "min", fn nums \u2192 Math.min(nums) ),
	),

	new Func(
		spelling: "max",
		f: mk_aggregate_number_function( "max", fn nums \u2192 Math.max(nums) ),
	),

	new Func(
		spelling: "escape",
		f: mk_single_string_function( "escape", fn s \u2192 escape_xml(s) ),
	),

	new Func(
		spelling: "unescape",
		f: mk_single_string_function( "unescape", fn s \u2192 unescape_xml(s) ),
	),

	new Func(
		spelling: "upper-case",
		f: mk_single_string_function( "upper-case", fn s \u2192 uc s ),
	),

	new Func(
		spelling: "lower-case",
		f: mk_single_string_function( "lower-case", fn s \u2192 lc s ),
	),

	new Func(
		spelling: "index-of",
		f: function ( funk, ev, ast, ctx, args ) {
			let nodes := [];
			let search;
			
			if ( args.empty ) {
				die "Not enough arguments for index-of()";
			}
			else {
				search := try {
					ev.eval_expr( args[0], ev.nested_ctx( ctx ) )[0].string_value;
				} catch {
					"";
				};
			}
			
			for ( let a in args[1:] ) {
				const got := ev.eval_expr( a, ev.nested_ctx( ctx ) );
				for ( let n in got ) {
					nodes.push( n );
				}
			}
			else {
				nodes := ctx.nodeset;
			}
			
			return nodes
				.map( fn x \u2192 x.string_value )
				.grep( fn x \u2192 typeof x eq "String" )
				.map( fn x \u2192 funk.wrap_for_array( index(x, search) ) );
		}
	),

	new Func(
		spelling: "last-index-of",
		f: function ( funk, ev, ast, ctx, args ) {
			let nodes := [];
			let search;
			
			if ( args.empty ) {
				die "Not enough arguments for last-index-of()";
			}
			else {
				search := try {
					ev.eval_expr( args[0], ev.nested_ctx( ctx ) )[0].string_value;
				} catch {
					"";
				};
			}
			
			for ( let a in args[1:] ) {
				const got := ev.eval_expr( a, ev.nested_ctx( ctx ) );
				for ( let n in got ) {
					nodes.push( n );
				}
			}
			else {
				nodes := ctx.nodeset;
			}
			
			return nodes
				.map( fn x \u2192 x.string_value )
				.grep( fn x \u2192 typeof x eq "String" )
				.map( fn x \u2192 funk.wrap_for_array( rindex(x, search) ) );
		}
	),

	new Func(
		spelling: "substring",
		f: function ( funk, ev, ast, ctx, args ) {

			let nodes := [];
			let start;
			let len;
			
			if ( args.length < 2 ) {
				die "Not enough arguments for substring()";
			}
			else {
				start := try {
					ev.eval_expr( args[-2], ev.nested_ctx( ctx ) )[0].number_value;
				} catch {
					0;
				};
				len := try {
					ev.eval_expr( args[-1], ev.nested_ctx( ctx ) )[0].number_value;
				} catch {
					0;
				};
			}
			
			for ( let a in args[0:-2] ) {
				const got := ev.eval_expr( a, ev.nested_ctx( ctx ) );
				for ( let n in got ) {
					nodes.push( n );
				}
			}
			else {
				nodes := ctx.nodeset;
			}
			
			return nodes
				.map( fn x \u2192 x.string_value )
				.grep( fn x \u2192 typeof x eq "String" )
				.map( fn x \u2192 funk.wrap_for_array( substr(x, start, len) ) );
		}
	),

	new Func(
		spelling: "format",
		f: function ( funk, ev, ast, ctx, args ) {
			let nodes := [];
			let fmt;
			
			if ( args.empty ) {
				die "Not enough arguments for format()";
			}
			else {
				fmt := try {
					ev.eval_expr( args[0], ev.nested_ctx( ctx ) )[0].string_value;
				} catch {
					"";
				};
			}
			
			for ( let a in args[1:] ) {
				const got := ev.eval_expr( a, ev.nested_ctx( ctx ) );
				for ( let n in got ) {
					nodes.push( n );
				}
			}
			else {
				nodes := ctx.nodeset;
			}
			
			return nodes
				.map( fn x \u2192 x.string_value )
				.grep( fn x \u2192 typeof x eq "String" )
				.map( fn x \u2192 funk.wrap_for_array( sprint(fmt, x) ) );
		}
	),

	new Func(
		spelling: "string-length",
		f: mk_single_string_function( "string-length", fn s \u2192 length s ),
	),

	new Func(
		spelling: "match",
		f: mk_match_function(),
	),

	new Func(
		spelling: "matches",
		f: mk_match_function(),
	),

	new Func(
		spelling: "replace",
		f: function ( funk, ev, ast, ctx, args ) {
			let nodes := [];
			let pattern;
			let replacement;
			
			if ( args.length < 2 ) {
				die "Not enough arguments for replace()";
			}
			else {
				pattern := try {
					ev.eval_expr( args[0], ev.nested_ctx( ctx ) )[0].string_value;
				} catch {
					"";
				};
				replacement := try {
					ev.eval_expr( args[1], ev.nested_ctx( ctx ) )[0].string_value;
				} catch {
					"";
				};
			}
			
			for ( let a in args[2:] ) {
				const got := ev.eval_expr( a, ev.nested_ctx( ctx ) );
				for ( let n in got ) {
					nodes.push( n );
				}
			}
			else {
				nodes := ctx.nodeset;
			}
			
			return nodes
				.map( fn x \u2192 x.string_value )
				.grep( fn x \u2192 typeof x eq "String" )
				.map( fn x \u2192 funk.wrap_for_array( replace( x, pattern, replacement ) ) );
		}
	),

	new Func(
		spelling: "join",
		f: function ( funk, ev, ast, ctx, args ) {
			let nodes := [];
			let joiner;
			
			if ( args.empty ) {
				die "Not enough arguments for format()";
			}
			else {
				joiner := try {
					ev.eval_expr( args[0], ev.nested_ctx( ctx ) )[0].string_value;
				} catch {
					"";
				};
			}
			
			for ( let a in args[1:] ) {
				const got := ev.eval_expr( a, ev.nested_ctx( ctx ) );
				for ( let n in got ) {
					nodes.push( n );
				}
			}
			else {
				nodes := ctx.nodeset;
			}
			
			const strings := nodes
				.map( fn x \u2192 x.string_value )
				.grep( fn x \u2192 typeof x eq "String" );
			return funk.wrap( join( joiner, strings ) );
		}
	),

	new Func(
		spelling: "url",
		f: function ( funk, ev, ast, ctx, args ) {
			if ( args.length = 0 ) {
				const cur := ctx.nodeset.get( 0, null );
				return [] unless cur;
				return funk.wrap( typeof cur eq "XmlNodeNode" ? cur.raw.namespaceURI() : null );
			}
			else if ( args.length = 1 ) {
				const got := ev.eval_expr( args[0], ev.nested_ctx( ctx ) );
				return got.map(
					fn x \u2192 funk.wrap_for_array(
						typeof x eq "XmlNodeNode" ? x.raw.namespaceURI() : null
					)
				);
			}
			die "Too many arguments for url()";
		},
	),

	new Func(
		spelling: "local-name",
		f: function ( funk, ev, ast, ctx, args ) {
			if ( args.length = 0 ) {
				const cur := ctx.nodeset.get( 0, null );
				return [] unless cur;
				return funk.wrap( typeof cur eq "XmlNodeNode" ? cur.raw.localName() : null );
			}
			else if ( args.length = 1 ) {
				const got := ev.eval_expr( args[0], ev.nested_ctx( ctx ) );
				return got.map(
					fn x \u2192 funk.wrap_for_array(
						typeof x eq "XmlNodeNode" ? x.raw.localName() : null
					)
				);
			}
			die "Too many arguments for local-name()";
		},
	),

	new Func(
		spelling: "tag",
		f: function ( funk, ev, ast, ctx, args ) {
			if ( args.length = 0 ) {
				const cur := ctx.nodeset.get( 0, null );
				return [] unless cur;
				return funk.wrap( cur.has_tagged ? cur.tagged{tag} : null );
			}
			else if ( args.length = 1 ) {
				const got := ev.eval_expr( args[0], ev.nested_ctx( ctx ) );
				return got.map(
					fn x \u2192 funk.wrap_for_array(
						typeof x.has_tagged ? x.tagged{tag} : null
					)
				);
			}
			die "Too many arguments for tag()";
		},
	),
];
`;
        virtualFiles["/modules/std/path/z/lexer.zzm"] = '=encoding utf8\n\n=head1 NAME\n\nstd/path/z/lexer - Pure Zuzu lexer for ZPath expressions.\n\n=head1 DESCRIPTION\n\nThis module ports the C<Data::ZPath::_Lexer> Perl class to pure ZuzuScript\nwith a near line-by-line translation and matching public API.\n\n=cut\n\nfrom std/string import substr;\n\nclass Lexer {\n	let src := "";\n	let scan_i := 0;\n	let toks := [];\n	let pos := 0;\n	let allowed_operators;\n\n	method __build__ () {\n		die "Expected some operators" unless allowed_operators;\n		toks := self._tokenize(src);\n	}\n\n	method peek () {\n		return toks[pos];\n	}\n	\n	method peek_n ( n ) {\n		return toks[pos + n];\n	}\n	\n	method peek_kind () {\n		return toks[pos]{k};\n	}\n\n	method peek_kind_n ( n ) {\n		return toks[pos + n]{k};\n	}\n\n	method next_tok () {\n		let tok := toks[pos];\n		pos++;\n		return tok;\n	}\n\n	method expect ( k ) {\n		let t := self.next_tok();\n		die `Expected ${k}, got ${t{k}}` if t{k} \u2262 k;\n		return t;\n	}\n\n	method _is_ws ( c ) {\n		return c \u2262 null and c ~ /\\s/;\n	}\n\n	method _prev_sig ( chars, idx ) {\n		let j := idx - 1;\n		while ( j >= 0 ) {\n			if ( chars[j] ~ /\\s/ ) {\n				j--;\n				next;\n			}\n			return chars[j];\n		}\n		return null;\n	}\n\n	method _next_sig ( chars, idx, n ) {\n		let j := idx + 1;\n		while ( j < n ) {\n			if ( chars[j] ~ /\\s/ ) {\n				j++;\n				next;\n			}\n			return chars[j];\n		}\n		return null;\n	}\n\n	method _is_path_ctx_prev ( c ) {\n		return c \u2261 "[" or c \u2261 "(" or c \u2261 "," or c \u2261 ":" or c \u2261 "?" or c \u2261 "/";\n	}\n\n	method _is_path_ctx_next ( c ) {\n		return c \u2261 "]" or c \u2261 ")" or c \u2261 "," or c \u2261 ":" or c \u2261 "?" or c \u2261 "/";\n	}\n\n	method _ws_on_both ( left, right ) {\n		return self._is_ws(left) and self._is_ws(right);\n	}\n\n	method known_operators () {\n		return allowed_operators;\n	}\n\n	method _sorted_operators () {\n		return self.known_operators()\n			.grep( fn o \u2192 not o.lexer_should_ignore )\n			.sort( fn ( x, y ) \u2192 y.char_length <=> x.char_length );\n	}\n\n	method _operator_at ( chars, i, n, ops ) {\n		let oi := 0;\n		while ( oi < ops.length ) {\n			let op := ops[oi];\n			let spell := op{spelling};\n			let m := length spell;\n			if ( i + m <= n ) {\n				let got := "";\n				let j := 0;\n				while ( j < m ) {\n					got _= chars[i + j];\n					j++;\n				}\n				if ( got \u2261 spell ) {\n					return op;\n				}\n			}\n			oi++;\n		}\n		return null;\n	}\n\n	method _is_name_char ( c ) {\n		return c ~ /[A-Za-z0-9_\\-]/;\n	}\n\n	method _tokenize ( String source ) {\n		let t := [];\n		let chars := [];\n		let n := length source;\n		let ops := self._sorted_operators();\n		let z := 0;\n		while ( z < n ) {\n			chars.push( substr( source, z, 1 ) );\n			z++;\n		}\n\n		let i := 0;\n		while ( i < n ) {\n			let ch := chars[i];\n\n			if ( ch ~ /\\s/ ) {\n				i++;\n				next;\n			}\n\n			let prev := i > 0 ? chars[i - 1] : null;\n			let nxt := i + 1 < n ? chars[i + 1] : null;\n\n			let prev_nonws := self._prev_sig( chars, i );\n			let next_nonws := self._next_sig( chars, i, n );\n\n			function push_token ( tok ) {\n				tok{ws_before} := self._is_ws(prev) ? true : false;\n				tok{ws_after}  := self._is_ws(nxt)  ? true : false;\n				t.push( tok );\n			}\n\n			if ( ch \u2261 "/" ) {\n				if (\n					self._ws_on_both( prev, nxt )\n					and prev_nonws \u2262 null and next_nonws \u2262 null\n					and not self._is_path_ctx_prev(prev_nonws)\n					and not self._is_path_ctx_next(next_nonws)\n				) {\n					push_token( { k: "SLASH", v: "/" } );\n					i++;\n					next;\n				}\n				if (\n					( self._is_ws(prev) xor self._is_ws(nxt) )\n					and prev_nonws \u2262 null and next_nonws \u2262 null\n					and not self._is_path_ctx_prev(prev_nonws)\n					and not self._is_path_ctx_next(next_nonws)\n				) {\n					die `Binary operator \'/\' requires whitespace around it`;\n				}\n				t.push( { k: "SLASH_PATH", v: "/" } );\n				i++;\n				next;\n			}\n\n			let op := self._operator_at( chars, i, n, ops );\n			if ( op \u2262 null ) {\n				let spell := op.get_spelling();\n				let need_ws := op.requires_whitespace();\n				let m := length spell;\n				let op_prev := i > 0 ? chars[i - 1] : null;\n				let op_next := i + m < n ? chars[i + m] : null;\n\n				let left_name := false;\n				let right_name := false;\n				if ( spell ~ /^[A-Za-z_]/ ) {\n					left_name := op_prev \u2262 null and self._is_name_char(op_prev);\n					right_name := op_next \u2262 null and self._is_name_char(op_next);\n				}\n\n				if ( not left_name and not right_name ) {\n					if ( need_ws ) {\n						if ( self._ws_on_both( op_prev, op_next ) ) {\n							push_token( { k: op.get_kind(), v: spell } );\n							i := i + m;\n							next;\n						}\n						die `Binary operator \'${spell}\' requires whitespace around it`;\n					}\n					push_token( { k: op.get_kind(), v: spell } );\n					i := i + m;\n					next;\n				}\n			}\n\n			if ( ch \u2261 "(" ) { t.push( { k: "LPAREN", v: "(" } ); i++; next; }\n			if ( ch \u2261 ")" ) { t.push( { k: "RPAREN", v: ")" } ); i++; next; }\n			if ( ch \u2261 "[" ) { t.push( { k: "LBRACK", v: "[" } ); i++; next; }\n			if ( ch \u2261 "]" ) { t.push( { k: "RBRACK", v: "]" } ); i++; next; }\n			if ( ch \u2261 "," ) { t.push( { k: "COMMA", v: "," } ); i++; next; }\n\n			if ( ch \u2261 "." ) {\n				if ( i + 2 < n and chars[i + 1] \u2261 "." and chars[i + 2] \u2261 "*" ) {\n					push_token( { k: "DOTDOTSTAR", v: "..*" } );\n					i := i + 3;\n					next;\n				}\n				if ( i + 1 < n and chars[i + 1] \u2261 "." ) {\n					push_token( { k: "DOTDOT", v: ".." } );\n					i := i + 2;\n					next;\n				}\n				push_token( { k: "DOT", v: "." } );\n				i++;\n				next;\n			}\n\n			if ( ch \u2261 "*" and self._ws_on_both( prev, nxt ) ) {\n				push_token( { k: "STAR", v: "*" } );\n				i++;\n				next;\n			}\n\n			if ( ch \u2261 "*" ) {\n				if ( i + 1 < n and chars[i + 1] \u2261 "*" ) {\n					push_token( { k: "STARSTAR", v: "**" } );\n					i := i + 2;\n					next;\n				}\n				push_token( { k: "STAR_PATH", v: "*" } );\n				i++;\n				next;\n			}\n\n			if ( ch \u2261 "?" or ch \u2261 ":" ) {\n				if ( self._ws_on_both( prev, nxt ) ) {\n					push_token( { k: ch \u2261 "?" ? "QMARK" : "COLON", v: ch } );\n					i++;\n					next;\n				}\n				die `Ternary operator \'${ch}\' requires whitespace around it`;\n			}\n\n			if ( ch \u2261 "\\"" or ch \u2261 "\'" ) {\n				let quote := ch;\n				i++;\n				let s := "";\n				let esc := false;\n				while ( i < n ) {\n					let cc := chars[i];\n					i++;\n					if ( esc ) {\n						if ( cc \u2261 "\\\\" or cc \u2261 quote or cc \u2261 "\\"" or cc \u2261 "\'" ) {\n							s _= cc;\n						}\n						else {\n							s _= self._unescape_char(cc);\n						}\n						esc := false;\n						next;\n					}\n					if ( cc \u2261 "\\\\" ) { esc := true; next; }\n					last if cc \u2261 quote;\n					s _= cc;\n				}\n				push_token( { k: "STRING", v: s, q: quote } );\n				next;\n			}\n\n			if ( ch \u2261 "#" ) {\n				let j := i + 1;\n				let neg := false;\n				if ( j < n and chars[j] \u2261 "-" ) {\n					neg := true;\n					j++;\n				}\n				die "Invalid index \'#\'" if j >= n or not( chars[j] ~ /\\d/ );\n				let num := "";\n				while ( j < n and chars[j] ~ /\\d/ ) {\n					num _= chars[j];\n					j++;\n				}\n				let parsed := 0 + num;\n				parsed := 0 - parsed if neg;\n				push_token( { k: "INDEX", v: parsed } );\n				i := j;\n				next;\n			}\n\n			if ( ch ~ /[0-9]/ ) {\n				let j := i;\n				let num := "";\n				while ( j < n and chars[j] ~ /[0-9.]/ ) {\n					num _= chars[j];\n					j++;\n				}\n				push_token( { k: "NUMBER", v: 0 + num } );\n				i := j;\n				next;\n			}\n\n			let name := self._read_name( chars, i );\n			if ( name{v} \u2262 "" ) {\n				push_token( { k: "NAME", v: name{v} } );\n				i := name{i};\n				next;\n			}\n\n			die `Unexpected character \'${ch}\' at position ${i}`;\n		}\n\n		t.push( { k: "EOF", v: "" } );\n		return t;\n	}\n\n	method _unescape_char ( c ) {\n		return "\\n" if c \u2261 "n";\n		return "\\r" if c \u2261 "r";\n		return "\\t" if c \u2261 "t";\n		return c;\n	}\n\n	method _read_name ( chars, start_i ) {\n		let n := chars.length();\n		let delim := {\n			"\\n": true,\n			"\\r": true,\n			"\\t": true,\n			"(": true,\n			")": true,\n			"[": true,\n			"]": true,\n			"/": true,\n			",": true,\n			"=": true,\n			"&": true,\n			"|": true,\n			"!": true,\n			"<": true,\n			">": true,\n			"#": true,\n			" ": true,\n		};\n		let buf := "";\n		let esc := false;\n		let i := start_i;\n\n		while ( i < n ) {\n			let c := chars[i];\n			if ( esc ) {\n				buf _= c;\n				esc := false;\n				i++;\n				next;\n			}\n\n			if ( c \u2261 "\\\\" ) {\n				esc := true;\n				i++;\n				next;\n			}\n\n			last if delim.exists(c);\n			last if c ~ /\\s/;\n			buf _= c;\n			i++;\n		}\n\n		return { v: "", i: start_i } if buf \u2261 "";\n		return { v: buf, i: i };\n	}\n}\n';
        virtualFiles["/modules/std/path/z/node.zzm"] = '=encoding utf8\n\n=head1 NAME\n\nstd/path/z/node - Node wrapper used by std/path/z.\n\n=head1 DESCRIPTION\n\nObjects of this class wrap underlying values and provide traversal and\ncoercion helpers used while evaluating ZPath expressions.\n\n=cut\n\nfrom std/internals import ref_id;\nfrom std/math import Math;\nfrom std/string import index, substr;\n\nlet determine_class;\n\nclass Node {\n	let raw with set := null;\n	let parent := null;\n	let key := null;\n	let id := null;\n	let ix := null;\n	let tagged with set, has := null;\n\n	static method _xml_node_type_code ( value ) {\n		try {\n			return int( "" _ value.nodeType() );\n		}\n		catch {\n			return null;\n		}\n	}\n\n	static method from_root ( obj ) {\n		return self.wrap(obj);\n	}\n\n	static method wrap ( _obj, parent?, key?, ix? ) {\n		\n		let obj := _obj;\n\n		if ( obj instanceof Node ) {\n			return obj;\n		}\n\n		let Klass := determine_class( obj );\n		\n		let n := new Klass(\n			raw: obj,\n			parent: parent,\n			key: key,\n			ix: ix,\n		);\n		\n		if ( typeof obj eq "TaggedValue" ) {\n			n.set_tagged(obj);\n			while ( typeof obj eq "TaggedValue" ) {\n				obj := obj{value}\n			}\n			n.set_raw(obj);\n		}\n		\n		n._build_id;\n		\n		return n;\n	}\n	\n	method _use_ref_as_id () {\n		return false;\n	}\n	\n	method _build_id () {\n		id := self._generate_id;\n	}\n	\n	method _generate_id () {\n		\n		if ( self._use_ref_as_id ) {\n			return "ref:" _ ref_id(raw);\n		}\n		\n		if ( parent \u2261 null ) {\n			return "root";\n		}\n		\n		if ( ix \u2262 null ) {\n			if ( key \u2262 null ) {\n				return parent.id _ "/" _ key _ "#" _ ix;\n			}\n			return parent.id _ "/#" _ ix;\n		}\n		\n		if ( key \u2262 null ) {\n			return parent.id _ "/" _ key;\n		}\n		\n		return "rand:" _ floor( 1000 * 1000 * 1000 * Math.rand() );\n	}\n	\n	method raw ()    { return raw; }\n	method parent () { return parent; }\n	method key ()    { return key; }\n	method id ()     { return id; }\n	method ix ()     { return ix; }\n	method index ()  { return ix; }\n	method tagged () { return tagged; }\n\n	method type () {\n		return typeof raw;\n	}\n\n	method value () {\n		return raw;\n	}\n\n	method primitive_value () {\n		return raw;\n	}\n\n	method string_value () {\n		let p := self.primitive_value;\n		return p \u2261 null ? null : "" _ p;\n	}\n\n	method number_value () {\n		let v := self.primitive_value();\n		return 0 + v if v ~ /^-?(?:[0-9]+(?:\\.[0-9]+)?|\\.[0-9]+)$/;\n		return null;\n	}\n\n	method can_have_named_children () {\n		return false;\n	}\n\n	method can_have_indexed_children () {\n		return false;\n	}\n\n	method can_have_named_indexed_children () {\n		return false;\n	}\n\n	method named_child ( name ) {\n		self.children.first( fn kid \u2192 kid.key \u2261 name );\n	}\n\n	method indexed_child ( i ) {\n		self.children.first( fn kid \u2192 kid.ix \u2261 i );\n	}\n	\n	method named_indexed_child ( name, i ) {\n		self.children.first( fn kid \u2192 kid.ix \u2261 i and kid.key \u2261 name );\n	}\n	\n	method next_child ( child ) {\n		let i := child.ix;\n		return null if i \u2261 null; \n		return self.indexed_child( i + 1 );\n	}\n\n	method prev_child ( child ) {\n		let i := child.ix;\n		return null if i \u2261 null; \n		return null if i = 0;\n		return self.indexed_child( i - 1 );\n	}\n\n	method next_sibling () {\n		return self.parent.next_child( self );\n	}\n\n	method prev_sibling () {\n		return self.parent.prev_child( self );\n	}\n\n	method named_attribute ( name ) {\n		let attrname := ( name ~ /^@/ ) ? name : `@${name}`;\n		self.attributes.first( fn kid \u2192 kid.name \u2261 attrname );\n	}\n\n	method children () {\n		return [];\n	}\n\n	method attributes () {\n		return [];\n	}\n	\n	method name () {\n		return key;\n	}\n\n	method dump () {\n		return {\n			"@type": self.type(),\n			"@id": self.id(),\n			"@key": self.key(),\n			"@index": self.index(),\n			"@value": self.primitive_value(),\n			children: self.children().map( fn c -> c.dump() ),\n			attributes: self.attributes().map( fn a -> a.dump() ),\n		};\n	}\n\n	method find ( zpath ) {\n		// Stub for now.\n		die "Node.find is not implemented yet";\n	}\n\n	method do_action ( action ) {\n		const container_node := self.parent();\n		die "Path assignment target has no parent node"\n			if container_node \u2261 null;\n		return container_node.do_action_on_child( self, action );\n	}\n\n	method ref () {\n		const container_node := self.parent();\n		die "Path assignment target has no parent node"\n			if container_node \u2261 null;\n		return container_node.ref_on_child(self);\n	}\n\n	method do_action_on_child ( child, action ) {\n		die `Path assignment target container \'${self.type()}\' is not assignable`;\n	}\n\n	method ref_on_child ( child ) {\n		die `Path assignment target container \'${self.type()}\' is not assignable`;\n	}\n}\n\nclass SimpleNode extends Node {\n}\n\nclass StringNode extends SimpleNode {\n	\n	method string_value () {\n		let raw := self.raw;\n		if ( typeof raw eq "BinaryString" ) {\n			return to_string( raw );\n		}\n		return raw;\n	}\n	\n	method type () {\n		return "string";\n	}\n}\n\nclass NumberNode extends SimpleNode {\n	method number_value () {\n		let raw := self.raw;\n		return raw;\n	}\n	\n	method type () {\n		return "number";\n	}\n}\n\nclass BooleanNode extends SimpleNode {\n	method type () {\n		return "boolean";\n	}\n}\n\nclass NullNode extends SimpleNode {\n	method type () {\n		return "null";\n	}\n}\n\nclass ArrayNode extends Node {\n\n	method _use_ref_as_id () {\n		return true;\n	}\n	\n	method type () {\n		return "list";\n	}\n	\n	method children () {\n		let raw := self.raw;\n		let out := [];\n		let i := 0;\n		while ( i < raw.length ) {\n			let child := Node.wrap( raw[i], self, null, i );\n			out.push(child);\n			i++;\n		}\n		return out;\n	}\n	\n	method can_have_indexed_children () {\n		return false;\n	}\n\n	method do_action_on_child ( child, action ) {\n		return super( child, action ) if action{op} ne ":=";\n\n		const ix := child.ix();\n		die "Path assignment expects numeric array index" if ix \u2261 null;\n		let container := self.raw();\n		container[ix] := action{value};\n		return action{value};\n	}\n\n	method ref_on_child ( child ) {\n		const ix := child.ix();\n		die "Path assignment expects numeric array index" if ix \u2261 null;\n		let container := self.raw();\n		return \\ container[ix];\n	}\n}\n\nclass SetNode extends Node {\n	\n	method _use_ref_as_id () {\n		return true;\n	}\n\n	method children () {\n		let raw := self.raw;\n		let out := [];\n		let i := 0;\n		while ( i < raw.length ) {\n			let child := Node.wrap( raw[i], self, null, null );\n			out.push(child);\n			i++;\n		}\n		return out;\n	}\n}\n\nclass BagNode extends Node {\n	\n	method _use_ref_as_id () {\n		return true;\n	}\n\n	method children () {\n		let raw := self.raw;\n		let out := [];\n		let i := 0;\n		while ( i < raw.length ) {\n			let child := Node.wrap( raw[i], self, null, null );\n			out.push(child);\n			i++;\n		}\n		return out;\n	}\n}\n\nclass DictNode extends Node {\n\n	method _use_ref_as_id () {\n		return true;\n	}\n	\n	method type () {\n		return "map";\n	}\n	\n	method children () {\n		let raw := self.raw;\n		let out := [];\n		for ( let k in raw.keys() ) {\n			let child := Node.wrap( raw.get(k), self, k );\n			out.push(child);\n		}\n		return out;\n	}\n	\n	method can_have_named_children () {\n		return true;\n	}\n\n	method do_action_on_child ( child, action ) {\n		return super( child, action ) if action{op} ne ":=";\n\n		const key := child.key();\n		die "Path assignment expects string dict key" if key \u2261 null;\n		let container := self.raw();\n		container{(key)} := action{value};\n		return action{value};\n	}\n\n	method ref_on_child ( child ) {\n		const key := child.key();\n		die "Path assignment expects string dict key" if key \u2261 null;\n		let container := self.raw();\n		return \\ container{(key)};\n	}\n}\n\nclass PairListNode extends Node {\n	\n	method _use_ref_as_id () {\n		return true;\n	}\n	\n	method children () {\n		die "TODO";\n	}\n	\n	method can_have_named_children () {\n		return true;\n	}\n	\n	method can_have_indexed_children () {\n		return true;\n	}\n	\n	method can_have_named_indexed_children () {\n		return true;\n	}\n\n	method do_action_on_child ( child, action ) {\n		return super( child, action ) if action{op} ne ":=";\n\n		const key := child.key();\n		die "Path assignment expects string pairlist key" if key \u2261 null;\n\n		let hash := index( key, "#" );\n		let pair_key := hash < 0 ? key : substr( key, 0, hash );\n		let container := self.raw();\n		container.set( pair_key, action{value} );\n		return action{value};\n	}\n\n	method ref_on_child ( child ) {\n		const key := child.key();\n		die "Path assignment expects string pairlist key" if key \u2261 null;\n\n		let hash := index( key, "#" );\n		let pair_key := hash < 0 ? key : substr( key, 0, hash );\n		let container := self.raw();\n		return \\ container{(pair_key)};\n	}\n}\n\nclass PairNode extends Node {\n	\n	method attributes () {\n		let raw := self.raw;\n		return [ "key", "value" ]\n			.map( fn a \u2192 Node.wrap( raw.(a)(), self, `@${a}` ) );\n	}\n}\n\nclass XmlNodeNode extends Node {\n\n	method _generate_id () {\n		return\n			try {\n				let i := self.raw.unique_id;\n				i \u2261 null ? super() : `xml:${i}`;\n			}\n			catch {\n				super();\n			};\n	}\n\n	method type () {\n		let raw := self.raw;\n		if ( typeof raw eq "XMLDocument" ) {\n			return "document";\n		}\n		switch ( Node._xml_node_type_code(raw) ) {\n			case 1:\n				return "element";\n			case 2, 18:\n				return "attr";\n			case 3, 4:\n				return "text";\n			case 8:\n				return "comment";\n			case 9:\n				return "document";\n		}\n		\n		return super();\n	}\n	\n	method name () {\n		let raw := self.raw;\n		switch ( Node._xml_node_type_code(raw) ) {\n			case 1:\n				return raw.nodeName();\n			case 2, 18:\n				return "@" _ raw.nodeName();\n			case 3, 4:\n				return "#text";\n		}\n		\n		return super();\n	}\n\n	method next_child ( child ) {\n		return child.next_sibling;\n	}\n\n	method prev_child ( child ) {\n		return child.prev_sibling;\n	}\n\n	method next_sibling () {\n		let x := self.raw.nextSibling;\n		return null if x \u2261 null;\n		return Node.wrap( x, self.parent, x.nodeName );\n	}\n\n	method prev_sibling () {\n		let x := self.raw.previousSibling;\n		return null if x \u2261 null;\n		return Node.wrap( x, self.parent, x.nodeName );\n	}\n\n	method primitive_value () {\n		let raw := self.raw;\n		if ( typeof raw eq "XMLDocument" ) {\n			let de := raw.documentElement();\n			return de \u2261 null ? null : de.textContent();\n		}\n		switch ( Node._xml_node_type_code(raw) ) {\n			case 1:\n				return raw.textContent;\n			case 2, 18:\n				return raw.nodeValue();\n			case 3, 4, 8:\n				return raw.data;\n			case 9:\n				let de := raw.documentElement();\n				return de \u2261 null ? null : de.textContent();\n		}\n		\n		return super();\n	}\n	\n	method string_value () {\n		let raw := self.raw;\n		if ( typeof raw eq "XMLDocument" ) {\n			let de := raw.documentElement();\n			return de \u2261 null ? null : de.textContent();\n		}\n		switch ( Node._xml_node_type_code(raw) ) {\n			case 1:\n				return raw.textContent;\n			case 2, 18:\n				return raw.nodeValue();\n			case 3, 4, 8:\n				return raw.data;\n			case 9:\n				let de := raw.documentElement();\n				return de \u2261 null ? null : de.textContent();\n		}\n\n		return super();\n	}\n\n	method can_have_named_children () {\n		return true;\n	}\n	\n	method can_have_indexed_children () {\n		return true;\n	}\n	\n	method can_have_named_indexed_children () {\n		return true;\n	}\n	\n	method children () {\n		let raw := self.raw;\n		if ( typeof raw eq "XMLDocument" ) {\n			let de := raw.documentElement();\n			return de \u2261 null ? []\n				: [ Node.wrap( de, self, de.nodeName(), 0 ) ];\n		}\n		let node_type := Node._xml_node_type_code(raw);\n		if ( node_type = 9 ) {\n			let de := raw.documentElement();\n			return de \u2261 null ? []\n				: [ Node.wrap( de, self, de.nodeName(), 0 ) ];\n		}\n\n		if ( node_type = 1 ) {\n			let kids := [];\n			let count := {};\n			for ( let child in raw.childNodes() ) {\n				let nm := child.nodeName();\n				let n := count.exists(nm) ? count.get( nm ) : 0;\n				count.set( nm, n + 1 );\n				kids.push( Node.wrap( child, self, nm, n ) );\n			}\n			return kids;\n		}\n\n		return [];\n	}\n\n	method attributes () {\n		let raw := self.raw;\n		let out := super();\n		if ( Node._xml_node_type_code(raw) \u2261 1 ) {\n			for ( let attr in raw.attributes() ) {\n				let n := Node.wrap( attr, self, "@" _ attr.nodeName() );\n				out.push(n);\n			}\n		}\n		return out;\n	}\n}\n\nclass TimeNode extends Node {\n	\n	method string_value () {\n		let raw := self.raw;\n		return raw.datetime;\n	}\n	\n	method number_value () {\n		let raw := self.raw;\n		return raw.epoch;\n	}\n	\n	method attributes () {\n		let raw := self.raw;\n		return [ "year", "month", "day", "hour", "min", "sec" ]\n			.map( fn a \u2192 Node.wrap( raw.(a)(), self, `@${a}` ) );\n	}\n}\n\nclass PathNode extends Node {\n\n	method string_value () {\n		let raw := self.raw;\n		return raw.to_String;\n	}\n	\n	method attributes () {\n		let raw := self.raw;\n		if ( raw.is_file ) {\n			const stat := raw.stat;\n			return stat.keys.map( fn a \u2192 Node.wrap( stat{a}, self, `@${a}` ) );\n		}\n		\n		return super();\n	}\n}\n\n// Need to define the body of this function late so it can refer back to\n// classes that have been declared.\n\ndetermine_class := function ( obj ) {\n	let Klass;\n	\n	let real_obj := obj;\n	while ( typeof real_obj eq "TaggedValue" ) {\n		real_obj := real_obj{value};\n	}\n	\n	switch ( typeof real_obj : eq ) {\n		case "Null":\n			Klass := NullNode;\n		case "Boolean":\n			Klass := BooleanNode;\n		case "Number":\n			Klass := NumberNode;\n		case "String", "BinaryString":\n			Klass := StringNode;\n		case "Array":\n			Klass := ArrayNode;\n		case "Bag":\n			Klass := BagNode;\n		case "Set":\n			Klass := SetNode;\n		case "Dict":\n			Klass := DictNode;\n		case "PairList":\n			Klass := PairListNode;\n		case "Pair":\n			Klass := PairNode;\n		case "XMLNode", "XMLDocument", "DOMNode":\n			Klass := XmlNodeNode;\n		case "DOMElement", "DOMAttr", "DOMText", "DOMComment", "DOMDocument":\n			Klass := XmlNodeNode;\n		case "Time":\n			Klass := TimeNode;\n		case "Path":\n			Klass := PathNode;\n		default:\n			if ( real_obj instanceof "Object" ) {\n				if ( real_obj can __zpath_node_class__ ) {\n					Klass = real_obj.__zpath_node_class__;\n				}\n			}\n	}\n\n	if ( Klass \u2261 null ) {\n		try {\n			let maybe_node_type := real_obj.nodeType();\n			Klass := XmlNodeNode if maybe_node_type \u2262 null;\n		}\n		catch {\n		}\n	}\n	\n	return Klass ?: Node;\n};\n';
        virtualFiles["/modules/std/path/z/operators.zzm"] = 'from std/path/z/node import Node;\n\nfunction _floaty_modulus ( ln, rn ) {\n	let count := floor( ln / rn ); //\n	return ln - ( count * rn );\n}\n\ntrait EvalHelpers {\n	method _handle_numeric_operand ( ev, ctx, expr ) {\n		const result := ev.eval_expr( expr, ev.nested_ctx( ctx ) );\n		return 0 unless result.length;\n		return ev.to_number( result[0] );\n	}\n	\n	method _handle_stringy_operand ( ev, ctx, expr ) {\n		const result := ev.eval_expr( expr, ev.nested_ctx( ctx ) );\n		return 0 unless result.length;\n		return ev.to_number( result[0] );\n	}\n	\n	method wrap ( value ) {\n		return [ Node.wrap( value ) ];\n	}\n	\n	method wrap_for_array ( value ) {\n		return Node.wrap( value );\n	}\n}\n\nclass Operator with EvalHelpers {\n	let String spelling with get;\n	let String alias with get, has;\n	let String kind with get;\n	let Number precedence with get;\n	let Boolean unary      := false;\n	let Boolean require_ws := false;\n	let Boolean lex_ignore := false;\n	let Function f;\n	\n	method is_unary () {\n		return unary;\n	}\n	\n	method is_binary () {\n		return not unary;\n	}\n	\n	method requires_whitespace () {\n		return require_ws;\n	}\n	\n	method lexer_should_ignore () {\n		return lex_ignore;\n	}\n	\n	method char_length () {\n		return length spelling;\n	}\n	\n	method precedence_is ( lvl ) {\n		return precedence = lvl;\n	}\n}\n\nconst STANDARD_OPERATORS := [\n	new Operator(\n		spelling: "||",\n		kind: "OROR",\n		precedence: 2,\n		f: function ( op, ev, ast, ctx, left, right ) {\n			const left_val := ev.eval_expr( left, ev.nested_ctx( ctx ) );\n			if ( left_val.length and ev.truthy( left_val[0] ) ) {\n				return op.wrap( true );\n			}\n			const right_val := ev.eval_expr( right, ev.nested_ctx( ctx ) );\n			if ( right_val.length and ev.truthy( right_val[0] ) ) {\n				return op.wrap( true );\n			}\n			return op.wrap( false );\n		},\n	),\n	\n	new Operator(\n		spelling: "&&",\n		kind: "ANDAND",\n		precedence: 4,\n		f: function ( op, ev, ast, ctx, left, right ) {\n			const left_val := ev.eval_expr( left, ev.nested_ctx( ctx ) );\n			if ( left_val.length and ev.truthy( left_val[0] ) ) {\n				const right_val := ev.eval_expr( right, ev.nested_ctx( ctx ) );\n				if ( right_val.length and ev.truthy( right_val[0] ) ) {\n					return op.wrap( true );\n				}\n			}\n			return op.wrap( false );\n		},\n	),\n	\n	new Operator(\n		spelling: "==",\n		kind: "EQEQ",\n		precedence: 12,\n		f: function ( op, ev, ast, ctx, left, right ) {\n			const left_vals  := ev.eval_expr( left, ev.nested_ctx( ctx ) );\n			const right_vals := ev.eval_expr( right, ev.nested_ctx( ctx ) );\n			let is_eq := false;\n			\n			if ( left_vals and right_vals ) {\n				for ( let ln in left_vals ) {\n					last if is_eq;\n					for ( let rn in right_vals ) {\n						last if is_eq;\n						if ( ev.equals( ln, rn ) ) {\n							is_eq := true;\n						}\n					}\n				}\n			}\n			\n			return op.wrap( is_eq );\n		},\n	),\n	\n	new Operator(\n		spelling: "!=",\n		kind: "NEQ",\n		precedence: 12,\n		f: function ( op, ev, ast, ctx, left, right ) {\n			const left_vals  := ev.eval_expr( left, ev.nested_ctx( ctx ) );\n			const right_vals := ev.eval_expr( right, ev.nested_ctx( ctx ) );\n			let is_eq := false;\n			\n			if ( left_vals and right_vals ) {\n				for ( let ln in left_vals ) {\n					last if is_eq;\n					for ( let rn in right_vals ) {\n						last if is_eq;\n						if ( ev.equals( ln, rn ) ) {\n							is_eq := true;\n						}\n					}\n				}\n			}\n			\n			return op.wrap( not is_eq );\n		},\n	),\n	\n	new Operator(\n		spelling: ">=",\n		kind: "GE",\n		precedence: 14,\n		f: function ( op, ev, ast, ctx, left, right ) {\n			let left_val  := op._handle_numeric_operand( ev, ctx, left );\n			let right_val := op._handle_numeric_operand( ev, ctx, right );\n			if ( ( left_val \u2261 null ) or ( right_val \u2261 null ) ) {\n				left_val  := op._handle_stringy_operand( ev, ctx, left );\n				right_val := op._handle_stringy_operand( ev, ctx, right );\n				return op.wrap( left_val ge right_val );\n			}\n			return op.wrap( left_val \u2265 right_val );\n		},\n	),\n	\n	new Operator(\n		spelling: "<=",\n		kind: "LE",\n		precedence: 14,\n		f: function ( op, ev, ast, ctx, left, right ) {\n			let left_val  := op._handle_numeric_operand( ev, ctx, left );\n			let right_val := op._handle_numeric_operand( ev, ctx, right );\n			if ( ( left_val \u2261 null ) or ( right_val \u2261 null ) ) {\n				left_val  := op._handle_stringy_operand( ev, ctx, left );\n				right_val := op._handle_stringy_operand( ev, ctx, right );\n				return op.wrap( left_val le right_val );\n			}\n			return op.wrap( left_val \u2264 right_val );\n		},\n	),\n	\n	new Operator(\n		spelling: "+", \n		kind: "PLUS",\n		require_ws: true,\n		precedence: 16,\n		f: function ( op, ev, ast, ctx, left, right ) {\n			const left_val  := op._handle_numeric_operand( ev, ctx, left );\n			const right_val := op._handle_numeric_operand( ev, ctx, right );\n			return op.wrap( left_val + right_val );\n		},\n	),\n	\n	new Operator(\n		spelling: "-", \n		kind: "MINUS",\n		require_ws: true,\n		precedence: 16,\n		f: function ( op, ev, ast, ctx, left, right ) {\n			const left_val  := op._handle_numeric_operand( ev, ctx, left );\n			const right_val := op._handle_numeric_operand( ev, ctx, right );\n			return op.wrap( left_val - right_val );\n		},\n	),\n	\n	new Operator(\n		spelling: "%", \n		kind: "PCT",\n		require_ws: true,\n		precedence: 18,\n		f: function ( op, ev, ast, ctx, left, right ) {\n			const left_val  := op._handle_numeric_operand( ev, ctx, left );\n			const right_val := op._handle_numeric_operand( ev, ctx, right );\n			if ( ( left_val ~ /\\./ ) or ( right_val ~ /\\./ ) ) {\n				return op.wrap( _floaty_modulus( left_val, right_val ) );\n			}\n			return op.wrap( left_val mod right_val );\n		},\n	),\n	\n	new Operator(\n		spelling: "*", \n		kind: "TIMES",\n		require_ws: true,\n		precedence: 18,\n		lex_ignore: true,\n		alias: "STAR",\n		f: function ( op, ev, ast, ctx, left, right ) {\n			const left_val  := op._handle_numeric_operand( ev, ctx, left );\n			const right_val := op._handle_numeric_operand( ev, ctx, right );\n			return op.wrap( left_val \xD7 right_val );\n		},\n	),\n	\n	new Operator(\n		spelling: "/", \n		kind: "DIVIDE",\n		require_ws: true,\n		precedence: 18,\n		lex_ignore: true,\n		alias: "SLASH",\n		f: function ( op, ev, ast, ctx, left, right ) {\n			const left_val  := op._handle_numeric_operand( ev, ctx, left );\n			const right_val := op._handle_numeric_operand( ev, ctx, right );\n			return op.wrap( left_val \xF7 right_val );\n		},\n	),\n	\n	new Operator(\n		spelling: "^", \n		kind: "BXOR",\n		precedence: 8,\n		f: function ( op, ev, ast, ctx, left, right ) {\n			const left_val  := op._handle_numeric_operand( ev, ctx, left );\n			const right_val := op._handle_numeric_operand( ev, ctx, right );\n			return op.wrap( left_val ^ right_val );\n		},\n	),\n	\n	new Operator(\n		spelling: "&", \n		kind: "BAND",\n		precedence: 10,\n		f: function ( op, ev, ast, ctx, left, right ) {\n			const left_val  := op._handle_numeric_operand( ev, ctx, left );\n			const right_val := op._handle_numeric_operand( ev, ctx, right );\n			return op.wrap( left_val & right_val );\n		},\n	),\n	\n	new Operator(\n		spelling: "|", \n		kind: "BOR",\n		precedence: 6,\n		f: function ( op, ev, ast, ctx, left, right ) {\n			const left_val  := op._handle_numeric_operand( ev, ctx, left );\n			const right_val := op._handle_numeric_operand( ev, ctx, right );\n			return op.wrap( left_val | right_val );\n		},\n	),\n	\n	new Operator(\n		spelling: ">", \n		kind: "GT",\n		precedence: 14,\n		f: function ( op, ev, ast, ctx, left, right ) {\n			let left_val  := op._handle_numeric_operand( ev, ctx, left );\n			let right_val := op._handle_numeric_operand( ev, ctx, right );\n			if ( ( left_val \u2261 null ) or ( right_val \u2261 null ) ) {\n				left_val  := op._handle_stringy_operand( ev, ctx, left );\n				right_val := op._handle_stringy_operand( ev, ctx, right );\n				return op.wrap( left_val gt right_val );\n			}\n			return op.wrap( left_val > right_val );\n		},\n	),\n	\n	new Operator(\n		spelling: "<", \n		kind: "LT",\n		precedence: 14,\n		f: function ( op, ev, ast, ctx, left, right ) {\n			let left_val  := op._handle_numeric_operand( ev, ctx, left );\n			let right_val := op._handle_numeric_operand( ev, ctx, right );\n			if ( ( left_val \u2261 null ) or ( right_val \u2261 null ) ) {\n				left_val  := op._handle_stringy_operand( ev, ctx, left );\n				right_val := op._handle_stringy_operand( ev, ctx, right );\n				return op.wrap( left_val le right_val );\n			}\n			return op.wrap( left_val < right_val );\n		},\n	),\n	\n	new Operator(\n		spelling: "!", \n		kind: "NOT"\n		unary: true,\n		precedence: 20,\n	),\n	\n	new Operator(\n		spelling: "~", \n		kind: "BNOT"\n		unary: true,\n		precedence: 20,\n	),\n];\n';
        virtualFiles["/modules/std/path/z/parser.zzm"] = '=encoding utf8\n\n=head1 NAME\n\nstd/path/z/parser - Pure Zuzu parser for ZPath expressions.\n\n=head1 DESCRIPTION\n\nThis module ports the C<Data::ZPath::_Parser> Perl class to pure\nZuzuScript with a near line-by-line translation and matching public API.\n\n=cut\n\nfrom std/string import trim;\nfrom std/path/z/lexer import Lexer;\n\nclass Parser {\n	let lexer_class;\n	let allowed_operators;\n	let _binop_prec := {};\n	let _unop_prec  := {};\n	let _need_ws    := {};\n\n	method __build__ () {\n		lexer_class ?:= Lexer;\n		for ( let op in allowed_operators ) {\n			let spell := op.get_spelling();\n			if ( op.is_unary() ) {\n				_unop_prec.set( spell, op.get_precedence() );\n			}\n			else {\n				_binop_prec.set( spell, op.get_precedence() );\n				if ( op.requires_whitespace() ) {\n					_need_ws.set( spell, true );\n				}\n			}\n		}\n	}\n	\n	method parse_top_level_terms ( src ) {\n		let terms := [];\n		let lexer := new lexer_class(\n			src:               src,\n			allowed_operators: allowed_operators,\n		);\n\n		while ( true ) {\n			let expr := self.parse_expression(lexer);\n			terms.push(expr);\n			if ( lexer.peek_kind() \u2261 "COMMA" ) {\n				lexer.next_tok();\n				next;\n			}\n			lexer.expect("EOF");\n			last;\n		}\n\n		return terms;\n	}\n\n	method _trim ( s ) {\n		return trim(s);\n	}\n\n	method parse_expression ( lx ) {\n		return self.parse_ternary(lx);\n	}\n\n	method parse_ternary ( lx ) {\n		let cond := self.parse_subexpression( lx, 1 );\n\n		if ( lx.peek_kind() \u2261 "QMARK" ) {\n			lx.next_tok();\n			let then := self.parse_expression(lx); // ZZPath should use: self.parse_subexpression( lx, 1 )\n			lx.expect("COLON");\n			let els := self.parse_expression(lx);\n			return { t: "ternary", c: cond, a: then, b: els };\n		}\n\n		return cond;\n	}\n\n	method parse_subexpression ( lx, min_prec ) {\n		let left := self._parse_maybe_unary( lx, min_prec );\n\n		while ( true ) {\n			let spell := lx.peek{v};\n			let op_prec := _binop_prec.get( spell, null );\n			last if op_prec \u2261 null or op_prec < min_prec;\n\n			let op := lx.next_tok;\n			if ( _need_ws.exists( spell ) ) {\n				if ( not ( op{ws_before} and op{ws_after} ) ) {\n					die `Binary operator \'${spell}\' requires whitespace around it`;\n				}\n			}\n\n			let right := self.parse_subexpression( lx, op_prec + 1 );\n			left := { t: "bin", op: spell, l: left, r: right };\n		}\n\n		return left;\n	}\n\n	method _parse_maybe_unary ( lx, min_prec ) {\n		let spell := lx.peek{v};\n		let op_prec := _unop_prec.get( spell, null );\n		if ( op_prec \u2262 null and op_prec >= min_prec ) {\n			let op := lx.next_tok{v};\n			let e  := self._parse_maybe_unary( lx, op_prec );\n			return { t: "un", op: op, e: e };\n		}\n		return self.parse_primary( lx );\n	}\n\n	method parse_primary ( lx ) {\n		let k := lx.peek_kind;\n\n		if ( k \u2261 "NUMBER" ) {\n			return { t: "num", v: lx.next_tok(){v} };\n		}\n		if ( k \u2261 "STRING" ) {\n			return { t: "str", v: lx.next_tok(){v} };\n		}\n		if ( k \u2261 "LPAREN" ) {\n			lx.next_tok();\n			let e := self.parse_expression(lx);\n			lx.expect("RPAREN");\n			return e;\n		}\n\n		if ( k \u2261 "NAME" and lx.peek_kind_n(1) \u2261 "LPAREN" ) {\n			let name := lx.next_tok(){v};\n			lx.expect("LPAREN");\n			let args := [];\n			if ( lx.peek_kind() \u2262 "RPAREN" ) {\n				args.push( self.parse_expression(lx) );\n				while ( lx.peek_kind() \u2261 "COMMA" ) {\n					lx.next_tok();\n					args.push( self.parse_expression(lx) );\n				}\n			}\n			lx.expect("RPAREN");\n			return { t: "fn", n: name, a: args };\n		}\n\n		return self._parse_path_expr(lx);\n	}\n\n	method _is_path_terminator ( k ) {\n		return true if k \u2261 "EOF";\n		return true if k \u2261 "COMMA";\n		return true if k \u2261 "RPAREN";\n		return true if k \u2261 "RBRACK";\n		return true if k \u2261 "QMARK";\n		return true if k \u2261 "COLON";\n		return true if k \u2261 "EQEQ";\n		return true if k \u2261 "NEQ";\n		return true if k \u2261 "GE";\n		return true if k \u2261 "LE";\n		return true if k \u2261 "GT";\n		return true if k \u2261 "LT";\n		return true if k \u2261 "ANDAND";\n		return true if k \u2261 "OROR";\n		return true if k \u2261 "PLUS";\n		return true if k \u2261 "MINUS";\n		return true if k \u2261 "STAR";\n		return true if k \u2261 "SLASH";\n		return true if k \u2261 "PCT";\n		return true if k \u2261 "BAND";\n		return true if k \u2261 "BOR";\n		return true if k \u2261 "BXOR";\n		return false;\n	}\n\n	method _parse_path_expr ( lx ) {\n		let segs := [];\n\n		if ( lx.peek_kind() \u2261 "SLASH_PATH" ) {\n			lx.next_tok();\n			let root := { k: "root", q: [] };\n			segs.push(root);\n\n			if ( lx.peek_kind() \u2261 "LBRACK" ) {\n				root{q} := self._parse_qualifiers(lx);\n			}\n\n			if ( self._is_path_terminator( lx.peek_kind() ) ) {\n				return { t: "path", s: segs };\n			}\n		}\n		else if ( lx.peek_kind() \u2261 "LBRACK" ) {\n			let seg := { k: "dot", q: self._parse_qualifiers(lx) };\n			segs.push(seg);\n			if (\n				lx.peek_kind() \u2261 "EOF"\n				or lx.peek_kind() \u2261 "COMMA"\n				or lx.peek_kind() \u2261 "RPAREN"\n				or lx.peek_kind() \u2261 "RBRACK"\n			) {\n				return { t: "path", s: segs };\n			}\n		}\n\n		if (\n			lx.peek_kind() \u2262 "SLASH_PATH"\n			and lx.peek_kind() \u2262 "EOF"\n			and lx.peek_kind() \u2262 "COMMA"\n			and lx.peek_kind() \u2262 "RPAREN"\n			and lx.peek_kind() \u2262 "RBRACK"\n		) {\n			segs.push( self._parse_path_segment(lx) );\n		}\n\n		while ( lx.peek_kind() \u2261 "SLASH_PATH" ) {\n			lx.next_tok();\n			if ( lx.peek_kind() \u2261 "LBRACK" ) {\n				let seg := { k: "star", q: [] };\n				seg{q} := self._parse_qualifiers(lx);\n				segs.push(seg);\n				next;\n			}\n			segs.push( self._parse_path_segment(lx) );\n		}\n\n		return { t: "path", s: segs };\n	}\n\n	method _parse_path_segment ( lx ) {\n		let k := lx.peek_kind();\n		let seg := null;\n\n		if ( k \u2261 "DOT" ) {\n			lx.next_tok();\n			seg := { k: "dot" };\n		}\n		else if ( k \u2261 "DOTDOT" ) {\n			lx.next_tok();\n			seg := { k: "parent" };\n		}\n		else if ( k \u2261 "DOTDOTSTAR" ) {\n			lx.next_tok();\n			seg := { k: "ancestors" };\n		}\n		else if ( k \u2261 "STAR_PATH" ) {\n			lx.next_tok();\n			seg := { k: "star" };\n		}\n		else if ( k \u2261 "STARSTAR" ) {\n			lx.next_tok();\n			seg := { k: "desc" };\n		}\n		else if ( k \u2261 "INDEX" ) {\n			let i := lx.next_tok(){v};\n			seg := { k: "index", i: i };\n		}\n		else if ( k \u2261 "NUMBER" ) {\n			let i := lx.next_tok(){v};\n			seg := { k: "index", i: i };\n		}\n		else if ( k \u2261 "NAME" and lx.peek_kind_n(1) \u2261 "LPAREN" ) {\n			let name := lx.next_tok(){v};\n			lx.expect("LPAREN");\n			let args := [];\n			if ( lx.peek_kind() \u2262 "RPAREN" ) {\n				args.push( self.parse_expression(lx) );\n				while ( lx.peek_kind() \u2261 "COMMA" ) {\n					lx.next_tok();\n					args.push( self.parse_expression(lx) );\n				}\n			}\n			lx.expect("RPAREN");\n			seg := { k: "fnseg", n: name, a: args };\n		}\n		else if ( k \u2261 "NAME" ) {\n			let n := lx.next_tok(){v};\n			seg := { k: "name", n: n };\n		}\n		else {\n			die `Unexpected token in path segment: ${k}`;\n		}\n\n		if ( seg{k} \u2261 "name" and lx.peek_kind() \u2261 "INDEX" ) {\n			seg{i} := lx.next_tok(){v};\n		}\n\n		seg{q} := self._parse_qualifiers(lx);\n		return seg;\n	}\n\n	method _parse_qualifiers ( lx ) {\n		let q := [];\n\n		while ( lx.peek_kind() \u2261 "LBRACK" ) {\n			lx.next_tok();\n			let e := self.parse_expression(lx);\n			lx.expect("RBRACK");\n			q.push(e);\n		}\n\n		return q;\n	}\n}\n';
        return {
          repoRoot: "/",
          jsModules,
          virtualFiles
        };
      }
      module.exports = {
        createBrowserStdlib
      };
    }
  });

  // extras/zuzu-js/lib/host/browser-host.js
  var require_browser_host = __commonJS({
    "extras/zuzu-js/lib/host/browser-host.js"(exports, module) {
      "use strict";
      function _splitPath(value) {
        return String(value ?? "").split(/[\\/]+/u).filter(Boolean);
      }
      function _normalizePath(value) {
        const isAbs = String(value ?? "").startsWith("/");
        const stack = [];
        for (const part of _splitPath(value)) {
          if (part === ".") {
            continue;
          }
          if (part === "..") {
            if (stack.length > 0) {
              stack.pop();
            }
            continue;
          }
          stack.push(part);
        }
        if (isAbs) {
          return `/${stack.join("/")}`;
        }
        return stack.join("/") || ".";
      }
      function _resolvePath(...parts) {
        const raw = parts.map((item) => String(item ?? "")).join("/");
        const seeded = raw.startsWith("/") ? raw : `/${raw}`;
        return _normalizePath(seeded);
      }
      function _dirname(value) {
        const normalized = _normalizePath(value);
        if (normalized === "/" || normalized === ".") {
          return "/";
        }
        const parts = _splitPath(normalized);
        parts.pop();
        return parts.length > 0 ? `/${parts.join("/")}` : "/";
      }
      function _browserEval(source, context, _runOptions = {}) {
        context.globalThis = context;
        try {
          const expr = Function(
            "__zuzu_context",
            `with ( __zuzu_context ) { return ( ${source} ); }`
          );
          return expr(context);
        } catch (_exprError) {
          const script = Function(
            "__zuzu_context",
            `with ( __zuzu_context ) { ${source}
 }`
          );
          return script(context);
        }
      }
      function createBrowserHost(options = {}) {
        const repoRoot = options.repoRoot || "/";
        const includePaths = Array.isArray(options.includePaths) ? options.includePaths.map((item) => _resolvePath(item)) : [];
        const virtualFiles = new Map(Object.entries(options.virtualFiles || {}).map(([filename, source]) => [_resolvePath(filename), String(source)]));
        const jsModules = new Map(Object.entries(options.jsModules || {}).map(([filename, loaded]) => [_resolvePath(filename), loaded]));
        const fetchedFiles = /* @__PURE__ */ new Map();
        const fetchModule = typeof options.fetchModule === "function" ? options.fetchModule : null;
        const runInContext = typeof options.evaluate === "function" ? options.evaluate : _browserEval;
        const capabilities = /* @__PURE__ */ new Set([
          "console",
          "time",
          "module_load",
          "module_fetch",
          "file_availability",
          "http"
        ]);
        return {
          name: "browser",
          repoRoot,
          includePaths,
          capabilities,
          cwd() {
            return "/";
          },
          resolve(...parts) {
            return _resolvePath(...parts);
          },
          dirname(value) {
            return _dirname(value);
          },
          join(...parts) {
            return _normalizePath(parts.map((item) => String(item ?? "")).join("/"));
          },
          readFileText(filename) {
            const key = _resolvePath(filename);
            if (virtualFiles.has(key)) {
              return virtualFiles.get(key);
            }
            if (fetchedFiles.has(key)) {
              return fetchedFiles.get(key);
            }
            if (fetchModule) {
              const fetched = fetchModule(key);
              if (typeof fetched === "string") {
                fetchedFiles.set(key, fetched);
                return fetched;
              }
            }
            throw new Error(`Exception: Browser host cannot read file '${filename}'`);
          },
          fileExists(filename) {
            const key = _resolvePath(filename);
            if (virtualFiles.has(key) || jsModules.has(key) || fetchedFiles.has(key)) {
              return true;
            }
            if (fetchModule) {
              const fetched = fetchModule(key);
              if (typeof fetched === "string") {
                fetchedFiles.set(key, fetched);
                return true;
              }
            }
            return false;
          },
          runInContext(source, context, runOptions = {}) {
            return runInContext(source, context, runOptions);
          },
          consoleLog(value) {
            if (typeof options.consoleLog === "function") {
              options.consoleLog(value);
              return;
            }
          },
          now() {
            return Date.now();
          },
          getEnv(_name) {
            return null;
          },
          loadJsModule(filename) {
            const key = _resolvePath(filename);
            if (!jsModules.has(key)) {
              throw new Error(`Exception: Browser host has no JS module for '${filename}'`);
            }
            return jsModules.get(key);
          }
        };
      }
      module.exports = {
        createBrowserHost
      };
    }
  });

  // extras/zuzu-js/lib/transpiler-utils.js
  var require_transpiler_utils = __commonJS({
    "extras/zuzu-js/lib/transpiler-utils.js"(exports, module) {
      "use strict";
      function isEscaped(text, idx) {
        let k = idx - 1;
        let backslashes = 0;
        while (k >= 0 && text[k] === "\\") {
          backslashes++;
          k--;
        }
        return backslashes % 2 === 1;
      }
      function findMatching(source, start, openChar, closeChar) {
        let depth = 0;
        let quote = null;
        for (let i = start; i < source.length; i++) {
          const ch = source[i];
          if (quote) {
            if (ch === quote && !isEscaped(source, i)) {
              quote = null;
            }
            continue;
          }
          if (ch === '"' || ch === "'" || ch === "`") {
            quote = ch;
            continue;
          }
          if (ch === openChar) {
            depth++;
          } else if (ch === closeChar) {
            depth--;
            if (depth === 0) {
              return i;
            }
          }
        }
        return -1;
      }
      function splitCaseValues(text) {
        return text.split(",").map((v) => v.trim()).filter((v) => v.length > 0);
      }
      function stripPod(source) {
        const lines = source.split(/\r?\n/);
        const out = [];
        let inPod = false;
        for (const line of lines) {
          if (/^=cut\b/.test(line)) {
            inPod = false;
            continue;
          }
          if (/^=\w+/.test(line)) {
            inPod = true;
            continue;
          }
          if (inPod) {
            continue;
          }
          out.push(line);
        }
        return out.join("\n");
      }
      module.exports = {
        isEscaped,
        findMatching,
        splitCaseValues,
        stripPod
      };
    }
  });

  // extras/zuzu-js/lib/transpiler-new/errors.js
  var require_errors = __commonJS({
    "extras/zuzu-js/lib/transpiler-new/errors.js"(exports, module) {
      "use strict";
      var TranspilerSyntaxError = class extends Error {
        constructor(message, token = null) {
          const suffix = token && token.line != null && token.column != null ? ` at ${token.line}:${token.column}` : "";
          super(`${message}${suffix}`);
          this.name = "TranspilerSyntaxError";
          this.token = token;
        }
      };
      var UnsupportedSyntaxError = class extends Error {
        constructor(message, token = null) {
          const suffix = token && token.line != null && token.column != null ? ` at ${token.line}:${token.column}` : "";
          super(`${message}${suffix}`);
          this.name = "UnsupportedSyntaxError";
          this.token = token;
        }
      };
      module.exports = {
        TranspilerSyntaxError,
        UnsupportedSyntaxError
      };
    }
  });

  // extras/zuzu-js/lib/transpiler-new/lexer.js
  var require_lexer = __commonJS({
    "extras/zuzu-js/lib/transpiler-new/lexer.js"(exports, module) {
      "use strict";
      var { stripPod } = require_transpiler_utils();
      var {
        TranspilerSyntaxError,
        UnsupportedSyntaxError
      } = require_errors();
      var KEYWORDS = /* @__PURE__ */ new Set([
        "from",
        "import",
        "as",
        "let",
        "const",
        "function",
        "return",
        "if",
        "else",
        "true",
        "false",
        "null",
        "and",
        "or",
        "xor",
        "nand",
        "not",
        "not_in",
        "eq",
        "ne",
        "gt",
        "ge",
        "lt",
        "le",
        "cmp",
        "eqi",
        "nei",
        "gti",
        "gei",
        "lti",
        "lei",
        "cmpi",
        "mod",
        "abs",
        "sqrt",
        "floor",
        "ceil",
        "round",
        "int",
        "length",
        "uc",
        "lc",
        "say",
        "class",
        "trait",
        "try",
        "catch",
        "switch",
        "case",
        "default",
        "for",
        "while",
        "do",
        "fn",
        "next",
        "continue",
        "last",
        "unless",
        "export",
        "die",
        "new",
        "method",
        "static",
        "extends",
        "with",
        "but",
        "super",
        "does",
        "my",
        "our",
        "use",
        "package",
        "given",
        "when",
        "then",
        "elsif",
        "foreach",
        "in",
        "isa",
        "can",
        "does",
        "typeof",
        "debug",
        "warn",
        "assert",
        "throw",
        "sub",
        "union",
        "intersection",
        "difference",
        "subsetof",
        "supersetof",
        "equivalentof",
        "contains"
      ]);
      var SIMPLE_PUNCTUATION = /* @__PURE__ */ new Set(["(", ")", "{", "}", "[", "]", ",", ";", "."]);
      function decodeSimpleEscape(esc) {
        switch (esc) {
          case "n":
            return "\n";
          case "r":
            return "\r";
          case "t":
            return "	";
          case "b":
            return "\b";
          case "f":
            return "\f";
          case '"':
          case "'":
          case "`":
          case "\\":
            return esc;
          default:
            return null;
        }
      }
      function isDigit(ch) {
        return ch >= "0" && ch <= "9";
      }
      function isUnicodeLetter(ch) {
        return ch.toLowerCase() !== ch.toUpperCase();
      }
      function isIdentifierStart(ch) {
        return ch === "_" || ch === "$" || isUnicodeLetter(ch);
      }
      function isIdentifierPart(ch) {
        return isIdentifierStart(ch) || isDigit(ch);
      }
      function decodeBinaryLiteral(literal) {
        try {
          return Function(`"use strict"; return (${literal});`)();
        } catch (_err) {
          return literal.slice(1, -1);
        }
      }
      function makeToken(type, value, start, end, source) {
        return {
          type,
          value,
          start: start.offset,
          end: end.offset,
          line: start.line,
          column: start.column,
          endLine: end.line,
          endColumn: end.column,
          raw: source.slice(start.offset, end.offset)
        };
      }
      function readTemplateLiteral(text, start, state) {
        const parts = [];
        let offset = state.offset;
        let line = state.line;
        let column = state.column;
        function peek(n = 0) {
          return text[offset + n] || "";
        }
        function advance() {
          const ch = text[offset] || "";
          offset++;
          if (ch === "\n") {
            line++;
            column = 1;
          } else {
            column++;
          }
          return ch;
        }
        function cursor() {
          return { offset, line, column };
        }
        function skipQuoted() {
          const quote = advance();
          while (offset < text.length) {
            const ch = advance();
            if (ch === "\\") {
              advance();
              continue;
            }
            if (ch === quote) {
              return;
            }
          }
          throw new TranspilerSyntaxError("Unterminated quoted section in template literal");
        }
        function skipLineComment() {
          advance();
          advance();
          while (offset < text.length && peek() !== "\n") {
            advance();
          }
        }
        function skipBlockComment() {
          advance();
          advance();
          while (offset < text.length) {
            if (peek() === "*" && peek(1) === "/") {
              advance();
              advance();
              return;
            }
            advance();
          }
          throw new TranspilerSyntaxError("Unterminated block comment in template literal");
        }
        let textPart = "";
        advance();
        while (offset < text.length) {
          const ch = peek();
          if (ch === "`") {
            if (textPart.length > 0) {
              parts.push({
                type: "text",
                value: textPart
              });
            }
            advance();
            return {
              parts,
              end: cursor()
            };
          }
          if (ch === "\\") {
            advance();
            const escStart = cursor();
            const esc = advance();
            if (esc === "x") {
              const hi = advance();
              const lo = advance();
              if (!/[0-9A-Fa-f]/.test(hi) || !/[0-9A-Fa-f]/.test(lo)) {
                throw new TranspilerSyntaxError(
                  "Invalid hex escape sequence",
                  makeToken("escape", `x${hi}${lo}`, escStart, cursor(), text)
                );
              }
              textPart += String.fromCharCode(Number.parseInt(`${hi}${lo}`, 16));
              continue;
            }
            const decoded = decodeSimpleEscape(esc);
            if (decoded == null) {
              textPart += esc;
            } else {
              textPart += decoded;
            }
            continue;
          }
          if (ch === "$" && peek(1) === "{") {
            if (textPart.length > 0) {
              parts.push({
                type: "text",
                value: textPart
              });
              textPart = "";
            }
            advance();
            advance();
            const exprStart = offset;
            let depth = 1;
            while (offset < text.length) {
              if (peek() === '"' || peek() === "'" || peek() === "`") {
                skipQuoted();
                continue;
              }
              if (peek() === "/" && peek(1) === "/") {
                skipLineComment();
                continue;
              }
              if (peek() === "/" && peek(1) === "*") {
                skipBlockComment();
                continue;
              }
              const cur = advance();
              if (cur === "{") {
                depth++;
              } else if (cur === "}") {
                depth--;
                if (depth === 0) {
                  parts.push({
                    type: "expr",
                    value: text.slice(exprStart, offset - 1)
                  });
                  break;
                }
              }
            }
            if (depth !== 0) {
              throw new TranspilerSyntaxError("Unterminated template interpolation");
            }
            continue;
          }
          textPart += advance();
        }
        throw new TranspilerSyntaxError("Unterminated template literal", makeToken("template", "", start, cursor(), text));
      }
      function tokenize(source) {
        const text = stripPod(String(source ?? ""));
        const tokens = [];
        let lastToken = null;
        let offset = 0;
        let line = 1;
        let column = 1;
        function cursor() {
          return { offset, line, column };
        }
        function peek(n = 0) {
          return text[offset + n] || "";
        }
        function advance() {
          const ch = text[offset] || "";
          offset++;
          if (ch === "\n") {
            line++;
            column = 1;
          } else {
            column++;
          }
          return ch;
        }
        function addToken(type, value, start, end2) {
          const token = makeToken(type, value, start, end2, text);
          tokens.push(token);
          lastToken = token;
        }
        function canStartRegex() {
          if (!lastToken) {
            return true;
          }
          if (lastToken.type === "punctuation" && ["(", "[", "{", ",", ";"].includes(lastToken.value)) {
            return true;
          }
          if (lastToken.type === "operator") {
            return true;
          }
          if (lastToken.type === "keyword" && ["return", "case", "if", "while", "throw", "and", "or", "xor", "nand", "not"].includes(lastToken.value)) {
            return true;
          }
          return false;
        }
        while (offset < text.length) {
          const ch = peek();
          if (ch === " " || ch === "	" || ch === "\r" || ch === "\n") {
            advance();
            continue;
          }
          if (ch === "/" && peek(1) === "/") {
            while (offset < text.length && peek() !== "\n") {
              advance();
            }
            continue;
          }
          if (ch === "/" && peek(1) === "*") {
            advance();
            advance();
            while (offset < text.length && !(peek() === "*" && peek(1) === "/")) {
              advance();
            }
            if (offset >= text.length) {
              throw new TranspilerSyntaxError("Unterminated block comment");
            }
            advance();
            advance();
            continue;
          }
          const start = cursor();
          if (ch === "/" && peek(1) !== "/" && peek(1) !== "*" && canStartRegex()) {
            let pattern = "";
            advance();
            while (offset < text.length) {
              const cur = peek();
              if (cur === "\\") {
                pattern += advance();
                pattern += advance();
                continue;
              }
              if (cur === "/") {
                break;
              }
              if (cur === "\n") {
                throw new TranspilerSyntaxError("Unterminated regexp literal");
              }
              pattern += advance();
            }
            if (peek() !== "/") {
              throw new TranspilerSyntaxError("Unterminated regexp literal");
            }
            advance();
            let flags = "";
            while (/[a-z]/i.test(peek())) {
              flags += advance();
            }
            addToken("regexp", { pattern, flags }, start, cursor());
            continue;
          }
          if (ch === '"') {
            if (peek(1) === '"' && peek(2) === '"') {
              let value2 = "";
              advance();
              advance();
              advance();
              while (offset < text.length) {
                if (peek() === '"' && peek(1) === '"' && peek(2) === '"') {
                  advance();
                  advance();
                  advance();
                  addToken("string", value2, start, cursor());
                  value2 = null;
                  break;
                }
                value2 += advance();
              }
              if (value2 !== null) {
                throw new TranspilerSyntaxError("Unterminated triple-quoted string literal");
              }
              continue;
            }
            let value = "";
            advance();
            while (offset < text.length && peek() !== '"') {
              if (peek() === "\\") {
                const escStart = cursor();
                advance();
                const esc = advance();
                if (esc === "x") {
                  const hi = advance();
                  const lo = advance();
                  if (!/[0-9A-Fa-f]/.test(hi) || !/[0-9A-Fa-f]/.test(lo)) {
                    throw new TranspilerSyntaxError(
                      "Invalid hex escape sequence",
                      makeToken("escape", `x${hi}${lo}`, escStart, cursor(), text)
                    );
                  }
                  value += String.fromCharCode(Number.parseInt(`${hi}${lo}`, 16));
                } else {
                  const decoded = decodeSimpleEscape(esc);
                  if (decoded == null) {
                    throw new TranspilerSyntaxError(
                      `Unsupported escape sequence \\${esc}`,
                      makeToken("escape", esc, escStart, cursor(), text)
                    );
                  }
                  value += decoded;
                }
                continue;
              }
              value += advance();
            }
            if (peek() !== '"') {
              throw new TranspilerSyntaxError("Unterminated string literal");
            }
            advance();
            addToken("string", value, start, cursor());
            continue;
          }
          if (ch === "'") {
            let literal = advance();
            while (offset < text.length) {
              const cur = advance();
              literal += cur;
              if (cur === "\\") {
                if (offset < text.length) {
                  literal += advance();
                }
                continue;
              }
              if (cur === "'") {
                break;
              }
            }
            if (literal[literal.length - 1] !== "'") {
              throw new TranspilerSyntaxError("Unterminated binary string literal");
            }
            addToken("binary_string", decodeBinaryLiteral(literal), start, cursor());
            continue;
          }
          if (ch === "`") {
            const template = readTemplateLiteral(text, start, cursor());
            offset = template.end.offset;
            line = template.end.line;
            column = template.end.column;
            addToken("template", template.parts, start, template.end);
            continue;
          }
          const twoChar = ch + peek(1);
          const threeChar = twoChar + peek(2);
          if (["...", "<<<", ">>>", "**=", "?:=", "<=>"].includes(threeChar)) {
            advance();
            advance();
            advance();
            addToken("operator", threeChar, start, cursor());
            continue;
          }
          if (["{{", "<<", ">>", ":=", "==", "!=", "<=", ">=", "+=", "-=", "*=", "/=", "%=", "_=", "++", "--", "->", "?:", "**", "@@", "@?", "~=", "\u2282\u2283", "\xD7=", "\xF7="].includes(twoChar)) {
            advance();
            advance();
            addToken("operator", twoChar, start, cursor());
            continue;
          }
          if (ch === "_" && !isIdentifierPart(peek(1))) {
            advance();
            addToken("operator", "_", start, cursor());
            continue;
          }
          if (isDigit(ch)) {
            let value = "";
            while (isDigit(peek())) {
              value += advance();
            }
            if (peek() === "." && isDigit(peek(1))) {
              value += advance();
              while (isDigit(peek())) {
                value += advance();
              }
            }
            addToken("number", value, start, cursor());
            continue;
          }
          if (isIdentifierStart(ch)) {
            let value = "";
            while (isIdentifierPart(peek())) {
              value += advance();
            }
            if (KEYWORDS.has(value)) {
              addToken("keyword", value, start, cursor());
            } else {
              addToken("identifier", value, start, cursor());
            }
            continue;
          }
          if (SIMPLE_PUNCTUATION.has(ch)) {
            advance();
            addToken("punctuation", ch, start, cursor());
            continue;
          }
          if (["+", "-", "*", "/", "%", "<", ">", "=", "_", "?", ":", "~", "!", "\\", "&", "|", "^", "@", "\xD7", "\xF7", "\xAC", "\u22C0", "\u22C1", "\u22BB", "\u22BC"].includes(ch)) {
            advance();
            addToken("operator", ch, start, cursor());
            continue;
          }
          if (["\u2261", "\u2262", "\u2260", "\u2264", "\u2265", "\u2192", "\u221A", "\u230A", "\u230B", "\u2308", "\u2309", "\u2208", "\u2209", "\u22C3", "\u22C2", "\u2216", "\u2282", "\u2283", "\xAB", "\xBB", "\u2276", "\u2277"].includes(ch)) {
            advance();
            addToken("operator", ch, start, cursor());
            continue;
          }
          throw new UnsupportedSyntaxError(
            `Unsupported character ${JSON.stringify(ch)}`,
            makeToken("unsupported", ch, start, start, text)
          );
        }
        const end = cursor();
        tokens.push(makeToken("eof", "", end, end, text));
        return tokens;
      }
      module.exports = {
        tokenize
      };
    }
  });

  // extras/zuzu-js/lib/transpiler-new/ast.js
  var require_ast = __commonJS({
    "extras/zuzu-js/lib/transpiler-new/ast.js"(exports, module) {
      "use strict";
      function withLoc(node, start, end) {
        return {
          ...node,
          loc: {
            start: start ? {
              offset: start.start,
              line: start.line,
              column: start.column
            } : null,
            end: end ? {
              offset: end.end,
              line: end.endLine,
              column: end.endColumn
            } : null
          }
        };
      }
      module.exports = {
        withLoc
      };
    }
  });

  // extras/zuzu-js/lib/transpiler-new/parser.js
  var require_parser = __commonJS({
    "extras/zuzu-js/lib/transpiler-new/parser.js"(exports, module) {
      "use strict";
      var { withLoc } = require_ast();
      var { tokenize } = require_lexer();
      var {
        TranspilerSyntaxError,
        UnsupportedSyntaxError
      } = require_errors();
      function parse(tokens, options = {}) {
        let index = 0;
        function startLocFromToken(token) {
          return {
            start: token.start,
            line: token.line,
            column: token.column
          };
        }
        function startLocFromNode(node) {
          return {
            start: node.loc.start.offset,
            line: node.loc.start.line,
            column: node.loc.start.column
          };
        }
        function endLocFromToken(token) {
          return {
            end: token.end,
            endLine: token.endLine,
            endColumn: token.endColumn
          };
        }
        function endLocFromNode(node) {
          return {
            end: node.loc.end.offset,
            endLine: node.loc.end.line,
            endColumn: node.loc.end.column
          };
        }
        function current() {
          return tokens[index];
        }
        function peekToken(n = 1) {
          return tokens[index + n] || tokens[tokens.length - 1];
        }
        function previous() {
          return tokens[index - 1];
        }
        function canTerminateStatement() {
          const token = current();
          const prev = previous();
          if (!prev) {
            return false;
          }
          if (token.type === "punctuation" && token.value === "}") {
            return true;
          }
          if (token.type === "eof") {
            return true;
          }
          return token.line > prev.endLine;
        }
        function consumeStatementTerminator(message) {
          if (match("punctuation", ";")) {
            return;
          }
          if (canTerminateStatement()) {
            return;
          }
          throw new TranspilerSyntaxError(message || "Expected statement terminator", current());
        }
        function atEnd() {
          return current().type === "eof";
        }
        function match(type, value = null) {
          const token = current();
          if (token.type !== type) {
            return false;
          }
          if (value != null && token.value !== value) {
            return false;
          }
          index++;
          return true;
        }
        function expect(type, value = null, message = null) {
          const token = current();
          if (match(type, value)) {
            return previous();
          }
          throw new TranspilerSyntaxError(
            message || `Expected ${value != null ? `${type} ${value}` : type}`,
            token
          );
        }
        function expectIdentifier(message = "Expected identifier") {
          const token = current();
          if (token.type === "identifier" || token.type === "keyword") {
            index++;
            return token;
          }
          throw new TranspilerSyntaxError(message, token);
        }
        function parseProgram() {
          const body = [];
          const start = current();
          while (!atEnd()) {
            body.push(parseStatement());
          }
          return withLoc({
            type: "Program",
            body
          }, start, previous() || start);
        }
        function matchPairListClose() {
          if (current().type === "punctuation" && current().value === "}" && peekToken().type === "punctuation" && peekToken().value === "}") {
            index += 2;
            return true;
          }
          return false;
        }
        function parseExpressionRoot() {
          const expr = parseExpression();
          if (!atEnd()) {
            throw new TranspilerSyntaxError("Unexpected token after expression", current());
          }
          return expr;
        }
        function parseStatement() {
          const token = current();
          if (token.type === "punctuation" && token.value === ";") {
            index++;
            return withLoc({ type: "EmptyStatement" }, token, token);
          }
          if (token.type === "keyword") {
            switch (token.value) {
              case "from":
                return parseImportDeclaration();
              case "let":
              case "const":
                return parseVariableDeclaration();
              case "function":
                return parseFunctionDeclaration();
              case "return":
                return parseReturnStatement();
              case "if":
                return parseIfStatement();
              case "for":
                return parseForStatement();
              case "while":
                return parseWhileStatement();
              case "switch":
                return parseSwitchStatement();
              case "next":
              case "continue":
                return parseLoopControlStatement("ContinueStatement");
              case "last":
                return parseLoopControlStatement("BreakStatement");
              case "throw":
                return parseThrowStatement();
              case "die":
                return parseDieStatement();
              case "warn":
                return parseWarnStatement();
              case "assert":
                return parseAssertStatement();
              case "debug":
                return parseDebugStatement();
              case "say":
                return parseSayStatement();
              case "try":
                return parseTryStatement();
              case "class":
                return parseClassDeclaration();
              case "trait":
                return parseTraitDeclaration();
              case "export":
                return parseExportDeclaration();
              case "catch":
              case "unless":
                throw new UnsupportedSyntaxError(
                  `Keyword ${token.value} is not supported by zuzu-js transpilation yet`,
                  token
                );
              case "fn":
                return parseFunctionDeclarationLikeFn();
              default:
                break;
            }
          }
          if (token.type === "punctuation" && token.value === "{") {
            return parseBlockStatement();
          }
          return parseExpressionStatement();
        }
        function parseExportDeclaration() {
          const start = expect("keyword", "export");
          const token = current();
          const allowed = /* @__PURE__ */ new Set(["let", "const", "function", "fn", "class", "trait"]);
          if (token.type !== "keyword" || !allowed.has(token.value)) {
            throw new TranspilerSyntaxError("Expected declaration after export", token);
          }
          const declaration = parseStatement();
          declaration.exported = true;
          declaration.loc.start = {
            offset: start.start,
            line: start.line,
            column: start.column
          };
          return declaration;
        }
        function parseImportDeclaration() {
          const start = expect("keyword", "from");
          const moduleParts = [];
          while (!(current().type === "keyword" && (current().value === "import" || current().value === "try"))) {
            if (current().type === "identifier" || current().type === "keyword" || current().type === "operator" && current().value === "/" || current().type === "operator" && current().value === "." || current().type === "punctuation" && current().value === ".") {
              moduleParts.push(current().value);
              index++;
              continue;
            }
            if (current().type === "string") {
              moduleParts.push(current().value);
              index++;
              break;
            }
            throw new TranspilerSyntaxError("Invalid module path in import", current());
          }
          const tryMode = match("keyword", "try");
          expect("keyword", "import");
          let importAll = false;
          const specifiers = [];
          if (match("operator", "*")) {
            if (tryMode) {
              throw new TranspilerSyntaxError(
                "Wildcard import '*' cannot be combined with try import",
                previous()
              );
            }
            importAll = true;
          } else {
            do {
              const imported = expectIdentifier();
              let local = imported;
              if (match("keyword", "as")) {
                local = expectIdentifier("Expected alias name after as");
              }
              specifiers.push({
                type: "ImportSpecifier",
                imported: imported.value,
                local: local.value
              });
            } while (match("punctuation", ","));
          }
          let condition = null;
          if (current().type === "keyword" && ["if", "unless"].includes(current().value)) {
            const keyword = current();
            if (importAll) {
              throw new TranspilerSyntaxError(
                "Wildcard import '*' cannot be combined with postfix if/unless",
                keyword
              );
            }
            index++;
            condition = {
              type: "PostfixCondition",
              keyword: keyword.value,
              test: parseExpression()
            };
          }
          consumeStatementTerminator("Expected ; after import declaration");
          return withLoc({
            type: "ImportDeclaration",
            source: moduleParts.join(""),
            tryMode,
            importAll,
            specifiers,
            condition
          }, start, previous());
        }
        function parseVariableDeclaration() {
          const start = expect("keyword");
          let declaredType = null;
          let id = expectIdentifier();
          if (current().type === "identifier" && ![":=", "=", ";", ",", ")"].includes(current().value)) {
            declaredType = id.value;
            id = expectIdentifier();
          }
          let init = null;
          if (match("operator", ":=") || match("operator", "=")) {
            init = parseExpression();
          }
          consumeStatementTerminator("Expected ; after variable declaration");
          return withLoc({
            type: "VariableDeclaration",
            kind: start.value,
            declaredType,
            id: {
              type: "Identifier",
              name: id.value
            },
            init
          }, start, previous());
        }
        function parseFunctionDeclaration() {
          const start = expect("keyword", "function");
          const id = expectIdentifier();
          const params = parseParameterList();
          const returnType = parseOptionalReturnType();
          const body = parseBlockStatement();
          return withLoc({
            type: "FunctionDeclaration",
            id: {
              type: "Identifier",
              name: id.value
            },
            params,
            returnType,
            body
          }, start, previous());
        }
        function parseFunctionDeclarationLikeFn() {
          const start = expect("keyword", "fn");
          const id = expectIdentifier();
          const params = parseParameterList();
          const returnType = parseOptionalReturnType();
          const body = parseBlockStatement();
          return withLoc({
            type: "FunctionDeclaration",
            id: {
              type: "Identifier",
              name: id.value
            },
            params,
            returnType,
            body
          }, start, previous());
        }
        function parseClassDeclaration() {
          const start = expect("keyword", "class");
          const id = expectIdentifier("Expected class name");
          let base = null;
          if (match("keyword", "extends")) {
            const baseId = expectIdentifier("Expected base class name after extends");
            base = withLoc({
              type: "Identifier",
              name: baseId.value
            }, baseId, baseId);
          }
          const traits = parseTraitCompositionList();
          if (match("punctuation", ";")) {
            return withLoc({
              type: "ClassDeclaration",
              id: withLoc({
                type: "Identifier",
                name: id.value
              }, id, id),
              base,
              traits,
              body: [],
              shorthand: true
            }, start, previous());
          }
          expect("punctuation", "{", "Expected { to start class body");
          const body = [];
          while (!(current().type === "punctuation" && current().value === "}")) {
            if (atEnd()) {
              throw new TranspilerSyntaxError("Unterminated class declaration", current());
            }
            if (current().type === "punctuation" && current().value === ";") {
              index++;
              continue;
            }
            body.push(parseClassMember());
          }
          expect("punctuation", "}");
          return withLoc({
            type: "ClassDeclaration",
            id: withLoc({
              type: "Identifier",
              name: id.value
            }, id, id),
            base,
            traits,
            body,
            shorthand: false
          }, start, previous());
        }
        function parseTraitDeclaration() {
          const start = expect("keyword", "trait");
          const id = expectIdentifier("Expected trait name");
          expect("punctuation", "{", "Expected { to start trait body");
          const body = [];
          while (!(current().type === "punctuation" && current().value === "}")) {
            if (atEnd()) {
              throw new TranspilerSyntaxError("Unterminated trait declaration", current());
            }
            if (current().type === "punctuation" && current().value === ";") {
              index++;
              continue;
            }
            body.push(parseMethodDeclaration({ allowStatic: false }));
          }
          expect("punctuation", "}");
          return withLoc({
            type: "TraitDeclaration",
            id: withLoc({
              type: "Identifier",
              name: id.value
            }, id, id),
            body
          }, start, previous());
        }
        function parseTraitCompositionList() {
          const traits = [];
          if (current().type === "keyword" && ["with", "but"].includes(current().value)) {
            index++;
            do {
              const traitId = expectIdentifier("Expected trait name");
              traits.push(withLoc({
                type: "Identifier",
                name: traitId.value
              }, traitId, traitId));
            } while (match("punctuation", ","));
          }
          return traits;
        }
        function parseClassMember() {
          if (current().type === "keyword" && current().value === "static") {
            return parseMethodDeclaration({ allowStatic: true });
          }
          if (current().type === "keyword" && current().value === "method") {
            return parseMethodDeclaration({ allowStatic: true });
          }
          if (current().type === "keyword" && ["let", "const"].includes(current().value)) {
            return parseFieldDeclaration();
          }
          if (current().type === "keyword" && current().value === "class") {
            return parseClassDeclaration();
          }
          if (current().type === "keyword" && current().value === "trait") {
            return parseTraitDeclaration();
          }
          throw new UnsupportedSyntaxError("Unsupported class member", current());
        }
        function parseMethodDeclaration({ allowStatic = true } = {}) {
          const start = current();
          let isStatic = false;
          if (allowStatic && match("keyword", "static")) {
            isStatic = true;
          }
          expect("keyword", "method", "Expected method declaration");
          const id = expectIdentifier("Expected method name");
          const params = parseParameterList();
          const returnType = parseOptionalReturnType();
          const body = parseBlockStatement();
          return withLoc({
            type: "MethodDeclaration",
            id: withLoc({
              type: "Identifier",
              name: id.value
            }, id, id),
            params,
            returnType,
            body,
            static: isStatic
          }, start, previous());
        }
        function parseFieldDeclaration() {
          const start = expect("keyword");
          let typeName = null;
          let id = expectIdentifier("Expected field name");
          if (current().type === "identifier" && current().value !== "with" && !(current().type === "operator" && current().value === ":=") && !(current().type === "punctuation" && [";", "}"].includes(current().value))) {
            typeName = id.value;
            id = expectIdentifier("Expected field name after type");
          }
          const accessors = [];
          if (match("keyword", "with")) {
            do {
              accessors.push(expectIdentifier("Expected accessor name").value);
            } while (match("punctuation", ","));
          }
          let defaultValue = null;
          if (match("operator", ":=")) {
            defaultValue = parseExpression();
          }
          consumeStatementTerminator("Expected ; after field declaration");
          return withLoc({
            type: "FieldDeclaration",
            kind: start.value,
            typeName,
            id: withLoc({
              type: "Identifier",
              name: id.value
            }, id, id),
            accessors,
            defaultValue
          }, start, previous());
        }
        function parseParameterList() {
          expect("punctuation", "(");
          const params = [];
          if (!match("punctuation", ")")) {
            while (true) {
              if (match("punctuation", ",")) {
                continue;
              }
              params.push(parseParameter());
              if (match("punctuation", ")")) {
                break;
              }
              match("punctuation", ",");
            }
          }
          return params;
        }
        function parseParameter() {
          const start = current();
          let rest = false;
          if (match("operator", "...")) {
            if (current().type === "identifier" && peekToken().type === "identifier") {
              const containerType = expectIdentifier("Expected parameter type after ...");
              const id2 = expectIdentifier("Expected parameter name");
              return withLoc({
                type: "SpecialParameter",
                special: "rest_only",
                leadName: null,
                containerType: containerType.value,
                name: id2.value
              }, start, previous() || start);
            }
            rest = true;
          }
          let typeName = null;
          let id = expectIdentifier("Expected parameter name");
          if (!rest && current().type === "operator" && current().value === "...") {
            index++;
            const first = expectIdentifier("Expected parameter type or name after ...");
            let containerType;
            let target;
            if (current().type === "identifier" && !["?", ":=", ",", ")"].includes(current().value)) {
              containerType = first.value;
              target = expectIdentifier("Expected parameter name after special variadic type");
            } else {
              containerType = "Array";
              target = first;
            }
            return withLoc({
              type: "SpecialParameter",
              special: "lead_rest",
              leadName: id.value,
              containerType,
              name: target.value
            }, start, previous() || start);
          }
          if (!rest && current().type === "identifier" && !["?", ":=", ",", ")"].includes(current().value) && peekToken().type !== "identifier") {
            typeName = id.value;
            id = expectIdentifier("Expected parameter name after type");
          }
          let optional = false;
          let defaultValue = null;
          if (match("operator", "?")) {
            optional = true;
          }
          if (match("operator", ":=")) {
            defaultValue = parseExpression();
          }
          return withLoc({
            type: "Parameter",
            name: id.value,
            typeName,
            optional,
            defaultValue,
            rest
          }, start, previous() || start);
        }
        function parseOptionalReturnType() {
          if (current().type === "operator" && (current().value === "->" || current().value === "\u2192")) {
            index++;
            return expectIdentifier("Expected return type after ->").value;
          }
          return null;
        }
        function parseReturnStatement() {
          const start = expect("keyword", "return");
          let argument = null;
          if (!(current().type === "punctuation" && current().value === ";") && !(current().type === "keyword" && ["if", "unless"].includes(current().value))) {
            argument = parseExpression();
          }
          const stmt = withLoc({
            type: "ReturnStatement",
            argument
          }, start, previous() || start);
          return finishStatement(stmt, "Expected ; after return statement");
        }
        function parseIfStatement() {
          const start = expect("keyword", "if");
          expect("punctuation", "(");
          let declaration = null;
          let test = null;
          if (current().type === "keyword" && ["let", "const"].includes(current().value)) {
            declaration = parseInlineVariableDeclaration();
            test = declaration.id;
          } else {
            test = parseExpression();
          }
          expect("punctuation", ")", "Expected ) after if condition");
          const consequent = parseBlockStatement();
          let alternate = null;
          if (match("keyword", "else")) {
            if (current().type === "keyword" && current().value === "if") {
              alternate = parseIfStatement();
            } else {
              alternate = parseBlockStatement();
            }
          }
          return withLoc({
            type: "IfStatement",
            declaration,
            test,
            consequent,
            alternate
          }, start, previous());
        }
        function parseForStatement() {
          const start = expect("keyword", "for");
          expect("punctuation", "(");
          const decl = expect("keyword");
          if (decl.value !== "let" && decl.value !== "const") {
            throw new UnsupportedSyntaxError("for loop must declare let or const iterator", decl);
          }
          const id = expectIdentifier("Expected loop variable");
          expect("keyword", "in", "Expected in inside for loop");
          const iterable = parseExpression();
          expect("punctuation", ")", "Expected ) after for loop header");
          const body = parseBlockStatement();
          let elseBlock = null;
          if (match("keyword", "else")) {
            elseBlock = parseBlockStatement();
          }
          return withLoc({
            type: "ForInStatement",
            kind: decl.value,
            left: {
              type: "Identifier",
              name: id.value
            },
            iterable,
            body,
            elseBlock
          }, start, previous());
        }
        function parseWhileStatement() {
          const start = expect("keyword", "while");
          expect("punctuation", "(");
          let declaration = null;
          let test = null;
          if (current().type === "keyword" && ["let", "const"].includes(current().value)) {
            declaration = parseInlineVariableDeclaration();
            test = declaration.id;
          } else {
            test = parseExpression();
          }
          expect("punctuation", ")", "Expected ) after while condition");
          const body = parseBlockStatement();
          return withLoc({
            type: "WhileStatement",
            declaration,
            test,
            body
          }, start, previous());
        }
        function parseSwitchStatement() {
          const start = expect("keyword", "switch");
          expect("punctuation", "(");
          const discriminant = parseExpression();
          let comparator = "==";
          if (match("operator", ":")) {
            const token = current();
            if (!["identifier", "keyword", "operator", "string"].includes(token.type)) {
              throw new TranspilerSyntaxError("Expected switch comparator after :", token);
            }
            index++;
            comparator = token.value;
          }
          expect("punctuation", ")", "Expected ) after switch header");
          expect("punctuation", "{", "Expected { to start switch body");
          const cases = [];
          let defaultCase = null;
          while (!(current().type === "punctuation" && current().value === "}")) {
            if (atEnd()) {
              throw new TranspilerSyntaxError("Unterminated switch statement", current());
            }
            if (current().type === "keyword" && current().value === "case") {
              cases.push(parseSwitchCase());
              continue;
            }
            if (current().type === "keyword" && current().value === "default") {
              if (defaultCase) {
                throw new TranspilerSyntaxError("Duplicate default clause in switch statement", current());
              }
              defaultCase = parseSwitchDefaultCase();
              continue;
            }
            throw new TranspilerSyntaxError("Expected case or default inside switch statement", current());
          }
          expect("punctuation", "}");
          return withLoc({
            type: "SwitchStatement",
            discriminant,
            comparator,
            cases,
            defaultCase
          }, start, previous());
        }
        function parseSwitchCase() {
          const start = expect("keyword", "case");
          const values = [parseExpression()];
          while (match("punctuation", ",")) {
            values.push(parseExpression());
          }
          expect("operator", ":", "Expected : after switch case");
          const consequent = parseSwitchConsequent(start);
          return withLoc({
            type: "SwitchCase",
            values,
            consequent
          }, start, endLocFromNode(consequent));
        }
        function parseSwitchDefaultCase() {
          const start = expect("keyword", "default");
          expect("operator", ":", "Expected : after default");
          const consequent = parseSwitchConsequent(start);
          return withLoc({
            type: "SwitchCase",
            values: null,
            consequent
          }, start, endLocFromNode(consequent));
        }
        function parseSwitchConsequent(startToken) {
          const body = [];
          while (true) {
            if (atEnd()) {
              throw new TranspilerSyntaxError("Unterminated switch case body", current());
            }
            if (current().type === "punctuation" && current().value === "}") {
              break;
            }
            if (current().type === "keyword" && ["case", "default"].includes(current().value)) {
              break;
            }
            body.push(parseStatement());
          }
          return withLoc({
            type: "BlockStatement",
            body
          }, startToken, previous() || startToken);
        }
        function parseInlineVariableDeclaration() {
          const start = expect("keyword");
          let declaredType = null;
          let id = expectIdentifier();
          if (current().type === "identifier" && ![":=", "=", ";", ",", ")"].includes(current().value)) {
            declaredType = id.value;
            id = expectIdentifier("Expected variable name after type");
          }
          let init = null;
          if (match("operator", ":=") || match("operator", "=")) {
            init = parseExpression();
          }
          return withLoc({
            type: "VariableDeclaration",
            kind: start.value,
            declaredType,
            id: {
              type: "Identifier",
              name: id.value
            },
            init
          }, start, previous());
        }
        function parseLoopControlStatement(type) {
          const start = expect("keyword");
          const stmt = withLoc({ type }, start, previous() || start);
          return finishStatement(stmt, `Expected ; after ${start.value}`);
        }
        function parseThrowStatement() {
          const start = expect("keyword", "throw");
          const argument = parseExpression();
          const stmt = withLoc({
            type: "ThrowStatement",
            argument
          }, start, previous());
          return finishStatement(stmt, "Expected ; after throw statement");
        }
        function parseDieStatement() {
          const start = expect("keyword", "die");
          const argument = parseExpression();
          const stmt = withLoc({
            type: "DieStatement",
            argument
          }, start, previous());
          return finishStatement(stmt, "Expected ; after die statement");
        }
        function parseWarnStatement() {
          const start = expect("keyword", "warn");
          const argument = parseExpression();
          const stmt = withLoc({
            type: "WarnStatement",
            argument
          }, start, previous());
          return finishStatement(stmt, "Expected ; after warn statement");
        }
        function parseAssertStatement() {
          const start = expect("keyword", "assert");
          const argument = parseExpression();
          const stmt = withLoc({
            type: "AssertStatement",
            argument
          }, start, previous());
          return finishStatement(stmt, "Expected ; after assert statement");
        }
        function parseDebugStatement() {
          const start = expect("keyword", "debug");
          const argumentsList = [];
          if (!(current().type === "punctuation" && current().value === ";")) {
            argumentsList.push(parseExpression());
            while (match("punctuation", ",")) {
              argumentsList.push(parseExpression());
            }
          }
          const stmt = withLoc({
            type: "DebugStatement",
            arguments: argumentsList
          }, start, previous() || start);
          return finishStatement(stmt, "Expected ; after debug statement");
        }
        function parseSayStatement() {
          const start = expect("keyword", "say");
          const args = [];
          if (!(current().type === "punctuation" && current().value === ";")) {
            args.push(parseExpression());
            while (match("punctuation", ",")) {
              args.push(parseExpression());
            }
          }
          const stmt = withLoc({
            type: "ExpressionStatement",
            expression: withLoc({
              type: "CallExpression",
              callee: withLoc({
                type: "Identifier",
                name: "say"
              }, start, start),
              arguments: args
            }, start, previous() || start)
          }, start, previous() || start);
          return finishStatement(stmt, "Expected ; after say statement");
        }
        function parseTryStatement() {
          const parsed = parseTryLike();
          return withLoc({
            type: "TryStatement",
            block: parsed.block,
            handlers: parsed.handlers
          }, parsed.start, previous());
        }
        function parseTryLike() {
          const start = expect("keyword", "try");
          const block = parseBlockStatement();
          const handlers = [];
          while (current().type === "keyword" && current().value === "catch") {
            const catchTok = expect("keyword", "catch");
            let typeName = "Exception";
            let paramName = "e";
            if (match("punctuation", "(")) {
              if (current().type === "identifier") {
                const first = current();
                index++;
                if (current().type === "identifier") {
                  typeName = first.value;
                  paramName = current().value;
                  index++;
                } else {
                  paramName = first.value;
                }
              }
              expect("punctuation", ")", "Expected ) after catch clause");
            }
            const handlerBody = parseBlockStatement();
            handlers.push(withLoc({
              type: "CatchClause",
              typeName,
              paramName,
              body: handlerBody
            }, catchTok, previous()));
          }
          return {
            start,
            block,
            handlers
          };
        }
        function parseBlockStatement() {
          const start = expect("punctuation", "{");
          const body = [];
          while (!(current().type === "punctuation" && current().value === "}")) {
            if (atEnd()) {
              throw new TranspilerSyntaxError("Unterminated block statement", current());
            }
            body.push(parseStatement());
          }
          expect("punctuation", "}");
          return withLoc({
            type: "BlockStatement",
            body
          }, start, previous());
        }
        function parseExpressionStatement() {
          const start = current();
          const expression = parseExpression();
          const stmt = withLoc({
            type: "ExpressionStatement",
            expression
          }, start, previous());
          return finishStatement(stmt, "Expected ; after expression");
        }
        function finishStatement(stmt, semicolonMessage) {
          if (current().type === "keyword" && ["if", "unless"].includes(current().value)) {
            const keyword = current();
            index++;
            let test = parseExpression();
            if (keyword.value === "unless") {
              test = withLoc({
                type: "UnaryExpression",
                operator: "not",
                argument: test,
                prefix: true
              }, keyword, endLocFromNode(test));
            }
            expect("punctuation", ";", semicolonMessage);
            const consequent = withLoc({
              type: "BlockStatement",
              body: [stmt]
            }, startLocFromNode(stmt), endLocFromNode(stmt));
            return withLoc({
              type: "IfStatement",
              declaration: null,
              test,
              consequent,
              alternate: null
            }, startLocFromNode(stmt), endLocFromNode(consequent));
          }
          consumeStatementTerminator(semicolonMessage);
          return stmt;
        }
        function parseExpression() {
          return parseAssignment();
        }
        function parseConditional() {
          return parseConditionalTail(parseLogicalOr());
        }
        function parseConditionalTail(expr) {
          if (match("operator", "?:")) {
            const alternate = parseConditional();
            return withLoc({
              type: "ShortTernaryExpression",
              test: expr,
              alternate
            }, startLocFromNode(expr), endLocFromNode(alternate));
          }
          if (match("operator", "?")) {
            const consequent = parseExpression();
            expect("operator", ":", "Expected : in ternary expression");
            const alternate = parseConditional();
            return withLoc({
              type: "ConditionalExpression",
              test: expr,
              consequent,
              alternate
            }, startLocFromNode(expr), endLocFromNode(alternate));
          }
          return expr;
        }
        function parseAssignment() {
          const left = parseLogicalOr();
          if (current().type === "operator" && [":=", "+=", "-=", "*=", "/=", "%=", "**=", "_=", "?:=", "\xD7=", "\xF7="].includes(current().value)) {
            const op = current();
            index++;
            const right = parseAssignment();
            return withLoc({
              type: "AssignmentExpression",
              operator: op.value,
              left,
              right
            }, startLocFromNode(left), endLocFromNode(right));
          }
          if (current().type === "operator" && current().value === "~=") {
            const op = current();
            index++;
            const pattern = parseLogicalOr();
            if (current().type !== "operator" || !(current().value === "->" || current().value === "\u2192")) {
              throw new TranspilerSyntaxError("Expected -> after regex replacement pattern", current());
            }
            index++;
            const replacement = parseAssignment();
            return withLoc({
              type: "RegexReplaceExpression",
              operator: op.value,
              left,
              pattern,
              replacement
            }, startLocFromNode(left), endLocFromNode(replacement));
          }
          return parseConditionalTail(left);
        }
        function parseLogicalOr() {
          return parseLeftAssociative(
            parseLogicalAnd,
            (token) => token.type === "keyword" && ["or", "xor", "nand"].includes(token.value) || token.type === "operator" && ["\u22C1", "\u22BB", "\u22BC"].includes(token.value)
          );
        }
        function parseLogicalAnd() {
          return parseLeftAssociative(
            parseEquality,
            (token) => token.type === "keyword" && token.value === "and" || token.type === "operator" && token.value === "\u22C0"
          );
        }
        function parseEquality() {
          return parseLeftAssociative(
            parseBitwise,
            (token) => token.type === "operator" && ["==", "!=", "="].includes(token.value) || token.type === "operator" && ["\u2261", "\u2262", "\u2260"].includes(token.value) || token.type === "keyword" && ["eq", "ne"].includes(token.value)
          );
        }
        function parseBitwise() {
          return parseLeftAssociative(
            parseComparison,
            (token) => token.type === "operator" && ["&", "|", "^"].includes(token.value)
          );
        }
        function parseComparison() {
          return parseLeftAssociative(
            parseRange,
            (token) => token.type === "operator" && ["<", "<=", ">", ">=", "\u2264", "\u2265", "~", "<=>", "@", "@@", "@?", "\\", "\u2208", "\u2209", "\u22C3", "\u22C2", "\u2216", "\u2282", "\u2283", "\u2282\u2283", "\u2276", "\u2277"].includes(token.value) || token.type === "keyword" && ["gt", "ge", "lt", "le", "cmp", "eqi", "nei", "gti", "gei", "lti", "lei", "cmpi", "in", "not_in", "union", "intersection", "difference", "subsetof", "supersetof", "equivalentof", "does", "can"].includes(token.value) || token.type === "identifier" && token.value === "instanceof"
          );
        }
        function parseRange() {
          return parseLeftAssociative(
            parseTerm,
            (token) => token.type === "operator" && token.value === "..."
          );
        }
        function parseTerm() {
          return parseLeftAssociative(
            parseFactor,
            (token) => token.type === "operator" && ["+", "-", "_"].includes(token.value)
          );
        }
        function parseFactor() {
          return parseLeftAssociative(
            parseUnary,
            (token) => token.type === "operator" && ["*", "/", "%", "**"].includes(token.value) || token.type === "operator" && ["\xD7", "\xF7"].includes(token.value) || token.type === "keyword" && token.value === "mod"
          );
        }
        function parseLeftAssociative(nextFn, predicate) {
          let expr = nextFn();
          while (predicate(current())) {
            const op = current();
            index++;
            const right = nextFn();
            expr = withLoc({
              type: "BinaryExpression",
              operator: op.value,
              left: expr,
              right
            }, startLocFromNode(expr), endLocFromNode(right));
          }
          return expr;
        }
        function parseUnary() {
          if (current().type === "operator" && ["-", "+", "++", "--", "!", "~", "\\", "\u221A", "\xAC"].includes(current().value) || current().type === "keyword" && ["not", "typeof", "abs", "sqrt", "floor", "ceil", "round", "int", "length", "uc", "lc"].includes(current().value)) {
            const op = current();
            index++;
            const argument = op.value === "\\" ? parseReferenceTarget() : parseUnary();
            let expr = withLoc({
              type: op.value === "\\" ? "RefExpression" : "UnaryExpression",
              operator: op.value,
              argument,
              prefix: true
            }, startLocFromToken(op), endLocFromNode(argument));
            if (op.value === "\\") {
              expr = parsePostfixSuffixes(expr);
            }
            return expr;
          }
          return parsePostfix();
        }
        function parseReferenceTarget() {
          let expr = parsePrimary();
          while (true) {
            const nextExpr = parseMemberAccess(expr);
            if (nextExpr === expr) {
              break;
            }
            expr = nextExpr;
          }
          return expr;
        }
        function parsePostfix() {
          return parsePostfixSuffixes(parsePrimary());
        }
        function parsePostfixSuffixes(expr) {
          while (true) {
            const nextExpr = parseMemberAccess(expr);
            if (nextExpr !== expr) {
              expr = nextExpr;
              continue;
            }
            if (current().type === "punctuation" && current().value === "(") {
              const args = parseCallArgumentsOnly();
              expr = withLoc({
                type: "CallExpression",
                callee: expr,
                arguments: args
              }, startLocFromNode(expr), endLocFromToken(previous()));
              continue;
            }
            if (current().type === "operator" && ["++", "--"].includes(current().value)) {
              const op = current();
              index++;
              expr = withLoc({
                type: "UpdateExpression",
                operator: op.value,
                argument: expr,
                prefix: false
              }, startLocFromNode(expr), endLocFromToken(op));
              continue;
            }
            break;
          }
          return expr;
        }
        function parseMemberAccess(expr) {
          if (match("punctuation", ".")) {
            if (match("punctuation", "(")) {
              const property2 = parseExpression();
              expect("punctuation", ")", "Expected ) after dynamic member name");
              return withLoc({
                type: "MemberExpression",
                object: expr,
                property: property2,
                computed: true
              }, startLocFromNode(expr), endLocFromToken(previous()));
            }
            const property = expectIdentifier("Expected property name after .");
            return withLoc({
              type: "MemberExpression",
              object: expr,
              property: {
                type: "Identifier",
                name: property.value
              },
              computed: false
            }, startLocFromNode(expr), endLocFromToken(property));
          }
          if (match("punctuation", "[")) {
            const closeBracket = current().type === "punctuation" && current().value === "]";
            const startsWithColon = current().type === "operator" && current().value === ":";
            let first = null;
            if (!closeBracket && !startsWithColon) {
              first = parseExpression();
            }
            if (match("operator", ":")) {
              let second = null;
              if (!(current().type === "punctuation" && current().value === "]")) {
                second = parseExpression();
              }
              expect("punctuation", "]");
              return withLoc({
                type: "SliceExpression",
                object: expr,
                start: first,
                length: second
              }, startLocFromNode(expr), endLocFromToken(previous()));
            }
            if (first == null) {
              throw new TranspilerSyntaxError("Expected index or slice expression", current());
            }
            expect("punctuation", "]");
            return withLoc({
              type: "MemberExpression",
              object: expr,
              property: first,
              computed: true
            }, startLocFromNode(expr), endLocFromToken(previous()));
          }
          if (match("punctuation", "{")) {
            let property;
            if ((current().type === "identifier" || current().type === "keyword") && peekToken().type === "punctuation" && peekToken().value === "}") {
              const key = current();
              index++;
              property = withLoc(
                key.type === "identifier" ? {
                  type: "BraceIdentifier",
                  name: key.value
                } : {
                  type: "StringLiteral",
                  value: key.value
                },
                key,
                key
              );
            } else {
              property = parseExpression();
            }
            expect("punctuation", "}");
            return withLoc({
              type: "MemberExpression",
              object: expr,
              property,
              computed: true
            }, startLocFromNode(expr), endLocFromToken(previous()));
          }
          return expr;
        }
        function parseCallArgumentsOnly() {
          expect("punctuation", "(");
          const args = [];
          let closed = false;
          if (!match("punctuation", ")")) {
            while (true) {
              if (match("punctuation", ",")) {
                if (current().type === "punctuation" && current().value === ")") {
                  break;
                }
                continue;
              }
              if (current().type === "punctuation" && current().value === ")") {
                break;
              }
              args.push(parseCallArgument());
              if (match("punctuation", ")")) {
                closed = true;
                break;
              }
              match("punctuation", ",");
            }
            if (!closed && current().type === "punctuation" && current().value === ")") {
              expect("punctuation", ")", "Expected ) after call arguments");
            }
          }
          return args;
        }
        function parseCallArgument() {
          const start = current();
          const expr = parseExpression();
          if (current().type === "operator" && current().value === ":") {
            const normalized = normalizeNamedArgumentKey(expr);
            expect("operator", ":", "Expected : in named argument");
            const value = parseExpression();
            return withLoc({
              type: "NamedArgument",
              key: normalized.key,
              keyExpr: normalized.keyExpr,
              value
            }, startLocFromNode(expr), previous());
          }
          return expr;
        }
        function normalizeNamedArgumentKey(expr) {
          if (expr.type === "Identifier") {
            return {
              key: expr.name,
              keyExpr: withLoc({
                type: "StringLiteral",
                value: expr.name
              }, startLocFromNode(expr), endLocFromNode(expr))
            };
          }
          if (expr.type === "StringLiteral") {
            return {
              key: expr.value,
              keyExpr: expr
            };
          }
          if (expr.type === "GroupedExpression") {
            return normalizeNamedArgumentKey(expr.expression);
          }
          if (expr.type === "MemberExpression") {
            if (expr.computed && expr.property.type === "StringLiteral") {
              return {
                key: expr.property.value,
                keyExpr: withLoc({
                  type: "StringLiteral",
                  value: expr.property.value
                }, startLocFromNode(expr.property), endLocFromNode(expr.property))
              };
            }
            if (!expr.computed && expr.property.type === "Identifier") {
              return {
                key: expr.property.name,
                keyExpr: withLoc({
                  type: "StringLiteral",
                  value: expr.property.name
                }, startLocFromNode(expr.property), endLocFromNode(expr.property))
              };
            }
          }
          return {
            key: null,
            keyExpr: expr
          };
        }
        function parsePrimary() {
          const token = current();
          if (match("number")) {
            return withLoc({
              type: "NumericLiteral",
              value: Number(token.value)
            }, token, token);
          }
          if (match("string")) {
            return withLoc({
              type: "StringLiteral",
              value: token.value
            }, token, token);
          }
          if (match("binary_string")) {
            return withLoc({
              type: "BinaryStringLiteral",
              value: token.value
            }, token, token);
          }
          if (match("template")) {
            const parts = token.value.map((part) => {
              if (part.type === "text") {
                return withLoc({
                  type: "StringLiteral",
                  value: part.value
                }, token, token);
              }
              return parseTemplateExpression(part.value, token);
            });
            return withLoc({
              type: "TemplateLiteral",
              parts
            }, token, token);
          }
          if (match("regexp")) {
            return withLoc({
              type: "RegExpLiteral",
              pattern: token.value.pattern,
              flags: token.value.flags
            }, token, token);
          }
          if (token.type === "keyword" && ["true", "false", "null"].includes(token.value)) {
            index++;
            return withLoc({
              type: "Literal",
              value: token.value === "null" ? null : token.value === "true"
            }, token, token);
          }
          if (token.type === "keyword" && token.value === "super") {
            index++;
            return withLoc({
              type: "Super"
            }, token, token);
          }
          if (match("identifier")) {
            return withLoc({
              type: "Identifier",
              name: token.value
            }, token, token);
          }
          if (token.type === "keyword" && token.value === "say") {
            index++;
            return withLoc({
              type: "Identifier",
              name: token.value
            }, token, token);
          }
          if (token.type === "keyword" && token.value === "function") {
            index++;
            const params = parseParameterList();
            const body = parseBlockStatement();
            return withLoc({
              type: "FunctionExpression",
              params,
              body
            }, token, previous());
          }
          if (token.type === "keyword" && token.value === "fn") {
            index++;
            let params;
            if (current().type === "punctuation" && current().value === "(") {
              params = parseParameterList();
            } else {
              params = [parseParameter()];
            }
            if (current().type === "operator" && (current().value === "->" || current().value === "\u2192")) {
              index++;
            } else {
              throw new TranspilerSyntaxError("Expected -> after fn parameters", current());
            }
            const expr = parseExpression();
            const returnStmt = withLoc({
              type: "ReturnStatement",
              argument: expr
            }, token, token);
            const body = withLoc({
              type: "BlockStatement",
              body: [returnStmt]
            }, token, token);
            return withLoc({
              type: "FunctionExpression",
              params,
              body
            }, token, previous() || token);
          }
          if (token.type === "keyword" && token.value === "try") {
            const parsed = parseTryLike();
            return withLoc({
              type: "TryExpression",
              block: parsed.block,
              handlers: parsed.handlers
            }, parsed.start, previous());
          }
          if (token.type === "keyword" && token.value === "do") {
            index++;
            const block = parseBlockStatement();
            return withLoc({
              type: "DoExpression",
              block
            }, token, previous());
          }
          if (token.type === "keyword" && token.value === "new") {
            index++;
            let callee = parsePrimary();
            while (true) {
              const nextExpr = parseMemberAccess(callee);
              if (nextExpr === callee) {
                break;
              }
              callee = nextExpr;
            }
            if (current().type === "punctuation" && current().value === "(") {
              const args = parseCallArgumentsOnly();
              callee = withLoc({
                type: "CallExpression",
                callee,
                arguments: args
              }, startLocFromNode(callee), endLocFromToken(previous()));
            }
            return withLoc({
              type: "NewExpression",
              callee
            }, token, previous());
          }
          if (token.type === "keyword") {
            index++;
            return withLoc({
              type: "Identifier",
              name: token.value
            }, token, token);
          }
          if (match("operator", "\u230A")) {
            const expr = parseExpression();
            expect("operator", "\u230B", "Expected closing floor operator");
            return withLoc({
              type: "UnaryExpression",
              operator: "floor",
              argument: expr,
              prefix: true
            }, token, previous());
          }
          if (match("operator", "\u2308")) {
            const expr = parseExpression();
            expect("operator", "\u2309", "Expected closing ceil operator");
            return withLoc({
              type: "UnaryExpression",
              operator: "ceil",
              argument: expr,
              prefix: true
            }, token, previous());
          }
          if (match("punctuation", "(")) {
            const expr = parseExpression();
            expect("punctuation", ")", "Expected ) after grouped expression");
            return withLoc({
              type: "GroupedExpression",
              expression: expr
            }, token, previous());
          }
          if (match("punctuation", "[")) {
            const elements = [];
            if (!match("punctuation", "]")) {
              while (true) {
                if (match("punctuation", "]")) {
                  break;
                }
                elements.push(parseExpression());
                if (match("punctuation", "]")) {
                  break;
                }
                match("punctuation", ",");
              }
            }
            return withLoc({
              type: "ArrayExpression",
              elements
            }, token, previous());
          }
          if (match("operator", "{{")) {
            const opener = previous();
            const entries = [];
            if (!matchPairListClose()) {
              while (true) {
                if (matchPairListClose()) {
                  break;
                }
                const start = current();
                const keyExpr = parseExpression();
                if (current().type === "operator" && current().value === ":") {
                  const normalized = normalizeNamedArgumentKey(keyExpr);
                  expect("operator", ":", "Expected : in pairlist literal");
                  const value = parseExpression();
                  entries.push(withLoc({
                    type: "PairListEntry",
                    key: normalized.key,
                    keyExpr: normalized.keyExpr,
                    value
                  }, startLocFromNode(keyExpr), endLocFromNode(value)));
                } else {
                  entries.push(keyExpr);
                }
                if (matchPairListClose()) {
                  break;
                }
                match("punctuation", ",");
              }
            }
            return withLoc({
              type: "PairListLiteral",
              entries
            }, opener, previous());
          }
          if (match("operator", "<<") || match("operator", "<<<") || match("operator", "\xAB")) {
            const opener = previous();
            const closer = opener.value === "<<<" ? ">>>" : opener.value === "\xAB" ? "\xBB" : ">>";
            const elements = parseDelimitedCollection(closer);
            return withLoc({
              type: opener.value === "<<<" ? "BagLiteral" : "SetLiteral",
              elements
            }, opener, previous());
          }
          if (match("punctuation", "{")) {
            const properties = [];
            if (!match("punctuation", "}")) {
              while (true) {
                if (match("punctuation", "}")) {
                  break;
                }
                let key;
                if (current().type === "identifier" || current().type === "keyword") {
                  key = current().value;
                  index++;
                } else if (current().type === "string") {
                  key = current().value;
                  index++;
                } else {
                  throw new TranspilerSyntaxError("Expected object literal key", current());
                }
                expect("operator", ":", "Expected : in object literal");
                const value = parseExpression();
                properties.push({ key, value });
                if (match("punctuation", "}")) {
                  break;
                }
                match("punctuation", ",");
              }
            }
            return withLoc({
              type: "ObjectExpression",
              properties
            }, token, previous());
          }
          throw new TranspilerSyntaxError("Unexpected token in expression", token);
        }
        function parseDelimitedCollection(closer) {
          const elements = [];
          if (match("operator", closer)) {
            return elements;
          }
          while (true) {
            elements.push(parseExpression());
            if (match("operator", closer)) {
              break;
            }
            match("punctuation", ",");
          }
          return elements;
        }
        function parseTemplateExpression(source, token) {
          try {
            return parse(tokenize(source), { expression: true });
          } catch (err) {
            if (err instanceof TranspilerSyntaxError || err instanceof UnsupportedSyntaxError) {
              throw new TranspilerSyntaxError("Invalid template interpolation", token);
            }
            throw err;
          }
        }
        if (options.expression) {
          return parseExpressionRoot();
        }
        return parseProgram();
      }
      module.exports = {
        parse
      };
    }
  });

  // extras/zuzu-js/lib/transpiler-new/codegen.js
  var require_codegen = __commonJS({
    "extras/zuzu-js/lib/transpiler-new/codegen.js"(exports, module) {
      "use strict";
      var { UnsupportedSyntaxError } = require_errors();
      var loopCounter = 0;
      var emitContextStack = [];
      function currentEmitContext() {
        return emitContextStack.length > 0 ? emitContextStack[emitContextStack.length - 1] : {};
      }
      function withEmitContext(options, fn) {
        emitContextStack.push(options || {});
        try {
          return fn();
        } finally {
          emitContextStack.pop();
        }
      }
      function emitProgram(ast) {
        loopCounter = 0;
        return ast.body.map((stmt) => emitStatement(stmt)).join("\n");
      }
      function emitStatement(node, options = {}) {
        return withEmitContext(options, () => {
          if (node.exported) {
            return emitExportedStatement(node, options);
          }
          switch (node.type) {
            case "EmptyStatement":
              return ";";
            case "ImportDeclaration":
              return emitImportDeclaration(node);
            case "VariableDeclaration":
              return `${node.kind} ${emitExpression(node.id)} = ${node.init ? emitExpression(node.init) : "null"};`;
            case "FunctionDeclaration":
              return emitFunctionLike(node, `function ${emitExpression(node.id)}()`, {
                returnTypeName: node.returnType,
                callableName: node.id.name
              });
            case "ReturnStatement": {
              if (node.argument == null && !options.returnTypeName) {
                return options.inSwitchSection ? "return { __zuzu_return: true, value: undefined };" : "return;";
              }
              const value = node.argument ? emitReturnValue(node.argument, options) : emitReturnValue(null, options);
              if (options.inSwitchSection) {
                return `return { __zuzu_return: true, value: ${value} };`;
              }
              return node.argument ? `return ${value};` : `return ${value};`;
            }
            case "IfStatement":
              return [
                node.declaration ? emitStatement(node.declaration, options) : "",
                `if ( __zuzu_truthy( ${emitExpression(node.test)} ) ) ${emitBlock(node.consequent, options)}`,
                node.alternate ? `else ${node.alternate.type === "BlockStatement" ? emitBlock(node.alternate, options) : emitStatement(node.alternate, options)}` : ""
              ].filter(Boolean).join(" ");
            case "BlockStatement":
              return emitBlock(node, options);
            case "ExpressionStatement":
              return `${emitExpression(node.expression)};`;
            case "ForInStatement":
              return emitForInStatement(node, options);
            case "WhileStatement":
              return [
                node.declaration ? emitStatement(node.declaration, options) : "",
                `while ( __zuzu_truthy( ${emitExpression(node.test)} ) ) ${emitBlock(node.body, {
                  ...options,
                  loopDepth: (options.loopDepth || 0) + 1
                })}`
              ].filter(Boolean).join("\n");
            case "ContinueStatement":
              if (options.inSwitchSection && (options.loopDepth || 0) === 0) {
                return "return true;";
              }
              return "continue;";
            case "BreakStatement":
              return "break;";
            case "ThrowStatement":
              return `throw ${emitExpression(node.argument)};`;
            case "DieStatement":
              return `__zuzu_die( ${emitExpression(node.argument)} );`;
            case "WarnStatement":
              return `__zuzu_warn( ${emitExpression(node.argument)} );`;
            case "AssertStatement":
              return `__zuzu_assert( ${emitExpression(node.argument)} );`;
            case "DebugStatement":
              return node.arguments && node.arguments.length > 0 ? `( ${node.arguments.map(emitExpression).join(", ")} );` : "null;";
            case "TryStatement":
              return emitTryStatement(node, options);
            case "SwitchStatement":
              return emitSwitchStatement(node, options);
            case "ClassDeclaration":
              return emitClassDeclaration(node);
            case "TraitDeclaration":
              return emitTraitDeclaration(node);
            default:
              throw new UnsupportedSyntaxError(`Unsupported statement node ${node.type}`);
          }
        });
      }
      function emitExportedStatement(node, options = {}) {
        if (!node.id || !node.id.name) {
          throw new UnsupportedSyntaxError(`Cannot export statement node ${node.type}`);
        }
        const unexported = {
          ...node,
          exported: false
        };
        const name = node.id.name;
        return [
          emitStatement(unexported, options),
          `module.exports[${JSON.stringify(name)}] = ${name};`
        ].join("\n");
      }
      function emitFunctionLike(node, header, options = {}) {
        const signature = analyzeSpecialSignature(node.params);
        const functionOptions = createFunctionOptions(node, options);
        const cleanupNames = collectCleanupNames(node.body);
        const bodySource = withEmitContext(
          functionOptions,
          () => emitFunctionBlock(node.body, cleanupNames, functionOptions)
        );
        const cleanup = cleanupNames.map((name) => `__zuzu_maybe_demolish( ${name} );`).join("\n");
        const bodyWrapper = [
          "try {",
          bodySource,
          "} catch ( __zuzu_nonlocal ) {",
          "if ( __zuzu_nonlocal && __zuzu_nonlocal.__zuzu_nonlocal_return ) { return __zuzu_nonlocal.value; }",
          "throw __zuzu_nonlocal;",
          "}",
          cleanupNames.length > 0 ? "finally {" : "",
          cleanupNames.length > 0 ? cleanup : "",
          cleanupNames.length > 0 ? "}" : ""
        ].filter(Boolean).join("\n");
        return [
          `${header} {`,
          emitFunctionPreamble(node.params, signature),
          options.extraPreamble || "",
          ...cleanupNames.map((name) => `let ${name} = null;`),
          bodyWrapper,
          "}"
        ].filter(Boolean).join("\n");
      }
      function emitFunctionBodyStatement(node, cleanupNames, options = {}) {
        if (node.type === "VariableDeclaration" && node.id && cleanupNames.includes(node.id.name)) {
          return `${emitExpression(node.id)} = ${node.init ? emitExpression(node.init) : "null"};`;
        }
        return emitStatement(node, options);
      }
      function emitFunctionBlock(block, cleanupNames, options = {}) {
        if (!block || !Array.isArray(block.body) || block.body.length === 0) {
          return "";
        }
        const lines = [];
        const lastIndex = block.body.length - 1;
        for (let i = 0; i < block.body.length; i++) {
          const stmt = block.body[i];
          if (i === lastIndex) {
            lines.push(emitFunctionTailStatement(stmt, cleanupNames, options));
          } else {
            lines.push(emitFunctionBodyStatement(stmt, cleanupNames, options));
          }
        }
        return lines.join("\n");
      }
      function emitFunctionTailStatement(stmt, cleanupNames, options = {}) {
        if (stmt.type === "ExpressionStatement") {
          return `return ${emitExpression(stmt.expression)};`;
        }
        if (stmt.type === "BlockStatement") {
          return emitFunctionBlock(stmt, cleanupNames, options);
        }
        if (stmt.type === "IfStatement") {
          const prefix = stmt.declaration ? `${emitStatement(stmt.declaration, options)}
` : "";
          const alternate = stmt.alternate ? emitFunctionTailStatement(stmt.alternate, cleanupNames, options) : "return null;";
          return `${prefix}if ( __zuzu_truthy( ${emitExpression(stmt.test, options)} ) ) { ${emitFunctionBlock(stmt.consequent, cleanupNames, options)} } else { ${alternate} }`;
        }
        return emitFunctionBodyStatement(stmt, cleanupNames, options);
      }
      function collectCleanupNames(block) {
        const names = [];
        for (const stmt of block.body) {
          if (["VariableDeclaration", "FunctionDeclaration", "ClassDeclaration", "TraitDeclaration"].includes(stmt.type) && stmt.id && stmt.id.name) {
            if (stmt.id.name !== "self") {
              names.push(stmt.id.name);
            }
          }
        }
        return names;
      }
      function createFunctionOptions(node, options = {}) {
        const signature = analyzeSpecialSignature(node.params);
        const paramNames = extractDeclaredParamNames(node.params);
        return {
          ...options,
          returnTypeName: options.returnTypeName || node.returnType || null,
          callableName: options.callableName || (node.id ? node.id.name : null),
          scopeNames: /* @__PURE__ */ new Set([...options.scopeNames || [], ...paramNames, ...extractSpecialPreludeNames(signature)])
        };
      }
      function extractDeclaredParamNames(params) {
        const names = [];
        for (const param of params) {
          if (param.type === "Parameter") {
            names.push(param.name);
          } else if (param.type === "SpecialParameter") {
            if (param.leadName) {
              names.push(param.leadName);
            }
            names.push(param.name);
          }
        }
        return names;
      }
      function extractSpecialPreludeNames(signature) {
        if (!signature) {
          return [];
        }
        switch (signature.kind) {
          case "pairlist_only":
            return ["__zuzu_call_args", signature.namedName];
          case "lead_pairlist":
            return ["__zuzu_call_args", signature.headName, signature.namedName, signature.restName, "__i", "__a"];
          case "trail_pairlist":
            return ["__zuzu_call_args", signature.headName, signature.restName, signature.namedName, "__i", "__a"];
          case "scalar_pairlist":
            return ["__zuzu_call_args", signature.headName, signature.namedName, "__i", "__a"];
          case "variadic":
            return ["__zuzu_call_args", signature.headName, signature.restName, "__i", "__a"];
          default:
            return [];
        }
      }
      function analyzeSpecialSignature(params) {
        if (params.length === 1 && params[0].type === "SpecialParameter" && params[0].special === "rest_only" && params[0].containerType === "PairList") {
          return {
            kind: "pairlist_only",
            namedName: params[0].name
          };
        }
        if (params.length === 2 && params[0].type === "SpecialParameter" && params[0].special === "lead_rest" && params[0].containerType === "PairList" && params[1].type === "Parameter" && (params[1].typeName === "Array" || params[1].typeName == null)) {
          return {
            kind: "lead_pairlist",
            headName: params[0].leadName,
            namedName: params[0].name,
            restName: params[1].name
          };
        }
        if (params.length === 2 && params[0].type === "SpecialParameter" && params[0].special === "lead_rest" && params[0].containerType === "Array" && params[1].type === "Parameter" && params[1].typeName === "PairList") {
          return {
            kind: "trail_pairlist",
            headName: params[0].leadName,
            restName: params[0].name,
            namedName: params[1].name
          };
        }
        if (params.length === 2 && params[0].type === "Parameter" && params[1].type === "SpecialParameter" && params[1].special === "rest_only" && params[1].containerType === "PairList") {
          return {
            kind: "scalar_pairlist",
            headName: params[0].name,
            namedName: params[1].name
          };
        }
        if (params.length === 1 && params[0].type === "SpecialParameter" && params[0].special === "lead_rest" && params[0].containerType === "Array") {
          return {
            kind: "variadic",
            headName: params[0].leadName,
            restName: params[0].name
          };
        }
        return null;
      }
      function emitFunctionPreamble(params, signature = null) {
        if (signature) {
          return emitSpecialFunctionPreamble(signature);
        }
        const lines = [];
        const normalParams = params.filter((param) => param.type === "Parameter");
        const required = normalParams.filter((param) => !param.optional && param.defaultValue == null && !param.rest).length;
        lines.push("const __argc__ = arguments.length;");
        lines.push(`if ( arguments.length < ${required} ) { throw new Error( "Wrong number of arguments" ); }`);
        let argIndex = 0;
        for (const param of normalParams) {
          if (param.rest) {
            lines.push(`const ${param.name} = Array.prototype.slice.call( arguments, ${argIndex} );`);
            continue;
          }
          if (param.defaultValue) {
            lines.push(`let ${param.name} = __argc__ > ${argIndex} ? arguments[${argIndex}] : ${emitExpression(param.defaultValue)};`);
          } else if (param.optional) {
            lines.push(`let ${param.name} = __argc__ > ${argIndex} ? arguments[${argIndex}] : null;`);
          } else {
            lines.push(`let ${param.name} = arguments[${argIndex}];`);
          }
          if (param.typeName) {
            lines.push(
              `if ( ${param.name} != null && !__zuzu_type_matches( ${param.name}, ${JSON.stringify(param.typeName)} ) ) { throw new Error( \`TypeException: '${param.name}' must be ${param.typeName}, got \${ __zuzu_typeof( ${param.name} ) }\` ); }`
            );
          }
          argIndex++;
        }
        return lines.join("\n");
      }
      function emitSpecialFunctionPreamble(signature) {
        switch (signature.kind) {
          case "pairlist_only":
            return [
              `const __zuzu_call_args = Array.prototype.slice.call( arguments );`,
              `let ${signature.namedName} = __zuzu_pairlist_literal( [] );`,
              "for ( const __a of __zuzu_call_args ) {",
              `if ( __a instanceof PairList ) { ${signature.namedName} = __a; } else { throw new Exception( "named PairList parameter only accepts named arguments" ); }`,
              "}"
            ].join("\n");
          case "lead_pairlist":
            return [
              "const __zuzu_call_args = Array.prototype.slice.call( arguments );",
              `let ${signature.headName} = __zuzu_call_args[0];`,
              `let ${signature.namedName} = __zuzu_pairlist_literal( [] );`,
              `let ${signature.restName} = [];`,
              "for ( let __i = 1; __i < __zuzu_call_args.length; __i++ ) {",
              "const __a = __zuzu_call_args[__i];",
              `if ( __a instanceof PairList ) { ${signature.namedName} = __a; } else { ${signature.restName}.push( __a ); }`,
              "}"
            ].join("\n");
          case "trail_pairlist":
            return [
              "const __zuzu_call_args = Array.prototype.slice.call( arguments );",
              `let ${signature.headName} = __zuzu_call_args[0];`,
              `let ${signature.restName} = [];`,
              `let ${signature.namedName} = __zuzu_pairlist_literal( [] );`,
              "for ( let __i = 1; __i < __zuzu_call_args.length; __i++ ) {",
              "const __a = __zuzu_call_args[__i];",
              `if ( __a instanceof PairList ) { ${signature.namedName} = __a; } else { ${signature.restName}.push( __a ); }`,
              "}"
            ].join("\n");
          case "scalar_pairlist":
            return [
              "const __zuzu_call_args = Array.prototype.slice.call( arguments );",
              `let ${signature.headName} = __zuzu_call_args[0];`,
              `let ${signature.namedName} = __zuzu_pairlist_literal( [] );`,
              "for ( let __i = 1; __i < __zuzu_call_args.length; __i++ ) {",
              "const __a = __zuzu_call_args[__i];",
              `if ( __a instanceof PairList ) { ${signature.namedName} = __a; } else { throw new Exception( "named arguments not allowed for this function" ); }`,
              "}"
            ].join("\n");
          case "variadic":
            return [
              "const __zuzu_call_args = Array.prototype.slice.call( arguments );",
              `let ${signature.headName} = __zuzu_call_args[0];`,
              `let ${signature.restName} = [];`,
              "for ( let __i = 1; __i < __zuzu_call_args.length; __i++ ) {",
              "const __a = __zuzu_call_args[__i];",
              `if ( __a instanceof PairList ) { throw new Exception( "named arguments not allowed for this function" ); } ${signature.restName}.push( __a );`,
              "}"
            ].join("\n");
          default:
            return "";
        }
      }
      function emitReturnValue(argument, options = {}) {
        let value;
        if (argument == null) {
          value = "undefined";
        } else {
          value = emitExpression(argument);
        }
        if (options.returnTypeName && options.returnTypeName !== "Any") {
          return `__zuzu_checked_return( ${JSON.stringify(options.callableName || "")}, ${JSON.stringify(options.returnTypeName)}, ${value} )`;
        }
        return value;
      }
      function emitForInStatement(node, options = {}) {
        const iterName = `__zuzu_iterated_${node.left.name}_${loopCounter++}`;
        const elsePart = node.elseBlock ? `if ( !${iterName} ) ${emitBlock(node.elseBlock, options)}` : "";
        return [
          `let ${iterName} = 0;`,
          `for ( ${node.kind} ${node.left.name} of __zuzu_iter( ${emitExpression(node.iterable)} ) ) {`,
          `${iterName} = 1;`,
          node.body.body.map((stmt) => emitStatement(stmt, {
            ...options,
            loopDepth: (options.loopDepth || 0) + 1
          })).join("\n"),
          "}",
          elsePart
        ].filter(Boolean).join("\n");
      }
      function emitTryStatement(node, options = {}) {
        const handlers = node.handlers || [];
        let catchBody = "throw __zuzu_err;";
        if (handlers.length > 0) {
          const branches = handlers.map((handler, index) => {
            const cond = handler.typeName === "Exception" || handler.typeName === "Any" ? "true" : `__zuzu_err instanceof ${handler.typeName}`;
            const prefix = index === 0 ? `if ( ${cond} )` : `else if ( ${cond} )`;
            return `${prefix} { let ${handler.paramName} = __zuzu_err; ${handler.body.body.map((stmt) => emitStatement(stmt, options)).join("\n")} }`;
          });
          catchBody = `if ( __zuzu_err && __zuzu_err.__zuzu_nonlocal_return ) { throw __zuzu_err; } ${branches.join(" ")} else { throw __zuzu_err; }`;
        }
        return `try ${emitBlock(node.block, options)} catch ( __zuzu_err ) { ${catchBody} }`;
      }
      function emitImportDeclaration(node) {
        if (node.importAll) {
          return `{ const __zuzu_star = __zuzu_import( ${JSON.stringify(node.source)} ); for ( const __zuzu_key of Object.keys( __zuzu_star ) ) { globalThis[ __zuzu_key ] = __zuzu_star[ __zuzu_key ]; } }`;
        }
        const mapped = node.specifiers.map((specifier) => {
          const importedName = node.source === "std/math" && specifier.imported === "pi" ? "\u03C0" : specifier.imported;
          if (importedName === specifier.local) {
            return importedName;
          }
          return `${importedName}: ${specifier.local}`;
        });
        const importCondition = node.condition ? node.condition.keyword === "unless" ? `!__zuzu_truthy( ${emitExpression(node.condition.test)} )` : `__zuzu_truthy( ${emitExpression(node.condition.test)} )` : null;
        const disabledImports = `{ ${node.specifiers.map((specifier) => {
          const importedName = node.source === "std/math" && specifier.imported === "pi" ? "\u03C0" : specifier.imported;
          return `${importedName}: null`;
        }).join(", ")} }`;
        if (node.tryMode) {
          const optionalMapped = node.specifiers.map((specifier) => {
            const importedName = node.source === "std/math" && specifier.imported === "pi" ? "\u03C0" : specifier.imported;
            if (importedName === specifier.local) {
              return `${importedName} = null`;
            }
            return `${importedName}: ${specifier.local} = null`;
          });
          return [
            `const { ${optionalMapped.join(", ")} } = ( () => {`,
            "try {",
            importCondition ? `if ( !( ${importCondition} ) ) { return {}; }` : "",
            `return __zuzu_import( ${JSON.stringify(node.source)} );`,
            "}",
            "catch ( __zuzu_err ) {",
            "if ( __zuzu_err && __zuzu_err.__zuzu_nonlocal_return ) { throw __zuzu_err; }",
            "return {};",
            "}",
            "} )();"
          ].filter(Boolean).join(" ");
        }
        if (importCondition) {
          return [
            `const { ${mapped.join(", ")} } = ( () => {`,
            `if ( !( ${importCondition} ) ) { return ${disabledImports}; }`,
            `return __zuzu_import( ${JSON.stringify(node.source)} );`,
            "} )();"
          ].join(" ");
        }
        return `const { ${mapped.join(", ")} } = __zuzu_import( ${JSON.stringify(node.source)} );`;
      }
      function emitBlock(node, options = {}) {
        const scopedOptions = {
          ...options,
          scopeNames: /* @__PURE__ */ new Set([
            ...options.scopeNames || [],
            ...collectDeclaredNames(node.body)
          ])
        };
        const cleanupNames = collectCleanupNames(node);
        const body = node.body.map((stmt) => emitBlockStatement(stmt, cleanupNames, scopedOptions)).join("\n");
        if (cleanupNames.length === 0) {
          return `{
${body}
}`;
        }
        const cleanup = cleanupNames.map((name) => `__zuzu_maybe_demolish( ${name} );`).join("\n");
        return `{
${cleanupNames.map((name) => `let ${name} = null;`).join("\n")}
try {
${body}
} finally {
${cleanup}
}
}`;
      }
      function collectDeclaredNames(statements) {
        const names = [];
        for (const stmt of statements || []) {
          if (["VariableDeclaration", "FunctionDeclaration", "ClassDeclaration", "TraitDeclaration"].includes(stmt.type) && stmt.id && stmt.id.name) {
            names.push(stmt.id.name);
          }
        }
        return names;
      }
      function scopeHasName(options, name) {
        return !!(options.scopeNames && options.scopeNames.has(name));
      }
      function emitBlockStatement(node, cleanupNames, options = {}) {
        if (node.type === "VariableDeclaration" && node.id && cleanupNames.includes(node.id.name)) {
          return `${emitExpression(node.id)} = ${node.init ? emitExpression(node.init) : "null"};`;
        }
        return emitStatement(node, options);
      }
      function emitSwitchStatement(node, options = {}) {
        const cases = node.cases.map((section) => `{ values: [ ${section.values.map(emitExpression).join(", ")} ], body: function() ${emitBlock(section.consequent, {
          ...options,
          inSwitchSection: true,
          loopDepth: 0
        })} }`);
        const defaultBody = node.defaultCase ? `function() ${emitBlock(node.defaultCase.consequent, {
          ...options,
          inSwitchSection: true,
          loopDepth: 0
        })}` : "null";
        const tail = switchStatementContainsReturn(node) ? options.inSwitchSection ? "if ( __zuzu_switch_result && __zuzu_switch_result.__zuzu_return ) { return __zuzu_switch_result; }" : "if ( __zuzu_switch_result && __zuzu_switch_result.__zuzu_return ) { return __zuzu_switch_result.value; }" : "";
        return `{ let __zuzu_switch_result = __zuzu_switch( ${emitExpression(node.discriminant)}, ${JSON.stringify(node.comparator)}, [ ${cases.join(", ")} ], ${defaultBody} ); ${tail} }`;
      }
      function emitTraitDeclaration(node) {
        const methods = node.body.map((method) => {
          const value = emitMethodFunction(method, {
            callableName: method.id.name,
            returnTypeName: method.returnType,
            fieldNames: [],
            className: null,
            isStatic: false,
            methodSelfName: "self"
          });
          return `${JSON.stringify(method.id.name)}: ${value}`;
        });
        return `let ${emitExpression(node.id)} = __zuzu_trait( ${JSON.stringify(node.id.name)}, { ${methods.join(", ")} } );`;
      }
      function emitClassDeclaration(node) {
        if (node.shorthand && node.traits.length === 0) {
          return `let ${emitExpression(node.id)} = __zuzu_make_class( ${JSON.stringify(node.id.name)}, ${node.base ? emitExpression(node.base) : "Object"} );`;
        }
        const fields = node.body.filter((entry) => entry.type === "FieldDeclaration");
        const methods = node.body.filter((entry) => entry.type === "MethodDeclaration" && !entry.static);
        const statics = node.body.filter((entry) => entry.type === "MethodDeclaration" && entry.static);
        const nested = node.body.filter((entry) => ["ClassDeclaration", "TraitDeclaration"].includes(entry.type));
        const fieldNames = fields.map((field) => field.id.name);
        return `let ${emitExpression(node.id)} = __zuzu_define_class( ${JSON.stringify(node.id.name)}, ${node.base ? emitExpression(node.base) : "Object"}, { "traits": [ ${node.traits.map(emitExpression).join(", ")} ], "fields": [ ${fields.map(emitFieldSpec).join(", ")} ], "methods": { ${methods.map((method) => `${JSON.stringify(method.id.name)}: ${emitMethodFunction(method, {
          callableName: method.id.name,
          returnTypeName: method.returnType,
          fieldNames,
          className: node.id.name,
          isStatic: false,
          methodSelfName: "self"
        })}`).join(", ")} }, "statics": { ${statics.map((method) => `${JSON.stringify(method.id.name)}: ${emitMethodFunction(method, {
          callableName: method.id.name,
          returnTypeName: method.returnType,
          fieldNames: [],
          className: node.id.name,
          isStatic: true,
          methodSelfName: "self"
        })}`).join(", ")} }, "nested": { ${nested.map(emitNestedDeclarationEntry).join(", ")} } } );`;
      }
      function emitFieldSpec(node) {
        return `{ name: ${JSON.stringify(node.id.name)}, typeName: ${node.typeName ? JSON.stringify(node.typeName) : "null"}, accessors: [ ${node.accessors.map((item) => JSON.stringify(item)).join(", ")} ], defaultValue: ${node.defaultValue ? `function() { return ${emitExpression(node.defaultValue)}; }` : "null"} }`;
      }
      function emitNestedDeclarationEntry(node) {
        return `${JSON.stringify(node.id.name)}: ( function() { ${emitStatement(node)} return ${node.id.name}; } )()`;
      }
      function emitMethodFunction(node, meta) {
        return `( ${emitFunctionLike(node, "function()", {
          ...meta,
          extraPreamble: [
            "let self = this;",
            `let __zuzu_super_class__ = ${meta.className ? meta.className : "null"};`,
            `let __zuzu_super_method__ = ${JSON.stringify(node.id.name)};`,
            `let __zuzu_super_static__ = ${meta.isStatic ? 1 : 0};`
          ].join("\n"),
          scopeNames: /* @__PURE__ */ new Set(["self", "__zuzu_super_class__", "__zuzu_super_method__", "__zuzu_super_static__"]),
          fieldNames: meta.fieldNames || [],
          methodSelfName: meta.methodSelfName || "self"
        })} )`;
      }
      function switchStatementContainsReturn(node) {
        return node.cases.some((section) => blockContainsReturn(section.consequent)) || node.defaultCase && blockContainsReturn(node.defaultCase.consequent);
      }
      function blockContainsReturn(block) {
        return block.body.some(statementContainsReturn);
      }
      function statementContainsReturn(stmt) {
        switch (stmt.type) {
          case "ReturnStatement":
            return true;
          case "BlockStatement":
            return blockContainsReturn(stmt);
          case "IfStatement":
            return blockContainsReturn(stmt.consequent) || (stmt.alternate ? stmt.alternate.type === "BlockStatement" ? blockContainsReturn(stmt.alternate) : statementContainsReturn(stmt.alternate) : false);
          case "ForInStatement":
            return blockContainsReturn(stmt.body) || (stmt.elseBlock ? blockContainsReturn(stmt.elseBlock) : false);
          case "WhileStatement":
            return blockContainsReturn(stmt.body);
          case "TryStatement":
            return blockContainsReturn(stmt.block) || (stmt.handlers || []).some((handler) => blockContainsReturn(handler.body));
          case "SwitchStatement":
            return switchStatementContainsReturn(stmt);
          default:
            return false;
        }
      }
      function emitExpression(node) {
        const options = currentEmitContext();
        switch (node.type) {
          case "Identifier":
            if (options.fieldNames && options.fieldNames.includes(node.name) && !scopeHasName(options, node.name)) {
              return `${options.methodSelfName || "self"}[${JSON.stringify(node.name)}]`;
            }
            return node.name === "__argc__" ? "__argc__" : node.name;
          case "NumericLiteral":
            return String(node.value);
          case "StringLiteral":
            return JSON.stringify(node.value);
          case "BinaryStringLiteral":
            return `__zuzu_binary_literal( ${JSON.stringify(node.value)} )`;
          case "TemplateLiteral":
            return emitTemplateLiteral(node);
          case "RegExpLiteral":
            return `new RegExp( ${JSON.stringify(node.pattern)}, ${JSON.stringify(node.flags)} )`;
          case "Literal":
            if (node.value === null) {
              return "null";
            }
            return node.value ? "true" : "false";
          case "Super":
            throw new UnsupportedSyntaxError("super must be called like a method");
          case "GroupedExpression":
            return `( ${emitExpression(node.expression)} )`;
          case "ArrayExpression":
            return `[ ${node.elements.map((element) => {
              if (element.type === "BinaryExpression" && element.operator === "...") {
                return `...${emitExpression(element)}`;
              }
              return emitExpression(element);
            }).join(", ")} ]`;
          case "SetLiteral":
            return `__zuzu_set( [ ${emitCollectionElements(node.elements)} ] )`;
          case "BagLiteral":
            return `__zuzu_bag( [ ${emitCollectionElements(node.elements)} ] )`;
          case "PairListLiteral":
            return `__zuzu_pairlist_literal( [ ${emitPairListEntries(node.entries)} ] )`;
          case "ObjectExpression":
            return `{ ${node.properties.map((prop) => `${JSON.stringify(prop.key)}: ${emitExpression(prop.value)}`).join(", ")} }`;
          case "NamedArgument":
            return `[ ${emitExpression(node.keyExpr || { type: "StringLiteral", value: node.key })}, ${emitExpression(node.value)} ]`;
          case "BraceIdentifier":
            return JSON.stringify(node.name);
          case "SliceExpression":
            return emitSliceExpression(node);
          case "MemberExpression":
            if (node.computed) {
              if (node.property.type === "BraceIdentifier") {
                return `__zuzu_get_brace_member( ${emitExpression(node.object)}, ${JSON.stringify(node.property.name)}, () => ${node.property.name} )`;
              }
              return `__zuzu_get_index( ${emitExpression(node.object)}, ${emitExpression(node.property)} )`;
            }
            return `__zuzu_get_member( ${emitExpression(node.object)}, ${JSON.stringify(node.property.name)} )`;
          case "CallExpression":
            if (node.callee.type === "Super") {
              const args = emitCallArguments(node.arguments).join(", ");
              const argArray = node.arguments.length > 0 ? `[ ${args} ]` : "[]";
              return `__zuzu_super_dispatch( __zuzu_super_static__, self, __zuzu_super_class__, __zuzu_super_method__, ${argArray} )`;
            }
            if (node.callee.type === "Identifier" && node.callee.name === "eval" && node.arguments.length > 0) {
              return emitEvalCall(node.arguments);
            }
            if (node.callee.type === "MemberExpression" && !node.callee.computed && node.callee.property.type === "Identifier" && node.callee.property.name === "length" && node.arguments.length === 0) {
              return `__zuzu_length( ${emitExpression(node.callee.object)} )`;
            }
            if (node.callee.type === "MemberExpression") {
              const args = emitCallArguments(node.arguments).join(", ");
              if (node.arguments.length === 0) {
                const object2 = emitExpression(node.callee.object);
                const property = node.callee.computed ? node.callee.property.type === "BraceIdentifier" ? `__zuzu_resolve_brace_key( ${object2}, ${JSON.stringify(node.callee.property.name)}, () => ${node.callee.property.name} )` : emitExpression(node.callee.property) : JSON.stringify(node.callee.property.name);
                return `__zuzu_call_member( ${object2}, ${property} )`;
              }
              const object = emitExpression(node.callee.object);
              if (node.callee.computed) {
                const property = node.callee.property.type === "BraceIdentifier" ? `__zuzu_resolve_brace_key( ${object}, ${JSON.stringify(node.callee.property.name)}, () => ${node.callee.property.name} )` : emitExpression(node.callee.property);
                return `${object}[${property}]( ${args} )`;
              }
              return `${object}.${node.callee.property.name}( ${args} )`;
            }
            return `${emitExpression(node.callee)}( ${emitCallArguments(node.arguments).join(", ")} )`;
          case "RegexReplaceExpression":
            return emitRegexReplaceExpression(node);
          case "RefExpression":
            return emitRefExpression(node);
          case "AssignmentExpression":
            return emitAssignmentExpression(node);
          case "ConditionalExpression":
            return `( __zuzu_truthy( ${emitExpression(node.test)} ) ? ${emitExpression(node.consequent)} : ${emitExpression(node.alternate)} )`;
          case "ShortTernaryExpression":
            return `( __zuzu_truthy( ${emitExpression(node.test)} ) ? ${emitExpression(node.test)} : ${emitExpression(node.alternate)} )`;
          case "TryExpression":
            return emitTryExpression(node);
          case "DoExpression":
            return emitDoExpression(node);
          case "UnaryExpression":
            return emitUnaryExpression(node);
          case "BinaryExpression":
            return emitBinaryExpression(node);
          case "UpdateExpression":
            {
              const target = unwrapGroupedExpression(node.argument);
              if (target && target.type === "BinaryExpression" && ["@", "@@", "@?"].includes(target.operator)) {
                const mode = target.operator === "@@" ? "all" : target.operator === "@?" ? "maybe" : "first";
                return `__zuzu_path_update( ${emitExpression(target.left)}, ${emitExpression(target.right)}, "${mode}", ${JSON.stringify(node.operator)}, ${node.prefix ? "true" : "false"} )`;
              }
            }
            return node.prefix ? `${node.operator}${emitAssignmentTarget(node.argument)}` : `${emitAssignmentTarget(node.argument)}${node.operator}`;
          case "FunctionExpression":
            return `( ${emitFunctionLike(node, "function()")} )`;
          case "NewExpression":
            return `new ${emitExpression(node.callee)}`;
          default:
            throw new UnsupportedSyntaxError(`Unsupported expression node ${node.type}`);
        }
      }
      function emitUnaryExpression(node) {
        const target = unwrapGroupedExpression(node.argument);
        if ((node.operator === "++" || node.operator === "--") && target && target.type === "BinaryExpression" && ["@", "@@", "@?"].includes(target.operator)) {
          const mode = target.operator === "@@" ? "all" : target.operator === "@?" ? "maybe" : "first";
          return `__zuzu_path_update( ${emitExpression(target.left)}, ${emitExpression(target.right)}, "${mode}", ${JSON.stringify(node.operator)}, true )`;
        }
        if (node.operator === "not") {
          return `__zuzu_not( ${emitExpression(node.argument)} )`;
        }
        if (node.operator === "\xAC") {
          return `__zuzu_not( ${emitExpression(node.argument)} )`;
        }
        if (node.operator === "!") {
          return `__zuzu_not( ${emitExpression(node.argument)} )`;
        }
        if (node.operator === "~") {
          return `__zuzu_bit_not( ${emitExpression(node.argument)} )`;
        }
        if (node.operator === "typeof") {
          return `__zuzu_typeof( ${emitExpression(node.argument)} )`;
        }
        if (node.operator === "abs") {
          return `__zuzu_abs( ${emitExpression(node.argument)} )`;
        }
        if (node.operator === "sqrt") {
          return `__zuzu_sqrt( ${emitExpression(node.argument)} )`;
        }
        if (node.operator === "\u221A") {
          return `__zuzu_sqrt( ${emitExpression(node.argument)} )`;
        }
        if (node.operator === "floor") {
          return `__zuzu_floor( ${emitExpression(node.argument)} )`;
        }
        if (node.operator === "ceil") {
          return `__zuzu_ceil( ${emitExpression(node.argument)} )`;
        }
        if (node.operator === "round") {
          return `__zuzu_round( ${emitExpression(node.argument)} )`;
        }
        if (node.operator === "int") {
          return `__zuzu_int( ${emitExpression(node.argument)} )`;
        }
        if (node.operator === "length") {
          return `__zuzu_length( ${emitExpression(node.argument)} )`;
        }
        if (node.operator === "uc") {
          return `__zuzu_uc( ${emitExpression(node.argument)} )`;
        }
        if (node.operator === "lc") {
          return `__zuzu_lc( ${emitExpression(node.argument)} )`;
        }
        return `${node.operator}${emitExpression(node.argument)}`;
      }
      function emitTemplateLiteral(node) {
        if (!node.parts || node.parts.length === 0) {
          return '""';
        }
        let out = emitExpression(node.parts[0]);
        for (let i = 1; i < node.parts.length; i++) {
          out = `__zuzu_concat( ${out}, ${emitExpression(node.parts[i])} )`;
        }
        return out;
      }
      function emitCollectionElements(elements) {
        return elements.map((element) => {
          if (element.type === "BinaryExpression" && element.operator === "...") {
            return `...${emitExpression(element)}`;
          }
          return emitExpression(element);
        }).join(", ");
      }
      function emitPairListEntries(entries) {
        return entries.map((entry) => {
          if (entry.type === "PairListEntry") {
            const keyExpr = entry.keyExpr || { type: "StringLiteral", value: entry.key };
            return `[ ${emitExpression(keyExpr)}, ${emitExpression(entry.value)} ]`;
          }
          return emitExpression(entry);
        }).join(", ");
      }
      function emitBinaryExpression(node) {
        const left = emitExpression(node.left);
        const right = emitExpression(node.right);
        switch (node.operator) {
          case "and":
          case "\u22C0":
            return `( () => { const __zuzu_left = ${left}; return __zuzu_truthy( __zuzu_left ) ? ( __zuzu_truthy( ${right} ) ? 1 : 0 ) : 0; } )()`;
          case "or":
          case "\u22C1":
            return `( () => { const __zuzu_left = ${left}; return __zuzu_truthy( __zuzu_left ) ? 1 : ( __zuzu_truthy( ${right} ) ? 1 : 0 ); } )()`;
          case "xor":
          case "\u22BB":
            return `__zuzu_xor( ${left}, ${right} )`;
          case "nand":
          case "\u22BC":
            return `__zuzu_nand( ${left}, ${right} )`;
          case "eq":
            return `__zuzu_str_eq( ${left}, ${right} )`;
          case "ne":
            return `( __zuzu_str_eq( ${left}, ${right} ) ? 0 : 1 )`;
          case "==":
            return `__zuzu_eq( ${left}, ${right} )`;
          case "=":
            return `__zuzu_num_eq( ${left}, ${right} )`;
          case "\u2261":
            return `__zuzu_eq( ${left}, ${right} )`;
          case "\u2262":
            return `__zuzu_ne( ${left}, ${right} )`;
          case "!=":
          case "\u2260":
            return `__zuzu_num_ne( ${left}, ${right} )`;
          case "~":
            return `__zuzu_match( ${left}, ${right} )`;
          case "_":
            return `__zuzu_concat( ${left}, ${right} )`;
          case "+":
            return `__zuzu_add( ${left}, ${right} )`;
          case "-":
            return `__zuzu_sub( ${left}, ${right} )`;
          case "*":
          case "\xD7":
            return `__zuzu_mul( ${left}, ${right} )`;
          case "/":
          case "\xF7":
            return `__zuzu_div( ${left}, ${right} )`;
          case "**":
            return `__zuzu_pow( ${left}, ${right} )`;
          case "mod":
            return `( __zuzu_num( ${left} ) % __zuzu_num( ${right} ) )`;
          case "...":
            return `__zuzu_range( ${left}, ${right} )`;
          case "<=>":
          case "\u2276":
          case "\u2277":
            return `__zuzu_cmp( ${left}, ${right} )`;
          case "cmp":
            return `__zuzu_str_cmp( ${left}, ${right} )`;
          case "gt":
            return `__zuzu_str_gt( ${left}, ${right} )`;
          case "ge":
            return `__zuzu_str_ge( ${left}, ${right} )`;
          case "lt":
            return `__zuzu_str_lt( ${left}, ${right} )`;
          case "le":
            return `__zuzu_str_le( ${left}, ${right} )`;
          case "eqi":
            return `__zuzu_str_eqi( ${left}, ${right} )`;
          case "nei":
            return `__zuzu_str_nei( ${left}, ${right} )`;
          case "gti":
            return `__zuzu_str_gti( ${left}, ${right} )`;
          case "gei":
            return `__zuzu_str_gei( ${left}, ${right} )`;
          case "lti":
            return `__zuzu_str_lti( ${left}, ${right} )`;
          case "lei":
            return `__zuzu_str_lei( ${left}, ${right} )`;
          case "cmpi":
            return `__zuzu_str_cmpi( ${left}, ${right} )`;
          case "\u2264":
            return `__zuzu_num_lte( ${left}, ${right} )`;
          case "\u2265":
            return `__zuzu_num_gte( ${left}, ${right} )`;
          case "<":
            return `__zuzu_num_lt( ${left}, ${right} )`;
          case "<=":
            return `__zuzu_num_lte( ${left}, ${right} )`;
          case ">":
            return `__zuzu_num_gt( ${left}, ${right} )`;
          case ">=":
            return `__zuzu_num_gte( ${left}, ${right} )`;
          case "union":
          case "\u22C3":
            return `__zuzu_union( ${left}, ${right} )`;
          case "intersection":
          case "\u22C2":
            return `__zuzu_intersection( ${left}, ${right} )`;
          case "\\":
          case "\u2216":
          case "difference":
            return `__zuzu_difference( ${left}, ${right} )`;
          case "subsetof":
          case "\u2282":
            return `__zuzu_subsetof( ${left}, ${right} )`;
          case "supersetof":
          case "\u2283":
            return `__zuzu_supersetof( ${left}, ${right} )`;
          case "equivalentof":
          case "\u2282\u2283":
            return `__zuzu_equivalentof( ${left}, ${right} )`;
          case "instanceof":
            return `__zuzu_instanceof( ${left}, ${right} )`;
          case "does":
            return `__zuzu_does( ${left}, ${right} )`;
          case "can":
            if (node.right.type === "Identifier") {
              return `__zuzu_can( ${left}, ${JSON.stringify(node.right.name)} )`;
            }
            return `__zuzu_can( ${left}, ${right} )`;
          case "in":
          case "\u2208":
            return `__zuzu_contains( ${right}, ${left} )`;
          case "not_in":
          case "\u2209":
            return `( __zuzu_contains( ${right}, ${left} ) ? 0 : 1 )`;
          case "@":
            return `__zuzu_path_op( ${left}, ${right}, "first" )`;
          case "@@":
            return `__zuzu_path_op( ${left}, ${right}, "all" )`;
          case "@?":
            return `__zuzu_path_op( ${left}, ${right}, "exists" )`;
          case "&":
            return `__zuzu_bit_and( ${left}, ${right} )`;
          case "|":
            return `__zuzu_bit_or( ${left}, ${right} )`;
          case "^":
            return `__zuzu_bit_xor( ${left}, ${right} )`;
          default:
            return `( ${left} ${node.operator} ${right} )`;
        }
      }
      function emitAssignmentExpression(node) {
        if (node.left && node.left.type === "BinaryExpression" && ["@", "@@", "@?"].includes(node.left.operator)) {
          const target = emitExpression(node.left.left);
          const path = emitExpression(node.left.right);
          const right2 = emitExpression(node.right);
          const mode = node.left.operator === "@@" ? "all" : node.left.operator === "@?" ? "maybe" : "first";
          return `__zuzu_path_assign( ${target}, ${path}, ${right2}, "${mode}", ${JSON.stringify(node.operator)} )`;
        }
        const left = emitAssignmentTarget(node.left);
        const right = emitExpression(node.right);
        switch (node.operator) {
          case ":=":
            return `${left} = ${right}`;
          case "+=":
          case "-=":
          case "*=":
          case "\xD7=":
          case "/=":
          case "\xF7=":
          case "%=":
          case "**=":
            return `${left} ${node.operator.replace("\xD7=", "*=").replace("\xF7=", "/=")} ${right}`;
          case "_=":
            return `${left} = __zuzu_concat( ${left}, ${right} )`;
          case "?:=":
            return `( ${left} == null ? ( ${left} = ${right} ) : ${left} )`;
          default:
            throw new UnsupportedSyntaxError(`Unsupported assignment operator ${node.operator}`);
        }
      }
      function emitAssignmentTarget(node) {
        if (node && node.type === "MemberExpression" && node.computed && node.property) {
          if (node.property.type === "BraceIdentifier") {
            return `${emitExpression(node.object)}[${JSON.stringify(node.property.name)}]`;
          }
          return `${emitExpression(node.object)}[${emitExpression(node.property)}]`;
        }
        return emitExpression(node);
      }
      function emitSliceExpression(node) {
        const object = emitExpression(node.object);
        const start = node.start ? emitExpression(node.start) : "0";
        if (node.length == null) {
          return `${object}.slice( ${start} )`;
        }
        const length = emitExpression(node.length);
        const end = isNegativeNumericLiteral(node.length) ? length : `__zuzu_add( ${start}, ${length} )`;
        return `${object}.slice( ${start}, ${end} )`;
      }
      function unwrapGroupedExpression(node) {
        let current = node;
        while (current && current.type === "GroupedExpression") {
          current = current.expression;
        }
        return current;
      }
      function isNegativeNumericLiteral(node) {
        return !!(node && node.type === "UnaryExpression" && node.operator === "-" && node.argument && node.argument.type === "NumericLiteral");
      }
      function emitRegexReplaceExpression(node) {
        const leftTarget = unwrapGroupedExpression(node.left);
        if (leftTarget && leftTarget.type === "BinaryExpression" && ["@", "@@", "@?"].includes(leftTarget.operator)) {
          const mode = leftTarget.operator === "@@" ? "all" : leftTarget.operator === "@?" ? "maybe" : "first";
          const pattern2 = node.pattern.type === "RegExpLiteral" ? emitExpression(node.pattern) : `new RegExp( String( ${emitExpression(node.pattern)} ) )`;
          return `__zuzu_path_assign( ${emitExpression(leftTarget.left)}, ${emitExpression(leftTarget.right)}, [ ${pattern2}, ( m ) => ${emitExpression(node.replacement)} ], "${mode}", "~=" )`;
        }
        const left = emitExpression(node.left);
        const pattern = node.pattern.type === "RegExpLiteral" ? emitExpression(node.pattern) : `( Object.prototype.toString.call( ${emitExpression(node.pattern)} ) === "[object RegExp]" ? ${emitExpression(node.pattern)} : new RegExp( String( ${emitExpression(node.pattern)} ) ) )`;
        const replacement = emitExpression(node.replacement);
        return `${left} = String( ${left} ).replace( ${pattern}, ( ...__zuzu_match_args ) => { const m = __zuzu_match_args; return ${replacement}; } )`;
      }
      function emitRefExpression(node) {
        const arg = unwrapGroupedExpression(node.argument);
        if (arg && arg.type === "BinaryExpression" && ["@", "@@", "@?"].includes(arg.operator)) {
          const mode = arg.operator === "@@" ? "all" : arg.operator === "@?" ? "maybe" : "first";
          return `__zuzu_path_ref( ${emitExpression(arg.left)}, ${emitExpression(arg.right)}, "${mode}" )`;
        }
        if (arg.type === "SliceExpression") {
          return `__zuzu_ref_slice( ${emitExpression(arg.object)}, ${arg.start ? emitExpression(arg.start) : "0"}, ${arg.length == null ? "null" : emitExpression(arg.length)} )`;
        }
        if (arg.type === "MemberExpression") {
          if (arg.computed) {
            if (arg.property.type === "BraceIdentifier") {
              return `__zuzu_ref_index( ${emitExpression(arg.object)}, ${JSON.stringify(arg.property.name)} )`;
            }
            return `__zuzu_ref_index( ${emitExpression(arg.object)}, ${emitExpression(arg.property)} )`;
          }
          return `__zuzu_ref_key( ${emitExpression(arg.object)}, ${JSON.stringify(arg.property.name)} )`;
        }
        throw new UnsupportedSyntaxError("Unsupported reference target");
      }
      function emitExpressionBlock(block, options = {}) {
        if (!block || !Array.isArray(block.body) || block.body.length === 0) {
          return "return null;";
        }
        const lines = [];
        const lastIndex = block.body.length - 1;
        for (let i = 0; i < block.body.length; i++) {
          const stmt = block.body[i];
          if (i === lastIndex) {
            lines.push(emitExpressionTail(stmt, options));
          } else {
            lines.push(emitExpressionInnerStatement(stmt, options));
          }
        }
        return lines.join("\n");
      }
      function emitExpressionInnerStatement(stmt, options = {}) {
        if (options.nonLocalReturn && stmt.type === "ReturnStatement") {
          return emitDoReturnStatement(stmt);
        }
        return emitStatement(stmt);
      }
      function emitExpressionTail(stmt, options = {}) {
        if (stmt.type === "ExpressionStatement") {
          return `return ${emitExpression(stmt.expression)};`;
        }
        if (stmt.type === "ReturnStatement") {
          return options.nonLocalReturn ? emitDoReturnStatement(stmt) : emitStatement(stmt);
        }
        if (stmt.type === "BlockStatement") {
          return emitExpressionBlock(stmt, options);
        }
        if (stmt.type === "IfStatement") {
          const prefix = stmt.declaration ? `${emitStatement(stmt.declaration)}
` : "";
          const alternate = stmt.alternate ? emitExpressionTail(stmt.alternate, options) : "return null;";
          return `${prefix}if ( __zuzu_truthy( ${emitExpression(stmt.test)} ) ) { ${emitExpressionBlock(stmt.consequent, options)} } else { ${alternate} }`;
        }
        return emitStatement(stmt);
      }
      function emitDoReturnStatement(stmt) {
        return `throw { __zuzu_nonlocal_return: true, value: ${stmt.argument ? emitExpression(stmt.argument) : "null"} };`;
      }
      function emitTryExpression(node) {
        const handlers = node.handlers || [];
        let catchBody = "throw __zuzu_err;";
        if (handlers.length > 0) {
          const branches = handlers.map((handler, index) => {
            const cond = handler.typeName === "Exception" || handler.typeName === "Any" ? "true" : `__zuzu_err instanceof ${handler.typeName}`;
            const prefix = index === 0 ? `if ( ${cond} )` : `else if ( ${cond} )`;
            return `${prefix} { let ${handler.paramName} = __zuzu_err; ${emitExpressionBlock(handler.body)} }`;
          });
          catchBody = `if ( __zuzu_err && __zuzu_err.__zuzu_nonlocal_return ) { throw __zuzu_err; } ${branches.join(" ")} else { throw __zuzu_err; }`;
        }
        return `( () => { try { ${emitExpressionBlock(node.block)} } catch ( __zuzu_err ) { ${catchBody} } } )()`;
      }
      function emitDoExpression(node) {
        return `( () => { ${emitExpressionBlock(node.block, { nonLocalReturn: true })} } )()`;
      }
      function emitCallArguments(args) {
        const positional = [];
        const named = [];
        for (const arg of args) {
          if (arg.type === "NamedArgument") {
            named.push(arg);
          } else {
            positional.push(emitExpression(arg));
          }
        }
        if (named.length > 0) {
          positional.push(`__zuzu_pairlist_literal( [ ${named.map((arg) => emitExpression(arg)).join(", ")} ] )`);
        }
        return positional;
      }
      function emitEvalCall(args) {
        const positional = [];
        const named = [];
        for (const arg of args) {
          if (arg.type === "NamedArgument") {
            named.push(arg);
          } else {
            positional.push(arg);
          }
        }
        const source = positional.length > 0 ? emitExpression(positional[0]) : '""';
        const namedArgs = named.length > 0 ? `__zuzu_pairlist_literal( [ ${named.map((arg) => emitExpression(arg)).join(", ")} ] )` : "null";
        return `eval( __zuzu_prepare_eval( ${source}, ${namedArgs} ) )`;
      }
      module.exports = {
        emitProgram
      };
    }
  });

  // extras/zuzu-js/lib/transpiler-new/index.js
  var require_transpiler_new = __commonJS({
    "extras/zuzu-js/lib/transpiler-new/index.js"(exports, module) {
      "use strict";
      var { stripPod } = require_transpiler_utils();
      var { tokenize } = require_lexer();
      var { parse } = require_parser();
      var { emitProgram } = require_codegen();
      function transpileWithoutFallback(source, _options = {}) {
        const preprocessed = stripPod(String(source ?? ""));
        const tokens = tokenize(preprocessed);
        const ast = parse(tokens);
        return emitProgram(ast);
      }
      function transpile(source, options = {}) {
        return transpileWithoutFallback(source, options);
      }
      module.exports = {
        tokenize,
        parse,
        transpileWithoutFallback,
        transpile
      };
    }
  });

  // extras/zuzu-js/lib/transpiler.js
  var require_transpiler = __commonJS({
    "extras/zuzu-js/lib/transpiler.js"(exports, module) {
      "use strict";
      var { stripPod } = require_transpiler_utils();
      var { transpile: transpileNew } = require_transpiler_new();
      var DEFAULT_TRANSPILER = "new-only";
      var VALID_TRANSPILERS = /* @__PURE__ */ new Set([DEFAULT_TRANSPILER]);
      function normalizeTranspilerName(value) {
        if (value == null || value === "") {
          return DEFAULT_TRANSPILER;
        }
        const name = String(value).trim().toLowerCase();
        if (!VALID_TRANSPILERS.has(name)) {
          throw new Error(
            `Unknown transpiler: ${value}. Expected: ${DEFAULT_TRANSPILER}`
          );
        }
        return name;
      }
      function transpile(source, options = {}) {
        normalizeTranspilerName(options.transpiler);
        return transpileNew(source, options);
      }
      module.exports = {
        DEFAULT_TRANSPILER,
        VALID_TRANSPILERS,
        normalizeTranspilerName,
        transpile,
        stripPod
      };
    }
  });

  // extras/zuzu-js/lib/host/capabilities.js
  var require_capabilities = __commonJS({
    "extras/zuzu-js/lib/host/capabilities.js"(exports, module) {
      "use strict";
      var MODULE_CAPABILITIES = {
        "std/io": ["fs"],
        "std/io/socks": ["fs", "net"],
        "std/proc": ["proc"],
        "std/db": ["db"],
        "std/data/csv": ["fs", "db"],
        "std/net/http": ["http"]
      };
      var BROWSER_SAFE_MODULES = /* @__PURE__ */ new Set([
        "std/string",
        "std/time",
        "std/data/json",
        "std/data/xml",
        "std/net/http",
        "std/math",
        "std/eval"
      ]);
      function capabilitiesForModule(moduleName) {
        for (const [prefix, capabilities] of Object.entries(MODULE_CAPABILITIES)) {
          if (moduleName === prefix || moduleName.startsWith(`${prefix}/`)) {
            return capabilities.slice();
          }
        }
        return [];
      }
      module.exports = {
        MODULE_CAPABILITIES,
        BROWSER_SAFE_MODULES,
        capabilitiesForModule
      };
    }
  });

  // extras/zuzu-js/lib/runtime.js
  var require_runtime = __commonJS({
    "extras/zuzu-js/lib/runtime.js"(exports, module) {
      "use strict";
      var { capabilitiesForModule } = require_capabilities();
      var { setCompiledSource } = require_execution_metadata();
      var {
        DEFAULT_TRANSPILER,
        normalizeTranspilerName,
        transpile,
        stripPod
      } = require_transpiler();
      var {
        collectTopLevelDeclarations,
        runSwitch,
        runMatch,
        contains,
        collectionUnion,
        collectionIntersection,
        collectionDifference,
        collectionSubsetOf,
        collectionSupersetOf,
        collectionEquivalentOf,
        makeSet,
        makeBag,
        makePairList,
        lengthOf,
        ZuzuBinary,
        BinaryString,
        Pair,
        PairList,
        withArrayMethods,
        ZuzuBag
      } = require_runtime_helpers();
      var textEncoder = new TextEncoder();
      var utf8Decoder = new TextDecoder("utf-8", { fatal: true });
      function installHostCollectionMethods() {
        withArrayMethods();
      }
      function zuzuStringify(value) {
        if (value == null) {
          return "";
        }
        if (typeof value === "boolean") {
          return value ? "1" : "0";
        }
        if (value instanceof RegExp) {
          return value.source;
        }
        if (value instanceof ZuzuBinary) {
          return value.to_String();
        }
        if (value && typeof value.to_String === "function") {
          return String(value.to_String());
        }
        if (value instanceof Error) {
          return value.message || value.name || String(value);
        }
        return String(value);
      }
      function binaryFromLiteral(value) {
        const text = String(value ?? "");
        const bytes = [];
        for (let i = 0; i < text.length; i++) {
          bytes.push(text.charCodeAt(i) & 255);
        }
        return new BinaryString(bytes);
      }
      function toBinaryValue(value) {
        if (value instanceof ZuzuBinary) {
          return new BinaryString(value);
        }
        if (typeof value === "string") {
          return new BinaryString(textEncoder.encode(value));
        }
        throw new Error(`TypeException: expected String for to_binary, got ${zuzuTypeof(value)}`);
      }
      function toStringValue(value) {
        if (typeof value === "string") {
          return value;
        }
        if (value instanceof ZuzuBinary) {
          try {
            return utf8Decoder.decode(value.bytes);
          } catch (err) {
            return Array.from(value.bytes, (byte) => String.fromCharCode(byte)).join("");
          }
        }
        throw new Error(`TypeException: expected BinaryString for to_string, got ${zuzuTypeof(value)}`);
      }
      function stringCompare(left, right, options = {}) {
        const l = options.insensitive ? zuzuStringify(left).toLowerCase() : zuzuStringify(left);
        const r = options.insensitive ? zuzuStringify(right).toLowerCase() : zuzuStringify(right);
        return l.localeCompare(r);
      }
      function parseNumericString(value) {
        const text = String(value).trimStart();
        const match = text.match(/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?/);
        if (!match) {
          return 0;
        }
        const parsed = Number(match[0]);
        return Number.isNaN(parsed) ? 0 : parsed;
      }
      function zuzuToNumber(value) {
        if (value == null) {
          return 0;
        }
        if (value && typeof value.to_Number === "function") {
          return zuzuToNumber(value.to_Number());
        }
        if (typeof value === "string" || Object.prototype.toString.call(value) === "[object String]") {
          return parseNumericString(value);
        }
        const n = Number(value);
        return Number.isNaN(n) ? 0 : n;
      }
      function zuzuTruthy(value) {
        if (value && typeof value.to_Boolean === "function") {
          return Boolean(zuzuToNumber(value.to_Boolean()));
        }
        return Boolean(value);
      }
      function isNumericComparable(value) {
        if (value == null) {
          return true;
        }
        if (typeof value === "number" || typeof value === "string" || typeof value === "boolean") {
          return true;
        }
        const tag = Object.prototype.toString.call(value);
        if (tag === "[object Number]" || tag === "[object String]" || tag === "[object Boolean]") {
          return true;
        }
        return Boolean(value && typeof value.to_Number === "function");
      }
      function numericEqual(left, right) {
        const leftNum = zuzuToNumber(left);
        const rightNum = zuzuToNumber(right);
        if (Object.is(leftNum, rightNum)) {
          return true;
        }
        if (Number.isInteger(leftNum) && Number.isInteger(rightNum)) {
          return false;
        }
        const scale = Math.max(1, Math.abs(leftNum), Math.abs(rightNum));
        return Math.abs(leftNum - rightNum) <= Number.EPSILON * 16 * scale;
      }
      function isExhaustedIteratorError(err) {
        if (!err) {
          return false;
        }
        const name = String(err.name || err.constructor && err.constructor.name || "");
        if (name === "ExhaustedException") {
          return true;
        }
        const message = String(err.message || "");
        if (/\bExhaustedException\b/.test(message)) {
          return true;
        }
        const stack = String(err.stack || "");
        return /\bExhaustedException\b/.test(stack);
      }
      function formatRuntimeError(err) {
        if (err && err.name === "SyntaxError" && typeof err.stack === "string" && err.stack.trim()) {
          return `${err.stack}
`;
        }
        if (err && err.name && err.message) {
          return `${err.name}: ${err.message}
`;
        }
        return `${String(err)}
`;
      }
      function concatValue(left, right) {
        if (left instanceof ZuzuBinary && right instanceof ZuzuBinary) {
          const merged = new Uint8Array(left.length + right.length);
          merged.set(left.bytes, 0);
          merged.set(right.bytes, left.length);
          return new BinaryString(merged);
        }
        if (typeof left === "string" && typeof right === "string") {
          return left + right;
        }
        if (left instanceof ZuzuBinary && typeof right === "string") {
          if (!left.isAscii()) {
            throw new Error("TypeException: Cannot implicitly concatenate non-ASCII BinaryString with String");
          }
          return left.to_String() + right;
        }
        if (typeof left === "string" && right instanceof ZuzuBinary) {
          if (!right.isAscii()) {
            throw new Error("TypeException: Cannot implicitly concatenate non-ASCII BinaryString with String");
          }
          return left + right.to_String();
        }
        return zuzuStringify(left) + zuzuStringify(right);
      }
      function bitwiseBinaryPair(left, right, opName) {
        if (left.length !== right.length) {
          throw new Error("Exception: BinaryString bitwise operands must be equal length");
        }
        const out = new Uint8Array(left.length);
        for (let i = 0; i < left.length; i++) {
          const a = left.bytes[i];
          const b = right.bytes[i];
          if (opName === "and") {
            out[i] = a & b;
          } else if (opName === "or") {
            out[i] = a | b;
          } else {
            out[i] = a ^ b;
          }
        }
        return new BinaryString(out);
      }
      function bitwiseAnd(left, right) {
        if (left instanceof ZuzuBinary && right instanceof ZuzuBinary) {
          return bitwiseBinaryPair(left, right, "and");
        }
        return (zuzuToNumber(left) >>> 0 & zuzuToNumber(right) >>> 0) >>> 0;
      }
      function bitwiseOr(left, right) {
        if (left instanceof ZuzuBinary && right instanceof ZuzuBinary) {
          return bitwiseBinaryPair(left, right, "or");
        }
        return (zuzuToNumber(left) >>> 0 | zuzuToNumber(right) >>> 0) >>> 0;
      }
      function bitwiseXor(left, right) {
        if (left instanceof ZuzuBinary && right instanceof ZuzuBinary) {
          return bitwiseBinaryPair(left, right, "xor");
        }
        return (zuzuToNumber(left) >>> 0 ^ zuzuToNumber(right) >>> 0) >>> 0;
      }
      function bitwiseNot(value) {
        if (value instanceof ZuzuBinary) {
          const out = new Uint8Array(value.length);
          for (let i = 0; i < value.length; i++) {
            out[i] = ~value.bytes[i] & 255;
          }
          return new BinaryString(out);
        }
        return new Number(~(zuzuToNumber(value) >>> 0) >>> 0);
      }
      function zuzuComparableValue(value) {
        if (typeof value === "function" && value.length === 0) {
          try {
            return value();
          } catch (_err) {
            return value;
          }
        }
        return value;
      }
      function zuzuEqual(left, right) {
        const a = zuzuComparableValue(left);
        const b = zuzuComparableValue(right);
        if (a === b) {
          return 1;
        }
        if (a == null || b == null) {
          return 0;
        }
        if (a instanceof ZuzuBinary && b instanceof ZuzuBinary) {
          if (a.bytes.length !== b.bytes.length) {
            return 0;
          }
          for (let i = 0; i < a.bytes.length; i++) {
            if (a.bytes[i] !== b.bytes[i]) {
              return 0;
            }
          }
          return 1;
        }
        if (Array.isArray(a) && Array.isArray(b)) {
          if (a.length !== b.length) {
            return 0;
          }
          for (let i = 0; i < a.length; i++) {
            if (!zuzuEqual(a[i], b[i])) {
              return 0;
            }
          }
          return 1;
        }
        if (isSetLike(a) && isSetLike(b)) {
          return collectionEquivalentOf(a, b) ? 1 : 0;
        }
        if (isBagLike(a) && isBagLike(b)) {
          return zuzuEqual(a.to_Array(), b.to_Array());
        }
        if (a instanceof PairList && b instanceof PairList) {
          if (a.list.length !== b.list.length) {
            return 0;
          }
          for (let i = 0; i < a.list.length; i++) {
            if (a.list[i][0] !== b.list[i][0]) {
              return 0;
            }
            if (!zuzuEqual(a.list[i][1], b.list[i][1])) {
              return 0;
            }
          }
          return 1;
        }
        if (isPlainObjectLike(a) && isPlainObjectLike(b)) {
          const keysA = Object.keys(a).sort();
          const keysB = Object.keys(b).sort();
          if (!zuzuEqual(keysA, keysB)) {
            return 0;
          }
          for (const key of keysA) {
            if (!zuzuEqual(a[key], b[key])) {
              return 0;
            }
          }
          return 1;
        }
        return 0;
      }
      function isSetLike(value) {
        return Object.prototype.toString.call(value) === "[object Set]";
      }
      function isBagLike(value) {
        return value instanceof ZuzuBag || value && value.constructor && value.constructor.name === "ZuzuBag";
      }
      function isPlainObjectLike(value) {
        return Object.prototype.toString.call(value) === "[object Object]";
      }
      function zuzuTypeof(value) {
        if (value == null) {
          return "Null";
        }
        if (isBagLike(value)) {
          return "Bag";
        }
        if (isSetLike(value)) {
          return "Set";
        }
        if (Array.isArray(value)) {
          return "Array";
        }
        if (value instanceof Pair) {
          return "Pair";
        }
        if (value instanceof RegExp) {
          return "Regexp";
        }
        if (Object.prototype.toString.call(value) === "[object RegExp]") {
          return "Regexp";
        }
        if (typeof value === "boolean") {
          return "Boolean";
        }
        if (typeof value === "number") {
          return "Number";
        }
        if (typeof value === "string") {
          return "String";
        }
        if (value instanceof ZuzuBinary) {
          return "BinaryString";
        }
        if (typeof value === "function") {
          const source = Function.prototype.toString.call(value);
          if (/^\s*class\b/.test(source)) {
            return "Class";
          }
          return "Function";
        }
        if (value && value.constructor) {
          const ctorName = value.constructor.name || "Object";
          if (ctorName === "Object") {
            return "Dict";
          }
          if (ctorName === "Error") {
            return "Exception";
          }
          return ctorName;
        }
        return "Object";
      }
      function zuzuInstanceof(value, klass) {
        if (klass == null) {
          return value == null ? 1 : 0;
        }
        const klassName = typeof klass === "function" && klass.name ? klass.name : "";
        if (klassName === "Any") {
          return 1;
        }
        if (klassName === "Null") {
          return value == null ? 1 : 0;
        }
        if (klassName === "Boolean" || klass === Boolean) {
          return typeof value === "boolean" || Object.prototype.toString.call(value) === "[object Boolean]" ? 1 : 0;
        }
        if (klassName === "Number" || klass === Number) {
          return typeof value === "number" || Object.prototype.toString.call(value) === "[object Number]" ? 1 : 0;
        }
        if (klassName === "String" || klass === String) {
          return typeof value === "string" || Object.prototype.toString.call(value) === "[object String]" ? 1 : 0;
        }
        if (klassName === "Array" || klass === Array) {
          return Array.isArray(value) ? 1 : 0;
        }
        if (klassName === "BinaryString") {
          return value instanceof ZuzuBinary ? 1 : 0;
        }
        if (klassName === "Exception") {
          if (value == null) {
            return 0;
          }
          if (value instanceof Error) {
            return 1;
          }
          const valueName = String(
            value.name || value.constructor && value.constructor.name || ""
          );
          return valueName === "Exception" || valueName === "ExhaustedException" ? 1 : 0;
        }
        if (klassName === "ExhaustedException") {
          if (value == null) {
            return 0;
          }
          const valueName = String(
            value.name || value.constructor && value.constructor.name || ""
          );
          return valueName === "ExhaustedException" ? 1 : 0;
        }
        if (klassName === "Collection") {
          return Array.isArray(value) || isSetLike(value) || isBagLike(value) || isPlainObjectLike(value) ? 1 : 0;
        }
        if (klassName === "Dict") {
          return isPlainObjectLike(value) ? 1 : 0;
        }
        if (klassName === "Set") {
          return isSetLike(value) ? 1 : 0;
        }
        if (klassName === "Bag") {
          return isBagLike(value) ? 1 : 0;
        }
        if (klassName === "Class") {
          return typeof value === "function" ? 1 : 0;
        }
        if (klassName === "Object" || klass === Object) {
          return value !== null && typeof value === "object" ? 1 : 0;
        }
        try {
          return value instanceof klass ? 1 : 0;
        } catch (_err) {
          return 0;
        }
      }
      function zuzuTrait(name, methods) {
        return {
          __zuzu_trait_name: String(name || ""),
          __zuzu_trait_methods: methods || {}
        };
      }
      function zuzuApplyTraits(klass, traits) {
        if (!klass || !klass.prototype || !Array.isArray(traits)) {
          return klass;
        }
        if (!Object.prototype.hasOwnProperty.call(klass, "__zuzu_traits")) {
          const desc = /* @__PURE__ */ Object.create(null);
          desc.value = /* @__PURE__ */ new Set();
          desc.enumerable = false;
          desc.configurable = true;
          desc.writable = true;
          Object.defineProperty(klass, "__zuzu_traits", desc);
        }
        for (const trait of traits) {
          if (!trait || !trait.__zuzu_trait_methods) {
            continue;
          }
          klass.__zuzu_traits.add(trait.__zuzu_trait_name || "");
          for (const [name, fn] of Object.entries(trait.__zuzu_trait_methods)) {
            if (typeof fn !== "function") {
              continue;
            }
            if (typeof klass.prototype[name] === "function") {
              klass.prototype[`__zuzu_trait_super__${name}`] = fn;
            } else {
              klass.prototype[name] = fn;
            }
          }
        }
        return klass;
      }
      function zuzuDoes(value, trait) {
        if (value == null || !trait) {
          return 0;
        }
        const name = trait.__zuzu_trait_name || trait.name || String(trait);
        let ctor = value.constructor;
        while (ctor) {
          if (ctor.__zuzu_traits instanceof Set && ctor.__zuzu_traits.has(name)) {
            return 1;
          }
          ctor = Object.getPrototypeOf(ctor);
        }
        return 0;
      }
      function defineZuzuClass(name, base, spec = {}) {
        const parent = typeof base === "function" ? base : Object;
        const fields = Array.isArray(spec.fields) ? spec.fields : [];
        const traits = Array.isArray(spec.traits) ? spec.traits : [];
        const methods = spec.methods && typeof spec.methods === "object" ? spec.methods : {};
        const statics = spec.statics && typeof spec.statics === "object" ? spec.statics : {};
        const nested = spec.nested && typeof spec.nested === "object" ? spec.nested : {};
        const ctor = {
          [name]: class extends parent {
            constructor(...args) {
              super(...args);
              for (const field of fields) {
                let value = null;
                if (field.defaultValue && typeof field.defaultValue === "function") {
                  value = field.defaultValue.call(this);
                }
                this[field.name] = value;
              }
              let named = null;
              if (args.length === 1 && args[0] instanceof PairList) {
                named = args[0];
              } else if (args.length === 1 && args[0] && typeof args[0] === "object" && !Array.isArray(args[0])) {
                named = args[0];
              }
              if (named) {
                for (const field of fields) {
                  const incoming = named instanceof PairList ? named.get(field.name, this[field.name]) : Object.prototype.hasOwnProperty.call(named, field.name) ? named[field.name] : this[field.name];
                  if (field.typeName && incoming != null && !zuzuTypeMatches(incoming, field.typeName)) {
                    throw new Error(`TypeException: field '${field.name}' must be ${field.typeName}, got ${zuzuTypeof(incoming)}`);
                  }
                  this[field.name] = incoming;
                }
              }
              for (const [nestedName, nestedClass] of Object.entries(nested)) {
                this[nestedName] = nestedClass;
              }
              if (typeof this.__build__ === "function") {
                this.__build__();
              }
            }
          }
        }[name];
        for (const field of fields) {
          if (Array.isArray(field.accessors)) {
            if (field.accessors.includes("get") && typeof ctor.prototype[`get_${field.name}`] !== "function") {
              ctor.prototype[`get_${field.name}`] = function _get_field() {
                return this[field.name];
              };
            }
            if (field.accessors.includes("set") && typeof ctor.prototype[`set_${field.name}`] !== "function") {
              ctor.prototype[`set_${field.name}`] = function _set_field(value) {
                if (field.typeName && value != null && !zuzuTypeMatches(value, field.typeName)) {
                  throw new Error(`TypeException: field '${field.name}' must be ${field.typeName}, got ${zuzuTypeof(value)}`);
                }
                this[field.name] = value;
                return this;
              };
            }
            if (field.accessors.includes("clear") && typeof ctor.prototype[`clear_${field.name}`] !== "function") {
              ctor.prototype[`clear_${field.name}`] = function _clear_field() {
                this[field.name] = null;
                return this;
              };
            }
            if (field.accessors.includes("has") && typeof ctor.prototype[`has_${field.name}`] !== "function") {
              ctor.prototype[`has_${field.name}`] = function _has_field() {
                return this[field.name] != null ? 1 : 0;
              };
            }
          }
        }
        for (const [methodName, fn] of Object.entries(methods)) {
          ctor.prototype[methodName] = fn;
        }
        for (const [methodName, fn] of Object.entries(statics)) {
          ctor[methodName] = fn;
        }
        for (const [nestedName, nestedClass] of Object.entries(nested)) {
          ctor[nestedName] = nestedClass;
        }
        zuzuApplyTraits(ctor, traits);
        return ctor;
      }
      function zuzuGetMember(object, property) {
        if (object == null) {
          return null;
        }
        const value = object[property];
        if (typeof value === "function" && value.length === 0) {
          return value.call(object);
        }
        return value;
      }
      function zuzuHasOwnLike(object, property) {
        if (object == null) {
          return false;
        }
        if (object instanceof PairList) {
          return !!object.has(property);
        }
        if (Array.isArray(object)) {
          return Object.prototype.hasOwnProperty.call(object, property);
        }
        if (typeof object === "object" || typeof object === "function") {
          return Object.prototype.hasOwnProperty.call(object, property);
        }
        return false;
      }
      function zuzuIsBraceLookupObject(object) {
        if (object == null) {
          return false;
        }
        if (object instanceof PairList) {
          return true;
        }
        if (Array.isArray(object)) {
          return false;
        }
        if (typeof object !== "object") {
          return false;
        }
        const proto = Object.getPrototypeOf(object);
        return proto === null || Object.prototype.toString.call(object) === "[object Object]";
      }
      function zuzuResolveBraceDynamic(getDynamicProperty) {
        if (typeof getDynamicProperty !== "function") {
          return void 0;
        }
        try {
          return getDynamicProperty();
        } catch (err) {
          if (err instanceof ReferenceError || err?.name === "ReferenceError") {
            return void 0;
          }
          throw err;
        }
      }
      function zuzuResolveBraceKey(object, literalProperty, getDynamicProperty) {
        const literal = String(literalProperty || "");
        const dynamicProperty = zuzuResolveBraceDynamic(getDynamicProperty);
        if (dynamicProperty != null && dynamicProperty !== void 0) {
          const dynamic = String(dynamicProperty);
          if (zuzuHasOwnLike(object, dynamic)) {
            return dynamic;
          }
        }
        if (zuzuHasOwnLike(object, literal)) {
          return literal;
        }
        if (zuzuIsBraceLookupObject(object)) {
          if (dynamicProperty != null && dynamicProperty !== void 0) {
            return String(dynamicProperty);
          }
        }
        return literal;
      }
      function zuzuGetBraceMember(object, literalProperty, getDynamicProperty) {
        if (object == null) {
          return null;
        }
        return object[zuzuResolveBraceKey(object, literalProperty, getDynamicProperty)];
      }
      function zuzuCallMember(object, property, ...args) {
        if (object == null) {
          if (args.length === 0) {
            return null;
          }
          throw new TypeError(`Cannot call member ${String(property)} of null`);
        }
        const value = object[property];
        if (typeof value === "function") {
          return value.apply(object, args);
        }
        if (args.length === 0) {
          return value;
        }
        throw new TypeError(`${String(property)} is not a function`);
      }
      function zuzuMaybeDemolish(value) {
        if (value && typeof value.__demolish__ === "function") {
          return value.__demolish__();
        }
        return null;
      }
      function zuzuCan(value, methodName) {
        if (value == null) {
          return 0;
        }
        const key = String(methodName || "");
        return typeof value[key] === "function" ? 1 : 0;
      }
      function zuzuSuperCall(self, klass, methodName, args = []) {
        const method = String(methodName || "");
        const argv = Array.isArray(args) ? args : [];
        if (klass && klass.prototype) {
          const parentProto = Object.getPrototypeOf(klass.prototype);
          if (parentProto && typeof parentProto[method] === "function") {
            return parentProto[method].apply(self, argv);
          }
        }
        if (self && typeof self[`__zuzu_trait_super__${method}`] === "function") {
          return self[`__zuzu_trait_super__${method}`].apply(self, argv);
        }
        return null;
      }
      function zuzuSuperStaticCall(klass, methodName, args = []) {
        const method = String(methodName || "");
        const argv = Array.isArray(args) ? args : [];
        if (!klass) {
          return null;
        }
        const parentClass = Object.getPrototypeOf(klass);
        if (parentClass && typeof parentClass[method] === "function") {
          return parentClass[method].apply(klass, argv);
        }
        return null;
      }
      function zuzuSuperDispatch(isStatic, self, klass, methodName, args = []) {
        return isStatic ? zuzuSuperStaticCall(klass, methodName, args) : zuzuSuperCall(self, klass, methodName, args);
      }
      function refIndex(target, index) {
        return function refValue(maybeValue) {
          if (arguments.length === 0) {
            if (target instanceof ZuzuBinary) {
              return target.at(index);
            }
            return target[index];
          }
          if (target instanceof ZuzuBinary) {
            throw new Error("Exception: BinaryString index assignment is not supported");
          }
          target[index] = maybeValue;
          return maybeValue;
        };
      }
      function zuzuGetIndex(target, index) {
        if (target == null) {
          return null;
        }
        if (target instanceof ZuzuBinary) {
          return target.at(index);
        }
        if (typeof target === "string" || Array.isArray(target)) {
          let resolved = Number(index);
          if (Number.isFinite(resolved)) {
            if (resolved < 0) {
              resolved = target.length + resolved;
            }
            return target[resolved];
          }
        }
        return target[index];
      }
      function refKey(target, key) {
        return function refValue(maybeValue) {
          if (arguments.length === 0) {
            return target[key];
          }
          target[key] = maybeValue;
          return maybeValue;
        };
      }
      function refSlice(target, from, length) {
        return function refSliceValue(maybeValue) {
          const start = Number(from);
          const hasLength = length != null;
          const span = hasLength ? Number(length) : null;
          if (arguments.length === 0) {
            const end = hasLength ? span >= 0 ? start + span : span : void 0;
            if (target instanceof ZuzuBinary) {
              return target.slice(start, end);
            }
            return target.slice(start, end);
          }
          if (target instanceof ZuzuBinary) {
            throw new Error("Exception: BinaryString slice assignment is not supported");
          }
          if (!hasLength) {
            target.splice(start, target.length - start, ...maybeValue);
            return maybeValue;
          }
          target.splice(start, span, ...maybeValue);
          return maybeValue;
        };
      }
      function makePathOperator(runtime, filename) {
        return function zuzuPathOp(haystack, pathSpec, mode = "first") {
          const pathObj = resolvePathObject(runtime, filename, pathSpec);
          if (mode === "all") {
            return pathObj.query(haystack);
          }
          if (mode === "exists") {
            return pathObj.exists(haystack);
          }
          return pathObj.first(haystack, null);
        };
      }
      function resolvePathObject(runtime, filename, pathSpec) {
        const internals = runtime.loadModule("std/internals", filename);
        let PathClass = internals && typeof internals.getupperprop === "function" ? internals.getupperprop(1, "paths") : null;
        const pathText = String(pathSpec ?? "");
        if (!PathClass) {
          if (pathText.startsWith("/")) {
            const zpath = runtime.loadModule("std/path/z", filename);
            PathClass = zpath && zpath.ZPath ? zpath.ZPath : null;
          } else {
            const simple = runtime.loadModule("std/path/simple", filename);
            PathClass = simple && simple.SimplePath ? simple.SimplePath : null;
          }
        }
        if (!PathClass) {
          throw new Error("Exception: no path implementation available");
        }
        return pathSpec && typeof pathSpec === "object" && typeof pathSpec.query === "function" ? pathSpec : new PathClass({ path: pathText });
      }
      function makePathAssignmentOperator(runtime, filename) {
        return function zuzuPathAssign(haystack, pathSpec, value, mode = "first", op = ":=") {
          const pathObj = resolvePathObject(runtime, filename, pathSpec);
          if (mode === "all") {
            return pathObj.assign_all(haystack, value, op);
          }
          if (mode === "maybe") {
            return pathObj.assign_maybe(haystack, value, op);
          }
          return pathObj.assign_first(haystack, value, op);
        };
      }
      function makePathReferenceOperator(runtime, filename) {
        return function zuzuPathRef(haystack, pathSpec, mode = "first") {
          const pathObj = resolvePathObject(runtime, filename, pathSpec);
          if (mode === "all") {
            return pathObj.ref_all(haystack);
          }
          if (mode === "maybe") {
            return pathObj.ref_maybe(haystack);
          }
          return pathObj.ref_first(haystack);
        };
      }
      function callPathRef(refFn) {
        if (typeof refFn !== "function") {
          throw new Error("Exception: path reference target is not assignable");
        }
        return refFn();
      }
      function setPathRef(refFn, value) {
        if (typeof refFn !== "function") {
          throw new Error("Exception: path reference target is not assignable");
        }
        return refFn(value);
      }
      function makePathUpdateOperator(runtime, filename) {
        return function zuzuPathUpdate(haystack, pathSpec, mode, operator, prefix) {
          const pathObj = resolvePathObject(runtime, filename, pathSpec);
          if (mode === "all") {
            const refs = pathObj.ref_all(haystack);
            const oldValues = [];
            const newValues = [];
            for (const refFn2 of refs) {
              const oldValue2 = zuzuToNumber(callPathRef(refFn2));
              const newValue2 = operator === "++" ? oldValue2 + 1 : oldValue2 - 1;
              setPathRef(refFn2, newValue2);
              oldValues.push(oldValue2);
              newValues.push(newValue2);
            }
            return prefix ? newValues : oldValues;
          }
          if (mode === "maybe") {
            const refFn2 = pathObj.ref_maybe(haystack);
            if (refFn2 == null) {
              return false;
            }
            const oldValue2 = zuzuToNumber(callPathRef(refFn2));
            const newValue2 = operator === "++" ? oldValue2 + 1 : oldValue2 - 1;
            setPathRef(refFn2, newValue2);
            return true;
          }
          const refFn = pathObj.ref_first(haystack);
          const oldValue = zuzuToNumber(callPathRef(refFn));
          const newValue = operator === "++" ? oldValue + 1 : oldValue - 1;
          setPathRef(refFn, newValue);
          return prefix ? newValue : oldValue;
        };
      }
      function zuzuTypeMatches(value, typeName) {
        if (typeName === "Any") {
          return 1;
        }
        if (value == null) {
          return 0;
        }
        if (typeName === "Number" || typeName === "String" || typeName === "Array" || typeName === "Dict" || typeName === "Set" || typeName === "Bag" || typeName === "Collection" || typeName === "Class" || typeName === "Function" || typeName === "Object" || typeName === "Exception" || typeName === "Regexp") {
          if (typeName === "Collection") {
            return Array.isArray(value) || isSetLike(value) || isBagLike(value) || isPlainObjectLike(value) ? 1 : 0;
          }
          return zuzuTypeof(value) === typeName ? 1 : 0;
        }
        if (typeName === "BinaryString") {
          return value instanceof ZuzuBinary ? 1 : 0;
        }
        if (typeName === "Boolean") {
          if (typeof value === "boolean" || Object.prototype.toString.call(value) === "[object Boolean]") {
            return 1;
          }
          if (typeof value === "number") {
            return value === 0 || value === 1 ? 1 : 0;
          }
        }
        if (typeName === "Regexp") {
          return Object.prototype.toString.call(value) === "[object RegExp]" ? 1 : 0;
        }
        if (zuzuTypeof(value) === typeName) {
          return 1;
        }
        const globalType = globalThis[typeName];
        if (globalType == null) {
          return 0;
        }
        return zuzuInstanceof(value, globalType) ? 1 : 0;
      }
      var ZuzuScript = class {
        constructor(options = {}) {
          if (options.host) {
            this.host = options.host;
          } else {
            const { createNodeHost } = __require("./host/node-host");
            this.host = createNodeHost(options);
          }
          this.repoRoot = this.host.repoRoot;
          this.includePaths = this.host.includePaths;
          this.denyCapabilities = new Set(Array.isArray(options.denyCapabilities) ? options.denyCapabilities.map((item) => String(item)) : []);
          this.denyModules = new Set(Array.isArray(options.denyModules) ? options.denyModules.map((item) => String(item)) : []);
          this.moduleCache = /* @__PURE__ */ new Map();
          this.outputLines = null;
          this.executionTimeoutMs = Number.isFinite(Number(options.executionTimeoutMs)) ? Number(options.executionTimeoutMs) : null;
          this.transpiler = normalizeTranspilerName(
            options.transpiler || DEFAULT_TRANSPILER
          );
          if (typeof this.host.loadJsModule !== "function") {
            this.host.loadJsModule = (filename) => __require(filename);
          }
        }
        transpile(source, options = {}) {
          return transpile(source, {
            ...options,
            transpiler: options.transpiler || this.transpiler
          });
        }
        getModuleSearchRoots() {
          return [
            this.host.resolve(this.host.cwd()),
            ...this.includePaths,
            this.host.resolve(this.repoRoot, "extras", "zuzu-js", "modules"),
            this.host.resolve(this.repoRoot, "modules")
          ];
        }
        isDeniedByCapability(moduleName) {
          const required = capabilitiesForModule(moduleName);
          for (const capability of required) {
            if (this.denyCapabilities.has(capability)) {
              return capability;
            }
            if (!this.host.capabilities.has(capability)) {
              return capability;
            }
          }
          return null;
        }
        enforceModulePolicy(moduleName) {
          if (this.denyModules.has(moduleName)) {
            throw new Error(`Denied module: ${moduleName}`);
          }
          const capability = this.isDeniedByCapability(moduleName);
          if (capability) {
            if (this.denyCapabilities.has(capability)) {
              throw new Error(`Denied capability '${capability}' blocks module '${moduleName}'`);
            }
            throw new Error(`Module '${moduleName}' requires unsupported capability '${capability}' on host '${this.host.name}'`);
          }
        }
        resolveModulePath(moduleName, fromFile) {
          const fromDir = fromFile ? this.host.dirname(fromFile) : this.repoRoot;
          const candidates = [];
          if (moduleName.startsWith(".") || moduleName.startsWith("/")) {
            candidates.push(this.host.resolve(fromDir, moduleName));
          } else {
            for (const base of this.getModuleSearchRoots()) {
              candidates.push(this.host.resolve(base, moduleName));
            }
          }
          const withExt = [];
          for (const candidate of candidates) {
            withExt.push(candidate, `${candidate}.zzs`, `${candidate}.zzm`, `${candidate}.js`);
          }
          for (const candidate of withExt) {
            if (this.host.fileExists(candidate)) {
              return candidate;
            }
          }
          throw new Error(`Unable to resolve module: ${moduleName}`);
        }
        buildContext(options = {}) {
          const filename = options.filename;
          const runtime = this;
          let context;
          const capabilityFlags = /* @__PURE__ */ Object.create(null);
          for (const name of this.host.capabilities) {
            capabilityFlags[name] = 1;
          }
          const emit = (value) => {
            const line = String(value);
            if (this.outputLines) {
              this.outputLines.push(line);
              return;
            }
            this.host.consoleLog(line);
          };
          installHostCollectionMethods();
          const ZuzuException = class Exception extends Error {
            constructor(value = "") {
              if (value instanceof PairList) {
                super(value.get("message", ""));
                this.name = "Exception";
                return;
              }
              if (value && typeof value === "object" && !Array.isArray(value) && Object.prototype.hasOwnProperty.call(value, "message")) {
                super(value.message);
                this.name = "Exception";
                return;
              }
              super(value);
              this.name = "Exception";
            }
          };
          const ZuzuExhaustedException = class ExhaustedException extends Error {
            constructor(message = "") {
              super(message);
              this.name = "ExhaustedException";
            }
          };
          if (!Number.prototype.contains) {
            Object.defineProperty(Number.prototype, "contains", {
              value(value) {
                return Number(this.valueOf()) === Number(value) ? 1 : 0;
              },
              enumerable: false
            });
          }
          if (!Set.prototype.push) {
            Object.defineProperty(Set.prototype, "length", { value() {
              return this.size;
            }, enumerable: false });
            Object.defineProperty(Set.prototype, "count", { value() {
              return this.size;
            }, enumerable: false });
            Object.defineProperty(Set.prototype, "empty", { value() {
              return this.size === 0 ? 1 : 0;
            }, enumerable: false });
            Object.defineProperty(Set.prototype, "is_empty", { value() {
              return this.empty();
            }, enumerable: false });
            Object.defineProperty(Set.prototype, "push", { value(...values) {
              for (const v of values) {
                this.add(v);
              }
              return this;
            }, enumerable: false });
            Object.defineProperty(Set.prototype, "contains", { value(value) {
              return this.has(value) ? 1 : 0;
            }, enumerable: false });
            Object.defineProperty(Set.prototype, "remove", { value(value) {
              this.delete(value);
              return this;
            }, enumerable: false });
            Object.defineProperty(Set.prototype, "to_Array", { value() {
              return [...this];
            }, enumerable: false });
            Object.defineProperty(Set.prototype, "to_Bag", { value() {
              return new ZuzuBag([...this]);
            }, enumerable: false });
            Object.defineProperty(Set.prototype, "union", { value(other) {
              return collectionUnion(this, other);
            }, enumerable: false });
            Object.defineProperty(Set.prototype, "intersection", { value(other) {
              return collectionIntersection(this, other);
            }, enumerable: false });
            Object.defineProperty(Set.prototype, "difference", { value(other) {
              return collectionDifference(this, other);
            }, enumerable: false });
            Object.defineProperty(Set.prototype, "symmetric_difference", { value(other) {
              return collectionDifference(this.union(other), this.intersection(other));
            }, enumerable: false });
            Object.defineProperty(Set.prototype, "is_subset", { value(other) {
              return collectionSubsetOf(this, other);
            }, enumerable: false });
            Object.defineProperty(Set.prototype, "is_superset", { value(other) {
              return collectionSupersetOf(this, other);
            }, enumerable: false });
            Object.defineProperty(Set.prototype, "is_disjoint", { value(other) {
              return this.intersection(other).size === 0 ? 1 : 0;
            }, enumerable: false });
            Object.defineProperty(Set.prototype, "equals", { value(other) {
              return collectionEquivalentOf(this, other);
            }, enumerable: false });
            Object.defineProperty(Set.prototype, "sort", { value(fn) {
              return [...this].sort(fn);
            }, enumerable: false });
            Object.defineProperty(Set.prototype, "sortstr", { value() {
              return [...this].sort((a, b) => String(a).localeCompare(String(b)));
            }, enumerable: false });
            Object.defineProperty(Set.prototype, "sortnum", { value() {
              return [...this].map((item) => Number(item)).sort((a, b) => a - b);
            }, enumerable: false });
            Object.defineProperty(Set.prototype, "map", { value(fn) {
              return new Set([...this].map(fn));
            }, enumerable: false });
            Object.defineProperty(Set.prototype, "grep", { value(fn) {
              return new Set([...this].filter(fn));
            }, enumerable: false });
            Object.defineProperty(Set.prototype, "any", { value(fn) {
              return [...this].some(fn) ? 1 : 0;
            }, enumerable: false });
            Object.defineProperty(Set.prototype, "all", { value(fn) {
              return [...this].every(fn) ? 1 : 0;
            }, enumerable: false });
            Object.defineProperty(Set.prototype, "first", { value(fn) {
              for (const v of this) {
                if (fn(v)) {
                  return v;
                }
              }
              return null;
            }, enumerable: false });
            Object.defineProperty(Set.prototype, "remove_if", { value(fn) {
              for (const v of [...this]) {
                if (fn(v)) {
                  this.delete(v);
                }
              }
              return this;
            }, enumerable: false });
            Object.defineProperty(Set.prototype, "for_each_value", { value(fn) {
              for (const v of this) {
                fn(v);
              }
              return this;
            }, enumerable: false });
          }
          const fallbackDoneTesting = function done_testing(n = null) {
            if (typeof globalThis._LEVEL === "number" && globalThis._LEVEL > 0) {
              throw new Error("Unexpected done_testing() in subtest");
            }
            let seen = 0;
            if (Array.isArray(runtime.outputLines)) {
              for (const line of runtime.outputLines) {
                if (/^ok\b/.test(line) || /^not ok\b/.test(line)) {
                  seen++;
                }
              }
            }
            if (n != null && Number(n) !== Number(seen)) {
              throw new Error(`Expected ${n} tests, but ran ${seen}`);
            }
            emit(`1..${seen}`);
            if (typeof globalThis._FAILED === "number" && globalThis._FAILED > 0) {
              throw new Error(`Failed ${globalThis._FAILED} tests`);
            }
            return true;
          };
          const systemGlobal = Object.freeze({
            language_version: 0,
            runtime: "zuzu-js",
            runtime_version: "dev",
            platform: this.host.name,
            deny_fs: capabilityFlags.fs ? 0 : 1,
            deny_net: capabilityFlags.net ? 0 : 1,
            deny_perl: 1,
            deny_proc: capabilityFlags.proc ? 0 : 1,
            deny_db: capabilityFlags.db ? 0 : 1
          });
          context = {
            ...options.globals || {},
            __system__: systemGlobal,
            __zuzu_host_capabilities: capabilityFlags,
            has_capability(name) {
              const key = String(name);
              return capabilityFlags[key] ? 1 : 0;
            },
            outputLines: this.outputLines,
            done_testing: options.globals && typeof options.globals.done_testing === "function" ? options.globals.done_testing : fallbackDoneTesting,
            exports: options.exports,
            module: options.module,
            console: { log: (value) => this.host.consoleLog(value) },
            Bag: ZuzuBag,
            PairList,
            Exception: ZuzuException,
            ExhaustedException: ZuzuExhaustedException,
            Null: null,
            Any: function Any() {
            },
            Collection: function Collection() {
            },
            Class: function Class() {
            },
            BinaryString,
            say(value, ...parts) {
              if (Array.isArray(value) && Object.prototype.hasOwnProperty.call(value, "raw")) {
                let out = "";
                for (let i = 0; i < value.length; i++) {
                  out += value[i];
                  if (i < parts.length) {
                    out += String(parts[i]);
                  }
                }
                emit(out);
                return;
              }
              emit(value);
            },
            __zuzu_switch: runSwitch,
            __zuzu_match: runMatch,
            __zuzu_contains: contains,
            __zuzu_union: collectionUnion,
            __zuzu_intersection: collectionIntersection,
            __zuzu_difference: collectionDifference,
            __zuzu_subsetof: collectionSubsetOf,
            __zuzu_supersetof: collectionSupersetOf,
            __zuzu_equivalentof: collectionEquivalentOf,
            __zuzu_set: makeSet,
            __zuzu_bag: makeBag,
            __zuzu_pairlist_literal: makePairList,
            __zuzu_path_op: makePathOperator(runtime, filename),
            __zuzu_path_assign: makePathAssignmentOperator(runtime, filename),
            __zuzu_path_ref: makePathReferenceOperator(runtime, filename),
            __zuzu_path_update: makePathUpdateOperator(runtime, filename),
            __zuzu_call_member: zuzuCallMember,
            __zuzu_prepare_eval(source, namedArgs = null) {
              if (typeof source !== "string") {
                throw new Error(
                  `TypeException: eval expects String, got ${zuzuTypeof(source)}`
                );
              }
              if (namedArgs != null && !(namedArgs instanceof PairList)) {
                throw new Error(
                  `TypeException: eval named arguments must be PairList, got ${zuzuTypeof(namedArgs)}`
                );
              }
              return runtime.transpile(source);
            },
            __zuzu_iter(value) {
              const asIterable = (input) => {
                const hasMethodHere = (candidate, name) => {
                  if (candidate == null) {
                    return false;
                  }
                  if (Object.prototype.hasOwnProperty.call(candidate, name)) {
                    return true;
                  }
                  const proto = Object.getPrototypeOf(candidate);
                  if (!proto) {
                    return false;
                  }
                  return Object.prototype.hasOwnProperty.call(proto, name);
                };
                if (input == null) {
                  return [];
                }
                if (typeof input[Symbol.iterator] === "function") {
                  return input;
                }
                if (typeof input === "function") {
                  return {
                    *[Symbol.iterator]() {
                      while (true) {
                        try {
                          yield input();
                        } catch (err) {
                          if (isExhaustedIteratorError(err)) {
                            return;
                          }
                          throw err;
                        }
                      }
                    }
                  };
                }
                if (input && typeof input.to_Iterator === "function" && hasMethodHere(input, "to_Iterator")) {
                  const iterator = input.to_Iterator();
                  if (typeof iterator === "function" && input && typeof input === "object") {
                    return asIterable(iterator.bind(input));
                  }
                  return asIterable(iterator);
                }
                if (input && typeof input.to_Array === "function" && hasMethodHere(input, "to_Array")) {
                  return asIterable(input.to_Array());
                }
                if (isPlainObjectLike(input) && typeof input.to_Iterator === "function") {
                  return asIterable(input.to_Iterator());
                }
                if (isPlainObjectLike(input) && typeof input.to_Array === "function") {
                  return asIterable(input.to_Array());
                }
                if (input && typeof input === "object") {
                  return Object.keys(input).sort();
                }
                return [];
              };
              return asIterable(value);
            },
            __zuzu_length: lengthOf,
            __zuzu_num(value) {
              return zuzuToNumber(value);
            },
            __zuzu_truthy(value) {
              return zuzuTruthy(value);
            },
            __zuzu_not(value) {
              return zuzuTruthy(value) ? 0 : 1;
            },
            __zuzu_and(left, right) {
              return zuzuTruthy(left) && zuzuTruthy(right) ? 1 : 0;
            },
            __zuzu_or(left, right) {
              return zuzuTruthy(left) || zuzuTruthy(right) ? 1 : 0;
            },
            __zuzu_typeof(value) {
              return zuzuTypeof(value);
            },
            __zuzu_instanceof(value, klass) {
              return zuzuInstanceof(value, klass);
            },
            __zuzu_trait(name, methods) {
              return zuzuTrait(name, methods);
            },
            __zuzu_apply_traits(klass, traits) {
              return zuzuApplyTraits(klass, traits);
            },
            __zuzu_does(value, trait) {
              return zuzuDoes(value, trait);
            },
            __zuzu_can(value, methodName) {
              return zuzuCan(value, methodName);
            },
            __zuzu_super_call(self, klass, methodName, args) {
              return zuzuSuperCall(self, klass, methodName, args);
            },
            __zuzu_super_static_call(klass, methodName, args) {
              return zuzuSuperStaticCall(klass, methodName, args);
            },
            __zuzu_super_dispatch(isStatic, self, klass, methodName, args) {
              return zuzuSuperDispatch(isStatic, self, klass, methodName, args);
            },
            __zuzu_type_matches(value, typeName) {
              return zuzuTypeMatches(value, typeName);
            },
            __zuzu_require_type(argName, typeName, value) {
              if (!zuzuTypeMatches(value, typeName)) {
                throw new Error(`TypeException: argument '${argName}' must be ${typeName}, got ${zuzuTypeof(value)}`);
              }
              return value;
            },
            __zuzu_checked_return(fnName, typeName, value) {
              if (typeName !== "Any" && !zuzuTypeMatches(value, typeName)) {
                throw new Error(`TypeException: 'return value of '${fnName}'' must be ${typeName}, got ${zuzuTypeof(value)}`);
              }
              return value;
            },
            __zuzu_die(value) {
              if (typeof value === "string") {
                throw new ZuzuException(value);
              }
              throw value;
            },
            __zuzu_add(left, right) {
              return zuzuToNumber(left) + zuzuToNumber(right);
            },
            __zuzu_concat(left, right) {
              return concatValue(left, right);
            },
            __zuzu_binary_literal(value) {
              return binaryFromLiteral(value);
            },
            to_binary(value) {
              return toBinaryValue(value);
            },
            to_string(value) {
              return toStringValue(value);
            },
            is_ascii(value) {
              if (!(value instanceof ZuzuBinary)) {
                throw new Error(`TypeException: expected BinaryString for is_ascii, got ${zuzuTypeof(value)}`);
              }
              return value.isAscii();
            },
            __zuzu_bit_and(left, right) {
              return bitwiseAnd(left, right);
            },
            __zuzu_bit_or(left, right) {
              return bitwiseOr(left, right);
            },
            __zuzu_bit_xor(left, right) {
              return bitwiseXor(left, right);
            },
            __zuzu_bit_not(value) {
              return bitwiseNot(value);
            },
            __zuzu_sub(left, right) {
              return zuzuToNumber(left) - zuzuToNumber(right);
            },
            __zuzu_mul(left, right) {
              return zuzuToNumber(left) * zuzuToNumber(right);
            },
            __zuzu_div(left, right) {
              return zuzuToNumber(left) / zuzuToNumber(right);
            },
            __zuzu_mod(left, right) {
              return zuzuToNumber(left) % zuzuToNumber(right);
            },
            __zuzu_pow(left, right) {
              return zuzuToNumber(left) ** zuzuToNumber(right);
            },
            __zuzu_cmp(left, right) {
              const l = Number(left ?? 0);
              const r = Number(right ?? 0);
              return l < r ? -1 : l > r ? 1 : 0;
            },
            __zuzu_eq(left, right) {
              if (arguments.length < 2) {
                return 0;
              }
              return zuzuEqual(left, right);
            },
            __zuzu_ne(left, right) {
              if (arguments.length < 2) {
                return 0;
              }
              return zuzuEqual(left, right) ? 0 : 1;
            },
            __zuzu_str_eq(left, right) {
              return stringCompare(left, right) === 0 ? 1 : 0;
            },
            __zuzu_str_ne(left, right) {
              return stringCompare(left, right) !== 0 ? 1 : 0;
            },
            __zuzu_str_gt(left, right) {
              return stringCompare(left, right) > 0 ? 1 : 0;
            },
            __zuzu_str_ge(left, right) {
              return stringCompare(left, right) >= 0 ? 1 : 0;
            },
            __zuzu_str_lt(left, right) {
              return stringCompare(left, right) < 0 ? 1 : 0;
            },
            __zuzu_str_le(left, right) {
              return stringCompare(left, right) <= 0 ? 1 : 0;
            },
            __zuzu_str_cmp(left, right) {
              return stringCompare(left, right);
            },
            __zuzu_str_eqi(left, right) {
              return stringCompare(left, right, { insensitive: true }) === 0 ? 1 : 0;
            },
            __zuzu_str_nei(left, right) {
              return stringCompare(left, right, { insensitive: true }) !== 0 ? 1 : 0;
            },
            __zuzu_str_gti(left, right) {
              return stringCompare(left, right, { insensitive: true }) > 0 ? 1 : 0;
            },
            __zuzu_str_gei(left, right) {
              return stringCompare(left, right, { insensitive: true }) >= 0 ? 1 : 0;
            },
            __zuzu_str_lti(left, right) {
              return stringCompare(left, right, { insensitive: true }) < 0 ? 1 : 0;
            },
            __zuzu_str_lei(left, right) {
              return stringCompare(left, right, { insensitive: true }) <= 0 ? 1 : 0;
            },
            __zuzu_str_cmpi(left, right) {
              return stringCompare(left, right, { insensitive: true });
            },
            __zuzu_warn(...parts) {
              console.warn(parts.map((part) => zuzuStringify(part)).join(""));
            },
            __zuzu_debug() {
              return null;
            },
            __zuzu_assert(condition) {
              if (!condition) {
                throw new Error("assertion failed");
              }
              return condition;
            },
            __zuzu_make_class(name, base) {
              const parent = typeof base === "function" ? base : Object;
              return {
                [name]: class extends parent {
                  constructor(...args) {
                    if (args.length === 1 && args[0] && typeof args[0] === "object" && !Array.isArray(args[0]) && Object.prototype.hasOwnProperty.call(args[0], "message")) {
                      super(args[0].message);
                      return;
                    }
                    super(...args);
                  }
                }
              }[name];
            },
            __zuzu_define_class(name, base, spec) {
              return defineZuzuClass(name, base, spec);
            },
            __zuzu_get_member(object, property) {
              return zuzuGetMember(object, property);
            },
            __zuzu_get_index(object, index) {
              return zuzuGetIndex(object, index);
            },
            __zuzu_get_brace_member(object, literalProperty, getDynamicProperty) {
              return zuzuGetBraceMember(object, literalProperty, getDynamicProperty);
            },
            __zuzu_resolve_brace_key(object, literalProperty, getDynamicProperty) {
              return zuzuResolveBraceKey(object, literalProperty, getDynamicProperty);
            },
            __zuzu_maybe_demolish(value) {
              return zuzuMaybeDemolish(value);
            },
            __zuzu_xor(left, right) {
              return zuzuTruthy(left) !== zuzuTruthy(right) ? 1 : 0;
            },
            __zuzu_nand(left, right) {
              return zuzuTruthy(left) && zuzuTruthy(right) ? 0 : 1;
            },
            __zuzu_num_eq(left, right) {
              if (!isNumericComparable(left) || !isNumericComparable(right)) {
                return zuzuEqual(left, right);
              }
              return numericEqual(left, right) ? 1 : 0;
            },
            __zuzu_num_ne(left, right) {
              if (!isNumericComparable(left) || !isNumericComparable(right)) {
                return zuzuEqual(left, right) ? 0 : 1;
              }
              return numericEqual(left, right) ? 0 : 1;
            },
            __zuzu_num_lt(left, right) {
              return zuzuToNumber(left) < zuzuToNumber(right) ? 1 : 0;
            },
            __zuzu_num_lte(left, right) {
              return zuzuToNumber(left) <= zuzuToNumber(right) ? 1 : 0;
            },
            __zuzu_num_gt(left, right) {
              return zuzuToNumber(left) > zuzuToNumber(right) ? 1 : 0;
            },
            __zuzu_num_gte(left, right) {
              return zuzuToNumber(left) >= zuzuToNumber(right) ? 1 : 0;
            },
            __zuzu_abs(value) {
              return Math.abs(Number(value ?? 0));
            },
            __zuzu_sqrt(value) {
              return Math.sqrt(Number(value ?? 0));
            },
            __zuzu_floor(value) {
              return Math.floor(Number(value ?? 0));
            },
            __zuzu_ceil(value) {
              return Math.ceil(Number(value ?? 0));
            },
            __zuzu_round(value) {
              const n = Number(value ?? 0);
              return n >= 0 ? Math.floor(n + 0.5) : Math.ceil(n - 0.5);
            },
            __zuzu_int(value) {
              const n = Number(value ?? 0);
              return n < 0 ? Math.ceil(n) : Math.floor(n);
            },
            __zuzu_uc(value) {
              if (value instanceof ZuzuBinary) {
                throw new Error("TypeException: uc expects String, got BinaryString");
              }
              return zuzuStringify(value).toUpperCase();
            },
            __zuzu_lc(value) {
              if (value instanceof ZuzuBinary) {
                throw new Error("TypeException: lc expects String, got BinaryString");
              }
              return zuzuStringify(value).toLowerCase();
            },
            __zuzu_range(start, end) {
              const from = Number(start ?? 0);
              const to = Number(end ?? 0);
              const out = [];
              const step = from <= to ? 1 : -1;
              for (let n = from; step > 0 ? n <= to : n >= to; n += step) {
                out.push(n);
              }
              return out;
            },
            __zuzu_ref_index(target, index) {
              return refIndex(target, index);
            },
            __zuzu_ref_key(target, key) {
              return refKey(target, key);
            },
            __zuzu_ref_slice(target, from, length) {
              return refSlice(target, from, length);
            },
            Pair
          };
          context.__zuzu_import = (name) => {
            if (name === "std/eval") {
              return { eval: context.__zuzu_native_eval };
            }
            return this.loadModule(name, filename);
          };
          return context;
        }
        installCollectionMethods(context) {
          const bootstrap = `
			(function () {
				globalThis.__zuzu_native_eval = eval;
				globalThis.Dict = Object;
				const define = ( proto, name, fn ) => {
					if ( !Object.prototype.hasOwnProperty.call( proto, name ) ) {
						const desc = Object.create( null );
						desc.value = fn;
						desc.enumerable = false;
						desc.configurable = true;
						desc.writable = true;
						Object.defineProperty( proto, name, desc );
					}
				};
				define( Array.prototype, 'length', function _length() { return this.length; } );
				define( Array.prototype, 'count', function _count() { return this.length; } );
				define( Array.prototype, 'empty', function _empty() { return this.length === 0 ? 1 : 0; } );
				define( Array.prototype, 'is_empty', function _is_empty() { return this.empty(); } );
				define( Array.prototype, 'append', function _append( ...values ) { this.push( ...values ); return this; } );
				define( Array.prototype, 'add', function _add( ...values ) { this.push( ...values ); return this; } );
				define( Array.prototype, 'prepend', function _prepend( ...values ) { this.unshift( ...values ); return this; } );
				define( Array.prototype, 'get', function _get( idx, fallback = null ) { return idx >= 0 && idx < this.length ? this[idx] : fallback; } );
				define( Array.prototype, 'set', function _set( idx, value ) { this[idx] = value; return this; } );
				define( Array.prototype, 'grep', function _grep( fn ) { return this.filter( fn ); } );
				define( Array.prototype, 'any', function _any( fn ) { return this.some( fn ) ? 1 : 0; } );
				define( Array.prototype, 'all', function _all( fn ) { return this.every( fn ) ? 1 : 0; } );
				define( Array.prototype, 'first', function _first( fn ) { return this.find( fn ) ?? null; } );
				define( Array.prototype, 'remove', function _remove( fn ) { for ( let i = this.length - 1; i >= 0; i-- ) { if ( fn( this[i] ) ) { this.splice( i, 1 ); } } return this; } );
				define( Array.prototype, 'contains', function _contains( value ) { return this.includes( value ) ? 1 : 0; } );
				define( Array.prototype, 'first_index', function _first_index( fn ) { return this.findIndex( fn ); } );
				define( Array.prototype, 'reductions', function _reductions( fn ) { const out = []; for ( const item of this ) { out.push( out.length === 0 ? item : fn( out[out.length - 1], item ) ); } return out; } );
				define( Array.prototype, 'head', function _head( n ) { return this.slice( 0, n ); } );
				define( Array.prototype, 'tail', function _tail( n ) { return this.slice( n - 1 ); } );
				define( Array.prototype, 'sum', function _sum() { return this.reduce( (a, b) => Number( a ) + Number( b ), 0 ); } );
				define( Array.prototype, 'product', function _product() { return this.reduce( (a, b) => Number( a ) * Number( b ), 1 ); } );
				define( Array.prototype, 'shuffle', function _shuffle() { return this.slice(); } );
				define( Array.prototype, 'sample', function _sample( n ) { return this.slice( 0, n ); } );
				define( Array.prototype, 'for_each_value', function _for_each_value( fn ) { this.forEach( fn ); return this; } );
				define( Array.prototype, 'sortstr', function _sortstr() { return this.slice().sort( (a, b) => String( a ).localeCompare( String( b ) ) ); } );
				define( Array.prototype, 'sortnum', function _sortnum() { return this.map( (item) => Number( item ) ).sort( (a, b) => a - b ); } );
				define( Array.prototype, 'to_Array', function _to_array() { return this.slice(); } );
				define( Array.prototype, 'to_Set', function _to_set() { return new Set( this ); } );
				define( Array.prototype, 'to_Bag', function _to_bag() { return new Bag( this ); } );
				define( Array.prototype, 'to_Iterator', function _to_iterator() { return this[Symbol.iterator](); } );
				define( Array.prototype, 'clear', function _clear() { this.splice( 0, this.length ); return this; } );

				define( Set.prototype, 'length', function _length() { return this.size; } );
				define( Set.prototype, 'count', function _count() { return this.size; } );
				define( Set.prototype, 'empty', function _empty() { return this.size === 0 ? 1 : 0; } );
				define( Set.prototype, 'is_empty', function _is_empty() { return this.empty(); } );
				define( Set.prototype, 'push', function _push( ...values ) { for ( const v of values ) { this.add( v ); } return this; } );
				define( Set.prototype, 'contains', function _contains( value ) { return this.has( value ) ? 1 : 0; } );
				define( Set.prototype, 'remove', function _remove( value ) { this.delete( value ); return this; } );
				define( Set.prototype, 'to_Array', function _to_array() { return [ ...this ]; } );
				define( Set.prototype, 'to_Bag', function _to_bag() { return new Bag( [ ...this ] ); } );
				define( Set.prototype, 'to_Iterator', function _to_iterator() { return this.values(); } );
				define( Set.prototype, 'union', function _union( other ) { return __zuzu_union( this, other ); } );
				define( Set.prototype, 'intersection', function _intersection( other ) { return __zuzu_intersection( this, other ); } );
				define( Set.prototype, 'difference', function _difference( other ) { return __zuzu_difference( this, other ); } );
				define( Set.prototype, 'symmetric_difference', function _symmetric_difference( other ) { return __zuzu_difference( this.union( other ), this.intersection( other ) ); } );
				define( Set.prototype, 'is_subset', function _is_subset( other ) { return __zuzu_subsetof( this, other ); } );
				define( Set.prototype, 'is_superset', function _is_superset( other ) { return __zuzu_supersetof( this, other ); } );
				define( Set.prototype, 'is_disjoint', function _is_disjoint( other ) { return this.intersection( other ).size === 0 ? 1 : 0; } );
				define( Set.prototype, 'equals', function _equals( other ) { return __zuzu_equivalentof( this, other ); } );
				define( Set.prototype, 'sort', function _sort( fn ) { return [ ...this ].sort( fn ); } );
				define( Set.prototype, 'sortstr', function _sortstr() { return [ ...this ].sort( (a, b) => String( a ).localeCompare( String( b ) ) ); } );
				define( Set.prototype, 'sortnum', function _sortnum() { return [ ...this ].map( (item) => Number( item ) ).sort( (a, b) => a - b ); } );
				define( Set.prototype, 'map', function _map( fn ) { return new Set( [ ...this ].map( fn ) ); } );
				define( Set.prototype, 'grep', function _grep( fn ) { return new Set( [ ...this ].filter( fn ) ); } );
				define( Set.prototype, 'any', function _any( fn ) { return [ ...this ].some( fn ) ? 1 : 0; } );
				define( Set.prototype, 'all', function _all( fn ) { return [ ...this ].every( fn ) ? 1 : 0; } );
				define( Set.prototype, 'first', function _first( fn ) { for ( const v of this ) { if ( fn( v ) ) { return v; } } return null; } );
				define( Set.prototype, 'remove_if', function _remove_if( fn ) { for ( const v of [ ...this ] ) { if ( fn( v ) ) { this.delete( v ); } } return this; } );
				define( Set.prototype, 'for_each_value', function _for_each_value( fn ) { for ( const v of this ) { fn( v ); } return this; } );
				const clearSet = Set.prototype.clear;
				define( Set.prototype, 'clear', function _clear() { clearSet.call( this ); return this; } );
				define( RegExp.prototype, 'to_String', function _to_string() { return this.source; } );
				if ( !Object.prototype.hasOwnProperty.call( RegExp.prototype, Symbol.toPrimitive ) ) {
					const regDesc = Object.create( null );
					regDesc.value = function _regexp_to_primitive( hint ) {
						if ( hint === 'string' || hint === 'default' ) {
							return this.to_String();
						}
						return NaN;
					};
					regDesc.enumerable = false;
					regDesc.configurable = true;
					regDesc.writable = true;
					Object.defineProperty( RegExp.prototype, Symbol.toPrimitive, regDesc );
				}

				const isPlain = (obj) => obj && typeof obj === 'object' && !Array.isArray( obj ) && !( obj instanceof Set ) && !( obj instanceof Bag );
				const normalizeKey = (key) => {
					if ( key == null ) {
						return '';
					}
					if ( typeof key === 'string' ) {
						return key;
					}
					if ( key instanceof BinaryString ) {
						return key.to_String();
					}
					if ( key && typeof key.to_String === 'function' ) {
						return String( key.to_String() );
					}
					return String( key );
				};
				define( Object.prototype, 'length', function _length() { return isPlain( this ) ? Object.keys( this ).length : 0; } );
				define( Object.prototype, 'keys', function _keys() {
					return isPlain( this ) ? Object.keys( this ).sort() : [];
				} );
				define( Object.prototype, 'values', function _values() {
					if ( !isPlain( this ) ) {
						return [];
					}
					return this.keys().map( (key) => this[key] );
				} );
				define( Object.prototype, 'enumerate', function _enumerate() {
					if ( !isPlain( this ) ) {
						return [];
					}
					return this.keys().map(
						(key) => new Pair( { pair: [ key, this[key] ] } )
					);
				} );
				define( Object.prototype, 'has', function _has( key ) { return isPlain( this ) && Object.prototype.hasOwnProperty.call( this, normalizeKey( key ) ) ? 1 : 0; } );
				define( Object.prototype, 'contains', function _contains( key ) { return this.has( key ); } );
				define( Object.prototype, 'exists', function _exists( key ) { return this.has( key ); } );
				define( Object.prototype, 'defined', function _defined( key ) { const normalized = normalizeKey( key ); return isPlain( this ) && this[normalized] != null ? 1 : 0; } );
				define( Object.prototype, 'get', function _get( key, fallback = null ) { const normalized = normalizeKey( key ); return this.has( normalized ) ? this[normalized] : fallback; } );
				define( Object.prototype, 'add', function _add( key, value ) { if ( !isPlain( this ) ) { return this; } if ( key instanceof Pair ) { return this; } this[normalizeKey( key )] = value; return this; } );
				define( Object.prototype, 'set', function _set( key, value ) { return this.add( key, value ); } );
				define( Object.prototype, 'kv', function _kv() {
					if ( !isPlain( this ) ) {
						return [];
					}
					const out = [];
					for ( const key of this.keys() ) {
						out.push( key, this[key] );
					}
					return out;
				} );
				define( Object.prototype, 'sorted_keys', function _sorted_keys() {
					return this.keys();
				} );
				define( Object.prototype, 'remove', function _remove( key ) { if ( !isPlain( this ) ) { return this; } if ( typeof key === 'function' ) { for ( const [ k, v ] of Object.entries( this ) ) { if ( key( new Pair( { pair: [ k, v ] } ) ) ) { delete this[k]; } } return this; } if ( key instanceof Pair ) { return this; } delete this[normalizeKey( key )]; return this; } );
				define( Object.prototype, 'count', function _count() { return this.length(); } );
				define( Object.prototype, 'empty', function _empty() { return this.length() === 0 ? 1 : 0; } );
				define( Object.prototype, 'to_Array', function _to_array() { return this.enumerate(); } );
				define( Object.prototype, 'to_Iterator', function _to_iterator() {
					return this.keys().sort()[Symbol.iterator]();
				} );
				define( Object.prototype, 'for_each_key', function _for_each_key( fn ) {
					for ( const key of this.keys() ) {
						fn( key );
					}
					return this;
				} );
				define( Object.prototype, 'for_each_value', function _for_each_value( fn ) {
					for ( const value of this.values() ) {
						fn( value );
					}
					return this;
				} );
				define( Object.prototype, 'for_each_pair', function _for_each_pair( fn ) {
					for ( const pair of this.enumerate() ) {
						fn( pair );
					}
					return this;
				} );
				define( Object.prototype, 'clear', function _clear() { for ( const k of Object.keys( this ) ) { delete this[k]; } return this; } );
				if ( !Object.prototype.hasOwnProperty.call( Object.prototype, Symbol.toPrimitive ) ) {
					const desc = Object.create( null );
					desc.value = function _to_primitive( hint ) {
						if ( ( hint === 'string' || hint === 'default' ) && typeof this.to_String === 'function' ) {
							return this.to_String();
						}
						return Object.prototype.toString.call( this );
					};
					desc.enumerable = false;
					desc.configurable = true;
					desc.writable = true;
					Object.defineProperty( Object.prototype, Symbol.toPrimitive, desc );
				}
			})();
		`;
          const bootstrapRunOptions = {};
          if (this.executionTimeoutMs != null) {
            bootstrapRunOptions.timeout = this.executionTimeoutMs;
          }
          this.host.runInContext(bootstrap, context, bootstrapRunOptions);
        }
        loadModule(moduleName, fromFile) {
          if (/(^|\/)\.\.(\/|$)/.test(moduleName)) {
            throw new Error("Import module path cannot contain '..' segments");
          }
          this.enforceModulePolicy(moduleName);
          const resolved = this.resolveModulePath(moduleName, fromFile);
          if (moduleName !== "test/more" && this.moduleCache.has(resolved)) {
            return this.moduleCache.get(resolved);
          }
          if (resolved.endsWith(".js")) {
            const loaded = this.host.loadJsModule(resolved, moduleName, fromFile);
            this.moduleCache.set(resolved, loaded);
            return loaded;
          }
          const source = this.host.readFileText(resolved);
          let js = this.transpile(source);
          setCompiledSource(resolved, js);
          const exportNames = resolved.endsWith(".zzm") ? collectTopLevelDeclarations(source, stripPod) : [];
          if (exportNames.length > 0) {
            const exportBridge = exportNames.map((name) => {
              if (name.startsWith("_")) {
                return `if ( typeof ${name} !== "undefined" ) { const __zuzu_desc = Object.create( null ); __zuzu_desc.value = ${name}; __zuzu_desc.enumerable = false; __zuzu_desc.writable = true; __zuzu_desc.configurable = true; Object.defineProperty( module.exports, ${JSON.stringify(name)}, __zuzu_desc ); }`;
              }
              return `if ( typeof ${name} !== "undefined" ) { module.exports[${JSON.stringify(name)}] = ${name}; }`;
            }).join("\n");
            js += `
${exportBridge}
`;
          }
          const moduleObj = { exports: {} };
          const context = this.buildContext({
            exports: moduleObj.exports,
            module: moduleObj,
            filename: resolved
          });
          if (moduleName === "std/getopt") {
            Object.assign(context, this.loadModule("std/string", resolved));
          }
          context.__global__ = /* @__PURE__ */ Object.create(null);
          this.installCollectionMethods(context);
          const moduleRunOptions = { filename: resolved };
          if (this.executionTimeoutMs != null) {
            moduleRunOptions.timeout = this.executionTimeoutMs;
          }
          this.host.runInContext(js, context, moduleRunOptions);
          if (moduleName !== "test/more") {
            this.moduleCache.set(resolved, moduleObj.exports);
          }
          return moduleObj.exports;
        }
        runSource(source, options = {}) {
          const filename = options.filename || this.host.join(this.repoRoot, "<inline>.zzs");
          let js;
          try {
            js = this.transpile(source);
          } catch (err) {
            return {
              status: 3,
              stdout: "",
              stderr: formatRuntimeError(err)
            };
          }
          return this.runCompiled(js, options);
        }
        runCompiled(js, options = {}) {
          const filename = options.filename || this.host.join(this.repoRoot, "<inline>.zzs");
          setCompiledSource(filename, js);
          const preloadGlobals = /* @__PURE__ */ Object.create(null);
          if (Array.isArray(options.preloadModules)) {
            for (const moduleName of options.preloadModules) {
              Object.assign(preloadGlobals, this.loadModule(moduleName, filename));
            }
          }
          this.outputLines = [];
          const context = this.buildContext({
            filename,
            globals: preloadGlobals
          });
          context.__global__ = /* @__PURE__ */ Object.create(null);
          this.installCollectionMethods(context);
          try {
            const scriptRunOptions = { filename };
            if (this.executionTimeoutMs != null) {
              scriptRunOptions.timeout = this.executionTimeoutMs;
            }
            this.host.runInContext(js, context, scriptRunOptions);
            if (typeof context.__main__ === "function") {
              const argv = Array.isArray(options.scriptArgs) ? options.scriptArgs.map((value) => String(value)) : [];
              context.__main__(argv);
            }
            let topLevelTests = 0;
            let hasTopLevelPlan = false;
            for (const line of this.outputLines) {
              if (/^\d+\.\.\d+\s*$/.test(line)) {
                hasTopLevelPlan = true;
              }
              if (/^ok\b/.test(line) || /^not ok\b/.test(line)) {
                topLevelTests++;
              }
            }
            if (topLevelTests > 0 && !hasTopLevelPlan) {
              const stdout2 = this.outputLines.length > 0 ? `${this.outputLines.join("\n")}
` : "";
              return {
                status: 1,
                stdout: stdout2,
                stderr: "Error: TAP plan missing (expected 1..N)\n"
              };
            }
            const stdout = this.outputLines.length > 0 ? `${this.outputLines.join("\n")}
` : "";
            return {
              status: 0,
              stdout,
              stderr: ""
            };
          } catch (err) {
            const stdout = this.outputLines.length > 0 ? `${this.outputLines.join("\n")}
` : "";
            const isParse = err && err.name === "SyntaxError";
            return {
              status: isParse ? 3 : 1,
              stdout,
              stderr: formatRuntimeError(err)
            };
          } finally {
            this.outputLines = null;
          }
        }
        runFile(scriptPath) {
          const source = this.host.readFileText(scriptPath);
          return this.runSource(source, {
            filename: scriptPath,
            scriptArgs: []
          });
        }
      };
      module.exports = {
        ZuzuScript
      };
    }
  });

  // extras/zuzu-js/lib/browser-runtime.js
  var require_browser_runtime = __commonJS({
    "extras/zuzu-js/lib/browser-runtime.js"(exports, module) {
      "use strict";
      var { createBrowserHost } = require_browser_host();
      var { transpile } = require_transpiler();
      var { ZuzuScript } = require_runtime();
      function _extractLineColumn(errorText) {
        const match = String(errorText || "").match(/:(\d+):(\d+)\)?(?:\n|$)/u);
        if (!match) {
          return null;
        }
        return {
          line: Number(match[1]),
          column: Number(match[2])
        };
      }
      function _makeSnippet(source, line, column) {
        const lines = String(source || "").split(/\r?\n/u);
        if (!Number.isInteger(line) || line < 1 || line > lines.length) {
          return null;
        }
        const content = lines[line - 1];
        const caretColumn = Number.isInteger(column) && column > 0 ? column : 1;
        return `${content}
${" ".repeat(Math.max(0, caretColumn - 1))}^`;
      }
      function _toJsError(source, filename, result) {
        const stderr = String(result && result.stderr || "").trim();
        const message = stderr || `Zuzu evaluation failed (${filename})`;
        const err = new Error(message);
        err.name = result && result.status === 3 ? "ZuzuParseError" : "ZuzuRuntimeError";
        err.filename = filename;
        err.source = String(source || "");
        err.zuzu = {
          status: result ? result.status : 1,
          stdout: result ? result.stdout : "",
          stderr: result ? result.stderr : ""
        };
        const where = _extractLineColumn(stderr);
        if (where) {
          err.line = where.line;
          err.column = where.column;
          err.snippet = _makeSnippet(source, where.line, where.column);
        }
        return err;
      }
      function _coerceScalarOutput(stdout) {
        const lines = String(stdout || "").trimEnd().split(/\r?\n/u);
        if (lines.length !== 1) {
          return void 0;
        }
        const raw = lines[0];
        if (/^-?\d+(?:\.\d+)?$/u.test(raw)) {
          return Number(raw);
        }
        if (raw === "true" || raw === "1") {
          return true;
        }
        if (raw === "false" || raw === "0") {
          return false;
        }
        if (raw === "null") {
          return null;
        }
        return raw;
      }
      function createBrowserRuntime(options = {}) {
        const host = options.host || createBrowserHost(options);
        const runtime = options.runtime || new ZuzuScript({
          host,
          repoRoot: options.repoRoot || host.repoRoot || "/",
          includePaths: options.includePaths,
          denyCapabilities: options.denyCapabilities,
          denyModules: options.denyModules,
          transpiler: options.transpiler
        });
        function _runSource(source, evalOptions = {}) {
          const filename = evalOptions.filename || "/<browser>.zzs";
          return runtime.runSource(String(source ?? ""), {
            filename,
            preloadModules: evalOptions.preloadModules || []
          });
        }
        function zuzu_run(source, evalOptions = {}) {
          const result = _runSource(source, evalOptions);
          if (evalOptions.throwOnError !== false && result.status !== 0) {
            throw _toJsError(source, evalOptions.filename || "/<browser>.zzs", result);
          }
          return result;
        }
        function zuzu_eval(source, evalOptions = {}) {
          const sourceText = String(source ?? "");
          const filename = evalOptions.filename || "/<browser>.zzs";
          const run = () => {
            if (evalOptions.result === true) {
              return zuzu_run(sourceText, evalOptions);
            }
            const expressionResult = _runSource(`say( ${sourceText} );`, {
              ...evalOptions,
              filename
            });
            if (expressionResult.status === 0) {
              return _coerceScalarOutput(expressionResult.stdout);
            }
            const result = zuzu_run(sourceText, evalOptions);
            if (result.stdout && evalOptions.returnStdout === true) {
              return result.stdout;
            }
            return void 0;
          };
          if (evalOptions.async === true) {
            return Promise.resolve().then(run);
          }
          return run();
        }
        function zuzu_compile(source, _compileOptions = {}) {
          return transpile(String(source ?? ""), {
            transpiler: runtime.transpiler
          });
        }
        return {
          host,
          runtime,
          zuzu_eval,
          zuzu_run,
          zuzu_compile
        };
      }
      module.exports = {
        createBrowserRuntime
      };
    }
  });

  // extras/zuzu-js/lib/browser-bundle-entry.js
  var require_browser_bundle_entry = __commonJS({
    "extras/zuzu-js/lib/browser-bundle-entry.js"(exports, module) {
      "use strict";
      var { createBrowserRuntime } = require_browser_runtime();
      var defaultRuntime = null;
      function _defaultRuntimeOptions() {
        const root = typeof globalThis !== "undefined" ? globalThis : null;
        const value = root && root.__ZUZU_BROWSER_DEFAULT_RUNTIME_OPTIONS__;
        return value && typeof value === "object" ? value : {};
      }
      function _mergeMapOption(left, right) {
        return {
          ...left || {},
          ...right || {}
        };
      }
      function _mergeRuntimeOptions(defaults, options) {
        return {
          ...defaults,
          ...options,
          virtualFiles: _mergeMapOption(defaults.virtualFiles, options.virtualFiles),
          jsModules: _mergeMapOption(defaults.jsModules, options.jsModules)
        };
      }
      function createConfiguredBrowserRuntime(options = {}) {
        return createBrowserRuntime(
          _mergeRuntimeOptions(_defaultRuntimeOptions(), options)
        );
      }
      function getDefaultBrowserRuntime(options = {}) {
        if (!defaultRuntime || options.reset === true) {
          defaultRuntime = createConfiguredBrowserRuntime(
            options.runtimeOptions || options
          );
        }
        return defaultRuntime;
      }
      function zuzu_eval(source, options = {}) {
        return getDefaultBrowserRuntime(options.runtimeOptions || {}).zuzu_eval(source, options);
      }
      function zuzu_run(source, options = {}) {
        return getDefaultBrowserRuntime(options.runtimeOptions || {}).zuzu_run(source, options);
      }
      function zuzu_compile(source, options = {}) {
        return getDefaultBrowserRuntime(options.runtimeOptions || {}).zuzu_compile(source, options);
      }
      function installGlobalApis(root = globalThis) {
        if (!root || typeof root !== "object") {
          return null;
        }
        root.zuzu_eval = zuzu_eval;
        root.zuzu_run = zuzu_run;
        root.zuzu_compile = zuzu_compile;
        root.zuzu_runtime = getDefaultBrowserRuntime;
        return root;
      }
      function runEmbeddedScripts(runtime, options = {}) {
        const doc = options.document || (typeof document !== "undefined" ? document : null);
        if (!doc) {
          return [];
        }
        const selector = options.selector || 'script[type="text/x-zuzuscript"]';
        const filenamePrefix = options.filenamePrefix || "/<embedded>";
        const scripts = Array.from(doc.querySelectorAll(selector));
        const log = typeof options.consoleLog === "function" ? options.consoleLog : (line) => console.log(line);
        const errorLog = typeof options.consoleError === "function" ? options.consoleError : (err) => console.error(err);
        const results = [];
        for (let i = 0; i < scripts.length; i++) {
          const script = scripts[i];
          const source = script.textContent || "";
          try {
            const result = runtime.zuzu_run(source, {
              filename: `${filenamePrefix}-${i + 1}.zzs`,
              throwOnError: options.throwOnError !== false
            });
            if (result.stdout) {
              for (const line of result.stdout.trimEnd().split(/\r?\n/u)) {
                if (line) {
                  log(line);
                }
              }
            }
            results.push(result);
          } catch (err) {
            errorLog(err);
            results.push(err);
            if (options.stopOnError !== false) {
              throw err;
            }
          }
        }
        return results;
      }
      function autoRunEmbeddedScripts(options = {}) {
        const doc = options.document || (typeof document !== "undefined" ? document : null);
        if (!doc) {
          return null;
        }
        const runtime = options.runtime || getDefaultBrowserRuntime({
          runtimeOptions: options.runtimeOptions || {}
        });
        const runNow = () => runEmbeddedScripts(runtime, options);
        if (doc.readyState === "loading") {
          doc.addEventListener("DOMContentLoaded", runNow, { once: true });
          return runtime;
        }
        runNow();
        return runtime;
      }
      if (typeof window !== "undefined" && window && window.document && !window.__ZUZU_BROWSER_NO_AUTORUN__) {
        installGlobalApis(window);
        autoRunEmbeddedScripts({});
      }
      module.exports = {
        createBrowserRuntime: createConfiguredBrowserRuntime,
        getDefaultBrowserRuntime,
        zuzu_eval,
        zuzu_run,
        zuzu_compile,
        installGlobalApis,
        runEmbeddedScripts,
        autoRunEmbeddedScripts
      };
    }
  });

  // ../../../../../tmp/zuzu-browser-build.STABLE/browser-bundle-entry.generated.js
  var require_browser_bundle_entry_generated = __commonJS({
    "../../../../../tmp/zuzu-browser-build.STABLE/browser-bundle-entry.generated.js"(exports, module) {
      var { createBrowserStdlib } = require_browser_stdlib_generated();
      globalThis.__ZUZU_BROWSER_DEFAULT_RUNTIME_OPTIONS__ = createBrowserStdlib();
      module.exports = require_browser_bundle_entry();
    }
  });
  return require_browser_bundle_entry_generated();
})();

;(function () {
	'use strict';
	const __zuzu_payload = {
	"entry": "/__zuzu_compiled__/browser-compile-demo.zzs",
	"entryJs": "const { JSON } = __zuzu_import( \"std/data/json\" );\nconst { ZPath } = __zuzu_import( \"std/path/z\" );\nlet data = { \"title\": \"ZuzuScript browser compile demo\", \"users\": [ { \"name\": \"Ada\", \"score\": 42 }, { \"name\": \"Lin\", \"score\": 37 } ] };\nlet first_name = new ZPath( __zuzu_pairlist_literal( [ [ \"path\", \"/users/#0/name\" ] ] ) ).first( data );\nlet encoded = new JSON( __zuzu_pairlist_literal( [ [ \"canonical\", true ] ] ) ).encode( data );\nsay( ( __zuzu_get_brace_member( data, \"title\", () => title ) ) );\nsay( ( __zuzu_concat( \"first user: \", first_name ) ) );\nsay( ( __zuzu_concat( \"json bytes: \", __zuzu_length( encoded ) ) ) );",
	"virtualFiles": {
		"/__zuzu_compiled__/browser-compile-demo.zzs": "from std/data/json import JSON;\nfrom std/path/z import ZPath;\n\nlet data := {\n\ttitle: \"ZuzuScript browser compile demo\",\n\tusers: [\n\t\t{ name: \"Ada\", score: 42 },\n\t\t{ name: \"Lin\", score: 37 },\n\t],\n};\n\nlet first_name := new ZPath( path: \"/users/#0/name\" ).first(data);\nlet encoded := new JSON( canonical: true ).encode(data);\n\nsay( data{title} );\nsay( \"first user: \" _ first_name );\nsay( \"json bytes: \" _ length encoded );\n",
		"/modules/std/cache/lru.zzm": "=encoding utf8\n\n=head1 NAME\n\nstd/cache/lru - Pure ZuzuScript in-memory LRU cache.\n\n=head1 SYNOPSIS\n\n  from std/cache/lru import Cache;\n\n  let cache := new Cache( capacity: 20 );\n\n  let item := cache.get( \"item-key\", function ( item_key ) {\n    # Called only on cache miss.\n    return calculate_some_expensive_value( item_key );\n  } );\n\n  cache.empty();\n\n=head1 DESCRIPTION\n\nThis module provides a tiny in-memory least-recently-used (LRU)\ncache written in pure ZuzuScript.\n\nKeys are stored in an internal C<Dict>, and are assumed to be\nstrings. Values may be any ZuzuScript value.\n\n=head2 Classes\n\n=over\n\n=item C<< Cache({ capacity?: Number }) >>\n\nConstruct a cache with a maximum number of entries.\nDefaults to C<128>.\n\n=item C<< cache.get(String item_key, Function producer) >>\n\nReturns the cached value for C<item_key>.\nOn a miss, calls C<producer(item_key)>, stores the return value,\nand returns it.\n\n=item C<< cache.peek(String item_key, fallback?) >>\n\nReturns the cached value for C<item_key>.\nOn a miss, returns the fallback. Or null if no fallback provided.\n\n=item C<< cache.set(String item_key, value) >>\n\nStore a value for C<item_key> and mark it as recently used.\n\n=item C<< cache.has(String item_key) >>\n\nTrue if the cache currently contains C<item_key>.\n\n=item C<< cache.size() >>\n\nCurrent number of cached entries.\n\n=item C<< cache.capacity() >>\n\nConfigured maximum number of entries.\n\n=item C<< cache.empty() >>\n\nRemove all entries from the cache.\n\n=back\n\n=head1 COPYRIGHT AND LICENCE\n\nB<< std/cache/lru >> by Toby Inkster is marked CC0 1.0 Universal.\n\n=cut\n\nclass Cache {\n\tlet Number capacity := 128;\n\tlet Dict _items := {};\n\tlet Array _order := [];\n\n\tmethod __build__ () {\n\t\tdie \"Cache capacity must be greater than zero\" if capacity <= 0;\n\t}\n\n\tmethod _drop_key_from_order ( String item_key ) {\n\t\tlet kept := [];\n\t\tlet i := 0;\n\t\twhile ( i < _order.length() ) {\n\t\t\tlet key := _order[i];\n\t\t\tif ( key \u2262 item_key ) {\n\t\t\t\tkept.push(key);\n\t\t\t}\n\t\t\ti++;\n\t\t}\n\t\t_order := kept;\n\t}\n\n\tmethod _touch ( String item_key ) {\n\t\tself._drop_key_from_order(item_key);\n\t\t_order.push(item_key);\n\t}\n\n\tmethod _evict_if_needed () {\n\t\twhile ( _order.length() > capacity ) {\n\t\t\tlet oldest := _order.shift();\n\t\t\tif ( _items.exists(oldest) ) {\n\t\t\t\t_items.remove(oldest);\n\t\t\t}\n\t\t}\n\t}\n\n\tmethod set ( String item_key, value ) {\n\t\t_items.set( item_key, value );\n\t\tself._touch(item_key);\n\t\tself._evict_if_needed();\n\t\treturn value;\n\t}\n\n\tmethod get ( String item_key, producer ) {\n\t\tif ( _items.exists(item_key) ) {\n\t\t\tself._touch(item_key);\n\t\t\treturn _items.get(item_key);\n\t\t}\n\n\t\tdie \"Cache.get expects a producer Function\" if not( typeof producer \u2261 \"Function\" );\n\n\t\tlet value := producer(item_key);\n\t\tself.set( item_key, value );\n\t\treturn value;\n\t}\n\n\tmethod peek ( String item_key, fallback? ) {\n\t\tif ( _items.exists(item_key) ) {\n\t\t\tself._touch(item_key);\n\t\t\treturn _items.get(item_key);\n\t\t}\n\n\t\treturn fallback;\n\t}\n\n\tmethod has ( String item_key ) {\n\t\treturn _items.exists(item_key);\n\t}\n\n\tmethod size () {\n\t\treturn _items.length();\n\t}\n\n\tmethod capacity () {\n\t\treturn capacity;\n\t}\n\n\tmethod empty () {\n\t\t_items.clear();\n\t\t_order.clear();\n\t\treturn self;\n\t}\n}\n",
		"/modules/std/data/xml/escape.zzm": "=encoding utf8\n\n=head1 NAME\n\nstd/data/xml/escape - XML entity escaping helpers.\n\n=head1 SYNOPSIS\n\n  from std/data/xml/escape import\n    escape_xml, unescape_xml;\n\n  let escaped := escape_xml(\n    \"<tea attr=\\\"hot\\\">& 'biscuits'</tea>\"\n  );\n  let text := unescape_xml(\n    \"&lt;tea&gt;&#x41;&#65;&lt;/tea&gt;\"\n  );\n\n=head1 DESCRIPTION\n\nThis module provides lightweight XML entity\nescaping and unescaping helpers.\n\n=head2 Functions\n\n=over\n\n=item C<< escape_xml(value) >>\n\nEscape XML special characters C<&>, C<< < >>, C<< > >>,\nC<\">, and C<'>.\n\n=item C<< unescape_xml(value) >>\n\nUnescape XML named entities C<&lt;>, C<&gt;>, C<&quot;>,\nC<&apos;>, and C<&amp;>.\n\nAlso decodes numeric entities in decimal and hexadecimal\nforms, such as C<&#65;> and C<&#x41;>.\n\n=back\n\n=head1 COPYRIGHT AND LICENCE\n\nB<< std/data/xml/escape >> by Toby Inkster is marked\nCC0 1.0 Universal.\n\n=cut\n\nfrom std/string import substr, replace, sprint, index;\n\nfunction escape_xml ( value ) {\n\tlet out := value \u2261 null ? \"\" : \"\" _ value;\n\tout := replace( out, \"&\", \"&amp;\", \"g\" );\n\tout := replace( out, \"<\", \"&lt;\", \"g\" );\n\tout := replace( out, \">\", \"&gt;\", \"g\" );\n\tout := replace( out, \"\\\"\", \"&quot;\", \"g\" );\n\tout := replace( out, \"'\", \"&apos;\", \"g\" );\n\treturn out;\n}\n\nfunction _hex_to_number ( String digits ) {\n\tlet out := 0;\n\tlet i := 0;\n\tlet n := length digits;\n\n\twhile ( i < n ) {\n\t\tlet ch := substr( digits, i, 1 );\n\t\tlet val := 0;\n\n\t\tif ( ch ~ /[0-9]/ ) {\n\t\t\tval := 0 + ch;\n\t\t}\n\t\telse {\n\t\t\tlet lower := lc(ch);\n\t\t\tval := 10 + index( \"abcdef\", lower );\n\t\t}\n\n\t\tout := out * 16 + val;\n\t\ti++;\n\t}\n\n\treturn out;\n}\n\nfunction _decode_numeric_xml_entities ( text ) {\n\tlet out := \"\";\n\tlet i := 0;\n\tlet n := length text;\n\n\twhile ( i < n ) {\n\t\tlet ch := substr( text, i, 1 );\n\t\tif ( ch \u2261 \"&\" and i + 2 < n and substr( text, i, 2 ) \u2261 \"&#\" ) {\n\t\t\tlet j := i + 2;\n\t\t\tlet hex := false;\n\n\t\t\tif ( j < n ) {\n\t\t\t\tlet mark := substr( text, j, 1 );\n\t\t\t\tif ( mark \u2261 \"x\" or mark \u2261 \"X\" ) {\n\t\t\t\t\thex := true;\n\t\t\t\t\tj++;\n\t\t\t\t}\n\t\t\t}\n\n\t\t\tlet digits := \"\";\n\t\t\twhile ( j < n ) {\n\t\t\t\tlet d := substr( text, j, 1 );\n\t\t\t\tlast if d \u2261 \";\";\n\n\t\t\t\tif ( hex ) {\n\t\t\t\t\tlast unless d ~ /[0-9A-Fa-f]/;\n\t\t\t\t}\n\t\t\t\telse {\n\t\t\t\t\tlast unless d ~ /[0-9]/;\n\t\t\t\t}\n\n\t\t\t\tdigits _= d;\n\t\t\t\tj++;\n\t\t\t}\n\n\t\t\tif ( digits \u2262 \"\" and j < n and substr( text, j, 1 ) \u2261 \";\" ) {\n\t\t\t\tlet code := hex\n\t\t\t\t\t? _hex_to_number( digits )\n\t\t\t\t\t: 0 + digits;\n\t\t\t\tout _= sprint( \"%c\", code );\n\t\t\t\ti := j + 1;\n\t\t\t\tnext;\n\t\t\t}\n\t\t}\n\n\t\tout _= ch;\n\t\ti++;\n\t}\n\n\treturn out;\n}\n\nfunction unescape_xml ( value ) {\n\tlet out := value \u2261 null ? \"\" : \"\" _ value;\n\tout := _decode_numeric_xml_entities( out );\n\tout := replace( out, \"&lt;\", \"<\", \"g\" );\n\tout := replace( out, \"&gt;\", \">\", \"g\" );\n\tout := replace( out, \"&quot;\", \"\\\"\", \"g\" );\n\tout := replace( out, \"&apos;\", \"'\", \"g\" );\n\tout := replace( out, \"&amp;\", \"&\", \"g\" );\n\treturn out;\n}\n",
		"/modules/std/dump.zzm": "=encoding utf8\n\n=head1 NAME\n\nstd/dump - Structured value dumper for ZuzuScript.\n\n=head1 SYNOPSIS\n\n  from std/dump import Dumper;\n\n  let text := Dumper.dump(\n    { nums: [ 1, 2, 3 ] },\n    { pretty: true, sort_keys: true }\n  );\n\n=head1 DESCRIPTION\n\nThis module provides a pure-Zuzu C<Dumper> class which serializes\nZuzu values into code-like text.\n\nIf a value cannot be realistically dumped (for example a function),\nC<Dumper> emits a warning and inserts C<null> in that location.\n\n=head1 COPYRIGHT AND LICENCE\n\nB<< std/dump >> by Toby Inkster is marked CC0 1.0 Universal.\n\n=cut\n\nfrom std/internals import class_name, object_slots, ansi_esc, ref_id;\nfrom std/string import join, substr;\nlet _ANSI_RESET := ansi_esc() _ \"[0m\";\nlet _ANSI_NUMBER := ansi_esc() _ \"[33m\";\nlet _ANSI_STRING := ansi_esc() _ \"[32m\";\nlet _ANSI_BOOL := ansi_esc() _ \"[35m\";\nlet _ANSI_NULL := ansi_esc() _ \"[90m\";\nlet _ANSI_PUNC := ansi_esc() _ \"[36m\";\nlet _ANSI_KEYWORD := ansi_esc() _ \"[34m\";\n\nfunction _is_true (value) {\n\treturn value ? true: false;\n}\n\nfunction _warn_unless_quiet ( String msg, Dict cfg ) {\n\twarn msg if not cfg{quiet};\n}\n\nfunction _indent_pad ( depth, cfg ) {\n\treturn \"\" if not cfg{pretty};\n\tlet out := \"\";\n\tlet i := 0;\n\twhile ( i < depth ) {\n\t\tout _= \"  \";\n\t\ti++;\n\t}\n\n\treturn out;\n}\n\nfunction _colorize ( String text, String tone, Dict cfg ) {\n\treturn text if not cfg{color};\n\treturn tone _ text _ _ANSI_RESET;\n}\n\nfunction _punc ( String text, Dict cfg ) {\n\treturn _colorize( text, _ANSI_PUNC, cfg );\n}\n\nfunction _quote ( String text, Dict cfg ) {\n\tlet s := text;\n\ts := \"\" if s \u2261 null;\n\tlet out := \"\";\n\tlet i := 0;\n\tlet n := length s;\n\n\twhile ( i < n ) {\n\t\tlet ch := substr( s, i, 1 );\n\t\tif ( ch \u2261 \"\\\\\" ) {\n\t\t\tout _= \"\\\\\\\\\";\n\t\t}\n\t\telse if ( ch \u2261 \"\\\"\" ) {\n\t\t\tout _= \"\\\\\\\"\";\n\t\t}\n\t\telse if ( ch \u2261 \"\\n\" ) {\n\t\t\tout _= \"\\\\n\";\n\t\t}\n\t\telse if ( ch \u2261 \"\\r\" ) {\n\t\t\tout _= \"\\\\r\";\n\t\t}\n\t\telse if ( ch \u2261 \"\\t\" ) {\n\t\t\tout _= \"\\\\t\";\n\t\t}\n\t\telse {\n\t\t\tout _= ch;\n\t\t}\n\t\ti++;\n\t}\n\n\treturn _colorize( \"\\\"\" _ out _ \"\\\"\", _ANSI_STRING, cfg );\n}\n\nfunction _keys_for ( Dict d, Dict cfg ) {\n\treturn cfg{sort_keys} ? d.sorted_keys(): d.keys();\n}\n\nfunction _null_literal ( Dict cfg ) {\n\treturn _colorize( \"null\", _ANSI_NULL, cfg );\n}\n\nfunction _seen_check_and_mark ( value, String label, Dict cfg, Dict state ) {\n\tlet id := ref_id(value);\n\tif ( id \u2262 null and state{seen}.exists(id) ) {\n\t\t_warn_unless_quiet( \"Dumper: recursive \" _ label _ \" detected; dumping null\", cfg );\n\t\treturn true;\n\t}\n\tif ( id \u2262 null ) {\n\t\tstate{seen}.set( id, true );\n\t}\n\n\treturn false;\n}\n\nfunction _dump_value ( value, Dict cfg, Dict state, Number depth ) {\n\tlet t := typeof value;\n\tif ( t \u2261 \"Null\" ) {\n\t\treturn _null_literal(cfg);\n\t}\n\tif ( t \u2261 \"Boolean\" ) {\n\t\treturn _colorize( value ? \"true\": \"false\", _ANSI_BOOL, cfg );\n\t}\n\tif ( t \u2261 \"Number\" ) {\n\t\treturn _colorize( \"\" _ value, _ANSI_NUMBER, cfg );\n\t}\n\tif ( t \u2261 \"String\" ) {\n\t\treturn _quote( value, cfg );\n\t}\n\n\tif ( t \u2261 \"Array\" ) {\n\t\treturn _null_literal(cfg) if _seen_check_and_mark( value, \"array\", cfg, state );\n\t\tif ( value.length() \u2261 0 ) {\n\t\t\treturn _punc( \"[\", cfg ) _ _punc( \"]\", cfg );\n\t\t}\n\t\tlet pretty := cfg{pretty};\n\t\tlet sep := pretty ? _punc( \",\\n\", cfg ): _punc(\",\", cfg );\n\t\tlet parts := [];\n\t\tfor ( let item in value ) {\n\t\t\tparts.push( _dump_value( item, cfg, state, depth + 1 ) );\n\t\t}\n\t\tif ( not pretty ) {\n\t\t\treturn _punc( \"[\", cfg ) _ join( sep, parts ) _ _punc( \"]\", cfg );\n\t\t}\n\t\tlet inner := [];\n\t\tfor ( let p in parts ) {\n\t\t\tinner.push( _indent_pad( depth + 1, cfg ) _ p );\n\t\t}\n\t\treturn _punc( \"[\\n\", cfg ) _ join( sep, inner ) _ _punc( \"\\n\", cfg ) _ _indent_pad( depth, cfg ) _\n\t\t    _punc( \"]\", cfg );\n\t}\n\n\tif ( t \u2261 \"Dict\" ) {\n\t\treturn _null_literal(cfg) if _seen_check_and_mark( value, \"dict\", cfg, state );\n\t\tlet keys := _keys_for( value, cfg );\n\t\tif ( keys.length() \u2261 0 ) {\n\t\t\treturn _punc( \"{\" , cfg ) _ _punc( \"}\", cfg );\n\t\t}\n\t\tlet pretty := cfg{pretty};\n\t\tlet sep := pretty ? _punc( \",\\n\", cfg ): _punc(\",\", cfg );\n\t\tlet colon := pretty ? _punc( \": \", cfg ): _punc(\":\", cfg );\n\t\tlet entries := [];\n\t\tfor ( let key in keys ) {\n\t\t\tlet dumped := _dump_value( value.get(key), cfg, state, depth + 1 );\n\t\t\tentries.push( _quote( key, cfg ) _ colon _ dumped );\n\t\t}\n\t\tif ( not pretty ) {\n\t\t\treturn _punc( \"{\" , cfg ) _ join( sep, entries ) _ _punc( \"}\", cfg );\n\t\t}\n\t\tlet inner := [];\n\t\tfor ( let e in entries ) {\n\t\t\tinner.push( _indent_pad( depth + 1, cfg ) _ e );\n\t\t}\n\t\treturn _punc( \"{\\n\", cfg ) _ join( sep, inner ) _ _punc( \"\\n\", cfg ) _ _indent_pad( depth, cfg ) _\n\t\t    _punc( \"}\", cfg );\n\t}\n\n\tif ( t \u2261 \"PairList\" ) {\n\t\treturn _null_literal(cfg) if _seen_check_and_mark( value, \"pairlist\", cfg, state );\n\t\tif ( value.empty ) {\n\t\t\treturn _punc( \"{{\" , cfg ) _ _punc( \"}}\", cfg );\n\t\t}\n\t\tlet pretty := cfg{pretty};\n\t\tlet sep := pretty ? _punc( \",\\n\", cfg ): _punc(\",\", cfg );\n\t\tlet colon := pretty ? _punc( \": \", cfg ): _punc(\":\", cfg );\n\t\tlet entries := [];\n\t\tvalue.for_each_pair( function (p) {\n\t\t\tlet dumped := _dump_value( p.value, cfg, state, depth + 1 );\n\t\t\tentries.push( _quote( p.key, cfg ) _ colon _ dumped );\n\t\t} );\n\t\tif ( not pretty ) {\n\t\t\treturn _punc( \"{{\" , cfg ) _ join( sep, entries ) _ _punc( \"}}\", cfg );\n\t\t}\n\t\tlet inner := [];\n\t\tfor ( let e in entries ) {\n\t\t\tinner.push( _indent_pad( depth + 1, cfg ) _ e );\n\t\t}\n\t\treturn _punc( \"{{\\n\", cfg ) _ join( sep, inner ) _ _punc( \"\\n\", cfg ) _ _indent_pad( depth, cfg ) _\n\t\t    _punc( \"}}\", cfg );\n\t}\n\n\tif ( t \u2261 \"Set\" or t \u2261 \"Bag\" ) {\n\t\treturn _null_literal(cfg) if _seen_check_and_mark( value, lc t, cfg, state );\n\t\tlet left :=( t \u2261 \"Set\" ) ? \"<<\": \"<<<\";\n\t\tlet right :=( t \u2261 \"Set\" ) ? \">>\": \">>>\";\n\t\tlet sep := cfg{pretty} ? _punc( \", \", cfg ): _punc(\",\", cfg );\n\t\tlet items := [];\n\t\tfor ( let item in value ) {\n\t\t\titems.push( _dump_value( item, cfg, state, depth + 1 ) );\n\t\t}\n\t\treturn _punc( left, cfg ) _ join( sep, items ) _ _punc( right, cfg );\n\t}\n\n\tif ( t \u2261 \"Pair\" ) {\n\t\tlet pair_value := value{pair};\n\t\tif ( typeof pair_value \u2262 \"Array\" or pair_value.length() < 2 ) {\n\t\t\t_warn_unless_quiet( \"Dumper: invalid Pair shape; using null\", cfg );\n\t\t\treturn _null_literal(cfg);\n\t\t}\n\t\tlet first := _dump_value( pair_value[0], cfg, state, depth + 1 );\n\t\tlet second := _dump_value( pair_value[1], cfg, state, depth + 1 );\n\t\tlet body := _punc( \"[\", cfg ) _ first _ _punc(\",\", cfg ) _ second _ _punc( \"]\", cfg );\n\t\tlet kw_new := _colorize( \"new\", _ANSI_KEYWORD, cfg );\n\t\treturn kw_new _ \" Pair\" _ _punc(\"(\", cfg ) _ \"pair\" _ _punc(\":\", cfg ) _ body _ _punc(\")\", cfg );\n\t}\n\n\tif ( t \u2261 \"Function\" or t \u2261 \"Method\" or t \u2261 \"Class\" or t \u2261 \"Regexp\" ) {\n\t\t_warn_unless_quiet( \"Dumper: value of type '\" _ t _ \"' is not dumpable; using null\", cfg, );\n\t\treturn _null_literal(cfg);\n\t}\n\treturn _null_literal(cfg) if _seen_check_and_mark( value, \"object\", cfg, state );\n\tlet cname := class_name(value);\n\tlet slots := object_slots(value);\n\tif ( cname \u2261 null or typeof slots \u2262 \"Dict\" ) {\n\t\t_warn_unless_quiet( \"Dumper: object internals unavailable; dumping null\", cfg );\n\t\treturn _null_literal(cfg);\n\t}\n\tlet keys := _keys_for( slots, cfg );\n\tlet colon := cfg{pretty} ? _punc( \": \", cfg ): _punc(\":\", cfg );\n\tlet args := [];\n\tfor ( let key in keys ) {\n\t\targs.push( key _ colon _ _dump_value( slots.get(key), cfg, state, depth + 1 ) );\n\t}\n\tlet kw_new := _colorize( \"new\", _ANSI_KEYWORD, cfg );\n\tif ( args.length() \u2261 0 ) {\n\t\treturn kw_new _ \" \" _ cname _ _punc( \"()\", cfg );\n\t}\n\tif ( not cfg{pretty} ) {\n\t\treturn kw_new _ \" \" _ cname _ _punc(\"(\", cfg ) _ join( _punc(\",\", cfg ), args ) _ _punc(\")\", cfg );\n\t}\n\tlet inner := [];\n\tfor ( let arg in args ) {\n\t\tinner.push( _indent_pad( depth + 1, cfg ) _ arg );\n\t}\n\treturn kw_new _ \" \" _ cname _ _punc( \"(\\n\", cfg ) _ join( _punc( \",\\n\", cfg ), inner ) _ _punc( \"\\n\",\n\t    cfg ) _ _indent_pad( depth, cfg ) _ _punc(\")\", cfg );\n}\n\nclass Dumper {\n\n\tstatic method dump ( value, options? ) {\n\t\tlet cfg := { pretty: false, sort_keys: false, color: false, quiet: false };\n\t\tif ( typeof options \u2261 \"Dict\" ) {\n\t\t\tcfg{pretty} := _is_true( options{pretty} ) if \"pretty\" in options;\n\t\t\tcfg{sort_keys} := _is_true( options{sort_keys} ) if \"sort_keys\" in options;\n\t\t\tcfg{color} := _is_true( options{color} ) if \"color\" in options;\n\t\t\tcfg{quiet} := _is_true( options{quiet} ) if \"quiet\" in options;\n\t\t}\n\t\treturn _dump_value( value, cfg, { seen: {} }, 0 );\n\t}\n\n}\n",
		"/modules/std/path/z.zzm": "=encoding utf8\n\n=head1 NAME\n\nstd/path/z - Pure Zuzu implementation of ZPath selectors.\n\n=head1 SYNOPSIS\n\n  from std/path/z import ZPath;\n  from std/time import Time;\n  \n  let data := {\n    users: [\n      { name: \"Ada\", age: 32, updated: new Time() },\n      { name: \"Bob\", age: 27 },\n    ],\n  };\n  \n  let names := query( data, \"/users/*/name\" );\n  let zp := new ZPath( path: \"/users/#0/name\" );\n  say( zp.first( data, \"n/a\" ) );\n  say( exists( data, \"/users/#9/name\" ) );\n  say( first( data, \"/users/#0/updated/@year\" ) );\n  say( zp.assign_first( data, \"Adele\" ) );\n\n=head1 DESCRIPTION\n\nNative (pure-Zuzu) path traversal for structured values.\n\n=head2 Use with path operators\n\nThe path operators C<@>, C<@@>, and C<@?> can be set to use this module\nin a lexical scope.\n\n  from std/path/z import ZPath;\n  \n  function find_usernames (data) {\n    ZPath.use();\n    return data @@ \"/users/*/name\";\n  }\n\nHowever, for repeatedly used paths it may be more efficient to compile the\npath once and use many times:\n\n  let _usernames_zpath;\n  function find_usernames (data) {\n    from std/path/z import ZPath;\n    _usernames_zpath ?:= new ZPath( path: \"/users/*/name\" );\n    return data @@ _usernames_zpath;\n  }\n\n=head2 Methods\n\nA compiled C<ZPath> object provides the following methods:\n\n=over\n\n=item * C<query(haystack)>\n\nReturns an Array with all results searching the haystack.\n\n=item * C<first(haystack)>\n\nReturns just the first result, or null if none were found.\n\n=item * C<exists(haystack)>\n\nReturns a boolean indicating if any results were found.\n\n=item * C<assign_first(haystack, value, op := \":=\")>\n\nUpdates the first selected node. Throws if no matches are found.\n\n=item * C<assign_all(haystack, value, op := \":=\")>\n\nUpdates all selected nodes. If no matches are found, returns C<value>\nwithout mutation.\n\n=item * C<assign_maybe(haystack, value, op := \":=\")>\n\nUpdates the first selected node when one exists. Returns C<true> on\nmatch and C<false> on no match.\n\n=item * C<ref_first(haystack)>\n\nReturns a reference-like getter/setter closure for the first selected\nnode. Throws if no matches are found.\n\n=item * C<ref_all(haystack)>\n\nReturns an Array of reference-like getter/setter closures.\n\n=item * C<ref_maybe(haystack)>\n\nReturns one reference-like getter/setter closure when a match exists,\notherwise C<null>.\n\n=back\n\n=head2 Supported types\n\n=over\n\n=item B<Null>, B<Boolean>, B<Number>, B<String>, B<BinaryString>, B<Regexp>\n\nTreated as terminal nodes. These objects cannot have child objects.\n\n=item B<Array>\n\nArray items can be indexed by number.\n\n=item B<Bag>, B<Set>\n\nItems cannot be indexed by number, but can be returned by \"*\".\n\n=item B<Dict>\n\nValues are named by their key.\n\n=item B<PairList>\n\nPairs can be indexed by number, named by their key, or use a combination of\nboth.\n\n  {{ foo: 11, bar: -1, foo: 22, foo: 33 }}\n\nC<< /#2 >> (0-based index) will retrieve C<< foo: 22 >>.\nC<< /foo >> will retrieve C<< foo: 11 >>, C<< foo: 22 >>, and C<< foo: 33 >>.\nC<< /foo#2 >> (0-based index on just values with key \"foo\") will retrieve C<< foo: 33 >>.\n\nNote that rather than just retrieving the value, a Pair object is retrieved.\n\n=item B<< Pair >>\n\nPair objects do not have child objects but do have C<< @key >> and\nC<< @value >> attributes.\n\n  let pairlist := {{ foo: 11, bar: -1, foo: 22, foo: 33 }};\n  say( first( pairlist, \"/#2/@key\" ) );     // \"foo\"\n  say( first( pairlist, \"/#2/@value\" ) );   // 22\n\n=item B<< Time >>\n\nTime is treated as a terminal node with attributes C<< @year >>,\nC<< @month >>, C<< @day >>, C<< @hour >>, C<< @min >>, and C<< @sec >>.\n\nSee C<< std/time >>.\n\n=item B<< Path >>\n\nPaths representing files are treated as terminal nodes with attributes\ncorresponding to the values from the C<stat> system call: C<< @dev >>,\nC<< @ino >>, C<< @mode >>, C<< @nlink >>, C<< @uid >>, C<< @gid >>,\nC<< @rdev >>, C<< @size >>, C<< @atime >>, C<< @mtime >>, C<< @ctime >>,\nC<< @blksize >>, and C<< @blocks >>.\n\nSee C<< std/io >>.\n\n=item B<< XMLDocument >>, B<< XMLNode >>, etc.\n\nAre treated roughly how the ZPath specification suggests.\n\n  /html/body/table/tbody/tr     // all rows in the tbody\n  /html/body/table/tbody/tr#0   // the first row in the tbody\n  /html/body/table/tbody/#0     // the child element in the tbody\n  /html/body/table[@id]         // all tables that have an id attribute\n\nSee C<< std/data/xml >>.\n\n=back\n\n=head1 SEE ALSO\n\nSpecification: L<https://zpath.me>.\n\nPerl implementation: L<Data::ZPath>.\n\n=cut\n\nfrom std/path/z/parser import Parser;\nfrom std/path/z/evaluate import Evaluator;\nfrom std/path/z/context import Ctx;\n\nlet _cache;\ndo {\n\tfrom std/cache/lru try import Cache;\n\tif ( Cache ) {\n\t\t_cache := new Cache( capacity: 16 );\n\t}\n};\n\nclass ZPath {\n\tlet String path;\n\tlet ast;\n\tlet ev;\n\t\n\tstatic method use () {\n\t\tfrom std/internals import setupperprop;\n\t\tsetupperprop( 1, \"paths\", self );\n\t}\n\t\n\tmethod __build__ () {\n\t\tev := self.get_evaluator;\n\t\tconst p := new Parser( allowed_operators: ev.operator_definitions );\n\t\tast ?:= _cache\n\t\t\t? _cache.get( path, fn x \u2192 p.parse_top_level_terms(x) )\n\t\t\t: p.parse_top_level_terms(path);\n\t}\n\t\n\tmethod get_evaluator () {\n\t\treturn new Evaluator();\n\t}\n\t\n\tmethod evaluate ( raw, meta := {} ) {\n\n\t\tmeta.set( \"level\", 0 ) unless meta.defined( \"level\" );\n\t\tconst ctx := new Ctx(\n\t\t\troot: raw,\n\t\t\tnodeset: meta.get( \"nodeset\", null ),\n\t\t\tparentset: meta.get( \"parentset\", null ),\n\t\t\tmeta: meta,\n\t\t);\n\n\t\tconst short_circuit := ( meta.get( \"want\", \"all\" ) in [ \"first\", \"exists\" ] );\n\n\t\tlet results := [];\n\t\tfor ( let term in ast ) {\n\t\t\tfor ( let node in ev.eval_expr( term, ctx ) ) {\n\t\t\t\tlet next_node := ev.maybe_apply_action( node, ctx );\n\t\t\t\tresults.push(next_node);\n\t\t\t\treturn results if short_circuit;\n\t\t\t}\n\t\t}\n\n\t\treturn results;\n\t}\n\t\n\tmethod get ( raw ) {\n\t\treturn self.evaluate(raw).map( fn r \u2192 r.primitive_value );\n\t}\n\t\n\tmethod select ( raw ) {\n\t\treturn self.evaluate(raw).map( fn r \u2192 r.primitive_value );\n\t}\n\t\n\tmethod query ( raw ) {\n\t\treturn self.evaluate(raw).map( fn r \u2192 r.primitive_value );\n\t}\n\n\tmethod first ( raw, fallback? ) {\n\t\tlet got := self.evaluate( raw, { want: \"first\" } );\n\t\treturn got.empty ? fallback : got[0].primitive_value;\n\t}\n\t\n\tmethod exists ( raw ) {\n\t\tlet got := self.evaluate( raw, { want: \"exists\" } );\n\t\treturn not got.empty;\n\t}\n\n\tmethod _apply_assignment_ref ( ref, value, op := \":=\" ) {\n\t\tif ( op \u2261 \":=\" ) {\n\t\t\treturn ref(value);\n\t\t}\n\n\t\tlet current := ref();\n\n\t\tif ( op \u2261 \"+=\" ) {\n\t\t\tcurrent += value;\n\t\t}\n\t\telse if ( op \u2261 \"-=\" ) {\n\t\t\tcurrent -= value;\n\t\t}\n\t\telse if ( op \u2261 \"*=\" or op \u2261 \"\u00d7=\" ) {\n\t\t\tcurrent *= value;\n\t\t}\n\t\telse if ( op \u2261 \"/=\" or op \u2261 \"\u00f7=\" ) {\n\t\t\tcurrent /= value;\n\t\t}\n\t\telse if ( op \u2261 \"**=\" ) {\n\t\t\tcurrent **= value;\n\t\t}\n\t\telse if ( op \u2261 \"_=\" ) {\n\t\t\tcurrent _= value;\n\t\t}\n\t\telse if ( op \u2261 \"?:=\" ) {\n\t\t\tcurrent ?:= value;\n\t\t}\n\t\telse if ( op \u2261 \"~=\" ) {\n\t\t\tcurrent ~= value[0] -> value[1](m);\n\t\t}\n\t\telse {\n\t\t\tdie `Unsupported path assignment operator '${op}'`;\n\t\t}\n\n\t\tref(current);\n\t\treturn current;\n\t}\n\n\tmethod _assign_all_result ( value, op, last_result ) {\n\t\treturn op \u2261 \"~=\" ? last_result : value;\n\t}\n\n\tmethod assign_first ( raw, value, op := \":=\" ) {\n\t\tlet got := self.evaluate( raw, { want: \"first\" } );\n\t\tdie \"Path assignment (@) found no matches\" if got.empty;\n\t\treturn self._apply_assignment_ref(\n\t\t\tgot[0].ref(),\n\t\t\tvalue,\n\t\t\top,\n\t\t);\n\t}\n\n\tmethod assign_all ( raw, value, op := \":=\" ) {\n\t\tlet got := self.evaluate(raw);\n\t\tif ( got.empty ) {\n\t\t\treturn self._assign_all_result( value, op, value );\n\t\t}\n\n\t\tlet last_result := value;\n\t\tfor ( let node in got ) {\n\t\t\tlast_result := self._apply_assignment_ref(\n\t\t\t\tnode.ref(),\n\t\t\t\tvalue,\n\t\t\t\top,\n\t\t\t);\n\t\t}\n\n\t\treturn self._assign_all_result( value, op, last_result );\n\t}\n\n\tmethod assign_maybe ( raw, value, op := \":=\" ) {\n\t\tlet got := self.evaluate( raw, { want: \"first\" } );\n\t\tif ( got.empty ) {\n\t\t\treturn false;\n\t\t}\n\n\t\tself._apply_assignment_ref( got[0].ref(), value, op );\n\t\treturn true;\n\t}\n\n\tmethod ref_first ( raw ) {\n\t\tlet got := self.evaluate( raw, { want: \"first\" } );\n\t\tdie \"Path assignment (@) found no matches\" if got.empty;\n\t\treturn got[0].ref();\n\t}\n\n\tmethod ref_all ( raw ) {\n\t\treturn self.evaluate(raw).map( fn n \u2192 n.ref );\n\t}\n\n\tmethod ref_maybe ( raw ) {\n\t\tlet got := self.evaluate( raw, { want: \"first\" } );\n\t\treturn got.empty ? null : got[0].ref();\n\t}\n}\n",
		"/modules/std/path/z/context.zzm": "=encoding utf8\n\n=head1 NAME\n\nstd/path/z/context - Evaluation context used by std/path/z.\n\n=head1 DESCRIPTION\n\nThis module ports the C<Data::ZPath::_Ctx> Perl class to pure\nZuzuScript with a near line-by-line translation and matching public API.\n\n=cut\n\nfrom std/path/z/node import Node;\n\nclass Ctx {\n\tlet root := null;\n\tlet nodeset := null;\n\tlet parentset := null;\n\tlet meta := null;\n\n\tmethod __build__ () {\n\t\tif ( not ( root instanceof Node ) ) {\n\t\t\tlet root_obj := root;\n\t\t\tlet root_type := typeof root_obj;\n\t\t\tlet node_type := null;\n\n\t\t\ttry {\n\t\t\t\tnode_type := int( \"\" _ root_obj.nodeType() );\n\t\t\t}\n\t\t\tcatch {\n\t\t\t}\n\n\t\t\tif (\n\t\t\t\troot_type eq \"XMLDocument\"\n\t\t\t\tor root_type eq \"DOMDocument\"\n\t\t\t\tor node_type = 9\n\t\t\t) {\n\t\t\t\ttry {\n\t\t\t\t\tlet de := root_obj.documentElement();\n\t\t\t\t\troot_obj := de if de \u2262 null;\n\t\t\t\t}\n\t\t\t\tcatch {\n\t\t\t\t}\n\t\t\t}\n\n\t\t\troot := Node.wrap( root_obj );\n\t\t}\n\n\t\tnodeset ?:= [ root ];\n\t\tmeta ?:= { level: 0 };\n\t}\n\n\tmethod with_nodeset ( ns, ps ) {\n\t\treturn new Ctx(\n\t\t\troot: root,\n\t\t\tnodeset: ns,\n\t\t\tparentset: ps,\n\t\t\tmeta: meta,\n\t\t);\n\t}\n\n\tmethod nested ( extras? ) {\n\t\tlet extra_meta := extras ?: {};\n\n\t\tlet next_meta := {\n\t\t\tlevel: meta.get( \"level\", 0 ) + 1,\n\t\t};\n\n\t\tfor ( let pair in extra_meta.enumerate ) {\n\t\t\tnext_meta.add( pair );\n\t\t}\n\n\t\treturn new Ctx(\n\t\t\troot: root,\n\t\t\tnodeset: nodeset,\n\t\t\tparentset: parentset,\n\t\t\tmeta: next_meta,\n\t\t);\n\t}\n\n\tmethod root () { return root; }\n\tmethod nodeset () { return nodeset; }\n\tmethod parentset () { return parentset; }\n\tmethod meta () { return meta; }\n}\n",
		"/modules/std/path/z/evaluate.zzm": "=encoding utf8\n\n=head1 NAME\n\nstd/path/z/evaluate - Pure Zuzu evaluator for ZPath expressions.\n\n=head1 DESCRIPTION\n\nThis module ports C<Data::ZPath::_Evaluate> to pure ZuzuScript with a\nnear line-by-line translation and object-oriented public API.\n\n=cut\n\nfrom std/string import replace, index, substr;\nfrom std/path/z/node import Node;\nfrom std/path/z/functions import STANDARD_FUNCTIONS;\nfrom std/path/z/operators import STANDARD_OPERATORS;\n\nlet _do_dump := false;\n\nclass Evaluator {\n\tlet _operator_definitions;\n\tlet _function_definitions;\n\t\n\tlet \u03b5 := 0.000000001;\n\t\n\tmethod operator_definitions () {\n\t\t_operator_definitions ?:= STANDARD_OPERATORS;\n\t\treturn _operator_definitions;\n\t}\n\t\n\tmethod function_definitions () {\n\t\t_function_definitions ?:= STANDARD_FUNCTIONS;\n\t\treturn _function_definitions;\n\t}\n\t\n\tmethod eval_expr_wrap ( ast, ctx ) {\n\t\tfrom std/dump import Dumper;\n\t\tlet got := self._real_eval_expr ( ast, ctx );\n\t\tsay `AST ${Dumper.dump(ast)} CTX ${Dumper.dump(ctx)} \u21d2 GOT ${Dumper.dump(got)}` if _do_dump;\n\t\treturn got;\n\t}\n\t\n\tmethod eval_expr ( ast, ctx ) {\n\t\t\n\t\tswitch ( ast{t} : eq ) {\n\t\t\tcase \"num\":\n\t\t\t\treturn [ Node.wrap( ast{v} ) ];\n\t\t\tcase \"str\":\n\t\t\t\treturn [ Node.wrap( ast{v} ) ];\n\t\t\tcase \"path\":\n\t\t\t\treturn self.eval_path( ast, ctx );\n\t\t\tcase \"fn\":\n\t\t\t\treturn self.eval_fn( ast, ctx );\n\t\t\tcase \"un\":\n\t\t\t\treturn self.eval_unop( ast, ctx );\n\t\t\tcase \"bin\":\n\t\t\t\treturn self.eval_binop( ast, ctx );\n\t\t\tcase \"ternary\":\n\t\t\t\tlet c  := self.eval_expr( ast{c}, ctx );\n\t\t\t\tlet ab := self.truthy( c.get(0) ) ? \"a\" : \"b\";\n\t\t\t\treturn self.eval_expr( ast{(ab)}, ctx );\n\t\t\tdefault:\n\t\t\t\tdie \"Panic! Unknown AST node type!\";\n\t\t}\n\t}\n\n\tmethod nested_ctx ( ctx, ... PairList extras ) {\n\t\treturn null if ctx \u2261 null;\n\t\treturn ctx.nested( extras );\n\t}\n\n\tmethod eval_binop ( ast, ctx ) {\n\t\tconst op := ast{op};\n\t\tconst op_def := self.operator_definitions().first( fn x \u2192 x.get_spelling eq op );\n\t\tif ( op_def and op_def{f} ) {\n\t\t\tconst implementation := op_def{f};\n\t\t\treturn implementation( op_def, self, ast, ctx, ast{l}, ast{r} );\n\t\t}\n\t\treturn [];\n\t}\n\n\tmethod eval_unop ( ast, ctx ) {\n\t\tconst op := ast{op};\n\t\tif ( op \u2261 \"!\" ) {\n\t\t\tconst got := self.eval_expr( ast{e}, ctx );\n\t\t\tconst value := got.length() > 0 ? got[0] : null;\n\t\t\treturn [ Node.wrap( not self.truthy(value) ) ];\n\t\t}\n\t\treturn [];\n\t}\n\n\tmethod eval_path ( path_ast, ctx ) {\n\t\tlet current := [];\n\t\tfor ( let n in ctx.nodeset() ) {\n\t\t\tcurrent.push(n);\n\t\t}\n\n\t\tlet parentset := ctx.parentset();\n\n\t\tfor ( let seg in path_ast{s} ) {\n\t\t\tlet next_nodes := [];\n\n\t\t\tif ( seg{k} \u2261 \"root\" ) {\n\t\t\t\tnext_nodes := [ ctx.root() ];\n\t\t\t}\n\t\t\telse if ( seg{k} \u2261 \"dot\" ) {\n\t\t\t\tnext_nodes := current;\n\t\t\t}\n\t\t\telse if ( seg{k} \u2261 \"parent\" ) {\n\t\t\t\tfor ( let n in current ) {\n\t\t\t\t\tlet p := n.parent();\n\t\t\t\t\tif ( p \u2262 null ) {\n\t\t\t\t\t\tnext_nodes.push(p);\n\t\t\t\t\t}\n\t\t\t\t}\n\t\t\t\tnext_nodes := self.dedup_nodes(next_nodes);\n\t\t\t}\n\t\t\telse if ( seg{k} \u2261 \"ancestors\" ) {\n\t\t\t\tlet anc := [];\n\t\t\t\tfor ( let n in current ) {\n\t\t\t\t\tlet p := n.parent();\n\t\t\t\t\twhile ( p \u2262 null ) {\n\t\t\t\t\t\tanc.push(p);\n\t\t\t\t\t\tp := p.parent();\n\t\t\t\t\t}\n\t\t\t\t}\n\t\t\t\tnext_nodes := self.dedup_nodes(anc);\n\t\t\t}\n\t\t\telse if ( seg{k} \u2261 \"star\" ) {\n\t\t\t\tlet kids := [];\n\t\t\t\tfor ( let n in current ) {\n\t\t\t\t\tfor ( let child in n.children() ) {\n\t\t\t\t\t\tif ( child.type() \u2262 \"attr\" ) {\n\t\t\t\t\t\t\tkids.push(child);\n\t\t\t\t\t\t}\n\t\t\t\t\t}\n\t\t\t\t}\n\t\t\t\tnext_nodes := self.dedup_nodes(kids);\n\t\t\t}\n\t\t\telse if ( seg{k} \u2261 \"desc\" ) {\n\t\t\t\tlet acc := [];\n\t\t\t\tlet stack := [];\n\t\t\t\tfor ( let n in current ) {\n\t\t\t\t\tstack.push(n);\n\t\t\t\t}\n\n\t\t\t\twhile ( stack.length() > 0 ) {\n\t\t\t\t\tlet n := stack.shift();\n\t\t\t\t\tacc.push(n);\n\t\t\t\t\tfor ( let child in n.children() ) {\n\t\t\t\t\t\tif ( child.type() \u2262 \"attr\" ) {\n\t\t\t\t\t\t\tstack.push(child);\n\t\t\t\t\t\t}\n\t\t\t\t\t}\n\t\t\t\t}\n\t\t\t\tnext_nodes := self.dedup_nodes(acc);\n\t\t\t}\n\t\t\telse if ( seg{k} \u2261 \"index\" ) {\n\t\t\t\tlet idx := seg{i};\n\t\t\t\tlet kids := [];\n\t\t\t\tfor ( let n in current ) {\n\t\t\t\t\tlet c := n.indexed_child( idx );\n\t\t\t\t\tkids.push(c) if c \u2262 null;\n\t\t\t\t}\n\t\t\t\tnext_nodes := self.dedup_nodes(kids);\n\t\t\t}\n\t\t\telse if ( seg{k} \u2261 \"fnseg\" ) {\n\t\t\t\tlet out := [];\n\t\t\t\tfor ( let n in current ) {\n\t\t\t\t\tlet seg_ctx := ctx.with_nodeset( [ n ], current );\n\t\t\t\t\tlet fn_ast := { t: \"fn\", n: seg{n}, a: seg{a} };\n\t\t\t\t\tlet res := self.eval_fn( fn_ast, seg_ctx );\n\t\t\t\t\tfor ( let x in res ) {\n\t\t\t\t\t\tout.push(x);\n\t\t\t\t\t}\n\t\t\t\t}\n\t\t\t\tnext_nodes := out;\n\t\t\t}\n\t\t\telse if ( seg{k} \u2261 \"name\" ) {\n\t\t\t\tlet name := seg{n};\n\n\t\t\t\tif ( name ~ /^\\@/ ) {\n\t\t\t\t\tif ( name \u2261 \"@*\" ) {\n\t\t\t\t\t\tlet attrs := [];\n\t\t\t\t\t\tfor ( let n in current ) {\n\t\t\t\t\t\t\tfor ( let a in n.attributes() ) {\n\t\t\t\t\t\t\t\tattrs.push(a);\n\t\t\t\t\t\t\t}\n\t\t\t\t\t\t}\n\t\t\t\t\t\tnext_nodes := self.dedup_nodes(attrs);\n\t\t\t\t\t}\n\t\t\t\t\telse {\n\t\t\t\t\t\tlet attrs := [];\n\t\t\t\t\t\tfor ( let n in current ) {\n\t\t\t\t\t\t\tfor ( let a in n.attributes() ) {\n\t\t\t\t\t\t\t\tif ( a.name() \u2261 name ) {\n\t\t\t\t\t\t\t\t\tattrs.push(a);\n\t\t\t\t\t\t\t\t}\n\t\t\t\t\t\t\t}\n\t\t\t\t\t\t}\n\t\t\t\t\t\tnext_nodes := self.dedup_nodes(attrs);\n\t\t\t\t\t}\n\t\t\t\t}\n\t\t\t\telse {\n\t\t\t\t\tlet kids := [];\n\t\t\t\t\tfor ( let n in current ) {\n\t\t\t\t\t\tif ( n.can_have_named_indexed_children() ) {\n\t\t\t\t\t\t\tlet idx := 0;\n\t\t\t\t\t\t\twhile ( true ) {\n\t\t\t\t\t\t\t\tlet c := n.named_indexed_child( name, idx );\n\t\t\t\t\t\t\t\tlast if c \u2261 null;\n\t\t\t\t\t\t\t\tkids.push(c);\n\t\t\t\t\t\t\t\tidx++;\n\t\t\t\t\t\t\t}\n\t\t\t\t\t\t}\n\t\t\t\t\t\telse {\n\t\t\t\t\t\t\tlet c := n.named_child( name );\n\t\t\t\t\t\t\tkids.push(c) if c \u2262 null;\n\t\t\t\t\t\t}\n\t\t\t\t\t}\n\t\t\t\t\tnext_nodes := self.dedup_nodes(kids);\n\t\t\t\t}\n\n\t\t\t\tif ( seg.exists(\"i\") and seg{i} \u2262 null ) {\n\t\t\t\t\tlet idx := seg{i};\n\t\t\t\t\tlet picked := [];\n\t\t\t\t\tfor ( let n in current ) {\n\t\t\t\t\t\tlet c := n.named_indexed_child( name, idx );\n\t\t\t\t\t\tpicked.push(c) if c \u2262 null;\n\t\t\t\t\t}\n\t\t\t\t\tnext_nodes := self.dedup_nodes(picked);\n\t\t\t\t}\n\t\t\t}\n\t\t\telse {\n\t\t\t\tdie \"Unknown path segment kind: \" _ seg{k};\n\t\t\t}\n\n\t\t\tif ( seg.exists(\"q\") and seg{q}.length() > 0 ) {\n\t\t\t\tfor ( let q in seg{q} ) {\n\t\t\t\t\tif ( q.exists(\"t\") and q{t} \u2261 \"num\" and q{v} ~ /^\\d+$/ ) {\n\t\t\t\t\t\tlet idx := 0 + q{v};\n\n\t\t\t\t\t\tif ( next_nodes.length() > 0 and self._node_is_xml(next_nodes[0]) ) {\n\t\t\t\t\t\t\tnext_nodes := ( idx \u2265 0 and idx < next_nodes.length() ) ? [ next_nodes[idx] ] : [];\n\t\t\t\t\t\t}\n\t\t\t\t\t\telse {\n\t\t\t\t\t\t\tlet picked := [];\n\t\t\t\t\t\t\tfor ( let node in next_nodes ) {\n\t\t\t\t\t\t\t\tlet ch := node.children().grep( fn c \u2192 c.type() \u2262 \"attr\" );\n\t\t\t\t\t\t\t\tif ( idx \u2265 0 and idx < ch.length() ) {\n\t\t\t\t\t\t\t\t\tpicked.push( ch[idx] );\n\t\t\t\t\t\t\t\t}\n\t\t\t\t\t\t\t}\n\t\t\t\t\t\t\tnext_nodes := picked;\n\t\t\t\t\t\t}\n\n\t\t\t\t\t\tnext;\n\t\t\t\t\t}\n\n\t\t\t\t\tlet filtered := [];\n\t\t\t\t\tlet i := 0;\n\t\t\t\t\twhile ( i < next_nodes.length() ) {\n\t\t\t\t\t\tlet node := next_nodes[i];\n\t\t\t\t\t\tlet ns_ctx := ctx.with_nodeset( next_nodes, current );\n\t\t\t\t\t\tlet filter_ctx := ns_ctx.with_nodeset( [ node ], next_nodes );\n\t\t\t\t\t\tlet r := self.eval_expr( q, self.nested_ctx( filter_ctx, want: \"exists\" ) );\n\n\t\t\t\t\t\tlet ok := false;\n\t\t\t\t\t\tif ( q.exists(\"t\") and q{t} \u2261 \"path\" ) {\n\t\t\t\t\t\t\tok := r.length() > 0;\n\t\t\t\t\t\t}\n\t\t\t\t\t\telse {\n\t\t\t\t\t\t\tok := self.truthy( r.length() > 0 ? r[0] : null );\n\t\t\t\t\t\t}\n\n\t\t\t\t\t\tif ( ok ) {\n\t\t\t\t\t\t\tfiltered.push(node);\n\t\t\t\t\t\t}\n\t\t\t\t\t\ti++;\n\t\t\t\t\t}\n\t\t\t\t\tnext_nodes := filtered;\n\t\t\t\t}\n\t\t\t}\n\n\t\t\tparentset := current;\n\t\t\tcurrent := next_nodes;\n\t\t}\n\n\t\treturn current;\n\t}\n\n\tmethod maybe_apply_action ( node, ctx ) {\n\t\tconst meta := ctx.meta();\n\t\treturn node if not meta.exists( \"action\" );\n\t\tconst action := meta{action};\n\t\treturn node if action \u2261 null;\n\t\treturn node if not action.exists( \"op\" );\n\t\tnode.do_action(action);\n\t\treturn node;\n\t}\n\n\tmethod eval_fn ( fn_ast, ctx ) {\n\t\tconst name := fn_ast{n};\n\t\tconst fn_def := self.function_definitions().first( fn f \u2192 f.has_name(name) );\n\t\treturn fn_def{f}( fn_def, self, fn_ast, ctx, fn_ast{a} ?: [] ) if fn_def;\n\t\treturn [];\n\t}\n\n\tmethod string_replace ( string, pattern, replacement ) {\n\t\tlet text := string \u2261 null ? \"\" : \"\" _ string;\n\t\tlet rep := replacement \u2261 null ? \"\" : \"\" _ replacement;\n\n\t\ttry {\n\t\t\treturn replace( text, pattern, rep, \"g\" );\n\t\t}\n\t\tcatch {\n\t\t\treturn replace( text, \"\" _ pattern, rep, \"g\" );\n\t\t}\n\t}\n\n\tmethod dedup_nodes ( nodes ) {\n\t\tlet seen := {};\n\t\tlet out := [];\n\t\tfor ( let n in nodes ) {\n\t\t\tlet key := n.id ?: ( \"anon:\" _ out.length() _ \":\" _ ( \"\" _ n.raw() ) );\n\t\t\tif ( not seen.exists(key) ) {\n\t\t\t\tseen.set( key, true );\n\t\t\t\tout.push(n);\n\t\t\t}\n\t\t}\n\t\treturn out;\n\t}\n\n\tmethod truthy ( n ) {\n\t\treturn false if n \u2261 null;\n\t\tlet pv := n.primitive_value();\n\t\treturn pv ? true : false;\n\t}\n\n\tmethod to_number ( n ) {\n\t\treturn null if n \u2261 null;\n\t\treturn n.number_value();\n\t}\n\n\tmethod to_string ( n ) {\n\t\treturn null if n \u2261 null;\n\t\treturn n.string_value();\n\t}\n\n\tmethod equals ( a, b ) {\n\t\treturn false if a \u2261 null or b \u2261 null;\n\n\t\tlet a_type := a.type();\n\t\tlet b_type := b.type();\n\n\t\tif ( b_type eq \"null\" ) {\n\t\t\treturn a_type eq \"null\";\n\t\t}\n\t\tif ( a_type eq \"null\" ) {\n\t\t\treturn b_type eq \"null\";\n\t\t}\n\n\t\tif ( a_type eq \"boolean\" and b_type eq \"boolean\" ) {\n\t\t\tlet av := a.primitive_value() ? true : false;\n\t\t\tlet bv := b.primitive_value() ? true : false;\n\t\t\treturn av \u2261 bv;\n\t\t}\n\n\t\tif ( a_type \u2261 \"number\" and b_type \u2261 \"number\" ) {\n\t\t\tlet av := a.number_value();\n\t\t\tlet bv := b.number_value();\n\t\t\treturn false if av \u2261 null or bv \u2261 null;\n\n\t\t\tif ( ( \"\" _ av ) ~ /\\./ or ( \"\" _ bv ) ~ /\\./ ) {\n\t\t\t\treturn abs( av - bv ) < \u03b5;\n\t\t\t}\n\n\t\t\treturn av = bv;\n\t\t}\n\n\t\tlet string_like := [ \"string\", \"text\", \"attr\", \"comment\", \"element\" ];\n\t\tif ( a_type in string_like and b_type in string_like ) {\n\t\t\tlet av := a.string_value();\n\t\t\tlet bv := b.string_value();\n\t\t\treturn av eq bv;\n\t\t}\n\n\t\tlet aid := a.id();\n\t\tlet bid := b.id();\n\t\treturn false if aid \u2261 null or bid \u2261 null;\n\t\treturn aid eq bid;\n\t}\n\n\tmethod _node_is_xml ( n ) {\n\t\tif ( n \u2261 null ) {\n\t\t\treturn false;\n\t\t}\n\t\tlet raw := n.raw();\n\t\ttry {\n\t\t\tlet node_type := raw.nodeType();\n\t\t\treturn node_type \u2262 null;\n\t\t}\n\t\tcatch {\n\t\t\treturn false;\n\t\t}\n\t}\n}\n",
		"/modules/std/path/z/functions.zzm": "from std/path/z/node import Node;\nfrom std/path/z/operators import EvalHelpers;\nfrom std/data/xml/escape import escape_xml, unescape_xml;\nfrom std/string import index, rindex, search, sprint, substr, join;\nfrom std/math import Math;\n\nclass Func with EvalHelpers {\n\tlet String spelling with get;\n\tlet Function f;\n\t\n\tmethod has_name ( n ) {\n\t\treturn true if self.get_spelling eq n;\n\t\treturn false;\n\t}\n}\n\nfunction replace ( haystack, needle, replacement ) {\n\tlet copy := haystack;\n\t\n\tif ( replacement ~ /\\$[0-9]/ ) {\n\t\tlet r := replacement;\n\t\tcopy ~= needle \u2192 do {\n\t\t\tlet matches := m;\n\t\t\tr ~= /\\$([0-9]+)/g \u2192 matches[ m[1] ];\n\t\t\tr;\n\t\t};\n\t}\n\telse {\n\t\tcopy ~= needle \u2192 replacement;\n\t}\n\t\n\treturn copy;\n}\n\nfunction mk_single_number_function ( String name, Function impl ) {\n\treturn function ( funk, ev, ast, ctx, args ) {\n\t\tlet nodes := [];\n\t\tfor ( let a in args ) {\n\t\t\tconst got := ev.eval_expr( a, ev.nested_ctx( ctx ) );\n\t\t\tfor ( let n in got ) {\n\t\t\t\tnodes.push( n );\n\t\t\t}\n\t\t}\n\t\telse {\n\t\t\tnodes := ctx.nodeset;\n\t\t}\n\t\treturn nodes\n\t\t\t.map( fn x \u2192 x.number_value )\n\t\t\t.grep( fn x \u2192 typeof x eq \"Number\" )\n\t\t\t.map( fn x \u2192 funk.wrap_for_array( impl(x) ) );\n\t};\n}\n\nfunction mk_aggregate_number_function ( String name, Function impl ) {\n\treturn function ( funk, ev, ast, ctx, args ) {\n\t\tlet nodes := [];\n\t\tfor ( let a in args ) {\n\t\t\tconst got := ev.eval_expr( a, ev.nested_ctx( ctx ) );\n\t\t\tfor ( let n in got ) {\n\t\t\t\tnodes.push( n );\n\t\t\t}\n\t\t}\n\t\telse {\n\t\t\tnodes := ctx.nodeset;\n\t\t}\n\t\tconst nums := nodes\n\t\t\t.map( fn x \u2192 x.number_value )\n\t\t\t.grep( fn x \u2192 typeof x eq \"Number\" );\n\t\treturn funk.wrap( impl( nums ) );\n\t};\n}\n\nfunction mk_single_string_function ( String name, Function impl ) {\n\treturn function ( funk, ev, ast, ctx, args ) {\n\t\tlet nodes := [];\n\t\tfor ( let a in args ) {\n\t\t\tconst got := ev.eval_expr( a, ev.nested_ctx( ctx ) );\n\t\t\tfor ( let n in got ) {\n\t\t\t\tnodes.push( n );\n\t\t\t}\n\t\t}\n\t\telse {\n\t\t\tnodes := ctx.nodeset;\n\t\t}\n\t\treturn nodes\n\t\t\t.map( fn x \u2192 x.string_value )\n\t\t\t.grep( fn x \u2192 typeof x eq \"String\" )\n\t\t\t.map( fn x \u2192 funk.wrap_for_array( impl(x) ) );\n\t};\n}\n\nfunction mk_match_function () {\n\treturn function ( funk, ev, ast, ctx, args ) {\n\t\tlet nodes := [];\n\t\tlet re;\n\t\t\n\t\tif ( args.empty ) {\n\t\t\tdie \"Not enough arguments for match()\";\n\t\t}\n\t\telse {\n\t\t\tre := try {\n\t\t\t\tev.eval_expr( args[0], ev.nested_ctx( ctx ) )[0].string_value;\n\t\t\t} catch {\n\t\t\t\t\"\";\n\t\t\t};\n\t\t}\n\t\t\n\t\tfor ( let a in args[1:] ) {\n\t\t\tconst got := ev.eval_expr( a, ev.nested_ctx( ctx ) );\n\t\t\tfor ( let n in got ) {\n\t\t\t\tnodes.push( n );\n\t\t\t}\n\t\t}\n\t\telse {\n\t\t\tnodes := ctx.nodeset;\n\t\t}\n\t\t\n\t\treturn nodes\n\t\t\t.map( fn x \u2192 x.string_value )\n\t\t\t.grep( fn x \u2192 typeof x eq \"String\" )\n\t\t\t.map( fn x \u2192 funk.wrap_for_array( ( x ~ re ) ? true : false ) );\n\t}\n}\n\nconst STANDARD_FUNCTIONS := [\n\tnew Func(\n\t\tspelling: \"true\",\n\t\tf: function ( funk, ev, ast, ctx, args ) {\n\t\t\tdie \"Too many arguments for true()\" unless args.empty;\n\t\t\treturn funk.wrap( true );\n\t\t},\n\t),\n\t\n\tnew Func(\n\t\tspelling: \"false\",\n\t\tf: function ( funk, ev, ast, ctx, args ) {\n\t\t\tdie \"Too many arguments for false()\" unless args.empty;\n\t\t\treturn funk.wrap( false );\n\t\t},\n\t),\n\t\n\tnew Func(\n\t\tspelling: \"null\",\n\t\tf: function ( funk, ev, ast, ctx, args ) {\n\t\t\tdie \"Too many arguments for null()\" unless args.empty;\n\t\t\treturn funk.wrap( null );\n\t\t},\n\t),\n\t\n\tnew Func(\n\t\tspelling: \"die\",\n\t\tf: function ( funk, ev, ast, ctx, args ) {\n\t\t\tdie \"Called 'die' function in zpath\";\n\t\t},\n\t),\n\t\n\tnew Func(\n\t\tspelling: \"count\",\n\t\tf: function ( funk, ev, ast, ctx, args ) {\n\t\t\tlet n := 0;\n\t\t\tfor ( let a in args ) {\n\t\t\t\tconst got := ev.eval_expr( a, ev.nested_ctx( ctx ) );\n\t\t\t\tn += got.length;\n\t\t\t}\n\t\t\telse {\n\t\t\t\tconst cur := ctx.parentset ?: ctx.nodeset;\n\t\t\t\tn := cur.length;\n\t\t\t}\n\t\t\treturn funk.wrap( n );\n\t\t},\n\t),\n\n\tnew Func(\n\t\tspelling: \"index\",\n\t\tf: function ( funk, ev, ast, ctx, args ) {\n\t\t\tif ( args.length = 0 ) {\n\t\t\t\tconst cur := ctx.nodeset.get( 0, null );\n\t\t\t\treturn funk.wrap( cur ? cur.ix : null );\n\t\t\t}\n\t\t\telse if ( args.length = 1 ) {\n\t\t\t\tconst got := ev.eval_expr( args[0], ev.nested_ctx( ctx ) );\n\t\t\t\treturn got.map( fn x \u2192 funk.wrap_for_array(x.ix) );\n\t\t\t}\n\t\t\tdie \"Too many arguments for index()\";\n\t\t},\n\t),\n\t\n\tnew Func(\n\t\tspelling: \"key\",\n\t\tf: function ( funk, ev, ast, ctx, args ) {\n\t\t\tif ( args.length = 0 ) {\n\t\t\t\tconst cur := ctx.nodeset.get( 0, null );\n\t\t\t\treturn funk.wrap( cur ? cur.key : null );\n\t\t\t}\n\t\t\telse if ( args.length = 1 ) {\n\t\t\t\tconst got := ev.eval_expr( args[0], ev.nested_ctx( ctx ) );\n\t\t\t\treturn got.map(\n\t\t\t\t\tfn x \u2192 funk.wrap_for_array(\n\t\t\t\t\t\tx \u2261 null ? null : x.key\n\t\t\t\t\t)\n\t\t\t\t);\n\t\t\t}\n\t\t\tdie \"Too many arguments for key()\";\n\t\t},\n\t),\n\n\tnew Func(\n\t\tspelling: \"type\",\n\t\tf: function ( funk, ev, ast, ctx, args ) {\n\t\t\tif ( args.length = 0 ) {\n\t\t\t\tconst cur := ctx.nodeset.get( 0, null );\n\t\t\t\treturn funk.wrap( cur ? cur.type : \"undefined\" );\n\t\t\t}\n\t\t\telse if ( args.length = 1 ) {\n\t\t\t\tconst got := ev.eval_expr( args[0], ev.nested_ctx( ctx ) ).get( 0, null );\n\t\t\t\treturn funk.wrap( got ? got.type : \"undefined\" );\n\t\t\t}\n\t\t\tdie \"Too many arguments for type()\";\n\t\t},\n\t),\n\t\n\tnew Func(\n\t\tspelling: \"union\",\n\t\tf: function ( funk, ev, ast, ctx, args ) {\n\t\t\tlet out := [];\n\t\t\tfor ( let arg in args ) {\n\t\t\t\tconst got := ev.eval_expr( arg, ev.nested_ctx( ctx ) );\n\t\t\t\tfor ( let n in got ) {\n\t\t\t\t\tout.push( n );\n\t\t\t\t}\n\t\t\t}\n\t\t\treturn ev.dedup_nodes( out );\n\t\t},\n\t),\n\t\n\tnew Func(\n\t\tspelling: \"intersection\",\n\t\tf: function ( funk, ev, ast, ctx, args ) {\n\t\t\treturn [] if args.empty;\n\n\t\t\tlet out := ev.eval_expr( args[0], ev.nested_ctx( ctx ) );\n\t\t\tout := ev.dedup_nodes( out );\n\n\t\t\tlet i := 1;\n\t\t\twhile ( i < args.length() ) {\n\t\t\t\tlet got := ev.eval_expr( args[i], ev.nested_ctx( ctx ) );\n\t\t\t\tgot := ev.dedup_nodes( got );\n\n\t\t\t\tlet seen := {};\n\t\t\t\tfor ( let n in got ) {\n\t\t\t\t\tlet key := n.id();\n\t\t\t\t\tif ( key \u2261 null ) {\n\t\t\t\t\t\tkey := \"anon:\" _ ( \"\" _ n.raw() );\n\t\t\t\t\t}\n\t\t\t\t\tseen.set( key, true );\n\t\t\t\t}\n\n\t\t\t\tlet next_out := [];\n\t\t\t\tfor ( let n in out ) {\n\t\t\t\t\tlet key := n.id();\n\t\t\t\t\tif ( key \u2261 null ) {\n\t\t\t\t\t\tkey := \"anon:\" _ ( \"\" _ n.raw() );\n\t\t\t\t\t}\n\t\t\t\t\tif ( seen.exists(key) ) {\n\t\t\t\t\t\tnext_out.push(n);\n\t\t\t\t\t}\n\t\t\t\t}\n\n\t\t\t\tout := next_out;\n\t\t\t\tlast if out.empty;\n\t\t\t\ti++;\n\t\t\t}\n\n\t\t\treturn ev.dedup_nodes( out );\n\t\t},\n\t),\n\t\n\tnew Func(\n\t\tspelling: \"is-first\",\n\t\tf: function ( funk, ev, ast, ctx, args ) {\n\t\t\tif ( args.length = 0 ) {\n\t\t\t\tconst cur := ctx.nodeset.get( 0, null );\n\t\t\t\treturn [] unless cur and cur.parent;\n\t\t\t\treturn funk.wrap( cur.ix = 0 );\n\t\t\t}\n\t\t\tdie \"Too many arguments for is-first()\";\n\t\t},\n\t),\n\n\tnew Func(\n\t\tspelling: \"is-last\",\n\t\tf: function ( funk, ev, ast, ctx, args ) {\n\t\t\tif ( args.length = 0 ) {\n\t\t\t\tconst cur := ctx.nodeset.get( 0, null );\n\t\t\t\treturn [] unless cur and cur.parent and cur.ix \u2262 null;\n\t\t\t\tconst siblings := cur.parent.children\n\t\t\t\t\t.grep( fn kid \u2192 kid.key \u2261 cur.key );\n\t\t\t\treturn [] if siblings.empty;\n\t\t\t\tlet pos := 0;\n\t\t\t\twhile ( pos < siblings.length ) {\n\t\t\t\t\tconst kid := siblings[pos];\n\t\t\t\t\tlast if kid.id() \u2261 cur.id();\n\t\t\t\t\tpos++;\n\t\t\t\t}\n\t\t\t\treturn [] if pos \u2265 siblings.length;\n\t\t\t\treturn funk.wrap( pos = siblings.length - 1 );\n\t\t\t}\n\t\t\tdie \"Too many arguments for is-last()\";\n\t\t},\n\t),\n\t\n\tnew Func(\n\t\tspelling: \"next\",\n\t\tf: function ( funk, ev, ast, ctx, args ) {\n\t\t\tif ( args.length = 0 ) {\n\t\t\t\tconst cur := ctx.nodeset.get( 0, null );\n\t\t\t\treturn [ cur.next_sibling ];\n\t\t\t}\n\t\t\telse {\n\t\t\t\tlet out := [];\n\t\t\t\tfor ( let arg in args ) {\n\t\t\t\t\tconst got := ev.eval_expr( arg, ev.nested_ctx( ctx ) );\n\t\t\t\t\tfor ( let n in got ) {\n\t\t\t\t\t\tout.push( n.next_sibling );\n\t\t\t\t\t}\n\t\t\t\t}\n\t\t\t\treturn out;\n\t\t\t}\n\t\t},\n\t),\n\t\n\tnew Func(\n\t\tspelling: \"prev\",\n\t\tf: function ( funk, ev, ast, ctx, args ) {\n\t\t\tif ( args.length = 0 ) {\n\t\t\t\tconst cur := ctx.nodeset.get( 0, null );\n\t\t\t\treturn [ cur.prev_sibling ];\n\t\t\t}\n\t\t\telse {\n\t\t\t\tlet out := [];\n\t\t\t\tfor ( let arg in args ) {\n\t\t\t\t\tconst got := ev.eval_expr( arg, ev.nested_ctx( ctx ) );\n\t\t\t\t\tfor ( let n in got ) {\n\t\t\t\t\t\tout.push( n.prev_sibling );\n\t\t\t\t\t}\n\t\t\t\t}\n\t\t\t\treturn out;\n\t\t\t}\n\t\t},\n\t),\n\t\n\tnew Func(\n\t\tspelling: \"string\",\n\t\tf: function ( funk, ev, ast, ctx, args ) {\n\t\t\tif ( args.length = 0 ) {\n\t\t\t\tconst cur := ctx.nodeset.get( 0, null );\n\t\t\t\treturn [] unless cur;\n\t\t\t\treturn funk.wrap( cur.string_value );\n\t\t\t}\n\t\t\telse {\n\t\t\t\tlet out := [];\n\t\t\t\tfor ( let arg in args ) {\n\t\t\t\t\tconst got := ev.eval_expr( arg, ev.nested_ctx( ctx ) );\n\t\t\t\t\tfor ( let n in got ) {\n\t\t\t\t\t\tout.push( n );\n\t\t\t\t\t}\n\t\t\t\t}\n\t\t\t\treturn out.map( fn x \u2192 funk.wrap_for_array( x.string_value ) );\n\t\t\t}\n\t\t},\n\t),\n\n\tnew Func(\n\t\tspelling: \"number\",\n\t\tf: function ( funk, ev, ast, ctx, args ) {\n\t\t\tif ( args.length = 0 ) {\n\t\t\t\tconst cur := ctx.nodeset.get( 0, null );\n\t\t\t\treturn [] unless cur;\n\t\t\t\treturn funk.wrap( cur.number_value );\n\t\t\t}\n\t\t\telse {\n\t\t\t\tlet out := [];\n\t\t\t\tfor ( let arg in args ) {\n\t\t\t\t\tconst got := ev.eval_expr( arg, ev.nested_ctx( ctx ) );\n\t\t\t\t\tfor ( let n in got ) {\n\t\t\t\t\t\tout.push( n );\n\t\t\t\t\t}\n\t\t\t\t}\n\t\t\t\treturn out.map( fn x \u2192 funk.wrap_for_array( x.number_value ) );\n\t\t\t}\n\t\t},\n\t),\n\n\tnew Func(\n\t\tspelling: \"value\",\n\t\tf: function ( funk, ev, ast, ctx, args ) {\n\t\t\tif ( args.length = 0 ) {\n\t\t\t\tconst cur := ctx.nodeset.get( 0, null );\n\t\t\t\treturn [] unless cur;\n\t\t\t\treturn funk.wrap( cur.primitive_value );\n\t\t\t}\n\t\t\telse {\n\t\t\t\tlet out := [];\n\t\t\t\tfor ( let arg in args ) {\n\t\t\t\t\tconst got := ev.eval_expr( arg, ev.nested_ctx( ctx ) );\n\t\t\t\t\tfor ( let n in got ) {\n\t\t\t\t\t\tout.push( n );\n\t\t\t\t\t}\n\t\t\t\t}\n\t\t\t\treturn out.map( fn x \u2192 funk.wrap_for_array( x.primitive_value ) );\n\t\t\t}\n\t\t},\n\t),\n\n\tnew Func(\n\t\tspelling: \"ceil\",\n\t\tf: mk_single_number_function( \"ceil\", fn n \u2192 ceil n ),\n\t),\n\n\tnew Func(\n\t\tspelling: \"floor\",\n\t\tf: mk_single_number_function( \"floor\", fn n \u2192 floor n ),\n\t),\n\n\tnew Func(\n\t\tspelling: \"round\",\n\t\tf: mk_single_number_function( \"round\", fn n \u2192 round n ),\n\t),\n\n\tnew Func(\n\t\tspelling: \"sum\",\n\t\tf: mk_aggregate_number_function( \"sum\", fn nums \u2192 Math.sum(nums) ),\n\t),\n\n\tnew Func(\n\t\tspelling: \"min\",\n\t\tf: mk_aggregate_number_function( \"min\", fn nums \u2192 Math.min(nums) ),\n\t),\n\n\tnew Func(\n\t\tspelling: \"max\",\n\t\tf: mk_aggregate_number_function( \"max\", fn nums \u2192 Math.max(nums) ),\n\t),\n\n\tnew Func(\n\t\tspelling: \"escape\",\n\t\tf: mk_single_string_function( \"escape\", fn s \u2192 escape_xml(s) ),\n\t),\n\n\tnew Func(\n\t\tspelling: \"unescape\",\n\t\tf: mk_single_string_function( \"unescape\", fn s \u2192 unescape_xml(s) ),\n\t),\n\n\tnew Func(\n\t\tspelling: \"upper-case\",\n\t\tf: mk_single_string_function( \"upper-case\", fn s \u2192 uc s ),\n\t),\n\n\tnew Func(\n\t\tspelling: \"lower-case\",\n\t\tf: mk_single_string_function( \"lower-case\", fn s \u2192 lc s ),\n\t),\n\n\tnew Func(\n\t\tspelling: \"index-of\",\n\t\tf: function ( funk, ev, ast, ctx, args ) {\n\t\t\tlet nodes := [];\n\t\t\tlet search;\n\t\t\t\n\t\t\tif ( args.empty ) {\n\t\t\t\tdie \"Not enough arguments for index-of()\";\n\t\t\t}\n\t\t\telse {\n\t\t\t\tsearch := try {\n\t\t\t\t\tev.eval_expr( args[0], ev.nested_ctx( ctx ) )[0].string_value;\n\t\t\t\t} catch {\n\t\t\t\t\t\"\";\n\t\t\t\t};\n\t\t\t}\n\t\t\t\n\t\t\tfor ( let a in args[1:] ) {\n\t\t\t\tconst got := ev.eval_expr( a, ev.nested_ctx( ctx ) );\n\t\t\t\tfor ( let n in got ) {\n\t\t\t\t\tnodes.push( n );\n\t\t\t\t}\n\t\t\t}\n\t\t\telse {\n\t\t\t\tnodes := ctx.nodeset;\n\t\t\t}\n\t\t\t\n\t\t\treturn nodes\n\t\t\t\t.map( fn x \u2192 x.string_value )\n\t\t\t\t.grep( fn x \u2192 typeof x eq \"String\" )\n\t\t\t\t.map( fn x \u2192 funk.wrap_for_array( index(x, search) ) );\n\t\t}\n\t),\n\n\tnew Func(\n\t\tspelling: \"last-index-of\",\n\t\tf: function ( funk, ev, ast, ctx, args ) {\n\t\t\tlet nodes := [];\n\t\t\tlet search;\n\t\t\t\n\t\t\tif ( args.empty ) {\n\t\t\t\tdie \"Not enough arguments for last-index-of()\";\n\t\t\t}\n\t\t\telse {\n\t\t\t\tsearch := try {\n\t\t\t\t\tev.eval_expr( args[0], ev.nested_ctx( ctx ) )[0].string_value;\n\t\t\t\t} catch {\n\t\t\t\t\t\"\";\n\t\t\t\t};\n\t\t\t}\n\t\t\t\n\t\t\tfor ( let a in args[1:] ) {\n\t\t\t\tconst got := ev.eval_expr( a, ev.nested_ctx( ctx ) );\n\t\t\t\tfor ( let n in got ) {\n\t\t\t\t\tnodes.push( n );\n\t\t\t\t}\n\t\t\t}\n\t\t\telse {\n\t\t\t\tnodes := ctx.nodeset;\n\t\t\t}\n\t\t\t\n\t\t\treturn nodes\n\t\t\t\t.map( fn x \u2192 x.string_value )\n\t\t\t\t.grep( fn x \u2192 typeof x eq \"String\" )\n\t\t\t\t.map( fn x \u2192 funk.wrap_for_array( rindex(x, search) ) );\n\t\t}\n\t),\n\n\tnew Func(\n\t\tspelling: \"substring\",\n\t\tf: function ( funk, ev, ast, ctx, args ) {\n\n\t\t\tlet nodes := [];\n\t\t\tlet start;\n\t\t\tlet len;\n\t\t\t\n\t\t\tif ( args.length < 2 ) {\n\t\t\t\tdie \"Not enough arguments for substring()\";\n\t\t\t}\n\t\t\telse {\n\t\t\t\tstart := try {\n\t\t\t\t\tev.eval_expr( args[-2], ev.nested_ctx( ctx ) )[0].number_value;\n\t\t\t\t} catch {\n\t\t\t\t\t0;\n\t\t\t\t};\n\t\t\t\tlen := try {\n\t\t\t\t\tev.eval_expr( args[-1], ev.nested_ctx( ctx ) )[0].number_value;\n\t\t\t\t} catch {\n\t\t\t\t\t0;\n\t\t\t\t};\n\t\t\t}\n\t\t\t\n\t\t\tfor ( let a in args[0:-2] ) {\n\t\t\t\tconst got := ev.eval_expr( a, ev.nested_ctx( ctx ) );\n\t\t\t\tfor ( let n in got ) {\n\t\t\t\t\tnodes.push( n );\n\t\t\t\t}\n\t\t\t}\n\t\t\telse {\n\t\t\t\tnodes := ctx.nodeset;\n\t\t\t}\n\t\t\t\n\t\t\treturn nodes\n\t\t\t\t.map( fn x \u2192 x.string_value )\n\t\t\t\t.grep( fn x \u2192 typeof x eq \"String\" )\n\t\t\t\t.map( fn x \u2192 funk.wrap_for_array( substr(x, start, len) ) );\n\t\t}\n\t),\n\n\tnew Func(\n\t\tspelling: \"format\",\n\t\tf: function ( funk, ev, ast, ctx, args ) {\n\t\t\tlet nodes := [];\n\t\t\tlet fmt;\n\t\t\t\n\t\t\tif ( args.empty ) {\n\t\t\t\tdie \"Not enough arguments for format()\";\n\t\t\t}\n\t\t\telse {\n\t\t\t\tfmt := try {\n\t\t\t\t\tev.eval_expr( args[0], ev.nested_ctx( ctx ) )[0].string_value;\n\t\t\t\t} catch {\n\t\t\t\t\t\"\";\n\t\t\t\t};\n\t\t\t}\n\t\t\t\n\t\t\tfor ( let a in args[1:] ) {\n\t\t\t\tconst got := ev.eval_expr( a, ev.nested_ctx( ctx ) );\n\t\t\t\tfor ( let n in got ) {\n\t\t\t\t\tnodes.push( n );\n\t\t\t\t}\n\t\t\t}\n\t\t\telse {\n\t\t\t\tnodes := ctx.nodeset;\n\t\t\t}\n\t\t\t\n\t\t\treturn nodes\n\t\t\t\t.map( fn x \u2192 x.string_value )\n\t\t\t\t.grep( fn x \u2192 typeof x eq \"String\" )\n\t\t\t\t.map( fn x \u2192 funk.wrap_for_array( sprint(fmt, x) ) );\n\t\t}\n\t),\n\n\tnew Func(\n\t\tspelling: \"string-length\",\n\t\tf: mk_single_string_function( \"string-length\", fn s \u2192 length s ),\n\t),\n\n\tnew Func(\n\t\tspelling: \"match\",\n\t\tf: mk_match_function(),\n\t),\n\n\tnew Func(\n\t\tspelling: \"matches\",\n\t\tf: mk_match_function(),\n\t),\n\n\tnew Func(\n\t\tspelling: \"replace\",\n\t\tf: function ( funk, ev, ast, ctx, args ) {\n\t\t\tlet nodes := [];\n\t\t\tlet pattern;\n\t\t\tlet replacement;\n\t\t\t\n\t\t\tif ( args.length < 2 ) {\n\t\t\t\tdie \"Not enough arguments for replace()\";\n\t\t\t}\n\t\t\telse {\n\t\t\t\tpattern := try {\n\t\t\t\t\tev.eval_expr( args[0], ev.nested_ctx( ctx ) )[0].string_value;\n\t\t\t\t} catch {\n\t\t\t\t\t\"\";\n\t\t\t\t};\n\t\t\t\treplacement := try {\n\t\t\t\t\tev.eval_expr( args[1], ev.nested_ctx( ctx ) )[0].string_value;\n\t\t\t\t} catch {\n\t\t\t\t\t\"\";\n\t\t\t\t};\n\t\t\t}\n\t\t\t\n\t\t\tfor ( let a in args[2:] ) {\n\t\t\t\tconst got := ev.eval_expr( a, ev.nested_ctx( ctx ) );\n\t\t\t\tfor ( let n in got ) {\n\t\t\t\t\tnodes.push( n );\n\t\t\t\t}\n\t\t\t}\n\t\t\telse {\n\t\t\t\tnodes := ctx.nodeset;\n\t\t\t}\n\t\t\t\n\t\t\treturn nodes\n\t\t\t\t.map( fn x \u2192 x.string_value )\n\t\t\t\t.grep( fn x \u2192 typeof x eq \"String\" )\n\t\t\t\t.map( fn x \u2192 funk.wrap_for_array( replace( x, pattern, replacement ) ) );\n\t\t}\n\t),\n\n\tnew Func(\n\t\tspelling: \"join\",\n\t\tf: function ( funk, ev, ast, ctx, args ) {\n\t\t\tlet nodes := [];\n\t\t\tlet joiner;\n\t\t\t\n\t\t\tif ( args.empty ) {\n\t\t\t\tdie \"Not enough arguments for format()\";\n\t\t\t}\n\t\t\telse {\n\t\t\t\tjoiner := try {\n\t\t\t\t\tev.eval_expr( args[0], ev.nested_ctx( ctx ) )[0].string_value;\n\t\t\t\t} catch {\n\t\t\t\t\t\"\";\n\t\t\t\t};\n\t\t\t}\n\t\t\t\n\t\t\tfor ( let a in args[1:] ) {\n\t\t\t\tconst got := ev.eval_expr( a, ev.nested_ctx( ctx ) );\n\t\t\t\tfor ( let n in got ) {\n\t\t\t\t\tnodes.push( n );\n\t\t\t\t}\n\t\t\t}\n\t\t\telse {\n\t\t\t\tnodes := ctx.nodeset;\n\t\t\t}\n\t\t\t\n\t\t\tconst strings := nodes\n\t\t\t\t.map( fn x \u2192 x.string_value )\n\t\t\t\t.grep( fn x \u2192 typeof x eq \"String\" );\n\t\t\treturn funk.wrap( join( joiner, strings ) );\n\t\t}\n\t),\n\n\tnew Func(\n\t\tspelling: \"url\",\n\t\tf: function ( funk, ev, ast, ctx, args ) {\n\t\t\tif ( args.length = 0 ) {\n\t\t\t\tconst cur := ctx.nodeset.get( 0, null );\n\t\t\t\treturn [] unless cur;\n\t\t\t\treturn funk.wrap( typeof cur eq \"XmlNodeNode\" ? cur.raw.namespaceURI() : null );\n\t\t\t}\n\t\t\telse if ( args.length = 1 ) {\n\t\t\t\tconst got := ev.eval_expr( args[0], ev.nested_ctx( ctx ) );\n\t\t\t\treturn got.map(\n\t\t\t\t\tfn x \u2192 funk.wrap_for_array(\n\t\t\t\t\t\ttypeof x eq \"XmlNodeNode\" ? x.raw.namespaceURI() : null\n\t\t\t\t\t)\n\t\t\t\t);\n\t\t\t}\n\t\t\tdie \"Too many arguments for url()\";\n\t\t},\n\t),\n\n\tnew Func(\n\t\tspelling: \"local-name\",\n\t\tf: function ( funk, ev, ast, ctx, args ) {\n\t\t\tif ( args.length = 0 ) {\n\t\t\t\tconst cur := ctx.nodeset.get( 0, null );\n\t\t\t\treturn [] unless cur;\n\t\t\t\treturn funk.wrap( typeof cur eq \"XmlNodeNode\" ? cur.raw.localName() : null );\n\t\t\t}\n\t\t\telse if ( args.length = 1 ) {\n\t\t\t\tconst got := ev.eval_expr( args[0], ev.nested_ctx( ctx ) );\n\t\t\t\treturn got.map(\n\t\t\t\t\tfn x \u2192 funk.wrap_for_array(\n\t\t\t\t\t\ttypeof x eq \"XmlNodeNode\" ? x.raw.localName() : null\n\t\t\t\t\t)\n\t\t\t\t);\n\t\t\t}\n\t\t\tdie \"Too many arguments for local-name()\";\n\t\t},\n\t),\n\n\tnew Func(\n\t\tspelling: \"tag\",\n\t\tf: function ( funk, ev, ast, ctx, args ) {\n\t\t\tif ( args.length = 0 ) {\n\t\t\t\tconst cur := ctx.nodeset.get( 0, null );\n\t\t\t\treturn [] unless cur;\n\t\t\t\treturn funk.wrap( cur.has_tagged ? cur.tagged{tag} : null );\n\t\t\t}\n\t\t\telse if ( args.length = 1 ) {\n\t\t\t\tconst got := ev.eval_expr( args[0], ev.nested_ctx( ctx ) );\n\t\t\t\treturn got.map(\n\t\t\t\t\tfn x \u2192 funk.wrap_for_array(\n\t\t\t\t\t\ttypeof x.has_tagged ? x.tagged{tag} : null\n\t\t\t\t\t)\n\t\t\t\t);\n\t\t\t}\n\t\t\tdie \"Too many arguments for tag()\";\n\t\t},\n\t),\n];\n",
		"/modules/std/path/z/lexer.zzm": "=encoding utf8\n\n=head1 NAME\n\nstd/path/z/lexer - Pure Zuzu lexer for ZPath expressions.\n\n=head1 DESCRIPTION\n\nThis module ports the C<Data::ZPath::_Lexer> Perl class to pure ZuzuScript\nwith a near line-by-line translation and matching public API.\n\n=cut\n\nfrom std/string import substr;\n\nclass Lexer {\n\tlet src := \"\";\n\tlet scan_i := 0;\n\tlet toks := [];\n\tlet pos := 0;\n\tlet allowed_operators;\n\n\tmethod __build__ () {\n\t\tdie \"Expected some operators\" unless allowed_operators;\n\t\ttoks := self._tokenize(src);\n\t}\n\n\tmethod peek () {\n\t\treturn toks[pos];\n\t}\n\t\n\tmethod peek_n ( n ) {\n\t\treturn toks[pos + n];\n\t}\n\t\n\tmethod peek_kind () {\n\t\treturn toks[pos]{k};\n\t}\n\n\tmethod peek_kind_n ( n ) {\n\t\treturn toks[pos + n]{k};\n\t}\n\n\tmethod next_tok () {\n\t\tlet tok := toks[pos];\n\t\tpos++;\n\t\treturn tok;\n\t}\n\n\tmethod expect ( k ) {\n\t\tlet t := self.next_tok();\n\t\tdie `Expected ${k}, got ${t{k}}` if t{k} \u2262 k;\n\t\treturn t;\n\t}\n\n\tmethod _is_ws ( c ) {\n\t\treturn c \u2262 null and c ~ /\\s/;\n\t}\n\n\tmethod _prev_sig ( chars, idx ) {\n\t\tlet j := idx - 1;\n\t\twhile ( j >= 0 ) {\n\t\t\tif ( chars[j] ~ /\\s/ ) {\n\t\t\t\tj--;\n\t\t\t\tnext;\n\t\t\t}\n\t\t\treturn chars[j];\n\t\t}\n\t\treturn null;\n\t}\n\n\tmethod _next_sig ( chars, idx, n ) {\n\t\tlet j := idx + 1;\n\t\twhile ( j < n ) {\n\t\t\tif ( chars[j] ~ /\\s/ ) {\n\t\t\t\tj++;\n\t\t\t\tnext;\n\t\t\t}\n\t\t\treturn chars[j];\n\t\t}\n\t\treturn null;\n\t}\n\n\tmethod _is_path_ctx_prev ( c ) {\n\t\treturn c \u2261 \"[\" or c \u2261 \"(\" or c \u2261 \",\" or c \u2261 \":\" or c \u2261 \"?\" or c \u2261 \"/\";\n\t}\n\n\tmethod _is_path_ctx_next ( c ) {\n\t\treturn c \u2261 \"]\" or c \u2261 \")\" or c \u2261 \",\" or c \u2261 \":\" or c \u2261 \"?\" or c \u2261 \"/\";\n\t}\n\n\tmethod _ws_on_both ( left, right ) {\n\t\treturn self._is_ws(left) and self._is_ws(right);\n\t}\n\n\tmethod known_operators () {\n\t\treturn allowed_operators;\n\t}\n\n\tmethod _sorted_operators () {\n\t\treturn self.known_operators()\n\t\t\t.grep( fn o \u2192 not o.lexer_should_ignore )\n\t\t\t.sort( fn ( x, y ) \u2192 y.char_length <=> x.char_length );\n\t}\n\n\tmethod _operator_at ( chars, i, n, ops ) {\n\t\tlet oi := 0;\n\t\twhile ( oi < ops.length ) {\n\t\t\tlet op := ops[oi];\n\t\t\tlet spell := op{spelling};\n\t\t\tlet m := length spell;\n\t\t\tif ( i + m <= n ) {\n\t\t\t\tlet got := \"\";\n\t\t\t\tlet j := 0;\n\t\t\t\twhile ( j < m ) {\n\t\t\t\t\tgot _= chars[i + j];\n\t\t\t\t\tj++;\n\t\t\t\t}\n\t\t\t\tif ( got \u2261 spell ) {\n\t\t\t\t\treturn op;\n\t\t\t\t}\n\t\t\t}\n\t\t\toi++;\n\t\t}\n\t\treturn null;\n\t}\n\n\tmethod _is_name_char ( c ) {\n\t\treturn c ~ /[A-Za-z0-9_\\-]/;\n\t}\n\n\tmethod _tokenize ( String source ) {\n\t\tlet t := [];\n\t\tlet chars := [];\n\t\tlet n := length source;\n\t\tlet ops := self._sorted_operators();\n\t\tlet z := 0;\n\t\twhile ( z < n ) {\n\t\t\tchars.push( substr( source, z, 1 ) );\n\t\t\tz++;\n\t\t}\n\n\t\tlet i := 0;\n\t\twhile ( i < n ) {\n\t\t\tlet ch := chars[i];\n\n\t\t\tif ( ch ~ /\\s/ ) {\n\t\t\t\ti++;\n\t\t\t\tnext;\n\t\t\t}\n\n\t\t\tlet prev := i > 0 ? chars[i - 1] : null;\n\t\t\tlet nxt := i + 1 < n ? chars[i + 1] : null;\n\n\t\t\tlet prev_nonws := self._prev_sig( chars, i );\n\t\t\tlet next_nonws := self._next_sig( chars, i, n );\n\n\t\t\tfunction push_token ( tok ) {\n\t\t\t\ttok{ws_before} := self._is_ws(prev) ? true : false;\n\t\t\t\ttok{ws_after}  := self._is_ws(nxt)  ? true : false;\n\t\t\t\tt.push( tok );\n\t\t\t}\n\n\t\t\tif ( ch \u2261 \"/\" ) {\n\t\t\t\tif (\n\t\t\t\t\tself._ws_on_both( prev, nxt )\n\t\t\t\t\tand prev_nonws \u2262 null and next_nonws \u2262 null\n\t\t\t\t\tand not self._is_path_ctx_prev(prev_nonws)\n\t\t\t\t\tand not self._is_path_ctx_next(next_nonws)\n\t\t\t\t) {\n\t\t\t\t\tpush_token( { k: \"SLASH\", v: \"/\" } );\n\t\t\t\t\ti++;\n\t\t\t\t\tnext;\n\t\t\t\t}\n\t\t\t\tif (\n\t\t\t\t\t( self._is_ws(prev) xor self._is_ws(nxt) )\n\t\t\t\t\tand prev_nonws \u2262 null and next_nonws \u2262 null\n\t\t\t\t\tand not self._is_path_ctx_prev(prev_nonws)\n\t\t\t\t\tand not self._is_path_ctx_next(next_nonws)\n\t\t\t\t) {\n\t\t\t\t\tdie `Binary operator '/' requires whitespace around it`;\n\t\t\t\t}\n\t\t\t\tt.push( { k: \"SLASH_PATH\", v: \"/\" } );\n\t\t\t\ti++;\n\t\t\t\tnext;\n\t\t\t}\n\n\t\t\tlet op := self._operator_at( chars, i, n, ops );\n\t\t\tif ( op \u2262 null ) {\n\t\t\t\tlet spell := op.get_spelling();\n\t\t\t\tlet need_ws := op.requires_whitespace();\n\t\t\t\tlet m := length spell;\n\t\t\t\tlet op_prev := i > 0 ? chars[i - 1] : null;\n\t\t\t\tlet op_next := i + m < n ? chars[i + m] : null;\n\n\t\t\t\tlet left_name := false;\n\t\t\t\tlet right_name := false;\n\t\t\t\tif ( spell ~ /^[A-Za-z_]/ ) {\n\t\t\t\t\tleft_name := op_prev \u2262 null and self._is_name_char(op_prev);\n\t\t\t\t\tright_name := op_next \u2262 null and self._is_name_char(op_next);\n\t\t\t\t}\n\n\t\t\t\tif ( not left_name and not right_name ) {\n\t\t\t\t\tif ( need_ws ) {\n\t\t\t\t\t\tif ( self._ws_on_both( op_prev, op_next ) ) {\n\t\t\t\t\t\t\tpush_token( { k: op.get_kind(), v: spell } );\n\t\t\t\t\t\t\ti := i + m;\n\t\t\t\t\t\t\tnext;\n\t\t\t\t\t\t}\n\t\t\t\t\t\tdie `Binary operator '${spell}' requires whitespace around it`;\n\t\t\t\t\t}\n\t\t\t\t\tpush_token( { k: op.get_kind(), v: spell } );\n\t\t\t\t\ti := i + m;\n\t\t\t\t\tnext;\n\t\t\t\t}\n\t\t\t}\n\n\t\t\tif ( ch \u2261 \"(\" ) { t.push( { k: \"LPAREN\", v: \"(\" } ); i++; next; }\n\t\t\tif ( ch \u2261 \")\" ) { t.push( { k: \"RPAREN\", v: \")\" } ); i++; next; }\n\t\t\tif ( ch \u2261 \"[\" ) { t.push( { k: \"LBRACK\", v: \"[\" } ); i++; next; }\n\t\t\tif ( ch \u2261 \"]\" ) { t.push( { k: \"RBRACK\", v: \"]\" } ); i++; next; }\n\t\t\tif ( ch \u2261 \",\" ) { t.push( { k: \"COMMA\", v: \",\" } ); i++; next; }\n\n\t\t\tif ( ch \u2261 \".\" ) {\n\t\t\t\tif ( i + 2 < n and chars[i + 1] \u2261 \".\" and chars[i + 2] \u2261 \"*\" ) {\n\t\t\t\t\tpush_token( { k: \"DOTDOTSTAR\", v: \"..*\" } );\n\t\t\t\t\ti := i + 3;\n\t\t\t\t\tnext;\n\t\t\t\t}\n\t\t\t\tif ( i + 1 < n and chars[i + 1] \u2261 \".\" ) {\n\t\t\t\t\tpush_token( { k: \"DOTDOT\", v: \"..\" } );\n\t\t\t\t\ti := i + 2;\n\t\t\t\t\tnext;\n\t\t\t\t}\n\t\t\t\tpush_token( { k: \"DOT\", v: \".\" } );\n\t\t\t\ti++;\n\t\t\t\tnext;\n\t\t\t}\n\n\t\t\tif ( ch \u2261 \"*\" and self._ws_on_both( prev, nxt ) ) {\n\t\t\t\tpush_token( { k: \"STAR\", v: \"*\" } );\n\t\t\t\ti++;\n\t\t\t\tnext;\n\t\t\t}\n\n\t\t\tif ( ch \u2261 \"*\" ) {\n\t\t\t\tif ( i + 1 < n and chars[i + 1] \u2261 \"*\" ) {\n\t\t\t\t\tpush_token( { k: \"STARSTAR\", v: \"**\" } );\n\t\t\t\t\ti := i + 2;\n\t\t\t\t\tnext;\n\t\t\t\t}\n\t\t\t\tpush_token( { k: \"STAR_PATH\", v: \"*\" } );\n\t\t\t\ti++;\n\t\t\t\tnext;\n\t\t\t}\n\n\t\t\tif ( ch \u2261 \"?\" or ch \u2261 \":\" ) {\n\t\t\t\tif ( self._ws_on_both( prev, nxt ) ) {\n\t\t\t\t\tpush_token( { k: ch \u2261 \"?\" ? \"QMARK\" : \"COLON\", v: ch } );\n\t\t\t\t\ti++;\n\t\t\t\t\tnext;\n\t\t\t\t}\n\t\t\t\tdie `Ternary operator '${ch}' requires whitespace around it`;\n\t\t\t}\n\n\t\t\tif ( ch \u2261 \"\\\"\" or ch \u2261 \"'\" ) {\n\t\t\t\tlet quote := ch;\n\t\t\t\ti++;\n\t\t\t\tlet s := \"\";\n\t\t\t\tlet esc := false;\n\t\t\t\twhile ( i < n ) {\n\t\t\t\t\tlet cc := chars[i];\n\t\t\t\t\ti++;\n\t\t\t\t\tif ( esc ) {\n\t\t\t\t\t\tif ( cc \u2261 \"\\\\\" or cc \u2261 quote or cc \u2261 \"\\\"\" or cc \u2261 \"'\" ) {\n\t\t\t\t\t\t\ts _= cc;\n\t\t\t\t\t\t}\n\t\t\t\t\t\telse {\n\t\t\t\t\t\t\ts _= self._unescape_char(cc);\n\t\t\t\t\t\t}\n\t\t\t\t\t\tesc := false;\n\t\t\t\t\t\tnext;\n\t\t\t\t\t}\n\t\t\t\t\tif ( cc \u2261 \"\\\\\" ) { esc := true; next; }\n\t\t\t\t\tlast if cc \u2261 quote;\n\t\t\t\t\ts _= cc;\n\t\t\t\t}\n\t\t\t\tpush_token( { k: \"STRING\", v: s, q: quote } );\n\t\t\t\tnext;\n\t\t\t}\n\n\t\t\tif ( ch \u2261 \"#\" ) {\n\t\t\t\tlet j := i + 1;\n\t\t\t\tlet neg := false;\n\t\t\t\tif ( j < n and chars[j] \u2261 \"-\" ) {\n\t\t\t\t\tneg := true;\n\t\t\t\t\tj++;\n\t\t\t\t}\n\t\t\t\tdie \"Invalid index '#'\" if j >= n or not( chars[j] ~ /\\d/ );\n\t\t\t\tlet num := \"\";\n\t\t\t\twhile ( j < n and chars[j] ~ /\\d/ ) {\n\t\t\t\t\tnum _= chars[j];\n\t\t\t\t\tj++;\n\t\t\t\t}\n\t\t\t\tlet parsed := 0 + num;\n\t\t\t\tparsed := 0 - parsed if neg;\n\t\t\t\tpush_token( { k: \"INDEX\", v: parsed } );\n\t\t\t\ti := j;\n\t\t\t\tnext;\n\t\t\t}\n\n\t\t\tif ( ch ~ /[0-9]/ ) {\n\t\t\t\tlet j := i;\n\t\t\t\tlet num := \"\";\n\t\t\t\twhile ( j < n and chars[j] ~ /[0-9.]/ ) {\n\t\t\t\t\tnum _= chars[j];\n\t\t\t\t\tj++;\n\t\t\t\t}\n\t\t\t\tpush_token( { k: \"NUMBER\", v: 0 + num } );\n\t\t\t\ti := j;\n\t\t\t\tnext;\n\t\t\t}\n\n\t\t\tlet name := self._read_name( chars, i );\n\t\t\tif ( name{v} \u2262 \"\" ) {\n\t\t\t\tpush_token( { k: \"NAME\", v: name{v} } );\n\t\t\t\ti := name{i};\n\t\t\t\tnext;\n\t\t\t}\n\n\t\t\tdie `Unexpected character '${ch}' at position ${i}`;\n\t\t}\n\n\t\tt.push( { k: \"EOF\", v: \"\" } );\n\t\treturn t;\n\t}\n\n\tmethod _unescape_char ( c ) {\n\t\treturn \"\\n\" if c \u2261 \"n\";\n\t\treturn \"\\r\" if c \u2261 \"r\";\n\t\treturn \"\\t\" if c \u2261 \"t\";\n\t\treturn c;\n\t}\n\n\tmethod _read_name ( chars, start_i ) {\n\t\tlet n := chars.length();\n\t\tlet delim := {\n\t\t\t\"\\n\": true,\n\t\t\t\"\\r\": true,\n\t\t\t\"\\t\": true,\n\t\t\t\"(\": true,\n\t\t\t\")\": true,\n\t\t\t\"[\": true,\n\t\t\t\"]\": true,\n\t\t\t\"/\": true,\n\t\t\t\",\": true,\n\t\t\t\"=\": true,\n\t\t\t\"&\": true,\n\t\t\t\"|\": true,\n\t\t\t\"!\": true,\n\t\t\t\"<\": true,\n\t\t\t\">\": true,\n\t\t\t\"#\": true,\n\t\t\t\" \": true,\n\t\t};\n\t\tlet buf := \"\";\n\t\tlet esc := false;\n\t\tlet i := start_i;\n\n\t\twhile ( i < n ) {\n\t\t\tlet c := chars[i];\n\t\t\tif ( esc ) {\n\t\t\t\tbuf _= c;\n\t\t\t\tesc := false;\n\t\t\t\ti++;\n\t\t\t\tnext;\n\t\t\t}\n\n\t\t\tif ( c \u2261 \"\\\\\" ) {\n\t\t\t\tesc := true;\n\t\t\t\ti++;\n\t\t\t\tnext;\n\t\t\t}\n\n\t\t\tlast if delim.exists(c);\n\t\t\tlast if c ~ /\\s/;\n\t\t\tbuf _= c;\n\t\t\ti++;\n\t\t}\n\n\t\treturn { v: \"\", i: start_i } if buf \u2261 \"\";\n\t\treturn { v: buf, i: i };\n\t}\n}\n",
		"/modules/std/path/z/node.zzm": "=encoding utf8\n\n=head1 NAME\n\nstd/path/z/node - Node wrapper used by std/path/z.\n\n=head1 DESCRIPTION\n\nObjects of this class wrap underlying values and provide traversal and\ncoercion helpers used while evaluating ZPath expressions.\n\n=cut\n\nfrom std/internals import ref_id;\nfrom std/math import Math;\nfrom std/string import index, substr;\n\nlet determine_class;\n\nclass Node {\n\tlet raw with set := null;\n\tlet parent := null;\n\tlet key := null;\n\tlet id := null;\n\tlet ix := null;\n\tlet tagged with set, has := null;\n\n\tstatic method _xml_node_type_code ( value ) {\n\t\ttry {\n\t\t\treturn int( \"\" _ value.nodeType() );\n\t\t}\n\t\tcatch {\n\t\t\treturn null;\n\t\t}\n\t}\n\n\tstatic method from_root ( obj ) {\n\t\treturn self.wrap(obj);\n\t}\n\n\tstatic method wrap ( _obj, parent?, key?, ix? ) {\n\t\t\n\t\tlet obj := _obj;\n\n\t\tif ( obj instanceof Node ) {\n\t\t\treturn obj;\n\t\t}\n\n\t\tlet Klass := determine_class( obj );\n\t\t\n\t\tlet n := new Klass(\n\t\t\traw: obj,\n\t\t\tparent: parent,\n\t\t\tkey: key,\n\t\t\tix: ix,\n\t\t);\n\t\t\n\t\tif ( typeof obj eq \"TaggedValue\" ) {\n\t\t\tn.set_tagged(obj);\n\t\t\twhile ( typeof obj eq \"TaggedValue\" ) {\n\t\t\t\tobj := obj{value}\n\t\t\t}\n\t\t\tn.set_raw(obj);\n\t\t}\n\t\t\n\t\tn._build_id;\n\t\t\n\t\treturn n;\n\t}\n\t\n\tmethod _use_ref_as_id () {\n\t\treturn false;\n\t}\n\t\n\tmethod _build_id () {\n\t\tid := self._generate_id;\n\t}\n\t\n\tmethod _generate_id () {\n\t\t\n\t\tif ( self._use_ref_as_id ) {\n\t\t\treturn \"ref:\" _ ref_id(raw);\n\t\t}\n\t\t\n\t\tif ( parent \u2261 null ) {\n\t\t\treturn \"root\";\n\t\t}\n\t\t\n\t\tif ( ix \u2262 null ) {\n\t\t\tif ( key \u2262 null ) {\n\t\t\t\treturn parent.id _ \"/\" _ key _ \"#\" _ ix;\n\t\t\t}\n\t\t\treturn parent.id _ \"/#\" _ ix;\n\t\t}\n\t\t\n\t\tif ( key \u2262 null ) {\n\t\t\treturn parent.id _ \"/\" _ key;\n\t\t}\n\t\t\n\t\treturn \"rand:\" _ floor( 1000 * 1000 * 1000 * Math.rand() );\n\t}\n\t\n\tmethod raw ()    { return raw; }\n\tmethod parent () { return parent; }\n\tmethod key ()    { return key; }\n\tmethod id ()     { return id; }\n\tmethod ix ()     { return ix; }\n\tmethod index ()  { return ix; }\n\tmethod tagged () { return tagged; }\n\n\tmethod type () {\n\t\treturn typeof raw;\n\t}\n\n\tmethod value () {\n\t\treturn raw;\n\t}\n\n\tmethod primitive_value () {\n\t\treturn raw;\n\t}\n\n\tmethod string_value () {\n\t\tlet p := self.primitive_value;\n\t\treturn p \u2261 null ? null : \"\" _ p;\n\t}\n\n\tmethod number_value () {\n\t\tlet v := self.primitive_value();\n\t\treturn 0 + v if v ~ /^-?(?:[0-9]+(?:\\.[0-9]+)?|\\.[0-9]+)$/;\n\t\treturn null;\n\t}\n\n\tmethod can_have_named_children () {\n\t\treturn false;\n\t}\n\n\tmethod can_have_indexed_children () {\n\t\treturn false;\n\t}\n\n\tmethod can_have_named_indexed_children () {\n\t\treturn false;\n\t}\n\n\tmethod named_child ( name ) {\n\t\tself.children.first( fn kid \u2192 kid.key \u2261 name );\n\t}\n\n\tmethod indexed_child ( i ) {\n\t\tself.children.first( fn kid \u2192 kid.ix \u2261 i );\n\t}\n\t\n\tmethod named_indexed_child ( name, i ) {\n\t\tself.children.first( fn kid \u2192 kid.ix \u2261 i and kid.key \u2261 name );\n\t}\n\t\n\tmethod next_child ( child ) {\n\t\tlet i := child.ix;\n\t\treturn null if i \u2261 null; \n\t\treturn self.indexed_child( i + 1 );\n\t}\n\n\tmethod prev_child ( child ) {\n\t\tlet i := child.ix;\n\t\treturn null if i \u2261 null; \n\t\treturn null if i = 0;\n\t\treturn self.indexed_child( i - 1 );\n\t}\n\n\tmethod next_sibling () {\n\t\treturn self.parent.next_child( self );\n\t}\n\n\tmethod prev_sibling () {\n\t\treturn self.parent.prev_child( self );\n\t}\n\n\tmethod named_attribute ( name ) {\n\t\tlet attrname := ( name ~ /^@/ ) ? name : `@${name}`;\n\t\tself.attributes.first( fn kid \u2192 kid.name \u2261 attrname );\n\t}\n\n\tmethod children () {\n\t\treturn [];\n\t}\n\n\tmethod attributes () {\n\t\treturn [];\n\t}\n\t\n\tmethod name () {\n\t\treturn key;\n\t}\n\n\tmethod dump () {\n\t\treturn {\n\t\t\t\"@type\": self.type(),\n\t\t\t\"@id\": self.id(),\n\t\t\t\"@key\": self.key(),\n\t\t\t\"@index\": self.index(),\n\t\t\t\"@value\": self.primitive_value(),\n\t\t\tchildren: self.children().map( fn c -> c.dump() ),\n\t\t\tattributes: self.attributes().map( fn a -> a.dump() ),\n\t\t};\n\t}\n\n\tmethod find ( zpath ) {\n\t\t// Stub for now.\n\t\tdie \"Node.find is not implemented yet\";\n\t}\n\n\tmethod do_action ( action ) {\n\t\tconst container_node := self.parent();\n\t\tdie \"Path assignment target has no parent node\"\n\t\t\tif container_node \u2261 null;\n\t\treturn container_node.do_action_on_child( self, action );\n\t}\n\n\tmethod ref () {\n\t\tconst container_node := self.parent();\n\t\tdie \"Path assignment target has no parent node\"\n\t\t\tif container_node \u2261 null;\n\t\treturn container_node.ref_on_child(self);\n\t}\n\n\tmethod do_action_on_child ( child, action ) {\n\t\tdie `Path assignment target container '${self.type()}' is not assignable`;\n\t}\n\n\tmethod ref_on_child ( child ) {\n\t\tdie `Path assignment target container '${self.type()}' is not assignable`;\n\t}\n}\n\nclass SimpleNode extends Node {\n}\n\nclass StringNode extends SimpleNode {\n\t\n\tmethod string_value () {\n\t\tlet raw := self.raw;\n\t\tif ( typeof raw eq \"BinaryString\" ) {\n\t\t\treturn to_string( raw );\n\t\t}\n\t\treturn raw;\n\t}\n\t\n\tmethod type () {\n\t\treturn \"string\";\n\t}\n}\n\nclass NumberNode extends SimpleNode {\n\tmethod number_value () {\n\t\tlet raw := self.raw;\n\t\treturn raw;\n\t}\n\t\n\tmethod type () {\n\t\treturn \"number\";\n\t}\n}\n\nclass BooleanNode extends SimpleNode {\n\tmethod type () {\n\t\treturn \"boolean\";\n\t}\n}\n\nclass NullNode extends SimpleNode {\n\tmethod type () {\n\t\treturn \"null\";\n\t}\n}\n\nclass ArrayNode extends Node {\n\n\tmethod _use_ref_as_id () {\n\t\treturn true;\n\t}\n\t\n\tmethod type () {\n\t\treturn \"list\";\n\t}\n\t\n\tmethod children () {\n\t\tlet raw := self.raw;\n\t\tlet out := [];\n\t\tlet i := 0;\n\t\twhile ( i < raw.length ) {\n\t\t\tlet child := Node.wrap( raw[i], self, null, i );\n\t\t\tout.push(child);\n\t\t\ti++;\n\t\t}\n\t\treturn out;\n\t}\n\t\n\tmethod can_have_indexed_children () {\n\t\treturn false;\n\t}\n\n\tmethod do_action_on_child ( child, action ) {\n\t\treturn super( child, action ) if action{op} ne \":=\";\n\n\t\tconst ix := child.ix();\n\t\tdie \"Path assignment expects numeric array index\" if ix \u2261 null;\n\t\tlet container := self.raw();\n\t\tcontainer[ix] := action{value};\n\t\treturn action{value};\n\t}\n\n\tmethod ref_on_child ( child ) {\n\t\tconst ix := child.ix();\n\t\tdie \"Path assignment expects numeric array index\" if ix \u2261 null;\n\t\tlet container := self.raw();\n\t\treturn \\ container[ix];\n\t}\n}\n\nclass SetNode extends Node {\n\t\n\tmethod _use_ref_as_id () {\n\t\treturn true;\n\t}\n\n\tmethod children () {\n\t\tlet raw := self.raw;\n\t\tlet out := [];\n\t\tlet i := 0;\n\t\twhile ( i < raw.length ) {\n\t\t\tlet child := Node.wrap( raw[i], self, null, null );\n\t\t\tout.push(child);\n\t\t\ti++;\n\t\t}\n\t\treturn out;\n\t}\n}\n\nclass BagNode extends Node {\n\t\n\tmethod _use_ref_as_id () {\n\t\treturn true;\n\t}\n\n\tmethod children () {\n\t\tlet raw := self.raw;\n\t\tlet out := [];\n\t\tlet i := 0;\n\t\twhile ( i < raw.length ) {\n\t\t\tlet child := Node.wrap( raw[i], self, null, null );\n\t\t\tout.push(child);\n\t\t\ti++;\n\t\t}\n\t\treturn out;\n\t}\n}\n\nclass DictNode extends Node {\n\n\tmethod _use_ref_as_id () {\n\t\treturn true;\n\t}\n\t\n\tmethod type () {\n\t\treturn \"map\";\n\t}\n\t\n\tmethod children () {\n\t\tlet raw := self.raw;\n\t\tlet out := [];\n\t\tfor ( let k in raw.keys() ) {\n\t\t\tlet child := Node.wrap( raw.get(k), self, k );\n\t\t\tout.push(child);\n\t\t}\n\t\treturn out;\n\t}\n\t\n\tmethod can_have_named_children () {\n\t\treturn true;\n\t}\n\n\tmethod do_action_on_child ( child, action ) {\n\t\treturn super( child, action ) if action{op} ne \":=\";\n\n\t\tconst key := child.key();\n\t\tdie \"Path assignment expects string dict key\" if key \u2261 null;\n\t\tlet container := self.raw();\n\t\tcontainer{(key)} := action{value};\n\t\treturn action{value};\n\t}\n\n\tmethod ref_on_child ( child ) {\n\t\tconst key := child.key();\n\t\tdie \"Path assignment expects string dict key\" if key \u2261 null;\n\t\tlet container := self.raw();\n\t\treturn \\ container{(key)};\n\t}\n}\n\nclass PairListNode extends Node {\n\t\n\tmethod _use_ref_as_id () {\n\t\treturn true;\n\t}\n\t\n\tmethod children () {\n\t\tdie \"TODO\";\n\t}\n\t\n\tmethod can_have_named_children () {\n\t\treturn true;\n\t}\n\t\n\tmethod can_have_indexed_children () {\n\t\treturn true;\n\t}\n\t\n\tmethod can_have_named_indexed_children () {\n\t\treturn true;\n\t}\n\n\tmethod do_action_on_child ( child, action ) {\n\t\treturn super( child, action ) if action{op} ne \":=\";\n\n\t\tconst key := child.key();\n\t\tdie \"Path assignment expects string pairlist key\" if key \u2261 null;\n\n\t\tlet hash := index( key, \"#\" );\n\t\tlet pair_key := hash < 0 ? key : substr( key, 0, hash );\n\t\tlet container := self.raw();\n\t\tcontainer.set( pair_key, action{value} );\n\t\treturn action{value};\n\t}\n\n\tmethod ref_on_child ( child ) {\n\t\tconst key := child.key();\n\t\tdie \"Path assignment expects string pairlist key\" if key \u2261 null;\n\n\t\tlet hash := index( key, \"#\" );\n\t\tlet pair_key := hash < 0 ? key : substr( key, 0, hash );\n\t\tlet container := self.raw();\n\t\treturn \\ container{(pair_key)};\n\t}\n}\n\nclass PairNode extends Node {\n\t\n\tmethod attributes () {\n\t\tlet raw := self.raw;\n\t\treturn [ \"key\", \"value\" ]\n\t\t\t.map( fn a \u2192 Node.wrap( raw.(a)(), self, `@${a}` ) );\n\t}\n}\n\nclass XmlNodeNode extends Node {\n\n\tmethod _generate_id () {\n\t\treturn\n\t\t\ttry {\n\t\t\t\tlet i := self.raw.unique_id;\n\t\t\t\ti \u2261 null ? super() : `xml:${i}`;\n\t\t\t}\n\t\t\tcatch {\n\t\t\t\tsuper();\n\t\t\t};\n\t}\n\n\tmethod type () {\n\t\tlet raw := self.raw;\n\t\tif ( typeof raw eq \"XMLDocument\" ) {\n\t\t\treturn \"document\";\n\t\t}\n\t\tswitch ( Node._xml_node_type_code(raw) ) {\n\t\t\tcase 1:\n\t\t\t\treturn \"element\";\n\t\t\tcase 2, 18:\n\t\t\t\treturn \"attr\";\n\t\t\tcase 3, 4:\n\t\t\t\treturn \"text\";\n\t\t\tcase 8:\n\t\t\t\treturn \"comment\";\n\t\t\tcase 9:\n\t\t\t\treturn \"document\";\n\t\t}\n\t\t\n\t\treturn super();\n\t}\n\t\n\tmethod name () {\n\t\tlet raw := self.raw;\n\t\tswitch ( Node._xml_node_type_code(raw) ) {\n\t\t\tcase 1:\n\t\t\t\treturn raw.nodeName();\n\t\t\tcase 2, 18:\n\t\t\t\treturn \"@\" _ raw.nodeName();\n\t\t\tcase 3, 4:\n\t\t\t\treturn \"#text\";\n\t\t}\n\t\t\n\t\treturn super();\n\t}\n\n\tmethod next_child ( child ) {\n\t\treturn child.next_sibling;\n\t}\n\n\tmethod prev_child ( child ) {\n\t\treturn child.prev_sibling;\n\t}\n\n\tmethod next_sibling () {\n\t\tlet x := self.raw.nextSibling;\n\t\treturn null if x \u2261 null;\n\t\treturn Node.wrap( x, self.parent, x.nodeName );\n\t}\n\n\tmethod prev_sibling () {\n\t\tlet x := self.raw.previousSibling;\n\t\treturn null if x \u2261 null;\n\t\treturn Node.wrap( x, self.parent, x.nodeName );\n\t}\n\n\tmethod primitive_value () {\n\t\tlet raw := self.raw;\n\t\tif ( typeof raw eq \"XMLDocument\" ) {\n\t\t\tlet de := raw.documentElement();\n\t\t\treturn de \u2261 null ? null : de.textContent();\n\t\t}\n\t\tswitch ( Node._xml_node_type_code(raw) ) {\n\t\t\tcase 1:\n\t\t\t\treturn raw.textContent;\n\t\t\tcase 2, 18:\n\t\t\t\treturn raw.nodeValue();\n\t\t\tcase 3, 4, 8:\n\t\t\t\treturn raw.data;\n\t\t\tcase 9:\n\t\t\t\tlet de := raw.documentElement();\n\t\t\t\treturn de \u2261 null ? null : de.textContent();\n\t\t}\n\t\t\n\t\treturn super();\n\t}\n\t\n\tmethod string_value () {\n\t\tlet raw := self.raw;\n\t\tif ( typeof raw eq \"XMLDocument\" ) {\n\t\t\tlet de := raw.documentElement();\n\t\t\treturn de \u2261 null ? null : de.textContent();\n\t\t}\n\t\tswitch ( Node._xml_node_type_code(raw) ) {\n\t\t\tcase 1:\n\t\t\t\treturn raw.textContent;\n\t\t\tcase 2, 18:\n\t\t\t\treturn raw.nodeValue();\n\t\t\tcase 3, 4, 8:\n\t\t\t\treturn raw.data;\n\t\t\tcase 9:\n\t\t\t\tlet de := raw.documentElement();\n\t\t\t\treturn de \u2261 null ? null : de.textContent();\n\t\t}\n\n\t\treturn super();\n\t}\n\n\tmethod can_have_named_children () {\n\t\treturn true;\n\t}\n\t\n\tmethod can_have_indexed_children () {\n\t\treturn true;\n\t}\n\t\n\tmethod can_have_named_indexed_children () {\n\t\treturn true;\n\t}\n\t\n\tmethod children () {\n\t\tlet raw := self.raw;\n\t\tif ( typeof raw eq \"XMLDocument\" ) {\n\t\t\tlet de := raw.documentElement();\n\t\t\treturn de \u2261 null ? []\n\t\t\t\t: [ Node.wrap( de, self, de.nodeName(), 0 ) ];\n\t\t}\n\t\tlet node_type := Node._xml_node_type_code(raw);\n\t\tif ( node_type = 9 ) {\n\t\t\tlet de := raw.documentElement();\n\t\t\treturn de \u2261 null ? []\n\t\t\t\t: [ Node.wrap( de, self, de.nodeName(), 0 ) ];\n\t\t}\n\n\t\tif ( node_type = 1 ) {\n\t\t\tlet kids := [];\n\t\t\tlet count := {};\n\t\t\tfor ( let child in raw.childNodes() ) {\n\t\t\t\tlet nm := child.nodeName();\n\t\t\t\tlet n := count.exists(nm) ? count.get( nm ) : 0;\n\t\t\t\tcount.set( nm, n + 1 );\n\t\t\t\tkids.push( Node.wrap( child, self, nm, n ) );\n\t\t\t}\n\t\t\treturn kids;\n\t\t}\n\n\t\treturn [];\n\t}\n\n\tmethod attributes () {\n\t\tlet raw := self.raw;\n\t\tlet out := super();\n\t\tif ( Node._xml_node_type_code(raw) \u2261 1 ) {\n\t\t\tfor ( let attr in raw.attributes() ) {\n\t\t\t\tlet n := Node.wrap( attr, self, \"@\" _ attr.nodeName() );\n\t\t\t\tout.push(n);\n\t\t\t}\n\t\t}\n\t\treturn out;\n\t}\n}\n\nclass TimeNode extends Node {\n\t\n\tmethod string_value () {\n\t\tlet raw := self.raw;\n\t\treturn raw.datetime;\n\t}\n\t\n\tmethod number_value () {\n\t\tlet raw := self.raw;\n\t\treturn raw.epoch;\n\t}\n\t\n\tmethod attributes () {\n\t\tlet raw := self.raw;\n\t\treturn [ \"year\", \"month\", \"day\", \"hour\", \"min\", \"sec\" ]\n\t\t\t.map( fn a \u2192 Node.wrap( raw.(a)(), self, `@${a}` ) );\n\t}\n}\n\nclass PathNode extends Node {\n\n\tmethod string_value () {\n\t\tlet raw := self.raw;\n\t\treturn raw.to_String;\n\t}\n\t\n\tmethod attributes () {\n\t\tlet raw := self.raw;\n\t\tif ( raw.is_file ) {\n\t\t\tconst stat := raw.stat;\n\t\t\treturn stat.keys.map( fn a \u2192 Node.wrap( stat{a}, self, `@${a}` ) );\n\t\t}\n\t\t\n\t\treturn super();\n\t}\n}\n\n// Need to define the body of this function late so it can refer back to\n// classes that have been declared.\n\ndetermine_class := function ( obj ) {\n\tlet Klass;\n\t\n\tlet real_obj := obj;\n\twhile ( typeof real_obj eq \"TaggedValue\" ) {\n\t\treal_obj := real_obj{value};\n\t}\n\t\n\tswitch ( typeof real_obj : eq ) {\n\t\tcase \"Null\":\n\t\t\tKlass := NullNode;\n\t\tcase \"Boolean\":\n\t\t\tKlass := BooleanNode;\n\t\tcase \"Number\":\n\t\t\tKlass := NumberNode;\n\t\tcase \"String\", \"BinaryString\":\n\t\t\tKlass := StringNode;\n\t\tcase \"Array\":\n\t\t\tKlass := ArrayNode;\n\t\tcase \"Bag\":\n\t\t\tKlass := BagNode;\n\t\tcase \"Set\":\n\t\t\tKlass := SetNode;\n\t\tcase \"Dict\":\n\t\t\tKlass := DictNode;\n\t\tcase \"PairList\":\n\t\t\tKlass := PairListNode;\n\t\tcase \"Pair\":\n\t\t\tKlass := PairNode;\n\t\tcase \"XMLNode\", \"XMLDocument\", \"DOMNode\":\n\t\t\tKlass := XmlNodeNode;\n\t\tcase \"DOMElement\", \"DOMAttr\", \"DOMText\", \"DOMComment\", \"DOMDocument\":\n\t\t\tKlass := XmlNodeNode;\n\t\tcase \"Time\":\n\t\t\tKlass := TimeNode;\n\t\tcase \"Path\":\n\t\t\tKlass := PathNode;\n\t\tdefault:\n\t\t\tif ( real_obj instanceof \"Object\" ) {\n\t\t\t\tif ( real_obj can __zpath_node_class__ ) {\n\t\t\t\t\tKlass = real_obj.__zpath_node_class__;\n\t\t\t\t}\n\t\t\t}\n\t}\n\n\tif ( Klass \u2261 null ) {\n\t\ttry {\n\t\t\tlet maybe_node_type := real_obj.nodeType();\n\t\t\tKlass := XmlNodeNode if maybe_node_type \u2262 null;\n\t\t}\n\t\tcatch {\n\t\t}\n\t}\n\t\n\treturn Klass ?: Node;\n};\n",
		"/modules/std/path/z/operators.zzm": "from std/path/z/node import Node;\n\nfunction _floaty_modulus ( ln, rn ) {\n\tlet count := floor( ln / rn ); //\n\treturn ln - ( count * rn );\n}\n\ntrait EvalHelpers {\n\tmethod _handle_numeric_operand ( ev, ctx, expr ) {\n\t\tconst result := ev.eval_expr( expr, ev.nested_ctx( ctx ) );\n\t\treturn 0 unless result.length;\n\t\treturn ev.to_number( result[0] );\n\t}\n\t\n\tmethod _handle_stringy_operand ( ev, ctx, expr ) {\n\t\tconst result := ev.eval_expr( expr, ev.nested_ctx( ctx ) );\n\t\treturn 0 unless result.length;\n\t\treturn ev.to_number( result[0] );\n\t}\n\t\n\tmethod wrap ( value ) {\n\t\treturn [ Node.wrap( value ) ];\n\t}\n\t\n\tmethod wrap_for_array ( value ) {\n\t\treturn Node.wrap( value );\n\t}\n}\n\nclass Operator with EvalHelpers {\n\tlet String spelling with get;\n\tlet String alias with get, has;\n\tlet String kind with get;\n\tlet Number precedence with get;\n\tlet Boolean unary      := false;\n\tlet Boolean require_ws := false;\n\tlet Boolean lex_ignore := false;\n\tlet Function f;\n\t\n\tmethod is_unary () {\n\t\treturn unary;\n\t}\n\t\n\tmethod is_binary () {\n\t\treturn not unary;\n\t}\n\t\n\tmethod requires_whitespace () {\n\t\treturn require_ws;\n\t}\n\t\n\tmethod lexer_should_ignore () {\n\t\treturn lex_ignore;\n\t}\n\t\n\tmethod char_length () {\n\t\treturn length spelling;\n\t}\n\t\n\tmethod precedence_is ( lvl ) {\n\t\treturn precedence = lvl;\n\t}\n}\n\nconst STANDARD_OPERATORS := [\n\tnew Operator(\n\t\tspelling: \"||\",\n\t\tkind: \"OROR\",\n\t\tprecedence: 2,\n\t\tf: function ( op, ev, ast, ctx, left, right ) {\n\t\t\tconst left_val := ev.eval_expr( left, ev.nested_ctx( ctx ) );\n\t\t\tif ( left_val.length and ev.truthy( left_val[0] ) ) {\n\t\t\t\treturn op.wrap( true );\n\t\t\t}\n\t\t\tconst right_val := ev.eval_expr( right, ev.nested_ctx( ctx ) );\n\t\t\tif ( right_val.length and ev.truthy( right_val[0] ) ) {\n\t\t\t\treturn op.wrap( true );\n\t\t\t}\n\t\t\treturn op.wrap( false );\n\t\t},\n\t),\n\t\n\tnew Operator(\n\t\tspelling: \"&&\",\n\t\tkind: \"ANDAND\",\n\t\tprecedence: 4,\n\t\tf: function ( op, ev, ast, ctx, left, right ) {\n\t\t\tconst left_val := ev.eval_expr( left, ev.nested_ctx( ctx ) );\n\t\t\tif ( left_val.length and ev.truthy( left_val[0] ) ) {\n\t\t\t\tconst right_val := ev.eval_expr( right, ev.nested_ctx( ctx ) );\n\t\t\t\tif ( right_val.length and ev.truthy( right_val[0] ) ) {\n\t\t\t\t\treturn op.wrap( true );\n\t\t\t\t}\n\t\t\t}\n\t\t\treturn op.wrap( false );\n\t\t},\n\t),\n\t\n\tnew Operator(\n\t\tspelling: \"==\",\n\t\tkind: \"EQEQ\",\n\t\tprecedence: 12,\n\t\tf: function ( op, ev, ast, ctx, left, right ) {\n\t\t\tconst left_vals  := ev.eval_expr( left, ev.nested_ctx( ctx ) );\n\t\t\tconst right_vals := ev.eval_expr( right, ev.nested_ctx( ctx ) );\n\t\t\tlet is_eq := false;\n\t\t\t\n\t\t\tif ( left_vals and right_vals ) {\n\t\t\t\tfor ( let ln in left_vals ) {\n\t\t\t\t\tlast if is_eq;\n\t\t\t\t\tfor ( let rn in right_vals ) {\n\t\t\t\t\t\tlast if is_eq;\n\t\t\t\t\t\tif ( ev.equals( ln, rn ) ) {\n\t\t\t\t\t\t\tis_eq := true;\n\t\t\t\t\t\t}\n\t\t\t\t\t}\n\t\t\t\t}\n\t\t\t}\n\t\t\t\n\t\t\treturn op.wrap( is_eq );\n\t\t},\n\t),\n\t\n\tnew Operator(\n\t\tspelling: \"!=\",\n\t\tkind: \"NEQ\",\n\t\tprecedence: 12,\n\t\tf: function ( op, ev, ast, ctx, left, right ) {\n\t\t\tconst left_vals  := ev.eval_expr( left, ev.nested_ctx( ctx ) );\n\t\t\tconst right_vals := ev.eval_expr( right, ev.nested_ctx( ctx ) );\n\t\t\tlet is_eq := false;\n\t\t\t\n\t\t\tif ( left_vals and right_vals ) {\n\t\t\t\tfor ( let ln in left_vals ) {\n\t\t\t\t\tlast if is_eq;\n\t\t\t\t\tfor ( let rn in right_vals ) {\n\t\t\t\t\t\tlast if is_eq;\n\t\t\t\t\t\tif ( ev.equals( ln, rn ) ) {\n\t\t\t\t\t\t\tis_eq := true;\n\t\t\t\t\t\t}\n\t\t\t\t\t}\n\t\t\t\t}\n\t\t\t}\n\t\t\t\n\t\t\treturn op.wrap( not is_eq );\n\t\t},\n\t),\n\t\n\tnew Operator(\n\t\tspelling: \">=\",\n\t\tkind: \"GE\",\n\t\tprecedence: 14,\n\t\tf: function ( op, ev, ast, ctx, left, right ) {\n\t\t\tlet left_val  := op._handle_numeric_operand( ev, ctx, left );\n\t\t\tlet right_val := op._handle_numeric_operand( ev, ctx, right );\n\t\t\tif ( ( left_val \u2261 null ) or ( right_val \u2261 null ) ) {\n\t\t\t\tleft_val  := op._handle_stringy_operand( ev, ctx, left );\n\t\t\t\tright_val := op._handle_stringy_operand( ev, ctx, right );\n\t\t\t\treturn op.wrap( left_val ge right_val );\n\t\t\t}\n\t\t\treturn op.wrap( left_val \u2265 right_val );\n\t\t},\n\t),\n\t\n\tnew Operator(\n\t\tspelling: \"<=\",\n\t\tkind: \"LE\",\n\t\tprecedence: 14,\n\t\tf: function ( op, ev, ast, ctx, left, right ) {\n\t\t\tlet left_val  := op._handle_numeric_operand( ev, ctx, left );\n\t\t\tlet right_val := op._handle_numeric_operand( ev, ctx, right );\n\t\t\tif ( ( left_val \u2261 null ) or ( right_val \u2261 null ) ) {\n\t\t\t\tleft_val  := op._handle_stringy_operand( ev, ctx, left );\n\t\t\t\tright_val := op._handle_stringy_operand( ev, ctx, right );\n\t\t\t\treturn op.wrap( left_val le right_val );\n\t\t\t}\n\t\t\treturn op.wrap( left_val \u2264 right_val );\n\t\t},\n\t),\n\t\n\tnew Operator(\n\t\tspelling: \"+\", \n\t\tkind: \"PLUS\",\n\t\trequire_ws: true,\n\t\tprecedence: 16,\n\t\tf: function ( op, ev, ast, ctx, left, right ) {\n\t\t\tconst left_val  := op._handle_numeric_operand( ev, ctx, left );\n\t\t\tconst right_val := op._handle_numeric_operand( ev, ctx, right );\n\t\t\treturn op.wrap( left_val + right_val );\n\t\t},\n\t),\n\t\n\tnew Operator(\n\t\tspelling: \"-\", \n\t\tkind: \"MINUS\",\n\t\trequire_ws: true,\n\t\tprecedence: 16,\n\t\tf: function ( op, ev, ast, ctx, left, right ) {\n\t\t\tconst left_val  := op._handle_numeric_operand( ev, ctx, left );\n\t\t\tconst right_val := op._handle_numeric_operand( ev, ctx, right );\n\t\t\treturn op.wrap( left_val - right_val );\n\t\t},\n\t),\n\t\n\tnew Operator(\n\t\tspelling: \"%\", \n\t\tkind: \"PCT\",\n\t\trequire_ws: true,\n\t\tprecedence: 18,\n\t\tf: function ( op, ev, ast, ctx, left, right ) {\n\t\t\tconst left_val  := op._handle_numeric_operand( ev, ctx, left );\n\t\t\tconst right_val := op._handle_numeric_operand( ev, ctx, right );\n\t\t\tif ( ( left_val ~ /\\./ ) or ( right_val ~ /\\./ ) ) {\n\t\t\t\treturn op.wrap( _floaty_modulus( left_val, right_val ) );\n\t\t\t}\n\t\t\treturn op.wrap( left_val mod right_val );\n\t\t},\n\t),\n\t\n\tnew Operator(\n\t\tspelling: \"*\", \n\t\tkind: \"TIMES\",\n\t\trequire_ws: true,\n\t\tprecedence: 18,\n\t\tlex_ignore: true,\n\t\talias: \"STAR\",\n\t\tf: function ( op, ev, ast, ctx, left, right ) {\n\t\t\tconst left_val  := op._handle_numeric_operand( ev, ctx, left );\n\t\t\tconst right_val := op._handle_numeric_operand( ev, ctx, right );\n\t\t\treturn op.wrap( left_val \u00d7 right_val );\n\t\t},\n\t),\n\t\n\tnew Operator(\n\t\tspelling: \"/\", \n\t\tkind: \"DIVIDE\",\n\t\trequire_ws: true,\n\t\tprecedence: 18,\n\t\tlex_ignore: true,\n\t\talias: \"SLASH\",\n\t\tf: function ( op, ev, ast, ctx, left, right ) {\n\t\t\tconst left_val  := op._handle_numeric_operand( ev, ctx, left );\n\t\t\tconst right_val := op._handle_numeric_operand( ev, ctx, right );\n\t\t\treturn op.wrap( left_val \u00f7 right_val );\n\t\t},\n\t),\n\t\n\tnew Operator(\n\t\tspelling: \"^\", \n\t\tkind: \"BXOR\",\n\t\tprecedence: 8,\n\t\tf: function ( op, ev, ast, ctx, left, right ) {\n\t\t\tconst left_val  := op._handle_numeric_operand( ev, ctx, left );\n\t\t\tconst right_val := op._handle_numeric_operand( ev, ctx, right );\n\t\t\treturn op.wrap( left_val ^ right_val );\n\t\t},\n\t),\n\t\n\tnew Operator(\n\t\tspelling: \"&\", \n\t\tkind: \"BAND\",\n\t\tprecedence: 10,\n\t\tf: function ( op, ev, ast, ctx, left, right ) {\n\t\t\tconst left_val  := op._handle_numeric_operand( ev, ctx, left );\n\t\t\tconst right_val := op._handle_numeric_operand( ev, ctx, right );\n\t\t\treturn op.wrap( left_val & right_val );\n\t\t},\n\t),\n\t\n\tnew Operator(\n\t\tspelling: \"|\", \n\t\tkind: \"BOR\",\n\t\tprecedence: 6,\n\t\tf: function ( op, ev, ast, ctx, left, right ) {\n\t\t\tconst left_val  := op._handle_numeric_operand( ev, ctx, left );\n\t\t\tconst right_val := op._handle_numeric_operand( ev, ctx, right );\n\t\t\treturn op.wrap( left_val | right_val );\n\t\t},\n\t),\n\t\n\tnew Operator(\n\t\tspelling: \">\", \n\t\tkind: \"GT\",\n\t\tprecedence: 14,\n\t\tf: function ( op, ev, ast, ctx, left, right ) {\n\t\t\tlet left_val  := op._handle_numeric_operand( ev, ctx, left );\n\t\t\tlet right_val := op._handle_numeric_operand( ev, ctx, right );\n\t\t\tif ( ( left_val \u2261 null ) or ( right_val \u2261 null ) ) {\n\t\t\t\tleft_val  := op._handle_stringy_operand( ev, ctx, left );\n\t\t\t\tright_val := op._handle_stringy_operand( ev, ctx, right );\n\t\t\t\treturn op.wrap( left_val gt right_val );\n\t\t\t}\n\t\t\treturn op.wrap( left_val > right_val );\n\t\t},\n\t),\n\t\n\tnew Operator(\n\t\tspelling: \"<\", \n\t\tkind: \"LT\",\n\t\tprecedence: 14,\n\t\tf: function ( op, ev, ast, ctx, left, right ) {\n\t\t\tlet left_val  := op._handle_numeric_operand( ev, ctx, left );\n\t\t\tlet right_val := op._handle_numeric_operand( ev, ctx, right );\n\t\t\tif ( ( left_val \u2261 null ) or ( right_val \u2261 null ) ) {\n\t\t\t\tleft_val  := op._handle_stringy_operand( ev, ctx, left );\n\t\t\t\tright_val := op._handle_stringy_operand( ev, ctx, right );\n\t\t\t\treturn op.wrap( left_val le right_val );\n\t\t\t}\n\t\t\treturn op.wrap( left_val < right_val );\n\t\t},\n\t),\n\t\n\tnew Operator(\n\t\tspelling: \"!\", \n\t\tkind: \"NOT\"\n\t\tunary: true,\n\t\tprecedence: 20,\n\t),\n\t\n\tnew Operator(\n\t\tspelling: \"~\", \n\t\tkind: \"BNOT\"\n\t\tunary: true,\n\t\tprecedence: 20,\n\t),\n];\n",
		"/modules/std/path/z/parser.zzm": "=encoding utf8\n\n=head1 NAME\n\nstd/path/z/parser - Pure Zuzu parser for ZPath expressions.\n\n=head1 DESCRIPTION\n\nThis module ports the C<Data::ZPath::_Parser> Perl class to pure\nZuzuScript with a near line-by-line translation and matching public API.\n\n=cut\n\nfrom std/string import trim;\nfrom std/path/z/lexer import Lexer;\n\nclass Parser {\n\tlet lexer_class;\n\tlet allowed_operators;\n\tlet _binop_prec := {};\n\tlet _unop_prec  := {};\n\tlet _need_ws    := {};\n\n\tmethod __build__ () {\n\t\tlexer_class ?:= Lexer;\n\t\tfor ( let op in allowed_operators ) {\n\t\t\tlet spell := op.get_spelling();\n\t\t\tif ( op.is_unary() ) {\n\t\t\t\t_unop_prec.set( spell, op.get_precedence() );\n\t\t\t}\n\t\t\telse {\n\t\t\t\t_binop_prec.set( spell, op.get_precedence() );\n\t\t\t\tif ( op.requires_whitespace() ) {\n\t\t\t\t\t_need_ws.set( spell, true );\n\t\t\t\t}\n\t\t\t}\n\t\t}\n\t}\n\t\n\tmethod parse_top_level_terms ( src ) {\n\t\tlet terms := [];\n\t\tlet lexer := new lexer_class(\n\t\t\tsrc:               src,\n\t\t\tallowed_operators: allowed_operators,\n\t\t);\n\n\t\twhile ( true ) {\n\t\t\tlet expr := self.parse_expression(lexer);\n\t\t\tterms.push(expr);\n\t\t\tif ( lexer.peek_kind() \u2261 \"COMMA\" ) {\n\t\t\t\tlexer.next_tok();\n\t\t\t\tnext;\n\t\t\t}\n\t\t\tlexer.expect(\"EOF\");\n\t\t\tlast;\n\t\t}\n\n\t\treturn terms;\n\t}\n\n\tmethod _trim ( s ) {\n\t\treturn trim(s);\n\t}\n\n\tmethod parse_expression ( lx ) {\n\t\treturn self.parse_ternary(lx);\n\t}\n\n\tmethod parse_ternary ( lx ) {\n\t\tlet cond := self.parse_subexpression( lx, 1 );\n\n\t\tif ( lx.peek_kind() \u2261 \"QMARK\" ) {\n\t\t\tlx.next_tok();\n\t\t\tlet then := self.parse_expression(lx); // ZZPath should use: self.parse_subexpression( lx, 1 )\n\t\t\tlx.expect(\"COLON\");\n\t\t\tlet els := self.parse_expression(lx);\n\t\t\treturn { t: \"ternary\", c: cond, a: then, b: els };\n\t\t}\n\n\t\treturn cond;\n\t}\n\n\tmethod parse_subexpression ( lx, min_prec ) {\n\t\tlet left := self._parse_maybe_unary( lx, min_prec );\n\n\t\twhile ( true ) {\n\t\t\tlet spell := lx.peek{v};\n\t\t\tlet op_prec := _binop_prec.get( spell, null );\n\t\t\tlast if op_prec \u2261 null or op_prec < min_prec;\n\n\t\t\tlet op := lx.next_tok;\n\t\t\tif ( _need_ws.exists( spell ) ) {\n\t\t\t\tif ( not ( op{ws_before} and op{ws_after} ) ) {\n\t\t\t\t\tdie `Binary operator '${spell}' requires whitespace around it`;\n\t\t\t\t}\n\t\t\t}\n\n\t\t\tlet right := self.parse_subexpression( lx, op_prec + 1 );\n\t\t\tleft := { t: \"bin\", op: spell, l: left, r: right };\n\t\t}\n\n\t\treturn left;\n\t}\n\n\tmethod _parse_maybe_unary ( lx, min_prec ) {\n\t\tlet spell := lx.peek{v};\n\t\tlet op_prec := _unop_prec.get( spell, null );\n\t\tif ( op_prec \u2262 null and op_prec >= min_prec ) {\n\t\t\tlet op := lx.next_tok{v};\n\t\t\tlet e  := self._parse_maybe_unary( lx, op_prec );\n\t\t\treturn { t: \"un\", op: op, e: e };\n\t\t}\n\t\treturn self.parse_primary( lx );\n\t}\n\n\tmethod parse_primary ( lx ) {\n\t\tlet k := lx.peek_kind;\n\n\t\tif ( k \u2261 \"NUMBER\" ) {\n\t\t\treturn { t: \"num\", v: lx.next_tok(){v} };\n\t\t}\n\t\tif ( k \u2261 \"STRING\" ) {\n\t\t\treturn { t: \"str\", v: lx.next_tok(){v} };\n\t\t}\n\t\tif ( k \u2261 \"LPAREN\" ) {\n\t\t\tlx.next_tok();\n\t\t\tlet e := self.parse_expression(lx);\n\t\t\tlx.expect(\"RPAREN\");\n\t\t\treturn e;\n\t\t}\n\n\t\tif ( k \u2261 \"NAME\" and lx.peek_kind_n(1) \u2261 \"LPAREN\" ) {\n\t\t\tlet name := lx.next_tok(){v};\n\t\t\tlx.expect(\"LPAREN\");\n\t\t\tlet args := [];\n\t\t\tif ( lx.peek_kind() \u2262 \"RPAREN\" ) {\n\t\t\t\targs.push( self.parse_expression(lx) );\n\t\t\t\twhile ( lx.peek_kind() \u2261 \"COMMA\" ) {\n\t\t\t\t\tlx.next_tok();\n\t\t\t\t\targs.push( self.parse_expression(lx) );\n\t\t\t\t}\n\t\t\t}\n\t\t\tlx.expect(\"RPAREN\");\n\t\t\treturn { t: \"fn\", n: name, a: args };\n\t\t}\n\n\t\treturn self._parse_path_expr(lx);\n\t}\n\n\tmethod _is_path_terminator ( k ) {\n\t\treturn true if k \u2261 \"EOF\";\n\t\treturn true if k \u2261 \"COMMA\";\n\t\treturn true if k \u2261 \"RPAREN\";\n\t\treturn true if k \u2261 \"RBRACK\";\n\t\treturn true if k \u2261 \"QMARK\";\n\t\treturn true if k \u2261 \"COLON\";\n\t\treturn true if k \u2261 \"EQEQ\";\n\t\treturn true if k \u2261 \"NEQ\";\n\t\treturn true if k \u2261 \"GE\";\n\t\treturn true if k \u2261 \"LE\";\n\t\treturn true if k \u2261 \"GT\";\n\t\treturn true if k \u2261 \"LT\";\n\t\treturn true if k \u2261 \"ANDAND\";\n\t\treturn true if k \u2261 \"OROR\";\n\t\treturn true if k \u2261 \"PLUS\";\n\t\treturn true if k \u2261 \"MINUS\";\n\t\treturn true if k \u2261 \"STAR\";\n\t\treturn true if k \u2261 \"SLASH\";\n\t\treturn true if k \u2261 \"PCT\";\n\t\treturn true if k \u2261 \"BAND\";\n\t\treturn true if k \u2261 \"BOR\";\n\t\treturn true if k \u2261 \"BXOR\";\n\t\treturn false;\n\t}\n\n\tmethod _parse_path_expr ( lx ) {\n\t\tlet segs := [];\n\n\t\tif ( lx.peek_kind() \u2261 \"SLASH_PATH\" ) {\n\t\t\tlx.next_tok();\n\t\t\tlet root := { k: \"root\", q: [] };\n\t\t\tsegs.push(root);\n\n\t\t\tif ( lx.peek_kind() \u2261 \"LBRACK\" ) {\n\t\t\t\troot{q} := self._parse_qualifiers(lx);\n\t\t\t}\n\n\t\t\tif ( self._is_path_terminator( lx.peek_kind() ) ) {\n\t\t\t\treturn { t: \"path\", s: segs };\n\t\t\t}\n\t\t}\n\t\telse if ( lx.peek_kind() \u2261 \"LBRACK\" ) {\n\t\t\tlet seg := { k: \"dot\", q: self._parse_qualifiers(lx) };\n\t\t\tsegs.push(seg);\n\t\t\tif (\n\t\t\t\tlx.peek_kind() \u2261 \"EOF\"\n\t\t\t\tor lx.peek_kind() \u2261 \"COMMA\"\n\t\t\t\tor lx.peek_kind() \u2261 \"RPAREN\"\n\t\t\t\tor lx.peek_kind() \u2261 \"RBRACK\"\n\t\t\t) {\n\t\t\t\treturn { t: \"path\", s: segs };\n\t\t\t}\n\t\t}\n\n\t\tif (\n\t\t\tlx.peek_kind() \u2262 \"SLASH_PATH\"\n\t\t\tand lx.peek_kind() \u2262 \"EOF\"\n\t\t\tand lx.peek_kind() \u2262 \"COMMA\"\n\t\t\tand lx.peek_kind() \u2262 \"RPAREN\"\n\t\t\tand lx.peek_kind() \u2262 \"RBRACK\"\n\t\t) {\n\t\t\tsegs.push( self._parse_path_segment(lx) );\n\t\t}\n\n\t\twhile ( lx.peek_kind() \u2261 \"SLASH_PATH\" ) {\n\t\t\tlx.next_tok();\n\t\t\tif ( lx.peek_kind() \u2261 \"LBRACK\" ) {\n\t\t\t\tlet seg := { k: \"star\", q: [] };\n\t\t\t\tseg{q} := self._parse_qualifiers(lx);\n\t\t\t\tsegs.push(seg);\n\t\t\t\tnext;\n\t\t\t}\n\t\t\tsegs.push( self._parse_path_segment(lx) );\n\t\t}\n\n\t\treturn { t: \"path\", s: segs };\n\t}\n\n\tmethod _parse_path_segment ( lx ) {\n\t\tlet k := lx.peek_kind();\n\t\tlet seg := null;\n\n\t\tif ( k \u2261 \"DOT\" ) {\n\t\t\tlx.next_tok();\n\t\t\tseg := { k: \"dot\" };\n\t\t}\n\t\telse if ( k \u2261 \"DOTDOT\" ) {\n\t\t\tlx.next_tok();\n\t\t\tseg := { k: \"parent\" };\n\t\t}\n\t\telse if ( k \u2261 \"DOTDOTSTAR\" ) {\n\t\t\tlx.next_tok();\n\t\t\tseg := { k: \"ancestors\" };\n\t\t}\n\t\telse if ( k \u2261 \"STAR_PATH\" ) {\n\t\t\tlx.next_tok();\n\t\t\tseg := { k: \"star\" };\n\t\t}\n\t\telse if ( k \u2261 \"STARSTAR\" ) {\n\t\t\tlx.next_tok();\n\t\t\tseg := { k: \"desc\" };\n\t\t}\n\t\telse if ( k \u2261 \"INDEX\" ) {\n\t\t\tlet i := lx.next_tok(){v};\n\t\t\tseg := { k: \"index\", i: i };\n\t\t}\n\t\telse if ( k \u2261 \"NUMBER\" ) {\n\t\t\tlet i := lx.next_tok(){v};\n\t\t\tseg := { k: \"index\", i: i };\n\t\t}\n\t\telse if ( k \u2261 \"NAME\" and lx.peek_kind_n(1) \u2261 \"LPAREN\" ) {\n\t\t\tlet name := lx.next_tok(){v};\n\t\t\tlx.expect(\"LPAREN\");\n\t\t\tlet args := [];\n\t\t\tif ( lx.peek_kind() \u2262 \"RPAREN\" ) {\n\t\t\t\targs.push( self.parse_expression(lx) );\n\t\t\t\twhile ( lx.peek_kind() \u2261 \"COMMA\" ) {\n\t\t\t\t\tlx.next_tok();\n\t\t\t\t\targs.push( self.parse_expression(lx) );\n\t\t\t\t}\n\t\t\t}\n\t\t\tlx.expect(\"RPAREN\");\n\t\t\tseg := { k: \"fnseg\", n: name, a: args };\n\t\t}\n\t\telse if ( k \u2261 \"NAME\" ) {\n\t\t\tlet n := lx.next_tok(){v};\n\t\t\tseg := { k: \"name\", n: n };\n\t\t}\n\t\telse {\n\t\t\tdie `Unexpected token in path segment: ${k}`;\n\t\t}\n\n\t\tif ( seg{k} \u2261 \"name\" and lx.peek_kind() \u2261 \"INDEX\" ) {\n\t\t\tseg{i} := lx.next_tok(){v};\n\t\t}\n\n\t\tseg{q} := self._parse_qualifiers(lx);\n\t\treturn seg;\n\t}\n\n\tmethod _parse_qualifiers ( lx ) {\n\t\tlet q := [];\n\n\t\twhile ( lx.peek_kind() \u2261 \"LBRACK\" ) {\n\t\t\tlx.next_tok();\n\t\t\tlet e := self.parse_expression(lx);\n\t\t\tlx.expect(\"RBRACK\");\n\t\t\tq.push(e);\n\t\t}\n\n\t\treturn q;\n\t}\n}\n"
	}
};
	const __zuzu_api = ZuzuBrowser.createBrowserRuntime( {
		includePaths: [ '/__zuzu_compiled__' ],
		virtualFiles: __zuzu_payload.virtualFiles,
	} );
	const __zuzu_result = __zuzu_api.runtime.runCompiled(
		__zuzu_payload.entryJs,
		{ filename: __zuzu_payload.entry }
	);
	const __zuzu_root = typeof globalThis !== 'undefined'
		? globalThis
		: null;
	if ( __zuzu_root ) {
		__zuzu_root.ZuzuCompiledResult = __zuzu_result;
	}
	const __zuzu_is_node = typeof process !== 'undefined'
		&& process
		&& process.versions
		&& process.versions.node;
	if ( __zuzu_is_node ) {
		if ( __zuzu_result.stdout ) {
			process.stdout.write( __zuzu_result.stdout );
		}
		if ( __zuzu_result.stderr ) {
			process.stderr.write( __zuzu_result.stderr );
		}
		process.exitCode = __zuzu_result.status;
	}
	else {
		if (
			typeof window !== 'undefined'
			&& window
			&& typeof window.dispatchEvent === 'function'
			&& typeof CustomEvent === 'function'
		) {
			window.dispatchEvent( new CustomEvent(
				'zuzu:result',
				{ detail: __zuzu_result }
			) );
		}
		if ( __zuzu_result.stdout ) {
			for ( const __zuzu_line of __zuzu_result.stdout.trimEnd().split( /\r?\n/u ) ) {
				if ( __zuzu_line ) {
					console.log( __zuzu_line );
				}
			}
		}
		if ( __zuzu_result.stderr ) {
			console.error( __zuzu_result.stderr.trimEnd() );
		}
	}
})();
