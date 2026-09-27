import CoreGraphics
import Foundation

let desiredOwner = CommandLine.arguments.count > 1 ? CommandLine.arguments[1] : ""
let options: CGWindowListOption = [.optionOnScreenOnly, .excludeDesktopElements]
let infoList = CGWindowListCopyWindowInfo(options, kCGNullWindowID) as? [[String: Any]] ?? []

for info in infoList {
    let owner = info[kCGWindowOwnerName as String] as? String ?? ""
    let title = info[kCGWindowName as String] as? String ?? ""
    let id = info[kCGWindowNumber as String] as? Int ?? 0
    let bounds = info[kCGWindowBounds as String] as? [String: Any] ?? [:]
    if desiredOwner.isEmpty || owner.localizedCaseInsensitiveContains(desiredOwner) || title.localizedCaseInsensitiveContains("装得清") {
        let output: [String: Any] = ["id": id, "owner": owner, "title": title, "bounds": bounds]
        if let data = try? JSONSerialization.data(withJSONObject: output),
           let line = String(data: data, encoding: .utf8) {
            print(line)
        }
    }
}
