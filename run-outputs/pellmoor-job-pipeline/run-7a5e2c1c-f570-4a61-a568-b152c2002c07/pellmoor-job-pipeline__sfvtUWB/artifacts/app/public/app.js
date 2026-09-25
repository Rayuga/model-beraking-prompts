"use strict";
(() => {
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __esm = (fn, res) => function __init() {
    return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
  };
  var __commonJS = (cb, mod) => function __require() {
    return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
  };

  // ../usr/local/lib/node_modules/d3/node_modules/d3-array/src/ascending.js
  function ascending(a, b) {
    return a == null || b == null ? NaN : a < b ? -1 : a > b ? 1 : a >= b ? 0 : NaN;
  }
  var init_ascending = __esm({
    "../usr/local/lib/node_modules/d3/node_modules/d3-array/src/ascending.js"() {
    }
  });

  // ../usr/local/lib/node_modules/d3/node_modules/d3-array/src/descending.js
  function descending(a, b) {
    return a == null || b == null ? NaN : b < a ? -1 : b > a ? 1 : b >= a ? 0 : NaN;
  }
  var init_descending = __esm({
    "../usr/local/lib/node_modules/d3/node_modules/d3-array/src/descending.js"() {
    }
  });

  // ../usr/local/lib/node_modules/d3/node_modules/d3-array/src/bisector.js
  function bisector(f) {
    let compare1, compare2, delta;
    if (f.length !== 2) {
      compare1 = ascending;
      compare2 = (d, x) => ascending(f(d), x);
      delta = (d, x) => f(d) - x;
    } else {
      compare1 = f === ascending || f === descending ? f : zero;
      compare2 = f;
      delta = f;
    }
    function left(a, x, lo = 0, hi = a.length) {
      if (lo < hi) {
        if (compare1(x, x) !== 0) return hi;
        do {
          const mid = lo + hi >>> 1;
          if (compare2(a[mid], x) < 0) lo = mid + 1;
          else hi = mid;
        } while (lo < hi);
      }
      return lo;
    }
    function right(a, x, lo = 0, hi = a.length) {
      if (lo < hi) {
        if (compare1(x, x) !== 0) return hi;
        do {
          const mid = lo + hi >>> 1;
          if (compare2(a[mid], x) <= 0) lo = mid + 1;
          else hi = mid;
        } while (lo < hi);
      }
      return lo;
    }
    function center(a, x, lo = 0, hi = a.length) {
      const i = left(a, x, lo, hi - 1);
      return i > lo && delta(a[i - 1], x) > -delta(a[i], x) ? i - 1 : i;
    }
    return { left, center, right };
  }
  function zero() {
    return 0;
  }
  var init_bisector = __esm({
    "../usr/local/lib/node_modules/d3/node_modules/d3-array/src/bisector.js"() {
      init_ascending();
      init_descending();
    }
  });

  // ../usr/local/lib/node_modules/d3/node_modules/d3-array/src/number.js
  function number(x) {
    return x === null ? NaN : +x;
  }
  var init_number = __esm({
    "../usr/local/lib/node_modules/d3/node_modules/d3-array/src/number.js"() {
    }
  });

  // ../usr/local/lib/node_modules/d3/node_modules/d3-array/src/bisect.js
  var ascendingBisect, bisectRight, bisectLeft, bisectCenter, bisect_default;
  var init_bisect = __esm({
    "../usr/local/lib/node_modules/d3/node_modules/d3-array/src/bisect.js"() {
      init_ascending();
      init_bisector();
      init_number();
      ascendingBisect = bisector(ascending);
      bisectRight = ascendingBisect.right;
      bisectLeft = ascendingBisect.left;
      bisectCenter = bisector(number).center;
      bisect_default = bisectRight;
    }
  });

  // ../usr/local/lib/node_modules/d3/node_modules/d3-array/src/ticks.js
  function tickSpec(start2, stop, count) {
    const step = (stop - start2) / Math.max(0, count), power = Math.floor(Math.log10(step)), error = step / Math.pow(10, power), factor = error >= e10 ? 10 : error >= e5 ? 5 : error >= e2 ? 2 : 1;
    let i1, i2, inc;
    if (power < 0) {
      inc = Math.pow(10, -power) / factor;
      i1 = Math.round(start2 * inc);
      i2 = Math.round(stop * inc);
      if (i1 / inc < start2) ++i1;
      if (i2 / inc > stop) --i2;
      inc = -inc;
    } else {
      inc = Math.pow(10, power) * factor;
      i1 = Math.round(start2 / inc);
      i2 = Math.round(stop / inc);
      if (i1 * inc < start2) ++i1;
      if (i2 * inc > stop) --i2;
    }
    if (i2 < i1 && 0.5 <= count && count < 2) return tickSpec(start2, stop, count * 2);
    return [i1, i2, inc];
  }
  function ticks(start2, stop, count) {
    stop = +stop, start2 = +start2, count = +count;
    if (!(count > 0)) return [];
    if (start2 === stop) return [start2];
    const reverse = stop < start2, [i1, i2, inc] = reverse ? tickSpec(stop, start2, count) : tickSpec(start2, stop, count);
    if (!(i2 >= i1)) return [];
    const n = i2 - i1 + 1, ticks2 = new Array(n);
    if (reverse) {
      if (inc < 0) for (let i = 0; i < n; ++i) ticks2[i] = (i2 - i) / -inc;
      else for (let i = 0; i < n; ++i) ticks2[i] = (i2 - i) * inc;
    } else {
      if (inc < 0) for (let i = 0; i < n; ++i) ticks2[i] = (i1 + i) / -inc;
      else for (let i = 0; i < n; ++i) ticks2[i] = (i1 + i) * inc;
    }
    return ticks2;
  }
  function tickIncrement(start2, stop, count) {
    stop = +stop, start2 = +start2, count = +count;
    return tickSpec(start2, stop, count)[2];
  }
  function tickStep(start2, stop, count) {
    stop = +stop, start2 = +start2, count = +count;
    const reverse = stop < start2, inc = reverse ? tickIncrement(stop, start2, count) : tickIncrement(start2, stop, count);
    return (reverse ? -1 : 1) * (inc < 0 ? 1 / -inc : inc);
  }
  var e10, e5, e2;
  var init_ticks = __esm({
    "../usr/local/lib/node_modules/d3/node_modules/d3-array/src/ticks.js"() {
      e10 = Math.sqrt(50);
      e5 = Math.sqrt(10);
      e2 = Math.sqrt(2);
    }
  });

  // ../usr/local/lib/node_modules/d3/node_modules/d3-array/src/max.js
  function max(values, valueof) {
    let max3;
    if (valueof === void 0) {
      for (const value of values) {
        if (value != null && (max3 < value || max3 === void 0 && value >= value)) {
          max3 = value;
        }
      }
    } else {
      let index = -1;
      for (let value of values) {
        if ((value = valueof(value, ++index, values)) != null && (max3 < value || max3 === void 0 && value >= value)) {
          max3 = value;
        }
      }
    }
    return max3;
  }
  var init_max = __esm({
    "../usr/local/lib/node_modules/d3/node_modules/d3-array/src/max.js"() {
    }
  });

  // ../usr/local/lib/node_modules/d3/node_modules/d3-array/src/index.js
  var init_src = __esm({
    "../usr/local/lib/node_modules/d3/node_modules/d3-array/src/index.js"() {
      init_bisect();
      init_max();
      init_ticks();
    }
  });

  // ../usr/local/lib/node_modules/d3/node_modules/d3-axis/src/index.js
  var init_src2 = __esm({
    "../usr/local/lib/node_modules/d3/node_modules/d3-axis/src/index.js"() {
    }
  });

  // ../usr/local/lib/node_modules/d3/node_modules/d3-dispatch/src/dispatch.js
  function dispatch() {
    for (var i = 0, n = arguments.length, _ = {}, t; i < n; ++i) {
      if (!(t = arguments[i] + "") || t in _ || /[\s.]/.test(t)) throw new Error("illegal type: " + t);
      _[t] = [];
    }
    return new Dispatch(_);
  }
  function Dispatch(_) {
    this._ = _;
  }
  function parseTypenames(typenames, types) {
    return typenames.trim().split(/^|\s+/).map(function(t) {
      var name = "", i = t.indexOf(".");
      if (i >= 0) name = t.slice(i + 1), t = t.slice(0, i);
      if (t && !types.hasOwnProperty(t)) throw new Error("unknown type: " + t);
      return { type: t, name };
    });
  }
  function get(type2, name) {
    for (var i = 0, n = type2.length, c; i < n; ++i) {
      if ((c = type2[i]).name === name) {
        return c.value;
      }
    }
  }
  function set(type2, name, callback) {
    for (var i = 0, n = type2.length; i < n; ++i) {
      if (type2[i].name === name) {
        type2[i] = noop, type2 = type2.slice(0, i).concat(type2.slice(i + 1));
        break;
      }
    }
    if (callback != null) type2.push({ name, value: callback });
    return type2;
  }
  var noop, dispatch_default;
  var init_dispatch = __esm({
    "../usr/local/lib/node_modules/d3/node_modules/d3-dispatch/src/dispatch.js"() {
      noop = { value: () => {
      } };
      Dispatch.prototype = dispatch.prototype = {
        constructor: Dispatch,
        on: function(typename, callback) {
          var _ = this._, T = parseTypenames(typename + "", _), t, i = -1, n = T.length;
          if (arguments.length < 2) {
            while (++i < n) if ((t = (typename = T[i]).type) && (t = get(_[t], typename.name))) return t;
            return;
          }
          if (callback != null && typeof callback !== "function") throw new Error("invalid callback: " + callback);
          while (++i < n) {
            if (t = (typename = T[i]).type) _[t] = set(_[t], typename.name, callback);
            else if (callback == null) for (t in _) _[t] = set(_[t], typename.name, null);
          }
          return this;
        },
        copy: function() {
          var copy2 = {}, _ = this._;
          for (var t in _) copy2[t] = _[t].slice();
          return new Dispatch(copy2);
        },
        call: function(type2, that) {
          if ((n = arguments.length - 2) > 0) for (var args = new Array(n), i = 0, n, t; i < n; ++i) args[i] = arguments[i + 2];
          if (!this._.hasOwnProperty(type2)) throw new Error("unknown type: " + type2);
          for (t = this._[type2], i = 0, n = t.length; i < n; ++i) t[i].value.apply(that, args);
        },
        apply: function(type2, that, args) {
          if (!this._.hasOwnProperty(type2)) throw new Error("unknown type: " + type2);
          for (var t = this._[type2], i = 0, n = t.length; i < n; ++i) t[i].value.apply(that, args);
        }
      };
      dispatch_default = dispatch;
    }
  });

  // ../usr/local/lib/node_modules/d3/node_modules/d3-dispatch/src/index.js
  var init_src3 = __esm({
    "../usr/local/lib/node_modules/d3/node_modules/d3-dispatch/src/index.js"() {
      init_dispatch();
    }
  });

  // ../usr/local/lib/node_modules/d3/node_modules/d3-selection/src/namespaces.js
  var xhtml, namespaces_default;
  var init_namespaces = __esm({
    "../usr/local/lib/node_modules/d3/node_modules/d3-selection/src/namespaces.js"() {
      xhtml = "http://www.w3.org/1999/xhtml";
      namespaces_default = {
        svg: "http://www.w3.org/2000/svg",
        xhtml,
        xlink: "http://www.w3.org/1999/xlink",
        xml: "http://www.w3.org/XML/1998/namespace",
        xmlns: "http://www.w3.org/2000/xmlns/"
      };
    }
  });

  // ../usr/local/lib/node_modules/d3/node_modules/d3-selection/src/namespace.js
  function namespace_default(name) {
    var prefix = name += "", i = prefix.indexOf(":");
    if (i >= 0 && (prefix = name.slice(0, i)) !== "xmlns") name = name.slice(i + 1);
    return namespaces_default.hasOwnProperty(prefix) ? { space: namespaces_default[prefix], local: name } : name;
  }
  var init_namespace = __esm({
    "../usr/local/lib/node_modules/d3/node_modules/d3-selection/src/namespace.js"() {
      init_namespaces();
    }
  });

  // ../usr/local/lib/node_modules/d3/node_modules/d3-selection/src/creator.js
  function creatorInherit(name) {
    return function() {
      var document2 = this.ownerDocument, uri = this.namespaceURI;
      return uri === xhtml && document2.documentElement.namespaceURI === xhtml ? document2.createElement(name) : document2.createElementNS(uri, name);
    };
  }
  function creatorFixed(fullname) {
    return function() {
      return this.ownerDocument.createElementNS(fullname.space, fullname.local);
    };
  }
  function creator_default(name) {
    var fullname = namespace_default(name);
    return (fullname.local ? creatorFixed : creatorInherit)(fullname);
  }
  var init_creator = __esm({
    "../usr/local/lib/node_modules/d3/node_modules/d3-selection/src/creator.js"() {
      init_namespace();
      init_namespaces();
    }
  });

  // ../usr/local/lib/node_modules/d3/node_modules/d3-selection/src/selector.js
  function none() {
  }
  function selector_default(selector) {
    return selector == null ? none : function() {
      return this.querySelector(selector);
    };
  }
  var init_selector = __esm({
    "../usr/local/lib/node_modules/d3/node_modules/d3-selection/src/selector.js"() {
    }
  });

  // ../usr/local/lib/node_modules/d3/node_modules/d3-selection/src/selection/select.js
  function select_default(select) {
    if (typeof select !== "function") select = selector_default(select);
    for (var groups = this._groups, m = groups.length, subgroups = new Array(m), j = 0; j < m; ++j) {
      for (var group = groups[j], n = group.length, subgroup = subgroups[j] = new Array(n), node, subnode, i = 0; i < n; ++i) {
        if ((node = group[i]) && (subnode = select.call(node, node.__data__, i, group))) {
          if ("__data__" in node) subnode.__data__ = node.__data__;
          subgroup[i] = subnode;
        }
      }
    }
    return new Selection(subgroups, this._parents);
  }
  var init_select = __esm({
    "../usr/local/lib/node_modules/d3/node_modules/d3-selection/src/selection/select.js"() {
      init_selection();
      init_selector();
    }
  });

  // ../usr/local/lib/node_modules/d3/node_modules/d3-selection/src/array.js
  function array(x) {
    return x == null ? [] : Array.isArray(x) ? x : Array.from(x);
  }
  var init_array = __esm({
    "../usr/local/lib/node_modules/d3/node_modules/d3-selection/src/array.js"() {
    }
  });

  // ../usr/local/lib/node_modules/d3/node_modules/d3-selection/src/selectorAll.js
  function empty() {
    return [];
  }
  function selectorAll_default(selector) {
    return selector == null ? empty : function() {
      return this.querySelectorAll(selector);
    };
  }
  var init_selectorAll = __esm({
    "../usr/local/lib/node_modules/d3/node_modules/d3-selection/src/selectorAll.js"() {
    }
  });

  // ../usr/local/lib/node_modules/d3/node_modules/d3-selection/src/selection/selectAll.js
  function arrayAll(select) {
    return function() {
      return array(select.apply(this, arguments));
    };
  }
  function selectAll_default(select) {
    if (typeof select === "function") select = arrayAll(select);
    else select = selectorAll_default(select);
    for (var groups = this._groups, m = groups.length, subgroups = [], parents = [], j = 0; j < m; ++j) {
      for (var group = groups[j], n = group.length, node, i = 0; i < n; ++i) {
        if (node = group[i]) {
          subgroups.push(select.call(node, node.__data__, i, group));
          parents.push(node);
        }
      }
    }
    return new Selection(subgroups, parents);
  }
  var init_selectAll = __esm({
    "../usr/local/lib/node_modules/d3/node_modules/d3-selection/src/selection/selectAll.js"() {
      init_selection();
      init_array();
      init_selectorAll();
    }
  });

  // ../usr/local/lib/node_modules/d3/node_modules/d3-selection/src/matcher.js
  function matcher_default(selector) {
    return function() {
      return this.matches(selector);
    };
  }
  function childMatcher(selector) {
    return function(node) {
      return node.matches(selector);
    };
  }
  var init_matcher = __esm({
    "../usr/local/lib/node_modules/d3/node_modules/d3-selection/src/matcher.js"() {
    }
  });

  // ../usr/local/lib/node_modules/d3/node_modules/d3-selection/src/selection/selectChild.js
  function childFind(match) {
    return function() {
      return find.call(this.children, match);
    };
  }
  function childFirst() {
    return this.firstElementChild;
  }
  function selectChild_default(match) {
    return this.select(match == null ? childFirst : childFind(typeof match === "function" ? match : childMatcher(match)));
  }
  var find;
  var init_selectChild = __esm({
    "../usr/local/lib/node_modules/d3/node_modules/d3-selection/src/selection/selectChild.js"() {
      init_matcher();
      find = Array.prototype.find;
    }
  });

  // ../usr/local/lib/node_modules/d3/node_modules/d3-selection/src/selection/selectChildren.js
  function children() {
    return Array.from(this.children);
  }
  function childrenFilter(match) {
    return function() {
      return filter.call(this.children, match);
    };
  }
  function selectChildren_default(match) {
    return this.selectAll(match == null ? children : childrenFilter(typeof match === "function" ? match : childMatcher(match)));
  }
  var filter;
  var init_selectChildren = __esm({
    "../usr/local/lib/node_modules/d3/node_modules/d3-selection/src/selection/selectChildren.js"() {
      init_matcher();
      filter = Array.prototype.filter;
    }
  });

  // ../usr/local/lib/node_modules/d3/node_modules/d3-selection/src/selection/filter.js
  function filter_default(match) {
    if (typeof match !== "function") match = matcher_default(match);
    for (var groups = this._groups, m = groups.length, subgroups = new Array(m), j = 0; j < m; ++j) {
      for (var group = groups[j], n = group.length, subgroup = subgroups[j] = [], node, i = 0; i < n; ++i) {
        if ((node = group[i]) && match.call(node, node.__data__, i, group)) {
          subgroup.push(node);
        }
      }
    }
    return new Selection(subgroups, this._parents);
  }
  var init_filter = __esm({
    "../usr/local/lib/node_modules/d3/node_modules/d3-selection/src/selection/filter.js"() {
      init_selection();
      init_matcher();
    }
  });

  // ../usr/local/lib/node_modules/d3/node_modules/d3-selection/src/selection/sparse.js
  function sparse_default(update) {
    return new Array(update.length);
  }
  var init_sparse = __esm({
    "../usr/local/lib/node_modules/d3/node_modules/d3-selection/src/selection/sparse.js"() {
    }
  });

  // ../usr/local/lib/node_modules/d3/node_modules/d3-selection/src/selection/enter.js
  function enter_default() {
    return new Selection(this._enter || this._groups.map(sparse_default), this._parents);
  }
  function EnterNode(parent, datum2) {
    this.ownerDocument = parent.ownerDocument;
    this.namespaceURI = parent.namespaceURI;
    this._next = null;
    this._parent = parent;
    this.__data__ = datum2;
  }
  var init_enter = __esm({
    "../usr/local/lib/node_modules/d3/node_modules/d3-selection/src/selection/enter.js"() {
      init_sparse();
      init_selection();
      EnterNode.prototype = {
        constructor: EnterNode,
        appendChild: function(child) {
          return this._parent.insertBefore(child, this._next);
        },
        insertBefore: function(child, next) {
          return this._parent.insertBefore(child, next);
        },
        querySelector: function(selector) {
          return this._parent.querySelector(selector);
        },
        querySelectorAll: function(selector) {
          return this._parent.querySelectorAll(selector);
        }
      };
    }
  });

  // ../usr/local/lib/node_modules/d3/node_modules/d3-selection/src/constant.js
  function constant_default(x) {
    return function() {
      return x;
    };
  }
  var init_constant = __esm({
    "../usr/local/lib/node_modules/d3/node_modules/d3-selection/src/constant.js"() {
    }
  });

  // ../usr/local/lib/node_modules/d3/node_modules/d3-selection/src/selection/data.js
  function bindIndex(parent, group, enter, update, exit, data) {
    var i = 0, node, groupLength = group.length, dataLength = data.length;
    for (; i < dataLength; ++i) {
      if (node = group[i]) {
        node.__data__ = data[i];
        update[i] = node;
      } else {
        enter[i] = new EnterNode(parent, data[i]);
      }
    }
    for (; i < groupLength; ++i) {
      if (node = group[i]) {
        exit[i] = node;
      }
    }
  }
  function bindKey(parent, group, enter, update, exit, data, key) {
    var i, node, nodeByKeyValue = /* @__PURE__ */ new Map(), groupLength = group.length, dataLength = data.length, keyValues = new Array(groupLength), keyValue;
    for (i = 0; i < groupLength; ++i) {
      if (node = group[i]) {
        keyValues[i] = keyValue = key.call(node, node.__data__, i, group) + "";
        if (nodeByKeyValue.has(keyValue)) {
          exit[i] = node;
        } else {
          nodeByKeyValue.set(keyValue, node);
        }
      }
    }
    for (i = 0; i < dataLength; ++i) {
      keyValue = key.call(parent, data[i], i, data) + "";
      if (node = nodeByKeyValue.get(keyValue)) {
        update[i] = node;
        node.__data__ = data[i];
        nodeByKeyValue.delete(keyValue);
      } else {
        enter[i] = new EnterNode(parent, data[i]);
      }
    }
    for (i = 0; i < groupLength; ++i) {
      if ((node = group[i]) && nodeByKeyValue.get(keyValues[i]) === node) {
        exit[i] = node;
      }
    }
  }
  function datum(node) {
    return node.__data__;
  }
  function data_default(value, key) {
    if (!arguments.length) return Array.from(this, datum);
    var bind = key ? bindKey : bindIndex, parents = this._parents, groups = this._groups;
    if (typeof value !== "function") value = constant_default(value);
    for (var m = groups.length, update = new Array(m), enter = new Array(m), exit = new Array(m), j = 0; j < m; ++j) {
      var parent = parents[j], group = groups[j], groupLength = group.length, data = arraylike(value.call(parent, parent && parent.__data__, j, parents)), dataLength = data.length, enterGroup = enter[j] = new Array(dataLength), updateGroup = update[j] = new Array(dataLength), exitGroup = exit[j] = new Array(groupLength);
      bind(parent, group, enterGroup, updateGroup, exitGroup, data, key);
      for (var i0 = 0, i1 = 0, previous, next; i0 < dataLength; ++i0) {
        if (previous = enterGroup[i0]) {
          if (i0 >= i1) i1 = i0 + 1;
          while (!(next = updateGroup[i1]) && ++i1 < dataLength) ;
          previous._next = next || null;
        }
      }
    }
    update = new Selection(update, parents);
    update._enter = enter;
    update._exit = exit;
    return update;
  }
  function arraylike(data) {
    return typeof data === "object" && "length" in data ? data : Array.from(data);
  }
  var init_data = __esm({
    "../usr/local/lib/node_modules/d3/node_modules/d3-selection/src/selection/data.js"() {
      init_selection();
      init_enter();
      init_constant();
    }
  });

  // ../usr/local/lib/node_modules/d3/node_modules/d3-selection/src/selection/exit.js
  function exit_default() {
    return new Selection(this._exit || this._groups.map(sparse_default), this._parents);
  }
  var init_exit = __esm({
    "../usr/local/lib/node_modules/d3/node_modules/d3-selection/src/selection/exit.js"() {
      init_sparse();
      init_selection();
    }
  });

  // ../usr/local/lib/node_modules/d3/node_modules/d3-selection/src/selection/join.js
  function join_default(onenter, onupdate, onexit) {
    var enter = this.enter(), update = this, exit = this.exit();
    if (typeof onenter === "function") {
      enter = onenter(enter);
      if (enter) enter = enter.selection();
    } else {
      enter = enter.append(onenter + "");
    }
    if (onupdate != null) {
      update = onupdate(update);
      if (update) update = update.selection();
    }
    if (onexit == null) exit.remove();
    else onexit(exit);
    return enter && update ? enter.merge(update).order() : update;
  }
  var init_join = __esm({
    "../usr/local/lib/node_modules/d3/node_modules/d3-selection/src/selection/join.js"() {
    }
  });

  // ../usr/local/lib/node_modules/d3/node_modules/d3-selection/src/selection/merge.js
  function merge_default(context) {
    var selection2 = context.selection ? context.selection() : context;
    for (var groups0 = this._groups, groups1 = selection2._groups, m0 = groups0.length, m1 = groups1.length, m = Math.min(m0, m1), merges = new Array(m0), j = 0; j < m; ++j) {
      for (var group0 = groups0[j], group1 = groups1[j], n = group0.length, merge = merges[j] = new Array(n), node, i = 0; i < n; ++i) {
        if (node = group0[i] || group1[i]) {
          merge[i] = node;
        }
      }
    }
    for (; j < m0; ++j) {
      merges[j] = groups0[j];
    }
    return new Selection(merges, this._parents);
  }
  var init_merge = __esm({
    "../usr/local/lib/node_modules/d3/node_modules/d3-selection/src/selection/merge.js"() {
      init_selection();
    }
  });

  // ../usr/local/lib/node_modules/d3/node_modules/d3-selection/src/selection/order.js
  function order_default() {
    for (var groups = this._groups, j = -1, m = groups.length; ++j < m; ) {
      for (var group = groups[j], i = group.length - 1, next = group[i], node; --i >= 0; ) {
        if (node = group[i]) {
          if (next && node.compareDocumentPosition(next) ^ 4) next.parentNode.insertBefore(node, next);
          next = node;
        }
      }
    }
    return this;
  }
  var init_order = __esm({
    "../usr/local/lib/node_modules/d3/node_modules/d3-selection/src/selection/order.js"() {
    }
  });

  // ../usr/local/lib/node_modules/d3/node_modules/d3-selection/src/selection/sort.js
  function sort_default(compare) {
    if (!compare) compare = ascending2;
    function compareNode(a, b) {
      return a && b ? compare(a.__data__, b.__data__) : !a - !b;
    }
    for (var groups = this._groups, m = groups.length, sortgroups = new Array(m), j = 0; j < m; ++j) {
      for (var group = groups[j], n = group.length, sortgroup = sortgroups[j] = new Array(n), node, i = 0; i < n; ++i) {
        if (node = group[i]) {
          sortgroup[i] = node;
        }
      }
      sortgroup.sort(compareNode);
    }
    return new Selection(sortgroups, this._parents).order();
  }
  function ascending2(a, b) {
    return a < b ? -1 : a > b ? 1 : a >= b ? 0 : NaN;
  }
  var init_sort = __esm({
    "../usr/local/lib/node_modules/d3/node_modules/d3-selection/src/selection/sort.js"() {
      init_selection();
    }
  });

  // ../usr/local/lib/node_modules/d3/node_modules/d3-selection/src/selection/call.js
  function call_default() {
    var callback = arguments[0];
    arguments[0] = this;
    callback.apply(null, arguments);
    return this;
  }
  var init_call = __esm({
    "../usr/local/lib/node_modules/d3/node_modules/d3-selection/src/selection/call.js"() {
    }
  });

  // ../usr/local/lib/node_modules/d3/node_modules/d3-selection/src/selection/nodes.js
  function nodes_default() {
    return Array.from(this);
  }
  var init_nodes = __esm({
    "../usr/local/lib/node_modules/d3/node_modules/d3-selection/src/selection/nodes.js"() {
    }
  });

  // ../usr/local/lib/node_modules/d3/node_modules/d3-selection/src/selection/node.js
  function node_default() {
    for (var groups = this._groups, j = 0, m = groups.length; j < m; ++j) {
      for (var group = groups[j], i = 0, n = group.length; i < n; ++i) {
        var node = group[i];
        if (node) return node;
      }
    }
    return null;
  }
  var init_node = __esm({
    "../usr/local/lib/node_modules/d3/node_modules/d3-selection/src/selection/node.js"() {
    }
  });

  // ../usr/local/lib/node_modules/d3/node_modules/d3-selection/src/selection/size.js
  function size_default() {
    let size = 0;
    for (const node of this) ++size;
    return size;
  }
  var init_size = __esm({
    "../usr/local/lib/node_modules/d3/node_modules/d3-selection/src/selection/size.js"() {
    }
  });

  // ../usr/local/lib/node_modules/d3/node_modules/d3-selection/src/selection/empty.js
  function empty_default() {
    return !this.node();
  }
  var init_empty = __esm({
    "../usr/local/lib/node_modules/d3/node_modules/d3-selection/src/selection/empty.js"() {
    }
  });

  // ../usr/local/lib/node_modules/d3/node_modules/d3-selection/src/selection/each.js
  function each_default(callback) {
    for (var groups = this._groups, j = 0, m = groups.length; j < m; ++j) {
      for (var group = groups[j], i = 0, n = group.length, node; i < n; ++i) {
        if (node = group[i]) callback.call(node, node.__data__, i, group);
      }
    }
    return this;
  }
  var init_each = __esm({
    "../usr/local/lib/node_modules/d3/node_modules/d3-selection/src/selection/each.js"() {
    }
  });

  // ../usr/local/lib/node_modules/d3/node_modules/d3-selection/src/selection/attr.js
  function attrRemove(name) {
    return function() {
      this.removeAttribute(name);
    };
  }
  function attrRemoveNS(fullname) {
    return function() {
      this.removeAttributeNS(fullname.space, fullname.local);
    };
  }
  function attrConstant(name, value) {
    return function() {
      this.setAttribute(name, value);
    };
  }
  function attrConstantNS(fullname, value) {
    return function() {
      this.setAttributeNS(fullname.space, fullname.local, value);
    };
  }
  function attrFunction(name, value) {
    return function() {
      var v = value.apply(this, arguments);
      if (v == null) this.removeAttribute(name);
      else this.setAttribute(name, v);
    };
  }
  function attrFunctionNS(fullname, value) {
    return function() {
      var v = value.apply(this, arguments);
      if (v == null) this.removeAttributeNS(fullname.space, fullname.local);
      else this.setAttributeNS(fullname.space, fullname.local, v);
    };
  }
  function attr_default(name, value) {
    var fullname = namespace_default(name);
    if (arguments.length < 2) {
      var node = this.node();
      return fullname.local ? node.getAttributeNS(fullname.space, fullname.local) : node.getAttribute(fullname);
    }
    return this.each((value == null ? fullname.local ? attrRemoveNS : attrRemove : typeof value === "function" ? fullname.local ? attrFunctionNS : attrFunction : fullname.local ? attrConstantNS : attrConstant)(fullname, value));
  }
  var init_attr = __esm({
    "../usr/local/lib/node_modules/d3/node_modules/d3-selection/src/selection/attr.js"() {
      init_namespace();
    }
  });

  // ../usr/local/lib/node_modules/d3/node_modules/d3-selection/src/window.js
  function window_default(node) {
    return node.ownerDocument && node.ownerDocument.defaultView || node.document && node || node.defaultView;
  }
  var init_window = __esm({
    "../usr/local/lib/node_modules/d3/node_modules/d3-selection/src/window.js"() {
    }
  });

  // ../usr/local/lib/node_modules/d3/node_modules/d3-selection/src/selection/style.js
  function styleRemove(name) {
    return function() {
      this.style.removeProperty(name);
    };
  }
  function styleConstant(name, value, priority) {
    return function() {
      this.style.setProperty(name, value, priority);
    };
  }
  function styleFunction(name, value, priority) {
    return function() {
      var v = value.apply(this, arguments);
      if (v == null) this.style.removeProperty(name);
      else this.style.setProperty(name, v, priority);
    };
  }
  function style_default(name, value, priority) {
    return arguments.length > 1 ? this.each((value == null ? styleRemove : typeof value === "function" ? styleFunction : styleConstant)(name, value, priority == null ? "" : priority)) : styleValue(this.node(), name);
  }
  function styleValue(node, name) {
    return node.style.getPropertyValue(name) || window_default(node).getComputedStyle(node, null).getPropertyValue(name);
  }
  var init_style = __esm({
    "../usr/local/lib/node_modules/d3/node_modules/d3-selection/src/selection/style.js"() {
      init_window();
    }
  });

  // ../usr/local/lib/node_modules/d3/node_modules/d3-selection/src/selection/property.js
  function propertyRemove(name) {
    return function() {
      delete this[name];
    };
  }
  function propertyConstant(name, value) {
    return function() {
      this[name] = value;
    };
  }
  function propertyFunction(name, value) {
    return function() {
      var v = value.apply(this, arguments);
      if (v == null) delete this[name];
      else this[name] = v;
    };
  }
  function property_default(name, value) {
    return arguments.length > 1 ? this.each((value == null ? propertyRemove : typeof value === "function" ? propertyFunction : propertyConstant)(name, value)) : this.node()[name];
  }
  var init_property = __esm({
    "../usr/local/lib/node_modules/d3/node_modules/d3-selection/src/selection/property.js"() {
    }
  });

  // ../usr/local/lib/node_modules/d3/node_modules/d3-selection/src/selection/classed.js
  function classArray(string) {
    return string.trim().split(/^|\s+/);
  }
  function classList(node) {
    return node.classList || new ClassList(node);
  }
  function ClassList(node) {
    this._node = node;
    this._names = classArray(node.getAttribute("class") || "");
  }
  function classedAdd(node, names) {
    var list = classList(node), i = -1, n = names.length;
    while (++i < n) list.add(names[i]);
  }
  function classedRemove(node, names) {
    var list = classList(node), i = -1, n = names.length;
    while (++i < n) list.remove(names[i]);
  }
  function classedTrue(names) {
    return function() {
      classedAdd(this, names);
    };
  }
  function classedFalse(names) {
    return function() {
      classedRemove(this, names);
    };
  }
  function classedFunction(names, value) {
    return function() {
      (value.apply(this, arguments) ? classedAdd : classedRemove)(this, names);
    };
  }
  function classed_default(name, value) {
    var names = classArray(name + "");
    if (arguments.length < 2) {
      var list = classList(this.node()), i = -1, n = names.length;
      while (++i < n) if (!list.contains(names[i])) return false;
      return true;
    }
    return this.each((typeof value === "function" ? classedFunction : value ? classedTrue : classedFalse)(names, value));
  }
  var init_classed = __esm({
    "../usr/local/lib/node_modules/d3/node_modules/d3-selection/src/selection/classed.js"() {
      ClassList.prototype = {
        add: function(name) {
          var i = this._names.indexOf(name);
          if (i < 0) {
            this._names.push(name);
            this._node.setAttribute("class", this._names.join(" "));
          }
        },
        remove: function(name) {
          var i = this._names.indexOf(name);
          if (i >= 0) {
            this._names.splice(i, 1);
            this._node.setAttribute("class", this._names.join(" "));
          }
        },
        contains: function(name) {
          return this._names.indexOf(name) >= 0;
        }
      };
    }
  });

  // ../usr/local/lib/node_modules/d3/node_modules/d3-selection/src/selection/text.js
  function textRemove() {
    this.textContent = "";
  }
  function textConstant(value) {
    return function() {
      this.textContent = value;
    };
  }
  function textFunction(value) {
    return function() {
      var v = value.apply(this, arguments);
      this.textContent = v == null ? "" : v;
    };
  }
  function text_default(value) {
    return arguments.length ? this.each(value == null ? textRemove : (typeof value === "function" ? textFunction : textConstant)(value)) : this.node().textContent;
  }
  var init_text = __esm({
    "../usr/local/lib/node_modules/d3/node_modules/d3-selection/src/selection/text.js"() {
    }
  });

  // ../usr/local/lib/node_modules/d3/node_modules/d3-selection/src/selection/html.js
  function htmlRemove() {
    this.innerHTML = "";
  }
  function htmlConstant(value) {
    return function() {
      this.innerHTML = value;
    };
  }
  function htmlFunction(value) {
    return function() {
      var v = value.apply(this, arguments);
      this.innerHTML = v == null ? "" : v;
    };
  }
  function html_default(value) {
    return arguments.length ? this.each(value == null ? htmlRemove : (typeof value === "function" ? htmlFunction : htmlConstant)(value)) : this.node().innerHTML;
  }
  var init_html = __esm({
    "../usr/local/lib/node_modules/d3/node_modules/d3-selection/src/selection/html.js"() {
    }
  });

  // ../usr/local/lib/node_modules/d3/node_modules/d3-selection/src/selection/raise.js
  function raise() {
    if (this.nextSibling) this.parentNode.appendChild(this);
  }
  function raise_default() {
    return this.each(raise);
  }
  var init_raise = __esm({
    "../usr/local/lib/node_modules/d3/node_modules/d3-selection/src/selection/raise.js"() {
    }
  });

  // ../usr/local/lib/node_modules/d3/node_modules/d3-selection/src/selection/lower.js
  function lower() {
    if (this.previousSibling) this.parentNode.insertBefore(this, this.parentNode.firstChild);
  }
  function lower_default() {
    return this.each(lower);
  }
  var init_lower = __esm({
    "../usr/local/lib/node_modules/d3/node_modules/d3-selection/src/selection/lower.js"() {
    }
  });

  // ../usr/local/lib/node_modules/d3/node_modules/d3-selection/src/selection/append.js
  function append_default(name) {
    var create2 = typeof name === "function" ? name : creator_default(name);
    return this.select(function() {
      return this.appendChild(create2.apply(this, arguments));
    });
  }
  var init_append = __esm({
    "../usr/local/lib/node_modules/d3/node_modules/d3-selection/src/selection/append.js"() {
      init_creator();
    }
  });

  // ../usr/local/lib/node_modules/d3/node_modules/d3-selection/src/selection/insert.js
  function constantNull() {
    return null;
  }
  function insert_default(name, before) {
    var create2 = typeof name === "function" ? name : creator_default(name), select = before == null ? constantNull : typeof before === "function" ? before : selector_default(before);
    return this.select(function() {
      return this.insertBefore(create2.apply(this, arguments), select.apply(this, arguments) || null);
    });
  }
  var init_insert = __esm({
    "../usr/local/lib/node_modules/d3/node_modules/d3-selection/src/selection/insert.js"() {
      init_creator();
      init_selector();
    }
  });

  // ../usr/local/lib/node_modules/d3/node_modules/d3-selection/src/selection/remove.js
  function remove() {
    var parent = this.parentNode;
    if (parent) parent.removeChild(this);
  }
  function remove_default() {
    return this.each(remove);
  }
  var init_remove = __esm({
    "../usr/local/lib/node_modules/d3/node_modules/d3-selection/src/selection/remove.js"() {
    }
  });

  // ../usr/local/lib/node_modules/d3/node_modules/d3-selection/src/selection/clone.js
  function selection_cloneShallow() {
    var clone = this.cloneNode(false), parent = this.parentNode;
    return parent ? parent.insertBefore(clone, this.nextSibling) : clone;
  }
  function selection_cloneDeep() {
    var clone = this.cloneNode(true), parent = this.parentNode;
    return parent ? parent.insertBefore(clone, this.nextSibling) : clone;
  }
  function clone_default(deep) {
    return this.select(deep ? selection_cloneDeep : selection_cloneShallow);
  }
  var init_clone = __esm({
    "../usr/local/lib/node_modules/d3/node_modules/d3-selection/src/selection/clone.js"() {
    }
  });

  // ../usr/local/lib/node_modules/d3/node_modules/d3-selection/src/selection/datum.js
  function datum_default(value) {
    return arguments.length ? this.property("__data__", value) : this.node().__data__;
  }
  var init_datum = __esm({
    "../usr/local/lib/node_modules/d3/node_modules/d3-selection/src/selection/datum.js"() {
    }
  });

  // ../usr/local/lib/node_modules/d3/node_modules/d3-selection/src/selection/on.js
  function contextListener(listener) {
    return function(event) {
      listener.call(this, event, this.__data__);
    };
  }
  function parseTypenames2(typenames) {
    return typenames.trim().split(/^|\s+/).map(function(t) {
      var name = "", i = t.indexOf(".");
      if (i >= 0) name = t.slice(i + 1), t = t.slice(0, i);
      return { type: t, name };
    });
  }
  function onRemove(typename) {
    return function() {
      var on = this.__on;
      if (!on) return;
      for (var j = 0, i = -1, m = on.length, o; j < m; ++j) {
        if (o = on[j], (!typename.type || o.type === typename.type) && o.name === typename.name) {
          this.removeEventListener(o.type, o.listener, o.options);
        } else {
          on[++i] = o;
        }
      }
      if (++i) on.length = i;
      else delete this.__on;
    };
  }
  function onAdd(typename, value, options) {
    return function() {
      var on = this.__on, o, listener = contextListener(value);
      if (on) for (var j = 0, m = on.length; j < m; ++j) {
        if ((o = on[j]).type === typename.type && o.name === typename.name) {
          this.removeEventListener(o.type, o.listener, o.options);
          this.addEventListener(o.type, o.listener = listener, o.options = options);
          o.value = value;
          return;
        }
      }
      this.addEventListener(typename.type, listener, options);
      o = { type: typename.type, name: typename.name, value, listener, options };
      if (!on) this.__on = [o];
      else on.push(o);
    };
  }
  function on_default(typename, value, options) {
    var typenames = parseTypenames2(typename + ""), i, n = typenames.length, t;
    if (arguments.length < 2) {
      var on = this.node().__on;
      if (on) for (var j = 0, m = on.length, o; j < m; ++j) {
        for (i = 0, o = on[j]; i < n; ++i) {
          if ((t = typenames[i]).type === o.type && t.name === o.name) {
            return o.value;
          }
        }
      }
      return;
    }
    on = value ? onAdd : onRemove;
    for (i = 0; i < n; ++i) this.each(on(typenames[i], value, options));
    return this;
  }
  var init_on = __esm({
    "../usr/local/lib/node_modules/d3/node_modules/d3-selection/src/selection/on.js"() {
    }
  });

  // ../usr/local/lib/node_modules/d3/node_modules/d3-selection/src/selection/dispatch.js
  function dispatchEvent(node, type2, params) {
    var window2 = window_default(node), event = window2.CustomEvent;
    if (typeof event === "function") {
      event = new event(type2, params);
    } else {
      event = window2.document.createEvent("Event");
      if (params) event.initEvent(type2, params.bubbles, params.cancelable), event.detail = params.detail;
      else event.initEvent(type2, false, false);
    }
    node.dispatchEvent(event);
  }
  function dispatchConstant(type2, params) {
    return function() {
      return dispatchEvent(this, type2, params);
    };
  }
  function dispatchFunction(type2, params) {
    return function() {
      return dispatchEvent(this, type2, params.apply(this, arguments));
    };
  }
  function dispatch_default2(type2, params) {
    return this.each((typeof params === "function" ? dispatchFunction : dispatchConstant)(type2, params));
  }
  var init_dispatch2 = __esm({
    "../usr/local/lib/node_modules/d3/node_modules/d3-selection/src/selection/dispatch.js"() {
      init_window();
    }
  });

  // ../usr/local/lib/node_modules/d3/node_modules/d3-selection/src/selection/iterator.js
  function* iterator_default() {
    for (var groups = this._groups, j = 0, m = groups.length; j < m; ++j) {
      for (var group = groups[j], i = 0, n = group.length, node; i < n; ++i) {
        if (node = group[i]) yield node;
      }
    }
  }
  var init_iterator = __esm({
    "../usr/local/lib/node_modules/d3/node_modules/d3-selection/src/selection/iterator.js"() {
    }
  });

  // ../usr/local/lib/node_modules/d3/node_modules/d3-selection/src/selection/index.js
  function Selection(groups, parents) {
    this._groups = groups;
    this._parents = parents;
  }
  function selection() {
    return new Selection([[document.documentElement]], root);
  }
  function selection_selection() {
    return this;
  }
  var root, selection_default;
  var init_selection = __esm({
    "../usr/local/lib/node_modules/d3/node_modules/d3-selection/src/selection/index.js"() {
      init_select();
      init_selectAll();
      init_selectChild();
      init_selectChildren();
      init_filter();
      init_data();
      init_enter();
      init_exit();
      init_join();
      init_merge();
      init_order();
      init_sort();
      init_call();
      init_nodes();
      init_node();
      init_size();
      init_empty();
      init_each();
      init_attr();
      init_style();
      init_property();
      init_classed();
      init_text();
      init_html();
      init_raise();
      init_lower();
      init_append();
      init_insert();
      init_remove();
      init_clone();
      init_datum();
      init_on();
      init_dispatch2();
      init_iterator();
      root = [null];
      Selection.prototype = selection.prototype = {
        constructor: Selection,
        select: select_default,
        selectAll: selectAll_default,
        selectChild: selectChild_default,
        selectChildren: selectChildren_default,
        filter: filter_default,
        data: data_default,
        enter: enter_default,
        exit: exit_default,
        join: join_default,
        merge: merge_default,
        selection: selection_selection,
        order: order_default,
        sort: sort_default,
        call: call_default,
        nodes: nodes_default,
        node: node_default,
        size: size_default,
        empty: empty_default,
        each: each_default,
        attr: attr_default,
        style: style_default,
        property: property_default,
        classed: classed_default,
        text: text_default,
        html: html_default,
        raise: raise_default,
        lower: lower_default,
        append: append_default,
        insert: insert_default,
        remove: remove_default,
        clone: clone_default,
        datum: datum_default,
        on: on_default,
        dispatch: dispatch_default2,
        [Symbol.iterator]: iterator_default
      };
      selection_default = selection;
    }
  });

  // ../usr/local/lib/node_modules/d3/node_modules/d3-selection/src/select.js
  function select_default2(selector) {
    return typeof selector === "string" ? new Selection([[document.querySelector(selector)]], [document.documentElement]) : new Selection([[selector]], root);
  }
  var init_select2 = __esm({
    "../usr/local/lib/node_modules/d3/node_modules/d3-selection/src/select.js"() {
      init_selection();
    }
  });

  // ../usr/local/lib/node_modules/d3/node_modules/d3-selection/src/index.js
  var init_src4 = __esm({
    "../usr/local/lib/node_modules/d3/node_modules/d3-selection/src/index.js"() {
      init_matcher();
      init_namespace();
      init_select2();
      init_selection();
      init_selector();
      init_selectorAll();
      init_style();
    }
  });

  // ../usr/local/lib/node_modules/d3/node_modules/d3-drag/src/index.js
  var init_src5 = __esm({
    "../usr/local/lib/node_modules/d3/node_modules/d3-drag/src/index.js"() {
    }
  });

  // ../usr/local/lib/node_modules/d3/node_modules/d3-color/src/define.js
  function define_default(constructor, factory, prototype) {
    constructor.prototype = factory.prototype = prototype;
    prototype.constructor = constructor;
  }
  function extend(parent, definition) {
    var prototype = Object.create(parent.prototype);
    for (var key in definition) prototype[key] = definition[key];
    return prototype;
  }
  var init_define = __esm({
    "../usr/local/lib/node_modules/d3/node_modules/d3-color/src/define.js"() {
    }
  });

  // ../usr/local/lib/node_modules/d3/node_modules/d3-color/src/color.js
  function Color() {
  }
  function color_formatHex() {
    return this.rgb().formatHex();
  }
  function color_formatHex8() {
    return this.rgb().formatHex8();
  }
  function color_formatHsl() {
    return hslConvert(this).formatHsl();
  }
  function color_formatRgb() {
    return this.rgb().formatRgb();
  }
  function color(format2) {
    var m, l;
    format2 = (format2 + "").trim().toLowerCase();
    return (m = reHex.exec(format2)) ? (l = m[1].length, m = parseInt(m[1], 16), l === 6 ? rgbn(m) : l === 3 ? new Rgb(m >> 8 & 15 | m >> 4 & 240, m >> 4 & 15 | m & 240, (m & 15) << 4 | m & 15, 1) : l === 8 ? rgba(m >> 24 & 255, m >> 16 & 255, m >> 8 & 255, (m & 255) / 255) : l === 4 ? rgba(m >> 12 & 15 | m >> 8 & 240, m >> 8 & 15 | m >> 4 & 240, m >> 4 & 15 | m & 240, ((m & 15) << 4 | m & 15) / 255) : null) : (m = reRgbInteger.exec(format2)) ? new Rgb(m[1], m[2], m[3], 1) : (m = reRgbPercent.exec(format2)) ? new Rgb(m[1] * 255 / 100, m[2] * 255 / 100, m[3] * 255 / 100, 1) : (m = reRgbaInteger.exec(format2)) ? rgba(m[1], m[2], m[3], m[4]) : (m = reRgbaPercent.exec(format2)) ? rgba(m[1] * 255 / 100, m[2] * 255 / 100, m[3] * 255 / 100, m[4]) : (m = reHslPercent.exec(format2)) ? hsla(m[1], m[2] / 100, m[3] / 100, 1) : (m = reHslaPercent.exec(format2)) ? hsla(m[1], m[2] / 100, m[3] / 100, m[4]) : named.hasOwnProperty(format2) ? rgbn(named[format2]) : format2 === "transparent" ? new Rgb(NaN, NaN, NaN, 0) : null;
  }
  function rgbn(n) {
    return new Rgb(n >> 16 & 255, n >> 8 & 255, n & 255, 1);
  }
  function rgba(r, g, b, a) {
    if (a <= 0) r = g = b = NaN;
    return new Rgb(r, g, b, a);
  }
  function rgbConvert(o) {
    if (!(o instanceof Color)) o = color(o);
    if (!o) return new Rgb();
    o = o.rgb();
    return new Rgb(o.r, o.g, o.b, o.opacity);
  }
  function rgb(r, g, b, opacity) {
    return arguments.length === 1 ? rgbConvert(r) : new Rgb(r, g, b, opacity == null ? 1 : opacity);
  }
  function Rgb(r, g, b, opacity) {
    this.r = +r;
    this.g = +g;
    this.b = +b;
    this.opacity = +opacity;
  }
  function rgb_formatHex() {
    return `#${hex(this.r)}${hex(this.g)}${hex(this.b)}`;
  }
  function rgb_formatHex8() {
    return `#${hex(this.r)}${hex(this.g)}${hex(this.b)}${hex((isNaN(this.opacity) ? 1 : this.opacity) * 255)}`;
  }
  function rgb_formatRgb() {
    const a = clampa(this.opacity);
    return `${a === 1 ? "rgb(" : "rgba("}${clampi(this.r)}, ${clampi(this.g)}, ${clampi(this.b)}${a === 1 ? ")" : `, ${a})`}`;
  }
  function clampa(opacity) {
    return isNaN(opacity) ? 1 : Math.max(0, Math.min(1, opacity));
  }
  function clampi(value) {
    return Math.max(0, Math.min(255, Math.round(value) || 0));
  }
  function hex(value) {
    value = clampi(value);
    return (value < 16 ? "0" : "") + value.toString(16);
  }
  function hsla(h, s, l, a) {
    if (a <= 0) h = s = l = NaN;
    else if (l <= 0 || l >= 1) h = s = NaN;
    else if (s <= 0) h = NaN;
    return new Hsl(h, s, l, a);
  }
  function hslConvert(o) {
    if (o instanceof Hsl) return new Hsl(o.h, o.s, o.l, o.opacity);
    if (!(o instanceof Color)) o = color(o);
    if (!o) return new Hsl();
    if (o instanceof Hsl) return o;
    o = o.rgb();
    var r = o.r / 255, g = o.g / 255, b = o.b / 255, min2 = Math.min(r, g, b), max3 = Math.max(r, g, b), h = NaN, s = max3 - min2, l = (max3 + min2) / 2;
    if (s) {
      if (r === max3) h = (g - b) / s + (g < b) * 6;
      else if (g === max3) h = (b - r) / s + 2;
      else h = (r - g) / s + 4;
      s /= l < 0.5 ? max3 + min2 : 2 - max3 - min2;
      h *= 60;
    } else {
      s = l > 0 && l < 1 ? 0 : h;
    }
    return new Hsl(h, s, l, o.opacity);
  }
  function hsl(h, s, l, opacity) {
    return arguments.length === 1 ? hslConvert(h) : new Hsl(h, s, l, opacity == null ? 1 : opacity);
  }
  function Hsl(h, s, l, opacity) {
    this.h = +h;
    this.s = +s;
    this.l = +l;
    this.opacity = +opacity;
  }
  function clamph(value) {
    value = (value || 0) % 360;
    return value < 0 ? value + 360 : value;
  }
  function clampt(value) {
    return Math.max(0, Math.min(1, value || 0));
  }
  function hsl2rgb(h, m1, m2) {
    return (h < 60 ? m1 + (m2 - m1) * h / 60 : h < 180 ? m2 : h < 240 ? m1 + (m2 - m1) * (240 - h) / 60 : m1) * 255;
  }
  var darker, brighter, reI, reN, reP, reHex, reRgbInteger, reRgbPercent, reRgbaInteger, reRgbaPercent, reHslPercent, reHslaPercent, named;
  var init_color = __esm({
    "../usr/local/lib/node_modules/d3/node_modules/d3-color/src/color.js"() {
      init_define();
      darker = 0.7;
      brighter = 1 / darker;
      reI = "\\s*([+-]?\\d+)\\s*";
      reN = "\\s*([+-]?(?:\\d*\\.)?\\d+(?:[eE][+-]?\\d+)?)\\s*";
      reP = "\\s*([+-]?(?:\\d*\\.)?\\d+(?:[eE][+-]?\\d+)?)%\\s*";
      reHex = /^#([0-9a-f]{3,8})$/;
      reRgbInteger = new RegExp(`^rgb\\(${reI},${reI},${reI}\\)$`);
      reRgbPercent = new RegExp(`^rgb\\(${reP},${reP},${reP}\\)$`);
      reRgbaInteger = new RegExp(`^rgba\\(${reI},${reI},${reI},${reN}\\)$`);
      reRgbaPercent = new RegExp(`^rgba\\(${reP},${reP},${reP},${reN}\\)$`);
      reHslPercent = new RegExp(`^hsl\\(${reN},${reP},${reP}\\)$`);
      reHslaPercent = new RegExp(`^hsla\\(${reN},${reP},${reP},${reN}\\)$`);
      named = {
        aliceblue: 15792383,
        antiquewhite: 16444375,
        aqua: 65535,
        aquamarine: 8388564,
        azure: 15794175,
        beige: 16119260,
        bisque: 16770244,
        black: 0,
        blanchedalmond: 16772045,
        blue: 255,
        blueviolet: 9055202,
        brown: 10824234,
        burlywood: 14596231,
        cadetblue: 6266528,
        chartreuse: 8388352,
        chocolate: 13789470,
        coral: 16744272,
        cornflowerblue: 6591981,
        cornsilk: 16775388,
        crimson: 14423100,
        cyan: 65535,
        darkblue: 139,
        darkcyan: 35723,
        darkgoldenrod: 12092939,
        darkgray: 11119017,
        darkgreen: 25600,
        darkgrey: 11119017,
        darkkhaki: 12433259,
        darkmagenta: 9109643,
        darkolivegreen: 5597999,
        darkorange: 16747520,
        darkorchid: 10040012,
        darkred: 9109504,
        darksalmon: 15308410,
        darkseagreen: 9419919,
        darkslateblue: 4734347,
        darkslategray: 3100495,
        darkslategrey: 3100495,
        darkturquoise: 52945,
        darkviolet: 9699539,
        deeppink: 16716947,
        deepskyblue: 49151,
        dimgray: 6908265,
        dimgrey: 6908265,
        dodgerblue: 2003199,
        firebrick: 11674146,
        floralwhite: 16775920,
        forestgreen: 2263842,
        fuchsia: 16711935,
        gainsboro: 14474460,
        ghostwhite: 16316671,
        gold: 16766720,
        goldenrod: 14329120,
        gray: 8421504,
        green: 32768,
        greenyellow: 11403055,
        grey: 8421504,
        honeydew: 15794160,
        hotpink: 16738740,
        indianred: 13458524,
        indigo: 4915330,
        ivory: 16777200,
        khaki: 15787660,
        lavender: 15132410,
        lavenderblush: 16773365,
        lawngreen: 8190976,
        lemonchiffon: 16775885,
        lightblue: 11393254,
        lightcoral: 15761536,
        lightcyan: 14745599,
        lightgoldenrodyellow: 16448210,
        lightgray: 13882323,
        lightgreen: 9498256,
        lightgrey: 13882323,
        lightpink: 16758465,
        lightsalmon: 16752762,
        lightseagreen: 2142890,
        lightskyblue: 8900346,
        lightslategray: 7833753,
        lightslategrey: 7833753,
        lightsteelblue: 11584734,
        lightyellow: 16777184,
        lime: 65280,
        limegreen: 3329330,
        linen: 16445670,
        magenta: 16711935,
        maroon: 8388608,
        mediumaquamarine: 6737322,
        mediumblue: 205,
        mediumorchid: 12211667,
        mediumpurple: 9662683,
        mediumseagreen: 3978097,
        mediumslateblue: 8087790,
        mediumspringgreen: 64154,
        mediumturquoise: 4772300,
        mediumvioletred: 13047173,
        midnightblue: 1644912,
        mintcream: 16121850,
        mistyrose: 16770273,
        moccasin: 16770229,
        navajowhite: 16768685,
        navy: 128,
        oldlace: 16643558,
        olive: 8421376,
        olivedrab: 7048739,
        orange: 16753920,
        orangered: 16729344,
        orchid: 14315734,
        palegoldenrod: 15657130,
        palegreen: 10025880,
        paleturquoise: 11529966,
        palevioletred: 14381203,
        papayawhip: 16773077,
        peachpuff: 16767673,
        peru: 13468991,
        pink: 16761035,
        plum: 14524637,
        powderblue: 11591910,
        purple: 8388736,
        rebeccapurple: 6697881,
        red: 16711680,
        rosybrown: 12357519,
        royalblue: 4286945,
        saddlebrown: 9127187,
        salmon: 16416882,
        sandybrown: 16032864,
        seagreen: 3050327,
        seashell: 16774638,
        sienna: 10506797,
        silver: 12632256,
        skyblue: 8900331,
        slateblue: 6970061,
        slategray: 7372944,
        slategrey: 7372944,
        snow: 16775930,
        springgreen: 65407,
        steelblue: 4620980,
        tan: 13808780,
        teal: 32896,
        thistle: 14204888,
        tomato: 16737095,
        turquoise: 4251856,
        violet: 15631086,
        wheat: 16113331,
        white: 16777215,
        whitesmoke: 16119285,
        yellow: 16776960,
        yellowgreen: 10145074
      };
      define_default(Color, color, {
        copy(channels) {
          return Object.assign(new this.constructor(), this, channels);
        },
        displayable() {
          return this.rgb().displayable();
        },
        hex: color_formatHex,
        // Deprecated! Use color.formatHex.
        formatHex: color_formatHex,
        formatHex8: color_formatHex8,
        formatHsl: color_formatHsl,
        formatRgb: color_formatRgb,
        toString: color_formatRgb
      });
      define_default(Rgb, rgb, extend(Color, {
        brighter(k) {
          k = k == null ? brighter : Math.pow(brighter, k);
          return new Rgb(this.r * k, this.g * k, this.b * k, this.opacity);
        },
        darker(k) {
          k = k == null ? darker : Math.pow(darker, k);
          return new Rgb(this.r * k, this.g * k, this.b * k, this.opacity);
        },
        rgb() {
          return this;
        },
        clamp() {
          return new Rgb(clampi(this.r), clampi(this.g), clampi(this.b), clampa(this.opacity));
        },
        displayable() {
          return -0.5 <= this.r && this.r < 255.5 && (-0.5 <= this.g && this.g < 255.5) && (-0.5 <= this.b && this.b < 255.5) && (0 <= this.opacity && this.opacity <= 1);
        },
        hex: rgb_formatHex,
        // Deprecated! Use color.formatHex.
        formatHex: rgb_formatHex,
        formatHex8: rgb_formatHex8,
        formatRgb: rgb_formatRgb,
        toString: rgb_formatRgb
      }));
      define_default(Hsl, hsl, extend(Color, {
        brighter(k) {
          k = k == null ? brighter : Math.pow(brighter, k);
          return new Hsl(this.h, this.s, this.l * k, this.opacity);
        },
        darker(k) {
          k = k == null ? darker : Math.pow(darker, k);
          return new Hsl(this.h, this.s, this.l * k, this.opacity);
        },
        rgb() {
          var h = this.h % 360 + (this.h < 0) * 360, s = isNaN(h) || isNaN(this.s) ? 0 : this.s, l = this.l, m2 = l + (l < 0.5 ? l : 1 - l) * s, m1 = 2 * l - m2;
          return new Rgb(
            hsl2rgb(h >= 240 ? h - 240 : h + 120, m1, m2),
            hsl2rgb(h, m1, m2),
            hsl2rgb(h < 120 ? h + 240 : h - 120, m1, m2),
            this.opacity
          );
        },
        clamp() {
          return new Hsl(clamph(this.h), clampt(this.s), clampt(this.l), clampa(this.opacity));
        },
        displayable() {
          return (0 <= this.s && this.s <= 1 || isNaN(this.s)) && (0 <= this.l && this.l <= 1) && (0 <= this.opacity && this.opacity <= 1);
        },
        formatHsl() {
          const a = clampa(this.opacity);
          return `${a === 1 ? "hsl(" : "hsla("}${clamph(this.h)}, ${clampt(this.s) * 100}%, ${clampt(this.l) * 100}%${a === 1 ? ")" : `, ${a})`}`;
        }
      }));
    }
  });

  // ../usr/local/lib/node_modules/d3/node_modules/d3-color/src/index.js
  var init_src6 = __esm({
    "../usr/local/lib/node_modules/d3/node_modules/d3-color/src/index.js"() {
      init_color();
    }
  });

  // ../usr/local/lib/node_modules/d3/node_modules/d3-interpolate/src/basis.js
  function basis(t12, v0, v1, v2, v3) {
    var t2 = t12 * t12, t3 = t2 * t12;
    return ((1 - 3 * t12 + 3 * t2 - t3) * v0 + (4 - 6 * t2 + 3 * t3) * v1 + (1 + 3 * t12 + 3 * t2 - 3 * t3) * v2 + t3 * v3) / 6;
  }
  function basis_default(values) {
    var n = values.length - 1;
    return function(t) {
      var i = t <= 0 ? t = 0 : t >= 1 ? (t = 1, n - 1) : Math.floor(t * n), v1 = values[i], v2 = values[i + 1], v0 = i > 0 ? values[i - 1] : 2 * v1 - v2, v3 = i < n - 1 ? values[i + 2] : 2 * v2 - v1;
      return basis((t - i / n) * n, v0, v1, v2, v3);
    };
  }
  var init_basis = __esm({
    "../usr/local/lib/node_modules/d3/node_modules/d3-interpolate/src/basis.js"() {
    }
  });

  // ../usr/local/lib/node_modules/d3/node_modules/d3-interpolate/src/basisClosed.js
  function basisClosed_default(values) {
    var n = values.length;
    return function(t) {
      var i = Math.floor(((t %= 1) < 0 ? ++t : t) * n), v0 = values[(i + n - 1) % n], v1 = values[i % n], v2 = values[(i + 1) % n], v3 = values[(i + 2) % n];
      return basis((t - i / n) * n, v0, v1, v2, v3);
    };
  }
  var init_basisClosed = __esm({
    "../usr/local/lib/node_modules/d3/node_modules/d3-interpolate/src/basisClosed.js"() {
      init_basis();
    }
  });

  // ../usr/local/lib/node_modules/d3/node_modules/d3-interpolate/src/constant.js
  var constant_default2;
  var init_constant2 = __esm({
    "../usr/local/lib/node_modules/d3/node_modules/d3-interpolate/src/constant.js"() {
      constant_default2 = (x) => () => x;
    }
  });

  // ../usr/local/lib/node_modules/d3/node_modules/d3-interpolate/src/color.js
  function linear(a, d) {
    return function(t) {
      return a + t * d;
    };
  }
  function exponential(a, b, y) {
    return a = Math.pow(a, y), b = Math.pow(b, y) - a, y = 1 / y, function(t) {
      return Math.pow(a + t * b, y);
    };
  }
  function gamma(y) {
    return (y = +y) === 1 ? nogamma : function(a, b) {
      return b - a ? exponential(a, b, y) : constant_default2(isNaN(a) ? b : a);
    };
  }
  function nogamma(a, b) {
    var d = b - a;
    return d ? linear(a, d) : constant_default2(isNaN(a) ? b : a);
  }
  var init_color2 = __esm({
    "../usr/local/lib/node_modules/d3/node_modules/d3-interpolate/src/color.js"() {
      init_constant2();
    }
  });

  // ../usr/local/lib/node_modules/d3/node_modules/d3-interpolate/src/rgb.js
  function rgbSpline(spline) {
    return function(colors) {
      var n = colors.length, r = new Array(n), g = new Array(n), b = new Array(n), i, color2;
      for (i = 0; i < n; ++i) {
        color2 = rgb(colors[i]);
        r[i] = color2.r || 0;
        g[i] = color2.g || 0;
        b[i] = color2.b || 0;
      }
      r = spline(r);
      g = spline(g);
      b = spline(b);
      color2.opacity = 1;
      return function(t) {
        color2.r = r(t);
        color2.g = g(t);
        color2.b = b(t);
        return color2 + "";
      };
    };
  }
  var rgb_default, rgbBasis, rgbBasisClosed;
  var init_rgb = __esm({
    "../usr/local/lib/node_modules/d3/node_modules/d3-interpolate/src/rgb.js"() {
      init_src6();
      init_basis();
      init_basisClosed();
      init_color2();
      rgb_default = function rgbGamma(y) {
        var color2 = gamma(y);
        function rgb2(start2, end) {
          var r = color2((start2 = rgb(start2)).r, (end = rgb(end)).r), g = color2(start2.g, end.g), b = color2(start2.b, end.b), opacity = nogamma(start2.opacity, end.opacity);
          return function(t) {
            start2.r = r(t);
            start2.g = g(t);
            start2.b = b(t);
            start2.opacity = opacity(t);
            return start2 + "";
          };
        }
        rgb2.gamma = rgbGamma;
        return rgb2;
      }(1);
      rgbBasis = rgbSpline(basis_default);
      rgbBasisClosed = rgbSpline(basisClosed_default);
    }
  });

  // ../usr/local/lib/node_modules/d3/node_modules/d3-interpolate/src/numberArray.js
  function numberArray_default(a, b) {
    if (!b) b = [];
    var n = a ? Math.min(b.length, a.length) : 0, c = b.slice(), i;
    return function(t) {
      for (i = 0; i < n; ++i) c[i] = a[i] * (1 - t) + b[i] * t;
      return c;
    };
  }
  function isNumberArray(x) {
    return ArrayBuffer.isView(x) && !(x instanceof DataView);
  }
  var init_numberArray = __esm({
    "../usr/local/lib/node_modules/d3/node_modules/d3-interpolate/src/numberArray.js"() {
    }
  });

  // ../usr/local/lib/node_modules/d3/node_modules/d3-interpolate/src/array.js
  function genericArray(a, b) {
    var nb = b ? b.length : 0, na = a ? Math.min(nb, a.length) : 0, x = new Array(na), c = new Array(nb), i;
    for (i = 0; i < na; ++i) x[i] = value_default(a[i], b[i]);
    for (; i < nb; ++i) c[i] = b[i];
    return function(t) {
      for (i = 0; i < na; ++i) c[i] = x[i](t);
      return c;
    };
  }
  var init_array2 = __esm({
    "../usr/local/lib/node_modules/d3/node_modules/d3-interpolate/src/array.js"() {
      init_value();
    }
  });

  // ../usr/local/lib/node_modules/d3/node_modules/d3-interpolate/src/date.js
  function date_default(a, b) {
    var d = /* @__PURE__ */ new Date();
    return a = +a, b = +b, function(t) {
      return d.setTime(a * (1 - t) + b * t), d;
    };
  }
  var init_date = __esm({
    "../usr/local/lib/node_modules/d3/node_modules/d3-interpolate/src/date.js"() {
    }
  });

  // ../usr/local/lib/node_modules/d3/node_modules/d3-interpolate/src/number.js
  function number_default(a, b) {
    return a = +a, b = +b, function(t) {
      return a * (1 - t) + b * t;
    };
  }
  var init_number2 = __esm({
    "../usr/local/lib/node_modules/d3/node_modules/d3-interpolate/src/number.js"() {
    }
  });

  // ../usr/local/lib/node_modules/d3/node_modules/d3-interpolate/src/object.js
  function object_default(a, b) {
    var i = {}, c = {}, k;
    if (a === null || typeof a !== "object") a = {};
    if (b === null || typeof b !== "object") b = {};
    for (k in b) {
      if (k in a) {
        i[k] = value_default(a[k], b[k]);
      } else {
        c[k] = b[k];
      }
    }
    return function(t) {
      for (k in i) c[k] = i[k](t);
      return c;
    };
  }
  var init_object = __esm({
    "../usr/local/lib/node_modules/d3/node_modules/d3-interpolate/src/object.js"() {
      init_value();
    }
  });

  // ../usr/local/lib/node_modules/d3/node_modules/d3-interpolate/src/string.js
  function zero2(b) {
    return function() {
      return b;
    };
  }
  function one(b) {
    return function(t) {
      return b(t) + "";
    };
  }
  function string_default(a, b) {
    var bi = reA.lastIndex = reB.lastIndex = 0, am, bm, bs, i = -1, s = [], q = [];
    a = a + "", b = b + "";
    while ((am = reA.exec(a)) && (bm = reB.exec(b))) {
      if ((bs = bm.index) > bi) {
        bs = b.slice(bi, bs);
        if (s[i]) s[i] += bs;
        else s[++i] = bs;
      }
      if ((am = am[0]) === (bm = bm[0])) {
        if (s[i]) s[i] += bm;
        else s[++i] = bm;
      } else {
        s[++i] = null;
        q.push({ i, x: number_default(am, bm) });
      }
      bi = reB.lastIndex;
    }
    if (bi < b.length) {
      bs = b.slice(bi);
      if (s[i]) s[i] += bs;
      else s[++i] = bs;
    }
    return s.length < 2 ? q[0] ? one(q[0].x) : zero2(b) : (b = q.length, function(t) {
      for (var i2 = 0, o; i2 < b; ++i2) s[(o = q[i2]).i] = o.x(t);
      return s.join("");
    });
  }
  var reA, reB;
  var init_string = __esm({
    "../usr/local/lib/node_modules/d3/node_modules/d3-interpolate/src/string.js"() {
      init_number2();
      reA = /[-+]?(?:\d+\.?\d*|\.?\d+)(?:[eE][-+]?\d+)?/g;
      reB = new RegExp(reA.source, "g");
    }
  });

  // ../usr/local/lib/node_modules/d3/node_modules/d3-interpolate/src/value.js
  function value_default(a, b) {
    var t = typeof b, c;
    return b == null || t === "boolean" ? constant_default2(b) : (t === "number" ? number_default : t === "string" ? (c = color(b)) ? (b = c, rgb_default) : string_default : b instanceof color ? rgb_default : b instanceof Date ? date_default : isNumberArray(b) ? numberArray_default : Array.isArray(b) ? genericArray : typeof b.valueOf !== "function" && typeof b.toString !== "function" || isNaN(b) ? object_default : number_default)(a, b);
  }
  var init_value = __esm({
    "../usr/local/lib/node_modules/d3/node_modules/d3-interpolate/src/value.js"() {
      init_src6();
      init_rgb();
      init_array2();
      init_date();
      init_number2();
      init_object();
      init_string();
      init_constant2();
      init_numberArray();
    }
  });

  // ../usr/local/lib/node_modules/d3/node_modules/d3-interpolate/src/round.js
  function round_default(a, b) {
    return a = +a, b = +b, function(t) {
      return Math.round(a * (1 - t) + b * t);
    };
  }
  var init_round = __esm({
    "../usr/local/lib/node_modules/d3/node_modules/d3-interpolate/src/round.js"() {
    }
  });

  // ../usr/local/lib/node_modules/d3/node_modules/d3-interpolate/src/transform/decompose.js
  function decompose_default(a, b, c, d, e, f) {
    var scaleX, scaleY, skewX;
    if (scaleX = Math.sqrt(a * a + b * b)) a /= scaleX, b /= scaleX;
    if (skewX = a * c + b * d) c -= a * skewX, d -= b * skewX;
    if (scaleY = Math.sqrt(c * c + d * d)) c /= scaleY, d /= scaleY, skewX /= scaleY;
    if (a * d < b * c) a = -a, b = -b, skewX = -skewX, scaleX = -scaleX;
    return {
      translateX: e,
      translateY: f,
      rotate: Math.atan2(b, a) * degrees,
      skewX: Math.atan(skewX) * degrees,
      scaleX,
      scaleY
    };
  }
  var degrees, identity;
  var init_decompose = __esm({
    "../usr/local/lib/node_modules/d3/node_modules/d3-interpolate/src/transform/decompose.js"() {
      degrees = 180 / Math.PI;
      identity = {
        translateX: 0,
        translateY: 0,
        rotate: 0,
        skewX: 0,
        scaleX: 1,
        scaleY: 1
      };
    }
  });

  // ../usr/local/lib/node_modules/d3/node_modules/d3-interpolate/src/transform/parse.js
  function parseCss(value) {
    const m = new (typeof DOMMatrix === "function" ? DOMMatrix : WebKitCSSMatrix)(value + "");
    return m.isIdentity ? identity : decompose_default(m.a, m.b, m.c, m.d, m.e, m.f);
  }
  function parseSvg(value) {
    if (value == null) return identity;
    if (!svgNode) svgNode = document.createElementNS("http://www.w3.org/2000/svg", "g");
    svgNode.setAttribute("transform", value);
    if (!(value = svgNode.transform.baseVal.consolidate())) return identity;
    value = value.matrix;
    return decompose_default(value.a, value.b, value.c, value.d, value.e, value.f);
  }
  var svgNode;
  var init_parse = __esm({
    "../usr/local/lib/node_modules/d3/node_modules/d3-interpolate/src/transform/parse.js"() {
      init_decompose();
    }
  });

  // ../usr/local/lib/node_modules/d3/node_modules/d3-interpolate/src/transform/index.js
  function interpolateTransform(parse, pxComma, pxParen, degParen) {
    function pop(s) {
      return s.length ? s.pop() + " " : "";
    }
    function translate(xa, ya, xb, yb, s, q) {
      if (xa !== xb || ya !== yb) {
        var i = s.push("translate(", null, pxComma, null, pxParen);
        q.push({ i: i - 4, x: number_default(xa, xb) }, { i: i - 2, x: number_default(ya, yb) });
      } else if (xb || yb) {
        s.push("translate(" + xb + pxComma + yb + pxParen);
      }
    }
    function rotate(a, b, s, q) {
      if (a !== b) {
        if (a - b > 180) b += 360;
        else if (b - a > 180) a += 360;
        q.push({ i: s.push(pop(s) + "rotate(", null, degParen) - 2, x: number_default(a, b) });
      } else if (b) {
        s.push(pop(s) + "rotate(" + b + degParen);
      }
    }
    function skewX(a, b, s, q) {
      if (a !== b) {
        q.push({ i: s.push(pop(s) + "skewX(", null, degParen) - 2, x: number_default(a, b) });
      } else if (b) {
        s.push(pop(s) + "skewX(" + b + degParen);
      }
    }
    function scale(xa, ya, xb, yb, s, q) {
      if (xa !== xb || ya !== yb) {
        var i = s.push(pop(s) + "scale(", null, ",", null, ")");
        q.push({ i: i - 4, x: number_default(xa, xb) }, { i: i - 2, x: number_default(ya, yb) });
      } else if (xb !== 1 || yb !== 1) {
        s.push(pop(s) + "scale(" + xb + "," + yb + ")");
      }
    }
    return function(a, b) {
      var s = [], q = [];
      a = parse(a), b = parse(b);
      translate(a.translateX, a.translateY, b.translateX, b.translateY, s, q);
      rotate(a.rotate, b.rotate, s, q);
      skewX(a.skewX, b.skewX, s, q);
      scale(a.scaleX, a.scaleY, b.scaleX, b.scaleY, s, q);
      a = b = null;
      return function(t) {
        var i = -1, n = q.length, o;
        while (++i < n) s[(o = q[i]).i] = o.x(t);
        return s.join("");
      };
    };
  }
  var interpolateTransformCss, interpolateTransformSvg;
  var init_transform = __esm({
    "../usr/local/lib/node_modules/d3/node_modules/d3-interpolate/src/transform/index.js"() {
      init_number2();
      init_parse();
      interpolateTransformCss = interpolateTransform(parseCss, "px, ", "px)", "deg)");
      interpolateTransformSvg = interpolateTransform(parseSvg, ", ", ")", ")");
    }
  });

  // ../usr/local/lib/node_modules/d3/node_modules/d3-interpolate/src/index.js
  var init_src7 = __esm({
    "../usr/local/lib/node_modules/d3/node_modules/d3-interpolate/src/index.js"() {
      init_value();
      init_number2();
      init_round();
      init_string();
      init_transform();
      init_rgb();
    }
  });

  // ../usr/local/lib/node_modules/d3/node_modules/d3-timer/src/timer.js
  function now() {
    return clockNow || (setFrame(clearNow), clockNow = clock.now() + clockSkew);
  }
  function clearNow() {
    clockNow = 0;
  }
  function Timer() {
    this._call = this._time = this._next = null;
  }
  function timer(callback, delay, time) {
    var t = new Timer();
    t.restart(callback, delay, time);
    return t;
  }
  function timerFlush() {
    now();
    ++frame;
    var t = taskHead, e;
    while (t) {
      if ((e = clockNow - t._time) >= 0) t._call.call(void 0, e);
      t = t._next;
    }
    --frame;
  }
  function wake() {
    clockNow = (clockLast = clock.now()) + clockSkew;
    frame = timeout = 0;
    try {
      timerFlush();
    } finally {
      frame = 0;
      nap();
      clockNow = 0;
    }
  }
  function poke() {
    var now2 = clock.now(), delay = now2 - clockLast;
    if (delay > pokeDelay) clockSkew -= delay, clockLast = now2;
  }
  function nap() {
    var t02, t12 = taskHead, t2, time = Infinity;
    while (t12) {
      if (t12._call) {
        if (time > t12._time) time = t12._time;
        t02 = t12, t12 = t12._next;
      } else {
        t2 = t12._next, t12._next = null;
        t12 = t02 ? t02._next = t2 : taskHead = t2;
      }
    }
    taskTail = t02;
    sleep(time);
  }
  function sleep(time) {
    if (frame) return;
    if (timeout) timeout = clearTimeout(timeout);
    var delay = time - clockNow;
    if (delay > 24) {
      if (time < Infinity) timeout = setTimeout(wake, time - clock.now() - clockSkew);
      if (interval) interval = clearInterval(interval);
    } else {
      if (!interval) clockLast = clock.now(), interval = setInterval(poke, pokeDelay);
      frame = 1, setFrame(wake);
    }
  }
  var frame, timeout, interval, pokeDelay, taskHead, taskTail, clockLast, clockNow, clockSkew, clock, setFrame;
  var init_timer = __esm({
    "../usr/local/lib/node_modules/d3/node_modules/d3-timer/src/timer.js"() {
      frame = 0;
      timeout = 0;
      interval = 0;
      pokeDelay = 1e3;
      clockLast = 0;
      clockNow = 0;
      clockSkew = 0;
      clock = typeof performance === "object" && performance.now ? performance : Date;
      setFrame = typeof window === "object" && window.requestAnimationFrame ? window.requestAnimationFrame.bind(window) : function(f) {
        setTimeout(f, 17);
      };
      Timer.prototype = timer.prototype = {
        constructor: Timer,
        restart: function(callback, delay, time) {
          if (typeof callback !== "function") throw new TypeError("callback is not a function");
          time = (time == null ? now() : +time) + (delay == null ? 0 : +delay);
          if (!this._next && taskTail !== this) {
            if (taskTail) taskTail._next = this;
            else taskHead = this;
            taskTail = this;
          }
          this._call = callback;
          this._time = time;
          sleep();
        },
        stop: function() {
          if (this._call) {
            this._call = null;
            this._time = Infinity;
            sleep();
          }
        }
      };
    }
  });

  // ../usr/local/lib/node_modules/d3/node_modules/d3-timer/src/timeout.js
  function timeout_default(callback, delay, time) {
    var t = new Timer();
    delay = delay == null ? 0 : +delay;
    t.restart((elapsed) => {
      t.stop();
      callback(elapsed + delay);
    }, delay, time);
    return t;
  }
  var init_timeout = __esm({
    "../usr/local/lib/node_modules/d3/node_modules/d3-timer/src/timeout.js"() {
      init_timer();
    }
  });

  // ../usr/local/lib/node_modules/d3/node_modules/d3-timer/src/index.js
  var init_src8 = __esm({
    "../usr/local/lib/node_modules/d3/node_modules/d3-timer/src/index.js"() {
      init_timer();
      init_timeout();
    }
  });

  // ../usr/local/lib/node_modules/d3/node_modules/d3-transition/src/transition/schedule.js
  function schedule_default(node, name, id2, index, group, timing) {
    var schedules = node.__transition;
    if (!schedules) node.__transition = {};
    else if (id2 in schedules) return;
    create(node, id2, {
      name,
      index,
      // For context during callback.
      group,
      // For context during callback.
      on: emptyOn,
      tween: emptyTween,
      time: timing.time,
      delay: timing.delay,
      duration: timing.duration,
      ease: timing.ease,
      timer: null,
      state: CREATED
    });
  }
  function init(node, id2) {
    var schedule = get2(node, id2);
    if (schedule.state > CREATED) throw new Error("too late; already scheduled");
    return schedule;
  }
  function set2(node, id2) {
    var schedule = get2(node, id2);
    if (schedule.state > STARTED) throw new Error("too late; already running");
    return schedule;
  }
  function get2(node, id2) {
    var schedule = node.__transition;
    if (!schedule || !(schedule = schedule[id2])) throw new Error("transition not found");
    return schedule;
  }
  function create(node, id2, self) {
    var schedules = node.__transition, tween;
    schedules[id2] = self;
    self.timer = timer(schedule, 0, self.time);
    function schedule(elapsed) {
      self.state = SCHEDULED;
      self.timer.restart(start2, self.delay, self.time);
      if (self.delay <= elapsed) start2(elapsed - self.delay);
    }
    function start2(elapsed) {
      var i, j, n, o;
      if (self.state !== SCHEDULED) return stop();
      for (i in schedules) {
        o = schedules[i];
        if (o.name !== self.name) continue;
        if (o.state === STARTED) return timeout_default(start2);
        if (o.state === RUNNING) {
          o.state = ENDED;
          o.timer.stop();
          o.on.call("interrupt", node, node.__data__, o.index, o.group);
          delete schedules[i];
        } else if (+i < id2) {
          o.state = ENDED;
          o.timer.stop();
          o.on.call("cancel", node, node.__data__, o.index, o.group);
          delete schedules[i];
        }
      }
      timeout_default(function() {
        if (self.state === STARTED) {
          self.state = RUNNING;
          self.timer.restart(tick, self.delay, self.time);
          tick(elapsed);
        }
      });
      self.state = STARTING;
      self.on.call("start", node, node.__data__, self.index, self.group);
      if (self.state !== STARTING) return;
      self.state = STARTED;
      tween = new Array(n = self.tween.length);
      for (i = 0, j = -1; i < n; ++i) {
        if (o = self.tween[i].value.call(node, node.__data__, self.index, self.group)) {
          tween[++j] = o;
        }
      }
      tween.length = j + 1;
    }
    function tick(elapsed) {
      var t = elapsed < self.duration ? self.ease.call(null, elapsed / self.duration) : (self.timer.restart(stop), self.state = ENDING, 1), i = -1, n = tween.length;
      while (++i < n) {
        tween[i].call(node, t);
      }
      if (self.state === ENDING) {
        self.on.call("end", node, node.__data__, self.index, self.group);
        stop();
      }
    }
    function stop() {
      self.state = ENDED;
      self.timer.stop();
      delete schedules[id2];
      for (var i in schedules) return;
      delete node.__transition;
    }
  }
  var emptyOn, emptyTween, CREATED, SCHEDULED, STARTING, STARTED, RUNNING, ENDING, ENDED;
  var init_schedule = __esm({
    "../usr/local/lib/node_modules/d3/node_modules/d3-transition/src/transition/schedule.js"() {
      init_src3();
      init_src8();
      emptyOn = dispatch_default("start", "end", "cancel", "interrupt");
      emptyTween = [];
      CREATED = 0;
      SCHEDULED = 1;
      STARTING = 2;
      STARTED = 3;
      RUNNING = 4;
      ENDING = 5;
      ENDED = 6;
    }
  });

  // ../usr/local/lib/node_modules/d3/node_modules/d3-transition/src/interrupt.js
  function interrupt_default(node, name) {
    var schedules = node.__transition, schedule, active, empty2 = true, i;
    if (!schedules) return;
    name = name == null ? null : name + "";
    for (i in schedules) {
      if ((schedule = schedules[i]).name !== name) {
        empty2 = false;
        continue;
      }
      active = schedule.state > STARTING && schedule.state < ENDING;
      schedule.state = ENDED;
      schedule.timer.stop();
      schedule.on.call(active ? "interrupt" : "cancel", node, node.__data__, schedule.index, schedule.group);
      delete schedules[i];
    }
    if (empty2) delete node.__transition;
  }
  var init_interrupt = __esm({
    "../usr/local/lib/node_modules/d3/node_modules/d3-transition/src/interrupt.js"() {
      init_schedule();
    }
  });

  // ../usr/local/lib/node_modules/d3/node_modules/d3-transition/src/selection/interrupt.js
  function interrupt_default2(name) {
    return this.each(function() {
      interrupt_default(this, name);
    });
  }
  var init_interrupt2 = __esm({
    "../usr/local/lib/node_modules/d3/node_modules/d3-transition/src/selection/interrupt.js"() {
      init_interrupt();
    }
  });

  // ../usr/local/lib/node_modules/d3/node_modules/d3-transition/src/transition/tween.js
  function tweenRemove(id2, name) {
    var tween0, tween1;
    return function() {
      var schedule = set2(this, id2), tween = schedule.tween;
      if (tween !== tween0) {
        tween1 = tween0 = tween;
        for (var i = 0, n = tween1.length; i < n; ++i) {
          if (tween1[i].name === name) {
            tween1 = tween1.slice();
            tween1.splice(i, 1);
            break;
          }
        }
      }
      schedule.tween = tween1;
    };
  }
  function tweenFunction(id2, name, value) {
    var tween0, tween1;
    if (typeof value !== "function") throw new Error();
    return function() {
      var schedule = set2(this, id2), tween = schedule.tween;
      if (tween !== tween0) {
        tween1 = (tween0 = tween).slice();
        for (var t = { name, value }, i = 0, n = tween1.length; i < n; ++i) {
          if (tween1[i].name === name) {
            tween1[i] = t;
            break;
          }
        }
        if (i === n) tween1.push(t);
      }
      schedule.tween = tween1;
    };
  }
  function tween_default(name, value) {
    var id2 = this._id;
    name += "";
    if (arguments.length < 2) {
      var tween = get2(this.node(), id2).tween;
      for (var i = 0, n = tween.length, t; i < n; ++i) {
        if ((t = tween[i]).name === name) {
          return t.value;
        }
      }
      return null;
    }
    return this.each((value == null ? tweenRemove : tweenFunction)(id2, name, value));
  }
  function tweenValue(transition2, name, value) {
    var id2 = transition2._id;
    transition2.each(function() {
      var schedule = set2(this, id2);
      (schedule.value || (schedule.value = {}))[name] = value.apply(this, arguments);
    });
    return function(node) {
      return get2(node, id2).value[name];
    };
  }
  var init_tween = __esm({
    "../usr/local/lib/node_modules/d3/node_modules/d3-transition/src/transition/tween.js"() {
      init_schedule();
    }
  });

  // ../usr/local/lib/node_modules/d3/node_modules/d3-transition/src/transition/interpolate.js
  function interpolate_default(a, b) {
    var c;
    return (typeof b === "number" ? number_default : b instanceof color ? rgb_default : (c = color(b)) ? (b = c, rgb_default) : string_default)(a, b);
  }
  var init_interpolate = __esm({
    "../usr/local/lib/node_modules/d3/node_modules/d3-transition/src/transition/interpolate.js"() {
      init_src6();
      init_src7();
    }
  });

  // ../usr/local/lib/node_modules/d3/node_modules/d3-transition/src/transition/attr.js
  function attrRemove2(name) {
    return function() {
      this.removeAttribute(name);
    };
  }
  function attrRemoveNS2(fullname) {
    return function() {
      this.removeAttributeNS(fullname.space, fullname.local);
    };
  }
  function attrConstant2(name, interpolate, value1) {
    var string00, string1 = value1 + "", interpolate0;
    return function() {
      var string0 = this.getAttribute(name);
      return string0 === string1 ? null : string0 === string00 ? interpolate0 : interpolate0 = interpolate(string00 = string0, value1);
    };
  }
  function attrConstantNS2(fullname, interpolate, value1) {
    var string00, string1 = value1 + "", interpolate0;
    return function() {
      var string0 = this.getAttributeNS(fullname.space, fullname.local);
      return string0 === string1 ? null : string0 === string00 ? interpolate0 : interpolate0 = interpolate(string00 = string0, value1);
    };
  }
  function attrFunction2(name, interpolate, value) {
    var string00, string10, interpolate0;
    return function() {
      var string0, value1 = value(this), string1;
      if (value1 == null) return void this.removeAttribute(name);
      string0 = this.getAttribute(name);
      string1 = value1 + "";
      return string0 === string1 ? null : string0 === string00 && string1 === string10 ? interpolate0 : (string10 = string1, interpolate0 = interpolate(string00 = string0, value1));
    };
  }
  function attrFunctionNS2(fullname, interpolate, value) {
    var string00, string10, interpolate0;
    return function() {
      var string0, value1 = value(this), string1;
      if (value1 == null) return void this.removeAttributeNS(fullname.space, fullname.local);
      string0 = this.getAttributeNS(fullname.space, fullname.local);
      string1 = value1 + "";
      return string0 === string1 ? null : string0 === string00 && string1 === string10 ? interpolate0 : (string10 = string1, interpolate0 = interpolate(string00 = string0, value1));
    };
  }
  function attr_default2(name, value) {
    var fullname = namespace_default(name), i = fullname === "transform" ? interpolateTransformSvg : interpolate_default;
    return this.attrTween(name, typeof value === "function" ? (fullname.local ? attrFunctionNS2 : attrFunction2)(fullname, i, tweenValue(this, "attr." + name, value)) : value == null ? (fullname.local ? attrRemoveNS2 : attrRemove2)(fullname) : (fullname.local ? attrConstantNS2 : attrConstant2)(fullname, i, value));
  }
  var init_attr2 = __esm({
    "../usr/local/lib/node_modules/d3/node_modules/d3-transition/src/transition/attr.js"() {
      init_src7();
      init_src4();
      init_tween();
      init_interpolate();
    }
  });

  // ../usr/local/lib/node_modules/d3/node_modules/d3-transition/src/transition/attrTween.js
  function attrInterpolate(name, i) {
    return function(t) {
      this.setAttribute(name, i.call(this, t));
    };
  }
  function attrInterpolateNS(fullname, i) {
    return function(t) {
      this.setAttributeNS(fullname.space, fullname.local, i.call(this, t));
    };
  }
  function attrTweenNS(fullname, value) {
    var t02, i0;
    function tween() {
      var i = value.apply(this, arguments);
      if (i !== i0) t02 = (i0 = i) && attrInterpolateNS(fullname, i);
      return t02;
    }
    tween._value = value;
    return tween;
  }
  function attrTween(name, value) {
    var t02, i0;
    function tween() {
      var i = value.apply(this, arguments);
      if (i !== i0) t02 = (i0 = i) && attrInterpolate(name, i);
      return t02;
    }
    tween._value = value;
    return tween;
  }
  function attrTween_default(name, value) {
    var key = "attr." + name;
    if (arguments.length < 2) return (key = this.tween(key)) && key._value;
    if (value == null) return this.tween(key, null);
    if (typeof value !== "function") throw new Error();
    var fullname = namespace_default(name);
    return this.tween(key, (fullname.local ? attrTweenNS : attrTween)(fullname, value));
  }
  var init_attrTween = __esm({
    "../usr/local/lib/node_modules/d3/node_modules/d3-transition/src/transition/attrTween.js"() {
      init_src4();
    }
  });

  // ../usr/local/lib/node_modules/d3/node_modules/d3-transition/src/transition/delay.js
  function delayFunction(id2, value) {
    return function() {
      init(this, id2).delay = +value.apply(this, arguments);
    };
  }
  function delayConstant(id2, value) {
    return value = +value, function() {
      init(this, id2).delay = value;
    };
  }
  function delay_default(value) {
    var id2 = this._id;
    return arguments.length ? this.each((typeof value === "function" ? delayFunction : delayConstant)(id2, value)) : get2(this.node(), id2).delay;
  }
  var init_delay = __esm({
    "../usr/local/lib/node_modules/d3/node_modules/d3-transition/src/transition/delay.js"() {
      init_schedule();
    }
  });

  // ../usr/local/lib/node_modules/d3/node_modules/d3-transition/src/transition/duration.js
  function durationFunction(id2, value) {
    return function() {
      set2(this, id2).duration = +value.apply(this, arguments);
    };
  }
  function durationConstant(id2, value) {
    return value = +value, function() {
      set2(this, id2).duration = value;
    };
  }
  function duration_default(value) {
    var id2 = this._id;
    return arguments.length ? this.each((typeof value === "function" ? durationFunction : durationConstant)(id2, value)) : get2(this.node(), id2).duration;
  }
  var init_duration = __esm({
    "../usr/local/lib/node_modules/d3/node_modules/d3-transition/src/transition/duration.js"() {
      init_schedule();
    }
  });

  // ../usr/local/lib/node_modules/d3/node_modules/d3-transition/src/transition/ease.js
  function easeConstant(id2, value) {
    if (typeof value !== "function") throw new Error();
    return function() {
      set2(this, id2).ease = value;
    };
  }
  function ease_default(value) {
    var id2 = this._id;
    return arguments.length ? this.each(easeConstant(id2, value)) : get2(this.node(), id2).ease;
  }
  var init_ease = __esm({
    "../usr/local/lib/node_modules/d3/node_modules/d3-transition/src/transition/ease.js"() {
      init_schedule();
    }
  });

  // ../usr/local/lib/node_modules/d3/node_modules/d3-transition/src/transition/easeVarying.js
  function easeVarying(id2, value) {
    return function() {
      var v = value.apply(this, arguments);
      if (typeof v !== "function") throw new Error();
      set2(this, id2).ease = v;
    };
  }
  function easeVarying_default(value) {
    if (typeof value !== "function") throw new Error();
    return this.each(easeVarying(this._id, value));
  }
  var init_easeVarying = __esm({
    "../usr/local/lib/node_modules/d3/node_modules/d3-transition/src/transition/easeVarying.js"() {
      init_schedule();
    }
  });

  // ../usr/local/lib/node_modules/d3/node_modules/d3-transition/src/transition/filter.js
  function filter_default2(match) {
    if (typeof match !== "function") match = matcher_default(match);
    for (var groups = this._groups, m = groups.length, subgroups = new Array(m), j = 0; j < m; ++j) {
      for (var group = groups[j], n = group.length, subgroup = subgroups[j] = [], node, i = 0; i < n; ++i) {
        if ((node = group[i]) && match.call(node, node.__data__, i, group)) {
          subgroup.push(node);
        }
      }
    }
    return new Transition(subgroups, this._parents, this._name, this._id);
  }
  var init_filter2 = __esm({
    "../usr/local/lib/node_modules/d3/node_modules/d3-transition/src/transition/filter.js"() {
      init_src4();
      init_transition2();
    }
  });

  // ../usr/local/lib/node_modules/d3/node_modules/d3-transition/src/transition/merge.js
  function merge_default2(transition2) {
    if (transition2._id !== this._id) throw new Error();
    for (var groups0 = this._groups, groups1 = transition2._groups, m0 = groups0.length, m1 = groups1.length, m = Math.min(m0, m1), merges = new Array(m0), j = 0; j < m; ++j) {
      for (var group0 = groups0[j], group1 = groups1[j], n = group0.length, merge = merges[j] = new Array(n), node, i = 0; i < n; ++i) {
        if (node = group0[i] || group1[i]) {
          merge[i] = node;
        }
      }
    }
    for (; j < m0; ++j) {
      merges[j] = groups0[j];
    }
    return new Transition(merges, this._parents, this._name, this._id);
  }
  var init_merge2 = __esm({
    "../usr/local/lib/node_modules/d3/node_modules/d3-transition/src/transition/merge.js"() {
      init_transition2();
    }
  });

  // ../usr/local/lib/node_modules/d3/node_modules/d3-transition/src/transition/on.js
  function start(name) {
    return (name + "").trim().split(/^|\s+/).every(function(t) {
      var i = t.indexOf(".");
      if (i >= 0) t = t.slice(0, i);
      return !t || t === "start";
    });
  }
  function onFunction(id2, name, listener) {
    var on0, on1, sit = start(name) ? init : set2;
    return function() {
      var schedule = sit(this, id2), on = schedule.on;
      if (on !== on0) (on1 = (on0 = on).copy()).on(name, listener);
      schedule.on = on1;
    };
  }
  function on_default2(name, listener) {
    var id2 = this._id;
    return arguments.length < 2 ? get2(this.node(), id2).on.on(name) : this.each(onFunction(id2, name, listener));
  }
  var init_on2 = __esm({
    "../usr/local/lib/node_modules/d3/node_modules/d3-transition/src/transition/on.js"() {
      init_schedule();
    }
  });

  // ../usr/local/lib/node_modules/d3/node_modules/d3-transition/src/transition/remove.js
  function removeFunction(id2) {
    return function() {
      var parent = this.parentNode;
      for (var i in this.__transition) if (+i !== id2) return;
      if (parent) parent.removeChild(this);
    };
  }
  function remove_default2() {
    return this.on("end.remove", removeFunction(this._id));
  }
  var init_remove2 = __esm({
    "../usr/local/lib/node_modules/d3/node_modules/d3-transition/src/transition/remove.js"() {
    }
  });

  // ../usr/local/lib/node_modules/d3/node_modules/d3-transition/src/transition/select.js
  function select_default3(select) {
    var name = this._name, id2 = this._id;
    if (typeof select !== "function") select = selector_default(select);
    for (var groups = this._groups, m = groups.length, subgroups = new Array(m), j = 0; j < m; ++j) {
      for (var group = groups[j], n = group.length, subgroup = subgroups[j] = new Array(n), node, subnode, i = 0; i < n; ++i) {
        if ((node = group[i]) && (subnode = select.call(node, node.__data__, i, group))) {
          if ("__data__" in node) subnode.__data__ = node.__data__;
          subgroup[i] = subnode;
          schedule_default(subgroup[i], name, id2, i, subgroup, get2(node, id2));
        }
      }
    }
    return new Transition(subgroups, this._parents, name, id2);
  }
  var init_select3 = __esm({
    "../usr/local/lib/node_modules/d3/node_modules/d3-transition/src/transition/select.js"() {
      init_src4();
      init_transition2();
      init_schedule();
    }
  });

  // ../usr/local/lib/node_modules/d3/node_modules/d3-transition/src/transition/selectAll.js
  function selectAll_default2(select) {
    var name = this._name, id2 = this._id;
    if (typeof select !== "function") select = selectorAll_default(select);
    for (var groups = this._groups, m = groups.length, subgroups = [], parents = [], j = 0; j < m; ++j) {
      for (var group = groups[j], n = group.length, node, i = 0; i < n; ++i) {
        if (node = group[i]) {
          for (var children2 = select.call(node, node.__data__, i, group), child, inherit2 = get2(node, id2), k = 0, l = children2.length; k < l; ++k) {
            if (child = children2[k]) {
              schedule_default(child, name, id2, k, children2, inherit2);
            }
          }
          subgroups.push(children2);
          parents.push(node);
        }
      }
    }
    return new Transition(subgroups, parents, name, id2);
  }
  var init_selectAll2 = __esm({
    "../usr/local/lib/node_modules/d3/node_modules/d3-transition/src/transition/selectAll.js"() {
      init_src4();
      init_transition2();
      init_schedule();
    }
  });

  // ../usr/local/lib/node_modules/d3/node_modules/d3-transition/src/transition/selection.js
  function selection_default2() {
    return new Selection2(this._groups, this._parents);
  }
  var Selection2;
  var init_selection2 = __esm({
    "../usr/local/lib/node_modules/d3/node_modules/d3-transition/src/transition/selection.js"() {
      init_src4();
      Selection2 = selection_default.prototype.constructor;
    }
  });

  // ../usr/local/lib/node_modules/d3/node_modules/d3-transition/src/transition/style.js
  function styleNull(name, interpolate) {
    var string00, string10, interpolate0;
    return function() {
      var string0 = styleValue(this, name), string1 = (this.style.removeProperty(name), styleValue(this, name));
      return string0 === string1 ? null : string0 === string00 && string1 === string10 ? interpolate0 : interpolate0 = interpolate(string00 = string0, string10 = string1);
    };
  }
  function styleRemove2(name) {
    return function() {
      this.style.removeProperty(name);
    };
  }
  function styleConstant2(name, interpolate, value1) {
    var string00, string1 = value1 + "", interpolate0;
    return function() {
      var string0 = styleValue(this, name);
      return string0 === string1 ? null : string0 === string00 ? interpolate0 : interpolate0 = interpolate(string00 = string0, value1);
    };
  }
  function styleFunction2(name, interpolate, value) {
    var string00, string10, interpolate0;
    return function() {
      var string0 = styleValue(this, name), value1 = value(this), string1 = value1 + "";
      if (value1 == null) string1 = value1 = (this.style.removeProperty(name), styleValue(this, name));
      return string0 === string1 ? null : string0 === string00 && string1 === string10 ? interpolate0 : (string10 = string1, interpolate0 = interpolate(string00 = string0, value1));
    };
  }
  function styleMaybeRemove(id2, name) {
    var on0, on1, listener0, key = "style." + name, event = "end." + key, remove2;
    return function() {
      var schedule = set2(this, id2), on = schedule.on, listener = schedule.value[key] == null ? remove2 || (remove2 = styleRemove2(name)) : void 0;
      if (on !== on0 || listener0 !== listener) (on1 = (on0 = on).copy()).on(event, listener0 = listener);
      schedule.on = on1;
    };
  }
  function style_default2(name, value, priority) {
    var i = (name += "") === "transform" ? interpolateTransformCss : interpolate_default;
    return value == null ? this.styleTween(name, styleNull(name, i)).on("end.style." + name, styleRemove2(name)) : typeof value === "function" ? this.styleTween(name, styleFunction2(name, i, tweenValue(this, "style." + name, value))).each(styleMaybeRemove(this._id, name)) : this.styleTween(name, styleConstant2(name, i, value), priority).on("end.style." + name, null);
  }
  var init_style2 = __esm({
    "../usr/local/lib/node_modules/d3/node_modules/d3-transition/src/transition/style.js"() {
      init_src7();
      init_src4();
      init_schedule();
      init_tween();
      init_interpolate();
    }
  });

  // ../usr/local/lib/node_modules/d3/node_modules/d3-transition/src/transition/styleTween.js
  function styleInterpolate(name, i, priority) {
    return function(t) {
      this.style.setProperty(name, i.call(this, t), priority);
    };
  }
  function styleTween(name, value, priority) {
    var t, i0;
    function tween() {
      var i = value.apply(this, arguments);
      if (i !== i0) t = (i0 = i) && styleInterpolate(name, i, priority);
      return t;
    }
    tween._value = value;
    return tween;
  }
  function styleTween_default(name, value, priority) {
    var key = "style." + (name += "");
    if (arguments.length < 2) return (key = this.tween(key)) && key._value;
    if (value == null) return this.tween(key, null);
    if (typeof value !== "function") throw new Error();
    return this.tween(key, styleTween(name, value, priority == null ? "" : priority));
  }
  var init_styleTween = __esm({
    "../usr/local/lib/node_modules/d3/node_modules/d3-transition/src/transition/styleTween.js"() {
    }
  });

  // ../usr/local/lib/node_modules/d3/node_modules/d3-transition/src/transition/text.js
  function textConstant2(value) {
    return function() {
      this.textContent = value;
    };
  }
  function textFunction2(value) {
    return function() {
      var value1 = value(this);
      this.textContent = value1 == null ? "" : value1;
    };
  }
  function text_default2(value) {
    return this.tween("text", typeof value === "function" ? textFunction2(tweenValue(this, "text", value)) : textConstant2(value == null ? "" : value + ""));
  }
  var init_text2 = __esm({
    "../usr/local/lib/node_modules/d3/node_modules/d3-transition/src/transition/text.js"() {
      init_tween();
    }
  });

  // ../usr/local/lib/node_modules/d3/node_modules/d3-transition/src/transition/textTween.js
  function textInterpolate(i) {
    return function(t) {
      this.textContent = i.call(this, t);
    };
  }
  function textTween(value) {
    var t02, i0;
    function tween() {
      var i = value.apply(this, arguments);
      if (i !== i0) t02 = (i0 = i) && textInterpolate(i);
      return t02;
    }
    tween._value = value;
    return tween;
  }
  function textTween_default(value) {
    var key = "text";
    if (arguments.length < 1) return (key = this.tween(key)) && key._value;
    if (value == null) return this.tween(key, null);
    if (typeof value !== "function") throw new Error();
    return this.tween(key, textTween(value));
  }
  var init_textTween = __esm({
    "../usr/local/lib/node_modules/d3/node_modules/d3-transition/src/transition/textTween.js"() {
    }
  });

  // ../usr/local/lib/node_modules/d3/node_modules/d3-transition/src/transition/transition.js
  function transition_default() {
    var name = this._name, id0 = this._id, id1 = newId();
    for (var groups = this._groups, m = groups.length, j = 0; j < m; ++j) {
      for (var group = groups[j], n = group.length, node, i = 0; i < n; ++i) {
        if (node = group[i]) {
          var inherit2 = get2(node, id0);
          schedule_default(node, name, id1, i, group, {
            time: inherit2.time + inherit2.delay + inherit2.duration,
            delay: 0,
            duration: inherit2.duration,
            ease: inherit2.ease
          });
        }
      }
    }
    return new Transition(groups, this._parents, name, id1);
  }
  var init_transition = __esm({
    "../usr/local/lib/node_modules/d3/node_modules/d3-transition/src/transition/transition.js"() {
      init_transition2();
      init_schedule();
    }
  });

  // ../usr/local/lib/node_modules/d3/node_modules/d3-transition/src/transition/end.js
  function end_default() {
    var on0, on1, that = this, id2 = that._id, size = that.size();
    return new Promise(function(resolve, reject) {
      var cancel = { value: reject }, end = { value: function() {
        if (--size === 0) resolve();
      } };
      that.each(function() {
        var schedule = set2(this, id2), on = schedule.on;
        if (on !== on0) {
          on1 = (on0 = on).copy();
          on1._.cancel.push(cancel);
          on1._.interrupt.push(cancel);
          on1._.end.push(end);
        }
        schedule.on = on1;
      });
      if (size === 0) resolve();
    });
  }
  var init_end = __esm({
    "../usr/local/lib/node_modules/d3/node_modules/d3-transition/src/transition/end.js"() {
      init_schedule();
    }
  });

  // ../usr/local/lib/node_modules/d3/node_modules/d3-transition/src/transition/index.js
  function Transition(groups, parents, name, id2) {
    this._groups = groups;
    this._parents = parents;
    this._name = name;
    this._id = id2;
  }
  function transition(name) {
    return selection_default().transition(name);
  }
  function newId() {
    return ++id;
  }
  var id, selection_prototype;
  var init_transition2 = __esm({
    "../usr/local/lib/node_modules/d3/node_modules/d3-transition/src/transition/index.js"() {
      init_src4();
      init_attr2();
      init_attrTween();
      init_delay();
      init_duration();
      init_ease();
      init_easeVarying();
      init_filter2();
      init_merge2();
      init_on2();
      init_remove2();
      init_select3();
      init_selectAll2();
      init_selection2();
      init_style2();
      init_styleTween();
      init_text2();
      init_textTween();
      init_transition();
      init_tween();
      init_end();
      id = 0;
      selection_prototype = selection_default.prototype;
      Transition.prototype = transition.prototype = {
        constructor: Transition,
        select: select_default3,
        selectAll: selectAll_default2,
        selectChild: selection_prototype.selectChild,
        selectChildren: selection_prototype.selectChildren,
        filter: filter_default2,
        merge: merge_default2,
        selection: selection_default2,
        transition: transition_default,
        call: selection_prototype.call,
        nodes: selection_prototype.nodes,
        node: selection_prototype.node,
        size: selection_prototype.size,
        empty: selection_prototype.empty,
        each: selection_prototype.each,
        on: on_default2,
        attr: attr_default2,
        attrTween: attrTween_default,
        style: style_default2,
        styleTween: styleTween_default,
        text: text_default2,
        textTween: textTween_default,
        remove: remove_default2,
        tween: tween_default,
        delay: delay_default,
        duration: duration_default,
        ease: ease_default,
        easeVarying: easeVarying_default,
        end: end_default,
        [Symbol.iterator]: selection_prototype[Symbol.iterator]
      };
    }
  });

  // ../usr/local/lib/node_modules/d3/node_modules/d3-ease/src/cubic.js
  function cubicInOut(t) {
    return ((t *= 2) <= 1 ? t * t * t : (t -= 2) * t * t + 2) / 2;
  }
  var init_cubic = __esm({
    "../usr/local/lib/node_modules/d3/node_modules/d3-ease/src/cubic.js"() {
    }
  });

  // ../usr/local/lib/node_modules/d3/node_modules/d3-ease/src/index.js
  var init_src9 = __esm({
    "../usr/local/lib/node_modules/d3/node_modules/d3-ease/src/index.js"() {
      init_cubic();
    }
  });

  // ../usr/local/lib/node_modules/d3/node_modules/d3-transition/src/selection/transition.js
  function inherit(node, id2) {
    var timing;
    while (!(timing = node.__transition) || !(timing = timing[id2])) {
      if (!(node = node.parentNode)) {
        throw new Error(`transition ${id2} not found`);
      }
    }
    return timing;
  }
  function transition_default2(name) {
    var id2, timing;
    if (name instanceof Transition) {
      id2 = name._id, name = name._name;
    } else {
      id2 = newId(), (timing = defaultTiming).time = now(), name = name == null ? null : name + "";
    }
    for (var groups = this._groups, m = groups.length, j = 0; j < m; ++j) {
      for (var group = groups[j], n = group.length, node, i = 0; i < n; ++i) {
        if (node = group[i]) {
          schedule_default(node, name, id2, i, group, timing || inherit(node, id2));
        }
      }
    }
    return new Transition(groups, this._parents, name, id2);
  }
  var defaultTiming;
  var init_transition3 = __esm({
    "../usr/local/lib/node_modules/d3/node_modules/d3-transition/src/selection/transition.js"() {
      init_transition2();
      init_schedule();
      init_src9();
      init_src8();
      defaultTiming = {
        time: null,
        // Set on use.
        delay: 0,
        duration: 250,
        ease: cubicInOut
      };
    }
  });

  // ../usr/local/lib/node_modules/d3/node_modules/d3-transition/src/selection/index.js
  var init_selection3 = __esm({
    "../usr/local/lib/node_modules/d3/node_modules/d3-transition/src/selection/index.js"() {
      init_src4();
      init_interrupt2();
      init_transition3();
      selection_default.prototype.interrupt = interrupt_default2;
      selection_default.prototype.transition = transition_default2;
    }
  });

  // ../usr/local/lib/node_modules/d3/node_modules/d3-transition/src/index.js
  var init_src10 = __esm({
    "../usr/local/lib/node_modules/d3/node_modules/d3-transition/src/index.js"() {
      init_selection3();
    }
  });

  // ../usr/local/lib/node_modules/d3/node_modules/d3-brush/src/constant.js
  var init_constant3 = __esm({
    "../usr/local/lib/node_modules/d3/node_modules/d3-brush/src/constant.js"() {
    }
  });

  // ../usr/local/lib/node_modules/d3/node_modules/d3-brush/src/event.js
  var init_event = __esm({
    "../usr/local/lib/node_modules/d3/node_modules/d3-brush/src/event.js"() {
    }
  });

  // ../usr/local/lib/node_modules/d3/node_modules/d3-brush/src/noevent.js
  var init_noevent = __esm({
    "../usr/local/lib/node_modules/d3/node_modules/d3-brush/src/noevent.js"() {
    }
  });

  // ../usr/local/lib/node_modules/d3/node_modules/d3-brush/src/brush.js
  function number1(e) {
    return [+e[0], +e[1]];
  }
  function number2(e) {
    return [number1(e[0]), number1(e[1])];
  }
  function type(t) {
    return { type: t };
  }
  var abs, max2, min, X, Y, XY;
  var init_brush = __esm({
    "../usr/local/lib/node_modules/d3/node_modules/d3-brush/src/brush.js"() {
      init_src10();
      init_constant3();
      init_event();
      init_noevent();
      ({ abs, max: max2, min } = Math);
      X = {
        name: "x",
        handles: ["w", "e"].map(type),
        input: function(x, e) {
          return x == null ? null : [[+x[0], e[0][1]], [+x[1], e[1][1]]];
        },
        output: function(xy) {
          return xy && [xy[0][0], xy[1][0]];
        }
      };
      Y = {
        name: "y",
        handles: ["n", "s"].map(type),
        input: function(y, e) {
          return y == null ? null : [[e[0][0], +y[0]], [e[1][0], +y[1]]];
        },
        output: function(xy) {
          return xy && [xy[0][1], xy[1][1]];
        }
      };
      XY = {
        name: "xy",
        handles: ["n", "w", "e", "s", "nw", "ne", "sw", "se"].map(type),
        input: function(xy) {
          return xy == null ? null : number2(xy);
        },
        output: function(xy) {
          return xy;
        }
      };
    }
  });

  // ../usr/local/lib/node_modules/d3/node_modules/d3-brush/src/index.js
  var init_src11 = __esm({
    "../usr/local/lib/node_modules/d3/node_modules/d3-brush/src/index.js"() {
      init_brush();
    }
  });

  // ../usr/local/lib/node_modules/d3/node_modules/d3-path/src/index.js
  var init_src12 = __esm({
    "../usr/local/lib/node_modules/d3/node_modules/d3-path/src/index.js"() {
    }
  });

  // ../usr/local/lib/node_modules/d3/node_modules/d3-chord/src/index.js
  var init_src13 = __esm({
    "../usr/local/lib/node_modules/d3/node_modules/d3-chord/src/index.js"() {
    }
  });

  // ../usr/local/lib/node_modules/d3/node_modules/d3-contour/src/index.js
  var init_src14 = __esm({
    "../usr/local/lib/node_modules/d3/node_modules/d3-contour/src/index.js"() {
    }
  });

  // ../usr/local/lib/node_modules/d3/node_modules/d3-delaunay/src/index.js
  var init_src15 = __esm({
    "../usr/local/lib/node_modules/d3/node_modules/d3-delaunay/src/index.js"() {
    }
  });

  // ../usr/local/lib/node_modules/d3/node_modules/d3-dsv/src/index.js
  var init_src16 = __esm({
    "../usr/local/lib/node_modules/d3/node_modules/d3-dsv/src/index.js"() {
    }
  });

  // ../usr/local/lib/node_modules/d3/node_modules/d3-fetch/src/index.js
  var init_src17 = __esm({
    "../usr/local/lib/node_modules/d3/node_modules/d3-fetch/src/index.js"() {
    }
  });

  // ../usr/local/lib/node_modules/d3/node_modules/d3-quadtree/src/index.js
  var init_src18 = __esm({
    "../usr/local/lib/node_modules/d3/node_modules/d3-quadtree/src/index.js"() {
    }
  });

  // ../usr/local/lib/node_modules/d3/node_modules/d3-force/src/index.js
  var init_src19 = __esm({
    "../usr/local/lib/node_modules/d3/node_modules/d3-force/src/index.js"() {
    }
  });

  // ../usr/local/lib/node_modules/d3/node_modules/d3-format/src/formatDecimal.js
  function formatDecimal_default(x) {
    return Math.abs(x = Math.round(x)) >= 1e21 ? x.toLocaleString("en").replace(/,/g, "") : x.toString(10);
  }
  function formatDecimalParts(x, p) {
    if (!isFinite(x) || x === 0) return null;
    var i = (x = p ? x.toExponential(p - 1) : x.toExponential()).indexOf("e"), coefficient = x.slice(0, i);
    return [
      coefficient.length > 1 ? coefficient[0] + coefficient.slice(2) : coefficient,
      +x.slice(i + 1)
    ];
  }
  var init_formatDecimal = __esm({
    "../usr/local/lib/node_modules/d3/node_modules/d3-format/src/formatDecimal.js"() {
    }
  });

  // ../usr/local/lib/node_modules/d3/node_modules/d3-format/src/exponent.js
  function exponent_default(x) {
    return x = formatDecimalParts(Math.abs(x)), x ? x[1] : NaN;
  }
  var init_exponent = __esm({
    "../usr/local/lib/node_modules/d3/node_modules/d3-format/src/exponent.js"() {
      init_formatDecimal();
    }
  });

  // ../usr/local/lib/node_modules/d3/node_modules/d3-format/src/formatGroup.js
  function formatGroup_default(grouping, thousands) {
    return function(value, width) {
      var i = value.length, t = [], j = 0, g = grouping[0], length = 0;
      while (i > 0 && g > 0) {
        if (length + g + 1 > width) g = Math.max(1, width - length);
        t.push(value.substring(i -= g, i + g));
        if ((length += g + 1) > width) break;
        g = grouping[j = (j + 1) % grouping.length];
      }
      return t.reverse().join(thousands);
    };
  }
  var init_formatGroup = __esm({
    "../usr/local/lib/node_modules/d3/node_modules/d3-format/src/formatGroup.js"() {
    }
  });

  // ../usr/local/lib/node_modules/d3/node_modules/d3-format/src/formatNumerals.js
  function formatNumerals_default(numerals) {
    return function(value) {
      return value.replace(/[0-9]/g, function(i) {
        return numerals[+i];
      });
    };
  }
  var init_formatNumerals = __esm({
    "../usr/local/lib/node_modules/d3/node_modules/d3-format/src/formatNumerals.js"() {
    }
  });

  // ../usr/local/lib/node_modules/d3/node_modules/d3-format/src/formatSpecifier.js
  function formatSpecifier(specifier) {
    if (!(match = re.exec(specifier))) throw new Error("invalid format: " + specifier);
    var match;
    return new FormatSpecifier({
      fill: match[1],
      align: match[2],
      sign: match[3],
      symbol: match[4],
      zero: match[5],
      width: match[6],
      comma: match[7],
      precision: match[8] && match[8].slice(1),
      trim: match[9],
      type: match[10]
    });
  }
  function FormatSpecifier(specifier) {
    this.fill = specifier.fill === void 0 ? " " : specifier.fill + "";
    this.align = specifier.align === void 0 ? ">" : specifier.align + "";
    this.sign = specifier.sign === void 0 ? "-" : specifier.sign + "";
    this.symbol = specifier.symbol === void 0 ? "" : specifier.symbol + "";
    this.zero = !!specifier.zero;
    this.width = specifier.width === void 0 ? void 0 : +specifier.width;
    this.comma = !!specifier.comma;
    this.precision = specifier.precision === void 0 ? void 0 : +specifier.precision;
    this.trim = !!specifier.trim;
    this.type = specifier.type === void 0 ? "" : specifier.type + "";
  }
  var re;
  var init_formatSpecifier = __esm({
    "../usr/local/lib/node_modules/d3/node_modules/d3-format/src/formatSpecifier.js"() {
      re = /^(?:(.)?([<>=^]))?([+\-( ])?([$#])?(0)?(\d+)?(,)?(\.\d+)?(~)?([a-z%])?$/i;
      formatSpecifier.prototype = FormatSpecifier.prototype;
      FormatSpecifier.prototype.toString = function() {
        return this.fill + this.align + this.sign + this.symbol + (this.zero ? "0" : "") + (this.width === void 0 ? "" : Math.max(1, this.width | 0)) + (this.comma ? "," : "") + (this.precision === void 0 ? "" : "." + Math.max(0, this.precision | 0)) + (this.trim ? "~" : "") + this.type;
      };
    }
  });

  // ../usr/local/lib/node_modules/d3/node_modules/d3-format/src/formatTrim.js
  function formatTrim_default(s) {
    out: for (var n = s.length, i = 1, i0 = -1, i1; i < n; ++i) {
      switch (s[i]) {
        case ".":
          i0 = i1 = i;
          break;
        case "0":
          if (i0 === 0) i0 = i;
          i1 = i;
          break;
        default:
          if (!+s[i]) break out;
          if (i0 > 0) i0 = 0;
          break;
      }
    }
    return i0 > 0 ? s.slice(0, i0) + s.slice(i1 + 1) : s;
  }
  var init_formatTrim = __esm({
    "../usr/local/lib/node_modules/d3/node_modules/d3-format/src/formatTrim.js"() {
    }
  });

  // ../usr/local/lib/node_modules/d3/node_modules/d3-format/src/formatPrefixAuto.js
  function formatPrefixAuto_default(x, p) {
    var d = formatDecimalParts(x, p);
    if (!d) return prefixExponent = void 0, x.toPrecision(p);
    var coefficient = d[0], exponent = d[1], i = exponent - (prefixExponent = Math.max(-8, Math.min(8, Math.floor(exponent / 3))) * 3) + 1, n = coefficient.length;
    return i === n ? coefficient : i > n ? coefficient + new Array(i - n + 1).join("0") : i > 0 ? coefficient.slice(0, i) + "." + coefficient.slice(i) : "0." + new Array(1 - i).join("0") + formatDecimalParts(x, Math.max(0, p + i - 1))[0];
  }
  var prefixExponent;
  var init_formatPrefixAuto = __esm({
    "../usr/local/lib/node_modules/d3/node_modules/d3-format/src/formatPrefixAuto.js"() {
      init_formatDecimal();
    }
  });

  // ../usr/local/lib/node_modules/d3/node_modules/d3-format/src/formatRounded.js
  function formatRounded_default(x, p) {
    var d = formatDecimalParts(x, p);
    if (!d) return x + "";
    var coefficient = d[0], exponent = d[1];
    return exponent < 0 ? "0." + new Array(-exponent).join("0") + coefficient : coefficient.length > exponent + 1 ? coefficient.slice(0, exponent + 1) + "." + coefficient.slice(exponent + 1) : coefficient + new Array(exponent - coefficient.length + 2).join("0");
  }
  var init_formatRounded = __esm({
    "../usr/local/lib/node_modules/d3/node_modules/d3-format/src/formatRounded.js"() {
      init_formatDecimal();
    }
  });

  // ../usr/local/lib/node_modules/d3/node_modules/d3-format/src/formatTypes.js
  var formatTypes_default;
  var init_formatTypes = __esm({
    "../usr/local/lib/node_modules/d3/node_modules/d3-format/src/formatTypes.js"() {
      init_formatDecimal();
      init_formatPrefixAuto();
      init_formatRounded();
      formatTypes_default = {
        "%": (x, p) => (x * 100).toFixed(p),
        "b": (x) => Math.round(x).toString(2),
        "c": (x) => x + "",
        "d": formatDecimal_default,
        "e": (x, p) => x.toExponential(p),
        "f": (x, p) => x.toFixed(p),
        "g": (x, p) => x.toPrecision(p),
        "o": (x) => Math.round(x).toString(8),
        "p": (x, p) => formatRounded_default(x * 100, p),
        "r": formatRounded_default,
        "s": formatPrefixAuto_default,
        "X": (x) => Math.round(x).toString(16).toUpperCase(),
        "x": (x) => Math.round(x).toString(16)
      };
    }
  });

  // ../usr/local/lib/node_modules/d3/node_modules/d3-format/src/identity.js
  function identity_default(x) {
    return x;
  }
  var init_identity = __esm({
    "../usr/local/lib/node_modules/d3/node_modules/d3-format/src/identity.js"() {
    }
  });

  // ../usr/local/lib/node_modules/d3/node_modules/d3-format/src/locale.js
  function locale_default(locale3) {
    var group = locale3.grouping === void 0 || locale3.thousands === void 0 ? identity_default : formatGroup_default(map.call(locale3.grouping, Number), locale3.thousands + ""), currencyPrefix = locale3.currency === void 0 ? "" : locale3.currency[0] + "", currencySuffix = locale3.currency === void 0 ? "" : locale3.currency[1] + "", decimal = locale3.decimal === void 0 ? "." : locale3.decimal + "", numerals = locale3.numerals === void 0 ? identity_default : formatNumerals_default(map.call(locale3.numerals, String)), percent = locale3.percent === void 0 ? "%" : locale3.percent + "", minus = locale3.minus === void 0 ? "\u2212" : locale3.minus + "", nan = locale3.nan === void 0 ? "NaN" : locale3.nan + "";
    function newFormat(specifier, options) {
      specifier = formatSpecifier(specifier);
      var fill = specifier.fill, align = specifier.align, sign = specifier.sign, symbol = specifier.symbol, zero3 = specifier.zero, width = specifier.width, comma = specifier.comma, precision = specifier.precision, trim = specifier.trim, type2 = specifier.type;
      if (type2 === "n") comma = true, type2 = "g";
      else if (!formatTypes_default[type2]) precision === void 0 && (precision = 12), trim = true, type2 = "g";
      if (zero3 || fill === "0" && align === "=") zero3 = true, fill = "0", align = "=";
      var prefix = (options && options.prefix !== void 0 ? options.prefix : "") + (symbol === "$" ? currencyPrefix : symbol === "#" && /[boxX]/.test(type2) ? "0" + type2.toLowerCase() : ""), suffix = (symbol === "$" ? currencySuffix : /[%p]/.test(type2) ? percent : "") + (options && options.suffix !== void 0 ? options.suffix : "");
      var formatType = formatTypes_default[type2], maybeSuffix = /[defgprs%]/.test(type2);
      precision = precision === void 0 ? 6 : /[gprs]/.test(type2) ? Math.max(1, Math.min(21, precision)) : Math.max(0, Math.min(20, precision));
      function format2(value) {
        var valuePrefix = prefix, valueSuffix = suffix, i, n, c;
        if (type2 === "c") {
          valueSuffix = formatType(value) + valueSuffix;
          value = "";
        } else {
          value = +value;
          var valueNegative = value < 0 || 1 / value < 0;
          value = isNaN(value) ? nan : formatType(Math.abs(value), precision);
          if (trim) value = formatTrim_default(value);
          if (valueNegative && +value === 0 && sign !== "+") valueNegative = false;
          valuePrefix = (valueNegative ? sign === "(" ? sign : minus : sign === "-" || sign === "(" ? "" : sign) + valuePrefix;
          valueSuffix = (type2 === "s" && !isNaN(value) && prefixExponent !== void 0 ? prefixes[8 + prefixExponent / 3] : "") + valueSuffix + (valueNegative && sign === "(" ? ")" : "");
          if (maybeSuffix) {
            i = -1, n = value.length;
            while (++i < n) {
              if (c = value.charCodeAt(i), 48 > c || c > 57) {
                valueSuffix = (c === 46 ? decimal + value.slice(i + 1) : value.slice(i)) + valueSuffix;
                value = value.slice(0, i);
                break;
              }
            }
          }
        }
        if (comma && !zero3) value = group(value, Infinity);
        var length = valuePrefix.length + value.length + valueSuffix.length, padding = length < width ? new Array(width - length + 1).join(fill) : "";
        if (comma && zero3) value = group(padding + value, padding.length ? width - valueSuffix.length : Infinity), padding = "";
        switch (align) {
          case "<":
            value = valuePrefix + value + valueSuffix + padding;
            break;
          case "=":
            value = valuePrefix + padding + value + valueSuffix;
            break;
          case "^":
            value = padding.slice(0, length = padding.length >> 1) + valuePrefix + value + valueSuffix + padding.slice(length);
            break;
          default:
            value = padding + valuePrefix + value + valueSuffix;
            break;
        }
        return numerals(value);
      }
      format2.toString = function() {
        return specifier + "";
      };
      return format2;
    }
    function formatPrefix2(specifier, value) {
      var e = Math.max(-8, Math.min(8, Math.floor(exponent_default(value) / 3))) * 3, k = Math.pow(10, -e), f = newFormat((specifier = formatSpecifier(specifier), specifier.type = "f", specifier), { suffix: prefixes[8 + e / 3] });
      return function(value2) {
        return f(k * value2);
      };
    }
    return {
      format: newFormat,
      formatPrefix: formatPrefix2
    };
  }
  var map, prefixes;
  var init_locale = __esm({
    "../usr/local/lib/node_modules/d3/node_modules/d3-format/src/locale.js"() {
      init_exponent();
      init_formatGroup();
      init_formatNumerals();
      init_formatSpecifier();
      init_formatTrim();
      init_formatTypes();
      init_formatPrefixAuto();
      init_identity();
      map = Array.prototype.map;
      prefixes = ["y", "z", "a", "f", "p", "n", "\xB5", "m", "", "k", "M", "G", "T", "P", "E", "Z", "Y"];
    }
  });

  // ../usr/local/lib/node_modules/d3/node_modules/d3-format/src/defaultLocale.js
  function defaultLocale(definition) {
    locale = locale_default(definition);
    format = locale.format;
    formatPrefix = locale.formatPrefix;
    return locale;
  }
  var locale, format, formatPrefix;
  var init_defaultLocale = __esm({
    "../usr/local/lib/node_modules/d3/node_modules/d3-format/src/defaultLocale.js"() {
      init_locale();
      defaultLocale({
        thousands: ",",
        grouping: [3],
        currency: ["$", ""]
      });
    }
  });

  // ../usr/local/lib/node_modules/d3/node_modules/d3-format/src/precisionFixed.js
  function precisionFixed_default(step) {
    return Math.max(0, -exponent_default(Math.abs(step)));
  }
  var init_precisionFixed = __esm({
    "../usr/local/lib/node_modules/d3/node_modules/d3-format/src/precisionFixed.js"() {
      init_exponent();
    }
  });

  // ../usr/local/lib/node_modules/d3/node_modules/d3-format/src/precisionPrefix.js
  function precisionPrefix_default(step, value) {
    return Math.max(0, Math.max(-8, Math.min(8, Math.floor(exponent_default(value) / 3))) * 3 - exponent_default(Math.abs(step)));
  }
  var init_precisionPrefix = __esm({
    "../usr/local/lib/node_modules/d3/node_modules/d3-format/src/precisionPrefix.js"() {
      init_exponent();
    }
  });

  // ../usr/local/lib/node_modules/d3/node_modules/d3-format/src/precisionRound.js
  function precisionRound_default(step, max3) {
    step = Math.abs(step), max3 = Math.abs(max3) - step;
    return Math.max(0, exponent_default(max3) - exponent_default(step)) + 1;
  }
  var init_precisionRound = __esm({
    "../usr/local/lib/node_modules/d3/node_modules/d3-format/src/precisionRound.js"() {
      init_exponent();
    }
  });

  // ../usr/local/lib/node_modules/d3/node_modules/d3-format/src/index.js
  var init_src20 = __esm({
    "../usr/local/lib/node_modules/d3/node_modules/d3-format/src/index.js"() {
      init_defaultLocale();
      init_formatSpecifier();
      init_precisionFixed();
      init_precisionPrefix();
      init_precisionRound();
    }
  });

  // ../usr/local/lib/node_modules/d3/node_modules/d3-geo/src/index.js
  var init_src21 = __esm({
    "../usr/local/lib/node_modules/d3/node_modules/d3-geo/src/index.js"() {
    }
  });

  // ../usr/local/lib/node_modules/d3/node_modules/d3-hierarchy/src/index.js
  var init_src22 = __esm({
    "../usr/local/lib/node_modules/d3/node_modules/d3-hierarchy/src/index.js"() {
    }
  });

  // ../usr/local/lib/node_modules/d3/node_modules/d3-polygon/src/index.js
  var init_src23 = __esm({
    "../usr/local/lib/node_modules/d3/node_modules/d3-polygon/src/index.js"() {
    }
  });

  // ../usr/local/lib/node_modules/d3/node_modules/d3-random/src/index.js
  var init_src24 = __esm({
    "../usr/local/lib/node_modules/d3/node_modules/d3-random/src/index.js"() {
    }
  });

  // ../usr/local/lib/node_modules/d3/node_modules/d3-scale/src/init.js
  function initRange(domain, range) {
    switch (arguments.length) {
      case 0:
        break;
      case 1:
        this.range(domain);
        break;
      default:
        this.range(range).domain(domain);
        break;
    }
    return this;
  }
  var init_init = __esm({
    "../usr/local/lib/node_modules/d3/node_modules/d3-scale/src/init.js"() {
    }
  });

  // ../usr/local/lib/node_modules/d3/node_modules/d3-scale/src/constant.js
  function constants(x) {
    return function() {
      return x;
    };
  }
  var init_constant4 = __esm({
    "../usr/local/lib/node_modules/d3/node_modules/d3-scale/src/constant.js"() {
    }
  });

  // ../usr/local/lib/node_modules/d3/node_modules/d3-scale/src/number.js
  function number3(x) {
    return +x;
  }
  var init_number3 = __esm({
    "../usr/local/lib/node_modules/d3/node_modules/d3-scale/src/number.js"() {
    }
  });

  // ../usr/local/lib/node_modules/d3/node_modules/d3-scale/src/continuous.js
  function identity2(x) {
    return x;
  }
  function normalize(a, b) {
    return (b -= a = +a) ? function(x) {
      return (x - a) / b;
    } : constants(isNaN(b) ? NaN : 0.5);
  }
  function clamper(a, b) {
    var t;
    if (a > b) t = a, a = b, b = t;
    return function(x) {
      return Math.max(a, Math.min(b, x));
    };
  }
  function bimap(domain, range, interpolate) {
    var d0 = domain[0], d1 = domain[1], r0 = range[0], r1 = range[1];
    if (d1 < d0) d0 = normalize(d1, d0), r0 = interpolate(r1, r0);
    else d0 = normalize(d0, d1), r0 = interpolate(r0, r1);
    return function(x) {
      return r0(d0(x));
    };
  }
  function polymap(domain, range, interpolate) {
    var j = Math.min(domain.length, range.length) - 1, d = new Array(j), r = new Array(j), i = -1;
    if (domain[j] < domain[0]) {
      domain = domain.slice().reverse();
      range = range.slice().reverse();
    }
    while (++i < j) {
      d[i] = normalize(domain[i], domain[i + 1]);
      r[i] = interpolate(range[i], range[i + 1]);
    }
    return function(x) {
      var i2 = bisect_default(domain, x, 1, j) - 1;
      return r[i2](d[i2](x));
    };
  }
  function copy(source, target) {
    return target.domain(source.domain()).range(source.range()).interpolate(source.interpolate()).clamp(source.clamp()).unknown(source.unknown());
  }
  function transformer() {
    var domain = unit, range = unit, interpolate = value_default, transform2, untransform, unknown, clamp = identity2, piecewise, output, input;
    function rescale() {
      var n = Math.min(domain.length, range.length);
      if (clamp !== identity2) clamp = clamper(domain[0], domain[n - 1]);
      piecewise = n > 2 ? polymap : bimap;
      output = input = null;
      return scale;
    }
    function scale(x) {
      return x == null || isNaN(x = +x) ? unknown : (output || (output = piecewise(domain.map(transform2), range, interpolate)))(transform2(clamp(x)));
    }
    scale.invert = function(y) {
      return clamp(untransform((input || (input = piecewise(range, domain.map(transform2), number_default)))(y)));
    };
    scale.domain = function(_) {
      return arguments.length ? (domain = Array.from(_, number3), rescale()) : domain.slice();
    };
    scale.range = function(_) {
      return arguments.length ? (range = Array.from(_), rescale()) : range.slice();
    };
    scale.rangeRound = function(_) {
      return range = Array.from(_), interpolate = round_default, rescale();
    };
    scale.clamp = function(_) {
      return arguments.length ? (clamp = _ ? true : identity2, rescale()) : clamp !== identity2;
    };
    scale.interpolate = function(_) {
      return arguments.length ? (interpolate = _, rescale()) : interpolate;
    };
    scale.unknown = function(_) {
      return arguments.length ? (unknown = _, scale) : unknown;
    };
    return function(t, u) {
      transform2 = t, untransform = u;
      return rescale();
    };
  }
  function continuous() {
    return transformer()(identity2, identity2);
  }
  var unit;
  var init_continuous = __esm({
    "../usr/local/lib/node_modules/d3/node_modules/d3-scale/src/continuous.js"() {
      init_src();
      init_src7();
      init_constant4();
      init_number3();
      unit = [0, 1];
    }
  });

  // ../usr/local/lib/node_modules/d3/node_modules/d3-scale/src/tickFormat.js
  function tickFormat(start2, stop, count, specifier) {
    var step = tickStep(start2, stop, count), precision;
    specifier = formatSpecifier(specifier == null ? ",f" : specifier);
    switch (specifier.type) {
      case "s": {
        var value = Math.max(Math.abs(start2), Math.abs(stop));
        if (specifier.precision == null && !isNaN(precision = precisionPrefix_default(step, value))) specifier.precision = precision;
        return formatPrefix(specifier, value);
      }
      case "":
      case "e":
      case "g":
      case "p":
      case "r": {
        if (specifier.precision == null && !isNaN(precision = precisionRound_default(step, Math.max(Math.abs(start2), Math.abs(stop))))) specifier.precision = precision - (specifier.type === "e");
        break;
      }
      case "f":
      case "%": {
        if (specifier.precision == null && !isNaN(precision = precisionFixed_default(step))) specifier.precision = precision - (specifier.type === "%") * 2;
        break;
      }
    }
    return format(specifier);
  }
  var init_tickFormat = __esm({
    "../usr/local/lib/node_modules/d3/node_modules/d3-scale/src/tickFormat.js"() {
      init_src();
      init_src20();
    }
  });

  // ../usr/local/lib/node_modules/d3/node_modules/d3-scale/src/linear.js
  function linearish(scale) {
    var domain = scale.domain;
    scale.ticks = function(count) {
      var d = domain();
      return ticks(d[0], d[d.length - 1], count == null ? 10 : count);
    };
    scale.tickFormat = function(count, specifier) {
      var d = domain();
      return tickFormat(d[0], d[d.length - 1], count == null ? 10 : count, specifier);
    };
    scale.nice = function(count) {
      if (count == null) count = 10;
      var d = domain();
      var i0 = 0;
      var i1 = d.length - 1;
      var start2 = d[i0];
      var stop = d[i1];
      var prestep;
      var step;
      var maxIter = 10;
      if (stop < start2) {
        step = start2, start2 = stop, stop = step;
        step = i0, i0 = i1, i1 = step;
      }
      while (maxIter-- > 0) {
        step = tickIncrement(start2, stop, count);
        if (step === prestep) {
          d[i0] = start2;
          d[i1] = stop;
          return domain(d);
        } else if (step > 0) {
          start2 = Math.floor(start2 / step) * step;
          stop = Math.ceil(stop / step) * step;
        } else if (step < 0) {
          start2 = Math.ceil(start2 * step) / step;
          stop = Math.floor(stop * step) / step;
        } else {
          break;
        }
        prestep = step;
      }
      return scale;
    };
    return scale;
  }
  function linear2() {
    var scale = continuous();
    scale.copy = function() {
      return copy(scale, linear2());
    };
    initRange.apply(scale, arguments);
    return linearish(scale);
  }
  var init_linear = __esm({
    "../usr/local/lib/node_modules/d3/node_modules/d3-scale/src/linear.js"() {
      init_src();
      init_continuous();
      init_init();
      init_tickFormat();
    }
  });

  // ../usr/local/lib/node_modules/d3/node_modules/d3-time/src/interval.js
  function timeInterval(floori, offseti, count, field) {
    function interval2(date) {
      return floori(date = arguments.length === 0 ? /* @__PURE__ */ new Date() : /* @__PURE__ */ new Date(+date)), date;
    }
    interval2.floor = (date) => {
      return floori(date = /* @__PURE__ */ new Date(+date)), date;
    };
    interval2.ceil = (date) => {
      return floori(date = new Date(date - 1)), offseti(date, 1), floori(date), date;
    };
    interval2.round = (date) => {
      const d0 = interval2(date), d1 = interval2.ceil(date);
      return date - d0 < d1 - date ? d0 : d1;
    };
    interval2.offset = (date, step) => {
      return offseti(date = /* @__PURE__ */ new Date(+date), step == null ? 1 : Math.floor(step)), date;
    };
    interval2.range = (start2, stop, step) => {
      const range = [];
      start2 = interval2.ceil(start2);
      step = step == null ? 1 : Math.floor(step);
      if (!(start2 < stop) || !(step > 0)) return range;
      let previous;
      do
        range.push(previous = /* @__PURE__ */ new Date(+start2)), offseti(start2, step), floori(start2);
      while (previous < start2 && start2 < stop);
      return range;
    };
    interval2.filter = (test) => {
      return timeInterval((date) => {
        if (date >= date) while (floori(date), !test(date)) date.setTime(date - 1);
      }, (date, step) => {
        if (date >= date) {
          if (step < 0) while (++step <= 0) {
            while (offseti(date, -1), !test(date)) {
            }
          }
          else while (--step >= 0) {
            while (offseti(date, 1), !test(date)) {
            }
          }
        }
      });
    };
    if (count) {
      interval2.count = (start2, end) => {
        t0.setTime(+start2), t1.setTime(+end);
        floori(t0), floori(t1);
        return Math.floor(count(t0, t1));
      };
      interval2.every = (step) => {
        step = Math.floor(step);
        return !isFinite(step) || !(step > 0) ? null : !(step > 1) ? interval2 : interval2.filter(field ? (d) => field(d) % step === 0 : (d) => interval2.count(0, d) % step === 0);
      };
    }
    return interval2;
  }
  var t0, t1;
  var init_interval = __esm({
    "../usr/local/lib/node_modules/d3/node_modules/d3-time/src/interval.js"() {
      t0 = /* @__PURE__ */ new Date();
      t1 = /* @__PURE__ */ new Date();
    }
  });

  // ../usr/local/lib/node_modules/d3/node_modules/d3-time/src/duration.js
  var durationSecond, durationMinute, durationHour, durationDay, durationWeek, durationMonth, durationYear;
  var init_duration2 = __esm({
    "../usr/local/lib/node_modules/d3/node_modules/d3-time/src/duration.js"() {
      durationSecond = 1e3;
      durationMinute = durationSecond * 60;
      durationHour = durationMinute * 60;
      durationDay = durationHour * 24;
      durationWeek = durationDay * 7;
      durationMonth = durationDay * 30;
      durationYear = durationDay * 365;
    }
  });

  // ../usr/local/lib/node_modules/d3/node_modules/d3-time/src/day.js
  var timeDay, timeDays, utcDay, utcDays, unixDay, unixDays;
  var init_day = __esm({
    "../usr/local/lib/node_modules/d3/node_modules/d3-time/src/day.js"() {
      init_interval();
      init_duration2();
      timeDay = timeInterval(
        (date) => date.setHours(0, 0, 0, 0),
        (date, step) => date.setDate(date.getDate() + step),
        (start2, end) => (end - start2 - (end.getTimezoneOffset() - start2.getTimezoneOffset()) * durationMinute) / durationDay,
        (date) => date.getDate() - 1
      );
      timeDays = timeDay.range;
      utcDay = timeInterval((date) => {
        date.setUTCHours(0, 0, 0, 0);
      }, (date, step) => {
        date.setUTCDate(date.getUTCDate() + step);
      }, (start2, end) => {
        return (end - start2) / durationDay;
      }, (date) => {
        return date.getUTCDate() - 1;
      });
      utcDays = utcDay.range;
      unixDay = timeInterval((date) => {
        date.setUTCHours(0, 0, 0, 0);
      }, (date, step) => {
        date.setUTCDate(date.getUTCDate() + step);
      }, (start2, end) => {
        return (end - start2) / durationDay;
      }, (date) => {
        return Math.floor(date / durationDay);
      });
      unixDays = unixDay.range;
    }
  });

  // ../usr/local/lib/node_modules/d3/node_modules/d3-time/src/week.js
  function timeWeekday(i) {
    return timeInterval((date) => {
      date.setDate(date.getDate() - (date.getDay() + 7 - i) % 7);
      date.setHours(0, 0, 0, 0);
    }, (date, step) => {
      date.setDate(date.getDate() + step * 7);
    }, (start2, end) => {
      return (end - start2 - (end.getTimezoneOffset() - start2.getTimezoneOffset()) * durationMinute) / durationWeek;
    });
  }
  function utcWeekday(i) {
    return timeInterval((date) => {
      date.setUTCDate(date.getUTCDate() - (date.getUTCDay() + 7 - i) % 7);
      date.setUTCHours(0, 0, 0, 0);
    }, (date, step) => {
      date.setUTCDate(date.getUTCDate() + step * 7);
    }, (start2, end) => {
      return (end - start2) / durationWeek;
    });
  }
  var timeSunday, timeMonday, timeTuesday, timeWednesday, timeThursday, timeFriday, timeSaturday, timeSundays, timeMondays, timeTuesdays, timeWednesdays, timeThursdays, timeFridays, timeSaturdays, utcSunday, utcMonday, utcTuesday, utcWednesday, utcThursday, utcFriday, utcSaturday, utcSundays, utcMondays, utcTuesdays, utcWednesdays, utcThursdays, utcFridays, utcSaturdays;
  var init_week = __esm({
    "../usr/local/lib/node_modules/d3/node_modules/d3-time/src/week.js"() {
      init_interval();
      init_duration2();
      timeSunday = timeWeekday(0);
      timeMonday = timeWeekday(1);
      timeTuesday = timeWeekday(2);
      timeWednesday = timeWeekday(3);
      timeThursday = timeWeekday(4);
      timeFriday = timeWeekday(5);
      timeSaturday = timeWeekday(6);
      timeSundays = timeSunday.range;
      timeMondays = timeMonday.range;
      timeTuesdays = timeTuesday.range;
      timeWednesdays = timeWednesday.range;
      timeThursdays = timeThursday.range;
      timeFridays = timeFriday.range;
      timeSaturdays = timeSaturday.range;
      utcSunday = utcWeekday(0);
      utcMonday = utcWeekday(1);
      utcTuesday = utcWeekday(2);
      utcWednesday = utcWeekday(3);
      utcThursday = utcWeekday(4);
      utcFriday = utcWeekday(5);
      utcSaturday = utcWeekday(6);
      utcSundays = utcSunday.range;
      utcMondays = utcMonday.range;
      utcTuesdays = utcTuesday.range;
      utcWednesdays = utcWednesday.range;
      utcThursdays = utcThursday.range;
      utcFridays = utcFriday.range;
      utcSaturdays = utcSaturday.range;
    }
  });

  // ../usr/local/lib/node_modules/d3/node_modules/d3-time/src/year.js
  var timeYear, timeYears, utcYear, utcYears;
  var init_year = __esm({
    "../usr/local/lib/node_modules/d3/node_modules/d3-time/src/year.js"() {
      init_interval();
      timeYear = timeInterval((date) => {
        date.setMonth(0, 1);
        date.setHours(0, 0, 0, 0);
      }, (date, step) => {
        date.setFullYear(date.getFullYear() + step);
      }, (start2, end) => {
        return end.getFullYear() - start2.getFullYear();
      }, (date) => {
        return date.getFullYear();
      });
      timeYear.every = (k) => {
        return !isFinite(k = Math.floor(k)) || !(k > 0) ? null : timeInterval((date) => {
          date.setFullYear(Math.floor(date.getFullYear() / k) * k);
          date.setMonth(0, 1);
          date.setHours(0, 0, 0, 0);
        }, (date, step) => {
          date.setFullYear(date.getFullYear() + step * k);
        });
      };
      timeYears = timeYear.range;
      utcYear = timeInterval((date) => {
        date.setUTCMonth(0, 1);
        date.setUTCHours(0, 0, 0, 0);
      }, (date, step) => {
        date.setUTCFullYear(date.getUTCFullYear() + step);
      }, (start2, end) => {
        return end.getUTCFullYear() - start2.getUTCFullYear();
      }, (date) => {
        return date.getUTCFullYear();
      });
      utcYear.every = (k) => {
        return !isFinite(k = Math.floor(k)) || !(k > 0) ? null : timeInterval((date) => {
          date.setUTCFullYear(Math.floor(date.getUTCFullYear() / k) * k);
          date.setUTCMonth(0, 1);
          date.setUTCHours(0, 0, 0, 0);
        }, (date, step) => {
          date.setUTCFullYear(date.getUTCFullYear() + step * k);
        });
      };
      utcYears = utcYear.range;
    }
  });

  // ../usr/local/lib/node_modules/d3/node_modules/d3-time/src/index.js
  var init_src25 = __esm({
    "../usr/local/lib/node_modules/d3/node_modules/d3-time/src/index.js"() {
      init_day();
      init_week();
      init_year();
    }
  });

  // ../usr/local/lib/node_modules/d3/node_modules/d3-time-format/src/locale.js
  function localDate(d) {
    if (0 <= d.y && d.y < 100) {
      var date = new Date(-1, d.m, d.d, d.H, d.M, d.S, d.L);
      date.setFullYear(d.y);
      return date;
    }
    return new Date(d.y, d.m, d.d, d.H, d.M, d.S, d.L);
  }
  function utcDate(d) {
    if (0 <= d.y && d.y < 100) {
      var date = new Date(Date.UTC(-1, d.m, d.d, d.H, d.M, d.S, d.L));
      date.setUTCFullYear(d.y);
      return date;
    }
    return new Date(Date.UTC(d.y, d.m, d.d, d.H, d.M, d.S, d.L));
  }
  function newDate(y, m, d) {
    return { y, m, d, H: 0, M: 0, S: 0, L: 0 };
  }
  function formatLocale(locale3) {
    var locale_dateTime = locale3.dateTime, locale_date = locale3.date, locale_time = locale3.time, locale_periods = locale3.periods, locale_weekdays = locale3.days, locale_shortWeekdays = locale3.shortDays, locale_months = locale3.months, locale_shortMonths = locale3.shortMonths;
    var periodRe = formatRe(locale_periods), periodLookup = formatLookup(locale_periods), weekdayRe = formatRe(locale_weekdays), weekdayLookup = formatLookup(locale_weekdays), shortWeekdayRe = formatRe(locale_shortWeekdays), shortWeekdayLookup = formatLookup(locale_shortWeekdays), monthRe = formatRe(locale_months), monthLookup = formatLookup(locale_months), shortMonthRe = formatRe(locale_shortMonths), shortMonthLookup = formatLookup(locale_shortMonths);
    var formats = {
      "a": formatShortWeekday,
      "A": formatWeekday,
      "b": formatShortMonth,
      "B": formatMonth,
      "c": null,
      "d": formatDayOfMonth,
      "e": formatDayOfMonth,
      "f": formatMicroseconds,
      "g": formatYearISO,
      "G": formatFullYearISO,
      "H": formatHour24,
      "I": formatHour12,
      "j": formatDayOfYear,
      "L": formatMilliseconds,
      "m": formatMonthNumber,
      "M": formatMinutes,
      "p": formatPeriod,
      "q": formatQuarter,
      "Q": formatUnixTimestamp,
      "s": formatUnixTimestampSeconds,
      "S": formatSeconds,
      "u": formatWeekdayNumberMonday,
      "U": formatWeekNumberSunday,
      "V": formatWeekNumberISO,
      "w": formatWeekdayNumberSunday,
      "W": formatWeekNumberMonday,
      "x": null,
      "X": null,
      "y": formatYear,
      "Y": formatFullYear,
      "Z": formatZone,
      "%": formatLiteralPercent
    };
    var utcFormats = {
      "a": formatUTCShortWeekday,
      "A": formatUTCWeekday,
      "b": formatUTCShortMonth,
      "B": formatUTCMonth,
      "c": null,
      "d": formatUTCDayOfMonth,
      "e": formatUTCDayOfMonth,
      "f": formatUTCMicroseconds,
      "g": formatUTCYearISO,
      "G": formatUTCFullYearISO,
      "H": formatUTCHour24,
      "I": formatUTCHour12,
      "j": formatUTCDayOfYear,
      "L": formatUTCMilliseconds,
      "m": formatUTCMonthNumber,
      "M": formatUTCMinutes,
      "p": formatUTCPeriod,
      "q": formatUTCQuarter,
      "Q": formatUnixTimestamp,
      "s": formatUnixTimestampSeconds,
      "S": formatUTCSeconds,
      "u": formatUTCWeekdayNumberMonday,
      "U": formatUTCWeekNumberSunday,
      "V": formatUTCWeekNumberISO,
      "w": formatUTCWeekdayNumberSunday,
      "W": formatUTCWeekNumberMonday,
      "x": null,
      "X": null,
      "y": formatUTCYear,
      "Y": formatUTCFullYear,
      "Z": formatUTCZone,
      "%": formatLiteralPercent
    };
    var parses = {
      "a": parseShortWeekday,
      "A": parseWeekday,
      "b": parseShortMonth,
      "B": parseMonth,
      "c": parseLocaleDateTime,
      "d": parseDayOfMonth,
      "e": parseDayOfMonth,
      "f": parseMicroseconds,
      "g": parseYear,
      "G": parseFullYear,
      "H": parseHour24,
      "I": parseHour24,
      "j": parseDayOfYear,
      "L": parseMilliseconds,
      "m": parseMonthNumber,
      "M": parseMinutes,
      "p": parsePeriod,
      "q": parseQuarter,
      "Q": parseUnixTimestamp,
      "s": parseUnixTimestampSeconds,
      "S": parseSeconds,
      "u": parseWeekdayNumberMonday,
      "U": parseWeekNumberSunday,
      "V": parseWeekNumberISO,
      "w": parseWeekdayNumberSunday,
      "W": parseWeekNumberMonday,
      "x": parseLocaleDate,
      "X": parseLocaleTime,
      "y": parseYear,
      "Y": parseFullYear,
      "Z": parseZone,
      "%": parseLiteralPercent
    };
    formats.x = newFormat(locale_date, formats);
    formats.X = newFormat(locale_time, formats);
    formats.c = newFormat(locale_dateTime, formats);
    utcFormats.x = newFormat(locale_date, utcFormats);
    utcFormats.X = newFormat(locale_time, utcFormats);
    utcFormats.c = newFormat(locale_dateTime, utcFormats);
    function newFormat(specifier, formats2) {
      return function(date) {
        var string = [], i = -1, j = 0, n = specifier.length, c, pad2, format2;
        if (!(date instanceof Date)) date = /* @__PURE__ */ new Date(+date);
        while (++i < n) {
          if (specifier.charCodeAt(i) === 37) {
            string.push(specifier.slice(j, i));
            if ((pad2 = pads[c = specifier.charAt(++i)]) != null) c = specifier.charAt(++i);
            else pad2 = c === "e" ? " " : "0";
            if (format2 = formats2[c]) c = format2(date, pad2);
            string.push(c);
            j = i + 1;
          }
        }
        string.push(specifier.slice(j, i));
        return string.join("");
      };
    }
    function newParse(specifier, Z) {
      return function(string) {
        var d = newDate(1900, void 0, 1), i = parseSpecifier(d, specifier, string += "", 0), week, day;
        if (i != string.length) return null;
        if ("Q" in d) return new Date(d.Q);
        if ("s" in d) return new Date(d.s * 1e3 + ("L" in d ? d.L : 0));
        if (Z && !("Z" in d)) d.Z = 0;
        if ("p" in d) d.H = d.H % 12 + d.p * 12;
        if (d.m === void 0) d.m = "q" in d ? d.q : 0;
        if ("V" in d) {
          if (d.V < 1 || d.V > 53) return null;
          if (!("w" in d)) d.w = 1;
          if ("Z" in d) {
            week = utcDate(newDate(d.y, 0, 1)), day = week.getUTCDay();
            week = day > 4 || day === 0 ? utcMonday.ceil(week) : utcMonday(week);
            week = utcDay.offset(week, (d.V - 1) * 7);
            d.y = week.getUTCFullYear();
            d.m = week.getUTCMonth();
            d.d = week.getUTCDate() + (d.w + 6) % 7;
          } else {
            week = localDate(newDate(d.y, 0, 1)), day = week.getDay();
            week = day > 4 || day === 0 ? timeMonday.ceil(week) : timeMonday(week);
            week = timeDay.offset(week, (d.V - 1) * 7);
            d.y = week.getFullYear();
            d.m = week.getMonth();
            d.d = week.getDate() + (d.w + 6) % 7;
          }
        } else if ("W" in d || "U" in d) {
          if (!("w" in d)) d.w = "u" in d ? d.u % 7 : "W" in d ? 1 : 0;
          day = "Z" in d ? utcDate(newDate(d.y, 0, 1)).getUTCDay() : localDate(newDate(d.y, 0, 1)).getDay();
          d.m = 0;
          d.d = "W" in d ? (d.w + 6) % 7 + d.W * 7 - (day + 5) % 7 : d.w + d.U * 7 - (day + 6) % 7;
        }
        if ("Z" in d) {
          d.H += d.Z / 100 | 0;
          d.M += d.Z % 100;
          return utcDate(d);
        }
        return localDate(d);
      };
    }
    function parseSpecifier(d, specifier, string, j) {
      var i = 0, n = specifier.length, m = string.length, c, parse;
      while (i < n) {
        if (j >= m) return -1;
        c = specifier.charCodeAt(i++);
        if (c === 37) {
          c = specifier.charAt(i++);
          parse = parses[c in pads ? specifier.charAt(i++) : c];
          if (!parse || (j = parse(d, string, j)) < 0) return -1;
        } else if (c != string.charCodeAt(j++)) {
          return -1;
        }
      }
      return j;
    }
    function parsePeriod(d, string, i) {
      var n = periodRe.exec(string.slice(i));
      return n ? (d.p = periodLookup.get(n[0].toLowerCase()), i + n[0].length) : -1;
    }
    function parseShortWeekday(d, string, i) {
      var n = shortWeekdayRe.exec(string.slice(i));
      return n ? (d.w = shortWeekdayLookup.get(n[0].toLowerCase()), i + n[0].length) : -1;
    }
    function parseWeekday(d, string, i) {
      var n = weekdayRe.exec(string.slice(i));
      return n ? (d.w = weekdayLookup.get(n[0].toLowerCase()), i + n[0].length) : -1;
    }
    function parseShortMonth(d, string, i) {
      var n = shortMonthRe.exec(string.slice(i));
      return n ? (d.m = shortMonthLookup.get(n[0].toLowerCase()), i + n[0].length) : -1;
    }
    function parseMonth(d, string, i) {
      var n = monthRe.exec(string.slice(i));
      return n ? (d.m = monthLookup.get(n[0].toLowerCase()), i + n[0].length) : -1;
    }
    function parseLocaleDateTime(d, string, i) {
      return parseSpecifier(d, locale_dateTime, string, i);
    }
    function parseLocaleDate(d, string, i) {
      return parseSpecifier(d, locale_date, string, i);
    }
    function parseLocaleTime(d, string, i) {
      return parseSpecifier(d, locale_time, string, i);
    }
    function formatShortWeekday(d) {
      return locale_shortWeekdays[d.getDay()];
    }
    function formatWeekday(d) {
      return locale_weekdays[d.getDay()];
    }
    function formatShortMonth(d) {
      return locale_shortMonths[d.getMonth()];
    }
    function formatMonth(d) {
      return locale_months[d.getMonth()];
    }
    function formatPeriod(d) {
      return locale_periods[+(d.getHours() >= 12)];
    }
    function formatQuarter(d) {
      return 1 + ~~(d.getMonth() / 3);
    }
    function formatUTCShortWeekday(d) {
      return locale_shortWeekdays[d.getUTCDay()];
    }
    function formatUTCWeekday(d) {
      return locale_weekdays[d.getUTCDay()];
    }
    function formatUTCShortMonth(d) {
      return locale_shortMonths[d.getUTCMonth()];
    }
    function formatUTCMonth(d) {
      return locale_months[d.getUTCMonth()];
    }
    function formatUTCPeriod(d) {
      return locale_periods[+(d.getUTCHours() >= 12)];
    }
    function formatUTCQuarter(d) {
      return 1 + ~~(d.getUTCMonth() / 3);
    }
    return {
      format: function(specifier) {
        var f = newFormat(specifier += "", formats);
        f.toString = function() {
          return specifier;
        };
        return f;
      },
      parse: function(specifier) {
        var p = newParse(specifier += "", false);
        p.toString = function() {
          return specifier;
        };
        return p;
      },
      utcFormat: function(specifier) {
        var f = newFormat(specifier += "", utcFormats);
        f.toString = function() {
          return specifier;
        };
        return f;
      },
      utcParse: function(specifier) {
        var p = newParse(specifier += "", true);
        p.toString = function() {
          return specifier;
        };
        return p;
      }
    };
  }
  function pad(value, fill, width) {
    var sign = value < 0 ? "-" : "", string = (sign ? -value : value) + "", length = string.length;
    return sign + (length < width ? new Array(width - length + 1).join(fill) + string : string);
  }
  function requote(s) {
    return s.replace(requoteRe, "\\$&");
  }
  function formatRe(names) {
    return new RegExp("^(?:" + names.map(requote).join("|") + ")", "i");
  }
  function formatLookup(names) {
    return new Map(names.map((name, i) => [name.toLowerCase(), i]));
  }
  function parseWeekdayNumberSunday(d, string, i) {
    var n = numberRe.exec(string.slice(i, i + 1));
    return n ? (d.w = +n[0], i + n[0].length) : -1;
  }
  function parseWeekdayNumberMonday(d, string, i) {
    var n = numberRe.exec(string.slice(i, i + 1));
    return n ? (d.u = +n[0], i + n[0].length) : -1;
  }
  function parseWeekNumberSunday(d, string, i) {
    var n = numberRe.exec(string.slice(i, i + 2));
    return n ? (d.U = +n[0], i + n[0].length) : -1;
  }
  function parseWeekNumberISO(d, string, i) {
    var n = numberRe.exec(string.slice(i, i + 2));
    return n ? (d.V = +n[0], i + n[0].length) : -1;
  }
  function parseWeekNumberMonday(d, string, i) {
    var n = numberRe.exec(string.slice(i, i + 2));
    return n ? (d.W = +n[0], i + n[0].length) : -1;
  }
  function parseFullYear(d, string, i) {
    var n = numberRe.exec(string.slice(i, i + 4));
    return n ? (d.y = +n[0], i + n[0].length) : -1;
  }
  function parseYear(d, string, i) {
    var n = numberRe.exec(string.slice(i, i + 2));
    return n ? (d.y = +n[0] + (+n[0] > 68 ? 1900 : 2e3), i + n[0].length) : -1;
  }
  function parseZone(d, string, i) {
    var n = /^(Z)|([+-]\d\d)(?::?(\d\d))?/.exec(string.slice(i, i + 6));
    return n ? (d.Z = n[1] ? 0 : -(n[2] + (n[3] || "00")), i + n[0].length) : -1;
  }
  function parseQuarter(d, string, i) {
    var n = numberRe.exec(string.slice(i, i + 1));
    return n ? (d.q = n[0] * 3 - 3, i + n[0].length) : -1;
  }
  function parseMonthNumber(d, string, i) {
    var n = numberRe.exec(string.slice(i, i + 2));
    return n ? (d.m = n[0] - 1, i + n[0].length) : -1;
  }
  function parseDayOfMonth(d, string, i) {
    var n = numberRe.exec(string.slice(i, i + 2));
    return n ? (d.d = +n[0], i + n[0].length) : -1;
  }
  function parseDayOfYear(d, string, i) {
    var n = numberRe.exec(string.slice(i, i + 3));
    return n ? (d.m = 0, d.d = +n[0], i + n[0].length) : -1;
  }
  function parseHour24(d, string, i) {
    var n = numberRe.exec(string.slice(i, i + 2));
    return n ? (d.H = +n[0], i + n[0].length) : -1;
  }
  function parseMinutes(d, string, i) {
    var n = numberRe.exec(string.slice(i, i + 2));
    return n ? (d.M = +n[0], i + n[0].length) : -1;
  }
  function parseSeconds(d, string, i) {
    var n = numberRe.exec(string.slice(i, i + 2));
    return n ? (d.S = +n[0], i + n[0].length) : -1;
  }
  function parseMilliseconds(d, string, i) {
    var n = numberRe.exec(string.slice(i, i + 3));
    return n ? (d.L = +n[0], i + n[0].length) : -1;
  }
  function parseMicroseconds(d, string, i) {
    var n = numberRe.exec(string.slice(i, i + 6));
    return n ? (d.L = Math.floor(n[0] / 1e3), i + n[0].length) : -1;
  }
  function parseLiteralPercent(d, string, i) {
    var n = percentRe.exec(string.slice(i, i + 1));
    return n ? i + n[0].length : -1;
  }
  function parseUnixTimestamp(d, string, i) {
    var n = numberRe.exec(string.slice(i));
    return n ? (d.Q = +n[0], i + n[0].length) : -1;
  }
  function parseUnixTimestampSeconds(d, string, i) {
    var n = numberRe.exec(string.slice(i));
    return n ? (d.s = +n[0], i + n[0].length) : -1;
  }
  function formatDayOfMonth(d, p) {
    return pad(d.getDate(), p, 2);
  }
  function formatHour24(d, p) {
    return pad(d.getHours(), p, 2);
  }
  function formatHour12(d, p) {
    return pad(d.getHours() % 12 || 12, p, 2);
  }
  function formatDayOfYear(d, p) {
    return pad(1 + timeDay.count(timeYear(d), d), p, 3);
  }
  function formatMilliseconds(d, p) {
    return pad(d.getMilliseconds(), p, 3);
  }
  function formatMicroseconds(d, p) {
    return formatMilliseconds(d, p) + "000";
  }
  function formatMonthNumber(d, p) {
    return pad(d.getMonth() + 1, p, 2);
  }
  function formatMinutes(d, p) {
    return pad(d.getMinutes(), p, 2);
  }
  function formatSeconds(d, p) {
    return pad(d.getSeconds(), p, 2);
  }
  function formatWeekdayNumberMonday(d) {
    var day = d.getDay();
    return day === 0 ? 7 : day;
  }
  function formatWeekNumberSunday(d, p) {
    return pad(timeSunday.count(timeYear(d) - 1, d), p, 2);
  }
  function dISO(d) {
    var day = d.getDay();
    return day >= 4 || day === 0 ? timeThursday(d) : timeThursday.ceil(d);
  }
  function formatWeekNumberISO(d, p) {
    d = dISO(d);
    return pad(timeThursday.count(timeYear(d), d) + (timeYear(d).getDay() === 4), p, 2);
  }
  function formatWeekdayNumberSunday(d) {
    return d.getDay();
  }
  function formatWeekNumberMonday(d, p) {
    return pad(timeMonday.count(timeYear(d) - 1, d), p, 2);
  }
  function formatYear(d, p) {
    return pad(d.getFullYear() % 100, p, 2);
  }
  function formatYearISO(d, p) {
    d = dISO(d);
    return pad(d.getFullYear() % 100, p, 2);
  }
  function formatFullYear(d, p) {
    return pad(d.getFullYear() % 1e4, p, 4);
  }
  function formatFullYearISO(d, p) {
    var day = d.getDay();
    d = day >= 4 || day === 0 ? timeThursday(d) : timeThursday.ceil(d);
    return pad(d.getFullYear() % 1e4, p, 4);
  }
  function formatZone(d) {
    var z = d.getTimezoneOffset();
    return (z > 0 ? "-" : (z *= -1, "+")) + pad(z / 60 | 0, "0", 2) + pad(z % 60, "0", 2);
  }
  function formatUTCDayOfMonth(d, p) {
    return pad(d.getUTCDate(), p, 2);
  }
  function formatUTCHour24(d, p) {
    return pad(d.getUTCHours(), p, 2);
  }
  function formatUTCHour12(d, p) {
    return pad(d.getUTCHours() % 12 || 12, p, 2);
  }
  function formatUTCDayOfYear(d, p) {
    return pad(1 + utcDay.count(utcYear(d), d), p, 3);
  }
  function formatUTCMilliseconds(d, p) {
    return pad(d.getUTCMilliseconds(), p, 3);
  }
  function formatUTCMicroseconds(d, p) {
    return formatUTCMilliseconds(d, p) + "000";
  }
  function formatUTCMonthNumber(d, p) {
    return pad(d.getUTCMonth() + 1, p, 2);
  }
  function formatUTCMinutes(d, p) {
    return pad(d.getUTCMinutes(), p, 2);
  }
  function formatUTCSeconds(d, p) {
    return pad(d.getUTCSeconds(), p, 2);
  }
  function formatUTCWeekdayNumberMonday(d) {
    var dow = d.getUTCDay();
    return dow === 0 ? 7 : dow;
  }
  function formatUTCWeekNumberSunday(d, p) {
    return pad(utcSunday.count(utcYear(d) - 1, d), p, 2);
  }
  function UTCdISO(d) {
    var day = d.getUTCDay();
    return day >= 4 || day === 0 ? utcThursday(d) : utcThursday.ceil(d);
  }
  function formatUTCWeekNumberISO(d, p) {
    d = UTCdISO(d);
    return pad(utcThursday.count(utcYear(d), d) + (utcYear(d).getUTCDay() === 4), p, 2);
  }
  function formatUTCWeekdayNumberSunday(d) {
    return d.getUTCDay();
  }
  function formatUTCWeekNumberMonday(d, p) {
    return pad(utcMonday.count(utcYear(d) - 1, d), p, 2);
  }
  function formatUTCYear(d, p) {
    return pad(d.getUTCFullYear() % 100, p, 2);
  }
  function formatUTCYearISO(d, p) {
    d = UTCdISO(d);
    return pad(d.getUTCFullYear() % 100, p, 2);
  }
  function formatUTCFullYear(d, p) {
    return pad(d.getUTCFullYear() % 1e4, p, 4);
  }
  function formatUTCFullYearISO(d, p) {
    var day = d.getUTCDay();
    d = day >= 4 || day === 0 ? utcThursday(d) : utcThursday.ceil(d);
    return pad(d.getUTCFullYear() % 1e4, p, 4);
  }
  function formatUTCZone() {
    return "+0000";
  }
  function formatLiteralPercent() {
    return "%";
  }
  function formatUnixTimestamp(d) {
    return +d;
  }
  function formatUnixTimestampSeconds(d) {
    return Math.floor(+d / 1e3);
  }
  var pads, numberRe, percentRe, requoteRe;
  var init_locale2 = __esm({
    "../usr/local/lib/node_modules/d3/node_modules/d3-time-format/src/locale.js"() {
      init_src25();
      pads = { "-": "", "_": " ", "0": "0" };
      numberRe = /^\s*\d+/;
      percentRe = /^%/;
      requoteRe = /[\\^$*+?|[\]().{}]/g;
    }
  });

  // ../usr/local/lib/node_modules/d3/node_modules/d3-time-format/src/defaultLocale.js
  function defaultLocale2(definition) {
    locale2 = formatLocale(definition);
    timeFormat = locale2.format;
    timeParse = locale2.parse;
    utcFormat = locale2.utcFormat;
    utcParse = locale2.utcParse;
    return locale2;
  }
  var locale2, timeFormat, timeParse, utcFormat, utcParse;
  var init_defaultLocale2 = __esm({
    "../usr/local/lib/node_modules/d3/node_modules/d3-time-format/src/defaultLocale.js"() {
      init_locale2();
      defaultLocale2({
        dateTime: "%x, %X",
        date: "%-m/%-d/%Y",
        time: "%-I:%M:%S %p",
        periods: ["AM", "PM"],
        days: ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
        shortDays: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
        months: ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"],
        shortMonths: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
      });
    }
  });

  // ../usr/local/lib/node_modules/d3/node_modules/d3-time-format/src/index.js
  var init_src26 = __esm({
    "../usr/local/lib/node_modules/d3/node_modules/d3-time-format/src/index.js"() {
      init_defaultLocale2();
    }
  });

  // ../usr/local/lib/node_modules/d3/node_modules/d3-scale/src/index.js
  var init_src27 = __esm({
    "../usr/local/lib/node_modules/d3/node_modules/d3-scale/src/index.js"() {
      init_linear();
    }
  });

  // ../usr/local/lib/node_modules/d3/node_modules/d3-scale-chromatic/src/index.js
  var init_src28 = __esm({
    "../usr/local/lib/node_modules/d3/node_modules/d3-scale-chromatic/src/index.js"() {
    }
  });

  // ../usr/local/lib/node_modules/d3/node_modules/d3-shape/src/index.js
  var init_src29 = __esm({
    "../usr/local/lib/node_modules/d3/node_modules/d3-shape/src/index.js"() {
    }
  });

  // ../usr/local/lib/node_modules/d3/node_modules/d3-zoom/src/constant.js
  var init_constant5 = __esm({
    "../usr/local/lib/node_modules/d3/node_modules/d3-zoom/src/constant.js"() {
    }
  });

  // ../usr/local/lib/node_modules/d3/node_modules/d3-zoom/src/event.js
  var init_event2 = __esm({
    "../usr/local/lib/node_modules/d3/node_modules/d3-zoom/src/event.js"() {
    }
  });

  // ../usr/local/lib/node_modules/d3/node_modules/d3-zoom/src/transform.js
  function Transform(k, x, y) {
    this.k = k;
    this.x = x;
    this.y = y;
  }
  function transform(node) {
    while (!node.__zoom) if (!(node = node.parentNode)) return identity3;
    return node.__zoom;
  }
  var identity3;
  var init_transform2 = __esm({
    "../usr/local/lib/node_modules/d3/node_modules/d3-zoom/src/transform.js"() {
      Transform.prototype = {
        constructor: Transform,
        scale: function(k) {
          return k === 1 ? this : new Transform(this.k * k, this.x, this.y);
        },
        translate: function(x, y) {
          return x === 0 & y === 0 ? this : new Transform(this.k, this.x + this.k * x, this.y + this.k * y);
        },
        apply: function(point) {
          return [point[0] * this.k + this.x, point[1] * this.k + this.y];
        },
        applyX: function(x) {
          return x * this.k + this.x;
        },
        applyY: function(y) {
          return y * this.k + this.y;
        },
        invert: function(location) {
          return [(location[0] - this.x) / this.k, (location[1] - this.y) / this.k];
        },
        invertX: function(x) {
          return (x - this.x) / this.k;
        },
        invertY: function(y) {
          return (y - this.y) / this.k;
        },
        rescaleX: function(x) {
          return x.copy().domain(x.range().map(this.invertX, this).map(x.invert, x));
        },
        rescaleY: function(y) {
          return y.copy().domain(y.range().map(this.invertY, this).map(y.invert, y));
        },
        toString: function() {
          return "translate(" + this.x + "," + this.y + ") scale(" + this.k + ")";
        }
      };
      identity3 = new Transform(1, 0, 0);
      transform.prototype = Transform.prototype;
    }
  });

  // ../usr/local/lib/node_modules/d3/node_modules/d3-zoom/src/noevent.js
  var init_noevent2 = __esm({
    "../usr/local/lib/node_modules/d3/node_modules/d3-zoom/src/noevent.js"() {
    }
  });

  // ../usr/local/lib/node_modules/d3/node_modules/d3-zoom/src/zoom.js
  var init_zoom = __esm({
    "../usr/local/lib/node_modules/d3/node_modules/d3-zoom/src/zoom.js"() {
      init_src10();
      init_constant5();
      init_event2();
      init_transform2();
      init_noevent2();
    }
  });

  // ../usr/local/lib/node_modules/d3/node_modules/d3-zoom/src/index.js
  var init_src30 = __esm({
    "../usr/local/lib/node_modules/d3/node_modules/d3-zoom/src/index.js"() {
      init_zoom();
      init_transform2();
    }
  });

  // ../usr/local/lib/node_modules/d3/src/index.js
  var init_src31 = __esm({
    "../usr/local/lib/node_modules/d3/src/index.js"() {
      init_src();
      init_src2();
      init_src11();
      init_src13();
      init_src6();
      init_src14();
      init_src15();
      init_src3();
      init_src5();
      init_src16();
      init_src9();
      init_src17();
      init_src19();
      init_src20();
      init_src21();
      init_src22();
      init_src7();
      init_src12();
      init_src23();
      init_src18();
      init_src24();
      init_src27();
      init_src28();
      init_src4();
      init_src29();
      init_src25();
      init_src26();
      init_src8();
      init_src10();
      init_src30();
    }
  });

  // src/app.ts
  var require_app = __commonJS({
    "src/app.ts"() {
      init_src31();
      var TOKEN_KEY = "pellmoor_session_v2";
      var token = localStorage.getItem(TOKEN_KEY) || "";
      var me = null;
      var stages = [];
      var terminal = [];
      var view = null;
      var openId = null;
      var returnFocus = null;
      var batchSelected = [];
      var batchReview = null;
      var batchRequest = null;
      var batchMessage = "";
      var batchBusy = false;
      var batchDone = false;
      var $ = (selector) => document.querySelector(selector);
      var esc = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
      function operationId() {
        if (typeof crypto.randomUUID === "function") {
          return `op_${crypto.randomUUID().replaceAll("-", "")}`;
        }
        const bytes = new Uint8Array(16);
        crypto.getRandomValues(bytes);
        return `op_${Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("")}`;
      }
      async function api(method, endpoint, body) {
        const headers = { "Content-Type": "application/json" };
        if (token) headers.Authorization = `Bearer ${token}`;
        const response = await fetch(endpoint, {
          method,
          headers,
          body: body === void 0 ? void 0 : JSON.stringify(body)
        });
        const data = await response.json().catch(() => ({}));
        return { ok: response.ok, status: response.status, data };
      }
      function say(message, good = false) {
        const toast = $("#toast");
        toast.textContent = message;
        toast.dataset.tone = good ? "good" : "bad";
        toast.classList.add("show");
        window.setTimeout(() => toast.classList.remove("show"), 4200);
      }
      function setBusy(busy, message = "Working\u2026") {
        document.body.dataset.busy = String(busy);
        $("#progress").textContent = busy ? message : "";
        document.querySelectorAll("button").forEach((button) => {
          if (!button.closest("#signin")) button.disabled = busy;
        });
      }
      function drawFunnel(rungs) {
        const host = select_default2("#funnel");
        host.selectAll("*").remove();
        const total = max(rungs, (rung) => rung.reached) ?? 0;
        if (!total) {
          host.append("p").attr("class", "empty").text("Nobody has applied to this vacancy yet. The funnel will appear after the first application.");
          return;
        }
        const width = host.node().clientWidth || 640;
        const compact = width < 470;
        const rowHeight = compact ? 58 : 48;
        const labelWidth = compact ? 0 : 102;
        const chartWidth = compact ? width : Math.max(110, width - labelWidth - 180);
        const scale = linear2().domain([0, total]).range([0, chartWidth]);
        const svg = host.append("svg").attr("width", "100%").attr("height", rungs.length * rowHeight + 20).attr("viewBox", `0 0 ${width} ${rungs.length * rowHeight + 20}`).attr("role", "img").attr("aria-label", `Funnel: ${rungs.map((r) => `${r.stage} ${r.reached} reached`).join(", ")}`);
        const groups = svg.selectAll("g.rung").data(rungs).join("g").attr("class", "rung").attr("transform", (_r, index) => `translate(0,${index * rowHeight + 10})`);
        groups.append("text").attr("class", "stage-label").attr("x", compact ? 0 : labelWidth - 10).attr("y", compact ? 14 : 20).attr("text-anchor", compact ? "start" : "end").text((r) => r.stage);
        groups.append("rect").attr("class", "reached").attr("x", labelWidth).attr("y", compact ? 24 : 3).attr("height", compact ? 16 : 25).attr("rx", 5).attr("width", (r) => Math.max(2, scale(r.reached)));
        groups.append("rect").attr("class", "still").attr("x", labelWidth).attr("y", compact ? 24 : 3).attr("height", compact ? 16 : 25).attr("rx", 5).attr("width", (r) => scale(r.still));
        groups.append("text").attr("class", "figure").attr("x", (r) => compact ? width : labelWidth + Math.max(2, scale(r.reached)) + 8).attr("y", compact ? 14 : 20).attr("text-anchor", compact ? "end" : "start").text((r) => `${r.reached} reached \xB7 ${r.still} here${r.left ? ` \xB7 ${r.left} left` : ""}`);
        groups.append("title").text((r) => `${r.stage}: ${r.reached} reached, ${r.still} here, ${r.left} left here`);
      }
      function can(action) {
        if (!me) return false;
        if (action === "move") return me.role === "hiring manager";
        if (action === "add" || action === "panel") return me.role === "coordinator";
        if (action === "score") return me.role === "panel" || me.role === "hiring manager";
        return true;
      }
      function drawBoard(snapshot) {
        const columns = [...stages, ...terminal];
        $("#board").innerHTML = columns.map((stage) => {
          const here = snapshot.candidates.filter((candidate) => candidate.stage === stage);
          return `<section class="col${terminal.includes(stage) ? " terminal" : ""}" aria-label="${esc(stage)} stage">
      <h3>${esc(stage)}<span class="n">${here.length}</span></h3>
      ${here.length ? here.map((candidate) => `<button class="cand" data-id="${candidate.id}">
        <b>${esc(candidate.name)}</b><span class="meta">${candidate.applied_days}d \xB7 ${candidate.id}
        ${candidate.scores.length ? ` \xB7 ${candidate.scores.length} scored` : ""}
        ${candidate.notes ? ` \xB7 ${candidate.notes} notes` : ""}</span></button>`).join("") : `<p class="empty-col">${terminal.includes(stage) ? "nobody" : "empty"}</p>`}
    </section>`;
        }).join("");
        $("#board").querySelectorAll(".cand").forEach((button) => {
          button.onclick = () => {
            returnFocus = button;
            openCandidate(button.dataset.id);
          };
        });
      }
      function applySnapshot(snapshot) {
        view = snapshot;
        const summary = document.querySelector(`#roles button[data-code="${snapshot.role.code}"] span`);
        if (summary) {
          const live = snapshot.candidates.filter((candidate) => !terminal.includes(candidate.stage)).length;
          summary.textContent = `${live} live \xB7 ${snapshot.candidates.length} total \xB7 r${snapshot.revision}`;
        }
        $("#role-title").textContent = `${snapshot.role.title} \xB7 ${snapshot.role.team}`;
        $("#role-sub").textContent = `${snapshot.role.openings} opening${snapshot.role.openings === 1 ? "" : "s"} \xB7 ${snapshot.capacity.reserved} reserved \xB7 ${snapshot.capacity.filled} filled \xB7 ${snapshot.capacity.available} available \xB7 ${snapshot.candidates.length} candidates \xB7 revision ${snapshot.revision}`;
        $("#revision").textContent = `r${snapshot.revision}`;
        $("#addcandidate").hidden = !can("add");
        $("#batch-open").hidden = !can("move");
        drawFunnel(snapshot.funnel);
        drawBoard(snapshot);
      }
      async function loadRole(code) {
        if (view?.role.code !== code) resetBatch();
        setBusy(true, "Loading vacancy\u2026");
        const result = await api("GET", `/api/roles/${encodeURIComponent(code)}`);
        setBusy(false);
        if (!result.ok) return say(result.data.error || "That vacancy would not load.");
        closeCandidate(false);
        applySnapshot(result.data);
      }
      function closeCandidate(restoreFocus = true) {
        const candidateId = openId;
        openId = null;
        $("#panel").innerHTML = "";
        $("#app").removeAttribute("inert");
        if (restoreFocus) {
          const fallback = candidateId ? document.querySelector(`.cand[data-id="${candidateId}"]`) : null;
          (returnFocus?.isConnected ? returnFocus : fallback)?.focus();
        }
        returnFocus = null;
      }
      function containDrawerFocus(event) {
        if (event.key === "Escape") {
          event.preventDefault();
          closeCandidate();
          return;
        }
        if (event.key !== "Tab") return;
        const focusable = Array.from($("#panel").querySelectorAll(
          'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
        )).filter((element) => element.getClientRects().length > 0);
        if (!focusable.length) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
      function activityText(event) {
        const details = event.details || {};
        if (event.kind === "candidate_created") return `added ${details.name} at applied`;
        if (event.kind === "stage_changed") return `moved ${details.from} \u2192 ${details.to}${details.batch_id ? ` \xB7 batch ${details.batch_position}/${details.batch_size} \xB7 ${details.batch_id}` : ""}`;
        if (event.kind === "panel_added") return `added ${details.member} to the panel`;
        if (event.kind === "panel_removed") return `removed ${details.member} from the panel`;
        if (event.kind === "score_recorded") return `recorded score ${details.score}`;
        if (event.kind === "note_added") return "added a note";
        return event.kind.replaceAll("_", " ");
      }
      async function refreshAfterMutation(result, candidateId) {
        if (view) {
          const latest = await api("GET", `/api/roles/${encodeURIComponent(view.role.code)}`);
          if (latest.ok) applySnapshot(latest.data);
        }
        if (candidateId) await openCandidate(candidateId);
      }
      async function mutate(endpoint, body, candidateId) {
        if (!view) return { ok: false, status: 0, data: {} };
        setBusy(true, "Saving\u2026");
        const result = await api("POST", endpoint, {
          ...body,
          expected_revision: view.revision,
          operation_id: operationId()
        });
        await refreshAfterMutation(result, candidateId);
        setBusy(false);
        if (!result.ok) say(result.data.error || "That change was refused.");
        return result;
      }
      async function openCandidate(id2) {
        const result = await api("GET", `/api/candidates/${encodeURIComponent(id2)}`);
        if (!result.ok) {
          closeCandidate();
          say(result.data.error || "Candidate not found.");
          return;
        }
        openId = id2;
        const { candidate, panel, scores, historical_scores, offer_readiness, notes, activity, people, revision } = result.data;
        if (view) view.revision = revision;
        const next = stages[stages.indexOf(candidate.stage) + 1];
        const previous = stages[stages.indexOf(candidate.stage) - 1];
        const finished = terminal.includes(candidate.stage);
        const score = scores.find((item) => item.panel_member === me?.email)?.score;
        const panelEditable = ["applied", "screening", "interview"].includes(candidate.stage);
        const canScore = can("score") && panel.includes(me?.email) && candidate.stage === "interview";
        $("#panel").innerHTML = `<header><div><p class="eyebrow">${candidate.id}</p>
      <h2>${esc(candidate.name)}</h2></div><button id="close" aria-label="Close candidate">\xD7</button></header>
    <p class="sub">${esc(candidate.stage)}${finished ? " \xB7 terminal" : ""} \xB7 applied ${candidate.applied_days} days ago</p>
    <div class="history" aria-label="Stage history">${candidate.history.map((stage, index) => `<span${stage === candidate.stage && index === candidate.history.length - 1 ? ' aria-current="step"' : ""}>${esc(stage)}</span>`).join("")}</div>
    ${can("move") && !finished ? `<div class="moves">
      ${previous ? `<button data-to="${previous}">Back to ${previous}</button>` : ""}
      ${next ? `<button class="primary" data-to="${next}">Move to ${next}</button>` : ""}
      <button data-to="rejected">Reject</button><button data-to="withdrawn">Withdraw</button></div>` : ""}
    <h3>Panel and scores</h3>
    <p id="assessment-status">Assessment version ${candidate.assessment_version} \xB7 ${esc(offer_readiness.reason)}</p>
    ${!panelEditable ? '<p class="empty">Panel and scores are frozen at this stage. Reopen an offered interview to reassess.</p>' : ""}
    ${panel.length ? `<ul class="panel-list">${panel.map((email) => {
          const person = people.find((item2) => item2.email === email);
          const item = scores.find((value) => value.panel_member === email);
          return `<li><span><b>${esc(person?.name || email)}</b><small>${esc(email)}</small></span>
        <strong>${item ? `${item.score}/5` : "waiting"}</strong>
        ${can("panel") && panelEditable ? `<button class="remove-member" data-member="${esc(email)}" aria-label="Remove ${esc(person?.name || email)} from panel">Remove</button>` : ""}</li>`;
        }).join("")}</ul>` : '<p class="empty">No panel yet.</p>'}
    ${can("panel") && panelEditable && people.some((person) => person.role !== "coordinator" && !panel.includes(person.email)) ? `<form id="panelform" class="addrow"><label><span>Panel member</span>
      <select id="member">${people.filter((person) => person.role !== "coordinator" && !panel.includes(person.email)).map((person) => `<option value="${esc(person.email)}">${esc(person.name)}</option>`).join("")}</select></label>
      <button>Add to panel</button></form>` : ""}
    ${canScore ? `<form id="scoreform" class="addrow"><label><span>My score</span>
      <select id="score">${[1, 2, 3, 4, 5].map((value) => `<option${score === value ? " selected" : ""}>${value}</option>`).join("")}</select></label>
      <button>Record score</button></form>` : ""}
    <h3>Historical scores</h3>
    ${historical_scores.length ? `<ul id="historical-scores" class="notes">${historical_scores.map((item) => `<li>Version ${item.assessment_version} \xB7 ${esc(item.scorer_name)} \xB7 ${item.score}/5 \xB7 historical</li>`).join("")}</ul>` : '<p class="empty">No historical scores. Only the current assessment can authorize an offer.</p>'}
    <h3>Notes</h3>
    ${notes.length ? `<ol class="notes">${notes.map((note) => `<li><b>${esc(note.author_name)}</b><time>${esc(note.at)}</time><p>${esc(note.body)}</p></li>`).join("")}</ol>` : '<p class="empty">Nothing recorded yet.</p>'}
    <form id="notef" class="addrow"><label><span>New note</span>
      <input id="note" maxlength="1000" placeholder="Add a note; corrections stay in the trail"></label><button>Add note</button></form>
    <h3>Activity</h3>
    ${activity.length ? `<ol class="activity">${activity.map((event) => `<li><b>${esc(event.actor_name)}</b> ${esc(activityText(event))}${event.details.assessment_reason ? ` \xB7 v${event.details.assessment_version}: ${esc(event.details.assessment_reason)}` : ""}<time>${esc(event.at)}</time></li>`).join("")}</ol>` : '<p class="empty">No changes recorded since import.</p>'}`;
        $("#app").setAttribute("inert", "");
        $("#panel").onkeydown = containDrawerFocus;
        $("#close").onclick = () => closeCandidate();
        $("#close").focus();
        $("#panel").querySelectorAll(".moves button").forEach((button) => {
          button.onclick = async () => {
            const result2 = await mutate(`/api/candidates/${id2}/stage`, { stage: button.dataset.to }, id2);
            if (result2.ok) say(`Moved to ${button.dataset.to}.`, true);
          };
        });
        const panelForm = document.querySelector("#panelform");
        if (panelForm) panelForm.onsubmit = async (event) => {
          event.preventDefault();
          const member = $("#member");
          const result2 = await mutate(`/api/candidates/${id2}/panel`, { member: member.value }, id2);
          if (result2.ok) say("Panel updated.", true);
        };
        const scoreForm = document.querySelector("#scoreform");
        $("#panel").querySelectorAll(".remove-member").forEach((button) => {
          button.onclick = async () => {
            const result2 = await mutate(`/api/candidates/${id2}/panel`, { member: button.dataset.member, action: "remove" }, id2);
            if (result2.ok) say("Panel member removed. Fresh scores are required.", true);
          };
        });
        if (scoreForm) scoreForm.onsubmit = async (event) => {
          event.preventDefault();
          const input = $("#score");
          const result2 = await mutate(`/api/candidates/${id2}/score`, { score: Number(input.value) }, id2);
          if (result2.ok) say("Score recorded.", true);
        };
        $("#notef").onsubmit = async (event) => {
          event.preventDefault();
          const input = $("#note");
          const draft = input.value;
          const result2 = await mutate(`/api/candidates/${id2}/notes`, { body: draft }, id2);
          if (result2.ok) say("Note added.", true);
          else {
            const restored = document.querySelector("#note");
            if (restored) restored.value = draft;
          }
        };
      }
      async function loadWorkspace() {
        const result = await api("GET", "/api/roles");
        if (!result.ok) return signOutLocal();
        const list = $("#roles");
        list.innerHTML = result.data.roles.map((role) => `<button data-code="${role.code}">
    <b>${esc(role.title)}</b><span>${role.live} live \xB7 ${role.total} total \xB7 r${role.revision}</span></button>`).join("");
        list.querySelectorAll("button").forEach((button) => {
          button.onclick = () => {
            list.querySelectorAll("button").forEach((item) => item.removeAttribute("aria-current"));
            button.setAttribute("aria-current", "page");
            loadRole(button.dataset.code);
          };
        });
        list.querySelector("button")?.click();
      }
      function signOutLocal() {
        resetBatch();
        token = "";
        me = null;
        view = null;
        localStorage.removeItem(TOKEN_KEY);
        closeCandidate(false);
        $("#app").hidden = true;
        $("#signin").hidden = false;
        $("#email").focus();
      }
      async function boot() {
        if (!token) return signOutLocal();
        const result = await api("GET", "/api/me");
        if (!result.ok) return signOutLocal();
        me = result.data.person;
        stages = result.data.stages;
        terminal = result.data.terminal;
        $("#whoami").textContent = `${me.name} \xB7 ${me.role}`;
        $("#signin").hidden = true;
        $("#app").hidden = false;
        await loadWorkspace();
      }
      $("#loginf").onsubmit = async (event) => {
        event.preventDefault();
        const email = $("#email").value;
        const password = $("#password").value;
        const result = await api("POST", "/api/login", { email, password });
        if (!result.ok) return say(result.data.error || "Sign-in failed.");
        $("#toast").classList.remove("show");
        token = result.data.token;
        localStorage.setItem(TOKEN_KEY, token);
        await boot();
      };
      $("#addcandidate").onsubmit = async (event) => {
        event.preventDefault();
        if (!view) return;
        const name = $("#candidate-name").value;
        const result = await mutate("/api/candidates", { role: view.role.code, name });
        if (result.ok) {
          $("#candidate-name").value = "";
          say("Candidate added at applied.", true);
        }
      };
      $("#theme").onclick = () => {
        const root2 = document.documentElement;
        const dark = root2.dataset.theme === "dark";
        root2.dataset.theme = dark ? "light" : "dark";
        if (view) drawFunnel(view.funnel);
      };
      $("#signout").onclick = async () => {
        await api("POST", "/api/logout");
        signOutLocal();
        say("Signed out.", true);
      };
      function resetBatch() {
        batchSelected = [];
        batchReview = null;
        batchRequest = null;
        batchMessage = "";
        batchBusy = false;
        batchDone = false;
        const dialog = document.querySelector("#batch-dialog");
        if (dialog?.open) dialog.close();
      }
      function renderBatch() {
        if (!view) return;
        const locked = batchBusy || !!batchRequest || batchDone;
        const review = batchReview;
        const capacity = review && !batchDone ? review.capacity : view.capacity;
        const projected = review && !batchDone ? review.projected : {
          reserved: capacity.reserved + batchSelected.length,
          filled: capacity.filled,
          available: capacity.available - batchSelected.length
        };
        const rows = review ? review.candidates : view.candidates;
        const activeId = document.activeElement?.id;
        $("#batch-content").innerHTML = `
    <header class="batch-head"><div><p class="eyebrow">Offer planning \xB7 ${esc(view.role.code)}</p>
      <h2 id="batch-title">${batchDone ? "Batch completed" : review ? "Review batch offers" : "Plan batch offers"}</h2>
      <p class="sub">${esc(view.role.title)} \xB7 ${esc(view.role.team)}</p></div>
      <button id="batch-close" aria-label="Close batch offers" ${batchBusy ? "disabled" : ""}>\xD7</button></header>
    <p class="batch-intro">${batchDone ? "The saved receipt confirms this batch. Capacity below reflects the latest vacancy." : review ? "All selected offers will be committed together. No applicant changes if the batch is refused." : "Choose applicants, then review their current assessments and the openings required. Planning does not reserve an opening."}</p>
    <div class="batch-metrics" aria-label="Batch capacity">
      <div><span>Selected</span><strong id="batch-count">${batchSelected.length}</strong><small>${view.role.openings} total openings</small></div>
      <div><span>Available now</span><strong>${capacity.available}</strong><small>${capacity.reserved} reserved \xB7 ${capacity.filled} filled</small></div>
      <div><span>${batchDone ? "Reserved now" : "Available after offers"}</span><strong>${batchDone ? capacity.reserved : projected.available}</strong><small>${batchDone ? `${capacity.filled} filled` : `${projected.reserved} reserved \xB7 ${projected.filled} filled`}</small></div>
    </div>
    <p id="batch-status" tabindex="-1" role="status" class="batch-status${batchMessage && !batchDone ? " warning" : ""}">${esc(batchMessage || (review ? `Reviewed at vacancy revision ${review.revision}.` : "Select one or more applicants to review."))}</p>
    ${review && !review.ready && !batchDone ? `<div class="batch-warning"><b>Not ready to offer</b><ul>${review.errors.map((error) => `<li>${esc(error)}</li>`).join("")}</ul></div>` : ""}
    <div class="batch-list" aria-label="${review ? "Reviewed applicants" : "Applicants for batch offers"}">
      ${rows.length ? rows.map((candidate) => review ? `<div class="batch-choice"><span class="batch-number">${batchSelected.indexOf(candidate.id) + 1}</span><span><b>${esc(candidate.name)}</b><small>${esc(candidate.id)} \xB7 assessment v${candidate.assessment_version}</small></span><span class="batch-state">${esc(candidate.reason)}</span></div>` : `<label class="batch-choice"><input type="checkbox" data-batch-id="${esc(candidate.id)}" ${batchSelected.includes(candidate.id) ? "checked" : ""} ${locked ? "disabled" : ""} aria-label="Select ${esc(candidate.name)} for batch offers"><span><b>${esc(candidate.name)}</b><small>${esc(candidate.id)} \xB7 ${esc(candidate.stage)}</small></span><span class="batch-state">${candidate.stage === "interview" ? `${candidate.scores.length}/${candidate.panel.length} scored` : "Interview required"}</span></label>`).join("") : '<p class="empty">No applicants in this vacancy yet. The coordinator can add applicants before offers are planned.</p>'}
    </div>
    <footer class="batch-actions">
      ${batchDone ? '<button id="batch-finish" class="primary">Done</button>' : batchRequest ? `<button id="batch-retry" class="primary" ${batchBusy ? "disabled" : ""}>${batchBusy ? "Submitting batch\u2026" : "Retry submission"}</button>` : review ? `<button id="batch-edit" ${batchBusy ? "disabled" : ""}>Edit selection</button><button id="batch-confirm" class="primary" ${!review.ready || batchBusy ? "disabled" : ""}>Confirm ${batchSelected.length} offer${batchSelected.length === 1 ? "" : "s"}</button>` : `<button id="batch-review" class="primary" ${!batchSelected.length || batchBusy ? "disabled" : ""}>${batchBusy ? "Reviewing\u2026" : "Review selection"}</button>`}
    </footer>`;
        $("#batch-close").onclick = closeBatch;
        $("#batch-content").querySelectorAll("[data-batch-id]").forEach((input) => {
          input.onchange = () => {
            const id2 = input.dataset.batchId;
            batchSelected = input.checked ? [...batchSelected, id2] : batchSelected.filter((value) => value !== id2);
            batchMessage = "";
            renderBatch();
            $("#batch-content").querySelector(`[data-batch-id="${id2}"]`)?.focus();
          };
        });
        const bind = (id2, action) => {
          const button = document.getElementById(id2);
          if (button) button.onclick = action;
        };
        bind("batch-review", reviewBatch);
        bind("batch-edit", () => {
          batchReview = null;
          batchMessage = "";
          renderBatch();
          $("#batch-review").focus();
        });
        bind("batch-confirm", submitBatch);
        bind("batch-retry", submitBatch);
        bind("batch-finish", closeBatch);
        if (activeId && document.getElementById(activeId)) document.getElementById(activeId)?.focus();
      }
      function closeBatch() {
        if (batchBusy) return;
        $("#batch-dialog").close();
        $("#batch-open").focus();
        if (batchDone) resetBatch();
      }
      async function reviewBatch() {
        if (!view || batchBusy || batchRequest) return;
        batchBusy = true;
        renderBatch();
        try {
          const result = await api("POST", `/api/roles/${view.role.code}/batch-preview`, { candidate_ids: batchSelected });
          if (!result.ok) throw new Error(result.data.error || "The selection could not be reviewed.");
          batchReview = result.data;
          const latest = await api("GET", `/api/roles/${view.role.code}`);
          if (latest.ok) applySnapshot(latest.data);
          batchMessage = "";
        } catch (error) {
          batchMessage = error.message;
        } finally {
          batchBusy = false;
          renderBatch();
          $("#batch-status").focus();
        }
      }
      async function submitBatch() {
        if (!view || batchBusy || !batchRequest && !batchReview?.ready) return;
        if (!batchRequest) batchRequest = { candidate_ids: [...batchSelected], expected_revision: batchReview.revision, operation_id: operationId() };
        batchBusy = true;
        batchMessage = "Submitting the reviewed batch. Please wait.";
        renderBatch();
        try {
          const result = await api("POST", `/api/roles/${view.role.code}/batch-offers`, batchRequest);
          if (result.status >= 500) throw new Error("The server could not confirm the outcome.");
          if (result.ok) {
            batchDone = true;
            batchMessage = `${result.data.count} offers confirmed together. Receipt ${result.data.batch_id}.`;
          } else {
            batchReview = null;
            batchMessage = `${result.data.error || "The batch was refused."} Selection retained. Review it again before confirming a new attempt.`;
          }
          batchRequest = null;
          const latest = await api("GET", `/api/roles/${view.role.code}`);
          if (latest.ok) applySnapshot(latest.data);
          else batchMessage += " Reload the workspace to refresh capacity.";
        } catch (error) {
          batchMessage = batchDone ? "Offers confirmed. Reload the workspace to refresh capacity." : "The outcome could not be confirmed. Retry submission to recover the same result; do not create another batch.";
        } finally {
          batchBusy = false;
          renderBatch();
          $("#batch-status").focus();
        }
      }
      $("#batch-open").onclick = () => {
        closeCandidate(false);
        renderBatch();
        $("#batch-dialog").showModal();
        $("#batch-close").focus();
      };
      $("#batch-dialog").addEventListener("cancel", (event) => {
        event.preventDefault();
        closeBatch();
      });
      $("#batch-dialog").addEventListener("keydown", (event) => {
        if (event.key !== "Tab") return;
        const items = Array.from($("#batch-dialog").querySelectorAll(
          'button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])'
        )).filter((element) => element.getClientRects().length > 0);
        const first = items[0], last = items[items.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
      });
      window.addEventListener("resize", () => {
        if (view) drawFunnel(view.funnel);
      });
      boot();
    }
  });
  require_app();
})();
