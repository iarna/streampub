'use strict'
module.exports = normalizeXHTML
var Bluebird = require('bluebird')
var parse5 = require('parse5')
var xmlserializer = require('xmlserializer')

function normalizeXHTML (xhtml) {
  return Bluebird.resolve(xmlserializer.serializeToString(parse5.parse(xhtml)))
}
