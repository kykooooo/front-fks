const { withDangerousMod } = require("@expo/config-plugins");
const fs = require("fs");
const path = require("path");

function addRctFollyPod(podfileContents) {
  let contents = podfileContents;

  // Add CocoaPods source at the very top if not present
  const sourceLines = [
    "source 'https://cdn.cocoapods.org/'",
    "source 'https://github.com/CocoaPods/Specs.git'"
  ];

  for (const sourceLine of sourceLines) {
    if (!contents.includes(sourceLine)) {
      contents = sourceLine + "\n" + contents;
    }
  }

  const podLine =
    "  pod 'RCT-Folly', :podspec => '../node_modules/react-native/third-party-podspecs/RCT-Folly.podspec'\n";

  if (contents.includes("RCT-Folly")) return contents;

  const marker = "use_expo_modules!";
  const idx = contents.indexOf(marker);
  if (idx !== -1) {
    const insertAt = contents.indexOf("\n", idx);
    if (insertAt !== -1) {
      return (
        contents.slice(0, insertAt + 1) +
        podLine +
        contents.slice(insertAt + 1)
      );
    }
  }

  // Fallback: insert before the final `end`
  const lastEnd = contents.lastIndexOf("\nend");
  if (lastEnd !== -1) {
    return (
      contents.slice(0, lastEnd) + "\n" + podLine + contents.slice(lastEnd)
    );
  }

  return contents;
}

module.exports = function withRctFollyPod(config) {
  return withDangerousMod(config, [
    "ios",
    async (config) => {
      const podfilePath = path.join(config.modRequest.platformProjectRoot, "Podfile");
      const podfile = fs.readFileSync(podfilePath, "utf8");
      const updated = addRctFollyPod(podfile);
      if (updated !== podfile) {
        fs.writeFileSync(podfilePath, updated);
      }
      return config;
    },
  ]);
};
