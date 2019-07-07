"use strict";

it("test", function() {
  var parser = Parsimmon.it(function(ch) {
    return ch !== ".";
  });
  var highBit = Parsimmon.it(function(ch) {
    return ch | 128;
  });
  assert.equal(parser.parse("x").value, "x");
  assert.equal(parser.parse(".").status, false);
  assert.equal(highBit.parse(Buffer.from([255])).status, true);
  assert.equal(highBit.parse(Buffer.from([0])).status, true);
  assert.equal(highBit.parse(Buffer.from([127])).status, true);
  assert.throws(function() {
    Parsimmon.it("not a function");
  });
});
