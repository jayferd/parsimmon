"use strict";

describe("fantasy-land/* method aliases", function() {
  function makeTester(name) {
    return function() {
      var flName = "fantasy-land/" + name;
      var parser = Parsimmon.of("burrito");
      assert.equal(parser[name], parser[flName]);
    };
  }
  var methods = ["ap", "chain", "concat", "empty", "map", "of"];
  for (var i = 0; i < methods.length; i++) {
    it("fantasy-land/" + methods[i] + " alias", makeTester(methods[i]));
  }

  it("Fantasy Land Parsimmon.empty alias", function() {
    assert.equal(Parsimmon.empty, Parsimmon["fantasy-land/empty"]);
  });

  it("Fantasy Land Parsimmon.of alias", function() {
    assert.equal(Parsimmon.of, Parsimmon["fantasy-land/of"]);
    assert.equal(Parsimmon.of, Parsimmon.any.of);
  });
});
