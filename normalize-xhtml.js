'use strict'
module.exports = normalizeXHTML
var Bluebird = require('bluebird')
var tidy = Bluebird.promisify(require('htmltidy').tidy)


var tidyOpt = {
  'output-xhtml': true,
  'doctype': 'html5',
  'add-xml-decl': true,
  'coerce-endtags': true,
  'enclose-block-text': true,
  'drop-proprietary-attributes': true,
  'strict-tags-attributes': true,
  'clean': true,
  'quote-nbsp': false,
  'numeric-entities': true
}

function normalizeXHTML (xhtml) {
  return retidy(xhtml, tidyOpt)
}

// there's a bug in htmltidy where the first invocation sometimes results in an empty result =/
function retidy (content, opts, count) {
  if (!count) count = 1
  return tidy(content, opts).then(function (html) {
    if (count < 20 && content.length !== 0 && html.length === 0) return retidy(content, opts, ++count)
    return html
  })
}