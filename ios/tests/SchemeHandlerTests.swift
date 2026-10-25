import Foundation

/// Runs against the actual shared Swift resolver without booting an iOS runtime.
@main
struct SchemeHandlerTests {
    static func main() {
        let accepted = ["apollo://app/index.html", "apollo://app/assets/game.js?v=1", "apollo://app/", "apollo://app/assets/%E7%8C%AB.png"]
        let rejected = [
            "https://app/index.html", "file:///etc/hosts", "apollo://other/index.html",
            "apollo://user@app/index.html", "apollo://app:80/index.html", "apollo://app/../Info.plist",
            "apollo://app/%2e%2e/Info.plist", "apollo://app/assets/%2E%2E/Info.plist",
            "apollo://app/%2f..%2fInfo.plist", "apollo://app/assets/%5c..%5cInfo.plist",
            "apollo://app/assets/%00.png", "javascript:alert(1)", "about:blank"
        ]
        for value in accepted { precondition(ApolloSchemeHandler.isLocalURL(URL(string: value)), "Should accept bundled URL: \(value)") }
        for value in rejected { precondition(!ApolloSchemeHandler.isLocalURL(URL(string: value)), "Should reject URL: \(value)") }
        precondition(ApolloSchemeHandler.safePath("/") == "index.html")
        precondition(ApolloSchemeHandler.safePath("/assets/%E7%8C%AB.png") == "assets/猫.png")
        precondition(ApolloSchemeHandler.safePath("/%broken") == nil)
        // The same policy serves main frames and bundled NativeCharacter iframe players.
        precondition(ApolloSchemeHandler.permitsNavigation(URL(string: "apollo://app/player.html"), hasTargetFrame: true))
        precondition(!ApolloSchemeHandler.permitsNavigation(URL(string: "https://outside.test/player.html"), hasTargetFrame: true))
        precondition(!ApolloSchemeHandler.permitsNavigation(URL(string: "apollo://other/player.html"), hasTargetFrame: true))
        precondition(!ApolloSchemeHandler.permitsNavigation(URL(string: "apollo://app/player.html"), hasTargetFrame: false))
        precondition(ApolloSchemeHandler.contentSecurityPolicy.contains("frame-src 'self';"))
        precondition(ApolloSchemeHandler.contentSecurityPolicy.contains("frame-ancestors 'self'"))
        print("SchemeHandlerTests: \(accepted.count + rejected.count + 9) checks passed")
    }
}
