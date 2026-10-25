import Foundation
import WebKit
import UniformTypeIdentifiers

/// Serves a fixed, persistent origin. No script message handler or native API bridge exists.
final class ApolloSchemeHandler: NSObject, WKURLSchemeHandler {
    private var activeTasks = Set<ObjectIdentifier>()
    private let resourceQueue = DispatchQueue(label: "apollo.bundle-resources", qos: .userInitiated)
    // Existing engine widgets can embed a bundled player; every frame retains the
    // same local origin and resource policy. Remote frames and plugins remain blocked.
    static let contentSecurityPolicy = "default-src 'self'; script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval' blob:; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; media-src 'self' data: blob:; font-src 'self' data:; connect-src 'self' data: blob:; worker-src 'self' blob:; frame-src 'self'; object-src 'none'; base-uri 'self'; form-action 'none'; frame-ancestors 'self'"

    static func permitsNavigation(_ url: URL?, hasTargetFrame: Bool) -> Bool {
        hasTargetFrame && isLocalURL(url)
    }
    static func isLocalURL(_ url: URL?) -> Bool {
        guard let url = url, let components = URLComponents(url: url, resolvingAgainstBaseURL: false) else { return false }
        return components.scheme == "apollo" && components.host == "app"
            && components.user == nil && components.password == nil && components.port == nil
            && safePath(components.percentEncodedPath) != nil
    }

    static func safePath(_ encodedPath: String) -> String? {
        guard let decoded = encodedPath.removingPercentEncoding,
              !decoded.contains("\\"), !decoded.contains("\0") else { return nil }
        let pieces = decoded.split(separator: "/", omittingEmptySubsequences: false)
        guard !pieces.contains(".."), !pieces.contains(".") else { return nil }
        return decoded == "" || decoded == "/" ? "index.html" : String(decoded.drop(while: { $0 == "/" }))
    }

    func webView(_ webView: WKWebView, start urlSchemeTask: WKURLSchemeTask) {
        guard let url = urlSchemeTask.request.url,
              Self.isLocalURL(url),
              let components = URLComponents(url: url, resolvingAgainstBaseURL: false),
              let path = Self.safePath(components.percentEncodedPath),
              let resourceRoot = Bundle.main.resourceURL?.appendingPathComponent("www", isDirectory: true),
              ["GET", "HEAD"].contains(urlSchemeTask.request.httpMethod ?? "GET") else {
            reject(urlSchemeTask, code: .unsupportedURL)
            return
        }
        let root = resourceRoot.resolvingSymlinksInPath().standardizedFileURL
        let file = root.appendingPathComponent(path).resolvingSymlinksInPath().standardizedFileURL
        guard file.path.hasPrefix(root.path + "/") else {
            reject(urlSchemeTask, code: .noPermissionsToReadFile)
            return
        }
        let identifier = ObjectIdentifier(urlSchemeTask)
        activeTasks.insert(identifier)
        resourceQueue.async {
          do {
            let data = try Data(contentsOf: file)
            let explicitTypes = ["js": "text/javascript", "mjs": "text/javascript", "wasm": "application/wasm", "json": "application/json", "svg": "image/svg+xml"]
            let mime = explicitTypes[file.pathExtension.lowercased()] ?? UTType(filenameExtension: file.pathExtension)?.preferredMIMEType ?? "application/octet-stream"
            // Offline bundle policy rejects remote subresources/fetches, forms and frames.
            let response = HTTPURLResponse(url: url, statusCode: 200, httpVersion: "HTTP/1.1", headerFields: [
                "Content-Type": mime,
                "Content-Length": String(data.count),
                "Content-Security-Policy": Self.contentSecurityPolicy,
                "X-Content-Type-Options": "nosniff"
            ])!
            DispatchQueue.main.async {
                guard self.activeTasks.remove(identifier) != nil else { return }
                urlSchemeTask.didReceive(response)
                if urlSchemeTask.request.httpMethod != "HEAD" { urlSchemeTask.didReceive(data) }
                urlSchemeTask.didFinish()
            }
          } catch {
            DispatchQueue.main.async {
                guard self.activeTasks.remove(identifier) != nil else { return }
                self.reject(urlSchemeTask, code: .fileDoesNotExist)
            }
          }
        }
    }

    // WebKit start/stop and completion delivery share the main queue. A stopped task
    // never receives callbacks, even if its background file read has already begun.
    func webView(_ webView: WKWebView, stop urlSchemeTask: WKURLSchemeTask) {
        activeTasks.remove(ObjectIdentifier(urlSchemeTask))
    }

    private func reject(_ task: WKURLSchemeTask, code: URLError.Code) {
        NSLog("Apollo reject: bundled resource request (%ld)", code.rawValue)
        task.didFailWithError(URLError(code))
    }
}
