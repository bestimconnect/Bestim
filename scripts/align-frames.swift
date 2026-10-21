// Evens out a turntable set after slicing: finds the car in every frame (dark trim, glass, wheels and lime parts stand out
// from the pale studio background), then shifts each frame so the car has the same horizontal centre and the same ground line. Usage: swift scripts/align-frames.swift assets/images/360/<type>
import Foundation
import CoreGraphics
import ImageIO
import UniformTypeIdentifiers

let dir = CommandLine.arguments[1]
let urls = (try! FileManager.default.contentsOfDirectory(atPath: dir)).filter { $0.hasSuffix(".jpg") }.sorted().map { URL(fileURLWithPath: dir + "/" + $0) }

func load(_ u: URL) -> CGImage { CGImageSourceCreateImageAtIndex(CGImageSourceCreateWithURL(u as CFURL, nil)!, 0, nil)! }
func pixels(_ img: CGImage) -> [UInt8] {
  var d = [UInt8](repeating: 0, count: img.width * img.height * 4)
  let ctx = CGContext(data: &d, width: img.width, height: img.height, bitsPerComponent: 8, bytesPerRow: img.width * 4, space: CGColorSpaceCreateDeviceRGB(), bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue)!
  ctx.draw(img, in: CGRect(x: 0, y: 0, width: img.width, height: img.height))
  return d
}

struct Box { var x0: Int, y0: Int, x1: Int, y1: Int }
func carBox(_ img: CGImage) -> Box {
  let p = pixels(img), w = img.width, h = img.height
  var b = Box(x0: w, y0: h, x1: 0, y1: 0)
  let m = w / 20 // ignore the outer 5%: a sliver of the neighbouring cell's car can sit on the edge
  for y in 0..<h { for x in m..<(w - m) {
    let i = (y * w + x) * 4
    let r = Int(p[i]), g = Int(p[i + 1]), bl = Int(p[i + 2])
    let lum = (r * 3 + g * 6 + bl) / 10
    let lime = g > 170 && bl < 120 && r > 120
    if lum < 110 || lime {
      b.x0 = min(b.x0, x); b.x1 = max(b.x1, x); b.y0 = min(b.y0, y); b.y1 = max(b.y1, y)
    }
  } }
  return b
}

let imgs = urls.map(load)
let boxes = imgs.map(carBox)
let w = imgs[0].width, h = imgs[0].height
let groundY = Double(h) * 0.86 // the wheels' bottom edge, same in every frame

for (i, img) in imgs.enumerated() {
  let b = boxes[i]
  let s = 1.0 // scale is left alone: a front view really is taller than a side view, so only position is evened out
  let cx = Double(b.x0 + b.x1) / 2
  // background colour from the frame's top-left corner
  let p = pixels(img)
  let bg = (Double(p[0]) / 255, Double(p[1]) / 255, Double(p[2]) / 255)
  let ctx = CGContext(data: nil, width: w, height: h, bitsPerComponent: 8, bytesPerRow: 0, space: CGColorSpaceCreateDeviceRGB(), bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue)!
  ctx.setFillColor(CGColor(red: bg.0, green: bg.1, blue: bg.2, alpha: 1))
  ctx.fill(CGRect(x: 0, y: 0, width: w, height: h))
  // CoreGraphics' y runs upward: convert the car's bottom and centre to that frame
  let dx = Double(w) / 2 - cx * s
  let dy = (Double(h) - groundY) - (Double(h) - Double(b.y1)) * s
  ctx.interpolationQuality = .high
  ctx.draw(img, in: CGRect(x: dx, y: dy, width: Double(w) * s, height: Double(h) * s))
  let out = ctx.makeImage()!
  let dest = CGImageDestinationCreateWithURL(urls[i] as CFURL, UTType.jpeg.identifier as CFString, 1, nil)!
  CGImageDestinationAddImage(dest, out, [kCGImageDestinationLossyCompressionQuality: 0.9] as CFDictionary)
  CGImageDestinationFinalize(dest)
}
print("aligned \(imgs.count) frames")
