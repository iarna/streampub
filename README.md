Streampub
---------

A streaming EPUB3 writer.

## EXAMPLE

```
var Streampub = require('streampub') 
var epub = new Streampub({title: 'My Example'})
epub.setAuthor('Example User')
epub.pipe(fs.createWriteStream('example.epub'))
epub.write({index: 0, chapterName: 'Chapter 1', fileName: 'chapter-1.xhtml', content: '<b>doc content</b>'})
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
* **language** _String_ - _Optional_ The 2 digit language code of the material, defaults to "en".
* **description** _String_ - _Optional_ A brief description or summary of the material.
* **publisher** _String_ - _Optional_ "An entity responsible for making the resource available."
* **subject** _String_ - _Optional_ Calibre treats this field as a comma separated list of tag names. "Typically, the subject will be represented using keywords, key phrases, or classification codes. Recommended best practice is to use a controlled vocabulary."

All of the options can be set after object creation with obvious setters:

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
Streampub.newChapter(chapterName, content, index, fileName)
```

Or by hand by creating an object with the following keys:

* **chapterName** _String_ - _Required_ The name of the chapter in the index.
* **content** _String_ - _Required_ The HTML content of this chapter.  This will be passed
  through `htmltidy` in order to make it valid XHTML.
* **index** _Number_ - _Optional_ Where the chapter should show up in the index. These numbers
  can have gaps and are used for ordering ONLY. Duplicate index values will
  result in the earlier chapter being excluded from the index. If not specified will
  be added after any where it _was_ specified, in the order written.
* **fileName** _String_ - _Optional_ The filename to use *inside* the epub. This only matters if
  you want to do links between chapters. This should end in `.xhtml`.

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

## TODO

It would be nice to support adding non-indexed files to the epub, specifically images.

## PRIOR ART

There are a bunch of epub generators already available.  Many are pre EPUB3. 
Most work off of files on disk rather than in memory constructs.  Only one
other provides a stream that I was able to find was
[epub-generator](https://npmjs.com/package/epub-generator) and it only
provides a read stream.  I wanted to be able to build a full pipeline for,
for example, backpressure reasons.  I also very much wanted to be able to
set epub metadata after object construction time.
