'use strict'
var Bluebird = require('bluebird')
var Transform = require('readable-stream').Transform
var zlib = require('zlib')
var ZipStream = require('zip-stream')
var inherits = require('util').inherits
var xml = require('xml')
var uuid = require('uuid')
var normalizeXHTML = require('./normalize-xhtml.js')
var mime = require('mime-types')
var stream = require('stream')
var path = require('path')

module.exports = Streampub
module.exports.newChapter = Chapter
module.exports.newCoverImage = CoverImage
module.exports.newFile = File

var container = {container: [
  {_attr: {version: '1.0', xmlns: 'urn:oasis:names:tc:opendocument:xmlns:container'}},
  {rootfiles: [
    {rootfile: [
      {_attr: {'full-path': 'OEBPS/content.opf', 'media-type': 'application/oebps-package+xml'}}
    ]}
  ]}
]}

var MIME_XHTML = 'application/xhtml+xml'
var TYPE_COVER = 'cover'
var TYPE_COVER_IMAGE = 'cover-image'
var FILENAME_COVER = 'cover.xhtml'
var FILENAME_COVER_IMAGE = 'images/cover.jpg'

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
  this.meta.authorUrl = opts.authorUrl
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
  pkg.push({_attr: {
    version: '3.0',
    'unique-identifier': 'pub-id',
    'xmlns': 'http://www.idpf.org/2007/opf',
    'prefix': 'foaf: http://xmlns.com/foaf/spec/ ' +
              'calibre: https://calibre-ebook.com'
  }})
  pkg.push({metadata: self._generateMetadata()})
  pkg.push({manifest: self._generateManifest()})
  pkg.push({spine: self._generateSpine()})
  if (self.hasCover) {
    pkg.push({guide: [{reference: {_attr: {href: FILENAME_COVER, type: 'cover', title: self.meta.title || 'Cover'}}}]})
  }

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

function Chapter (chapterName, content, index, fileName, mime) {
  return {index: index, chapterName: chapterName, fileName: fileName, content: content, mime: mime}
}

function CoverImage (content, mime) {
  return {id: 'cover-image', content: content, mime: mime}
}

function File (fileName, content, mime) {
  if (fileName instanceof stream.Stream) {
    mime = content
    content = fileName
    fileName = null
  }
  return {content: content, fileName: fileName, mime: mime}
}

Streampub.prototype._injectCover = function (cb) {
  var self = this
  var title = self.meta.title || 'Cover'
  self._transform({
    id: TYPE_COVER,
    fileName: FILENAME_COVER,
    mime: MIME_XHTML,
    content:
      '<html><head><title>' + title + '</title></head><body style="margin: 0; padding: 0;">' +
      '<img src="' + FILENAME_COVER_IMAGE + '" style="max-width: 100%; oeb-column-number:1;">' +
      '</body></html>'
  }, 'utf8', cb)
}

Streampub.prototype._transform = function (data, encoding, done) {
  var self = this
  var id = data.id || ++self.maxId
  var index = data.index || (100000 + id)

  if (data.id === TYPE_COVER_IMAGE) {
    self.hasCoverImage = true
    data.fileName = FILENAME_COVER_IMAGE
  } else if (data.id === TYPE_COVER) {
    self.hasCover = true
  }

  var contentIsStream = data.content instanceof stream.Stream
  var sourceFilename = contentIsStream && typeof data.content.path === 'string' ? path.basename(data.content.path) : undefined

  data.fileName = data.fileName ||
    (data.chapterName ? 'chapter-' + id + '.xhtml' : sourceFilename || 'asset-' + id)

  data.mime = data.mime || mime.lookup(sourceFilename || data.fileName)

  function addContent (content) {
    if (data.chapterName) {
      self.chapters[index] = {index: index, chapterName: data.chapterName, fileName: data.fileName}
    }
    self.files.push({chapterName: data.chapterName, fileName: data.fileName, mime: data.mime, id: data.id || 'file' + id})
    return self.header.then(function () {
      return self.zip.entry(content, {name: 'OEBPS/' + data.fileName})
    })
  }

  if (contentIsStream) {
    addContent(data.content).then(function () {
      if (self.hasCoverImage && !self.hasCover) {
        self._injectCover(done)
      }
    }).catch(done)
  } else {
    normalizeXHTML(data.content).catch(done).then(addContent).finally(done)
  }
}

Streampub.prototype.setId = function (id) {
  this.meta.id = id
}

Streampub.prototype.setTitle = function (title) {
  this.meta.title = title
}

Streampub.prototype.setAuthor = function (author) {
  this.meta.author = author
}

Streampub.prototype.setAuthorUrl = function (authorUrl) {
  this.meta.authorUrl = authorUrl
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
    metadata.push({'link': [{_attr: {href: this.meta.source, rel: 'foaf:homepage'}}]})
  }
  if (this.meta.author) {
    metadata.push({'dc:creator': [{_attr: {id: 'author'}}, this.meta.author]})
    metadata.push({'meta': [{_attr: {refines: '#author', property: 'role', scheme: 'marc:relators', id: 'role'}}, 'aut']})
    metadata.push({'meta': [{_attr: {'property': 'file-as', refines: '#author'}}, this.meta.author]})
    if (this.meta.authorUrl) {
      metadata.push({'link': [{_attr: {href: this.meta.authorUrl, rel: 'foaf:homepage', refines: '#author'}}]})
      var authorMap = {}
      authorMap[this.meta.author] = this.meta.authorUrl
      metadata.push({'meta': [{_attr: {'property': 'calibre:author_link_map'}}, JSON.stringify(authorMap)]})
    }
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
  if (this.hasCoverImage) {
    metadata.push({'meta': [{_attr: {name: 'cover', content: 'cover-image'}}]})
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
  var item
  manifest.push({'item': [{_attr: {id: 'nav', href: 'toc.xhtml', properties: 'nav', 'media-type': MIME_XHTML}}]})
  this.files.forEach(function (file) {
    item = {'item': [{_attr: {id: file.id, href: file.fileName, 'media-type': file.mime}}]}
    if (file.id === TYPE_COVER_IMAGE) {
      manifest.unshift(item)
    } else {
      manifest.push(item)
    }
  })
  return manifest
}

Streampub.prototype._generateSpine = function () {
  var spine = []
  this.files.forEach(function (file) {
    if (file.chapterName) {
      spine.push({'itemref': [{_attr: {idref: file.id}}]})
    } else if (file.id === TYPE_COVER) {
      spine.unshift({'itemref': [{_attr: {idref: file.id, linear: 'no'}}]})
    }
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
