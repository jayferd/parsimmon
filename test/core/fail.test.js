'use strict';

suite('fail', function() {
  var fail = Parsimmon.fail;
  var succeed = Parsimmon.succeed;

  test('use Parsimmon.fail to fail dynamically', function() {
    var parser = Parsimmon.any.chain(function(ch) {
      return fail('a character besides ' + ch);
    }).or(Parsimmon.string('x'));

    assert.deepEqual(parser.parse('y'), {
      status: false,
      index: {
        offset: 1,
        line: 1,
        column: 2
      },
      expected: ['a character besides y']
    });
    assert.equal(parser.parse('x').value, 'x');
  });

  test('use Parsimmon.succeed or Parsimmon.fail to branch conditionally', function() {
    var allowedOperator;

    var parser =
      Parsimmon.string('x')
        .then(Parsimmon.string('+').or(Parsimmon.string('*')))
        .chain(function(operator) {
          if (operator === allowedOperator) {
            return succeed(operator);
          }
          return fail(allowedOperator);
        })
        .skip(Parsimmon.string('y'));

    allowedOperator = '+';
    assert.equal(parser.parse('x+y').value, '+');
    assert.deepEqual(parser.parse('x*y'), {
      status: false,
      index: {
        offset: 2,
        line: 1,
        column: 3
      },
      expected: ['+']
    });

    allowedOperator = '*';
    assert.equal(parser.parse('x*y').value, '*');
    assert.deepEqual(parser.parse('x+y'), {
      status: false,
      index: {
        offset: 2,
        line: 1,
        column: 3
      },
      expected: ['*']
    });
  });

  test('.fail should pass state through', function() {
    function test(n) {
      return Parsimmon(function(input, i, state) {
        assert.strictEqual(state, n);
        return Parsimmon.makeSuccess(i, undefined, state);
      });
    }
    var result =
      test(10)
        .then(Parsimmon.fail('nice'))
        ._(0, 'a', 10);
    assert.strictEqual(result.state, 10);
  });

  test('.succeed should pass state through', function() {
    function test(n) {
      return Parsimmon(function(input, i, state) {
        assert.strictEqual(state, n);
        return Parsimmon.makeSuccess(i, undefined, state);
      });
    }
    var result =
      test(10)
        .then(Parsimmon.succeed('anything at all'))
        ._(0, 'a', 10);
    assert.strictEqual(result.state, 10);
  });

});
