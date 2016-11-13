Streampub
---------

A streaming EPUB3 writer.

## EXAMPLE

```
var Streampub = require('streampub')
var fs = require('fs')
var epub = new Streampub({title: 'My Example'})
epub.setAuthor('Example User')
epub.pipe(fs.createWriteStream('example.epub'))
epub.write(Streampub.newChapter('Chapter 1', 'chapter-1.xhtml', '<b>doc content</b>', 0))
epub.end()
```

## USAGE

### var epub = new Streampub(*opts*)

*opts* is an object that optionally has the following properties:

* **id** _String_ - _Default: url:**source** or a UUID_ A unique identifier for this work. Note that URLs for this field must be prefixed by "url:".
* **title** _String_ - _Default: "Untitled"_ The title of the epub.
* **author** _String_ - _Optional_ The name of the author of the epub.
* **authorUrl** _String_ - _Optional_ Only used if an author name is used as
  well.  Adds a related `foaf:homepage` link to the author record.  Also a
  Calibre link_map, but as yet, Calibre seems unwilling to import this.
* **modified** _Date_ - _Default: new Date()_ When the epub was last modified.
* **published** _Date_ - _Optional_ When the source material was published.
* **source** _String_ - _Optional_ The original URL or URN of the source material. "The described resource may be derived from the related resource in whole or in part. Recommended best practice is to identify the related resource by means of a string conforming to a formal identification system."
* **language** _String_ - _Default: "en"_ Identifies the language used in the book content. The content has to comply with [RFC 3066](http://www.ietf.org/rfc/rfc3066.txt). [List of language codes](http://www.loc.gov/standards/iso639-2/php/code_list.php).
* **description** _String_ - _Optional_ A brief description or summary of the material.
* **publisher** _String_ - _Optional_ "An entity responsible for making the resource available."
* **subject** _String_ - _Optional_ Calibre treats this field as a comma separated list of tag names. "Typically, the subject will be represented using keywords, key phrases, or classification codes. Recommended best practice is to use a controlled vocabulary."

All of the options can be set after object creation with obvious setters:

* `epub.setId(id)`
* `epub.setTitle(title)`
* `epub.setAuthor(author)`
* `epub.setAuthorUrl(author)`
* `epub.setModified(modified)`
* `epub.setPublished(published)`
* `epub.setSource(source)`
* `epub.setLanguage(language)`
* `epub.setDescription(description)`
* `epub.setPublisher(publisher)`
* `epub.setSubject(subject)`

### The Streampub Object

The Streampub object is a transform stream that takes chapter information as
input and outputs binary chunks of an epub file. It's an ordinary stream so you
can pipe into it or write to it and call `.end()` when you're done.

### var epub.write(*obj*, *callback*)

This is the usual stream write function. The object can either be constructed with:

```
Streampub.newChapter(chapterName, content, index, fileName, mime)
Streampub.newCoverImage(content, mime)
Streampub.newFile(fileName, content, mime)
```

Or by hand by creating an object with the following keys:

* **id** _String_ - _Optional_ Internal ID of object, if omited `streampub` will generate one.
* **chapterName** _String_ - _Required_ The name of the chapter in the index.
* **content** _String_ or _stream.Readable_ - _Required_ The content of item being added. If this is HTML then
  it will be run through `htmltidy` to make it valid XHTML. See `htmltidy options` below for details.
* **index** _Number_ - _Optional_ Where the chapter should show up in the index. These numbers
  can have gaps and are used for ordering ONLY. Duplicate index values will
  result in the earlier chapter being excluded from the index. If not specified will
  be added after any where it _was_ specified, in the order written.
* **fileName** _String_ - _Optional_ The filename to use *inside* the epub. For chapters this is only needed
  if you want to inter-chapter linking. Uses are more obvious for CSS and images. If content is an `fs` stream
  then this will default to a value inferred from the original filename.
* **index** _Number_ - _Optional_ Where the chapter should show up in the index. These numbers
  can have gaps and are used for ordering ONLY. Duplicate index values will
  result in the earlier chapter being excluded from the index. If not specified will
  be added after any where it _was_ specified, in the order written.
* **mime** _String_ - _Optional_ Mimetype of content, if not supplied `streampub` will try to determine type.

*If you include indexes then you can add chapters in any order.*

#### Example

```
var Streampub = require('./index')
var fs = require('fs')

var epub = new Streampub({title: 'My Example'})
epub.setAuthor('Example author')
epub.pipe(fs.createWriteStream('example.epub'))
epub.write(Streampub.newFile(fs.createReadStream('author.jpg')))
epub.write(Streampub.newFile('stylesheet.css', fs.createReadStream('styles.css')})
epub.write(Streampub.newChapter('Chapter 1', '<h1>Chapter 1</h1><b>doc content</b>'))
epub.write(Streampub.newChapter('Chapter 2', '<h1>Chapter 2</h1><b>doc content</b>'))
epub.end()
```

or equivalently

```
var epub = new Streampub({title: 'My Example'})
epub.setAuthor('Example author')
epub.pipe(fs.createWriteStream('example.epub'))
epub.write({content: fs.createReadStream('author.jpg')})
epub.write({fileName: 'stylesheet.css', content: fs.createReadStream('styles.css')})
epub.write({chapterName: 'Chapter 1', content: '<h1>Chapter 1</h1><b>doc content</b>'})
epub.write({chapterName: 'Chapter 2', content: '<h1>Chapter 2</h1><b>doc content</b>'})
epub.end()
```

## Cover image

The epub specification does not contain a standarized way to include book covers. There is however a "best practice" that will work in most reader applications. `streampub` has some magic under the hood to correctly add a cover image. The only requirements are that the file needs to be in JPEG format and should be max 1000x1000 pixels.

### Example


```
var Streampub = require('./index')
var fs = require('fs')

var epub = new Streampub({title: 'My Example'})
epub.setAuthor('Example author')
epub.pipe(fs.createWriteStream('example.epub'))
// Using this specific ID causes cover magic to kick in
epub.write(Streampub.newCoverImage(fs.createReadStream('cover.jpg')))
epub.write(Streampub.newChapter('Chapter 1', '<h1>Chapter 1</h1><b>doc content</b>'))
epub.write(Streampub.newChapter('Chapter 2', '<h1>Chapter 2</h1><b>doc content</b>'))
epub.end()
```

or equivalently

```
var Streampub = require('./index')
var fs = require('fs')

var epub = new Streampub({title: 'My Example'})
epub.setAuthor('Example author')
epub.pipe(fs.createWriteStream('example.epub'))
// Using this specific ID causes cover magic to kick in
epub.write({id: 'cover-image', content: fs.createReadStream('cover.jpg')})
epub.write({chapterName: 'Chapter 1', content: '<h1>Chapter 1</h1><b>doc content</b>'})
epub.write({chapterName: 'Chapter 2', content: '<h1>Chapter 2</h1><b>doc content</b>'})
epub.end()
```

##### htmltidy options
`htmltidy` options used are:

```
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
```

## VALIDATION

This takes care to generate only valid XML using programmatic generators and
not templates

Epubs produced by this have been validated with
[epubcheck](https://github.com/idpf/epubcheck).  No warnings outside of
content warnings should be present.

Content warnings ordinarily only happen if your content contains broken links–usually relative links to resources
that don't exist in the epub.

## PRIOR ART

There are a bunch of epub generators already available.  Many are pre EPUB3.
Most work off of files on disk rather than in memory constructs.  Only one
other provides a stream that I was able to find was
[epub-generator](https://npmjs.com/package/epub-generator) and it only
provides a read stream.  I wanted to be able to build a full pipeline for,
for example, backpressure reasons.  I also very much wanted to be able to
set epub metadata after object construction time.
