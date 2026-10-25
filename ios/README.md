# Shared iOS container

`scripts/lib/ios-native.mjs` exports `generateIOSProject({outputDir, product, webDir})`.
It creates `ApolloProduct.xcodeproj` with the shared `ApolloProduct` scheme. The built
web bundle is preserved under `www/`, including nested files. An existing
`outputDir/www` can be referenced directly. Other source trees are copied into a
fresh `www`; symlinks, overlapping directories and stale copied bundles are rejected.
The caller validates product publication requirements separately.

The UIKit container loads `apollo://app/index.html` through a restricted bundle
handler. It uses `WKWebsiteDataStore.default()` for a stable persistent origin and
fits its web view inside UIKit's safe area. Bundle path traversal, remote navigation,
new windows and remote subresources are blocked. Same-origin bundled iframe players
remain available to engine widgets such as NativeCharacter. No JavaScript-to-native message
handler is installed. Local resource reads run off the main queue; cancelled requests
receive no further callbacks.

At document start, `window.__APOLLO_NATIVE_STATE__` contains `{active, audioInterrupted}`.
The host refreshes this state and dispatches `apollo:app-state` (`detail.active`) and
`apollo:audio-state` (`detail.interrupted`) on lifecycle/audio transitions. Consumers
must read the initial state as well as listen for events, because their listeners can
be installed after document start. Audio playback requires a player gesture.

No background mode, sensitive permission, advertising SDK or native collection API
is enabled. `PrivacyInfo.xcprivacy` declares no tracking or collected data; its
required reason API list is empty because this native implementation does not call
those API categories. Reassess it when adding native capabilities or third-party
SDKs, following [Apple's manifest documentation](https://developer.apple.com/documentation/bundleresources/privacy-manifest-files).
`ITSAppUsesNonExemptEncryption` is deliberately absent: the publisher's release gate
must require the applicable export compliance declaration before submission.

Validation:

```sh
npx vitest run scripts/lib/ios-native.test.mjs
xcrun swiftc ios/templates/ApolloSchemeHandler.swift ios/tests/SchemeHandlerTests.swift -o /tmp/apollo-scheme-tests
/tmp/apollo-scheme-tests
xcodebuild -project <output>/ApolloProduct.xcodeproj -scheme ApolloProduct -destination 'generic/platform=iOS Simulator' CODE_SIGNING_ALLOWED=NO build
xcodebuild -project <output>/ApolloProduct.xcodeproj -scheme ApolloProduct -destination 'generic/platform=iOS' -archivePath <archive>.xcarchive CODE_SIGNING_ALLOWED=NO archive
```

The generated project retains automatic signing support. Unsigned validation uses
the explicit build setting shown above. Signed archives need the publisher's team,
credentials and provisioning, followed by an authorized export/upload step.
Compilation alone does not verify touch behavior, audio recovery or persistence on
a running device; those need an installed simulator runtime or a real iPhone/iPad.
