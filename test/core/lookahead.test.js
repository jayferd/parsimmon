"use strict";

describe("Parsimmon.lookahead", function() {
  it("should handle a string", function() {
    Parsimmon.lookahead("");
  });

  it("should handle a regexp", function() {
    Parsimmon.lookahead(/./);
  });

  it("should handle a parser", function() {
    Parsimmon.lookahead(Parsimmon.digit);
  });

  it("can be chained as prototype", function() {
    var parser = Parsimmon.seq(
      Parsimmon.string("abc").lookahead("d"),
      Parsimmon.string("d")
    );
    var answer = parser.parse("abcd");
    assert.deepEqual(answer.value, ["abc", "d"]);
  });

  it("does not consume from a string", function() {
    var parser = Parsimmon.seq(
      Parsimmon.string("abc"),
      Parsimmon.lookahead("d"),
      Parsimmon.string("d")
    );
    var answer = parser.parse("abcd");
    assert.deepEqual(answer.value, ["abc", "", "d"]);
  });

  it("does not consume from a regexp", function() {
    var parser = Parsimmon.seq(
      Parsimmon.string("abc"),
      Parsimmon.lookahead(/d/),
      Parsimmon.string("d")
    );
    var answer = parser.parse("abcd");
    assert.deepEqual(answer.value, ["abc", "", "d"]);
  });

  it("does not consume from a parser", function() {
    var weirdParser = Parsimmon.string("Q").or(Parsimmon.string("d"));
    var parser = Parsimmon.seq(
      Parsimmon.string("abc"),
      Parsimmon.lookahead(weirdParser),
      Parsimmon.string("d")
    );
    var answer = parser.parse("abcd");
    assert.deepEqual(answer.value, ["abc", "", "d"]);
  });

  it("raises error if argument is not a string, regexp, or parser", function() {
    assert.throws(function() {
      Parsimmon.lookahead({});
    });
    assert.throws(function() {
      Parsimmon.lookahead([]);
    });
    assert.throws(function() {
      Parsimmon.lookahead(true);
    });
    assert.throws(function() {
      Parsimmon.lookahead(12);
    });
  });
});
