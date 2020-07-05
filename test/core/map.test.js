"use strict";

testSetScenario(function() {
  describe("map", function() {
    it("with a function, pipes the value in and uses that return value", function() {
      var piped;
      var parser = Parsimmon.string("x").map(function(x) {
        piped = x;
        return "y";
      });
      assert.deepEqual(parser.parse("x"), { status: true, value: "y" });
      assert.equal(piped, "x");
    });

    it("asserts that a function was given", function() {
      assert.throws(function() {
        Parsimmon.string("x").map("not a function");
      });
    });
  });
});
