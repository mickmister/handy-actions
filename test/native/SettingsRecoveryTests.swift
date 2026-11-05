import CryptoKit
import Foundation

@main
struct SettingsRecoveryTests {
  static func main() throws {
    let folder = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString, isDirectory: true)
    try FileManager.default.createDirectory(at: folder, withIntermediateDirectories: true)
    defer {try? FileManager.default.removeItem(at: folder)}
    // Names are independently computed MD5 fixtures for the actual legacy keys.
    let primary = folder.appendingPathComponent("7f5300d4f0720c1580d21b4e6d26ca3c")
    let recovery = folder.appendingPathComponent("732ac4b6dc29eb5d6e7501d9fdcb72e8")
    let manifest = folder.appendingPathComponent("manifest.json")
    let original = "{\"presets\":[{\"id\":\"original\"}],\"theme\":\"paper\"}"
    let current = "{\"handy-actions/state/v1\":\"{\\\"presets\\\":[],\\\"theme\\\":\\\"midnight\\\"}\"}"
    try Data(original.utf8).write(to: primary)
    try Data("{\"version\":1,\"state\":{\"presets\":[]}}".utf8).write(to: recovery)
    try Data(current.utf8).write(to: manifest)
    try Data("Unrelated receipt".utf8).write(to: folder.appendingPathComponent("unrelated"))
    let result = try JSONSerialization.jsonObject(with: Data(HandySettingsRecovery.scan(directory: folder).utf8)) as! [String: Any]
    let files = result["files"] as! [[String: Any]]
    precondition(files.count == 2 && result["unreadableFiles"] as? Int == 0)
    precondition(files.contains(where: {$0["raw"] as? String == original}), "Find the original file even when inline theme-only settings exist")
    let originalAfter = try Data(contentsOf: primary)
    let manifestAfter = try Data(contentsOf: manifest)
    precondition(originalAfter == Data(original.utf8), "Scanning must not change original bytes")
    precondition(manifestAfter == Data(current.utf8), "Scanning must not change the current index or theme")
    try FileManager.default.removeItem(at: recovery)
    try FileManager.default.createDirectory(at: recovery, withIntermediateDirectories: false)
    let partial = try JSONSerialization.jsonObject(with: Data(HandySettingsRecovery.scan(directory: folder).utf8)) as! [String: Any]
    precondition((partial["files"] as! [Any]).count == 1 && partial["unreadableFiles"] as? Int == 1)
    let absent = try JSONSerialization.jsonObject(with: Data(HandySettingsRecovery.scan(directory: folder.appendingPathComponent("missing")).utf8)) as! [String: Any]
    precondition((absent["files"] as! [Any]).isEmpty && absent["unreadableFiles"] as? Int == 0)
    print("Native preset recovery passed: known legacy paths, theme-only inline state, read-only scan, missing/unreadable files and unrelated-file isolation.")
  }
}
