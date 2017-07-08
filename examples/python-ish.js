'use strict';

// Run me with Node to see my output!

let util = require('util');
let P = require('..');

///////////////////////////////////////////////////////////////////////

let Pythonish = P.createLanguage({
  Program: r =>
    r.Statement.many().trim(r._).node('Program'),

  Statement: r =>
    P.alt(r.Call, r.Block).trim(r._),

  Call: r =>
    P.regexp(/[a-z]+/)
      .skip(P.string('()'))
      .skip(r.Terminator)
      .node('Call'),

  Block: r =>
    P.seqObj(
      P.string('block:'),
      r.Terminator,
      r._,
      r.IndentMore,
      ['first', r.Statement],
      ['rest', r.IndentSame.then(r.Statement).many()],
      r.IndentLess
    ).map(args => {
      let {first, rest} = args;
      let statements = [first, ...rest];
      return {statements};
    }).node('Block'),

  // Uses standard Parsimmon indentation tracking. This includes either tabs or
  // spaces, but does not support them mixed. Please note that Python actually
  // allows mixed tabs and spaces, despite it being a not very good idea.
  //
  // https://docs.python.org/3/reference/lexical_analysis.html#indentation
  IndentMore: () => P.indentMore(P.countIndentation),
  IndentLess: () => P.indentLess(P.countIndentation),
  IndentSame: () => P.indentSame(P.countIndentation),

  // Standard Python style comments
  Comment: r =>
    P.seq(
      P.string('#'),
      P.regexp(/[^\r\n]*/),
      r.End
    ),

  // Zero or more blank lines; should be ignore for parsing purposes
  _: r => r.BlankLine.many(),

  // A blank line which should be completely ignored for all parsing purposes
  BlankLine: r => r.Spaces0.then(P.alt(r.Comment, r.Newline)),

  // A logical "end" of a line can include spaces or a comment before the end
  Terminator: r => r.Spaces0.then(P.alt(r.Comment, r.End)),

  // Zero or more spaces or tabs
  Spaces0: () => P.regexp(/[ \t]*/),

  // Logical newlines can be:
  //
  // - Windows style ("\r\n" aka CRLF)
  // - UNIX style ("\n" aka LF)
  // - Mac OS 9 style ("\r" aka CR)
  //
  // Realistically, nobody uses Mac OS 9 style any more, but oh well.
  Newline: () => P.alt(P.string('\r\n'), P.oneOf('\r\n')).desc('newline'),

  // Typically text files *end* each line with a newline, rather than just
  // separating them, but many files are malformed, so we should support the
  // "end of file" as a form of newline.
  End: r => P.alt(r.Newline, P.eof),
});

///////////////////////////////////////////////////////////////////////

let SPACE = ' ';

let text = `\


#c0


z() #c1'\r\n\
block:    #   c2\r
  a() #c3

  b() #       c4

${SPACE}${SPACE}
${SPACE}${SPACE}# comment
  block:
    c()
    d()
    block:
      aa()
      ab()
      ac()
      block:
        ba()
        bb()
        bc()
      e()
f()#c
`;

function prettyPrint(x) {
  let opts = {depth: null, colors: 'auto'};
  let s = util.inspect(x, opts);
  console.log(s);
}

console.log(new Date().toTimeString());
console.log();
let ast = Pythonish.Program.tryParse(text);
prettyPrint(ast);
