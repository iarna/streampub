'use strict'
var Bluebird = require('bluebird')
var Transform = require('readable-stream').Transform
var zlib = require('zlib')
var ZipStream = require('zip-stream')
var inherits = require('util').inherits
var xml = require('xml')
var uuid = require('uuid')
var normalizeXHTML = require('./normalize-xhtml.js')

module.exports = Streampub
module.exports.newChapter = Chapter

var container = {container: [
  {_attr: {version: '1.0', xmlns: 'urn:oasis:names:tc:opendocument:xmlns:container'}},
  {rootfiles: [
    {rootfile: [
      {_attr: {'full-path': 'OEBPS/content.opf', 'media-type': 'application/oebps-package+xml'}}
    ]}
  ]}
]}

function Streampub (opts) {
  var self = this
  Transform.call(this, {objectMode: true})
  if (!opts) opts = {}
  this.zip = new ZipStream({level: zlib.Z_BEST_COMPRESSION})
  this.zip.entry = Bluebird.promisify(this.zip.entry)
  this.zip.on('data', function (data, enc) {
    self.push(data, enc)
  })
  this.chapters = []
  this.files = []
  this.meta = {}
  this.meta.id = opts.id
  this.meta.title = opts.title || 'Untitled'
  this.meta.author = opts.author
  this.setModified(opts.modified || new Date())
  if (opts.published) this.setPublished(opts.published)
  this.meta.source = opts.source
  this.meta.language = opts.language || 'en'
  this.meta.description = opts.description
  this.meta.publisher = opts.publisher
  this.meta.subject = opts.subject
  this.maxId = 0
  this.header = self.zip.entry('application/epub+zip', {name: 'mimetype'}).then(function () {
    return self.zip.entry(xml(container, {declaration: true}), {name: 'META-INF/container.xml'})
  })
}
inherits(Streampub, Transform)

Streampub.prototype._flush = function (done) {
  var self = this
  var pkg = []
  pkg.push({_attr: {version: '3.0', 'unique-identifier': 'pub-id', 'xmlns': 'http://www.idpf.org/2007/opf'}})
  pkg.push({metadata: self._generateMetadata()})
  pkg.push({manifest: self._generateManifest()})
  pkg.push({spine: self._generateSpine()})
  self.header.then(function () {
    return self.zip.entry(xml([{'package': pkg}], {declaration: true}), {name: 'OEBPS/content.opf'})
  }).then(function () {
    return self.zip.entry(xml([{html: self._generateTOC()}], {declaration: true}), {name: 'OEBPS/toc.xhtml'})
  }).then(function () {
    self.zip.once('finish', done)
    self.zip.finalize()
    return null
  })
}

function Chapter (index, chapterName, fileName, content) {
  return {index: index, chapterName: chapterName, fileName: fileName, content: content}
}

Streampub.prototype._transform = function (data, encoding, done) {
  var self = this
  normalizeXHTML(data.content).catch(done).then(function (html) {
    var id = ++self.maxId
    var index = data.index || (100000 + id)
    var fileName = data.fileName || ('streampub-chapter-' + id + '.xhtml')
    self.chapters[index] = {index: index, chapterName: data.chapterName, fileName: fileName}
    self.files.push({fileName: fileName, mime: 'application/xhtml+xml', id: 'file' + id})
    self.header.then(function () {
      return self.zip.entry(html, {name: 'OEBPS/' + fileName})
    }).finally(function () {
      done()
    })
  })
}

Streampub.prototype.setTitle = function (title) {
  this.meta.title = title
}

Streampub.prototype.setAuthor = function (author) {
  this.meta.author = author
}

Streampub.prototype.setModified = function (modified) {
  if (!(modified instanceof Date)) modified = new Date(modified)
  this.meta.modified = modified
}

Streampub.prototype.setPublished = function (published) {
  if (!(published instanceof Date)) published = new Date(published)
  this.meta.published = published
}

Streampub.prototype.setSource = function (src) {
  this.meta.source = src
}

Streampub.prototype.setLanguage = function (language) {
  this.meta.language = language
}

Streampub.prototype.setDescription = function (description) {
  this.meta.description = description
}

Streampub.prototype.setPublisher = function (publisher) {
  this.meta.publisher = publisher
}

Streampub.prototype.setSubject = function (subject) {
  this.meta.subject = subject
}

function w3cdtc (date) {
  try {
    return date.toISOString().replace(/[.]\d{1,3}Z/, 'Z')
  } catch (e) {
    console.error('WAT', date, '!!')
    throw e
  }
}

Streampub.prototype._generateMetadata = function () {
  var metadata = [{_attr: {'xmlns:dc': 'http://purl.org/dc/elements/1.1/'}}]
  var id = this.meta.id || 'url:' + this.meta.source || 'urn:uuid:' + uuid.v4()
  metadata.push({'dc:identifier': [{_attr: {id: 'pub-id'}}, id]})
  metadata.push({'dc:language': this.meta.language})
  metadata.push({'dc:title': this.meta.title})
  metadata.push({'meta': [{_attr: {property: 'dcterms:modified'}}, w3cdtc(this.meta.modified)]})
  if (this.meta.source) {
    metadata.push({'dc:source': this.meta.source})
  }
  if (this.meta.author) {
    metadata.push({'dc:creator': [{_attr: {id: 'author'}}, this.meta.author]})
    metadata.push({'meta': [{_attr: {refines: '#author', property: 'role', scheme: 'marc:relators', id: 'role'}}, 'aut']})
  }
  if (this.meta.description) {
    metadata.push({'dc:description': this.meta.description})
  }
  if (this.meta.published) {
    metadata.push({'dc:date': w3cdtc(this.meta.published)})
  }
  if (this.meta.publisher) {
    metadata.push({'dc:publisher': this.meta.publisher})
  }
  if (this.meta.subject) {
    metadata.push({'dc:subject': this.meta.subject})
  }
  return metadata
}

Streampub.prototype._generateManifest = function () {
  var manifest = []
  // epub2: <item href="toc.ncx" id="ncx" media-type="application/x-dtbncx+xml" />
  // epub3: <item href="toc.xhtml" id="nav" properties="nav" media-type: "application/xhtml+xml" />
  manifest.push({'item': [{_attr: {id: 'nav', href: 'toc.xhtml', properties: 'nav', 'media-type': 'application/xhtml+xml'}}]})
  this.files.forEach(function (file) {
    manifest.push({'item': [{_attr: {id: file.id, href: file.fileName, 'media-type': file.mime}}]})
  })
  return manifest
}

Streampub.prototype._generateSpine = function () {
  var spine = []
  this.files.forEach(function (file) {
    spine.push({'itemref': [{_attr: {idref: file.id}}]})
  })
  return spine
}

Streampub.prototype._generateTOC = function () {
  var html = [{_attr: {'xmlns': 'http://www.w3.org/1999/xhtml', 'xmlns:epub': 'http://www.idpf.org/2007/ops'}}]
  html.push({'head': []})
  var body = []
  html.push({'body': body})
  var nav = [{_attr: {'epub:type': 'toc'}}]
  body.push({'nav': nav})
  var ol = []
  nav.push({'ol': ol})
  this.chapters.forEach(function (chapter) {
    ol.push({'li': [{'a': [{_attr: {'href': chapter.fileName}}, chapter.chapterName]}]})
  })
  return html
}
