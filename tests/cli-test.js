'use strict';

const { expect } = require('chai');
const execa = require('execa');
const { getBinPath } = require('get-bin-path');
const fs = require('fs');
const registries = require('./registries');
const { join } = require('path');

async function runSupportedCmd(inputArgs) {
  let args = [await getBinPath()];
  if (inputArgs && inputArgs.length) {
    args.push.apply(args, inputArgs);
  }
  return execa('node', args, {
    shell: true,
    reject: false,
  });
}

describe('CLI', function () {
  beforeEach(function () {
    registries.startAll();
  });

  afterEach(function () {
    registries.stopAll();
  });

  it('exits with status code 1 if no arguments are passed', async function () {
    const child = await runSupportedCmd();
    expect(child.exitCode).to.eql(1);
    expect(child.stderr).to.eql('');
    expect(child.stdout).to.match(/supported/);
  });

  describe('default output', function () {
    it('works against a fully supported project', async function () {
      const child = await runSupportedCmd([`${__dirname}/fixtures/supported-project`]);
      expect(child.exitCode).to.eql(0);
      expect(child.stderr).to.includes('✓ SemVer Policy');
      expect(child.stdout).to.includes('Congrats!');
    });

    it('works against a unsupported project', async function () {
      const child = await runSupportedCmd([`${__dirname}/fixtures/unsupported-project`]);
      expect(child.exitCode).to.eql(1);
      expect(child.stderr).to.includes('✗ SemVer Policy');
      expect(child.stdout).to.includes('Support Policy Problem Detected!');
      expect(child.stdout).to.includes(
        '✗ SemVer Policy (3 violations in 4 dependencies)\n      ✗ major version [3 dependencies up-to',
      );
    });

    it('works against a version expires soon project', async function () {
      const child = await runSupportedCmd([`${__dirname}/fixtures/version-expire-soon`]);
      expect(child.exitCode).to.eql(0);
      expect(child.stderr).to.includes('⚠ SemVer Policy');
      expect(child.stdout).to.includes('⚠ Warning!');
      expect(child.stdout).to.includes(
        '⚠ node LTS Policy\n      ⚠ version/version-range 10.0.0 will be deprecated within 1 qtr',
      );
      expect(child.stdout).to.includes(
        '⚠ SemVer Policy (1 in 4 dependencies will expire soon) \n      ⚠ major [1 dependency will expire within',
      );
    });

    it('works against a no node version project', async function () {
      const child = await runSupportedCmd([`${__dirname}/fixtures/no-node-version`]);
      expect(child.exitCode).to.eql(0);
      expect(child.stderr).to.includes('⚠ node LTS Policy');
      expect(child.stdout).to.includes('⚠ Warning!');
      expect(child.stdout).to.includes(
        '⚠ node LTS Policy\n      ⚠ No node version mentioned in the package.json. Please add engines/volta',
      );
    });

    it('works against multiple project', async function () {
      // Test in windows are failing
      // Issue may be caused by npmconfig command we have in the code base. For now we are increasing the timeout.
      this.timeout(4000);
      const child = await runSupportedCmd([
        `${__dirname}/fixtures/supported-project`,
        `${__dirname}/fixtures/unsupported-project`,
      ]);
      expect(child.exitCode).to.eql(1);
      expect(child.stderr).to.eql('- working');
      expect(child.stdout).to.includes('Support Policy Problem Detected!');
      expect(child.stdout).to.includes('✗ unsupported-project');
      expect(child.stdout).to.includes('✓ supported-project');
    });
  });

  describe('--verbose', function () {
    it('works against a unsupported project', async function () {
      const child = await runSupportedCmd([
        `${__dirname}/fixtures/unsupported-project`,
        '--verbose',
      ]);
      expect(child.exitCode).to.eql(1);
      expect(child.stderr).to.includes('✗ SemVer Policy');
      expect(child.stdout).to.includes('Support Policy Problem Detected!');
      expect(child.stdout).to.includes(
        '@eslint-ast/eslint-plugin-graphql  1.0.4                          1.0.4',
      );
      expect(child.stdout).to.includes(
        '@stefanpenner/a                    1.0.3                          2.0.0   major',
      );
    });

    it('works against a supported project', async function () {
      const child = await runSupportedCmd([`${__dirname}/fixtures/supported-project`, '-d']);
      expect(child.exitCode).to.eql(0);
      expect(child.stderr).to.includes('✓ SemVer Policy');
      expect(child.stdout).to.includes('Congrats!');
      expect(child.stdout).to.includes('es6-promise');
      expect(child.stdout).to.includes('@eslint-ast/eslint-plugin-graphql');
    });

    it('works against a version expires soon project', async function () {
      const child = await runSupportedCmd([
        `${__dirname}/fixtures/version-expire-soon`,
        '--verbose',
      ]);
      expect(child.exitCode).to.eql(0);
      expect(child.stderr).to.includes('⚠ SemVer Policy');
      expect(child.stdout).to.includes('⚠ Warning!');
      expect(child.stdout).to.includes(
        `@stefanpenner/b                    1.0.3     2.0.0   major`,
      );
      expect(child.stdout).to.includes(`node                               10.0.0    >=14.*  LTS`);
    });
  });

  describe('Filter options like --unsupported/expiring/supported', function () {
    it('works against a unsupported project with --unsupported option', async function () {
      const child = await runSupportedCmd([
        `${__dirname}/fixtures/unsupported-project`,
        '--unsupported',
      ]);
      expect(child.exitCode).to.eql(1);
      expect(child.stderr).to.includes('✗ SemVer Policy');
      expect(child.stdout).to.includes('Support Policy Problem Detected!');
      expect(child.stdout).to.includes('es6-promise      3.3.1     4.2.8   major');
    });

    it('works against a unsupported project with --supported option', async function () {
      const child = await runSupportedCmd([
        `${__dirname}/fixtures/unsupported-project`,
        '--supported',
      ]);
      expect(child.exitCode).to.eql(1);
      expect(child.stderr).to.includes('✗ SemVer Policy');
      expect(child.stdout).to.includes('Support Policy Problem Detected!');
      expect(child.stdout).to.includes('@eslint-ast/eslint-plugin-graphql  1.0.4     1.0.4');
    });

    it('works against a unsupported project with --expiring option', async function () {
      const child = await runSupportedCmd([
        `${__dirname}/fixtures/version-expire-soon`,
        '--expiring',
      ]);
      expect(child.exitCode).to.eql(0);
      expect(child.stderr).to.includes('- working');
      expect(child.stdout).to.includes('⚠ Warning!');
      expect(child.stdout).to.includes('@stefanpenner/b  1.0.3     2.0.0   major');
    });
  });
  describe('--csv', function () {
    afterEach(function () {
      let filePath = `${__dirname}/fixtures/unsupported-project/unsupported-project-support-audit.csv`;
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    });
    it('works against a unsupported project', async function () {
      const child = await runSupportedCmd([`${__dirname}/fixtures/unsupported-project`, '--csv']);
      expect(child.exitCode).to.eql(1);
      expect(child.stderr).to.includes('✗ SemVer Policy');
      expect(child.stdout).to.includes(
        `Report for unsupported-project created at ${join(
          __dirname,
          `/fixtures/unsupported-project/`,
        )}`,
      );
    });
  });
  describe('--json', function () {
    it('works against a fully supported project', async function () {
      const child = await runSupportedCmd([`${__dirname}/fixtures/supported-project`, '--json']);
      expect(child.exitCode).to.eql(0);
      expect(child.stderr).to.includes('✓ SemVer Policy');
      let result = JSON.parse(child.stdout);
      expect(result).to.eql({
        expiringSoonCount: 0,
        isInSupportWindow: true,
        projects: [
          {
            isExpiringSoon: false,
            isInSupportWindow: true,
            projectName: 'supported-project',
            projectPath: `${__dirname}/fixtures/supported-project`,
            supportChecks: [
              {
                isSupported: true,
                name: '@eslint-ast/eslint-plugin-graphql',
                resolvedVersion: '1.0.4',
                latestVersion: '1.0.4',
              },
              {
                isSupported: true,
                name: '@stefanpenner/a',
                resolvedVersion: '2.0.0',
                latestVersion: '2.0.0',
              },
              {
                isSupported: true,
                name: 'es6-promise',
                resolvedVersion: '4.2.8',
                latestVersion: '4.2.8',
              },
              {
                isSupported: true,
                resolvedVersion: '15.3.0',
                latestVersion: '>=14.*',
                name: 'node',
              },
              {
                isSupported: true,
                name: 'rsvp',
                resolvedVersion: '4.8.5',
                latestVersion: '4.8.5',
              },
            ],
          },
        ],
      });
    });

    it('works against a unsupported project', async function () {
      const child = await runSupportedCmd([`${__dirname}/fixtures/unsupported-project`, '--json']);
      expect(child.exitCode).to.eql(1);
      expect(child.stderr).to.includes('✗ SemVer Policy');
      let jsonOut = JSON.parse(child.stdout);
      // purge out the duration from node entry from out
      // because we use `new Date` to calculate the duration
      jsonOut.projects[0].supportChecks.forEach(pkg => {
        if (pkg.duration) {
          expect(pkg.duration).to.be.a('number');
          expect(pkg.deprecationDate).to.be.a('string');
          delete pkg['duration'];
          delete pkg['deprecationDate'];
        }
      });
      expect(jsonOut).to.eql({
        expiringSoonCount: 0,
        isInSupportWindow: false,
        projectName: 'unsupported-project',
        projectPath: `${__dirname}/fixtures/unsupported-project`,
        supportChecks: [
          {
            isSupported: false,
            message: 'violated: major version must be within 1 year of latest',
            type: 'major',
            name: 'es6-promise',
            resolvedVersion: '3.3.1',
            latestVersion: '4.2.8',
          },
          {
            isSupported: false,
            message: 'violated: major version must be within 1 year of latest',
            type: 'major',
            name: '@stefanpenner/a',
            resolvedVersion: '1.0.3',
            latestVersion: '2.0.0',
          },
          {
            isSupported: false,
            message: 'violated: major version must be within 1 year of latest',
            type: 'major',
            name: 'rsvp',
            resolvedVersion: '3.6.2',
            latestVersion: '4.8.5',
          },
          {
            isSupported: true,
            resolvedVersion: '10.* || 12.* || 14.* || >= 15',
            latestVersion: '>=14.*',
            message: 'Using maintenance LTS. Update to latest LTS',
            name: 'node',
          },
          {
            isSupported: true,
            name: '@eslint-ast/eslint-plugin-graphql',
            resolvedVersion: '1.0.4',
            latestVersion: '1.0.4',
          },
        ],
      });
    });
  });
});
