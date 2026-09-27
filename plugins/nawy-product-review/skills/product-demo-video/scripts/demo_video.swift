// Nawy feature demo video: the product's real screens in a laptop, told in order. Per step the camera glides to what
// matters, a spotlight and a label point at it, a cursor moves and clicks, and a caption under the laptop says the
// step. It opens on a title card and closes on an outro, in Nawy's colours. Scenes are screenshots or screen recordings.
//
//   swift demo_video.swift <storyboard.json> <out.mp4>              render the video (1920×1080, 30 fps, H.264)
//   swift demo_video.swift <storyboard.json> --stills 2,6.5 <dir>   render single frames as PNGs, to check the framing
//   swift demo_video.swift --grid <image|video> <out.png> [sec]     a labelled pixel grid over the image (or the video's frame), to read coordinates
//
// Storyboard format: SKILL.md. Paths are absolute or relative to the storyboard's folder; coordinates are image pixels.
// Fonts: Poppins when its .ttf files are in ../assets/fonts, else the system font.
import AVFoundation
import AppKit
import CoreImage

struct Card: Decodable { var kicker: String?; var title: String; var text: String?; var seconds: Double? }
struct Caption: Decodable { var title: String; var text: String? }
struct Scene: Decodable {
    var image: String?, video: String?, from: Double?, to: Double?, speed: Double?, seconds: Double?
    var caption: Caption?
    var view: [Double]?, zoom: [Double]?, zoomAt: Double?
    var highlight: [Double]?, label: String?, highlightAt: Double?
    var click: [Double]?, clickAt: Double?
}
struct Storyboard: Decodable { var intro: Card?; var outro: Card?; var accent: String?; var steps: Bool?; var scenes: [Scene] }

let W = 1920, H = 1080, fps: Int32 = 30
let full = CGRect(x: 0, y: 0, width: W, height: H)
let screen = CGRect(x: 320, y: 64, width: 1280, height: 800) // the laptop's 16:10 screen
let aspect = screen.width / screen.height
let sceneFade = 0.5, cardFade = 0.6, zoomTime = 1.1, moveTime = 0.9

func hex(_ s: String, _ a: CGFloat = 1) -> NSColor {
    var v: UInt64 = 0
    Scanner(string: s.trimmingCharacters(in: CharacterSet(charactersIn: "#"))).scanHexInt64(&v)
    return NSColor(srgbRed: CGFloat((v >> 16) & 255) / 255, green: CGFloat((v >> 8) & 255) / 255, blue: CGFloat(v & 255) / 255, alpha: a)
}
let navy = hex("1E4164"), blue = hex("015C9A"), muted = hex("5B6573"), teal = hex("7DCBC1")

func ease(_ t: Double) -> CGFloat { let t = min(1, max(0, t)); return CGFloat(t < 0.5 ? 4 * t * t * t : 1 - pow(-2 * t + 2, 3) / 2) }
func box(_ a: [Double]?) -> CGRect? { guard let a, a.count == 4 else { return nil }; return CGRect(x: a[0], y: a[1], width: a[2], height: a[3]) }

// Fonts: register Poppins if the skill has it.
let skillDir = URL(fileURLWithPath: #filePath).deletingLastPathComponent().deletingLastPathComponent()
for f in (try? FileManager.default.contentsOfDirectory(at: skillDir.appendingPathComponent("assets/fonts"), includingPropertiesForKeys: nil)) ?? []
where ["ttf", "otf"].contains(f.pathExtension.lowercased()) { CTFontManagerRegisterFontsForURL(f as CFURL, .process, nil) }
func font(_ size: CGFloat, _ weight: NSFont.Weight) -> NSFont {
    let name = [NSFont.Weight.bold: "Poppins-Bold", .semibold: "Poppins-SemiBold", .medium: "Poppins-Medium"][weight] ?? "Poppins-Regular"
    return NSFont(name: name, size: size) ?? .systemFont(ofSize: size, weight: weight)
}
func text(_ s: String, _ f: NSFont, _ c: NSColor, center: Bool = false, kern: CGFloat = 0) -> NSAttributedString {
    let p = NSMutableParagraphStyle(); p.alignment = center ? .center : .left
    return NSAttributedString(string: s, attributes: [.font: f, .foregroundColor: c, .paragraphStyle: p, .kern: kern])
}
func measure(_ s: NSAttributedString, _ maxWidth: CGFloat) -> CGSize {
    let r = s.boundingRect(with: CGSize(width: maxWidth, height: 10_000), options: [.usesLineFragmentOrigin, .usesFontLeading])
    return CGSize(width: ceil(r.width), height: ceil(r.height))
}
func draw(_ s: NSAttributedString, in r: CGRect) { s.draw(with: r, options: [.usesLineFragmentOrigin, .usesFontLeading]) }

// Images keep their pixel size, so storyboard coordinates are pixels whatever the file's DPI.
func loadImage(_ url: URL) -> (NSImage, CGSize)? {
    guard let img = NSImage(contentsOf: url), let rep = img.representations.first else { return nil }
    let size = CGSize(width: rep.pixelsWide, height: rep.pixelsHigh)
    img.size = size
    return (img, size)
}
func drawImage(_ img: NSImage, in r: CGRect, alpha: CGFloat = 1) {
    img.draw(in: r, from: .zero, operation: .sourceOver, fraction: alpha, respectFlipped: true,
             hints: [.interpolation: NSNumber(value: NSImageInterpolation.high.rawValue)])
}

// A screen recording, read in order; seeking back reopens it (only stills do that).
final class VideoFrames {
    let asset: AVURLAsset, track: AVAssetTrack, from: Double, to: Double, speed: Double, size: CGSize
    private var reader: AVAssetReader?, output: AVAssetReaderTrackOutput?
    private var held: CMSampleBuffer?, next: CMSampleBuffer?, heldImage: CGImage?, heldTime = Double.infinity
    private let ci = CIContext()
    init?(url: URL, from: Double?, to: Double?, speed: Double?) {
        asset = AVURLAsset(url: url)
        guard let t = asset.tracks(withMediaType: .video).first else { return nil }
        track = t
        self.from = from ?? 0
        self.to = to ?? asset.duration.seconds
        self.speed = speed ?? 1
        size = t.naturalSize // ponytail: rotation metadata ignored; screen recordings have none
    }
    private func open(at t: Double) {
        reader?.cancelReading()
        let r = try! AVAssetReader(asset: asset)
        r.timeRange = CMTimeRange(start: CMTime(seconds: max(0, t - 0.1), preferredTimescale: 600),
                                  end: CMTime(seconds: to + 0.5, preferredTimescale: 600))
        let o = AVAssetReaderTrackOutput(track: track, outputSettings: [kCVPixelBufferPixelFormatTypeKey as String: kCVPixelFormatType_32BGRA])
        o.alwaysCopiesSampleData = false
        r.add(o)
        r.startReading()
        reader = r; output = o; held = nil; next = nil; heldImage = nil; heldTime = -1
    }
    func image(at t: Double) -> CGImage? {
        if reader == nil || t < heldTime - 0.001 { open(at: t) }
        while true {
            if next == nil { next = output?.copyNextSampleBuffer() }
            guard let n = next else { break }
            let pt = CMSampleBufferGetPresentationTimeStamp(n).seconds
            if pt > t + 0.0005, held != nil { break }
            held = n; next = nil; heldImage = nil; heldTime = pt
        }
        if heldImage == nil, let h = held, let pb = CMSampleBufferGetImageBuffer(h) {
            let img = CIImage(cvPixelBuffer: pb)
            heldImage = ci.createCGImage(img, from: img.extent)
        }
        return heldImage
    }
}

final class Renderer {
    struct Item {
        let scene: Scene, start: Double, dur: Double, still: NSImage?, video: VideoFrames?, size: CGSize
        let view0: CGRect, view1: CGRect?, zoomAt: Double, clickAt: Double?, highlightAt: Double?
    }
    let board: Storyboard, accent: NSColor, logo: NSImage?
    let introDur: Double, outroDur: Double
    var items: [Item] = []
    var total: Double { introDur + (items.last.map { $0.start + $0.dur } ?? 0) + outroDur }

    init(_ board: Storyboard, base: URL) {
        self.board = board
        accent = hex(board.accent ?? "FF7043")
        logo = loadImage(skillDir.appendingPathComponent("assets/nawy-logo.png"))?.0
        introDur = board.intro.map { $0.seconds ?? 2.8 } ?? 0
        outroDur = board.outro.map { $0.seconds ?? 2.6 } ?? 0
        let resolve = { (p: String) in p.hasPrefix("/") ? URL(fileURLWithPath: p) : base.appendingPathComponent(p) }
        var start = 0.0
        for (i, s) in board.scenes.enumerated() {
            var still: NSImage?, video: VideoFrames?, size = CGSize.zero
            if let p = s.image {
                guard let (img, sz) = loadImage(resolve(p)) else { fatalError("scene \(i + 1): cannot read image \(p)") }
                still = img; size = sz
            } else if let p = s.video {
                guard let v = VideoFrames(url: resolve(p), from: s.from, to: s.to, speed: s.speed) else {
                    fatalError("scene \(i + 1): cannot read video \(p)")
                }
                video = v; size = v.size
            } else { fatalError("scene \(i + 1): needs an image or a video") }
            // Timing: the camera settles, then the cursor clicks, then the spotlight lands; each is overridable.
            let view0 = box(s.view).map { Renderer.fit($0, size) } ?? Renderer.defaultView(size)
            let view1 = box(s.zoom).map { Renderer.fit($0, size) }
            let zoomAt = s.zoomAt ?? 0.5
            let settle = view1 == nil ? 0.4 : zoomAt + zoomTime
            let clickAt = s.click == nil ? nil : (s.clickAt ?? settle + 1.0)
            let highlightAt = s.highlight == nil ? nil : (s.highlightAt ?? (clickAt.map { $0 + 0.25 } ?? settle + 0.2))
            let last = max(settle, clickAt ?? 0, (highlightAt ?? 0) + 0.45)
            let dur = s.seconds ?? video.map { ($0.to - $0.from) / $0.speed } ?? max(3.2, last + 2.0)
            items.append(Item(scene: s, start: start, dur: dur, still: still, video: video, size: size,
                              view0: view0, view1: view1, zoomAt: zoomAt, clickAt: clickAt, highlightAt: highlightAt))
            start += dur
        }
    }

    // A view is the part of the image on screen, at the screen's 16:10; bigger than the image leaves white margins.
    static func fit(_ r: CGRect, _ img: CGSize) -> CGRect {
        var w = r.width, h = r.height
        if w / h > aspect { h = w / aspect } else { w = h * aspect }
        var x = r.midX - w / 2, y = r.midY - h / 2
        x = w <= img.width ? min(max(0, x), img.width - w) : (img.width - w) / 2
        y = h <= img.height ? min(max(0, y), img.height - h) : (img.height - h) / 2
        return CGRect(x: x, y: y, width: w, height: h)
    }
    // Default: a long page shows its top at full width; anything else is shown whole.
    static func defaultView(_ img: CGSize) -> CGRect {
        if img.height > img.width / aspect * 1.15 { return CGRect(x: 0, y: 0, width: img.width, height: img.width / aspect) }
        return fit(CGRect(origin: .zero, size: img), img)
    }
    func camera(_ it: Item, _ t: Double) -> CGRect {
        guard let b = it.view1 else { return it.view0 }
        let a = it.view0, u = ease((t - it.zoomAt) / zoomTime)
        let w = a.width * pow(b.width / a.width, u), h = w / aspect
        let cx = a.midX + (b.midX - a.midX) * u, cy = a.midY + (b.midY - a.midY) * u
        return CGRect(x: cx - w / 2, y: cy - h / 2, width: w, height: h)
    }
    func toScreen(_ p: CGPoint, _ v: CGRect) -> CGPoint {
        CGPoint(x: screen.minX + (p.x - v.minX) * screen.width / v.width, y: screen.minY + (p.y - v.minY) * screen.width / v.width)
    }
    func toScreen(_ r: CGRect, _ v: CGRect) -> CGRect {
        let a = toScreen(r.origin, v), s = screen.width / v.width
        return CGRect(x: a.x, y: a.y, width: r.width * s, height: r.height * s)
    }

    // MARK: drawing (top-left origin)
    func frame(_ time: Double, _ cg: CGContext) {
        cg.saveGState()
        cg.translateBy(x: 0, y: CGFloat(H)); cg.scaleBy(x: 1, y: -1)
        NSGraphicsContext.current = NSGraphicsContext(cgContext: cg, flipped: true)
        defer { NSGraphicsContext.current = nil; cg.restoreGState() }
        if let intro = board.intro, time < introDur { drawCard(intro, time); return }
        let t = time - introDur
        if let i = items.firstIndex(where: { t < $0.start + $0.dur }) {
            let local = t - items[i].start
            drawScene(i, local)
            if i == 0, let intro = board.intro, local < cardFade { drawCard(intro, introDur, alpha: 1 - ease(local / cardFade)) }
            return
        }
        guard let lastItem = items.last else { if let outro = board.outro { drawCard(outro, t) }; return } // cards only
        let u = t - (lastItem.start + lastItem.dur)
        drawScene(items.count - 1, lastItem.dur)
        if let outro = board.outro { drawCard(outro, u, alpha: ease(u / cardFade)) }
    }

    func drawScene(_ i: Int, _ t: Double) {
        let cg = NSGraphicsContext.current!.cgContext
        NSGradient(starting: hex("F5F7FA"), ending: hex("E2EAF3"))!.draw(in: full, angle: -90)
        let rise = i == 0 && board.intro != nil ? 70 * (1 - ease(t / 0.9)) : 0 // the laptop rises in after the title
        cg.saveGState()
        cg.translateBy(x: 0, y: rise)
        drawLaptop(cg)
        cg.saveGState()
        NSBezierPath(roundedRect: screen, xRadius: 6, yRadius: 6).addClip()
        if i > 0, t < sceneFade {
            drawScreen(i - 1, items[i - 1].dur)
            cg.setAlpha(ease(t / sceneFade))
            cg.beginTransparencyLayer(auxiliaryInfo: nil)
            drawScreen(i, t)
            cg.endTransparencyLayer()
        } else { drawScreen(i, t) }
        cg.restoreGState()
        drawCursor(i, t)
        cg.restoreGState()
        if i > 0, t < 0.35 { drawCaption(i - 1, alpha: 1 - ease(t / 0.35), dy: 0) }
        let u = ease((t - 0.2) / 0.45)
        drawCaption(i, alpha: u, dy: 18 * (1 - u))
    }

    func drawLaptop(_ cg: CGContext) {
        let lid = screen.insetBy(dx: -18, dy: -18)
        cg.setShadow(offset: CGSize(width: 0, height: -24), blur: 60, color: CGColor(gray: 0, alpha: 0.22))
        hex("1B2027").setFill(); NSBezierPath(roundedRect: lid, xRadius: 26, yRadius: 26).fill()
        cg.setShadow(offset: .zero, blur: 0, color: nil)
        hex("3A4048").setFill(); NSBezierPath(ovalIn: CGRect(x: lid.midX - 4, y: lid.minY + 5, width: 8, height: 8)).fill()
        let base = CGRect(x: lid.minX - 120, y: lid.maxY - 2, width: lid.width + 240, height: 24)
        NSGradient(starting: hex("E6EAEE"), ending: hex("AAB2BC"))!.draw(in: NSBezierPath(roundedRect: base, xRadius: 12, yRadius: 12), angle: -90)
        hex("97A0AA").setFill(); NSBezierPath(roundedRect: CGRect(x: base.midX - 120, y: base.minY, width: 240, height: 9), xRadius: 4, yRadius: 4).fill()
    }

    func drawScreen(_ i: Int, _ t: Double) {
        let it = items[i], v = camera(it, t), s = screen.width / v.width
        NSColor.white.setFill(); screen.fill()
        let img: NSImage? = it.still ?? it.video.flatMap { f in f.image(at: f.from + min(t, it.dur) * f.speed).map { NSImage(cgImage: $0, size: it.size) } }
        if let img {
            drawImage(img, in: CGRect(x: screen.minX - v.minX * s, y: screen.minY - v.minY * s, width: it.size.width * s, height: it.size.height * s))
        }
        guard let h = box(it.scene.highlight), let at = it.highlightAt else { return }
        let a = ease((t - at) / 0.45)
        guard a > 0 else { return }
        let r = toScreen(h, v).insetBy(dx: -10, dy: -10)
        let dim = NSBezierPath(rect: screen)
        dim.append(NSBezierPath(roundedRect: r, xRadius: 12, yRadius: 12))
        dim.windingRule = .evenOdd
        NSColor(white: 0, alpha: 0.45 * a).setFill(); dim.fill()
        let pulse = (1 - ease((t - at) / 0.8)) * 16 // the ring snaps onto the target
        let ring = NSBezierPath(roundedRect: r.insetBy(dx: -pulse, dy: -pulse), xRadius: 12 + pulse, yRadius: 12 + pulse)
        ring.lineWidth = 5
        accent.withAlphaComponent(a).setStroke(); ring.stroke()
        if let label = it.scene.label { drawLabel(label, near: r, alpha: a) }
    }

    func drawLabel(_ label: String, near r: CGRect, alpha: CGFloat) {
        let cg = NSGraphicsContext.current!.cgContext
        let str = text(label, font(26, .semibold), .white), sz = measure(str, 900)
        let pill = CGSize(width: sz.width + 36, height: sz.height + 16)
        var y = r.minY - pill.height - 14
        if y < screen.minY + 10 { y = r.maxY + 14 }
        if y + pill.height > screen.maxY - 10 { y = r.minY + 10 }
        let x = min(max(r.minX, screen.minX + 12), screen.maxX - pill.width - 12)
        let p = CGRect(x: x, y: y + 8 * (1 - alpha), width: pill.width, height: pill.height)
        cg.saveGState()
        cg.setAlpha(alpha)
        cg.setShadow(offset: CGSize(width: 0, height: -6), blur: 18, color: CGColor(gray: 0, alpha: 0.25))
        accent.setFill(); NSBezierPath(roundedRect: p, xRadius: pill.height / 2, yRadius: pill.height / 2).fill()
        cg.setShadow(offset: .zero, blur: 0, color: nil)
        draw(str, in: CGRect(x: p.minX + 18, y: p.minY + 8, width: sz.width + 2, height: sz.height))
        cg.restoreGState()
    }

    func cursorStart(_ i: Int) -> CGPoint {
        if i > 0, let c = items[i - 1].scene.click {
            return toScreen(CGPoint(x: c[0], y: c[1]), camera(items[i - 1], items[i - 1].dur))
        }
        return CGPoint(x: screen.midX + 260, y: screen.maxY - 110)
    }
    func drawCursor(_ i: Int, _ t: Double) {
        let it = items[i]
        guard let c = it.scene.click, let at = it.clickAt else { return }
        let cg = NSGraphicsContext.current!.cgContext
        let target = toScreen(CGPoint(x: c[0], y: c[1]), camera(it, t)), from = cursorStart(i)
        let u = ease((t - (at - moveTime)) / moveTime)
        let p = CGPoint(x: from.x + (target.x - from.x) * u, y: from.y + (target.y - from.y) * u)
        let carried = i > 0 && items[i - 1].scene.click != nil
        let alpha = carried ? 1 : ease((t - (at - moveTime - 0.3)) / 0.3)
        guard alpha > 0 else { return }
        if t >= at, t - at < 0.5 { // click ripple
            let k = CGFloat((t - at) / 0.5), rad = 12 + 40 * k
            accent.withAlphaComponent(0.5 * (1 - k)).setFill()
            NSBezierPath(ovalIn: CGRect(x: p.x - rad, y: p.y - rad, width: rad * 2, height: rad * 2)).fill()
        }
        let press: CGFloat = t >= at && t - at < 0.14 ? 0.86 : 1
        cg.saveGState()
        cg.setAlpha(alpha)
        cg.translateBy(x: p.x, y: p.y); cg.scaleBy(x: 1.3 * press, y: 1.3 * press)
        let arrow = NSBezierPath()
        for (k, q) in [(0.0, 0.0), (0, 30), (7.5, 23.5), (12.5, 35), (17, 33), (12, 21.5), (21.5, 21.5)].enumerated() {
            let pt = CGPoint(x: q.0, y: q.1)
            k == 0 ? arrow.move(to: pt) : arrow.line(to: pt)
        }
        arrow.close()
        cg.setShadow(offset: CGSize(width: 0, height: -3), blur: 8, color: CGColor(gray: 0, alpha: 0.35))
        NSColor.white.setFill(); arrow.fill()
        cg.setShadow(offset: .zero, blur: 0, color: nil)
        arrow.lineWidth = 1.6; NSColor.black.setStroke(); arrow.stroke()
        cg.restoreGState()
    }

    func drawCaption(_ i: Int, alpha: CGFloat, dy: CGFloat) {
        guard alpha > 0, let cap = items[i].scene.caption else { return }
        let cg = NSGraphicsContext.current!.cgContext
        let title = text(cap.title, font(34, .semibold), navy), sub = cap.text.map { text($0, font(24, .regular), muted) }
        let ts = measure(title, 1400), ss = sub.map { measure($0, 1400) } ?? .zero
        let steps = board.steps ?? true, circle: CGFloat = steps ? 52 : 0, gap: CGFloat = steps ? 22 : 0
        let textH = ts.height + (sub == nil ? 0 : ss.height + 2)
        let w = circle + gap + max(ts.width, ss.width) + 64, h = max(circle, textH) + 36
        let b = CGRect(x: (CGFloat(W) - w) / 2, y: 930 + dy, width: w, height: h)
        cg.saveGState()
        cg.setAlpha(alpha)
        cg.setShadow(offset: CGSize(width: 0, height: -8), blur: 30, color: CGColor(gray: 0, alpha: 0.12))
        NSColor.white.setFill(); NSBezierPath(roundedRect: b, xRadius: 18, yRadius: 18).fill()
        cg.setShadow(offset: .zero, blur: 0, color: nil)
        if steps {
            let c = CGRect(x: b.minX + 32, y: b.midY - circle / 2, width: circle, height: circle)
            blue.setFill(); NSBezierPath(ovalIn: c).fill()
            let n = text("\(i + 1)", font(24, .semibold), .white, center: true), ns = measure(n, 100)
            draw(n, in: CGRect(x: c.minX, y: c.midY - ns.height / 2, width: circle, height: ns.height))
        }
        let x = b.minX + 32 + circle + gap, y = b.midY - textH / 2
        draw(title, in: CGRect(x: x, y: y, width: ts.width + 2, height: ts.height))
        if let sub { draw(sub, in: CGRect(x: x, y: y + ts.height + 2, width: ss.width + 2, height: ss.height)) }
        cg.restoreGState()
    }

    // Title and outro cards: navy, the logo on a white badge (never recoloured), the logo's colours along the bottom.
    func drawCard(_ c: Card, _ t: Double, alpha: CGFloat = 1) {
        let cg = NSGraphicsContext.current!.cgContext
        cg.saveGState()
        cg.setAlpha(alpha)
        cg.beginTransparencyLayer(auxiliaryInfo: nil)
        NSGradient(starting: hex("24507A"), ending: navy)!.draw(in: full, angle: -90)
        for (k, h) in ["7DCBC1", "00BDCF", "015C9A", "FF5E00"].enumerated() {
            hex(h).setFill(); CGRect(x: CGFloat(k) * CGFloat(W) / 4, y: CGFloat(H) - 10, width: CGFloat(W) / 4, height: 10).fill()
        }
        var blocks: [(height: CGFloat, gap: CGFloat, draw: (CGFloat) -> Void)] = []
        if let logo {
            let lh: CGFloat = 60, lw = logo.size.width * lh / logo.size.height, bw = lw + 64, bh = lh + 40
            blocks.append((bh, 56, { y in
                let r = CGRect(x: (CGFloat(W) - bw) / 2, y: y, width: bw, height: bh)
                NSColor.white.setFill(); NSBezierPath(roundedRect: r, xRadius: 18, yRadius: 18).fill()
                drawImage(logo, in: CGRect(x: r.minX + 32, y: r.minY + 20, width: lw, height: lh))
            }))
        }
        let lines: [(NSAttributedString, CGFloat)] = [
            c.kicker.map { (text($0.uppercased(), font(24, .semibold), teal, center: true, kern: 4), 18) },
            (text(c.title, font(84, .bold), .white, center: true), 22),
            c.text.map { (text($0, font(34, .regular), hex("C9D6E3"), center: true), 0) },
        ].compactMap { $0 }
        for (s, gap) in lines {
            let sz = measure(s, 1500)
            blocks.append((sz.height, gap, { y in draw(s, in: CGRect(x: (CGFloat(W) - 1500) / 2, y: y, width: 1500, height: sz.height)) }))
        }
        var y = (CGFloat(H) - blocks.reduce(0) { $0 + $1.height + $1.gap }) / 2
        for (k, b) in blocks.enumerated() {
            let u = ease((t - 0.15 - 0.12 * Double(k)) / 0.6)
            cg.saveGState(); cg.setAlpha(u)
            b.draw(y + 26 * (1 - u))
            cg.restoreGState()
            y += b.height + b.gap
        }
        cg.endTransparencyLayer()
        cg.restoreGState()
    }
}

func writePNG(_ img: CGImage, _ path: String) {
    try! NSBitmapImageRep(cgImage: img).representation(using: .png, properties: [:])!.write(to: URL(fileURLWithPath: path))
}
func bitmap(_ w: Int, _ h: Int) -> CGContext {
    CGContext(data: nil, width: w, height: h, bitsPerComponent: 8, bytesPerRow: 0, space: CGColorSpaceCreateDeviceRGB(),
              bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue)!
}

// --grid: the image (or a recording's frame) with lines every 100 px, labelled, heavier every 500 — read coordinates off it.
func videoFrame(_ path: String, at t: Double) -> (NSImage, CGSize)? {
    let g = AVAssetImageGenerator(asset: AVURLAsset(url: URL(fileURLWithPath: path)))
    g.requestedTimeToleranceBefore = .zero; g.requestedTimeToleranceAfter = .zero
    guard let cg = try? g.copyCGImage(at: CMTime(seconds: t, preferredTimescale: 600), actualTime: nil) else { return nil }
    let size = CGSize(width: cg.width, height: cg.height)
    return (NSImage(cgImage: cg, size: size), size)
}
func grid(_ inPath: String, _ outPath: String, at t: Double) {
    let isVideo = ["mov", "mp4", "m4v"].contains(URL(fileURLWithPath: inPath).pathExtension.lowercased())
    guard let (img, size) = isVideo ? videoFrame(inPath, at: t) : loadImage(URL(fileURLWithPath: inPath)) else {
        print("cannot read \(inPath)"); exit(1)
    }
    let cg = bitmap(Int(size.width), Int(size.height))
    cg.translateBy(x: 0, y: size.height); cg.scaleBy(x: 1, y: -1)
    NSGraphicsContext.current = NSGraphicsContext(cgContext: cg, flipped: true)
    drawImage(img, in: CGRect(origin: .zero, size: size))
    let f = font(max(12, size.width / 120), .semibold)
    for (axis, length) in [(0, size.width), (1, size.height)] {
        for v in stride(from: CGFloat(100), to: length, by: 100) {
            let major = Int(v) % 500 == 0
            NSColor(srgbRed: 1, green: 0, blue: 0.6, alpha: major ? 0.8 : 0.35).setFill()
            (axis == 0 ? CGRect(x: v, y: 0, width: major ? 2 : 1, height: size.height)
                       : CGRect(x: 0, y: v, width: size.width, height: major ? 2 : 1)).fill()
            let l = text("\(Int(v))", f, .white), ls = measure(l, 200)
            for k in stride(from: CGFloat(0), to: axis == 0 ? size.height : size.width, by: 500) {
                let at = axis == 0 ? CGPoint(x: v + 3, y: k + 3) : CGPoint(x: k + 3, y: v + 3)
                NSColor(srgbRed: 0.8, green: 0, blue: 0.45, alpha: 0.9).setFill()
                CGRect(x: at.x, y: at.y, width: ls.width + 8, height: ls.height + 2).fill()
                draw(l, in: CGRect(x: at.x + 4, y: at.y + 1, width: ls.width + 2, height: ls.height))
            }
        }
    }
    NSGraphicsContext.current = nil
    writePNG(cg.makeImage()!, outPath)
    print("✓ \(outPath) — \(Int(size.width))×\(Int(size.height)) px")
}

var args = Array(CommandLine.arguments.dropFirst())
if args.first == "--grid", args.count >= 3 { grid(args[1], args[2], at: args.count > 3 ? Double(args[3]) ?? 0 : 0); exit(0) }
guard args.count >= 2 else {
    print("usage: swift demo_video.swift <storyboard.json> <out.mp4> | <storyboard.json> --stills 2,6.5 <dir> | --grid <image|video> <out.png> [sec]")
    exit(1)
}
let boardURL = URL(fileURLWithPath: args[0])
let board: Storyboard
do { board = try JSONDecoder().decode(Storyboard.self, from: Data(contentsOf: boardURL)) } catch { print("storyboard: \(error)"); exit(1) }
let renderer = Renderer(board, base: boardURL.deletingLastPathComponent())

if args[1] == "--stills", args.count == 4 {
    try? FileManager.default.createDirectory(atPath: args[3], withIntermediateDirectories: true)
    for t in args[2].split(separator: ",").compactMap({ Double($0) }) {
        let cg = bitmap(W, H)
        renderer.frame(t, cg)
        let path = "\(args[3])/still-\(String(format: "%05.2f", t)).png"
        writePNG(cg.makeImage()!, path)
        print("✓ \(path)")
    }
    print("total \(String(format: "%.1f", renderer.total))s; scenes start at " +
          renderer.items.map { String(format: "%.1f", renderer.introDur + $0.start) }.joined(separator: ", "))
    exit(0)
}

let out = URL(fileURLWithPath: args[1])
try? FileManager.default.removeItem(at: out)
let writer = try! AVAssetWriter(outputURL: out, fileType: .mp4)
let input = AVAssetWriterInput(mediaType: .video, outputSettings: [
    AVVideoCodecKey: AVVideoCodecType.h264, AVVideoWidthKey: W, AVVideoHeightKey: H,
    AVVideoCompressionPropertiesKey: [AVVideoAverageBitRateKey: 10_000_000, AVVideoProfileLevelKey: AVVideoProfileLevelH264HighAutoLevel],
])
let adaptor = AVAssetWriterInputPixelBufferAdaptor(assetWriterInput: input, sourcePixelBufferAttributes: [
    kCVPixelBufferPixelFormatTypeKey as String: kCVPixelFormatType_32BGRA,
    kCVPixelBufferWidthKey as String: W, kCVPixelBufferHeightKey as String: H,
])
writer.add(input)
writer.startWriting()
writer.startSession(atSourceTime: .zero)
let frames = Int(renderer.total * Double(fps))
for n in 0..<frames {
    while !input.isReadyForMoreMediaData { usleep(1000) }
    var buffer: CVPixelBuffer?
    CVPixelBufferPoolCreatePixelBuffer(nil, adaptor.pixelBufferPool!, &buffer)
    CVPixelBufferLockBaseAddress(buffer!, [])
    let cg = CGContext(data: CVPixelBufferGetBaseAddress(buffer!), width: W, height: H, bitsPerComponent: 8,
                       bytesPerRow: CVPixelBufferGetBytesPerRow(buffer!), space: CGColorSpaceCreateDeviceRGB(),
                       bitmapInfo: CGImageAlphaInfo.premultipliedFirst.rawValue | CGBitmapInfo.byteOrder32Little.rawValue)!
    autoreleasepool { renderer.frame(Double(n) / Double(fps), cg) }
    CVPixelBufferUnlockBaseAddress(buffer!, [])
    adaptor.append(buffer!, withPresentationTime: CMTime(value: CMTimeValue(n), timescale: fps))
}
input.markAsFinished()
let done = DispatchSemaphore(value: 0)
writer.finishWriting { done.signal() }
done.wait()
print(writer.status == .completed ? "✓ \(out.path) — \(board.scenes.count) scene(s), \(String(format: "%.1f", renderer.total))s"
                                  : "✗ \(writer.error?.localizedDescription ?? "failed")")
