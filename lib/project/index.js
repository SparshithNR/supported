'use strict';

const os = require('os');
const fetch = require('minipass-fetch');
const debug = require('debug')('supported:project');
const allSettled = require('promise.allsettled');

const { default: PQueue } = require('p-queue');
const { supportedRanges, supported } = require('../time/index');
const { isLtsOrLatest } = require('../lts');
const { sortLibraries } = require('../util');
const CACHE = {};

module.exports = async function isInSupportWindow(dependenciesToCheck, projectName) {
  const queue = new PQueue({
    concurrency: os.cpus().length,
  });

  const supportChecks = [];
  const work = [];
  for (const moduleMeta of dependenciesToCheck) {
    const { resolvedVersion, name, url } = moduleMeta;
    work.push(
      queue.add(async () => {
        // TODO: likely extract this function for testing
        // TODO: test GH/Repo

        if (name === 'node') {
          supportChecks.push({
            ...isLtsOrLatest(moduleMeta, moduleMeta.version),
            name: moduleMeta.name,
          });
          return;
        }

        try {
          // TODO: retries
          // make-promise-happen and npmFetch both leaked sockets, and I didn't have time to debug...
          let info = CACHE[url.toString()];
          if (!info) {
            debug('npmFetch[cache miss] %o', url.toString());
            debug('npmFetch[begin] %o', url.toString());
            info = await fetch(url.toString()).then(async request => {
              if (request.status === 200) {
                return request.json();
              } else if (request.status === 404) {
                // try parsing
                const { error } = await request.json();
                const e = new Error(
                  `[${error.code}][http.status=${request.status}] url:${url} ${error.summary}\n${error.details}`,
                );
                e.code = error.code;
                throw e;
              } else {
                throw new Error(`[http.status=${request.status}] url:${url}`);
              }
            });
            debug('npmFetch[end] %o', url.toString());
            CACHE[url.toString()] = info;
          } else {
            debug('npmFetch[cache hit] %o', url.toString());
          }

          let result = '';
          if (name === 'ember-cli') {
            result = isLtsOrLatest(info, resolvedVersion);
          } else {
            result = supported(
              info,
              `${name}@${resolvedVersion}`,
              supportedRanges(info.time[info['dist-tags'].latest]),
            );
          }
          supportChecks.push({
            ...result,
            name,
            resolvedVersion,
            latestVersion: info['dist-tags'].latest,
          });
        } catch (e) {
          debug('npmFetch[fail] %o %o', url.toString(), e);
          throw e;
        }
      }),
    );
  }

  debug('npmFetch[waiting]');
  await queue.onIdle();
  for (const settled of await allSettled(work)) {
    if (settled.status === 'rejected') {
      throw settled.reason;
    }
  }

  debug('npmFetch[complete]');

  supportChecks.sort(sortLibraries);

  return {
    isInSupportWindow: !supportChecks.find(({ isSupported }) => isSupported === false),
    supportChecks,
    projectName,
  };
};
