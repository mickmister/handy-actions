import CoreText
import Foundation

@main
struct ReplyTextPagesTests {
  static func main() {
    let family = "👨‍👩‍👧‍👦"
    let fixtures = [
      "", "A short reply.",
      String(repeating: "A long reply with words, code `value`, and https://example.test/a/b?x=1. ", count: 250) + "UNIQUE FINAL SENTENCE",
      "First line\n\nThird line\nFourth line\n\n\nSeventh line\n",
      String(repeating: "\n", count: 19),
      String(repeating: "line\r\n", count: 25),
      String(repeating: "漢字かなカナ 한글 العربية עברית ", count: 100),
      String(repeating: "\(family) 🇺🇸 👍🏽 e\u{301} ", count: 90),
      String(repeating: "unbroken_", count: 700),
      String(repeating: "\\\"\tvalue\n", count: 100)
    ]
    let font = CTFontCreateUIFontForLanguage(.system, HandyReplyTextPages.fontSize, nil)!
    for text in fixtures {
      let pages = HandyReplyTextPages.pages(text)
      precondition(!pages.isEmpty)
      precondition(pages.joined() == text, "Paging must not drop, duplicate or normalize message text")
      precondition(pages == HandyReplyTextPages.pages(text), "Page boundaries must be deterministic")
      var rebuilt = ""
      let validBoundaries = Set(text.indices)
      for page in pages {
        precondition(text.isEmpty || !page.isEmpty, "Every nonempty message page must advance")
        precondition(page.utf8.count <= HandyReplyTextPages.maxPageBytes, "Unicode pages must leave room for ActivityKit controls")
        rebuilt += page
        if rebuilt.utf16.count < text.utf16.count {
          let index = String.Index(utf16Offset: rebuilt.utf16.count, in: text)
          precondition(validBoundaries.contains(index), "Never cut through a grapheme")
        }
        // Independently lay each page out as a CoreText frame. A trailing line
        // separator has no visible glyph on the next line, so exclude it here.
        let visible = page.replacingOccurrences(of: "[\\r\\n]+$", with: "", options: .regularExpression)
        if !visible.isEmpty {
          let attributed = NSAttributedString(string: visible, attributes: [NSAttributedString.Key(kCTFontAttributeName as String): font])
          let framesetter = CTFramesetterCreateWithAttributedString(attributed)
          let path = CGPath(rect: CGRect(x: 0, y: 0, width: HandyReplyTextPages.width, height: 100000), transform: nil)
          let frame = CTFramesetterCreateFrame(framesetter, CFRange(location: 0, length: 0), path, nil)
          precondition(CFArrayGetCount(CTFrameGetLines(frame)) <= HandyReplyTextPages.linesPerPage, "A page must fit the renderer's three lines")
          let bounded = CGPath(rect: CGRect(x: 0, y: 0, width: HandyReplyTextPages.width, height: 44), transform: nil)
          let boundedFrame = CTFramesetterCreateFrame(framesetter, CFRange(location: 0, length: 0), bounded, nil)
          precondition(CTFrameGetVisibleStringRange(boundedFrame).length == visible.utf16.count, "Tall fallback glyphs must also fit the actual 44pt text region")
        }
      }
    }
    precondition(HandyReplyTextPages.pages("Short").count == 1)
    precondition(HandyReplyTextPages.pages(fixtures[2]).count > 1)
    precondition(HandyReplyTextPages.pages(fixtures[2]).last!.contains("SENTENCE"), "Text beyond all old truncation limits must remain reachable")
    let original = String(repeating: "An existing line of a streamed reply. ", count: 50)
    let before = HandyReplyTextPages.pages(original)
    let after = HandyReplyTextPages.pages(original + String(repeating: " More streamed text.", count: 50))
    precondition(Array(before.dropLast()) == Array(after.prefix(before.count - 1)), "Appending stream text must preserve completed pages")
    print("Native reply pagination passed: \(fixtures.count) layout/lossless/Unicode fixtures, long-message tail, and streaming stability.")
  }
}
