import UIKit
import AVFAudio

@main
final class AppDelegate: UIResponder, UIApplicationDelegate {
    var window: UIWindow?
    private var container: ApolloViewController?
    private var audioObserver: NSObjectProtocol?

    func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
        let controller = ApolloViewController(active: application.applicationState == .active)
        container = controller
        let window = UIWindow(frame: UIScreen.main.bounds)
        window.rootViewController = controller
        self.window = window
        window.makeKeyAndVisible()
        audioObserver = NotificationCenter.default.addObserver(forName: AVAudioSession.interruptionNotification, object: nil, queue: .main) { [weak controller] notification in
            guard let raw = notification.userInfo?[AVAudioSessionInterruptionTypeKey] as? UInt,
                  let type = AVAudioSession.InterruptionType(rawValue: raw) else { return }
            controller?.setAudioInterrupted(type == .began)
        }
        return true
    }

    func applicationDidBecomeActive(_ application: UIApplication) { container?.setActive(true) }
    func applicationWillResignActive(_ application: UIApplication) { container?.setActive(false) }
    func applicationDidEnterBackground(_ application: UIApplication) { container?.setActive(false) }
}
