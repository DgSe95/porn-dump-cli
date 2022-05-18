#!/usr/bin/env node
'use strict';

// Modules
const fs = require('fs');
const https = require('https');
const path = require('path');
const process = require('process');
const puppeteer = require('puppeteer');
const { spawn } = require('child_process');
const yargs = require('yargs/yargs');
const { hideBin } = require('yargs/helpers');

// Define arguments and help
// Used 'pirate' locale translator:
// - https://lingojam.com/PirateSpeak
const argv = yargs(hideBin(process.argv))
        .usage('\nAdult streaming websites data dumper / recorder [WiP]\n\nUsage: $0 <options>\n\nSupported: stripchat, xhamsterlive, mycamtv\nPlanned: chaturbate, cam4 and many more!')
        .group(['url', 'screenshot', 'remote', 'remote-api-key'], 'Analyze:')
        .group(['da', 'dc', 'ds', 'dmi', 'dhm', 'dom'], 'Dump:')
        .group(['play', 'record', 'preview', 'record-time', 'keep-recording', 'stop-recording-on-close', 'hwaccel', 'vaapi', 'nvidia'], 'Record an\' play:')
        .group(['format', 'output'], 'Output:')
        .alias('h', 'help')
        .alias('v', 'version')
        .options({
          'url': {
            alias: 'u',
            describe: 'The URL to look fer',
            nargs: 1,
            demandOption: true,
            type: 'string'
          },
          'screenshot': {
            alias: 's',
            describe: 'Make screenshot of the given URL',
            type: 'boolean'
          },
          'remote': {
            describe: 'Dump data from remote service (Using wss://chrome.browserless.io)',
            type: 'boolean'
          },
          'remote-api-key': {
            describe: 'API key for remote service (browserless.io)',
            nargs: 1,
            type: 'string'
          },
          'dump-all': {
            alias: 'da',
            describe: 'Dump all possible data from website',
            type: 'boolean'
          },
          'dump-config': {
            alias: 'dc',
            describe: 'Dump website config',
            type: 'boolean'
          },
          'dump-settings': {
            alias: 'ds',
            describe: 'Dump website settings',
            type: 'boolean'
          },
          'dump-model-info': {
            alias: 'dmi',
            describe: 'Dump model infos',
            type: 'boolean'
          },
          'dump-homepage-models': {
            alias: 'dhm',
            describe: 'Dump homepage models',
            type: 'boolean'
          },
          'dump-online-models': {
            alias: 'dom',
            describe: 'Dump online models',
            type: 'boolean'
          },
          'play': {
            alias: 'p',
            describe: 'Play given stream URL',
            type: 'boolean'
          },
          'record': {
            alias: 'r',
            describe: 'Record given stream URL',
            type: 'boolean'
          },
          'preview': {
            describe: 'Preview recorded stream (no need to set \`--record-time\`)',
            type: 'boolean'
          },
          'record-time': {
            describe: 'Recordin\' time (minutes)',
            nargs: 1,
            type: 'number'
          },
          'keep-recording': {
            describe: 'Keep recordin\' when preview window be closed (default)',
            type: 'boolean'
          },
          'stop-recording-on-close': {
            describe: 'Avast recordin\' when preview window be closed',
            type: 'boolean'
          },
          'hwaccel': {
            describe: 'Enable \'ardware acceleration',
            type: 'boolean'
          },
          'vaapi': {
            describe: 'Use VAAPI acceleration',
            type: 'boolean'
          },
          'nvidia': {
            describe: 'Use NVIDIA acceleration',
            type: 'boolean'
          },
          'format': {
            alias: 'f',
            describe: 'Recording format (mkv,mp4)',
            default: 'mp4',
            nargs: 1,
            type: 'string'
          },
          'output': {
            alias: 'o',
            describe: 'Define where to store dumped data',
            default: './samples',
            nargs: 1,
            type: 'string'
          }
        })
        .example('\n$0 --url https://stripchat.com/model-name')
        .epilog('Mabe with some THC by DgSe95 \\m/\n\nPS: Yes, I speak Pirate! :P')
        .locale('pirate')
        .wrap(110)
        .help()
        .argv;

// Config
const thisFile = path.basename(__filename);

// Settings
let dumpURL = null;
// let dumpURL = 'https://stripchat.com/model-name';
let outputDir = 'samples';
let recordFormat = 'mp4';
let useRemoteInstance = false;
let remoteInstanceApiKey = null;
let stopRecordingOnPreviewClose = true;
let maxRecordTime = false;
// let maxRecordTime = 60000;
// let maxRecordTime = (60000*10);
let useHardwareAccel = false;
let useVAAPI = false;
let useNVENC = false;

// Dump Features
let dumpEverything = false;
let dumpSiteConfig = false;
let dumpSiteSettings = false;
let dumpModelInfo = false;
let dumpHomepageModels = false;
let dumpOnlineModels = false;

// Actions
let doPlay = false;
let doRecord = false;
let doRecordAndPlay = false;
let doScreenshot = false;

// Stores
let dumpedURLs = [];
let dumpedData = {};

// Browser Instance
// Does not work anymore without API token :(
const getBrowser = () => useRemoteInstance
        ? puppeteer.connect({ browserWSEndpoint: 'wss://chrome.browserless.io?token=' + remoteInstanceApiKey })
        // ? puppeteer.connect({ browserWSEndpoint: 'wss://chrome.browserless.io' })
        // ? puppeteer.connect({ browserWSEndpoint: 'wss://chrome.browserless.io?token=YOUR-API-TOKEN' })
        : puppeteer.launch();

// Methods
function createDataFolder(path) {
  if (!path) { return false; }
  fs.mkdir(path, { recursive: true }, (err) => {
    if (err) throw err;
  });
}
function parseArgs() {
  console.log(`[${thisFile}] Received arguments:`, argv);

  // Parse `--url`
  if (argv.url && argv.url !== '') {
    dumpURL = argv.url;
  }

  // Parse `--screenshot`
  if (argv.screenshot) {
    doScreenshot = true;
  }

  // Parse `--remote`
  if (argv.remote) {
    useRemoteInstance = true;
  }

  // Parse `--remote-api-key`
  if (argv.remoteApiKey) {
    remoteInstanceApiKey = argv.remoteApiKey;
  }

  // Parse `--dump-all`
  if (argv.dumpAll) {
    dumpEverything = true;
  }

  // Parse `--dump-config`
  if (argv.dumpConfig) {
    dumpSiteConfig = true;
  }

  // Parse `--dump-settings`
  if (argv.dumpSettings) {
    dumpSiteSettings = true;
  }

  // Parse `--dump-homepage-models`
  if (argv.dumpHomepageModels) {
    dumpHomepageModels = true;
  }

  // Parse `--dump-online-models`
  if (argv.dumpOnlineModels) {
    dumpOnlineModels = true;
  }

  // Parse `--play`
  if (argv.play) {
    doPlay = true;
  }

  // Parse `--record`
  if (argv.record) {
    doRecord = true;
  }

  // Parse `--preview`
  if (argv.preview) {
    doRecord = false;
    doRecordAndPlay = true;
  }

  // Parse `--stop-recording-on-close`
  // FIXME: Change error message to cmd argument instead of internal name
  if (argv.stopRecordingOnClose) {
    stopRecordingOnPreviewClose = true;
  }

  // Parse `--keep-recording`
  if (argv.keepRecording) {
    stopRecordingOnPreviewClose = false;
  }

  // Parse `--record-time`
  // TODO: sanitize value?
  if (argv.recordTime) {
    maxRecordTime = (argv.recordTime * 1000 * 10);
  }

  // Parse `--hwaccel`
  if (argv.hwaccel) {
    useHardwareAccel = true;
  }

  // Parse `--vaapi`
  if (argv.vaapi) {
    useVAAPI = true;
  }

  // Parse `--nvidia`
  if (argv.nvidia) {
    useNVENC = true;
  }

  // Parse `--format`
  if (argv.format && argv.format !== '') {
    recordFormat = argv.format;
  }

  // Parse `--output`
  if (argv.output && argv.output !== '') {
    outputDir = argv.output;
  }
}
function logRequest(interceptedRequest) {
  console.log('A request was made:', interceptedRequest.url());
}
function dumpRequest(interceptedRequest) {
  dumpedURLs.push(interceptedRequest.url());
}
function dumpStreamURL() {
  let streamURL;

  if (Array.isArray(dumpedURLs) && dumpedURLs.length > 0) {
    dumpedURLs.forEach(dumpedURL => {
      if (String(dumpedURL).endsWith('.m3u8')) {
        streamURL = dumpedURL;
      }
    });
  }

  // DONE:
  // Format URL from https://b-hls-03.strpst.com/hls/16595881/master/16595881_auto.m3u8
  // To https://b-hls-03.strpst.com/hls/16595881/16595881.m3u8
  //
  // Required because not all streams have the same amounts of programs or mappings
  // then settings like '-map 0:6 -map 0.7' for `ffmpeg` or '-ast p:3 -vst p:3' for `ffplay`
  // will only work for certain streams but not all

  if (streamURL) {
    streamURL = String(streamURL).replace('master/', '');
    streamURL = String(streamURL).replace('_auto', '');
  }

  return streamURL;
}
function dumpSiteSettingsURL() {
  let siteSettingsURL;

  if (Array.isArray(dumpedURLs) && dumpedURLs.length > 0) {
    dumpedURLs.forEach(dumpedURL => {
      if (String(dumpedURL).includes('/availableSettings?')) {
        siteSettingsURL = dumpedURL;
      }
    });
  }

  return siteSettingsURL;
}
function dumpStreamSettingsURL(modelName) {
  let streamSettingsURL = dumpSiteSettingsURL();

  const parsedStreamSettingsURL = new URL(streamSettingsURL);

  let customStreamSettingsURL = parsedStreamSettingsURL.protocol;
  customStreamSettingsURL += '//' + parsedStreamSettingsURL.host;
  customStreamSettingsURL += parsedStreamSettingsURL.pathname.replace('users/availableSettings', `v2/models/username/${modelName}/cam`);

  return customStreamSettingsURL;
}
function dumpSiteConfigURL() {
  let siteConfigURL = dumpSiteSettingsURL();

  const parsedSiteConfigURL = new URL(siteConfigURL);

  let customSiteConfigURL = parsedSiteConfigURL.protocol;
  customSiteConfigURL += '//' + parsedSiteConfigURL.host;
  customSiteConfigURL += parsedSiteConfigURL.pathname.replace('users/availableSettings', 'v2/config');

  return customSiteConfigURL;
}
function dumpModelIntroURL() {
  let modelIntroURL;

  if (Array.isArray(dumpedURLs) && dumpedURLs.length > 0) {
    dumpedURLs.forEach(dumpedURL => {
      if (String(dumpedURL).includes('/intros/latest')) {
        modelIntroURL = dumpedURL;
      }
    });
  }

  return modelIntroURL;
}
function dumpModelInfoURL() {
  let modelInfoURL = dumpModelIntroURL();
  const parsedModelInfoURL = new URL(modelInfoURL);

  let customModelInfoURL = parsedModelInfoURL.protocol;
  customModelInfoURL += '//' + parsedModelInfoURL.host;
  customModelInfoURL += parsedModelInfoURL.pathname.replace('/intros/latest', '');

  return customModelInfoURL;
}
function dumpHomepageModelsURL() {
  let siteModelsURL = dumpSiteSettingsURL();

  const parsedSiteModelsURL = new URL(siteModelsURL);

  let customSiteModelsURL = parsedSiteModelsURL.protocol;
  customSiteModelsURL += '//' + parsedSiteModelsURL.host;
  customSiteModelsURL += parsedSiteModelsURL.pathname.replace('users/availableSettings', 'v2/models');

  return customSiteModelsURL;
}
function dumpOnlineModelsURL() {
  let onlineModelsURL;

  if (Array.isArray(dumpedURLs) && dumpedURLs.length > 0) {
    dumpedURLs.forEach(dumpedURL => {
      if (String(dumpedURL).includes('/models?') && String(dumpedURL).includes('offset=')) {
        onlineModelsURL = dumpedURL;
      }
    });
  }

  const parsedOnlineModelsURL = new URL(onlineModelsURL);
  let customOnlineModelURL = parsedOnlineModelsURL.protocol;
  customOnlineModelURL += '//' + parsedOnlineModelsURL.host;
  customOnlineModelURL += parsedOnlineModelsURL.pathname;
  customOnlineModelURL += '?limit=10000&offset=0';

  return customOnlineModelURL;
}
function storeJSON(data, type) {
  dumpedData[type] = data;
  console.log(`[${thisFile}] json: stored data:\n${JSON.stringify(dumpedData)}`);
}
async function dumpJSON(url, path) {
  if (!url) {
    console.error(`[${thisFile}] json: missing URL to fetch.`);
    return false;
  }
  if (!path) {
    console.error(`[${thisFile}] json: missing path to write.`);
    return false;
  }

  console.log(`[${thisFile}] json: fetching [${url}]...`);
  https.get(url, (res) => {
    let rawData = '';

    res.setEncoding('utf8');
    res.on('data', (chunk) => {
      rawData += chunk;
    });

    res.on('end', () => {
        try {
            console.log(`[${thisFile}] json: received data:\n${rawData}`);
            let json = JSON.parse(rawData);
            writeJSON(json, path);
        } catch (error) {
            console.error(error.message);
        };
    });
  }).on('error', (error) => {
      console.error(error.message);
  });
}
async function fetchJSON(url, type) {
  if (!url) {
    console.error(`[${thisFile}] json: missing URL to fetch.`);
    return false;
  }
  if (!type) {
    console.error(`[${thisFile}] json: missing data type to fetch.`);
    return false;
  }

  console.log(`[${thisFile}] json: fetching [${url}]...`);
  https.get(url, (res) => {
    let rawData = '';

    res.setEncoding('utf8');
    res.on('data', (chunk) => {
      rawData += chunk;
    });

    res.on('end', () => {
        try {
            console.log(`[${thisFile}] json: received data:\n${rawData}`);
            let json = JSON.parse(rawData);
            storeJSON(json, type);
            return json;
        } catch (error) {
            console.error(error.message);
        };
    });
  }).on('error', (error) => {
      console.error(error.message);
  });
}
function readJSON(path, cb) {
  if (!path) {
    console.error(`[${thisFile}] json: missing path where to read.`);
    return false;
  }

  console.log(`[${thisFile}] json: reading file [${path}]...`);

  fs.readFile(path, (err, data) => {
    if (err) {
      return cb && cb(err);
    }
    try {
      const obj = JSON.parse(data)
      return cb && cb(null, obj);
      // return cb && cb(null, JSON.parse(obj));
    } catch(err) {
      return cb && cb(err);
    }
  });
}
function writeJSON(data, path) {
  if (!data) {
    console.error(`[${thisFile}] json: missing data to write.`);
    return false;
  }
  if (!path) {
    console.error(`[${thisFile}] json: missing path where to write.`);
    return false;
  }

  fs.writeFile(path, JSON.stringify(data), (err) => {
    if (err) {
      console.error(`[${thisFile}] json: error while writing file [${path}].`);
      // throw err;
    }
    console.log(`[${thisFile}] json: file [${path}] saved.`);
  });
}
async function playStream(streamURL) {
  console.log(`\n[${thisFile}] Playing stream [${streamURL}]...\n`);

  let ffplay;

  // Only NVDIA hardware accel is possible with `ffplay`
  // It will not fail if '--hwaccel --vaapi' is given but not really supported
  // But simply let `ffplay` decide what decoder to use
  if (useHardwareAccel === true && useNVENC === true) {
    ffplay = spawn('ffplay', ['-hide_banner', '-vcodec', 'h264_cuvid', '-i', streamURL]);
  }
  else {
    ffplay = spawn('ffplay', ['-hide_banner', '-i', streamURL]);
  }

  ffplay.stdout.on('data', (data) => {
    console.log(`[ffplay] stdout: ${data}`);
  });

  ffplay.stderr.on('data', (data) => {
    console.error(`[ffplay] stderr: ${data}`);
  });

  ffplay.on('close', (code) => {
    console.log(`[ffplay] process exited with code: ${code}`);
  });
}

/*
 * ffmpeg based encoding methods
 *
 * See for references:
 * - https://trac.ffmpeg.org/wiki/HWAccelIntro
 * - https://trac.ffmpeg.org/wiki/Hardware/VAAPI
 * - https://gist.github.com/Brainiarc7/95c9338a737aa36d9bb2931bed379219
 * - https://trac.ffmpeg.org/ticket/3359
 * - https://www.reddit.com/r/ffmpeg/comments/anpfz0/make_ffplay_leave_video_on_gpu/
*/
async function recordStreamMP4(streamURL, modelName) {
  console.log(`\n[${thisFile}] Recording stream [${streamURL}]...\n`);

  let ffmpeg;
  if (useHardwareAccel === true && useVAAPI === true) {
    ffmpeg = spawn('ffmpeg', [
      '-hide_banner',
      '-threads', '0',
      '-y',
      '-hwaccel', 'vaapi',
      '-hwaccel_output_format', 'vaapi',
      '-vaapi_device', '/dev/dri/renderD128',
      '-i', streamURL,
      // '-vf', 'format=nv12|vaapi,hwupload,scale_vaapi=format=nv12',
      '-c:v', 'h264_vaapi',
      '-movflags', 'faststart',
      `${outputDir}/${modelName}.mp4`
    ]);
  }
  else if (useHardwareAccel === true && useNVENC === true) {
    ffmpeg = spawn('ffmpeg', [
      '-hide_banner',
      '-threads', '0',
      '-y',
      '-hwaccel', 'cuvid',
      '-hwaccel_output_format', 'cuda',
      '-c:v', 'h264_cuvid',
      '-i', streamURL,
      '-c:v', 'h264_nvenc',
      '-movflags', 'faststart',
      `${outputDir}/${modelName}.mp4`
    ]);
  }
  else {
    ffmpeg = spawn('ffmpeg', ['-hide_banner', '-threads', '0', '-y', '-i', streamURL, '-movflags', 'faststart', `${outputDir}/${modelName}.mp4`]);
  }

  // Killing recording process when max time reached
  let recordingTimeout;
  if (maxRecordTime) {
    recordingTimeout = setTimeout(() => {
      console.log(`\n[${thisFile}] Max recording time reached. Killing [ffmpeg]...\n`);
      ffmpeg.kill();
    }, maxRecordTime);
  }
  else {
    console.error(`[${thisFile}] maxRecordTime must be set in this mode.`);
    process.exit(1);
  }

  ffmpeg.stdout.on('data', (data) => {
    console.log(`[ffmpeg] stdout: ${data}`);
  });

  ffmpeg.stderr.on('data', (data) => {
    console.error(`[ffmpeg] stderr: ${data}`);
  });

  ffmpeg.on('error', (err) => {
    console.error(`[ffmpeg] unexpected error: ${err}`);
    ffmpeg.kill();
  });

  ffmpeg.on('close', (code) => {
    console.log(`[ffmpeg] process exited with code: ${code}`);

    // Stop recording timeout
    if (maxRecordTime && recordingTimeout) {
      clearTimeout(recordingTimeout);
    }
  });

  ffmpeg.on('exit', (code) => {
    if (code !== 0) {
      console.log(`[ffmpeg] process stopped with code: ${code}`);
    }
  });
}
async function recordStreamMKV(streamURL, modelName) {
  console.log(`\n[${thisFile}] Recording stream [${streamURL}]...\n`);

  let ffmpeg;
  if (useHardwareAccel === true && useVAAPI === true) {
    ffmpeg = spawn('ffmpeg', [
      '-hide_banner',
      '-threads', '0',
      '-y',
      '-hwaccel', 'vaapi',
      '-hwaccel_output_format', 'vaapi',
      '-vaapi_device', '/dev/dri/renderD128',
      '-i', streamURL,
      // '-vf', 'format=nv12|vaapi,hwupload,scale_vaapi=format=nv12',
      '-c:v', 'h264_vaapi',
      `${outputDir}/${modelName}.mkv`
    ]);
  }
  else if (useHardwareAccel === true && useNVENC === true) {
    ffmpeg = spawn('ffmpeg', [
      '-hide_banner',
      '-threads', '0',
      '-y',
      '-hwaccel', 'cuvid',
      '-hwaccel_output_format', 'cuda',
      '-c:v', 'h264_cuvid',
      '-i', streamURL,
      '-c:v', 'h264_nvenc',
      `${outputDir}/${modelName}.mkv`
    ]);
  }
  else {
    ffmpeg = spawn('ffmpeg', ['-hide_banner', '-threads', '0', '-y', '-i', streamURL, `${outputDir}/${modelName}.mkv`]);
  }

  // Killing recording process when max time reached
  let recordingTimeout;
  if (maxRecordTime) {
    recordingTimeout = setTimeout(() => {
      console.log(`\n[${thisFile}] Max recording time reached. Killing [ffmpeg]...\n`);
      ffmpeg.kill();
    }, maxRecordTime);
  }
  else {
    console.error(`[${thisFile}] maxRecordTime must be set in this mode.`);
    process.exit(1);
  }

  ffmpeg.stdout.on('data', (data) => {
    console.log(`[ffmpeg] stdout: ${data}`);
  });

  ffmpeg.stderr.on('data', (data) => {
    console.error(`[ffmpeg] stderr: ${data}`);
  });

  ffmpeg.on('error', (err) => {
    console.error(`[ffmpeg] unexpected error: ${err}`);
    ffmpeg.kill();
  });

  ffmpeg.on('close', (code) => {
    console.log(`[ffmpeg] process exited with code: ${code}`);

    // Stop recording timeout
    if (maxRecordTime && recordingTimeout) {
      clearTimeout(recordingTimeout);
    }
  });

  ffmpeg.on('exit', (code) => {
    if (code !== 0) {
      console.log(`[ffmpeg] process stopped with code: ${code}`);
    }
  });
}
async function recordAndPlayStreamMP4(streamURL, modelName) {
  console.log(`\n[${thisFile}] Recording/Replaying stream [${streamURL}]...\n`);

  let ffmpeg;
  if (useHardwareAccel === true && useVAAPI === true) {
    ffmpeg = spawn('ffmpeg', [
      '-hide_banner',
      '-threads', '0',
      '-y',
      '-hwaccel', 'vaapi',
      '-hwaccel_output_format', 'vaapi',
      '-vaapi_device', '/dev/dri/renderD128',
      '-i', streamURL,
      '-map', '0',
      // '-vf', 'format=nv12|vaapi,hwupload',
      // '-vf', 'hwupload,scale_vaapi=format=nv12',
      // '-vf', 'format=nv12|vaapi,hwupload,scale_vaapi=format=nv12',
      '-c:v', 'h264_vaapi',
      '-c:a', 'aac',
      '-movflags', 'faststart',
      '-f', 'tee',
      `${outputDir}/${modelName}.mp4|[f=nut]pipe:`
    ]);
  }
  else if (useHardwareAccel === true && useNVENC === true) {
    ffmpeg = spawn('ffmpeg', [
      '-hide_banner',
      '-threads', '0',
      '-y',
      '-hwaccel', 'cuvid',
      '-hwaccel_output_format', 'cuda',
      '-c:v', 'h264_cuvid',
      '-i', streamURL,
      '-map', '0',
      '-c:v', 'h264_nvenc',
      '-c:a', 'aac',
      '-movflags', 'faststart',
      '-f', 'tee',
      `${outputDir}/${modelName}.mp4|[f=nut]pipe:`
    ]);
  }
  else {
    ffmpeg = spawn('ffmpeg', [
      '-hide_banner',
      '-threads', '0',
      '-y',
      '-i', streamURL,
      '-map', '0',
      '-c:v', 'h264',
      '-c:a', 'aac',
      '-movflags', 'faststart',
      '-f', 'tee',
      `${outputDir}/${modelName}.mp4|[f=nut]pipe:`
    ]);
  }

  let ffplay;
  if (useHardwareAccel === true && useNVENC === true) {
    ffplay = spawn('ffplay', ['-hide_banner', '-vcodec', 'h264_cuvid', 'pipe:']);
  }
  else {
    ffplay = spawn('ffplay', ['-hide_banner', 'pipe:']);
  }

  // Killing recording process when max time reached
  let recordingTimeout;
  if (stopRecordingOnPreviewClose !== false || maxRecordTime !== false) {
    if (maxRecordTime) {
      recordingTimeout = setTimeout(() => {
        console.log(`\n[${thisFile}] Max recording time reached. Killing [ffmpeg]...\n`);
        ffmpeg.kill();
      }, maxRecordTime);
    }
  }
  else {
    console.error(`[${thisFile}] stopRecordingOnPreviewClose or maxRecordTime must be set in this mode.`);
    process.exit(1);
  }

  ffmpeg.stdout.on('data', (data) => {
    ffplay.stdin.write(data);
  });

  ffmpeg.stderr.on('data', (data) => {
    console.error(`[ffmpeg] stderr: ${data}`);
  });

  ffmpeg.on('error', (err) => {
    console.error(`[ffmpeg] unexpected error: ${err}`);
    ffmpeg.kill();
  });

  ffmpeg.on('close', (code) => {
    if (code !== 0) {
      console.log(`[ffmpeg] process exited with code: ${code}`);
    }

    // Stop recording timeout
    if (maxRecordTime && recordingTimeout) {
      clearTimeout(recordingTimeout);
    }

    // Stop receiving data from pipe
    ffplay.stdin.end();

    // Kill replaying process after few seconds
    // It is required to let enough time to receive all piped data
    // And also in the hope to avoid EPIPE errors
    if (!ffplay.killed) {
      setTimeout(() => {
        ffplay.kill();
      }, 6000);
    }
  });

  ffmpeg.on('exit', (code) => {
    if (code !== 0) {
      console.log(`[ffmpeg] process stopped with code: ${code}`);
    }
  });

  ffplay.stdin.on('error', (err) => {
    console.error(`[ffplay] stdin: unexpected error with code: ${err.code}`);
    if (err.code == "EPIPE") {
        // process.exit(1);
        // ffplay.stdin.end();
        ffplay.kill();
    }
  });

  ffplay.stdout.on('data', (data) => {
    console.log(`[ffplay] stdout: ${data}`);
  });

  ffplay.stderr.on('data', (data) => {
    console.error(`[ffplay] stderr: ${data}`);
  });

  ffplay.on('error', (err) => {
    console.error(`[ffplay] unexpected error: ${err}`);
    ffplay.kill();
  });

  ffplay.on('close', (code) => {
    if (code !== 0) {
      console.log(`[ffplay] process exited with code: ${code}`);
    }
    if (stopRecordingOnPreviewClose === true) {
      ffplay.stdin.end();
      ffmpeg.kill();
    }
  });

  ffplay.on('exit', (code) => {
    if (code !== 0) {
      console.log(`[ffplay] process stopped with code: ${code}`);
    }
  });
}
async function recordAndPlayStreamMKV(streamURL, modelName) {
  console.log(`\n[${thisFile}] Recording/Replaying stream [${streamURL}]...\n`);

  let ffmpeg;
  if (useHardwareAccel === true && useVAAPI === true) {
    ffmpeg = spawn('ffmpeg', [
      '-hide_banner',
      '-threads', '0',
      '-y',
      '-hwaccel', 'vaapi',
      '-hwaccel_output_format', 'vaapi',
      '-vaapi_device', '/dev/dri/renderD128',
      '-i', streamURL,
      '-map', '0',
      // '-vf', 'format=nv12|vaapi,hwupload',
      // '-vf', 'hwupload,scale_vaapi=format=nv12',
      // '-vf', 'format=nv12|vaapi,hwupload,scale_vaapi=format=nv12',
      '-c:v', 'h264_vaapi',
      '-c:a', 'aac',
      '-f', 'tee',
      `${outputDir}/${modelName}.mkv|[f=nut]pipe:`
    ]);
  }
  else if (useHardwareAccel === true && useNVENC === true) {
    ffmpeg = spawn('ffmpeg', [
      '-hide_banner',
      '-threads', '0',
      '-y',
      '-hwaccel', 'cuvid',
      '-hwaccel_output_format', 'cuda',
      '-c:v', 'h264_cuvid',
      '-i', streamURL,
      '-map', '0',
      '-c:v', 'h264_nvenc',
      '-c:a', 'aac',
      '-f', 'tee',
      `${outputDir}/${modelName}.mkv|[f=nut]pipe:`
    ]);
  }
  else {
    ffmpeg = spawn('ffmpeg', [
      '-hide_banner',
      '-threads', '0',
      '-y',
      '-i', streamURL,
      '-map', '0',
      '-c:v', 'h264',
      '-c:a', 'aac',
      '-f', 'tee',
      `${outputDir}/${modelName}.mkv|[f=nut]pipe:`
    ]);
  }

  let ffplay;
  if (useHardwareAccel === true && useNVENC === true) {
    ffplay = spawn('ffplay', ['-hide_banner', '-vcodec', 'h264_cuvid', 'pipe:']);
  }
  else {
    ffplay = spawn('ffplay', ['-hide_banner', 'pipe:']);
  }

  // Killing recording process when max time reached
  let recordingTimeout;
  if (stopRecordingOnPreviewClose !== false || maxRecordTime !== false) {
    if (maxRecordTime) {
      recordingTimeout = setTimeout(() => {
        console.log(`\n[${thisFile}] Max recording time reached. Killing [ffmpeg]...\n`);
        ffmpeg.kill();
      }, maxRecordTime);
    }
  }
  else {
    console.error(`[${thisFile}] stopRecordingOnPreviewClose or maxRecordTime must be set in this mode.`);
    process.exit(1);
  }

  ffmpeg.stdout.on('data', (data) => {
    ffplay.stdin.write(data);
  });

  ffmpeg.stderr.on('data', (data) => {
    console.error(`[ffmpeg] stderr: ${data}`);
  });

  ffmpeg.on('error', (err) => {
    console.error(`[ffmpeg] unexpected error: ${err}`);
    ffmpeg.kill();
  });

  ffmpeg.on('close', (code) => {
    if (code !== 0) {
      console.log(`[ffmpeg] process exited with code: ${code}`);
    }

    // Stop recording timeout
    if (maxRecordTime && recordingTimeout) {
      clearTimeout(recordingTimeout);
    }

    // Stop receiving data from pipe
    ffplay.stdin.end();

    // Kill replaying process after few seconds
    // It is required to let enough time to receive all piped data
    // And also in the hope to avoid EPIPE errors
    if (!ffplay.killed) {
      setTimeout(() => {
        ffplay.kill();
      }, 6000);
    }
  });

  ffmpeg.on('exit', (code) => {
    if (code !== 0) {
      console.log(`[ffmpeg] process stopped with code: ${code}`);
    }
  });

  ffplay.stdin.on('error', (err) => {
    console.error(`[ffplay] stdin: unexpected error with code: ${err.code}`);
    if (err.code == "EPIPE") {
        // process.exit(1);
        // ffplay.stdin.end();
        ffplay.kill();
    }
  });

  ffplay.stdout.on('data', (data) => {
    console.log(`[ffplay] stdout: ${data}`);
  });

  ffplay.stderr.on('data', (data) => {
    console.error(`[ffplay] stderr: ${data}`);
  });

  ffplay.on('error', (err) => {
    console.error(`[ffplay] unexpected error: ${err}`);
    ffplay.kill();
  });

  ffplay.on('close', (code) => {
    if (code !== 0) {
      console.log(`[ffplay] process exited with code: ${code}`);
    }
    if (stopRecordingOnPreviewClose === true) {
      ffplay.stdin.end();
      ffmpeg.kill();
    }
  });

  ffplay.on('exit', (code) => {
    if (code !== 0) {
      console.log(`[ffplay] process stopped with code: ${code}`);
    }
  });
}
async function makeScreenshot(page, modelName) {
  // Wait for agreement overlay to appear and click on the 'accept' button
  const agreementSelector = '.btn-visitors-agreement-accept';
  await page.waitForSelector(agreementSelector);
  await page.click(agreementSelector);

  // Screenshot the page
  await page.screenshot({ path: `${outputDir}/${modelName}.1920x1080.png`, fullPage: false });

  // Wait for agreement video element to appear
  const videoSelector = '.video-element';
  await page.waitForSelector(videoSelector);
  const videoElement = await page.$(videoSelector);

  // Screenshot the cam
  await videoElement.screenshot({ path: `${outputDir}/${modelName}.cam.png` });

  // Release element from memory
  await videoElement.dispose();
}

// Trying to handle EPIPE error
process.on('uncaughtException', (err, origin) => {
  fs.writeSync(
    process.stderr.fd,
    `Caught exception: ${err}\n` +
    `Exception origin: ${origin}`
  );
  // console.warn(`[${thisFile}] Caught exception: ${err}\nException origin: ${origin}`);
  process.exit(1);
});

// Process end status
process.on('beforeExit', (code) => {
  console.log(`[${thisFile}] process received 'beforeExit' event with code: ${code}`);
});
process.on('exit', (code) => {
  console.log(`[${thisFile}] process received 'exit' event with code: ${code}`);
});

// Parse given arguments
parseArgs();

// Dump engine
(async () => {
  // Fake start status
  console.log(`[${thisFile}] Started.`);

  // Create required output folder
  createDataFolder(outputDir);

  // Init browser instance
  let browser = null;

  try {
    // Create browser instance
    browser = await getBrowser();

    // Parse given URL
    const parsedURL = new URL(dumpURL);
    const parsedModelName = parsedURL.pathname.split('/')[1];

    // Create initial target
    const page = await browser.newPage();

    // Log and/or dump page requests
    // page.on('request', logRequest);
    page.on('request', dumpRequest);

    // Show page loading and dump results
    page.once('load', () => {
      console.log('==> Page loaded!');
      console.log(`==> Model Name: ${parsedModelName}`);
      console.log(`==> Dumped URLs: ${dumpedURLs.length}`);
      console.log(` - ${dumpedURLs.join('\n - ')}`);
      console.log(`==> Processed URLs:`);
      console.log(` - Stream URL: ${dumpStreamURL()}`);
      console.log(` - Stream Settings URL: ${dumpStreamSettingsURL(parsedModelName)}`);
      console.log(` - Model Intro URL: ${dumpModelIntroURL()}`);
      console.log(` - Model Infos URL: ${dumpModelInfoURL()}`);
      console.log(` - Site Config URL: ${dumpSiteConfigURL()}`);
      console.log(` - Site Settings URL: ${dumpSiteSettingsURL()}`);
      console.log(` - Homepage Models URL: ${dumpHomepageModelsURL()}`);
      console.log(` - Online Models URL: ${dumpOnlineModelsURL()}`);
    });

    // Browser loading status
    browser.once('targetcreated', () => console.log(`[${thisFile}] Launching browser instance [${useRemoteInstance === true ? 'remote' : 'local'}]...`));
    browser.once('disconnected', () => console.log(`\n[${thisFile}] Closed browser instance [${useRemoteInstance === true ? 'remote' : 'local'}].`));

    // Set viewport size to fullhd
    await page.setViewport({
      width: 1920,
      height: 1080,
      deviceScaleFactor: 1,
    });

    // Define URL to dump
    await page.goto(dumpURL);

    // Store dumped stream URL
    const streamURL = dumpStreamURL();

    // Check if we got a stream URL
    if (typeof streamURL === 'undefined') {
      console.error(`[${thisFile}] Could not find any stream URL to process. Exiting.`);
      process.exit(1);
    }

    // Make screenshots
    if (doScreenshot === true) {
      await makeScreenshot(page, parsedModelName);
    }

    // Stop logging requests
    page.off('request', logRequest);

    // Dump stream settings from JSON
    // This stream is the only one found that has some protection like user-agent checks
    // TODO: bypass checks to make results similar to those gathered from real browser
    if (dumpEverything === true || dumpModelInfo === true) {
      await dumpJSON(dumpStreamSettingsURL(), `${outputDir}/${parsedModelName}.cam.json`);
    }

    // Dump model intro from JSON
    if (dumpEverything === true || dumpModelInfo === true) {
      await dumpJSON(dumpModelIntroURL(), `${outputDir}/${parsedModelName}.intro.json`);
    }

    // Dump model info from JSON
    if (dumpEverything === true || dumpModelInfo === true) {
      await dumpJSON(dumpModelInfoURL(), `${outputDir}/${parsedModelName}.json`);
    }

    // Dump site config from JSON
    if (dumpEverything === true || dumpSiteConfig === true) {
      await dumpJSON(dumpSiteConfigURL(), `${outputDir}/site-config.json`);
    }

    // Dump site settings from JSON
    if (dumpEverything === true || dumpSiteSettings === true) {
      await dumpJSON(dumpSiteSettingsURL(), `${outputDir}/site-settings.json`);
    }

    // Dump all displayed models on site from JSON
    if (dumpEverything === true || dumpHomepageModels === true) {
      await dumpJSON(dumpHomepageModelsURL(), `${outputDir}/site-models.json`);
    }

    // Dump all connected models to JSON
    if (dumpEverything === true || dumpOnlineModels === true) {
      await dumpJSON(dumpOnlineModelsURL(), `${outputDir}/online-models.json`);
    }

    // Play dumped stream
    if (doPlay === true) {
      await playStream(streamURL);
    }

    // Record dumped stream
    if (doRecord === true) {
      switch (recordFormat) {
        default:
        case 'mp4':
          await recordStreamMP4(streamURL, parsedModelName);
          break;

        case 'mkv':
          await recordStreamMKV(streamURL, parsedModelName);
          break;
      }
    }

    // Record and play dumped stream
    if (doRecordAndPlay === true) {
      switch (recordFormat) {
        default:
        case 'mp4':
          await recordAndPlayStreamMP4(streamURL, parsedModelName);
          break;

        case 'mkv':
          await recordAndPlayStreamMKV(streamURL, parsedModelName);
          break;
      }
    }
  } catch (error) {
    console.error('[browser]', error.message);
  } finally {
    // Close browser instance
    if (browser) {
      browser.close();
    }
  }
})();
