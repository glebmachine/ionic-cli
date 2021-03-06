import { OptionGroup, unparseArgs } from '@ionic/cli-framework';
import chalk from 'chalk';
import * as Debug from 'debug';

import { CommandLineInputs, CommandLineOptions, CommandMetadata, IonicAngularBuildOptions } from '../../../definitions';
import { BUILD_SCRIPT, BuildRunner, BuildRunnerDeps } from '../../build';

import { IonicAngularProject } from './';
import { APP_SCRIPTS_OPTIONS } from './app-scripts';

const debug = Debug('ionic:cli-utils:lib:project:ionic-angular:build');

export const DEFAULT_PROGRAM = 'ionic-app-scripts';
export const DEFAULT_BUILD_SCRIPT_VALUE = `${DEFAULT_PROGRAM} build`;

export interface IonicAngularBuildRunnerDeps extends BuildRunnerDeps {
  readonly project: IonicAngularProject;
}

export class IonicAngularBuildRunner extends BuildRunner<IonicAngularBuildOptions> {
  constructor(protected readonly e: IonicAngularBuildRunnerDeps) {
    super();
  }

  async getCommandMetadata(): Promise<Partial<CommandMetadata>> {
    return {
      description: `${chalk.green('ionic build')} uses ${chalk.bold('@ionic/app-scripts')}. See the project's ${chalk.bold('README.md')}${chalk.cyan('[1]')} for documentation. Options not listed below are considered advanced and can be passed to the ${chalk.green('ionic-app-scripts')} CLI using the ${chalk.green('--')} separator after the Ionic CLI arguments. See the examples.

${chalk.cyan('[1]')}: ${chalk.bold('https://github.com/ionic-team/ionic-app-scripts/blob/master/README.md')}`,
      options: [
        {
          name: 'source-map',
          summary: 'Output sourcemaps',
          type: Boolean,
          groups: [OptionGroup.Advanced],
          hint: chalk.dim('[app-scripts]'),
        },
        ...APP_SCRIPTS_OPTIONS,
      ],
      exampleCommands: [
        '--prod',
      ],
    };
  }

  createOptionsFromCommandLine(inputs: CommandLineInputs, options: CommandLineOptions): IonicAngularBuildOptions {
    const baseOptions = super.createBaseOptionsFromCommandLine(inputs, options);
    const sourcemaps = typeof options['source-map'] === 'boolean' ? Boolean(options['source-map']) : undefined;

    return {
      ...baseOptions,
      type: 'ionic-angular',
      prod: options['prod'] ? true : false,
      sourcemaps,
      aot: options['aot'] ? true : false,
      minifyjs: options['minifyjs'] ? true : false,
      minifycss: options['minifycss'] ? true : false,
      optimizejs: options['optimizejs'] ? true : false,
      env: options['env'] ? String(options['env']) : undefined,
    };
  }

  async buildProject(options: IonicAngularBuildOptions): Promise<void> {
    const { pkgManagerArgs } = await import('../../utils/npm');
    const pkg = await this.e.project.requirePackageJson();

    let program = DEFAULT_PROGRAM;
    let args = this.generateAppScriptsArgs(options);
    const shellOptions = { cwd: this.e.project.directory };

    debug(`Looking for ${chalk.cyan(BUILD_SCRIPT)} npm script.`);

    if (pkg.scripts && pkg.scripts[BUILD_SCRIPT]) {
      if (pkg.scripts[BUILD_SCRIPT] === DEFAULT_BUILD_SCRIPT_VALUE) {
        debug(`Found ${chalk.cyan(BUILD_SCRIPT)}, but it is the default. Not running.`);
        args = ['build', ...args];
      } else {
        debug(`Invoking ${chalk.cyan(BUILD_SCRIPT)} npm script.`);
        const [ pkgManager, ...pkgArgs ] = await pkgManagerArgs(this.e.config.get('npmClient'), { command: 'run', script: BUILD_SCRIPT, scriptArgs: args });
        program = pkgManager;
        args = pkgArgs;
      }
    } else {
      args = ['build', ...args];
    }

    await this.e.shell.run(program, args, shellOptions);
  }

  generateAppScriptsArgs(options: IonicAngularBuildOptions): string[] {
    const minimistArgs = {
      _: [],
      prod: options.prod ? true : false,
      aot: options.aot ? true : false,
      minifyjs: options.minifyjs ? true : false,
      minifycss: options.minifycss ? true : false,
      optimizejs: options.optimizejs ? true : false,
      generateSourceMap: typeof options.sourcemaps !== 'undefined' ? options.sourcemaps ? 'true' : 'false' : undefined,
      target: options.engine === 'cordova' ? 'cordova' : undefined,
      platform: options.platform,
      env: options.env,
    };

    return [...unparseArgs(minimistArgs, { allowCamelCase: true, useEquals: false }), ...options['--']];
  }
}
