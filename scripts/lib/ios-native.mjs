import { cp, lstat, mkdir, readFile, readdir, realpath, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const templateDir = fileURLToPath(new URL('../../ios/templates/', import.meta.url));
const xml = value => String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&apos;');
const inside = (child, parent) => child === parent || child.startsWith(parent + path.sep);

async function resolvedFuturePath(value) {
  try { return await realpath(value); }
  catch (error) {
    if (error.code !== 'ENOENT') throw error;
    return path.join(await resolvedFuturePath(path.dirname(value)), path.basename(value));
  }
}

async function rejectOutputSymlinkAncestors(value) {
  const segments = path.resolve(value).split(path.sep).filter(Boolean);
  let current = path.parse(path.resolve(value)).root;
  for (const segment of segments) {
    current = path.join(current, segment);
    try {
      if ((await lstat(current)).isSymbolicLink()) {
        // macOS exposes its standard temporary directories through these OS aliases.
        const systemAlias = process.platform === 'darwin' && ['/tmp', '/var'].includes(current)
          && await realpath(current) === '/private' + current;
        if (!systemAlias) throw new Error(`Output symlink is forbidden: ${current}`);
      }
    } catch (error) { if (error.code !== 'ENOENT') throw error; }
  }
}

async function validateOutputTree(directory) {
  let stat;
  try { stat = await lstat(directory); } catch (error) { if (error.code === 'ENOENT') return; throw error; }
  if (stat.isSymbolicLink()) throw new Error(`Output symlink is forbidden: ${directory}`);
  if (!stat.isDirectory()) throw new Error(`Output path must be a directory: ${directory}`);
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const full = path.join(directory, entry.name);
    if (entry.isSymbolicLink()) throw new Error(`Output symlink is forbidden: ${full}`);
    if (entry.isDirectory()) await validateOutputTree(full);
    else if (!entry.isFile()) throw new Error(`Unsupported output entry: ${full}`);
  }
}

function validateProduct(product) {
  if (!product || typeof product !== 'object') throw new Error('iOS product is required');
  if (typeof product.id !== 'string' || !/^[a-z0-9][a-z0-9-]*$/.test(product.id)) throw new Error('Invalid product id');
  if (typeof product.title !== 'string' || !product.title.trim() || /[\x00-\x1f]/.test(product.title)) throw new Error('Invalid product title');
  if (typeof product.version !== 'string' || !/^\d+\.\d+\.\d+$/.test(product.version)) throw new Error('Invalid iOS version');
  if (!/^[1-9]\d*(?:\.\d+){0,2}$/.test(String(product.buildNumber))) throw new Error('Invalid iOS buildNumber');
  if (!product.ios || typeof product.ios.bundleIdentifier !== 'string' || !/^[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)+$/.test(product.ios.bundleIdentifier)) throw new Error('Invalid iOS bundleIdentifier');
  if (!/^\d+\.\d+$/.test(product.ios.minimumOS ?? '15.0') || Number(product.ios.minimumOS ?? '15.0') < 15) throw new Error('iOS minimumOS must be at least 15.0');
  if (!product.viewport || !['portrait', 'landscape', 'all'].includes(product.viewport.orientation)
      || !Number.isFinite(product.viewport.width) || product.viewport.width <= 0
      || !Number.isFinite(product.viewport.height) || product.viewport.height <= 0) throw new Error('Invalid product viewport');
}

async function validateWebTree(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  for (const entry of entries) {
    const entryPath = path.join(directory, entry.name);
    if (entry.isSymbolicLink()) throw new Error(`Web bundle symlink is forbidden: ${entryPath}`);
    if (entry.isDirectory()) await validateWebTree(entryPath);
    else if (!entry.isFile()) throw new Error(`Unsupported web bundle entry: ${entryPath}`);
  }
}

function infoPlist(product) {
  const orientations = product.viewport.orientation === 'portrait' ? ['Portrait']
    : product.viewport.orientation === 'landscape' ? ['LandscapeLeft', 'LandscapeRight']
      : ['Portrait', 'PortraitUpsideDown', 'LandscapeLeft', 'LandscapeRight'];
  const orientationXML = orientations.map(item => `<string>UIInterfaceOrientation${item}</string>`).join('');
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
<key>CFBundleDevelopmentRegion</key><string>en</string>
<key>CFBundleDisplayName</key><string>${xml(product.title)}</string>
<key>CFBundleExecutable</key><string>$(EXECUTABLE_NAME)</string>
<key>CFBundleIdentifier</key><string>$(PRODUCT_BUNDLE_IDENTIFIER)</string>
<key>CFBundleInfoDictionaryVersion</key><string>6.0</string>
<key>CFBundleName</key><string>$(PRODUCT_NAME)</string>
<key>CFBundlePackageType</key><string>APPL</string>
<key>CFBundleShortVersionString</key><string>${xml(product.version)}</string>
<key>CFBundleVersion</key><string>${xml(product.buildNumber)}</string>
<key>LSRequiresIPhoneOS</key><true/>
<key>UILaunchScreen</key><dict/>
<key>UIRequiresFullScreen</key><true/>
<key>UISupportedInterfaceOrientations</key><array>${orientationXML}</array>
<key>UISupportedInterfaceOrientations~ipad</key><array>${orientationXML}</array>
</dict></plist>
`;
}

function projectFile(product, hasIcon) {
  const base = `CLANG_ENABLE_MODULES = YES; IPHONEOS_DEPLOYMENT_TARGET = ${product.ios.minimumOS ?? '15.0'}; SDKROOT = iphoneos; SWIFT_VERSION = 5.0;`;
  const target = `CODE_SIGN_STYLE = Automatic; CURRENT_PROJECT_VERSION = ${product.buildNumber}; GENERATE_INFOPLIST_FILE = NO; INFOPLIST_FILE = ApolloProduct/Info.plist; MARKETING_VERSION = ${product.version}; PRODUCT_BUNDLE_IDENTIFIER = "${product.ios.bundleIdentifier}"; PRODUCT_NAME = "$(TARGET_NAME)"; SUPPORTED_PLATFORMS = "iphoneos iphonesimulator"; SUPPORTS_MACCATALYST = NO; TARGETED_DEVICE_FAMILY = "1,2"; ${hasIcon ? 'ASSETCATALOG_COMPILER_APPICON_NAME = AppIcon;' : ''}`;
  return `// !$*UTF8*$!
{
archiveVersion = 1; classes = {}; objectVersion = 56;
objects = {
/* Begin PBXBuildFile section */
A00000000000000000000001 = {isa = PBXBuildFile; fileRef = B00000000000000000000001; };
A00000000000000000000002 = {isa = PBXBuildFile; fileRef = B00000000000000000000002; };
A00000000000000000000003 = {isa = PBXBuildFile; fileRef = B00000000000000000000003; };
A00000000000000000000004 = {isa = PBXBuildFile; fileRef = B00000000000000000000004; };
A00000000000000000000005 = {isa = PBXBuildFile; fileRef = B00000000000000000000005; };
${hasIcon ? 'A00000000000000000000006 = {isa = PBXBuildFile; fileRef = B00000000000000000000006; };' : ''}
/* End PBXBuildFile section */
/* Begin PBXFileReference section */
B00000000000000000000001 = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = AppDelegate.swift; sourceTree = "<group>"; };
B00000000000000000000002 = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = ApolloViewController.swift; sourceTree = "<group>"; };
B00000000000000000000003 = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = ApolloSchemeHandler.swift; sourceTree = "<group>"; };
B00000000000000000000004 = {isa = PBXFileReference; lastKnownFileType = folder; path = www; sourceTree = SOURCE_ROOT; };
B00000000000000000000005 = {isa = PBXFileReference; lastKnownFileType = text.xml; path = PrivacyInfo.xcprivacy; sourceTree = "<group>"; };
${hasIcon ? 'B00000000000000000000006 = {isa = PBXFileReference; lastKnownFileType = folder.assetcatalog; path = Assets.xcassets; sourceTree = "<group>"; };' : ''}
B00000000000000000000007 = {isa = PBXFileReference; lastKnownFileType = text.plist.xml; path = Info.plist; sourceTree = "<group>"; };
B00000000000000000000008 = {isa = PBXFileReference; explicitFileType = wrapper.application; includeInIndex = 0; path = ApolloProduct.app; sourceTree = BUILT_PRODUCTS_DIR; };
/* End PBXFileReference section */
C00000000000000000000001 = {isa = PBXGroup; children = (C00000000000000000000002, B00000000000000000000004, C00000000000000000000003); sourceTree = "<group>"; };
C00000000000000000000002 = {isa = PBXGroup; children = (B00000000000000000000001, B00000000000000000000002, B00000000000000000000003, B00000000000000000000005, B00000000000000000000007, ${hasIcon ? 'B00000000000000000000006,' : ''}); path = ApolloProduct; sourceTree = "<group>"; };
C00000000000000000000003 = {isa = PBXGroup; children = (B00000000000000000000008); name = Products; sourceTree = "<group>"; };
D00000000000000000000001 = {isa = PBXSourcesBuildPhase; buildActionMask = 2147483647; files = (A00000000000000000000001, A00000000000000000000002, A00000000000000000000003); runOnlyForDeploymentPostprocessing = 0; };
D00000000000000000000002 = {isa = PBXResourcesBuildPhase; buildActionMask = 2147483647; files = (A00000000000000000000004, A00000000000000000000005, ${hasIcon ? 'A00000000000000000000006,' : ''}); runOnlyForDeploymentPostprocessing = 0; };
D00000000000000000000003 = {isa = PBXFrameworksBuildPhase; buildActionMask = 2147483647; files = (); runOnlyForDeploymentPostprocessing = 0; };
E00000000000000000000001 = {isa = PBXNativeTarget; buildConfigurationList = F00000000000000000000002; buildPhases = (D00000000000000000000001, D00000000000000000000003, D00000000000000000000002); buildRules = (); dependencies = (); name = ApolloProduct; productName = ApolloProduct; productReference = B00000000000000000000008; productType = "com.apple.product-type.application"; };
E00000000000000000000002 = {isa = PBXProject; attributes = {BuildIndependentTargetsInParallel = YES; LastUpgradeCheck = 2600; }; buildConfigurationList = F00000000000000000000001; compatibilityVersion = "Xcode 14.0"; developmentRegion = en; hasScannedForEncodings = 0; knownRegions = (en, Base); mainGroup = C00000000000000000000001; productRefGroup = C00000000000000000000003; projectDirPath = ""; projectRoot = ""; targets = (E00000000000000000000001); };
F00000000000000000000001 = {isa = XCConfigurationList; buildConfigurations = (F00000000000000000000003, F00000000000000000000004); defaultConfigurationIsVisible = 0; defaultConfigurationName = Release; };
F00000000000000000000002 = {isa = XCConfigurationList; buildConfigurations = (F00000000000000000000005, F00000000000000000000006); defaultConfigurationIsVisible = 0; defaultConfigurationName = Release; };
F00000000000000000000003 = {isa = XCBuildConfiguration; buildSettings = {${base} SWIFT_OPTIMIZATION_LEVEL = "-Onone"; DEBUG_INFORMATION_FORMAT = dwarf; }; name = Debug; };
F00000000000000000000004 = {isa = XCBuildConfiguration; buildSettings = {${base} SWIFT_COMPILATION_MODE = wholemodule; SWIFT_OPTIMIZATION_LEVEL = "-O"; DEBUG_INFORMATION_FORMAT = "dwarf-with-dsym"; }; name = Release; };
F00000000000000000000005 = {isa = XCBuildConfiguration; buildSettings = {${target}}; name = Debug; };
F00000000000000000000006 = {isa = XCBuildConfiguration; buildSettings = {${target}}; name = Release; };
}; rootObject = E00000000000000000000002;
}
`;
}

const scheme = `<?xml version="1.0" encoding="UTF-8"?>
<Scheme LastUpgradeVersion="2600" version="1.3">
<BuildAction parallelizeBuildables="YES" buildImplicitDependencies="YES"><BuildActionEntries><BuildActionEntry buildForTesting="YES" buildForRunning="YES" buildForProfiling="YES" buildForArchiving="YES" buildForAnalyzing="YES"><BuildableReference BuildableIdentifier="primary" BlueprintIdentifier="E00000000000000000000001" BuildableName="ApolloProduct.app" BlueprintName="ApolloProduct" ReferencedContainer="container:ApolloProduct.xcodeproj"/></BuildActionEntry></BuildActionEntries></BuildAction>
<LaunchAction buildConfiguration="Debug" selectedDebuggerIdentifier="Xcode.DebuggerFoundation.Debugger.LLDB" selectedLauncherIdentifier="Xcode.IDEFoundation.Launcher.LLDB" launchStyle="0" useCustomWorkingDirectory="NO" ignoresPersistentStateOnLaunch="NO" debugDocumentVersioning="YES" debugServiceExtension="internal" allowLocationSimulation="NO"><BuildableProductRunnable runnableDebuggingMode="0"><BuildableReference BuildableIdentifier="primary" BlueprintIdentifier="E00000000000000000000001" BuildableName="ApolloProduct.app" BlueprintName="ApolloProduct" ReferencedContainer="container:ApolloProduct.xcodeproj"/></BuildableProductRunnable></LaunchAction>
<ProfileAction buildConfiguration="Release" shouldUseLaunchSchemeArgsEnv="YES" savedToolIdentifier="" useCustomWorkingDirectory="NO" debugDocumentVersioning="YES"><BuildableProductRunnable runnableDebuggingMode="0"><BuildableReference BuildableIdentifier="primary" BlueprintIdentifier="E00000000000000000000001" BuildableName="ApolloProduct.app" BlueprintName="ApolloProduct" ReferencedContainer="container:ApolloProduct.xcodeproj"/></BuildableProductRunnable></ProfileAction>
<AnalyzeAction buildConfiguration="Debug"/>
<ArchiveAction buildConfiguration="Release" revealArchiveInOrganizer="YES"/>
</Scheme>
`;

/** Generate the shared native container. Product choices remain declarative. */
export async function generateIOSProject({ outputDir, product, webDir }) {
  validateProduct(product);
  if (typeof outputDir !== 'string' || !outputDir || typeof webDir !== 'string' || !webDir) throw new Error('outputDir and webDir are required');
  await rejectOutputSymlinkAncestors(outputDir);
  await validateOutputTree(path.resolve(outputDir));
  const output = await resolvedFuturePath(path.resolve(outputDir));
  const sourceWeb = await realpath(webDir);
  if (!(await lstat(webDir)).isDirectory()) throw new Error('webDir must be a real directory');
  await validateWebTree(sourceWeb);
  if (!(await lstat(path.join(sourceWeb, 'index.html'))).isFile()) throw new Error('Web index.html is required');
  const targetWeb = path.join(output, 'www');
  if (sourceWeb !== targetWeb && (inside(output, sourceWeb) || inside(sourceWeb, output))) throw new Error('Overlapping webDir and outputDir are forbidden (except outputDir/www)');
  // Preflight before writing: existing copied resources cannot silently survive a regeneration.
  if (sourceWeb !== targetWeb) {
    try { await lstat(targetWeb); throw new Error('Output www already exists; use a fresh outputDir'); }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
  }
  let icon;
  if (product.icon) {
    icon = await readFile(product.icon);
    const png = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
    if (icon.length < 24 || !icon.subarray(0, 8).equals(png) || icon.readUInt32BE(16) !== 1024 || icon.readUInt32BE(20) !== 1024) throw new Error('iOS icon must be a 1024 x 1024 PNG');
  }
  const appDir = path.join(output, 'ApolloProduct');
  const projectPath = path.join(output, 'ApolloProduct.xcodeproj');
  const schemeDir = path.join(projectPath, 'xcshareddata', 'xcschemes');
  await mkdir(appDir, { recursive: true });
  await mkdir(schemeDir, { recursive: true });
  for (const filename of ['AppDelegate.swift', 'ApolloViewController.swift', 'ApolloSchemeHandler.swift', 'PrivacyInfo.xcprivacy']) {
    await cp(path.join(templateDir, filename), path.join(appDir, filename));
  }
  if (sourceWeb !== targetWeb) await cp(sourceWeb, targetWeb, { recursive: true, errorOnExist: true, force: false });
  await writeFile(path.join(appDir, 'Info.plist'), infoPlist(product));
  await writeFile(path.join(projectPath, 'project.pbxproj'), projectFile(product, Boolean(icon)));
  await writeFile(path.join(schemeDir, 'ApolloProduct.xcscheme'), scheme);
  if (icon) {
    const assets = path.join(appDir, 'Assets.xcassets');
    const appIcon = path.join(assets, 'AppIcon.appiconset');
    await mkdir(appIcon, { recursive: true });
    await writeFile(path.join(assets, 'Contents.json'), JSON.stringify({ info: { author: 'xcode', version: 1 } }, null, 2));
    await writeFile(path.join(appIcon, 'AppIcon.png'), icon);
    await writeFile(path.join(appIcon, 'Contents.json'), JSON.stringify({ images: [{ filename: 'AppIcon.png', idiom: 'universal', platform: 'ios', size: '1024x1024' }], info: { author: 'xcode', version: 1 } }, null, 2));
  }
  console.info(`[ios-native] commit: generated ${product.id} at ${projectPath}`);
  return { projectPath, scheme: 'ApolloProduct', webDir: targetWeb };
}
