'use strict';

function Parsimmon(action) {
  if (!(this instanceof Parsimmon)) {
    return new Parsimmon(action);
  }
  this._ = action;
}

var _ = Parsimmon.prototype;

// -*- Helpers -*-

function isParser(obj) {
  return obj instanceof Parsimmon;
}

function isArray(x) {
  return {}.toString.call(x) === '[object Array]';
}

function makeSuccess(index, value, state) {
  if (arguments.length !== 3) {
    throw new Error('makeSuccess takes 3 arguments');
  }
  return {
    status: true,
    index: index,
    value: value,
    furthest: -1,
    expected: [],
    state: state
  };
}

function makeFailure(index, expected, state) {
  if (arguments.length !== 3) {
    throw new Error('makeFailure takes 3 arguments');
  }
  return {
    status: false,
    index: -1,
    value: null,
    furthest: index,
    expected: [expected],
    state: state
  };
}

function mergeReplies(result, last) {
  if (!last) {
    return result;
  }
  if (result.furthest > last.furthest) {
    return result;
  }
  var expected = (result.furthest === last.furthest)
    ? unsafeUnion(result.expected, last.expected)
    : last.expected;
  return {
    status: result.status,
    index: result.index,
    value: result.value,
    furthest: last.furthest,
    expected: expected,
    state: result.state
  };
}

function makeLineColumnIndex(input, i) {
  var lines = input.slice(0, i).split('\n');
  // Note that unlike the character offset, the line and column offsets are
  // 1-based.
  var lineWeAreUpTo = lines.length;
  var columnWeAreUpTo = lines[lines.length - 1].length + 1;
  return {
    offset: i,
    line: lineWeAreUpTo,
    column: columnWeAreUpTo
  };
}

// Returns the sorted set union of two arrays of strings. Note that if both
// arrays are empty, it simply returns the first array, and if exactly one
// array is empty, it returns the other one unsorted. This is safe because
// expectation arrays always start as [] or [x], so as long as we merge with
// this function, we know they stay in sorted order.
function unsafeUnion(xs, ys) {
  // Exit early if either array is empty (common case)
  var xn = xs.length;
  var yn = ys.length;
  if (xn === 0) {
    return ys;
  } else if (yn === 0) {
    return xs;
  }
  // Two non-empty arrays: do the full algorithm
  var obj = {};
  for (var i = 0; i < xn; i++) {
    obj[xs[i]] = true;
  }
  for (var j = 0; j < yn; j++) {
    obj[ys[j]] = true;
  }
  var keys = [];
  for (var k in obj) {
    if (obj.hasOwnProperty(k)) {
      keys.push(k);
    }
  }
  keys.sort();
  return keys;
}

function assertParser(p) {
  if (!isParser(p)) {
    throw new Error('not a parser: ' + p);
  }
}

// TODO[ES5]: Switch to Array.isArray eventually.
function assertArray(x) {
  if (!isArray(x)) {
    throw new Error('not an array: ' + x);
  }
}

function assertNumber(x) {
  if (typeof x !== 'number') {
    throw new Error('not a number: ' + x);
  }
}

function assertRegexp(x) {
  if (!(x instanceof RegExp)) {
    throw new Error('not a regexp: '+x);
  }
  var f = flags(x);
  for (var i = 0; i < f.length; i++) {
    var c = f.charAt(i);
    // Only allow regexp flags [imu] for now, since [g] and [y] specifically
    // mess up Parsimmon. If more non-stateful regexp flags are added in the
    // future, this will need to be revisited.
    if (c !== 'i' && c !== 'm' && c !== 'u') {
      throw new Error('unsupported regexp flag "' + c + '": ' + x);
    }
  }
}

function assertFunction(x) {
  if (typeof x !== 'function') {
    throw new Error('not a function: ' + x);
  }
}

function assertString(x) {
  if (typeof x !== 'string') {
    throw new Error('not a string: ' + x);
  }
}

function formatExpected(expected) {
  if (expected.length === 1) {
    return expected[0];
  }
  return 'one of ' + expected.join(', ');
}

function formatGot(input, error) {
  var index = error.index;
  var i = index.offset;
  if (i === input.length) {
    return ', got the end of the input';
  }
  var prefix = (i > 0 ? '\'...' : '\'');
  var suffix = (input.length - i > 12 ? '...\'' : '\'');
  return ' at line ' + index.line + ' column ' + index.column
    +  ', got ' + prefix + input.slice(i, i + 12) + suffix;
}

function formatError(input, error) {
  return 'expected ' +
    formatExpected(error.expected) +
    formatGot(input, error);
}

function flags(re) {
  var s = '' + re;
  return s.slice(s.lastIndexOf('/') + 1);
}

function anchoredRegexp(re) {
  return RegExp('^(?:' + re.source + ')', flags(re));
}

// -*- Combinators -*-

function seq() {
  var parsers = [].slice.call(arguments);
  var numParsers = parsers.length;
  for (var j = 0; j < numParsers; j += 1) {
    assertParser(parsers[j]);
  }
  return Parsimmon(function(input, i, state) {
    var result;
    var accum = new Array(numParsers);
    for (var j = 0; j < numParsers; j += 1) {
      result = mergeReplies(parsers[j]._(input, i, state), result);
      if (!result.status) {
        return result;
      }
      state = result.state;
      accum[j] = result.value;
      i = result.index;
    }
    return mergeReplies(makeSuccess(i, accum, state), result);
  });
}

function seqObj() {
  var seenKeys = {};
  var totalKeys = 0;
  var parsers = [].slice.call(arguments);
  var numParsers = parsers.length;
  for (var j = 0; j < numParsers; j += 1) {
    var p = parsers[j];
    if (isParser(p)) {
      continue;
    }
    if (isArray(p)) {
      var isWellFormed =
        p.length === 2 &&
        typeof p[0] === 'string' &&
        isParser(p[1]);
      if (isWellFormed) {
        var key = p[0];
        if (seenKeys[key]) {
          throw new Error('seqObj: duplicate key ' + key);
        }
        seenKeys[key] = true;
        totalKeys++;
        continue;
      }
    }
    throw new Error(
      'seqObj arguments must be parsers or ' +
      '[string, parser] array pairs.'
    );
  }
  if (totalKeys === 0) {
    throw new Error('seqObj expects at least one named parser, found zero');
  }
  return Parsimmon(function(input, i, state) {
    var result;
    var accum = {};
    for (var j = 0; j < numParsers; j += 1) {
      var name;
      var parser;
      if (isArray(parsers[j])) {
        name = parsers[j][0];
        parser = parsers[j][1];
      } else {
        name = null;
        parser = parsers[j];
      }
      result = mergeReplies(parser._(input, i, state), result);
      state = result.state;
      if (!result.status) {
        return result;
      }
      if (name) {
        accum[name] = result.value;
      }
      i = result.index;
    }
    return mergeReplies(makeSuccess(i, accum, state), result);
  });
}

function seqMap() {
  var args = [].slice.call(arguments);
  if (args.length === 0) {
    throw new Error('seqMap needs at least one argument');
  }
  var mapper = args.pop();
  assertFunction(mapper);
  return seq.apply(null, args).map(function(results) {
    return mapper.apply(null, results);
  });
}

// TODO[ES5]: Revisit this with Object.keys and .bind.
function createLanguage(parsers) {
  var language = {};
  for (var key in parsers) {
    if ({}.hasOwnProperty.call(parsers, key)) {
      (function(key) {
        var func = function() {
          return parsers[key](language);
        };
        language[key] = lazy(func);
      }(key));
    }
  }
  return language;
}

function alt() {
  var parsers = [].slice.call(arguments);
  var numParsers = parsers.length;
  if (numParsers === 0) {
    return fail('zero alternates');
  }
  for (var j = 0; j < numParsers; j += 1) {
    assertParser(parsers[j]);
  }
  return Parsimmon(function(input, i, state) {
    var result;
    for (var j = 0; j < parsers.length; j += 1) {
      result = mergeReplies(parsers[j]._(input, i, state), result);
      if (result.status) {
        return result;
      }
      state = result.state;
    }
    return result;
  });
}

function sepBy(parser, separator) {
  // Argument asserted by sepBy1
  return sepBy1(parser, separator).or(succeed([]));
}

function sepBy1(parser, separator) {
  assertParser(parser);
  assertParser(separator);
  var pairs = separator.then(parser).many();
  return parser.chain(function(r) {
    return pairs.map(function(rs) {
      return [r].concat(rs);
    });
  });
}

// -*- Core Parsing Methods -*-

_.parse = function(input, initialState) {
  if (typeof input !== 'string') {
    throw new Error('.parse must be called with a string as its argument');
  }
  if (arguments.length < 2) {
    initialState = indentInitialState;
  }
  var result = this.skip(eof)._(input, 0, initialState);
  if (result.status) {
    return {
      status: true,
      value: result.value
    };
  }
  return {
    status: false,
    index: makeLineColumnIndex(input, result.furthest),
    expected: result.expected
  };
};

// -*- Other Methods -*-

_.tryParse = function(str, initialState) {
  if (arguments.length < 2) {
    initialState = indentInitialState;
  }
  var result = this.parse(str, initialState);
  if (result.status) {
    return result.value;
  } else {
    var msg = formatError(str, result);
    var err = new Error(msg);
    err.type = 'ParsimmonError';
    err.result = result;
    throw err;
  }
};

_.or = function(alternative) {
  return alt(this, alternative);
};

_.trim = function(parser) {
  return this.wrap(parser, parser);
};

_.wrap = function(leftParser, rightParser) {
  return seqMap(
    leftParser,
    this,
    rightParser,
    function(left, middle) {
      return middle;
    }
  );
};

_.thru = function(wrapper) {
  return wrapper(this);
};

_.then = function(next) {
  assertParser(next);
  return seq(this, next).map(function(results) { return results[1]; });
};

_.many = function() {
  var self = this;

  return Parsimmon(function(input, i, state) {
    var accum = [];
    var result = undefined;

    for (;;) {
      result = mergeReplies(self._(input, i, state), result);
      state = result.state;
      if (result.status) {
        i = result.index;
        accum.push(result.value);
      } else {
        return mergeReplies(makeSuccess(i, accum, state), result);
      }
    }
  });
};

_.tie = function() {
  return this.map(function(args) {
    assertArray(args);
    var s = '';
    for (var i = 0; i < args.length; i++) {
      assertString(args[i]);
      s += args[i];
    }
    return s;
  });
};

_.times = function(min, max) {
  var self = this;
  if (arguments.length < 2) {
    max = min;
  }
  assertNumber(min);
  assertNumber(max);
  return Parsimmon(function(input, i, state) {
    var accum = [];
    var result = undefined;
    var prevResult = undefined;
    for (var times = 0; times < min; times += 1) {
      result = self._(input, i, state);
      prevResult = mergeReplies(result, prevResult);
      state = result.state;
      if (result.status) {
        i = result.index;
        accum.push(result.value);
      } else {
        return prevResult;
      }
    }
    for (; times < max; times += 1) {
      result = self._(input, i);
      prevResult = mergeReplies(result, prevResult);
      state = result.state;
      if (result.status) {
        i = result.index;
        accum.push(result.value);
      } else {
        break;
      }
    }
    return mergeReplies(makeSuccess(i, accum, state), prevResult);
  });
};

_.result = function(res) {
  return this.map(function() {
    return res;
  });
};

_.atMost = function(n) {
  return this.times(0, n);
};

_.atLeast = function(n) {
  return seqMap(this.times(n), this.many(), function(init, rest) {
    return init.concat(rest);
  });
};

_.map = function(fn) {
  assertFunction(fn);
  var self = this;
  return Parsimmon(function(input, i, state) {
    var result = self._(input, i, state);
    state = result.state;
    if (!result.status) {
      return result;
    }
    return mergeReplies(makeSuccess(result.index, fn(result.value), state), result);
  });
};

_.skip = function(next) {
  return seq(this, next).map(function(results) { return results[0]; });
};

_.mark = function() {
  return seqMap(index, this, index, function(start, value, end) {
    return {
      start: start,
      value: value,
      end: end
    };
  });
};

_.node = function(name) {
  return seqMap(index, this, index, function(start, value, end) {
    return {
      name: name,
      value: value,
      start: start,
      end: end
    };
  });
};

_.sepBy = function(separator) {
  return sepBy(this, separator);
};

_.sepBy1 = function(separator) {
  return sepBy1(this, separator);
};

_.lookahead = function(x) {
  return this.skip(lookahead(x));
};

_.notFollowedBy = function(x) {
  return this.skip(notFollowedBy(x));
};

_.desc = function(expected) {
  var self = this;
  return Parsimmon(function(input, i, state) {
    var reply = self._(input, i, state);
    if (!reply.status) {
      reply.expected = [expected];
    }
    return reply;
  });
};

_.fallback = function(result) {
  return this.or(succeed(result));
};

_.ap = function(other) {
  return seqMap(other, this, function(f, x) {
    return f(x);
  });
};

_.chain = function(f) {
  var self = this;
  return Parsimmon(function(input, i, state) {
    var result = self._(input, i, state);
    state = result.state;
    if (!result.status) {
      return result;
    }
    var nextParser = f(result.value);
    return mergeReplies(nextParser._(input, result.index, state), result);
  });
};

// -*- Constructors -*-

function string(str) {
  assertString(str);
  var expected = '\'' + str + '\'';
  return Parsimmon(function(input, i, state) {
    var j = i + str.length;
    var head = input.slice(i, j);
    if (head === str) {
      return makeSuccess(j, head, state);
    } else {
      return makeFailure(i, expected, state);
    }
  });
}

function regexp(re, group) {
  assertRegexp(re);
  if (arguments.length >= 2) {
    assertNumber(group);
  } else {
    group = 0;
  }
  var anchored = anchoredRegexp(re);
  var expected = '' + re;
  return Parsimmon(function(input, i, state) {
    var match = anchored.exec(input.slice(i));
    if (match) {
      if (0 <= group && group <= match.length) {
        var fullMatch = match[0];
        var groupMatch = match[group];
        return makeSuccess(i + fullMatch.length, groupMatch, state);
      }
      return makeFailure(
        i,
        'valid match group (0 to ' + match.length + ') in ' + expected,
        state
      );
    }
    return makeFailure(i, expected, state);
  });
}

function succeed(value) {
  return Parsimmon(function(input, i, state) {
    return makeSuccess(i, value, state);
  });
}

function fail(expected) {
  return Parsimmon(function(input, i, state) {
    return makeFailure(i, expected, state);
  });
}

function lookahead(x) {
  if (isParser(x)) {
    return Parsimmon(function(input, i, state) {
      var result = x._(input, i);
      result.index = i;
      result.value = '';
      result.state = state;
      return result;
    });
  } else if (typeof x === 'string') {
    return lookahead(string(x));
  } else if (x instanceof RegExp) {
    return lookahead(regexp(x));
  }
  throw new Error('not a string, regexp, or parser: ' + x);
}

function notFollowedBy(parser) {
  assertParser(parser);
  return Parsimmon(function(input, i, state) {
    var result = parser._(input, i, state);
    state = result.state;
    var text = input.slice(i, result.index);
    return result.status
      ? makeFailure(i, 'not "' + text + '"', state)
      : makeSuccess(i, null, state);
  });
}

function test(predicate) {
  assertFunction(predicate);
  return Parsimmon(function(input, i, state) {
    var char = input.charAt(i);
    if (i < input.length && predicate(char)) {
      return makeSuccess(i + 1, char, state);
    } else {
      return makeFailure(i, 'a character matching ' + predicate, state);
    }
  });
}

function oneOf(str) {
  return test(function(ch) {
    return str.indexOf(ch) >= 0;
  });
}

function noneOf(str) {
  return test(function(ch) {
    return str.indexOf(ch) < 0;
  });
}

function custom(parsingFunction) {
  return Parsimmon(parsingFunction(makeSuccess, makeFailure));
}

// TODO[ES5]: Improve error message using JSON.stringify eventually.
function range(begin, end) {
  return test(function(ch) {
    return begin <= ch && ch <= end;
  }).desc(begin + '-' + end);
}

function takeWhile(predicate) {
  assertFunction(predicate);

  return Parsimmon(function(input, i, state) {
    var j = i;
    while (j < input.length && predicate(input.charAt(j))) {
      j++;
    }
    return makeSuccess(j, input.slice(i, j), state);
  });
}

function lazy(desc, f) {
  if (arguments.length < 2) {
    f = desc;
    desc = undefined;
  }

  var parser = Parsimmon(function(input, i, state) {
    parser._ = f()._;
    return parser._(input, i, state);
  });

  if (desc) {
    return parser.desc(desc);
  } else {
    return parser;
  }
}

// -*- Fantasy Land Extras -*-

function empty() {
  return fail('fantasy-land/empty');
}

_.concat = _.or;
_.empty = empty;
_.of = succeed;
_['fantasy-land/ap'] = _.ap;
_['fantasy-land/chain'] = _.chain;
_['fantasy-land/concat'] = _.concat;
_['fantasy-land/empty'] = _.empty;
_['fantasy-land/of'] = _.of;
_['fantasy-land/map'] = _.map;

// -*- Base Parsers -*-

var indentInitialState = [0];

var spaces0Count = regexp(/[ ]*/).map(function(s) {
  return s.length;
});

var indentMore = spaces0Count.chain(function(count) {
  return Parsimmon(function(input, i, state) {
    var j = state.length - 1;
    if (count > state[j]) {
      return makeSuccess(i, null, state.concat(count));
    }
    var message = 'more than ' + state[j] + ' spaces of indentation';
    return makeFailure(i, message, undefined);
  });
});

var indentLess = spaces0Count.chain(function(count) {
  return Parsimmon(function(input, i, state) {
    var stack = state.slice();
    if (count < stack[stack.length - 1]) {
      while (count < stack[stack.length - 1]) {
        stack.pop();
      }
      return makeSuccess(i, null, stack);
    }
    var message =
      'less than ' +
      stack[stack.length - 1] +
      ' spaces of indentation';
    return makeFailure(i, message, undefined);
  });
});

var indentSame = spaces0Count.chain(function(count) {
  return Parsimmon(function(input, i, state) {
    var j = state.length - 1;
    if (count === state[j]) {
      return makeSuccess(i, null, state);
    }
    var message = 'exactly ' + count + ' spaces of indentation';
    return makeFailure(i, message, undefined);
  });
});

var index = Parsimmon(function(input, i, state) {
  return makeSuccess(i, makeLineColumnIndex(input, i), state);
});

var any = Parsimmon(function(input, i, state) {
  if (i >= input.length) {
    return makeFailure(i, 'any character', state);
  }
  return makeSuccess(i + 1, input.charAt(i), state);
});

var all = Parsimmon(function(input, i, state) {
  return makeSuccess(input.length, input.slice(i), state);
});

var eof = Parsimmon(function(input, i, state) {
  if (i < input.length) {
    return makeFailure(i, 'EOF', state);
  }
  return makeSuccess(i, null, state);
});

var digit = regexp(/[0-9]/).desc('a digit');
var digits = regexp(/[0-9]*/).desc('optional digits');
var letter = regexp(/[a-z]/i).desc('a letter');
var letters = regexp(/[a-z]*/i).desc('optional letters');
var optWhitespace = regexp(/\s*/).desc('optional whitespace');
var whitespace = regexp(/\s+/).desc('whitespace');

Parsimmon.all = all;
Parsimmon.alt = alt;
Parsimmon.any = any;
Parsimmon.createLanguage = createLanguage;
Parsimmon.custom = custom;
Parsimmon.digit = digit;
Parsimmon.digits = digits;
Parsimmon.empty = empty;
Parsimmon.eof = eof;
Parsimmon.fail = fail;
Parsimmon.formatError = formatError;
Parsimmon.indentLess = indentLess;
Parsimmon.indentMore = indentMore;
Parsimmon.indentSame = indentSame;
Parsimmon.index = index;
Parsimmon.isParser = isParser;
Parsimmon.lazy = lazy;
Parsimmon.letter = letter;
Parsimmon.letters = letters;
Parsimmon.lookahead = lookahead;
Parsimmon.makeFailure = makeFailure;
Parsimmon.makeSuccess = makeSuccess;
Parsimmon.noneOf = noneOf;
Parsimmon.notFollowedBy = notFollowedBy;
Parsimmon.of = succeed;
Parsimmon.oneOf = oneOf;
Parsimmon.optWhitespace = optWhitespace;
Parsimmon.Parser = Parsimmon;
Parsimmon.range = range;
Parsimmon.regex = regexp;
Parsimmon.regexp = regexp;
Parsimmon.sepBy = sepBy;
Parsimmon.sepBy1 = sepBy1;
Parsimmon.seq = seq;
Parsimmon.seqMap = seqMap;
Parsimmon.seqObj = seqObj;
Parsimmon.string = string;
Parsimmon.succeed = succeed;
Parsimmon.takeWhile = takeWhile;
Parsimmon.test = test;
Parsimmon.whitespace = whitespace;
Parsimmon['fantasy-land/empty'] = empty;
Parsimmon['fantasy-land/of'] = succeed;

module.exports = Parsimmon;
