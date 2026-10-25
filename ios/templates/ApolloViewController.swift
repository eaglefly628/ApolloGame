import UIKit
import WebKit

final class ApolloViewController: UIViewController, WKNavigationDelegate, WKUIDelegate {
    private var active: Bool
    private var audioInterrupted = false
    private var webView: WKWebView!
    private let scripts = WKUserContentController()

    init(active: Bool) {
        self.active = active
        super.init(nibName: nil, bundle: nil)
    }

    required init?(coder: NSCoder) { fatalError("Use init(active:)") }

    override func loadView() {
        let root = UIView()
        root.backgroundColor = .black
        view = root
        let configuration = WKWebViewConfiguration()
        configuration.websiteDataStore = .default()
        configuration.userContentController = scripts
        configuration.setURLSchemeHandler(ApolloSchemeHandler(), forURLScheme: "apollo")
        configuration.allowsInlineMediaPlayback = true
        configuration.allowsAirPlayForMediaPlayback = false
        configuration.allowsPictureInPictureMediaPlayback = false
        // Audio resumes only after a game/player gesture, including after interruptions.
        configuration.mediaTypesRequiringUserActionForPlayback = .all
        installStateScript()
        webView = WKWebView(frame: .zero, configuration: configuration)
        webView.navigationDelegate = self
        webView.uiDelegate = self
        webView.isOpaque = false
        webView.backgroundColor = .black
        webView.scrollView.backgroundColor = .black
        webView.scrollView.isScrollEnabled = false
        webView.scrollView.bounces = false
        webView.scrollView.contentInsetAdjustmentBehavior = .never
        webView.allowsLinkPreview = false
        webView.translatesAutoresizingMaskIntoConstraints = false
        root.addSubview(webView)
        NSLayoutConstraint.activate([
            webView.leadingAnchor.constraint(equalTo: root.safeAreaLayoutGuide.leadingAnchor),
            webView.trailingAnchor.constraint(equalTo: root.safeAreaLayoutGuide.trailingAnchor),
            webView.topAnchor.constraint(equalTo: root.safeAreaLayoutGuide.topAnchor),
            webView.bottomAnchor.constraint(equalTo: root.safeAreaLayoutGuide.bottomAnchor)
        ])
        webView.load(URLRequest(url: URL(string: "apollo://app/index.html")!))
    }

    private var stateSource: String {
        "window.__APOLLO_NATIVE_STATE__ = {active:\(active),audioInterrupted:\(audioInterrupted)};"
    }

    private func installStateScript() {
        scripts.removeAllUserScripts()
        let source = stateSource + "window.dispatchEvent(new CustomEvent('apollo:app-state',{detail:{active:\(active)}}));"
            + "window.dispatchEvent(new CustomEvent('apollo:audio-state',{detail:{interrupted:\(audioInterrupted)}}));"
        scripts.addUserScript(WKUserScript(source: source, injectionTime: .atDocumentStart, forMainFrameOnly: true))
    }

    func setActive(_ value: Bool) {
        active = value
        installStateScript()
        guard isViewLoaded else { return }
        webView.evaluateJavaScript(stateSource + "window.dispatchEvent(new CustomEvent('apollo:app-state',{detail:{active:\(value)}}));", completionHandler: nil)
    }

    func setAudioInterrupted(_ value: Bool) {
        audioInterrupted = value
        installStateScript()
        guard isViewLoaded else { return }
        webView.evaluateJavaScript(stateSource + "window.dispatchEvent(new CustomEvent('apollo:audio-state',{detail:{interrupted:\(value)}}));", completionHandler: nil)
    }

    func webView(_ webView: WKWebView, decidePolicyFor navigationAction: WKNavigationAction, decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
        let allowed = ApolloSchemeHandler.permitsNavigation(navigationAction.request.url, hasTargetFrame: navigationAction.targetFrame != nil)
        if !allowed { NSLog("Apollo reject: navigation outside existing bundled frames") }
        decisionHandler(allowed ? .allow : .cancel)
    }

    func webView(_ webView: WKWebView, createWebViewWith configuration: WKWebViewConfiguration, for navigationAction: WKNavigationAction, windowFeatures: WKWindowFeatures) -> WKWebView? {
        NSLog("Apollo reject: new web window")
        return nil
    }

    func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) {
        NSLog("Apollo reject: bundled page load failed: %@", error.localizedDescription)
    }

    func webViewWebContentProcessDidTerminate(_ webView: WKWebView) {
        NSLog("Apollo transition: web process terminated; reload bundled page")
        webView.load(URLRequest(url: URL(string: "apollo://app/index.html")!))
    }
}
