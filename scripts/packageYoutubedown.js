/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

import commander from 'commander'
import fs from 'fs-extra'
import mkdirp from 'mkdirp'
import path from 'path'
import replace from 'replace-in-file'
import util from '../lib/util.js'
import ntpUtil from '../lib/ntpUtil.js'

/*
  NOTE: For historical reason, this is named "Youtubedown" component, but
  we're packaging 'brave/playlist-component'.
*/
const stageFiles = (version, outputDir) => {
  // Copy resources and manifest file to outputDir.
  const resourceDir = path.join(path.resolve(), 'node_modules', 'playlist-component')
  console.log('copy dir:', resourceDir, ' to:', outputDir)
  fs.copySync(resourceDir, outputDir)

  // Fix up the manifest version
  const originalManifest = getOriginalManifest()
  const outputManifest = path.join(outputDir, 'manifest.json')
  console.log('copy manifest file: ', originalManifest, ' to: ', outputManifest)
  const replaceOptions = {
    files: outputManifest,
    from: /0\.0\.0/,
    to: version
  }
  fs.copyFileSync(originalManifest, outputManifest)
  replace.sync(replaceOptions)
}

const getOriginalManifest = () => {
  return path.join(path.resolve(), 'node_modules', 'playlist-component', 'manifest.json')
}

const generateCRXFile = (binary, endpoint, region, componentID, privateKeyFile,
  publisherProofKey) => {
  const rootBuildDir = path.join(path.resolve(), 'build', 'youtubedown')
  const stagingDir = path.join(rootBuildDir, 'staging')
  const crxOutputDir = path.join(rootBuildDir, 'output')
  mkdirp.sync(stagingDir)
  mkdirp.sync(crxOutputDir)
  util.getNextVersion(endpoint, region, componentID).then((version) => {
    const crxFile = path.join(crxOutputDir, 'youtubedown.crx')
    stageFiles(version, stagingDir)
    util.generateCRXFile(binary, crxFile, privateKeyFile, publisherProofKey,
      stagingDir)
    console.log(`Generated ${crxFile} with version number ${version}`)
  })
}

util.installErrorHandlers()

util.addCommonScriptOptions(
  commander
    .option('-k, --key <file>', 'file containing private key for signing crx file'))
  .parse(process.argv)

let privateKeyFile = ''
if (fs.existsSync(commander.key)) {
  privateKeyFile = commander.key
} else {
  throw new Error('Missing or invalid private key')
}

util.createTableIfNotExists(commander.endpoint, commander.region).then(() => {
  const [, componentID] = ntpUtil.generatePublicKeyAndID(privateKeyFile)
  generateCRXFile(commander.binary, commander.endpoint, commander.region,
    componentID, privateKeyFile, commander.publisherProofKey)
})
